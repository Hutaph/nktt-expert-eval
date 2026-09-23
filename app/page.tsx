"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import styles from "./LabelData.module.css";
import ClinicalLikertEvalView from "./components/ClinicalLikertEvalView";

interface AutoExpandingTextareaProps {
  value: string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  readOnly?: boolean;
  className?: string;
}

function AutoExpandingTextarea({
  value,
  onChange,
  placeholder,
  readOnly,
  className,
}: AutoExpandingTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, 28)}px`;
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  useEffect(() => {
    adjustHeight();
    const handleResize = () => adjustHeight();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [adjustHeight]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => {
        if (onChange) onChange(e);
        adjustHeight();
      }}
      placeholder={placeholder}
      readOnly={readOnly}
      rows={1}
      className={className}
    />
  );
}

interface TurnRecord {
  turn_id: string;
  speaker: string;
  text: string;
  turn_timestamp?: string;
}

interface SessionRecord {
  session_id: string;
  session_number: number;
  session_timestamp?: string;
  turns: TurnRecord[];
}

interface TimelineRecord {
  user_id: string;
  total_sessions: number;
  total_turns: number;
  sessions: SessionRecord[];
}

interface SourceEventRecord {
  event_id: string;
  user_id: string;
  session_id: string;
  turn_id: string;
  proposition: string;
  attribute_candidate?: string;
  assertion_status?: string;
  lifecycle?: string;
}

interface FactorRecord {
  factor_id: string;
  description: string;
  expected_status: string;
  expected_value: string;
  materiality_rationale?: string;
}

interface CaseDetail {
  case_id: string;
  user_id: string;
  query_time: string;
  visible_history: {
    timeline_id: string;
    up_to_session: string;
    up_to_turn: string;
  };
  current_query: string;
  personalization_needed: boolean;
  category: {
    primary_family: string;
    secondary_tags: string[];
    counterfactual_pair_id?: string;
  };
  targets: {
    factors: FactorRecord[];
    memory_events: {
      relevant_event_ids: string[];
      stale_event_ids: string[];
      forbidden_event_ids: string[];
    };
    state_snapshots: Array<{
      factor_id: string;
      status: string;
      value: string;
      supporting_event_ids: string[];
    }>;
    evidence_pass1?: {
      target_groups: string[];
      acceptable_chunks: string[];
    };
  };
  metadata: {
    language: string;
    checkpoint: string;
    history_bucket: string;
  };
}

interface ExpertAnnotationRecord {
  case_id: string;
  user_id: string;
  verdict: "APPROVED";
  clinical_notes: string;
  edited_query?: string;
  edited_turns?: TurnRecord[];
  factors?: FactorRecord[];
  memory_events?: {
    relevant_event_ids: string[];
    stale_event_ids: string[];
    forbidden_event_ids: string[];
  };
  annotator: string;
  updated_at: string;
}

const STORAGE_KEY = "nktt_expert_annotations_v1";

function getAssetBase(): string {
  if (typeof window === "undefined") return "";
  if (window.location.pathname.startsWith("/nktt-expert-eval")) {
    return "/nktt-expert-eval";
  }
  return "";
}

function getStoredAnnotations(): Record<string, ExpertAnnotationRecord> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveStoredAnnotation(record: ExpertAnnotationRecord): void {
  if (typeof window === "undefined") return;
  try {
    const existing = getStoredAnnotations();
    existing[record.case_id] = record;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  } catch (err) {
    console.error("Lỗi khi lưu vào bộ nhớ trình duyệt:", err);
  }
}

const FAMILY_FRIENDLY_NAMES: Record<string, { label: string; desc: string }> = {
  NO_PERSONALIZATION_NEEDED: {
    label: "Kiến thức nha khoa chung",
    desc: "Câu hỏi thông thường, không cần nhớ tiền sử của bệnh nhân",
  },
  UPDATE_SUPERSESSION: {
    label: "Thông tin đã thay đổi theo thời gian",
    desc: "Bệnh nhân có thông tin mới (ví dụ đã đổi loại hàm, đã tháo niềng), cần dùng thông tin mới nhất",
  },
  EXPLICIT_STABLE_PERSONALIZATION: {
    label: "Tiền sử cố định",
    desc: "Thông tin cố định lâu dài như cơ địa, tiền sử dị ứng, răng đã nhổ",
  },
  LATENT_EVIDENCE_CONDITIONED_FACTOR: {
    label: "Cần suy luận từ lời kể",
    desc: "Thông tin ẩn trong các đợt khám trước, cần liên kết lại",
  },
  MISSING_FACTOR_UNKNOWN: {
    label: "Chưa có thông tin (Cần hỏi thêm)",
    desc: "Hồ sơ chưa có, bác sĩ phải hỏi lại bệnh nhân trước khi tư vấn",
  },
  MULTI_FACTOR_CROSS_SESSION: {
    label: "Gộp thông tin từ nhiều lần khám",
    desc: "Cần xâu chuỗi thông tin từ nhiều buổi hẹn trước",
  },
  CONFLICT_UNCERTAINTY: {
    label: "Thông tin chưa rõ ràng",
    desc: "Có sự mâu thuẫn giữa các lần khám, cần làm rõ lại",
  },
  PROVENANCE_BOUNDARY: {
    label: "Phân biệt nguồn thông tin",
    desc: "Phân định rõ lời bệnh nhân kể và kết quả do bác sĩ khám",
  },
};

let cachedAllCases: CaseDetail[] | null = null;
let cachedTimelinesMap: Map<string, TimelineRecord> | null = null;
let cachedEventsMap: Map<string, SourceEventRecord[]> | null = null;

export default function LabelDataPage() {
  const [activeTab, setActiveTab] = useState<"clinical-likert" | "label-data">("clinical-likert");
  const [allCases, setAllCases] = useState<CaseDetail[]>([]);
  const [families, setFamilies] = useState<string[]>([]);
  const [selectedFamily, setSelectedFamily] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [loadingList, setLoadingList] = useState<boolean>(true);

  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [activeCase, setActiveCase] = useState<CaseDetail | null>(null);
  const [timeline, setTimeline] = useState<TimelineRecord | null>(null);
  const [events, setEvents] = useState<SourceEventRecord[]>([]);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);

  const [editedQuery, setEditedQuery] = useState<string>("");
  const [activeSessionIndex, setActiveSessionIndex] = useState<number>(0);
  const [editedTurns, setEditedTurns] = useState<Record<string, string>>({});

  const [editedFactors, setEditedFactors] = useState<FactorRecord[]>([]);
  const [editedRelevantEvents, setEditedRelevantEvents] = useState<string>("");
  const [editedStaleEvents, setEditedStaleEvents] = useState<string>("");
  const [editedForbiddenEvents, setEditedForbiddenEvents] = useState<string>("");
  const [annotator, setAnnotator] = useState<string>("Hội đồng Chuyên gia Nha khoa");

  const [clinicalNotes, setClinicalNotes] = useState<string>("");
  const [saving, setSaving] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [annotationsMap, setAnnotationsMap] = useState<Record<string, ExpertAnnotationRecord>>({});

  const [showGuide, setShowGuide] = useState<boolean>(false);

  // Load stored annotations on mount, merge with default 500 entries
  useEffect(() => {
    let isMounted = true;
    async function initAnnotations() {
      const stored = getStoredAnnotations();
      try {
        const assetBase = getAssetBase();
        const res = await fetch(`${assetBase}/dataset/default_expert_annotations_500.json`);
        if (res.ok) {
          const defaultData = await res.json();
          // Merge: default as base, stored annotations take priority (preserves user edits)
          const merged = { ...defaultData, ...stored };
          if (isMounted) {
            setAnnotationsMap(merged);
            if (typeof window !== "undefined" && Object.keys(merged).length > Object.keys(stored).length) {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
            }
          }
        } else if (Object.keys(stored).length > 0) {
          if (isMounted) setAnnotationsMap(stored);
        }
      } catch (err) {
        console.error("Lỗi khi nạp dữ liệu thẩm định mặc định:", err);
        if (Object.keys(stored).length > 0 && isMounted) {
          setAnnotationsMap(stored);
        }
      }
    }
    initAnnotations();
    return () => {
      isMounted = false;
    };
  }, []);

  // Load all 500 cases from public/dataset
  useEffect(() => {
    let isMounted = true;
    async function fetchCases() {
      setLoadingList(true);
      try {
        const assetBase = getAssetBase();
        if (!cachedAllCases) {
          const res = await fetch(`${assetBase}/dataset/vident_longmem_500/benchmark_cases.jsonl`);
          const text = await res.text();
          const list: CaseDetail[] = [];
          const famSet = new Set<string>();
          for (const line of text.split("\n")) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const parsed = JSON.parse(trimmed) as CaseDetail;
              list.push(parsed);
              if (parsed.category?.primary_family) {
                famSet.add(parsed.category.primary_family);
              }
            } catch { }
          }
          cachedAllCases = list;
          if (isMounted) {
            setAllCases(list);
            setFamilies(Array.from(famSet).sort());
            if (list.length > 0 && !selectedCaseId) {
              setSelectedCaseId(list[0].case_id);
            }
          }
        } else {
          setAllCases(cachedAllCases);
          const famSet = new Set(cachedAllCases.map((c) => c.category?.primary_family).filter(Boolean) as string[]);
          setFamilies(Array.from(famSet).sort());
          if (cachedAllCases.length > 0 && !selectedCaseId) {
            setSelectedCaseId(cachedAllCases[0].case_id);
          }
        }
      } catch (err) {
        console.error("Lỗi khi tải danh sách ca bệnh:", err);
      } finally {
        if (isMounted) setLoadingList(false);
      }
    }

    fetchCases();
    return () => {
      isMounted = false;
    };
  }, [selectedCaseId]);

  // Load timeline and events for selected case
  useEffect(() => {
    if (!selectedCaseId || allCases.length === 0) return;

    const matchedCase = allCases.find((c) => c.case_id === selectedCaseId);
    if (!matchedCase) return;

    let isMounted = true;
    setLoadingDetail(true);
    setSaveMessage(null);

    async function loadCaseData() {
      try {
        const assetBase = getAssetBase();

        // 1. Load timelines map if not cached
        if (!cachedTimelinesMap) {
          const res = await fetch(`${assetBase}/dataset/vident_longmem_500/timelines.jsonl`);
          const text = await res.text();
          const map = new Map<string, TimelineRecord>();
          for (const line of text.split("\n")) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const rec = JSON.parse(trimmed) as TimelineRecord;
              if (rec.user_id) map.set(rec.user_id, rec);
            } catch { }
          }
          cachedTimelinesMap = map;
        }

        // 2. Load events map if not cached
        if (!cachedEventsMap) {
          const res = await fetch(`${assetBase}/dataset/vident_longmem_500/source_events.jsonl`);
          const text = await res.text();
          const map = new Map<string, SourceEventRecord[]>();
          for (const line of text.split("\n")) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const rec = JSON.parse(trimmed) as SourceEventRecord;
              if (rec.user_id) {
                if (!map.has(rec.user_id)) map.set(rec.user_id, []);
                map.get(rec.user_id)!.push(rec);
              }
            } catch { }
          }
          cachedEventsMap = map;
        }

        if (!isMounted || !matchedCase) return;

        const userTimeline = cachedTimelinesMap?.get(matchedCase.user_id) || null;
        const userEvents = cachedEventsMap?.get(matchedCase.user_id) || [];

        setActiveCase(matchedCase);
        setTimeline(userTimeline);
        setEvents(userEvents);

        if (userTimeline && userTimeline.sessions && userTimeline.sessions.length > 0) {
          const cutoffSession = matchedCase.visible_history?.up_to_session;
          const foundIdx = userTimeline.sessions.findIndex((s: SessionRecord) =>
            cutoffSession ? (s.session_id.endsWith(cutoffSession) || s.session_id === cutoffSession) : false
          );
          setActiveSessionIndex(foundIdx >= 0 ? foundIdx : userTimeline.sessions.length - 1);
        }

        // Check stored annotation
        const saved = annotationsMap[matchedCase.case_id] || getStoredAnnotations()[matchedCase.case_id];
        if (saved) {
          setClinicalNotes(saved.clinical_notes || "");
          setAnnotator(saved.annotator || "Bác sĩ nha khoa");
          setEditedQuery(saved.edited_query || matchedCase.current_query || "");
          if (saved.edited_turns) {
            const turnMap: Record<string, string> = {};
            saved.edited_turns.forEach((t) => {
              turnMap[t.turn_id] = t.text;
            });
            setEditedTurns(turnMap);
          } else {
            setEditedTurns({});
          }
          if (saved.factors && saved.factors.length > 0) {
            setEditedFactors(saved.factors);
          } else if (matchedCase.targets?.factors) {
            setEditedFactors(JSON.parse(JSON.stringify(matchedCase.targets.factors)));
          } else {
            setEditedFactors([]);
          }
          if (saved.memory_events) {
            setEditedRelevantEvents((saved.memory_events.relevant_event_ids || []).join(", "));
            setEditedStaleEvents((saved.memory_events.stale_event_ids || []).join(", "));
            setEditedForbiddenEvents((saved.memory_events.forbidden_event_ids || []).join(", "));
          } else if (matchedCase.targets?.memory_events) {
            setEditedRelevantEvents((matchedCase.targets.memory_events.relevant_event_ids || []).join(", "));
            setEditedStaleEvents((matchedCase.targets.memory_events.stale_event_ids || []).join(", "));
            setEditedForbiddenEvents((matchedCase.targets.memory_events.forbidden_event_ids || []).join(", "));
          } else {
            setEditedRelevantEvents("");
            setEditedStaleEvents("");
            setEditedForbiddenEvents("");
          }
        } else {
          setEditedQuery(matchedCase.current_query || "");
          setClinicalNotes("");
          setEditedTurns({});
          if (matchedCase.targets?.factors) {
            setEditedFactors(JSON.parse(JSON.stringify(matchedCase.targets.factors)));
          } else {
            setEditedFactors([]);
          }
          if (matchedCase.targets?.memory_events) {
            setEditedRelevantEvents((matchedCase.targets.memory_events.relevant_event_ids || []).join(", "));
            setEditedStaleEvents((matchedCase.targets.memory_events.stale_event_ids || []).join(", "));
            setEditedForbiddenEvents((matchedCase.targets.memory_events.forbidden_event_ids || []).join(", "));
          } else {
            setEditedRelevantEvents("");
            setEditedStaleEvents("");
            setEditedForbiddenEvents("");
          }
        }
      } catch (err) {
        console.error("Lỗi nạp ca bệnh:", err);
      } finally {
        if (isMounted) setLoadingDetail(false);
      }
    }

    loadCaseData();

    return () => {
      isMounted = false;
    };
  }, [selectedCaseId, allCases, annotationsMap]);

  // Filtered cases (from 1 to 500)
  const filteredCases = useMemo(() => {
    let list = allCases;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((c) =>
        c.case_id.toLowerCase().includes(q) ||
        c.user_id.toLowerCase().includes(q) ||
        c.current_query.toLowerCase().includes(q)
      );
    }
    return list;
  }, [allCases, searchQuery]);

  const handleExportAnnotations = () => {
    const stored = getStoredAnnotations();
    const values = Object.values(stored);
    if (values.length === 0) {
      alert("Chưa có ca bệnh nào được lưu xác nhận để tải về.");
      return;
    }
    const lines = values.map((v) => JSON.stringify(v)).join("\n") + "\n";
    const blob = new Blob([lines], { type: "application/x-ndjson;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "expert_annotations.jsonl";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleTurnChange = (turnId: string, text: string) => {
    setEditedTurns((prev) => ({
      ...prev,
      [turnId]: text,
    }));
  };

  const handleFactorChange = (index: number, field: keyof FactorRecord, val: string) => {
    setEditedFactors((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        [field]: val,
      };
      return next;
    });
  };

  const handleSaveAnnotation = () => {
    if (!activeCase) return;

    setSaving(true);
    setSaveMessage(null);

    const updatedTurnList: TurnRecord[] = [];
    if (timeline && timeline.sessions) {
      timeline.sessions.forEach((s) => {
        s.turns.forEach((t) => {
          if (editedTurns[t.turn_id] !== undefined) {
            updatedTurnList.push({
              turn_id: t.turn_id,
              speaker: t.speaker,
              text: editedTurns[t.turn_id],
              turn_timestamp: t.turn_timestamp,
            });
          }
        });
      });
    }

    const parsedMemoryEvents = {
      relevant_event_ids: editedRelevantEvents.split(",").map((s) => s.trim()).filter(Boolean),
      stale_event_ids: editedStaleEvents.split(",").map((s) => s.trim()).filter(Boolean),
      forbidden_event_ids: editedForbiddenEvents.split(",").map((s) => s.trim()).filter(Boolean),
    };

    const record: ExpertAnnotationRecord = {
      case_id: activeCase.case_id,
      user_id: activeCase.user_id,
      verdict: "APPROVED",
      clinical_notes: clinicalNotes,
      edited_query: editedQuery !== activeCase.current_query ? editedQuery : undefined,
      edited_turns: updatedTurnList.length > 0 ? updatedTurnList : undefined,
      factors: editedFactors,
      memory_events: parsedMemoryEvents,
      annotator: annotator.trim() || "Bác sĩ nha khoa",
      updated_at: new Date().toISOString(),
    };

    saveStoredAnnotation(record);
    setAnnotationsMap((prev) => ({
      ...prev,
      [record.case_id]: record,
    }));

    setSaveMessage({ text: "Đã lưu xác nhận ca này thành công!", isError: false });
    setSaving(false);
  };

  const currentSession =
    timeline && timeline.sessions && timeline.sessions[activeSessionIndex]
      ? timeline.sessions[activeSessionIndex]
      : null;

  const allEvidenceSessionNumbers = useMemo(() => {
    const nums = new Set<number>();
    if (!activeCase) return nums;

    const allEventIds = [
      ...(activeCase.targets?.memory_events?.relevant_event_ids || []),
      ...(activeCase.targets?.state_snapshots?.flatMap((s) => s.supporting_event_ids || []) || []),
    ];

    allEventIds.forEach((eventId) => {
      const matchedEv = events.find((e) => e.event_id === eventId);
      if (matchedEv) {
        const sMatch = matchedEv.session_id.match(/S(\d+)/i);
        if (sMatch) nums.add(parseInt(sMatch[1], 10));
      } else {
        const sMatch = eventId.match(/_S(\d+)/i);
        if (sMatch) nums.add(parseInt(sMatch[1], 10));
      }
    });

    return nums;
  }, [activeCase, events]);

  const allEvidenceTurnIds = useMemo(() => {
    const ids = new Set<string>();
    if (!activeCase) return ids;

    const allEventIds = [
      ...(activeCase.targets?.memory_events?.relevant_event_ids || []),
      ...(activeCase.targets?.state_snapshots?.flatMap((s) => s.supporting_event_ids || []) || []),
    ];

    allEventIds.forEach((eventId) => {
      const matchedEv = events.find((e) => e.event_id === eventId);
      if (matchedEv && matchedEv.turn_id) {
        ids.add(matchedEv.turn_id);
      } else {
        const sMatch = eventId.match(/_S(\d+)/i);
        const tMatch = eventId.match(/_T(\d+)/i);
        if (sMatch && tMatch) {
          ids.add(`${activeCase.user_id}_S${sMatch[1]}_T${tMatch[1]}`);
        }
      }
    });

    return ids;
  }, [activeCase, events]);

  const getFactorEvidenceMap = (factorId: string) => {
    if (!activeCase || !timeline || !timeline.sessions) return [];

    const snapshot = activeCase.targets?.state_snapshots?.find(
      (s) => s.factor_id === factorId
    );
    let eventIds = snapshot?.supporting_event_ids || [];
    if (eventIds.length === 0 && activeCase.targets?.memory_events?.relevant_event_ids) {
      eventIds = activeCase.targets.memory_events.relevant_event_ids;
    }

    const sessionMap = new Map<number, { sessionIndex: number; turnIds: Set<string> }>();

    eventIds.forEach((eventId) => {
      let sNum: number | null = null;
      let tId: string | null = null;

      const matchedEv = events.find((e) => e.event_id === eventId);
      if (matchedEv) {
        tId = matchedEv.turn_id;
        const sMatch = matchedEv.session_id.match(/S(\d+)/i);
        if (sMatch) sNum = parseInt(sMatch[1], 10);
      } else {
        const sMatch = eventId.match(/_S(\d+)/i);
        const tMatch = eventId.match(/_T(\d+)/i);
        if (sMatch) sNum = parseInt(sMatch[1], 10);
        if (tMatch) {
          tId = `${activeCase.user_id}_S${sMatch ? sMatch[1] : ""}_T${tMatch[1]}`;
        }
      }

      if (sNum !== null) {
        const sIdx = timeline.sessions.findIndex((s) => s.session_number === sNum);
        if (sIdx >= 0) {
          if (!sessionMap.has(sNum)) {
            sessionMap.set(sNum, { sessionIndex: sIdx, turnIds: new Set() });
          }
          if (tId) {
            sessionMap.get(sNum)!.turnIds.add(tId);
          }
        }
      }
    });

    const result: Array<{ sessionNumber: number; sessionIndex: number; turnIds: string[] }> = [];
    sessionMap.forEach((val, sNum) => {
      result.push({
        sessionNumber: sNum,
        sessionIndex: val.sessionIndex,
        turnIds: Array.from(val.turnIds),
      });
    });
    return result.sort((a, b) => a.sessionNumber - b.sessionNumber);
  };

  const totalAnnotatedCount = Object.keys(annotationsMap).length;

  return (
    <div className={styles.container}>
      {/* Global Navigation Tabs */}
      <nav className={styles.globalNav}>
        <button
          type="button"
          className={[
            styles.globalNavTab,
            activeTab === "clinical-likert" ? styles.globalNavTabActive : "",
          ].join(" ")}
          onClick={() => setActiveTab("clinical-likert")}
        >
          Chấm điểm Lâm sàng Likert 5 mức (200 ca)
        </button>
        <button
          type="button"
          className={[
            styles.globalNavTab,
            activeTab === "label-data" ? styles.globalNavTabActive : "",
          ].join(" ")}
          onClick={() => setActiveTab("label-data")}
        >
          Thẩm định & Gán nhãn Dữ liệu (500 ca ViDent-LongMem)
        </button>
      </nav>

      {activeTab === "clinical-likert" ? (
        <ClinicalLikertEvalView />
      ) : (
        <>
          {/* Top Header */}
          <header className={styles.topBar}>
        <div className={styles.titleArea}>
          <h1 className={styles.titleMain}>Kiểm tra & Gán nhãn Dữ liệu Nha khoa</h1>
          <p className={styles.titleSub}>
            Đọc câu hỏi, xem lại lịch sử các lần khám và chỉnh sửa câu chữ cho tự nhiên, đúng thực tế
          </p>
        </div>
        <div className={styles.topActions}>
          <span className={styles.statsBadge}>
            Đã thẩm định: {totalAnnotatedCount}/{allCases.length || 500} ca
          </span>
          <button
            type="button"
            className={styles.guideBtn}
            onClick={() => setShowGuide(true)}
            title="Xem hướng dẫn cách làm"
          >
            Xem hướng dẫn
          </button>
          <button type="button" className={styles.exportBtn} onClick={handleExportAnnotations}>
            Tải file kết quả (JSONL)
          </button>
          <div className={styles.annotatorBadge}>
            <label className={styles.annotatorLabel}>Người thẩm định:</label>
            <input
              type="text"
              value={annotator}
              onChange={(e) => setAnnotator(e.target.value)}
              className={styles.annotatorInput}
              placeholder="Họ tên của bạn..."
            />
          </div>
        </div>
      </header>

      {/* Main Workspace: 3 Columns */}
      <div className={styles.workspace}>
        {/* Left Column: Filter and Cases list */}
        <section className={styles.sidebar} aria-label="Danh sách ca bệnh">
          <div className={styles.filterSection}>
            <input
              type="text"
              placeholder="Tìm theo mã ca, câu hỏi, từ khóa..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          <div className={styles.caseList}>
            {loadingList ? (
              <p className={styles.emptyPlaceholder}>Đang tải danh sách ca bệnh...</p>
            ) : filteredCases.length === 0 ? (
              <p className={styles.emptyPlaceholder}>Không tìm thấy ca nào phù hợp</p>
            ) : (
              filteredCases.map((c) => {
                const globalIndex = allCases.findIndex((item) => item.case_id === c.case_id) + 1;
                const isActive = c.case_id === selectedCaseId;
                const friendlyFamily = FAMILY_FRIENDLY_NAMES[c.category?.primary_family]?.label || c.category?.primary_family;
                const isAnnotated = Boolean(annotationsMap[c.case_id]);
                return (
                  <button
                    key={c.case_id}
                    type="button"
                    className={[styles.caseCard, isActive ? styles.caseCardActive : ""].filter(Boolean).join(" ")}
                    onClick={() => setSelectedCaseId(c.case_id)}
                  >
                    <div className={styles.caseCardHeader}>
                      <span className={styles.caseId}>Ca {globalIndex}: {c.case_id}</span>
                      <span className={styles.caseCheckpoint}>Ca {globalIndex}/500</span>
                    </div>
                    <div className={styles.caseQueryPreview}>{c.current_query}</div>
                    <div className={styles.caseCardFooter}>
                      <span className={styles.familyTag} title={c.category?.primary_family}>
                        {friendlyFamily}
                      </span>
                      {isAnnotated && (
                        <span className={[styles.verdictBadge, styles.verdictApproved].join(" ")}>
                          Đã thẩm định
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className={styles.pagination}>
            <span>
              Tổng cộng: {allCases.length} ca bệnh (từ Ca 1 đến Ca 500)
              {filteredCases.length < allCases.length ? ` - Đang tìm thấy ${filteredCases.length} ca` : ""}
            </span>
          </div>
        </section>

        {/* Center Column: Query Editor & Dialogue Timeline */}
        <section className={styles.mainContent} aria-label="Nội dung hội thoại">
          {loadingDetail ? (
            <div className={styles.emptyPlaceholder}>Đang mở ca này...</div>
          ) : !activeCase ? (
            <div className={styles.emptyPlaceholder}>Bấm chọn một ca ở cột bên trái để bắt đầu xem</div>
          ) : (
            <>
              {/* Question Editor */}
              <div className={styles.queryCard}>
                <div className={styles.queryCardHeader}>
                  <h2 className={styles.sectionTitle}>
                    Ca {allCases.findIndex((c) => c.case_id === activeCase.case_id) + 1} / 500: Câu hỏi của bệnh nhân (Bấm vào để sửa)
                  </h2>
                  <p className={styles.sectionSubtitle}>
                    Nếu thấy câu hỏi chưa tự nhiên hoặc lủng củng, bạn bấm thẳng vào ô dưới để sửa lại.
                  </p>
                  <div className={styles.metaRow}>
                    <span className={styles.metaItem}>
                      Mã bệnh nhân: <strong>{activeCase.user_id}</strong>
                    </span>
                    <span className={styles.metaItem}>
                      Ngày hỏi: <strong>{new Date(activeCase.query_time).toLocaleDateString("vi-VN")}</strong>
                    </span>
                    <span className={styles.metaItem}>
                      Dạng câu hỏi: <strong>{FAMILY_FRIENDLY_NAMES[activeCase.category.primary_family]?.label || activeCase.category.primary_family}</strong>
                    </span>
                  </div>
                </div>
                <AutoExpandingTextarea
                  value={editedQuery}
                  onChange={(e) => setEditedQuery(e.target.value)}
                  placeholder="Nội dung câu hỏi của bệnh nhân..."
                  className={styles.queryTextarea}
                />
              </div>

              {/* Timeline Tabs */}
              {timeline && timeline.sessions && timeline.sessions.length > 0 && (() => {
                const cutoffSessionStr = activeCase.visible_history?.up_to_session || "";
                const cutoffMatch = cutoffSessionStr.match(/S(\d+)/i);
                const cutoffSessionNum = cutoffMatch ? parseInt(cutoffMatch[1], 10) : -1;
                const isCurrentSessionFuture = currentSession && cutoffSessionNum > 0 && currentSession.session_number > cutoffSessionNum;

                return (
                  <>
                    <div className={styles.sessionTabs}>
                      {timeline.sessions.map((s, idx) => {
                        const isCutoff = s.session_number === cutoffSessionNum;
                        const isFuture = cutoffSessionNum > 0 && s.session_number > cutoffSessionNum;
                        const isActive = idx === activeSessionIndex;
                        const hasEvidence = allEvidenceSessionNumbers.has(s.session_number);
                        return (
                          <button
                            key={s.session_id}
                            type="button"
                            className={[
                              styles.sessionTab,
                              isActive ? styles.sessionTabActive : "",
                              isCutoff ? styles.sessionTabCurrentCutoff : "",
                              isFuture ? styles.sessionTabFuture : "",
                              hasEvidence ? styles.sessionTabWithEvidence : "",
                            ].filter(Boolean).join(" ")}
                            onClick={() => setActiveSessionIndex(idx)}
                            title={
                              isFuture
                                ? "Lần khám diễn ra sau thời điểm hỏi"
                                : hasEvidence
                                  ? "Lần khám này có thông tin quan trọng"
                                  : `Xem trao đổi lần khám ${s.session_number}`
                            }
                          >
                            Lần khám {s.session_number}
                            {hasEvidence ? " •" : ""}
                            {isCutoff ? " (Lần này)" : isFuture ? " (Lần sau)" : ""}
                          </button>
                        );
                      })}
                    </div>

                    {isCurrentSessionFuture && (
                      <div className={styles.futureSessionBanner}>
                        <strong>Lưu ý:</strong> Lần khám {currentSession.session_number} diễn ra SAU thời điểm bệnh nhân hỏi.
                      </div>
                    )}
                  </>
                );
              })()}

              {/* Dialogue History Scroll */}
              <div className={styles.dialogueScroll}>
                {!currentSession ? (
                  <p className={styles.emptyPlaceholder}>Không có tin nhắn nào trong lần khám này</p>
                ) : (
                  currentSession.turns.map((turn) => {
                    const isUser = turn.speaker === "user";
                    const currentText = editedTurns[turn.turn_id] ?? turn.text;
                    const isEvidenceTurn = allEvidenceTurnIds.has(turn.turn_id);
                    const turnShortId = turn.turn_id.replace(/.*_/, "");
                    return (
                      <div
                        key={turn.turn_id}
                        className={[
                          styles.turnCard,
                          isUser ? styles.turnCardUser : styles.turnCardAssistant,
                          isEvidenceTurn ? styles.turnCardEvidence : "",
                        ].join(" ")}
                      >
                        <div className={styles.turnHeader}>
                          <span
                            className={[
                              styles.turnSpeaker,
                              isUser ? styles.turnSpeakerUser : styles.turnSpeakerAssistant,
                            ].join(" ")}
                          >
                            {isUser ? "Bệnh nhân" : "Bác sĩ / Trợ lý"}
                            <span className={styles.turnBadgeSubtle}>#{turnShortId}</span>
                          </span>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            {isEvidenceTurn && (
                              <span className={styles.turnEvidenceBadge}>
                                Thông tin quan trọng
                              </span>
                            )}
                            {turn.turn_timestamp && (
                              <span className={styles.turnTime}>
                                {new Date(turn.turn_timestamp).toLocaleString("vi-VN")}
                              </span>
                            )}
                          </div>
                        </div>
                        <AutoExpandingTextarea
                          value={currentText}
                          onChange={(e) => handleTurnChange(turn.turn_id, e.target.value)}
                          placeholder="Bấm vào đây nếu muốn sửa câu này..."
                          className={styles.turnTextarea}
                        />
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </section>

        {/* Right Column: Clinical Factors & Save Form */}
        <section className={styles.reviewPanel} aria-label="Kiểm tra thông tin">
          {!activeCase ? (
            <div className={styles.emptyPlaceholder}>Chưa chọn ca nào</div>
          ) : (
            <>
              {/* Target Factors Section */}
              <div className={styles.reviewSection}>
                <div className={styles.reviewSectionHeader}>
                  <h2 className={styles.sectionTitle}>
                    2. Thông tin bệnh án quan trọng (Bấm vào để sửa)
                  </h2>
                  <p className={styles.sectionSubtitle}>
                    Thông tin trong tiền sử mà câu trả lời cần phải nhớ
                  </p>
                </div>

                {editedFactors.length === 0 ? (
                  <div className={styles.guideTipBox}>
                    <strong>Câu hỏi đại cương:</strong> Bệnh nhân hỏi kiến thức chung, không liên quan đến bệnh án riêng.
                  </div>
                ) : (
                  editedFactors.map((factor, idx) => {
                    const evidenceList = getFactorEvidenceMap(factor.factor_id);
                    return (
                      <div key={factor.factor_id || idx} className={styles.factorCard}>
                        <div className={styles.factorCardTop}>
                          <span className={styles.factorCardTitle}>
                            Thông tin #{idx + 1}
                          </span>
                          <div className={styles.factorStatusWrapper}>
                            <label className={styles.fieldLabelSmall}>Tình trạng:</label>
                            <select
                              value={factor.expected_status}
                              onChange={(e) => handleFactorChange(idx, "expected_status", e.target.value)}
                              className={styles.factorSelect}
                            >
                              <option value="KNOWN">Đã biết rõ</option>
                              <option value="UNKNOWN">Chưa rõ (Cần hỏi thêm)</option>
                              <option value="NOT_APPLICABLE">Không áp dụng</option>
                            </select>
                          </div>
                        </div>

                        <div className={styles.factorFieldGroup}>
                          <label className={styles.fieldLabel}>
                            Vấn đề nha khoa:
                          </label>
                          <span className={styles.fieldHint}>
                            (Ví dụ: Đang đeo loại hàm duy trì nào)
                          </span>
                          <AutoExpandingTextarea
                            value={factor.description}
                            onChange={(e) => handleFactorChange(idx, "description", e.target.value)}
                            placeholder="Mô tả vấn đề..."
                            className={styles.factorTextarea}
                          />
                        </div>

                        <div className={styles.factorFieldGroup}>
                          <label className={styles.fieldLabel}>
                            Chi tiết cụ thể:
                          </label>
                          <span className={styles.fieldHint}>
                            (Ví dụ: Hàm Hawley, chỉ đeo ban đêm)
                          </span>
                          <AutoExpandingTextarea
                            value={factor.expected_value}
                            onChange={(e) => handleFactorChange(idx, "expected_value", e.target.value)}
                            placeholder="Chi tiết cụ thể..."
                            className={styles.factorTextarea}
                          />
                        </div>

                        <div className={styles.factorFieldGroup}>
                          <label className={styles.fieldLabel}>
                            Tại sao thông tin này quan trọng:
                          </label>
                          <span className={styles.fieldHint}>
                            (Để dặn dò bệnh nhân đúng cách, không gây hại)
                          </span>
                          <AutoExpandingTextarea
                            value={factor.materiality_rationale || ""}
                            onChange={(e) => handleFactorChange(idx, "materiality_rationale", e.target.value)}
                            placeholder="Lý do quan trọng..."
                            className={styles.factorTextarea}
                          />
                        </div>

                        {evidenceList.length > 0 && (
                          <div className={styles.factorEvidenceBox}>
                            <span className={styles.factorEvidenceTitle}>
                              Xem lại tại:
                            </span>
                            <div className={styles.factorEvidenceList}>
                              {evidenceList.map((loc) => (
                                <button
                                  key={loc.sessionNumber}
                                  type="button"
                                  className={styles.evidenceSessionTag}
                                  onClick={() => setActiveSessionIndex(loc.sessionIndex)}
                                  title={`Xem lại Lần khám ${loc.sessionNumber}`}
                                >
                                  Lần khám {loc.sessionNumber} {loc.turnIds.length > 0 ? `(${loc.turnIds.map((t) => t.replace(/.*_/, "")).join(", ")})` : ""}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}

                {/* Collapsible Advanced Technical Section */}
                <details className={styles.techDetails}>
                  <summary className={styles.techSummary}>
                    Tùy chọn kỹ thuật (Dành cho Kỹ sư AI)
                  </summary>
                  <div className={styles.techContent}>
                    <p style={{ fontSize: "0.7rem", color: "var(--color-text-muted)", margin: 0 }}>
                      Phần này dành riêng cho kỹ sư AI. Bạn không cần bận tâm phần này.
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                      <label className={styles.fieldLabelSmall}>Mã sự kiện liên quan:</label>
                      <input
                        type="text"
                        value={editedRelevantEvents}
                        onChange={(e) => setEditedRelevantEvents(e.target.value)}
                        placeholder="Mã sự kiện..."
                        className={styles.memoryEventInput}
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                      <label className={styles.fieldLabelSmall}>Mã sự kiện hết hiệu lực:</label>
                      <input
                        type="text"
                        value={editedStaleEvents}
                        onChange={(e) => setEditedStaleEvents(e.target.value)}
                        placeholder="Mã sự kiện hết hạn..."
                        className={styles.memoryEventInput}
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                      <label className={styles.fieldLabelSmall}>Mã sự kiện cấm dùng:</label>
                      <input
                        type="text"
                        value={editedForbiddenEvents}
                        onChange={(e) => setEditedForbiddenEvents(e.target.value)}
                        placeholder="Mã cấm..."
                        className={styles.memoryEventInput}
                      />
                    </div>
                  </div>
                </details>
              </div>

              {/* Review Save Section */}
              <div className={styles.reviewSection}>
                <div className={styles.reviewSectionHeader}>
                  <h2 className={styles.sectionTitle}>
                    3. Ghi chú & Xác nhận
                  </h2>
                  <p className={styles.sectionSubtitle}>
                    Ghi chú thêm (nếu có) rồi bấm nút xác nhận bên dưới
                  </p>
                </div>

                <textarea
                  value={clinicalNotes}
                  onChange={(e) => setClinicalNotes(e.target.value)}
                  placeholder="Ghi chú thêm (nếu có): ví dụ đã sửa câu hỏi cho dễ hiểu hơn, dặn bệnh nhân tái khám..."
                  className={styles.notesTextarea}
                />

                <button
                  type="button"
                  className={styles.saveBtn}
                  disabled={saving}
                  onClick={handleSaveAnnotation}
                >
                  {saving ? "Đang xác nhận..." : "Xác nhận"}
                </button>

                {saveMessage && (
                  <div
                    className={[
                      styles.saveStatus,
                      saveMessage.isError ? styles.saveError : styles.saveSuccess,
                    ].join(" ")}
                  >
                    {saveMessage.text}
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>

      {/* Guide Modal for Users */}
      {showGuide && (
        <div className={styles.guideModalOverlay} onClick={() => setShowGuide(false)}>
          <div className={styles.guideModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.guideModalHeader}>
              <h3 className={styles.guideModalTitle}>
                Hướng dẫn cách làm (Rất đơn giản)
              </h3>
              <button
                type="button"
                className={styles.guideCloseIconBtn}
                onClick={() => setShowGuide(false)}
                title="Đóng cửa sổ này"
              >
                Đóng
              </button>
            </div>

            <div className={styles.guideModalBody}>
              <div className={styles.guideTipBox}>
                <strong>Mục đích:</strong> Giúp câu hỏi và lịch sử khám nghe giống người thật nói chuyện, đúng thực tế và an toàn khi tư vấn nha khoa.
              </div>

              <div className={styles.guideStepCard}>
                <div className={styles.guideStepHeader}>
                  <span className={styles.guideStepNumber}>Bước 1</span>
                  <span className={styles.guideStepTitle}>Đọc và sửa câu hỏi</span>
                </div>
                <p className={styles.guideStepDesc}>
                  Đọc ô <strong>"1. Câu hỏi của bệnh nhân"</strong>. Nếu thấy câu từ bị gượng gạo, lủng củng hoặc sai từ chuyên môn nha khoa, bạn cứ bấm thẳng vào ô đó để sửa lại cho tự nhiên.
                </p>
              </div>

              <div className={styles.guideStepCard}>
                <div className={styles.guideStepHeader}>
                  <span className={styles.guideStepNumber}>Bước 2</span>
                  <span className={styles.guideStepTitle}>Xem lại các lần khám trước</span>
                </div>
                <p className={styles.guideStepDesc}>
                  Bấm vào các nút <strong>"Lần khám 1, 2..."</strong> để xem trước đây bệnh nhân đã nói gì. Chỗ nào có nhãn màu cam <strong>"Thông tin quan trọng"</strong> là lời dặn then chốt (ví dụ: đang đeo hàm duy trì gì, có dị ứng gì không). Nếu thấy câu nào cần sửa, bạn cũng có thể bấm vào sửa luôn.
                </p>
              </div>

              <div className={styles.guideStepCard}>
                <div className={styles.guideStepHeader}>
                  <span className={styles.guideStepNumber}>Bước 3</span>
                  <span className={styles.guideStepTitle}>Ghi chú và bấm Xác nhận</span>
                </div>
                <p className={styles.guideStepDesc}>
                  Ở cột bên phải, kiểm tra lại thông tin quan trọng. Nếu muốn nhắn nhủ gì thêm thì gõ vào ô ghi chú, sau đó bấm nút <strong>"Xác nhận"</strong> là xong một ca!
                </p>
              </div>
            </div>

            <div className={styles.guideModalFooter}>
              <button
                type="button"
                className={styles.guideDismissBtn}
                onClick={() => setShowGuide(false)}
              >
                Tôi đã hiểu và bắt đầu làm
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}
