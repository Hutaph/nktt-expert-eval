"""Check preview data, evidence spans, counts and mirrored web files."""

import hashlib
import json
from collections import Counter
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "dataset/vident_longmem_500"
PUBLIC = ROOT / "public/dataset/vident_longmem_500"


def read_jsonl(path):
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def validate():
    errors = []

    def check(condition, message):
        if not condition:
            errors.append(message)

    metadata = json.loads((DATA / "metadata.json").read_text(encoding="utf-8"))
    names = ["timelines.jsonl", "benchmark_cases.jsonl", "source_events.jsonl", "evidence_catalog.json", "metadata.json", "README.md"]
    for name in names:
        check((DATA / name).read_bytes() == (PUBLIC / name).read_bytes(), f"Mirrors differ: {name}")
    for name, expected in metadata["files_checksum_sha256"].items():
        actual = hashlib.sha256((DATA / name).read_bytes()).hexdigest()
        check(actual == expected, f"Checksum is stale: {name}")

    timelines = read_jsonl(DATA / "timelines.jsonl")
    cases = read_jsonl(DATA / "benchmark_cases.jsonl")
    events = read_jsonl(DATA / "source_events.jsonl")
    catalog = json.loads((DATA / "evidence_catalog.json").read_text(encoding="utf-8"))
    groups = {group["group_id"]: group for group in catalog["groups"]}
    check(len(groups) == len(catalog["groups"]), "Duplicate evidence group IDs")
    profiles = {row["user_id"]: row for row in timelines}
    check(len(profiles) == len(timelines), "Duplicate profile IDs")
    check(set(profiles) == {f"VL500_U{n:04}" for n in range(26, 126)}, "Preview must contain profiles 26–125")
    turns = {}
    sessions = {}
    seen_text = {"user": {}, "assistant": {}}
    session_count = 0
    for row in timelines:
        check(row["total_sessions"] == len(row["sessions"]), f"Session count: {row['user_id']}")
        check(row["total_turns"] == sum(len(s["turns"]) for s in row["sessions"]), f"Turn count: {row['user_id']}")
        numbers = [s["session_number"] for s in row["sessions"]]
        # Retain gaps left by removed historical sessions; evidence IDs stay stable.
        check(numbers == sorted(set(numbers)), f"Session number order: {row['user_id']}")
        check(numbers[:3] == [1, 2, 3], f"Missing displayed session: {row['user_id']}")
        for session in row["sessions"]:
            sid = session["session_id"]
            check(sid not in sessions, f"Duplicate session ID: {sid}")
            sessions[sid] = session
            session_count += 1
            if session["session_number"] == 1:
                check(len(session["turns"]) == 4, f"Session 1 must contain two complete pairs: {sid}")
            if session["session_number"] <= 3:
                check(len(session["turns"]) >= 4, f"Displayed session needs at least two complete pairs: {sid}")
            check(sid == f"{row['user_id']}_S{session['session_number']:02}", f"Session ID does not match profile or number: {sid}")
            check(len(session["turns"]) % 2 == 0, f"Incomplete pair: {sid}")
            previous = datetime.fromisoformat(session["session_timestamp"])
            previous_number = 0
            for index, turn in enumerate(session["turns"]):
                tid = turn["turn_id"]
                check(tid not in turns, f"Duplicate turn ID: {tid}")
                # Existing IDs stay stable when an earlier pair is removed.
                suffix = tid.removeprefix(sid + "_T")
                number = int(suffix) if suffix.isdigit() else 0
                check(tid.startswith(sid + "_T") and number > previous_number, f"Turn ID order or session prefix: {tid}")
                check(number % 2 == (1 if index % 2 == 0 else 0), f"Turn pair ID: {tid}")
                if index % 2:
                    check(number == previous_number + 1, f"Reply is not paired with the previous question: {tid}")
                previous_number = number
                check(turn["speaker"] == ("user" if index % 2 == 0 else "assistant"), f"Speaker order: {tid}")
                check(bool(turn["text"].strip()), f"Empty message: {tid}")
                check(turn["text"] == turn["text"].strip(), f"Whitespace around message: {tid}")
                check(not turn["text"] or not turn["text"][0].islower(), f"Lowercase start of message: {tid}")
                if turn["speaker"] in seen_text:
                    previous_id = seen_text[turn["speaker"]].get(turn["text"])
                    check(previous_id is None, f"Duplicate message: {tid} and {previous_id}")
                    seen_text[turn["speaker"]][turn["text"]] = tid
                current = datetime.fromisoformat(turn["turn_timestamp"])
                check(current >= previous, f"Turn time moved backwards: {tid}")
                previous = current
                turns[tid] = turn

    event_lookup = {event["event_id"]: event for event in events}
    check(len(event_lookup) == len(events), "Duplicate event IDs")
    for event in events:
        eid = event["event_id"]
        check(event["user_id"] in profiles, f"Unknown event profile: {eid}")
        check(event["session_id"] in sessions, f"Unknown event session: {eid}")
        check(event["turn_id"] in turns, f"Unknown event turn: {eid}")
        check(event["session_id"].startswith(event["user_id"] + "_"), f"Event session belongs to another profile: {eid}")
        check(event["turn_id"].startswith(event["session_id"] + "_"), f"Event turn belongs to another session: {eid}")
        for evidence in event.get("evidence", []):
            source = turns.get(evidence["turn_id"])
            check(evidence["turn_id"].startswith(event["user_id"] + "_"), f"Evidence belongs to another profile: {eid}")
            check(source is not None, f"Missing evidence turn: {eid}")
            if source is None:
                continue
            start, end = evidence["start_offset"], evidence["end_offset"]
            span = evidence["supporting_span"]
            check(source["speaker"] == evidence["role"], f"Evidence role: {eid}")
            check(0 <= start <= end <= len(source["text"]), f"Evidence bounds: {eid}")
            check(source["text"][start:end] == span, f"Evidence quote or offsets do not match dialogue: {eid}")

    case_ids = set()
    per_profile = Counter()
    for case in cases:
        cid, uid = case["case_id"], case["user_id"]
        check(cid not in case_ids, f"Duplicate case ID: {cid}")
        case_ids.add(cid)
        check(uid in profiles, f"Unknown case profile: {cid}")
        per_profile[uid] += 1
        history = case["visible_history"]
        check(history["timeline_id"] == uid, f"History profile: {cid}")
        sid = history["up_to_session"]
        sid = sid if sid.startswith(uid + "_") else uid + "_" + sid
        tid = history["up_to_turn"]
        tid = tid if tid.startswith(uid + "_") else uid + "_" + tid
        check(sid in sessions, f"Missing history session: {cid}")
        check(tid in turns and tid.startswith(sid + "_"), f"Missing history endpoint: {cid}")
        if tid in turns:
            check(datetime.fromisoformat(case["query_time"]) >= datetime.fromisoformat(turns[tid]["turn_timestamp"]), f"Query precedes history: {cid}")
        targets = case["targets"]
        for kind, event_ids in targets["memory_events"].items():
            for eid in event_ids:
                check(eid in event_lookup, f"Missing memory event: {cid}/{eid}")
                if eid in event_lookup:
                    check(event_lookup[eid]["user_id"] == uid, f"Memory event belongs to another profile: {cid}/{eid}")
                    source = turns.get(event_lookup[eid]["turn_id"])
                    if kind != "forbidden_event_ids" and source and tid in turns:
                        check(datetime.fromisoformat(source["turn_timestamp"]) <= datetime.fromisoformat(turns[tid]["turn_timestamp"]), f"Memory event is beyond the visible history: {cid}/{eid}")
        for route_name in ("evidence_pass1", "evidence_pass2"):
            route = targets[route_name]
            check(set(route["target_groups"]) <= groups.keys(), f"Unknown evidence group: {cid}/{route_name}")
            chunks = {chunk for gid in route["target_groups"] if gid in groups for chunk in groups[gid]["acceptable_chunk_ids"]}
            check(set(route["acceptable_chunks"]) <= chunks, f"Evidence chunks are outside the target groups: {cid}/{route_name}")
        for snapshot in targets["state_snapshots"]:
            for binding in snapshot.get("source_bindings", []):
                event = event_lookup.get(binding["event_id"])
                check(event is not None and event["turn_id"] == binding["turn_id"], f"Source binding mismatch: {cid}")

    statistics = metadata["statistics"]
    expected = {
        "total_patients": len(profiles),
        "total_benchmark_cases": len(cases),
        "total_source_events": len(events),
        "total_sessions": session_count,
        "total_history_turns": len(turns),
        "personalization_needed_cases": sum(bool(case["personalization_needed"]) for case in cases),
        "negative_control_cases": sum(not case["personalization_needed"] for case in cases),
    }
    for name, actual in expected.items():
        check(statistics[name] == actual, f"Metadata count is stale: {name}={statistics[name]}, actual={actual}")
    for uid in profiles:
        check(per_profile[uid] == statistics["cases_per_patient"], f"Cases per profile: {uid}")
        selected = [case for case in cases if case["user_id"] == uid]
        check(len(selected) == 3 and sum(bool(case["personalization_needed"]) for case in selected) == 2, f"Expected one control and two personalized cases: {uid}")
    families = Counter(case["category"]["primary_family"] for case in cases)
    check(dict(families) == statistics["primary_question_families"], "Question family counts are stale")

    if errors:
        for error in errors:
            print("ERROR:", error)
        raise SystemExit(f"Failed: {len(errors)} data integrity checks.")
    print(f"Valid: {len(profiles)} profiles, {len(cases)} cases, {session_count} sessions, {len(turns)} turns, {len(events)} source events; mirrors, evidence spans and checksums match.")


if __name__ == "__main__":
    validate()
