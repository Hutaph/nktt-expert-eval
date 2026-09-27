# ViDent-LongMem-500: Longitudinal Dental Memory Benchmark

ViDent-LongMem-500 is the first multi-session longitudinal benchmark designed for Vietnamese dental AI assistants with naturalistic, conversational user interactions reflecting realistic patient dialogues.

## Dataset Structure

The benchmark is organized into four standardized files:

1. **`timelines.jsonl`**: 125 patient conversation timelines arranged in chronological order (averaging 20.5 sessions and 132.8 dialogue turns per patient). Features realistic, everyday conversational phrasing with full Vietnamese diacritics.
2. **`benchmark_cases.jsonl`**: 500 unified evaluation cases integrating gold labels across all three modules:
   - `category`: Test case category (`PERSONALIZATION_NEEDED` or `NO_PERSONALIZATION_NEEDED` negative controls).
   - `targets.factors`: Essential material personalization factors (Module 2 Evaluation - RQ1).
   - `targets.memory_events`: Target clinical memory events required for retrieval (Module 1 & 3 Evaluation - RQ2, RQ4).
   - `targets.state_snapshots`: Resolved gold states (`KNOWN`, `UNKNOWN`, or `UNCERTAIN`) (Module 2 Evaluation - RQ3).
   - `targets.evidence_pass1` & `evidence_pass2`: Gold dental evidence passages (Module 3 Evaluation - RQ5).
   - `targets.clinical_requirements`: Non-diagnostic clinical safety constraints.
3. **`source_events.jsonl`**: 1,230 source-linked gold memory events for frozen experimental replay or standalone extractor benchmarking.
4. **`evidence_catalog.json`**: Standardized catalog of 10 clinical evidence groups for evaluating clinical evidence retrieval.

## Quick Start (Python)

```python
import json

# Load 500 benchmark evaluation cases
with open("benchmark_cases.jsonl", encoding="utf-8") as f:
    cases = [json.loads(line) for line in f]

print(f"Total benchmark cases: {len(cases)}")
print("Sample query:", cases[0]["current_query"])
print("Required factors:", cases[0]["targets"]["factors"])
```
