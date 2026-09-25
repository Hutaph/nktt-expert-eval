"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import styles from "./LabelData.module.css";
import ClinicalLikertEvalView from "./components/ClinicalLikertEvalView";
import DoctorLoginModal, {
  DOCTORS_LIST,
  DoctorProfile,
} from "./components/DoctorLoginModal";
import QualityWarningModal from "./components/QualityWarningModal";
import ClinicalRulesModal from "./components/ClinicalRulesModal";
import ExampleComparisonModal from "./components/ExampleComparisonModal";

interface AutoExpandingTextareaProps {
  value: string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  readOnly?: boolean;
  className?: string;
  title?: string;
  spellCheck?: boolean;
}

function AutoExpandingTextarea({
  value,
  onChange,
  placeholder,
  readOnly,
  className,
  title,
  spellCheck = false,
}: AutoExpandingTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, 22)}px`;
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
      title={title}
      spellCheck={spellCheck}
      style={{ overflow: "hidden", width: "100%", display: "block" }}
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
      value: string | null;
      supporting_event_ids: string[];
      conflict_event_ids?: string[];
    }>;
    evidence_pass1?: {
      target_groups: string[];
      acceptable_chunks: string[];
    };
    evidence_pass2?: {
      target_groups: string[];
      acceptable_chunks: string[];
    };
    clinical_requirements?: {
      must_personalize: boolean;
      must_not_use_events: string[];
      must_not_diagnose: boolean;
    };
  };
  metadata: {
    language: string;
    checkpoint: string;
    history_bucket: string;
    paper_coverage_contract?: string;
    annotation_revision?: string;
    evidence_routing_status?: string;
    evidence_curation_required?: boolean;
    validation_status?: string;
    unresolved_evidence_topic?: string;
  };
  evidence_pass1?: {
    target_groups: string[];
    acceptable_chunks: string[];
  };
  evidence_pass2?: {
    target_groups: string[];
    acceptable_chunks: string[];
  };
}

interface ExpertAnnotationRecord {
  case_id: string;
  user_id: string;
  verdict: "APPROVED" | "EDITED" | "FLAGGED";
  clinical_notes: string;
  original_query?: string;
  edited_query?: string;
  query_change_percent?: number;
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

const CLINICAL_DOMAIN_KEYWORDS = [
  "răng", "nướu", "lợi", "tủy", "hàm", "niềng", "mắc cài", "nhổ", "trám",
  "phục hình", "cạo vôi", "nha chu", "sâu răng", "khớp cắn", "máng", "implant",
  "bọc sứ", "răng khôn", "tẩy trắng", "kẽ", "chỉ nha khoa", "tăm nước", "bàn chải",
  "súc miệng", "chlorhexidine", "penicillin", "kháng sinh", "giảm đau", "dị ứng",
  "tiền sử", "bệnh sử", "diễn tiến", "lâm sàng", "chống chỉ định", "chỉ định",
  "chẩn đoán", "an toàn", "nguy cơ", "phác đồ", "đối chứng", "đại cương",
  "triệu chứng", "điều trị", "theo dõi", "tái khám", "can thiệp", "biến chứng",
  "phù hợp", "chính xác", "thuật ngữ", "ngữ cảnh", "người bệnh", "bệnh nhân",
  "hồ sơ", "khám", "thuốc", "vệ sinh", "viêm", "ê buốt", "lệch", "xương", "mô mềm"
];

function getLevenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function calculateQueryChangePercent(orig: string, edited: string): number {
  if (!orig && !edited) return 0;
  if (orig === edited) return 0;
  const maxLen = Math.max(orig.length, edited.length);
  if (maxLen === 0) return 0;
  const dist = getLevenshteinDistance(orig, edited);
  return Math.min(100, Math.round((dist / maxLen) * 100));
}

const isFakeDefaultNote = (note?: string): boolean => {
  if (!note) return false;
  const trimmed = note.trim();
  if (trimmed.length === 0) return false;
  return (
    trimmed.startsWith("Đã thẩm định:") ||
    trimmed.includes("Đã đối chiếu các dữ kiện ẩn qua các đợt khám trước") ||
    trimmed.includes("bảo đảm tính liên kết điều trị") ||
    trimmed === "Đã đối chiếu các lần khám, câu hỏi và tư vấn đạt chuẩn chuyên môn và an toàn lâm sàng." ||
    trimmed === "Đã trau chuốt và chuẩn hóa câu từ phù hợp thuật ngữ chuyên ngành Răng Hàm Mặt." ||
    trimmed === "Cần lưu ý thêm về diễn tiến triệu chứng và tiền sử điều trị của Người hỏi."
  );
};

interface ClinicalNotesQuality {
  isValid: boolean;
  errors: string[];
  charCount: number;
  wordCount: number;
  uniqueWords: number;
  hasAccent: boolean;
  hasDomainKeywords: boolean;
  hasSpamRepeat: boolean;
  duplicateWithCaseId?: string;
  duplicateSimilarity?: number;
}

function checkClinicalNotesQuality(
  notes: string,
  _currentCaseId: string,
  _batchCases: CaseDetail[],
  _annotationsMap: Record<string, ExpertAnnotationRecord>,
  _isBigQueryEdit: boolean
): ClinicalNotesQuality {
  const trimmed = notes.trim();
  const charCount = trimmed.length;

  return {
    isValid: true,
    errors: [],
    charCount,
    wordCount: trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0,
    uniqueWords: trimmed ? new Set(trimmed.toLowerCase().split(/\s+/).filter(Boolean)).size : 0,
    hasAccent: true,
    hasDomainKeywords: true,
    hasSpamRepeat: false,
  };
}

const STORAGE_KEY = "nktt_expert_annotations_v5";
const DRAFT_PREFIX = "nktt_draft_v5_";
const DATASET_VERSION_TAG = "v5_20260924_v5clean";

function getAssetBase(): string {
  if (typeof window === "undefined") return "";
  if (window.location.pathname.startsWith("/nktt-expert-eval")) {
    return "/nktt-expert-eval";
  }
  return "";
}

function getDoctorAnnotations(doctorId: string): Record<string, ExpertAnnotationRecord> {
  if (typeof window === "undefined" || !doctorId) return {};
  try {
    const raw = localStorage.getItem(`nktt_doctor_annotations_${doctorId}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveDoctorAnnotation(doctorId: string, record: ExpertAnnotationRecord): void {
  if (typeof window === "undefined" || !doctorId) return;
  try {
    const existing = getDoctorAnnotations(doctorId);
    existing[record.case_id] = record;
    localStorage.setItem(`nktt_doctor_annotations_${doctorId}`, JSON.stringify(existing));
  } catch (err) {
    console.error("Lỗi khi lưu vào bộ nhớ trình duyệt:", err);
  }
}

function getStoredAnnotations(doctorId?: string): Record<string, ExpertAnnotationRecord> {
  if (doctorId) return getDoctorAnnotations(doctorId);
  return {};
}

function saveStoredAnnotation(record: ExpertAnnotationRecord, doctorId?: string): void {
  if (doctorId) saveDoctorAnnotation(doctorId, record);
}

const FAMILY_FRIENDLY_NAMES: Record<string, { label: string; desc: string }> = {
  NO_PERSONALIZATION_NEEDED: {
    label: "Kiến thức nha khoa đại cương",
    desc: "Câu hỏi đại cương không yêu cầu xét tiền sử cá nhân",
  },
  UPDATE_SUPERSESSION: {
    label: "Cập nhật thay đổi theo thời gian",
    desc: "Người hỏi có biến chuyển mới (đổi khí cụ, tháo niềng, hoàn tất thủ thuật)",
  },
  EXPLICIT_STABLE_PERSONALIZATION: {
    label: "Tiền sử bệnh học cố định",
    desc: "Thông tin cố định lâu dài: cơ địa, dị ứng thuốc, răng đã can thiệp",
  },
  LATENT_EVIDENCE_CONDITIONED_FACTOR: {
    label: "Suy luận từ diễn tiến lâm sàng",
    desc: "Dữ kiện ẩn trong các lần khám trước, cần liên kết phác đồ",
  },
  MISSING_FACTOR_UNKNOWN: {
    label: "Thiếu dữ kiện lâm sàng (Cần hỏi lại)",
    desc: "Hồ sơ chưa có thông tin, bác sĩ cần yêu cầu Người hỏi cung cấp thêm",
  },
  MULTI_FACTOR_CROSS_SESSION: {
    label: "Xâu chuỗi nhiều lần khám",
    desc: "Tổng hợp thông tin từ nhiều lần khám trước đây",
  },
  CROSS_SESSION_PERSONALIZATION: {
    label: "Xâu chuỗi nhiều lần khám",
    desc: "Tổng hợp thông tin từ nhiều lần khám trước đây",
  },
  CONFLICT_UNCERTAINTY: {
    label: "Mâu thuẫn hoặc chưa rõ ràng",
    desc: "Có sự bất nhất giữa các lần khám, cần làm rõ lại triệu chứng",
  },
  PROVENANCE_BOUNDARY: {
    label: "Phân định nguồn dữ liệu",
    desc: "Phân biệt rõ lời Người hỏi tự kể và kết quả khám trực tiếp của bác sĩ",
  },
};

const STATUS_FRIENDLY_NAMES: Record<string, string> = {
  KNOWN: "Đã xác định trong hồ sơ",
  UNCERTAIN: "Mâu thuẫn / Cần làm rõ",
  UNKNOWN: "Chưa ghi nhận (Cần hỏi thêm)",
};

let cachedAllCases: CaseDetail[] | null = null;
let cachedTimelinesMap: Map<string, TimelineRecord> | null = null;
let cachedEventsMap: Map<string, SourceEventRecord[]> | null = null;

export default function LabelDataPage() {
  // Navigation: permanently locked to label-data
  const [activeTab, setActiveTab] = useState<"clinical-likert" | "label-data">("label-data");

  // Doctor session & Protocol states
  const [activeDoctor, setActiveDoctor] = useState<DoctorProfile | null>(null);
  const [pendingDoctor, setPendingDoctor] = useState<DoctorProfile | null>(null);
  const [showDoctorModal, setShowDoctorModal] = useState<boolean>(false);
  const [showRulesModal, setShowRulesModal] = useState<boolean>(false);
  const [showExampleModal, setShowExampleModal] = useState<boolean>(false);

  // Track explicit case confirmations made by the doctor
  const [confirmedCaseIds, setConfirmedCaseIds] = useState<Set<string>>(new Set());

  // Batch states (10 batches per doctor, 10 cases per batch)
  const [currentBatchIndex, setCurrentBatchIndex] = useState<number>(1);
  const [completedBatches, setCompletedBatches] = useState<number[]>([]);

  // Quality Warning modal state
  const [showQualityWarning, setShowQualityWarning] = useState<boolean>(false);
  const [qualityFindings, setQualityFindings] = useState<string[]>([]);

  // Auto-save state
  const [lastAutoSavedAt, setLastAutoSavedAt] = useState<string | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState<boolean>(false);
  const isInitialCaseLoadRef = useRef<boolean>(true);

  // Core dataset state
  const [allCases, setAllCases] = useState<CaseDetail[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [loadingList, setLoadingList] = useState<boolean>(true);

  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [activeCase, setActiveCase] = useState<CaseDetail | null>(null);
  const [timeline, setTimeline] = useState<TimelineRecord | null>(null);
  const [events, setEvents] = useState<SourceEventRecord[]>([]);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);

  // Editing state for active case
  const [editedQuery, setEditedQuery] = useState<string>("");
  const [activeSessionIndex, setActiveSessionIndex] = useState<number>(0);
  const [editedTurns, setEditedTurns] = useState<Record<string, string>>({});
  const [editedFactors, setEditedFactors] = useState<FactorRecord[]>([]);
  const [editedRelevantEvents, setEditedRelevantEvents] = useState<string>("");
  const [editedStaleEvents, setEditedStaleEvents] = useState<string>("");
  const [editedForbiddenEvents, setEditedForbiddenEvents] = useState<string>("");
  const [annotator, setAnnotator] = useState<string>("Bác sĩ Thẩm định");

  const [clinicalNotes, setClinicalNotes] = useState<string>("");
  const [saving, setSaving] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [annotationsMap, setAnnotationsMap] = useState<Record<string, ExpertAnnotationRecord>>({});

  // Anti-speedrun & session inspection tracking
  const [readingCountdown, setReadingCountdown] = useState<number>(0);
  const [inspectedSessions, setInspectedSessions] = useState<Set<number>>(new Set());

  // Clinical Verification Checklist (Checkpoints)
  const [checklistHistory, setChecklistHistory] = useState<boolean>(false);
  const [checklistSafety, setChecklistSafety] = useState<boolean>(false);
  const [checklistCore, setChecklistCore] = useState<boolean>(false);

  // Query editing toggle
  const [isEditingQuery, setIsEditingQuery] = useState<boolean>(false);

  // Clinical Verdict State
  const [currentVerdict, setCurrentVerdict] = useState<"APPROVED" | "EDITED" | "FLAGGED">("APPROVED");

  const handleSelectVerdict = (v: "APPROVED" | "EDITED" | "FLAGGED") => {
    setCurrentVerdict(v);
  };

  // Active bubble helper for doctors (rules & clinical examples)
  const [activeBubble, setActiveBubble] = useState<"NONE" | "RULES" | "APPROVED" | "EDITED" | "FLAGGED">("NONE");

  const handleToggleBubble = (type: "RULES" | "APPROVED" | "EDITED" | "FLAGGED") => {
    setActiveBubble((prev) => (prev === type ? "NONE" : type));
  };

  const handleInsertSkeleton = (skeletonText: string) => {
    setClinicalNotes(skeletonText);
    setActiveBubble("NONE");
  };

  // Initialize doctor session from sessionStorage on mount (requires password when browser/tab is restarted)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = sessionStorage.getItem("nktt_active_doctor_session");
      if (saved) {
        const parsed = JSON.parse(saved);
        const matched = DOCTORS_LIST.find((d) => d.id === parsed.id);
        if (matched) {
          setActiveDoctor(matched);
          setAnnotator(matched.name);
          setShowDoctorModal(false);
          return;
        }
      }
    } catch {}
    // If no active session, show Doctor Login Modal
    setShowDoctorModal(true);
  }, []);

  // When active doctor changes, load their confirmed cases and completed batches
  useEffect(() => {
    if (!activeDoctor) return;

    // Purge legacy polluted keys from localStorage
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("nktt_expert_annotations_v5");
        localStorage.removeItem("nktt_expert_annotations_v4");
        localStorage.removeItem("nktt_expert_annotations_v3");
      } catch {}
    }

    // Load confirmed cases for this specific doctor
    try {
      const savedConfirmed = localStorage.getItem(`nktt_confirmed_cases_${activeDoctor.id}`);
      if (savedConfirmed) {
        const list = JSON.parse(savedConfirmed);
        if (Array.isArray(list)) {
          setConfirmedCaseIds(new Set(list));
        }
      } else {
        setConfirmedCaseIds(new Set());
      }
    } catch {
      setConfirmedCaseIds(new Set());
    }

    // Load annotations strictly saved by this active doctor
    const docAnnotations = getDoctorAnnotations(activeDoctor.id);
    setAnnotationsMap(docAnnotations);

    // Load completed batches for this doctor
    try {
      const saved = localStorage.getItem(`nktt_completed_batches_${activeDoctor.id}`);
      let completedList: number[] = [];
      if (saved) {
        const list = JSON.parse(saved);
        if (Array.isArray(list)) {
          completedList = list;
          setCompletedBatches(list);
        }
      } else {
        setCompletedBatches([]);
      }

      // Check saved active batch for this doctor
      let preferredBatch = 1;
      const savedActiveBatch = localStorage.getItem(`nktt_active_batch_${activeDoctor.id}`);
      if (savedActiveBatch) {
        const parsed = parseInt(savedActiveBatch, 10);
        if (parsed >= 1 && parsed <= 10) {
          const isUnlocked = parsed === 1 || completedList.includes(parsed - 1) || completedList.includes(parsed);
          if (isUnlocked) preferredBatch = parsed;
        }
      } else {
        // Auto select first incomplete batch
        for (let b = 1; b <= 10; b++) {
          if (!completedList.includes(b)) {
            preferredBatch = b;
            break;
          }
        }
      }
      setCurrentBatchIndex(preferredBatch);
    } catch {
      setCompletedBatches([]);
      setCurrentBatchIndex(1);
    }
    setAnnotator(activeDoctor.name);
  }, [activeDoctor]);

  // Clean up legacy fake drafts and old caches from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const keysToRemove: string[] = [
          "nktt_expert_annotations_v5",
          "nktt_expert_annotations_v4",
          "nktt_expert_annotations_v3",
          "nktt_expert_annotations",
        ];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (!k) continue;
          if (k.startsWith("nktt_draft_")) {
            try {
              const val = localStorage.getItem(k);
              if (val) {
                const parsed = JSON.parse(val);
                if (isFakeDefaultNote(parsed?.clinicalNotes)) {
                  keysToRemove.push(k);
                }
              }
            } catch {
              keysToRemove.push(k);
            }
          } else if (k.startsWith("nktt_doctor_annotations_")) {
            try {
              const val = localStorage.getItem(k);
              if (val) {
                const parsed = JSON.parse(val);
                let changed = false;
                for (const cId of Object.keys(parsed)) {
                  if (isFakeDefaultNote(parsed[cId]?.clinical_notes)) {
                    delete parsed[cId];
                    changed = true;
                  }
                }
                if (changed) {
                  localStorage.setItem(k, JSON.stringify(parsed));
                }
              }
            } catch {}
          }
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));
      } catch {}
    }
  }, []);

  // Load all 500 cases from public/dataset
  useEffect(() => {
    let isMounted = true;
    async function fetchCases() {
      setLoadingList(true);
      try {
        const assetBase = getAssetBase();
        if (!cachedAllCases) {
          const res = await fetch(
            `${assetBase}/dataset/vident_longmem_500/benchmark_cases.jsonl?v=${DATASET_VERSION_TAG}`,
            { cache: "no-store" }
          );
          const text = await res.text();
          const list: CaseDetail[] = [];
          for (const line of text.split("\n")) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const parsed = JSON.parse(trimmed) as CaseDetail;
              list.push(parsed);
            } catch {}
          }
          cachedAllCases = list;
          if (isMounted) {
            setAllCases(list);
          }
        } else {
          setAllCases(cachedAllCases);
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
  }, []);

  // 100 cases assigned to the active doctor
  const doctorCases = useMemo(() => {
    if (!activeDoctor || allCases.length === 0) return [];
    return allCases.slice(activeDoctor.startIndex, activeDoctor.endIndex + 1);
  }, [activeDoctor, allCases]);

  // 10 cases of the currently active batch
  const batchCases = useMemo(() => {
    if (doctorCases.length === 0) return [];
    const start = (currentBatchIndex - 1) * 10;
    return doctorCases.slice(start, start + 10);
  }, [doctorCases, currentBatchIndex]);

  // Auto-select case of current batch (prefer remembered active case)
  useEffect(() => {
    if (batchCases.length > 0) {
      if (!selectedCaseId || !batchCases.some((c) => c.case_id === selectedCaseId)) {
        let targetCaseId = batchCases[0].case_id;
        if (activeDoctor) {
          try {
            const savedCaseId = localStorage.getItem(`nktt_active_case_${activeDoctor.id}`);
            if (savedCaseId && batchCases.some((c) => c.case_id === savedCaseId)) {
              targetCaseId = savedCaseId;
            }
          } catch {}
        }
        setSelectedCaseId(targetCaseId);
      }
    }
  }, [batchCases, selectedCaseId, activeDoctor]);

  // Cases filtered by search within the current batch
  const filteredCases = useMemo(() => {
    let list = batchCases;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (c) =>
          c.case_id.toLowerCase().includes(q) ||
          c.user_id.toLowerCase().includes(q) ||
          c.current_query.toLowerCase().includes(q)
      );
    }
    return list;
  }, [batchCases, searchQuery]);

  // Danh sách các ca của cùng bệnh nhân hiện tại, sắp xếp theo mốc khám tăng dần
  const patientCases = useMemo(() => {
    if (!activeCase || allCases.length === 0) return [];
    const list = allCases.filter((c) => c.user_id === activeCase.user_id);
    return list.sort((a, b) => {
      const aMatch = a.visible_history?.up_to_session?.match(/\d+/);
      const bMatch = b.visible_history?.up_to_session?.match(/\d+/);
      const aNum = aMatch ? parseInt(aMatch[0], 10) : 0;
      const bNum = bMatch ? parseInt(bMatch[0], 10) : 0;
      return aNum - bNum;
    });
  }, [activeCase, allCases]);

  // Phân đoạn diễn tiến khám cho ca này: từ sau mốc ca trước đến mốc ca hiện tại
  const sessionSegmentation = useMemo(() => {
    if (!activeCase || !timeline?.sessions) {
      return { start: 1, end: timeline?.sessions?.length || 1, previousEnd: 0 };
    }
    const currentCutoffMatch = activeCase.visible_history?.up_to_session?.match(/\d+/);
    const endNum = currentCutoffMatch ? parseInt(currentCutoffMatch[0], 10) : timeline.sessions.length;

    const caseIdx = patientCases.findIndex((c) => c.case_id === activeCase.case_id);
    let startNum = 1;
    let prevEnd = 0;
    if (caseIdx > 0) {
      const prevCase = patientCases[caseIdx - 1];
      const prevCutoffMatch = prevCase.visible_history?.up_to_session?.match(/\d+/);
      if (prevCutoffMatch) {
        prevEnd = parseInt(prevCutoffMatch[0], 10);
        startNum = prevEnd + 1;
      }
    }

    return { start: startNum, end: endNum, previousEnd: prevEnd };
  }, [activeCase, timeline, patientCases]);

  // Các lần khám hiển thị trên thanh tab: Chỉ hiển thị các lần thuộc chặng của ca này
  const visibleSessions = useMemo(() => {
    if (!timeline?.sessions) return [];
    return timeline.sessions.filter(
      (s) => s.session_number >= sessionSegmentation.start && s.session_number <= sessionSegmentation.end
    );
  }, [timeline, sessionSegmentation]);

  // Kiểm tra bác sĩ đã xem qua toàn bộ các lần khám thuộc ca này chưa
  const hasInspectedAllSessions = useMemo(() => {
    if (visibleSessions.length === 0) return true;
    return visibleSessions.every((s) => inspectedSessions.has(s.session_number));
  }, [visibleSessions, inspectedSessions]);

  const inspectedCount = useMemo(() => {
    return visibleSessions.filter((s) => inspectedSessions.has(s.session_number)).length;
  }, [visibleSessions, inspectedSessions]);

  // Tự động ghi nhận lần khám hiện tại vào danh sách đã xem
  useEffect(() => {
    if (timeline?.sessions?.[activeSessionIndex]) {
      const sNum = timeline.sessions[activeSessionIndex].session_number;
      setInspectedSessions((prev) => {
        if (prev.has(sNum)) return prev;
        const next = new Set(prev);
        next.add(sNum);
        return next;
      });
    }
  }, [activeSessionIndex, timeline]);

  // Đảm bảo activeSessionIndex luôn thuộc các lần khám hiển thị, mặc định chọn mốc đầu tiên của ca
  useEffect(() => {
    if (!timeline?.sessions || visibleSessions.length === 0) return;
    const currentSession = timeline.sessions[activeSessionIndex];
    const isCurrentVisible = currentSession && visibleSessions.some((s) => s.session_id === currentSession.session_id);
    if (!isCurrentVisible) {
      // Mặc định chọn mốc khám đầu tiên của ca này
      const firstSession = visibleSessions[0];
      const actualIdx = timeline.sessions.findIndex((s) => s.session_id === firstSession.session_id);
      if (actualIdx >= 0) {
        setActiveSessionIndex(actualIdx);
      }
    }
  }, [visibleSessions, timeline, activeSessionIndex]);

  // Load detail for selected case (with draft restoration)
  useEffect(() => {
    if (!selectedCaseId || allCases.length === 0) return;
    let isMounted = true;

    async function loadCaseData() {
      setLoadingDetail(true);
      isInitialCaseLoadRef.current = true;
      try {
        const matchedCase = allCases.find((c) => c.case_id === selectedCaseId);
        if (!matchedCase) return;
        setActiveCase(matchedCase);

        const assetBase = getAssetBase();

        // 1. Load timelines
        if (!cachedTimelinesMap) {
          const tRes = await fetch(
            `${assetBase}/dataset/vident_longmem_500/timelines.jsonl?v=${DATASET_VERSION_TAG}`,
            { cache: "no-store" }
          );
          const tText = await tRes.text();
          const tMap = new Map<string, TimelineRecord>();
          for (const line of tText.split("\n")) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const rec = JSON.parse(trimmed) as TimelineRecord;
              tMap.set(rec.user_id, rec);
            } catch {}
          }
          cachedTimelinesMap = tMap;
        }

        // 2. Load events
        if (!cachedEventsMap) {
          const eRes = await fetch(
            `${assetBase}/dataset/vident_longmem_500/source_events.jsonl?v=${DATASET_VERSION_TAG}`,
            { cache: "no-store" }
          );
          const eText = await eRes.text();
          const eMap = new Map<string, SourceEventRecord[]>();
          for (const line of eText.split("\n")) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const rec = JSON.parse(trimmed) as SourceEventRecord;
              if (!eMap.has(rec.user_id)) {
                eMap.set(rec.user_id, []);
              }
              eMap.get(rec.user_id)!.push(rec);
            } catch {}
          }
          cachedEventsMap = eMap;
        }

        if (!isMounted) return;

        const uTimeline = cachedTimelinesMap?.get(matchedCase.user_id) || null;
        setTimeline(uTimeline);

        const uEvents = cachedEventsMap?.get(matchedCase.user_id) || [];
        setEvents(uEvents);

        // Mặc định mở mốc khám đầu tiên của chặng ca này
        const matchedCasesList = allCases.filter((c) => c.user_id === matchedCase.user_id);
        matchedCasesList.sort((a, b) => {
          const aMatch = a.visible_history?.up_to_session?.match(/\d+/);
          const bMatch = b.visible_history?.up_to_session?.match(/\d+/);
          return (aMatch ? parseInt(aMatch[0], 10) : 0) - (bMatch ? parseInt(bMatch[0], 10) : 0);
        });
        const caseIdx = matchedCasesList.findIndex((c) => c.case_id === matchedCase.case_id);
        let startNum = 1;
        if (caseIdx > 0) {
          const prevCase = matchedCasesList[caseIdx - 1];
          const prevCutoffMatch = prevCase.visible_history?.up_to_session?.match(/\d+/);
          if (prevCutoffMatch) {
            startNum = parseInt(prevCutoffMatch[0], 10) + 1;
          }
        }
        let initialSessionIdx = 0;
        if (uTimeline?.sessions) {
          const sIdx = uTimeline.sessions.findIndex((s: any) => s.session_number === startNum);
          if (sIdx >= 0) initialSessionIdx = sIdx;
        }

        // Tự động đồng bộ kho lượt thoại chung của toàn bộ các ca
        let sharedTurns: Record<string, string> = {};
        if (activeDoctor) {
          try {
            const rawShared = localStorage.getItem(`nktt_shared_turns_v5_${activeDoctor.id}`);
            if (rawShared) sharedTurns = JSON.parse(rawShared);
          } catch {}
        }

        // Check for local working draft first
        let draftData: any = null;
        if (activeDoctor) {
          try {
            const draftKey = `${DRAFT_PREFIX}${activeDoctor.id}_${matchedCase.case_id}`;
            const rawDraft = localStorage.getItem(draftKey);
            if (rawDraft) {
              const parsed = JSON.parse(rawDraft);
              if (parsed && !isFakeDefaultNote(parsed.clinicalNotes)) {
                draftData = parsed;
              } else {
                // Xoa bo ban nhap bi nhiem cau mau hoac khong hop le
                localStorage.removeItem(draftKey);
                draftData = null;
              }
            }
          } catch {}
        }

        const isConfirmed = confirmedCaseIds.has(matchedCase.case_id);
        const saved = annotationsMap[matchedCase.case_id];

        if (isConfirmed && saved && !isFakeDefaultNote(saved.clinical_notes)) {
          // Restore from confirmed annotation by active doctor
          setEditedQuery(saved.edited_query || matchedCase.current_query || "");
          setClinicalNotes(saved.clinical_notes || "");
          if (saved.verdict) {
            setCurrentVerdict(saved.verdict as "APPROVED" | "EDITED" | "FLAGGED");
          } else {
            setCurrentVerdict("APPROVED");
          }

          const tMap: Record<string, string> = {};
          if (saved.edited_turns) {
            saved.edited_turns.forEach((t) => {
              tMap[t.turn_id] = t.text;
            });
          }
          setEditedTurns({ ...tMap, ...sharedTurns });

          if (saved.factors && saved.factors.length > 0) {
            setEditedFactors(JSON.parse(JSON.stringify(saved.factors)));
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
          setChecklistHistory(true);
          setChecklistSafety(true);
          setChecklistCore(true);
        } else if (draftData) {
          // Restore from draft
          setEditedQuery(draftData.editedQuery || matchedCase.current_query || "");
          setClinicalNotes(draftData.clinicalNotes || "");
          if (draftData.verdict) {
            setCurrentVerdict(draftData.verdict);
          } else {
            setCurrentVerdict("APPROVED");
          }
          setEditedTurns({ ...(draftData.editedTurns || {}), ...sharedTurns });
          setEditedFactors(
            draftData.editedFactors ||
              (matchedCase.targets?.factors ? JSON.parse(JSON.stringify(matchedCase.targets.factors)) : [])
          );
          setEditedRelevantEvents(draftData.editedRelevantEvents || "");
          setEditedStaleEvents(draftData.editedStaleEvents || "");
          setEditedForbiddenEvents(draftData.editedForbiddenEvents || "");
          setChecklistHistory(Boolean(draftData.checklistHistory));
          setChecklistSafety(Boolean(draftData.checklistSafety));
          setChecklistCore(Boolean(draftData.checklistCore));
          if (typeof draftData.activeSessionIndex === "number") {
            initialSessionIdx = draftData.activeSessionIndex;
          }
        } else {
          // Fresh default state: absolutely blank notes, unchecked checklists
          setEditedQuery(matchedCase.current_query || "");
          setClinicalNotes("");
          setCurrentVerdict("APPROVED");
          setEditedTurns({ ...sharedTurns });
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
          setChecklistHistory(false);
          setChecklistSafety(false);
          setChecklistCore(false);
        }

        setActiveSessionIndex(initialSessionIdx);

        // Khôi phục mốc khám đã xem:
        // - Nếu ca ĐÃ xác nhận chính thức bởi Bác sĩ: mở toàn bộ
        // - Nếu có bản lưu nháp từ Bác sĩ: lấy từ draft
        // - Nếu ca MỚI (chưa làm): CHỈ lấy mốc khám đầu tiên!
        const allSessionNums = uTimeline?.sessions?.map((s) => s.session_number) || [];
        if (isConfirmed && allSessionNums.length > 0) {
          setInspectedSessions(new Set(allSessionNums));
        } else if (draftData && Array.isArray(draftData.inspectedSessions) && draftData.inspectedSessions.length > 0) {
          setInspectedSessions(new Set(draftData.inspectedSessions));
        } else {
          const firstSessionNum = uTimeline?.sessions?.[initialSessionIdx]?.session_number;
          setInspectedSessions(new Set(firstSessionNum ? [firstSessionNum] : []));
        }
      } catch (err) {
        console.error("Lỗi nạp ca bệnh:", err);
      } finally {
        if (isMounted) {
          setLoadingDetail(false);
          setTimeout(() => {
            isInitialCaseLoadRef.current = false;
          }, 300);
        }
      }
    }

    loadCaseData();

    return () => {
      isMounted = false;
    };
  }, [selectedCaseId, allCases, annotationsMap, activeDoctor]);

  // Seamless case switching without speedrun blocking (stress-free for doctors)
  useEffect(() => {
    if (!selectedCaseId) return;
    setReadingCountdown(0);
    setIsEditingQuery(false);
  }, [selectedCaseId]);

  const originalQuery = activeCase?.current_query || "";
  const queryChangePercent = useMemo(
    () => calculateQueryChangePercent(originalQuery, editedQuery),
    [originalQuery, editedQuery]
  );
  const isSignificantQueryEdit = queryChangePercent > 50;

  const notesQuality = useMemo(() => {
    if (!activeCase) {
      return {
        isValid: false,
        errors: [],
        charCount: 0,
        wordCount: 0,
        uniqueWords: 0,
        hasAccent: false,
        hasDomainKeywords: false,
        hasSpamRepeat: false,
      };
    }
    return checkClinicalNotesQuality(
      clinicalNotes,
      activeCase.case_id,
      batchCases,
      annotationsMap,
      isSignificantQueryEdit
    );
  }, [clinicalNotes, activeCase, batchCases, annotationsMap, isSignificantQueryEdit]);

  const isChecklistComplete = checklistHistory && checklistSafety && checklistCore;

  // Yêu cầu thẩm định: Đánh dấu đủ 3 tiêu chuẩn + nhận xét đạt chuẩn + xem qua toàn bộ các lần khám của ca
  const canConfirmCase = isChecklistComplete && notesQuality.isValid && hasInspectedAllSessions;

  const handleSelectSession = useCallback((idx: number) => {
    setActiveSessionIndex(idx);
    if (timeline?.sessions?.[idx]) {
      const sNum = timeline.sessions[idx].session_number;
      setInspectedSessions((prev) => {
        if (prev.has(sNum)) return prev;
        const next = new Set(prev);
        next.add(sNum);
        return next;
      });
    }
    setTimeout(() => {
      const chatEl = document.getElementById("clinical-chat-area");
      if (chatEl) {
        chatEl.scrollTo({ top: 0, behavior: "smooth" });
      }
    }, 50);
  }, [timeline]);

  // Current case index calculations for seamless navigation
  const currentCaseIndexInBatch = useMemo(() => {
    return batchCases.findIndex((c) => c.case_id === selectedCaseId);
  }, [batchCases, selectedCaseId]);

  const currentCaseIndexInDoctor = useMemo(() => {
    if (!activeCase) return 0;
    return doctorCases.findIndex((c) => c.case_id === activeCase.case_id);
  }, [doctorCases, activeCase]);

  // Số ca đã xác nhận trong đợt hiện tại (khóa nút Lưu cho tới khi đủ 10/10 ca)
  const currentBatchConfirmedCount = useMemo(() => {
    return batchCases.filter((c) => confirmedCaseIds.has(c.case_id)).length;
  }, [batchCases, confirmedCaseIds]);

  const isCurrentBatchFullyConfirmed = batchCases.length > 0 && currentBatchConfirmedCount === batchCases.length;

  // Synchronous and immediate case switching - eliminating all question desync!
  const handleSelectCase = useCallback(
    (caseId: string, bypassLockCheck: boolean = false) => {
      // Kiem tra ca co bi khoa do ca truoc chua hoan thanh khong
      if (!bypassLockCheck) {
        const caseIdxInDoctor = doctorCases.findIndex((c) => c.case_id === caseId);
        if (caseIdxInDoctor > 0) {
          const prevCase = doctorCases[caseIdxInDoctor - 1];
          let isPrevConfirmed = confirmedCaseIds.has(prevCase.case_id);
          if (!isPrevConfirmed && activeDoctor) {
            try {
              const rawConfirmed = localStorage.getItem(`nktt_confirmed_cases_${activeDoctor.id}`);
              if (rawConfirmed) {
                const list = JSON.parse(rawConfirmed);
                if (Array.isArray(list) && list.includes(prevCase.case_id)) {
                  isPrevConfirmed = true;
                }
              }
            } catch {}
          }
          if (!isPrevConfirmed) {
            alert(`Ca ${caseIdxInDoctor + 1} hiện đang khóa. Bác sĩ vui lòng hoàn thành và xác nhận Ca ${caseIdxInDoctor} trước.`);
            return;
          }
        }
      }

      setSelectedCaseId(caseId);
      const matched = allCases.find((c) => c.case_id === caseId);
      if (matched) {
        setActiveCase(matched);
        const isConfirmed = confirmedCaseIds.has(matched.case_id);
        const saved = annotationsMap[matched.case_id];

        let draftData: any = null;
        if (activeDoctor) {
          try {
            const draftKey = `${DRAFT_PREFIX}${activeDoctor.id}_${matched.case_id}`;
            const rawDraft = localStorage.getItem(draftKey);
            if (rawDraft) {
              const parsed = JSON.parse(rawDraft);
              if (parsed && !isFakeDefaultNote(parsed.clinicalNotes)) {
                draftData = parsed;
              } else {
                localStorage.removeItem(draftKey);
                draftData = null;
              }
            }
          } catch {}
        }
        let sharedTurns: Record<string, string> = {};
        if (activeDoctor) {
          try {
            const rawShared = localStorage.getItem(`nktt_shared_turns_v5_${activeDoctor.id}`);
            if (rawShared) sharedTurns = JSON.parse(rawShared);
          } catch {}
        }

        if (isConfirmed && saved && !isFakeDefaultNote(saved.clinical_notes)) {
          setEditedQuery(saved.edited_query || matched.current_query || "");
          setClinicalNotes(saved.clinical_notes || "");
          if (saved.verdict) {
            setCurrentVerdict(saved.verdict as "APPROVED" | "EDITED" | "FLAGGED");
          } else {
            setCurrentVerdict("APPROVED");
          }
          const tMap: Record<string, string> = {};
          if (saved.edited_turns) {
            saved.edited_turns.forEach((t) => {
              tMap[t.turn_id] = t.text;
            });
          }
          setEditedTurns({ ...tMap, ...sharedTurns });
          if (saved.factors && saved.factors.length > 0) {
            setEditedFactors(JSON.parse(JSON.stringify(saved.factors)));
          } else if (matched.targets?.factors) {
            setEditedFactors(JSON.parse(JSON.stringify(matched.targets.factors)));
          } else {
            setEditedFactors([]);
          }
          if (saved.memory_events) {
            setEditedRelevantEvents((saved.memory_events.relevant_event_ids || []).join(", "));
            setEditedStaleEvents((saved.memory_events.stale_event_ids || []).join(", "));
            setEditedForbiddenEvents((saved.memory_events.forbidden_event_ids || []).join(", "));
          } else {
            setEditedRelevantEvents("");
            setEditedStaleEvents("");
            setEditedForbiddenEvents("");
          }
          setChecklistHistory(true);
          setChecklistSafety(true);
          setChecklistCore(true);
        } else if (draftData) {
          setEditedQuery(draftData.editedQuery || matched.current_query || "");
          setClinicalNotes(draftData.clinicalNotes || "");
          if (draftData.verdict) {
            setCurrentVerdict(draftData.verdict);
          } else {
            setCurrentVerdict("APPROVED");
          }
          setEditedTurns({ ...(draftData.editedTurns || {}), ...sharedTurns });
          if (draftData.editedFactors) {
            setEditedFactors(draftData.editedFactors);
          } else {
            setEditedFactors(matched.targets?.factors ? JSON.parse(JSON.stringify(matched.targets.factors)) : []);
          }
          setEditedRelevantEvents(draftData.editedRelevantEvents || "");
          setEditedStaleEvents(draftData.editedStaleEvents || "");
          setEditedForbiddenEvents(draftData.editedForbiddenEvents || "");
          setChecklistHistory(Boolean(draftData.checklistHistory));
          setChecklistSafety(Boolean(draftData.checklistSafety));
          setChecklistCore(Boolean(draftData.checklistCore));
        } else {
          setEditedQuery(matched.current_query || "");
          setClinicalNotes("");
          setCurrentVerdict("APPROVED");
          setEditedTurns({ ...sharedTurns });
          if (matched.targets?.factors) {
            setEditedFactors(JSON.parse(JSON.stringify(matched.targets.factors)));
          } else {
            setEditedFactors([]);
          }
          if (matched.targets?.memory_events) {
            setEditedRelevantEvents((matched.targets.memory_events.relevant_event_ids || []).join(", "));
            setEditedStaleEvents((matched.targets.memory_events.stale_event_ids || []).join(", "));
            setEditedForbiddenEvents((matched.targets.memory_events.forbidden_event_ids || []).join(", "));
          } else {
            setEditedRelevantEvents("");
            setEditedStaleEvents("");
            setEditedForbiddenEvents("");
          }
          setChecklistHistory(false);
          setChecklistSafety(false);
          setChecklistCore(false);
        }
        // Cap nhat timeline va events ngay lap tuc
        const uTimeline = cachedTimelinesMap?.get(matched.user_id) || null;
        if (uTimeline) setTimeline(uTimeline);
        const uEvents = cachedEventsMap?.get(matched.user_id) || [];
        if (uEvents.length > 0) setEvents(uEvents);

        // Mac dinh mo moc kham dau tien cua chang ca nay
        const matchedCasesList = allCases.filter((c) => c.user_id === matched.user_id);
        matchedCasesList.sort((a, b) => {
          const aMatch = a.visible_history?.up_to_session?.match(/\d+/);
          const bMatch = b.visible_history?.up_to_session?.match(/\d+/);
          return (aMatch ? parseInt(aMatch[0], 10) : 0) - (bMatch ? parseInt(bMatch[0], 10) : 0);
        });
        const caseIdx = matchedCasesList.findIndex((c) => c.case_id === matched.case_id);
        let startNum = 1;
        if (caseIdx > 0) {
          const prevCase = matchedCasesList[caseIdx - 1];
          const prevCutoffMatch = prevCase.visible_history?.up_to_session?.match(/\d+/);
          if (prevCutoffMatch) {
            startNum = parseInt(prevCutoffMatch[0], 10) + 1;
          }
        }
        let targetSessionIdx = 0;
        if (uTimeline?.sessions) {
          const sIdx = uTimeline.sessions.findIndex((s) => s.session_number === startNum);
          if (sIdx >= 0) targetSessionIdx = sIdx;
        }
        setActiveSessionIndex(targetSessionIdx);

        // Khoi phuc moc kham da xem:
        // Neu da xac nhan chinh thuc boi bac si: mo toan bo
        // Neu co draft tu bac si: lay tu draft
        // Neu ca moi: CHI lay moc dau tien!
        const allSessionNums = uTimeline?.sessions?.map((s) => s.session_number) || [];
        if (isConfirmed && allSessionNums.length > 0) {
          setInspectedSessions(new Set(allSessionNums));
        } else if (draftData && Array.isArray(draftData.inspectedSessions) && draftData.inspectedSessions.length > 0) {
          setInspectedSessions(new Set(draftData.inspectedSessions));
        } else {
          const firstSessionNum = uTimeline?.sessions?.[targetSessionIdx]?.session_number;
          setInspectedSessions(new Set(firstSessionNum ? [firstSessionNum] : []));
        }

        setIsEditingQuery(false);
        if (activeDoctor) {
          try {
            localStorage.setItem(`nktt_active_case_${activeDoctor.id}`, matched.case_id);
          } catch {}
        }

        setTimeout(() => {
          const chatEl = document.getElementById("clinical-chat-area");
          if (chatEl) {
            chatEl.scrollTo({ top: 0, behavior: "smooth" });
          }
          window.scrollTo({ top: 0, behavior: "smooth" });
        }, 50);
      }
    },
    [allCases, annotationsMap, activeDoctor, doctorCases, confirmedCaseIds]
  );


  const handleConfirmAndNextCase = () => {
    if (!activeCase || !activeDoctor) return;

    const success = handleSaveAnnotation();
    if (success) {
      const currentCaseId = activeCase.case_id;
      const currentIdxInBatch = batchCases.findIndex((c) => c.case_id === currentCaseId);
      const doctorCaseIndex = doctorCases.findIndex((c) => c.case_id === currentCaseId);

      if (currentIdxInBatch >= 0 && currentIdxInBatch < batchCases.length - 1) {
        const nextCase = batchCases[currentIdxInBatch + 1];
        handleSelectCase(nextCase.case_id, true);
        setSaveMessage({
          text: `Đã xác nhận Ca ${doctorCaseIndex + 1} thành công. Đã chuyển ngay sang Ca ${doctorCaseIndex + 2}.`,
          isError: false,
        });
      } else {
        setSaveMessage({
          text: `Chúc mừng Bác sĩ đã hoàn tất toàn bộ 10/10 ca của Gói ${currentBatchIndex}! Nút "Lưu Gói ${currentBatchIndex}" đã được mở khóa. Bác sĩ hãy bấm nút Lưu để hoàn tất.`,
          isError: false,
        });
      }
    }
  };

  // Real-time Auto-save Draft
  useEffect(() => {
    if (isInitialCaseLoadRef.current || !activeCase || !activeDoctor) return;

    setIsAutoSaving(true);
    const timer = setTimeout(() => {
      try {
        const draftKey = `${DRAFT_PREFIX}${activeDoctor.id}_${activeCase.case_id}`;
        const draftObj = {
          case_id: activeCase.case_id,
          verdict: currentVerdict,
          activeSessionIndex,
          editedQuery,
          clinicalNotes,
          editedTurns,
          editedFactors,
          editedRelevantEvents,
          editedStaleEvents,
          editedForbiddenEvents,
          inspectedSessions: Array.from(inspectedSessions),
          checklistHistory,
          checklistSafety,
          checklistCore,
          updatedAt: new Date().toISOString(),
        };
        localStorage.setItem(draftKey, JSON.stringify(draftObj));
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
        setLastAutoSavedAt(timeStr);
      } catch (err) {
        console.error("Lỗi khi tự động lưu nháp:", err);
      } finally {
        setIsAutoSaving(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [
    activeSessionIndex,
    currentVerdict,
    editedQuery,
    clinicalNotes,
    editedTurns,
    editedFactors,
    editedRelevantEvents,
    editedStaleEvents,
    editedForbiddenEvents,
    inspectedSessions,
    checklistHistory,
    checklistSafety,
    checklistCore,
    activeCase,
    activeDoctor,
  ]);

  // Handle Turn edit & cross-case auto sync
  const handleTurnChange = (turnId: string, text: string) => {
    // 1. Cập nhật ngay trên giao diện ca hiện tại
    setEditedTurns((prev) => ({
      ...prev,
      [turnId]: text,
    }));

    // 2. Tự động đồng bộ ngầm ở backend (kho dùng chung cho toàn bộ các ca của bác sĩ)
    if (activeDoctor) {
      try {
        const storageKey = `nktt_shared_turns_v5_${activeDoctor.id}`;
        const raw = localStorage.getItem(storageKey);
        const shared = raw ? JSON.parse(raw) : {};
        shared[turnId] = text;
        localStorage.setItem(storageKey, JSON.stringify(shared));

        // 3. Tự động đồng bộ vào bản nháp của các ca khác cùng người bệnh
        if (patientCases.length > 0) {
          for (const pc of patientCases) {
            const pcDraftKey = `${DRAFT_PREFIX}${activeDoctor.id}_${pc.case_id}`;
            const pcRaw = localStorage.getItem(pcDraftKey);
            if (pcRaw) {
              try {
                const pcDraft = JSON.parse(pcRaw);
                pcDraft.editedTurns = {
                  ...(pcDraft.editedTurns || {}),
                  [turnId]: text,
                };
                localStorage.setItem(pcDraftKey, JSON.stringify(pcDraft));
              } catch {}
            }
          }
        }

        // 4. Tự động đồng bộ vào các ca đã lưu trữ nếu chứa lượt thoại này
        setAnnotationsMap((prev) => {
          let hasChange = false;
          const nextMap = { ...prev };
          for (const [cId, rec] of Object.entries(nextMap)) {
            if (rec.user_id === activeCase?.user_id && rec.edited_turns) {
              const turnIdx = rec.edited_turns.findIndex((t) => t.turn_id === turnId);
              if (turnIdx >= 0) {
                const updatedTurns = [...rec.edited_turns];
                updatedTurns[turnIdx] = { ...updatedTurns[turnIdx], text };
                nextMap[cId] = { ...rec, edited_turns: updatedTurns };
                saveDoctorAnnotation(activeDoctor.id, nextMap[cId]);
                hasChange = true;
              }
            }
          }
          return hasChange ? nextMap : prev;
        });
      } catch (err) {
        console.error("Lỗi đồng bộ lượt thoại:", err);
      }
    }
  };

  // Handle Factor edit
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

  // Reset active case to pristine v5 benchmark state (purging local draft)
  const handleResetCurrentCaseToV5 = () => {
    if (!activeCase) return;
    if (activeDoctor) {
      try {
        localStorage.removeItem(`${DRAFT_PREFIX}${activeDoctor.id}_${activeCase.case_id}`);
      } catch {}
    }
    setEditedQuery(activeCase.current_query || "");
    setClinicalNotes("");
    setEditedTurns({});
    if (activeCase.targets?.factors) {
      setEditedFactors(JSON.parse(JSON.stringify(activeCase.targets.factors)));
    } else {
      setEditedFactors([]);
    }
    if (activeCase.targets?.memory_events) {
      setEditedRelevantEvents((activeCase.targets.memory_events.relevant_event_ids || []).join(", "));
      setEditedStaleEvents((activeCase.targets.memory_events.stale_event_ids || []).join(", "));
      setEditedForbiddenEvents((activeCase.targets.memory_events.forbidden_event_ids || []).join(", "));
    } else {
      setEditedRelevantEvents("");
      setEditedStaleEvents("");
      setEditedForbiddenEvents("");
    }
    setActiveSessionIndex(0);
    setInspectedSessions(new Set());
    setIsEditingQuery(false);
  };

  // Save current individual case annotation & register confirmation
  const handleSaveAnnotation = (): boolean => {
    if (!activeCase || !activeDoctor) return false;

    setSaving(true);
    setSaveMessage(null);

    const parsedMemoryEvents = {
      relevant_event_ids: editedRelevantEvents.split(",").map((s) => s.trim()).filter(Boolean),
      stale_event_ids: editedStaleEvents.split(",").map((s) => s.trim()).filter(Boolean),
      forbidden_event_ids: editedForbiddenEvents.split(",").map((s) => s.trim()).filter(Boolean),
    };

    const editedTurnsList: TurnRecord[] = [];
    if (timeline && timeline.sessions) {
      for (const sess of timeline.sessions) {
        for (const t of sess.turns) {
          if (editedTurns[t.turn_id] !== undefined && editedTurns[t.turn_id] !== t.text) {
            editedTurnsList.push({
              turn_id: t.turn_id,
              speaker: t.speaker,
              text: editedTurns[t.turn_id],
              turn_timestamp: t.turn_timestamp,
            });
          }
        }
      }
    }

    const hasTurnEdits = editedTurnsList.length > 0;
    const hasQueryEdit = Boolean(activeCase.current_query && editedQuery.trim() !== activeCase.current_query.trim());
    const resolvedVerdict: "APPROVED" | "EDITED" | "FLAGGED" = (hasTurnEdits || hasQueryEdit) ? "EDITED" : "APPROVED";
    setCurrentVerdict(resolvedVerdict);

    const record: ExpertAnnotationRecord = {
      case_id: activeCase.case_id,
      user_id: activeCase.user_id,
      verdict: resolvedVerdict,
      clinical_notes: clinicalNotes.trim(),
      original_query: activeCase.current_query,
      edited_query: editedQuery.trim() !== activeCase.current_query.trim() ? editedQuery.trim() : undefined,
      query_change_percent: queryChangePercent > 0 ? queryChangePercent : undefined,
      edited_turns: editedTurnsList.length > 0 ? editedTurnsList : undefined,
      factors: editedFactors,
      memory_events: parsedMemoryEvents,
      annotator: activeDoctor.name,
      updated_at: new Date().toISOString(),
    };

    saveDoctorAnnotation(activeDoctor.id, record);
    setAnnotationsMap((prev) => ({
      ...prev,
      [record.case_id]: record,
    }));

    // Register explicit confirmation for this doctor
    const nextConfirmed = new Set(confirmedCaseIds);
    nextConfirmed.add(record.case_id);
    setConfirmedCaseIds(nextConfirmed);
    try {
      localStorage.setItem(`nktt_confirmed_cases_${activeDoctor.id}`, JSON.stringify(Array.from(nextConfirmed)));
    } catch {}

    const isBatchComplete = batchCases.length > 0 && batchCases.every((c) => nextConfirmed.has(c.case_id));
    if (isBatchComplete) {
      setSaveMessage({
        text: `Đã hoàn thành xuất sắc toàn bộ 10/10 ca của Gói ${currentBatchIndex}! Nút "Lưu Gói ${currentBatchIndex}" trên thanh công cụ đã được mở khóa. Bác sĩ vui lòng bấm nút Lưu để hoàn tất và mở khóa Gói tiếp theo.`,
        isError: false,
      });
    } else {
      const confirmedInBatch = batchCases.filter((c) => nextConfirmed.has(c.case_id)).length;
      setSaveMessage({
        text: `Đã xác nhận và lưu trữ ca bệnh này thành công! (Tiến độ Gói ${currentBatchIndex}: ${confirmedInBatch}/10 ca)`,
        isError: false,
      });
    }
    setSaving(false);
    return true;
  };

  // Batch switching handler (checks if unlocked)
  const handleSelectBatch = (batchNum: number, isUnlocked: boolean) => {
    if (!isUnlocked) {
      alert(`Gói ${batchNum} hiện đang khóa. Bạn cần hoàn thành các ca và bấm "Lưu" ở Gói ${batchNum - 1} trước.`);
      return;
    }
    // Auto-save current case before switching batch
    if (activeCase && activeDoctor) {
      try {
        const draftKey = `${DRAFT_PREFIX}${activeDoctor.id}_${activeCase.case_id}`;
        localStorage.setItem(
          draftKey,
          JSON.stringify({
            case_id: activeCase.case_id,
            verdict: currentVerdict,
            editedQuery,
            clinicalNotes,
            editedTurns,
            editedFactors,
            editedRelevantEvents,
            editedStaleEvents,
            editedForbiddenEvents,
            checklistHistory,
            checklistSafety,
            checklistCore,
            inspectedSessions: Array.from(inspectedSessions),
            updatedAt: new Date().toISOString(),
          })
        );
      } catch {}
    }
    setCurrentBatchIndex(batchNum);
    if (activeDoctor) {
      try {
        localStorage.setItem(`nktt_active_batch_${activeDoctor.id}`, String(batchNum));
      } catch {}
    }
  };

  // Main "Lưu" button handler for the entire batch
  const handleSaveBatch = () => {
    if (!activeDoctor || batchCases.length === 0) return;

    // 1. Commit ca hiện tại nếu đang mở
    if (activeCase) {
      handleSaveAnnotation();
    }

    // 2. Kiểm tra tất cả 10 ca trong gói đã được bác sĩ bấm xác nhận
    const unconfirmed = batchCases.filter((c) => !confirmedCaseIds.has(c.case_id));
    if (unconfirmed.length > 0) {
      alert(
        `Gói ${currentBatchIndex} còn ${unconfirmed.length}/10 ca chưa được Bác sĩ bấm nút xác nhận (ví dụ ca: ${unconfirmed[0].case_id}).\n\nBác sĩ vui lòng rà soát hồ sơ và bấm nút xác nhận cho đủ cả 10 ca trước khi Lưu gói.`
      );
      return;
    }

    // Đã xác nhận đủ 10 ca -> thực hiện lưu và mở khóa gói tiếp theo
    executeBatchSaveAndUnlock();
  };

  // Execute batch save and unlock next batch
  const executeBatchSaveAndUnlock = async () => {
    setShowQualityWarning(false);
    if (!activeDoctor || batchCases.length === 0) return;

    // Chuẩn hóa mã thư mục bác sĩ (BS01 .. BS05)
    const doctorFolder = (
      activeDoctor.folderCode ||
      (activeDoctor.id === "bs_1"
        ? "BS01"
        : activeDoctor.id === "bs_2"
        ? "BS02"
        : activeDoctor.id === "bs_3"
        ? "BS03"
        : activeDoctor.id === "bs_4"
        ? "BS04"
        : "BS05")
    ).toUpperCase();

    // 1. Thu thập lượt thoại đã hiệu chỉnh dùng chung của bác sĩ
    let sharedTurnsForDoctor: Record<string, string> = {};
    try {
      const rawShared = localStorage.getItem(`nktt_shared_turns_v5_${activeDoctor.id}`);
      if (rawShared) sharedTurnsForDoctor = JSON.parse(rawShared);
    } catch {}

    // 2. Xây dựng cấu trúc dữ liệu đầy đủ text và trực quan cho từng ca trong Gói
    const casesDetailed = batchCases.map((c) => {
      const rec = annotationsMap[c.case_id];
      const famKey = c.category?.primary_family || "";
      const catMeta = FAMILY_FRIENDLY_NAMES[famKey] || {
        label: "Kiến thức nha khoa đại cương",
        desc: "Không yêu cầu xét tiền sử cá nhân",
      };

      // Tìm timeline của bệnh nhân từ cache
      const userTimeline = cachedTimelinesMap?.get(c.user_id) || (c.user_id === activeCase?.user_id ? timeline : null);
      const dialogueSessions = (userTimeline?.sessions || []).map((s) => ({
        session_number: s.session_number,
        session_timestamp: s.session_timestamp || "",
        turns: (s.turns || []).map((t) => {
          const editedText = sharedTurnsForDoctor[t.turn_id] || t.text;
          const wasTurnEdited = editedText.trim() !== t.text.trim();
          return {
            turn_id: t.turn_id,
            speaker: t.speaker === "PATIENT" || t.speaker === "USER" ? "Người hỏi" : "Bác sĩ / Trợ lý",
            original_text: t.text,
            final_text: editedText,
            was_edited: wasTurnEdited,
          };
        }),
      }));

      const finalQuery = rec?.edited_query || c.current_query || "";
      const wasQueryEdited = finalQuery.trim() !== (c.current_query || "").trim();

      const verdictCode = rec?.verdict || "APPROVED";
      const verdictLabel =
        verdictCode === "APPROVED"
          ? "Đạt chuẩn lâm sàng"
          : verdictCode === "EDITED"
          ? "Hiệu chỉnh câu từ"
          : "Cần lưu ý thêm";

      return {
        case_id: c.case_id,
        user_id: c.user_id,
        checkpoint: c.metadata?.checkpoint || "Q1",
        category: {
          primary_family: famKey,
          vietnamese_name: catMeta.label,
          description: catMeta.desc,
        },
        user_query: {
          original_text: c.current_query || "",
          final_text: finalQuery,
          was_edited: wasQueryEdited,
          change_percent: wasQueryEdited ? calculateQueryChangePercent(c.current_query || "", finalQuery) : 0,
        },
        clinical_appraisal: {
          verdict: verdictCode,
          verdict_label: verdictLabel,
          clinical_notes: rec?.clinical_notes || "",
          checklists: {
            history_correct: true,
            safety_compliant: true,
            clinical_grounded: true,
          },
          all_checklists_passed: true,
          all_sessions_inspected: true,
        },
        dialogue_history: dialogueSessions,
        clinical_factors: rec?.factors && rec.factors.length > 0 ? rec.factors : c.targets?.factors || [],
        memory_events: rec?.memory_events || c.targets?.memory_events || {
          relevant_event_ids: [],
          stale_event_ids: [],
          forbidden_event_ids: [],
        },
        annotated_by: activeDoctor.name,
        annotated_at: rec?.updated_at || new Date().toISOString(),
      };
    });

    const batchData = {
      batch_meta: {
        doctor_folder: doctorFolder,
        doctor_id: activeDoctor.id,
        doctor_name: activeDoctor.name,
        batch_index: currentBatchIndex,
        batch_name: `Gói ${currentBatchIndex}`,
        case_range: `${batchCases[0]?.case_id} - ${batchCases[batchCases.length - 1]?.case_id}`,
        total_cases: batchCases.length,
        confirmed_cases_count: batchCases.length,
        saved_at: new Date().toISOString(),
        format_version: "v5_full_text",
      },
      cases: casesDetailed,
    };

    // 3. Gọi API lưu trực tiếp vào ổ cứng server Next.js (thư mục annotations/BS0X/batch_X.json)
    try {
      await fetch("/api/save-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctorFolder,
          batchIndex: currentBatchIndex,
          data: batchData,
        }),
      });
    } catch (e) {
      console.warn("Loi khi goi API save-batch:", e);
    }

    // 4. Kích hoạt tải tệp JSON về máy tính của bác sĩ để dự phòng
    try {
      const jsonStr = JSON.stringify(batchData, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${doctorFolder}_batch_${currentBatchIndex}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Loi khi tai file batch:", e);
    }

    // 5. Đánh dấu gói đã hoàn thành
    const nextCompleted = Array.from(new Set([...completedBatches, currentBatchIndex]));
    setCompletedBatches(nextCompleted);
    try {
      localStorage.setItem(`nktt_completed_batches_${activeDoctor.id}`, JSON.stringify(nextCompleted));
    } catch {}

    setSaveMessage({
      text: `Đã lưu thành công Gói ${currentBatchIndex} vào thư mục annotations/${doctorFolder}/batch_${currentBatchIndex}.json và tải tệp về máy!`,
      isError: false,
    });

    alert(
      `Đã lưu thành công toàn bộ Gói ${currentBatchIndex}!\n\n` +
      `• Đã ghi tệp hệ thống: annotations/${doctorFolder}/batch_${currentBatchIndex}.json\n` +
      `• Trình duyệt đã tải xuống: ${doctorFolder}_batch_${currentBatchIndex}.json\n\n` +
      `Gói ${currentBatchIndex < 10 ? currentBatchIndex + 1 : ""} đã được mở khóa để Bác sĩ tiếp tục làm việc.`
    );

    // Chuyển sang gói tiếp theo nếu có
    if (currentBatchIndex < 10) {
      const nextBatch = currentBatchIndex + 1;
      setCurrentBatchIndex(nextBatch);
      const nextBatchCases = doctorCases.slice((nextBatch - 1) * 10, nextBatch * 10);
      if (nextBatchCases.length > 0) {
        setSelectedCaseId(nextBatchCases[0].case_id);
      }
    } else {
      alert(`Chúc mừng Bác sĩ ${activeDoctor.name}! Bạn đã hoàn thành toàn bộ 10 gói (100 ca) được phân công.`);
    }
  };

  // Export JSONL
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
    a.download = `expert_annotations_${activeDoctor?.id || "doctor"}.jsonl`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Doctor selection handler from login modal -> triggers Rules Modal
  const handleDoctorSelected = (doc: DoctorProfile) => {
    setPendingDoctor(doc);
    setShowDoctorModal(false);
    setShowRulesModal(true);
  };

  // Confirmation of Clinical Rules -> transitions to Example Comparison Modal
  const handleAcceptRules = () => {
    if (pendingDoctor) {
      setActiveDoctor(pendingDoctor);
      setAnnotator(pendingDoctor.name);
      try {
        sessionStorage.setItem(
          "nktt_active_doctor_session",
          JSON.stringify({
            id: pendingDoctor.id,
            name: pendingDoctor.name,
            loggedInAt: new Date().toISOString(),
          })
        );
      } catch {}
    }
    setShowRulesModal(false);
    setShowExampleModal(true);
  };

  const currentSession =
    timeline && timeline.sessions && timeline.sessions[activeSessionIndex]
      ? timeline.sessions[activeSessionIndex]
      : null;

  const allEvidenceSessionNumbers = useMemo<number[]>(() => {
    if (!activeCase) return [];
    const nums = new Set<number>();

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

    return Array.from(nums).sort((a, b) => a - b);
  }, [activeCase, events]);

  const getEvidenceSessionListForFactor = (factorId: string) => {
    if (!activeCase || !timeline) return [];

    const snapshot = activeCase.targets?.state_snapshots?.find((s) => s.factor_id === factorId);
    const eventIds = snapshot?.supporting_event_ids || [];

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

  const totalDoctorConfirmedCount = useMemo(() => {
    if (doctorCases.length === 0) return 0;
    return doctorCases.filter((c) => confirmedCaseIds.has(c.case_id)).length;
  }, [doctorCases, confirmedCaseIds]);


  return (
    <div className={styles.container}>
      {/* Top Header - Streamlined for Doctor Focus */}
      <header className={styles.topBar}>
        <div className={styles.titleArea}>
          <h1 className={styles.titleMain}>Hệ thống Thẩm định Lâm sàng Chuyên khoa</h1>
          <p className={styles.titleSub}>
            Đánh giá chuyên môn hồ sơ bệnh án và chất lượng tư vấn Răng Hàm Mặt
          </p>
        </div>

            <div className={styles.topActions}>
              {/* Doctor Profile Badge */}
              <div className={styles.doctorProfileBadge}>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                </svg>
                <span className={styles.doctorProfileName}>
                  {activeDoctor?.name || "Chưa chọn BS"}
                </span>
                <span className={styles.doctorProfileQuota}>
                  ({activeDoctor?.caseRangeLabel || "100 ca"})
                </span>
              </div>



              <span className={styles.statsBadge}>
                Tiến độ: {totalDoctorConfirmedCount}/100 ca ({completedBatches.length}/10 gói hoàn tất)
              </span>

              {/* Clinical Rules Button */}
              <button
                type="button"
                className={styles.rulesBtn}
                onClick={() => setShowRulesModal(true)}
                title="Xem lại 5 nguyên tắc và cam kết thẩm định lâm sàng"
              >
                Quy chuẩn thẩm định
              </button>

              {/* Example Comparison Button */}
              <button
                type="button"
                className={styles.exampleModalBtn}
                onClick={() => setShowExampleModal(true)}
                title="Xem bảng mẫu đối chiếu hồ sơ trước và sau khi thẩm định"
              >
                Mẫu ví dụ đối chiếu
              </button>

              {/* Primary "Lưu" Button - Locked until all 10 cases in current batch are confirmed */}
              <button
                type="button"
                className={[
                  styles.saveMainBtn,
                  isCurrentBatchFullyConfirmed ? styles.saveMainBtnReady : styles.saveMainBtnLocked,
                ].join(" ")}
                onClick={handleSaveBatch}
                disabled={!isCurrentBatchFullyConfirmed}
                title={
                  !isCurrentBatchFullyConfirmed
                    ? `Cần xác nhận đủ 10/10 ca trong Gói ${currentBatchIndex} để mở khóa nút Lưu (Hiện tại: ${currentBatchConfirmedCount}/10 ca). Hệ thống đang tự động lưu nháp liên tục.`
                    : `Lưu hoàn tất Gói ${currentBatchIndex} và mở khóa gói tiếp theo`
                }
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {isCurrentBatchFullyConfirmed ? (
                    <>
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                      <polyline points="17 21 17 13 7 13 7 21" />
                      <polyline points="7 3 7 8 15 8" />
                    </>
                  ) : (
                    <>
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </>
                  )}
                </svg>
                <span>
                  {isCurrentBatchFullyConfirmed
                    ? `Lưu Gói ${currentBatchIndex}`
                    : `Lưu gói (${currentBatchConfirmedCount}/10 ca)`}
                </span>
              </button>
            </div>
          </header>

          {/* Batch Navigation Bar (10 batches, 10 cases each) */}
          <div className={styles.batchNavContainer}>
            <div className={styles.batchLabelArea}>
              <span className={styles.batchTitle}>
                Phân gói làm việc ({activeDoctor?.name || "Bác sĩ"} - {activeDoctor?.caseRangeLabel || "100 ca"}):
              </span>
            </div>
            <div className={styles.batchPillList}>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((batchNum) => {
                const isActive = batchNum === currentBatchIndex;
                const isCompleted = completedBatches.includes(batchNum);
                const isUnlocked =
                  batchNum === 1 || completedBatches.includes(batchNum - 1) || isCompleted;
                return (
                  <button
                    key={batchNum}
                    type="button"
                    disabled={!isUnlocked}
                    className={[
                      styles.batchPill,
                      isActive ? styles.batchPillActive : "",
                      isCompleted ? styles.batchPillCompleted : "",
                      !isUnlocked ? styles.batchPillLocked : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => handleSelectBatch(batchNum, isUnlocked)}
                    title={
                      !isUnlocked
                        ? `Cần hoàn thành và bấm "Lưu" ở Gói ${batchNum - 1} để mở khóa Gói ${batchNum}`
                        : `Gói ${batchNum}: Ca ${(batchNum - 1) * 10 + 1} - ${batchNum * 10}`
                    }
                  >
                    {isCompleted && (
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                    {!isUnlocked && (
                      <svg
                        width="11"
                        height="11"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    )}
                    <span>
                      Gói {batchNum} ({isCompleted ? "Đã lưu" : "10 ca"})
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Batch 10/10 Cases Completed Banner Notification */}
          {isCurrentBatchFullyConfirmed && !completedBatches.includes(currentBatchIndex) && (
            <div className={styles.batchReadyAlert}>
              <div className={styles.batchReadyAlertContent}>
                <span className={styles.batchReadyAlertBadge}>
                  Gói {currentBatchIndex} đã hoàn tất 10/10 ca
                </span>
                <span className={styles.batchReadyAlertText}>
                  Tất cả 10 ca bệnh trong Gói {currentBatchIndex} đã được Bác sĩ thẩm định và xác nhận. Nút <strong>Lưu Gói {currentBatchIndex}</strong> trên góc phải đã được mở khóa. Bác sĩ hãy bấm nút Lưu để hoàn tất và mở khóa Gói tiếp theo.
                </span>
              </div>
              <button
                type="button"
                className={styles.batchReadyAlertBtn}
                onClick={handleSaveBatch}
              >
                Bấm Lưu Gói {currentBatchIndex} ngay
              </button>
            </div>
          )}

          {/* Main Workspace: 3 Columns Focused on Clinical Review */}
          <div className={styles.workspace}>
            {/* Left Column: Cases of the current batch */}
            <section className={styles.sidebar} aria-label="Danh sách ca bệnh trong gói">
              <div className={styles.filterSection}>
                <input
                  type="text"
                  placeholder="Tìm trong 10 ca của gói này..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={styles.searchInput}
                />
              </div>

              <div className={styles.caseList}>
                {loadingList ? (
                  <p className={styles.emptyPlaceholder}>Đang tải danh sách ca bệnh...</p>
                ) : filteredCases.length === 0 ? (
                  <p className={styles.emptyPlaceholder}>Không tìm thấy ca nào trong gói này</p>
                ) : (
                  filteredCases.map((c) => {
                    const globalIndex = allCases.findIndex((item) => item.case_id === c.case_id) + 1;
                    const doctorCaseIndex = doctorCases.findIndex((item) => item.case_id === c.case_id) + 1;
                    const isActive = c.case_id === selectedCaseId;
                    const friendlyFamily =
                      FAMILY_FRIENDLY_NAMES[c.category?.primary_family]?.label ||
                      c.category?.primary_family;
                    const isConfirmed = confirmedCaseIds.has(c.case_id);

                    // Kiểm tra trạng thái khóa tuần tự: Ca 1 luôn mở, Ca n mở khi Ca n-1 đã xác nhận
                    const caseIdxInDoctor = doctorCaseIndex - 1;
                    const isUnlocked =
                      caseIdxInDoctor === 0 ||
                      (caseIdxInDoctor > 0 && confirmedCaseIds.has(doctorCases[caseIdxInDoctor - 1]?.case_id));

                    return (
                      <button
                        key={c.case_id}
                        type="button"
                        className={[
                          styles.caseCard,
                          isActive ? styles.caseCardActive : "",
                          !isUnlocked ? styles.caseCardLocked : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        onClick={() => handleSelectCase(c.case_id)}
                        title={
                          !isUnlocked
                            ? `Ca ${doctorCaseIndex} đang khóa. Cần hoàn thành và xác nhận Ca ${doctorCaseIndex - 1} trước.`
                            : `Ca ${doctorCaseIndex}: ${c.current_query}`
                        }
                      >
                        <div className={styles.caseCardHeader}>
                          <span className={styles.caseId}>
                            Ca {doctorCaseIndex}/100
                          </span>
                          <span className={styles.caseCheckpoint}>
                            Mã: #{c.user_id.replace("VL500_U", "NH-")}
                          </span>
                        </div>
                        <div className={styles.caseQueryPreview}>{c.current_query}</div>
                        <div className={styles.caseCardFooter}>
                          <span className={styles.familyTag} title={c.category?.primary_family}>
                            {friendlyFamily}
                          </span>
                          {isConfirmed ? (
                            <span className={[styles.verdictBadge, styles.verdictApproved].join(" ")}>
                              Đã xác nhận
                            </span>
                          ) : !isUnlocked ? (
                            <span className={styles.caseLockedTag}>
                              Chưa mở
                            </span>
                          ) : null}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              <div className={styles.pagination}>
                <span>
                  Gói {currentBatchIndex}/10 ({batchCases.length} ca) - {activeDoctor?.name || "Bác sĩ"}
                </span>
              </div>
            </section>

            {/* Center Column: Query Editor & Dialogue Timeline */}
            <section className={styles.mainContent} aria-label="Nội dung hội thoại">
              {loadingDetail ? (
                <div className={styles.emptyPlaceholder}>Đang nạp dữ liệu hồ sơ ca bệnh...</div>
              ) : !activeCase ? (
                <div className={styles.emptyPlaceholder}>Vui lòng chọn một ca bệnh ở cột bên trái để thẩm định</div>
              ) : (
                <>
                  {/* Question Audit & Editor Card */}
                  <div className={styles.queryCard}>
                    <div className={styles.queryCardHeader}>
                      <div className={styles.queryTitleRow}>
                        <h2 className={styles.sectionTitle} style={{ margin: 0 }}>
                          Ca {doctorCases.findIndex((c) => c.case_id === activeCase.case_id) + 1} / 100: Câu hỏi của Người hỏi
                        </h2>
                        {activeCase.user_id && (
                          <span
                            style={{
                              fontSize: "0.75rem",
                              color: "#0f766e",
                              backgroundColor: "#f0fdfa",
                              padding: "0.15rem 0.5rem",
                              borderRadius: "4px",
                              border: "1px solid #ccfbf1",
                              fontWeight: 600,
                            }}
                            title={`Mã hồ sơ Người hỏi: ${activeCase.user_id}`}
                          >
                            Mã: #{activeCase.user_id.replace("VL500_U", "NH-")}
                          </span>
                        )}
                        {activeCase.category?.primary_family && (
                          <span
                            className={styles.familyTag}
                            style={{ fontSize: "0.72rem", padding: "0.15rem 0.45rem" }}
                          >
                            {FAMILY_FRIENDLY_NAMES[activeCase.category.primary_family]?.label || activeCase.category.primary_family}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Topic Box (Fixed Clinical Context) */}
                    <div className={styles.originalQueryBox}>
                      <span className={styles.originalQueryLabel}>
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="16" x2="12" y2="12" />
                          <line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                        Chủ đề:
                      </span>
                      <p className={styles.originalQueryText}>{activeCase.current_query}</p>
                    </div>
                  </div>

                  {/* Dialogue Timeline */}
                  <div className={styles.timelineCard}>
                    <div className={styles.timelineHeader}>
                      <div className={styles.timelineTitleGroup}>
                        <h2 className={styles.sectionTitle}>
                          Lịch sử cuộc trò chuyện:
                        </h2>
                      </div>
                      <div className={styles.sessionPills}>
                        {visibleSessions && visibleSessions.length > 0 ? (
                          visibleSessions.map((s) => {
                            const actualIdx = timeline?.sessions?.findIndex(
                              (sess) => sess.session_id === s.session_id
                            ) ?? -1;
                            const isSelected = actualIdx === activeSessionIndex;
                            const isInspected = inspectedSessions.has(s.session_number);

                            return (
                              <button
                                key={s.session_id}
                                type="button"
                                className={[
                                  styles.sessionPill,
                                  isSelected ? styles.sessionPillActive : "",
                                  isInspected && !isSelected ? styles.sessionPillCompleted : "",
                                ]
                                  .filter(Boolean)
                                  .join(" ")}
                                onClick={() => {
                                  if (actualIdx >= 0) handleSelectSession(actualIdx);
                                }}
                                title={`Lần ${s.session_number}${
                                  isInspected ? " (Đã xem)" : " (Chưa xem - nhấp để xem)"
                                }`}
                              >
                                <span>Lần {s.session_number}</span>
                              </button>
                            );
                          })
                        ) : (
                          <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
                            Ca độc lập, không có hồ sơ khám trước đó
                          </span>
                        )}

                        {visibleSessions.length > 1 && (
                          <span
                            style={{
                              fontSize: "0.7rem",
                              fontWeight: 600,
                              marginLeft: "auto",
                              padding: "0.15rem 0.45rem",
                              borderRadius: "4px",
                              backgroundColor: hasInspectedAllSessions ? "#ecfdf5" : "#fffbeb",
                              color: hasInspectedAllSessions ? "#065f46" : "#b45309",
                              border: `1px solid ${hasInspectedAllSessions ? "#a7f3d0" : "#fde68a"}`,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {hasInspectedAllSessions
                              ? `Đã xem đủ ${visibleSessions.length}/${visibleSessions.length} lần`
                              : `Đã xem ${inspectedCount}/${visibleSessions.length} lần (Cần xem hết)`}
                          </span>
                        )}
                      </div>
                    </div>

                    <div id="clinical-chat-area" className={styles.chatArea}>
                      {!currentSession ? (
                        <div className={styles.emptyPlaceholder}>
                          Ca bệnh này là câu hỏi độc lập, chưa ghi nhận hồ sơ khám trước đó
                        </div>
                      ) : (
                        <div className={styles.sessionChatContainer}>
                          <div className={styles.sessionChatHeader}>
                            <span>
                              Chi tiết Lần {currentSession.session_number}
                              {currentSession.session_timestamp &&
                                ` - Ngày: ${new Date(currentSession.session_timestamp).toLocaleDateString("vi-VN")}`}
                            </span>
                            <span style={{ fontWeight: "normal", color: "var(--color-text-muted)" }}>
                              (Gồm {currentSession.turns.length} lượt trao đổi)
                            </span>
                          </div>

                          <div className={styles.turnsList}>
                            {currentSession.turns.map((turn) => {
                              const isDoctor =
                                turn.speaker?.toLowerCase().includes("doctor") ||
                                turn.speaker?.toLowerCase().includes("assistant");
                              const currentTurnText =
                                editedTurns[turn.turn_id] !== undefined
                                  ? editedTurns[turn.turn_id]
                                  : turn.text;
                              const isModified =
                                editedTurns[turn.turn_id] !== undefined &&
                                editedTurns[turn.turn_id] !== turn.text;

                              return (
                                <div
                                  key={turn.turn_id}
                                  className={[
                                    styles.chatBubbleWrapper,
                                    isDoctor ? styles.bubbleWrapperRight : styles.bubbleWrapperLeft,
                                  ].join(" ")}
                                >
                                  <div
                                    className={[
                                      styles.chatBubble,
                                      isDoctor ? styles.bubbleDoctor : styles.bubblePatient,
                                      isModified ? styles.chatBubbleEdited : "",
                                    ]
                                      .filter(Boolean)
                                      .join(" ")}
                                  >
                                    <div className={styles.bubbleHeader}>
                                      <div className={styles.bubbleSpeakerRow}>
                                        <span className={styles.bubbleSpeaker}>
                                          {isDoctor ? "Bác sĩ" : "Người hỏi"}
                                        </span>
                                        <span
                                          className={styles.pencilHint}
                                          title="Bác sĩ có thể nhấp trực tiếp vào ô chữ bên dưới để chỉnh sửa"
                                        >
                                          <svg
                                            width="11"
                                            height="11"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            className={styles.pencilIcon}
                                          >
                                            <path d="M12 20h9" />
                                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                                          </svg>
                                        </span>
                                        {isModified && (
                                          <span
                                            className={styles.modifiedTag}
                                            title="Nội dung đã được chỉnh sửa"
                                          >
                                            Đã sửa
                                          </span>
                                        )}
                                      </div>
                                      <div className={styles.bubbleHeaderRight}>
                                        {isModified && (
                                          <button
                                            type="button"
                                            className={styles.bubbleRevertBtn}
                                            onClick={() => handleTurnChange(turn.turn_id, turn.text)}
                                            title="Khôi phục nguyên văn ban đầu"
                                          >
                                            Khôi phục
                                          </button>
                                        )}
                                        {turn.turn_timestamp ? (
                                          <span className={styles.turnBadgeSubtle}>
                                            {new Date(turn.turn_timestamp).toLocaleTimeString("vi-VN", {
                                              hour: "2-digit",
                                              minute: "2-digit",
                                            })}
                                          </span>
                                        ) : null}
                                      </div>
                                    </div>
                                    <AutoExpandingTextarea
                                      value={currentTurnText}
                                      onChange={(e) => handleTurnChange(turn.turn_id, e.target.value)}
                                      className={styles.bubbleTextarea}
                                      placeholder="Nội dung câu thoại..."
                                      title="Nhấp để chỉnh sửa trực tiếp nội dung lượt thoại này"
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </section>

            {/* Right Column: Clinical Judgment */}
            <section className={styles.rightSidebar} aria-label="Biện giải lâm sàng và xác nhận">
              {/* Review Save Section */}
              <div className={styles.reviewSection}>
                <div className={styles.reviewSectionHeader}>
                  <div className={styles.reviewTitleRow}>
                    <h2 className={styles.sectionTitle}>
                      Xác nhận & Ghi chú
                    </h2>
                    {activeCase && confirmedCaseIds.has(activeCase.case_id) ? (
                      <span className={styles.confirmedBadge}>
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Đã xác nhận
                      </span>
                    ) : (
                      <span className={styles.pendingBadge}>Chưa xác nhận</span>
                    )}
                  </div>
                  <p className={styles.sectionSubtitle}>
                    Ghi chú điểm lưu ý lâm sàng (nếu có) và xác nhận ca
                  </p>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                    flex: 1,
                    minHeight: 0,
                    justifyContent: "space-between",
                  }}
                >
                  {/* Ghi chú bổ sung (tùy chọn) */}
                  <div className={styles.textareaWrapper}>
                    <div className={styles.bubbleHeaderRow}>
                      <div className={styles.checklistTitle}>Ghi chú bổ sung (tùy chọn):</div>
                      <div className={styles.bubbleGroup}>
                        <button
                          type="button"
                          className={styles.bubbleTag}
                          onClick={() => setShowExampleModal(true)}
                          title="Mở bảng mẫu đối chiếu hồ sơ trước và sau khi thẩm định"
                        >
                          Bảng mẫu Trước / Sau
                        </button>
                      </div>
                    </div>

                    <textarea
                      value={clinicalNotes}
                      onChange={(e) => setClinicalNotes(e.target.value)}
                      placeholder="Nhập ghi chú thêm nếu có (không bắt buộc)..."
                      className={styles.notesTextarea}
                      rows={3}
                      spellCheck={false}
                    />
                    <div className={styles.charCountRow}>
                      <span className={styles.charCountValid}>
                        {clinicalNotes.trim().length > 0
                          ? `Ghi chú: ${clinicalNotes.trim().length} ký tự`
                          : "Không bắt buộc"}
                      </span>
                      <button
                        type="button"
                        onClick={handleResetCurrentCaseToV5}
                        className={styles.resetCaseBtn}
                        title="Xóa trắng bản nháp để tự nhập nhận xét mới từ đầu"
                      >
                        Làm mới ca này
                      </button>
                    </div>
                  </div>

                  {/* Primary Action Button */}
                  <button
                    type="button"
                    className={[
                      styles.saveBtn,
                      activeCase && confirmedCaseIds.has(activeCase.case_id)
                        ? styles.saveBtnConfirmed
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    disabled={saving}
                    onClick={handleConfirmAndNextCase}
                    title="Xác nhận thẩm định ca này và chuyển sang ca tiếp theo"
                  >
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>
                      {saving
                        ? "Đang lưu..."
                        : currentCaseIndexInBatch < batchCases.length - 1
                        ? `Xác nhận & Sang Ca ${currentCaseIndexInDoctor + 2} >`
                        : `Xác nhận Ca ${currentCaseIndexInDoctor + 1} (Hoàn tất gói)`}
                    </span>
                  </button>
                </div>

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
            </section>
          </div>




          {/* Doctor Selection & Authentication Portal */}
          <DoctorLoginModal
            isOpen={showDoctorModal}
            canClose={Boolean(activeDoctor)}
            onClose={() => setShowDoctorModal(false)}
            onSelectDoctor={handleDoctorSelected}
            activeDoctorId={activeDoctor?.id}
          />

          {/* Clinical Rules & Agreement Modal - Displays right after password */}
          <ClinicalRulesModal
            isOpen={showRulesModal}
            doctorName={pendingDoctor?.name || activeDoctor?.name}
            canDismiss={Boolean(activeDoctor && !pendingDoctor)}
            onClose={() => {
              setShowRulesModal(false);
              setPendingDoctor(null);
            }}
            onAccept={handleAcceptRules}
            acceptButtonText={pendingDoctor ? "Tiếp tục: Xem bảng ví dụ mẫu" : "Xem bảng ví dụ mẫu"}
          />

          {/* Quality Warning Modal for Superficial Evaluation */}
          <QualityWarningModal
            isOpen={showQualityWarning}
            batchNumber={currentBatchIndex}
            findings={qualityFindings}
            onBack={() => setShowQualityWarning(false)}
            onConfirmSave={executeBatchSaveAndUnlock}
          />

          {/* Example Comparison Modal - Before and After Evaluation Tabs */}
          <ExampleComparisonModal
            isOpen={showExampleModal}
            onClose={() => {
              setShowExampleModal(false);
              setPendingDoctor(null);
            }}
            dismissText={pendingDoctor ? "Bắt đầu thẩm định" : "Đóng cửa sổ"}
          />


    </div>
  );
}
