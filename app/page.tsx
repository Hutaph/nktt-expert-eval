"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import styles from "./LabelData.module.css";
import ClinicalLikertEvalView from "./components/ClinicalLikertEvalView";
import DriveSyncModal from "./components/DriveSyncModal";
import DoctorLoginModal, {
  DOCTORS_LIST,
  DoctorProfile,
} from "./components/DoctorLoginModal";
import QualityWarningModal from "./components/QualityWarningModal";
import ClinicalRulesModal from "./components/ClinicalRulesModal";
import {
  getDriveConfig,
  syncExpertAnnotationsToDrive,
  DriveConfig,
} from "./lib/driveSync";

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
      style={{ overflow: "hidden" }}
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
  currentCaseId: string,
  batchCases: CaseDetail[],
  annotationsMap: Record<string, ExpertAnnotationRecord>,
  isBigQueryEdit: boolean
): ClinicalNotesQuality {
  const trimmed = notes.trim();
  const errors: string[] = [];
  const charCount = trimmed.length;

  if (charCount < 20) {
    errors.push("Biện giải lâm sàng phải có tối thiểu 20 ký tự.");
  }

  // 1. Check spam repetition
  const hasSpamRepeat = /(.)\1{4,}/i.test(trimmed);
  if (hasSpamRepeat) {
    errors.push("Phát hiện ký tự lặp vô nghĩa (spam). Vui lòng nhập nhận xét thực tế.");
  }

  // 2. Word count & diversity
  const rawWords = trimmed.toLowerCase().split(/\s+/).filter(Boolean);
  const wordCount = rawWords.length;
  const uniqueWordsSet = new Set(rawWords);
  const uniqueWords = uniqueWordsSet.size;

  if (charCount >= 20 && wordCount < 5) {
    errors.push("Biện giải phải có tối thiểu 5 từ diễn đạt câu hoàn chỉnh.");
  }
  if (wordCount >= 5 && uniqueWords < 4) {
    errors.push("Từ ngữ nhận xét bị lặp lại quá nhiều. Vui lòng nêu rõ lý do lâm sàng.");
  }

  // 3. Vietnamese accent check
  const hasAccent = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i.test(trimmed);
  if (charCount >= 10 && !hasAccent) {
    errors.push("Nhận xét bắt buộc phải gõ Tiếng Việt có dấu đầy đủ, đúng ngữ pháp y văn.");
  }

  // 4. Domain keyword check
  const lower = trimmed.toLowerCase();
  const hasDomainKeywords = CLINICAL_DOMAIN_KEYWORDS.some((kw) => lower.includes(kw));
  if (charCount >= 20 && !hasDomainKeywords) {
    errors.push(
      "Nhận xét phải chứa thuật ngữ chuyên ngành Răng Hàm Mặt hoặc căn cứ y khoa (ví dụ: răng, nướu, tiền sử, lâm sàng, phác đồ, an toàn, đối chứng...)."
    );
  }

  // 5. Cross-case similarity in current batch
  let duplicateWithCaseId: string | undefined;
  let duplicateSimilarity: number | undefined;

  if (charCount >= 20 && batchCases.length > 0) {
    const curWords = new Set(rawWords.filter((w) => w.length > 2));
    if (curWords.size >= 3) {
      for (const otherCase of batchCases) {
        if (otherCase.case_id === currentCaseId) continue;
        const otherRec = annotationsMap[otherCase.case_id];
        if (!otherRec || !otherRec.clinical_notes) continue;
        const otherWords = new Set(
          otherRec.clinical_notes.toLowerCase().split(/\s+/).filter((w) => w.length > 2)
        );
        let intersection = 0;
        curWords.forEach((w) => {
          if (otherWords.has(w)) intersection++;
        });
        const union = new Set([...curWords, ...otherWords]).size;
        const sim = union > 0 ? intersection / union : 0;
        if (sim >= 0.7) {
          duplicateWithCaseId = otherCase.case_id;
          duplicateSimilarity = Math.round(sim * 100);
          errors.push(
            `Nhận xét này trùng lặp ${duplicateSimilarity}% với ca ${otherCase.case_id}. Bác sĩ vui lòng biện giải riêng theo tình huống cụ thể của ca này.`
          );
          break;
        }
      }
    }
  }

  // 6. If big query edit (>50% change), require explanation in notes
  if (isBigQueryEdit && charCount < 35) {
    errors.push(
      "Vì câu hỏi có sự thay đổi lớn (>50%), Bác sĩ cần ghi chú chi tiết tối thiểu 35 ký tự giải trình lý do chuyên môn."
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    charCount,
    wordCount,
    uniqueWords,
    hasAccent,
    hasDomainKeywords,
    hasSpamRepeat,
    duplicateWithCaseId,
    duplicateSimilarity,
  };
}

const STORAGE_KEY = "nktt_expert_annotations_v3";

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
    label: "Kiến thức nha khoa đại cương",
    desc: "Câu hỏi đại cương không đòi hỏi truy hồi tiền sử cá nhân",
  },
  UPDATE_SUPERSESSION: {
    label: "Cập nhật thay đổi theo thời gian",
    desc: "Bệnh nhân có biến chuyển mới (đổi khí cụ, tháo niềng, hoàn tất thủ thuật)",
  },
  EXPLICIT_STABLE_PERSONALIZATION: {
    label: "Tiền sử bệnh học cố định",
    desc: "Thông tin cố định lâu dài: cơ địa, dị ứng thuốc, răng đã can thiệp",
  },
  LATENT_EVIDENCE_CONDITIONED_FACTOR: {
    label: "Suy luận từ diễn tiến lâm sàng",
    desc: "Dữ kiện ẩn trong các đợt khám trước, cần liên kết phác đồ",
  },
  MISSING_FACTOR_UNKNOWN: {
    label: "Thiếu dữ kiện lâm sàng (Cần hỏi lại)",
    desc: "Hồ sơ chưa có thông tin, bác sĩ cần yêu cầu người bệnh cung cấp thêm",
  },
  MULTI_FACTOR_CROSS_SESSION: {
    label: "Xâu chuỗi đa đợt khám",
    desc: "Tổng hợp thông tin từ nhiều buổi hẹn điều trị trước đây",
  },
  CROSS_SESSION_PERSONALIZATION: {
    label: "Xâu chuỗi đa đợt khám",
    desc: "Tổng hợp thông tin từ nhiều buổi hẹn điều trị trước đây",
  },
  CONFLICT_UNCERTAINTY: {
    label: "Mâu thuẫn hoặc chưa rõ ràng",
    desc: "Có sự bất nhất giữa các lần khám, cần làm rõ lại triệu chứng",
  },
  PROVENANCE_BOUNDARY: {
    label: "Phân định nguồn dữ liệu",
    desc: "Phân biệt rõ lời người bệnh tự kể và kết quả khám trực tiếp của bác sĩ",
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

  const [showGuide, setShowGuide] = useState<boolean>(false);

  // Anti-speedrun & session inspection tracking
  const [readingCountdown, setReadingCountdown] = useState<number>(0);
  const [inspectedSessions, setInspectedSessions] = useState<Set<number>>(new Set());

  // Clinical Verification Checklist
  const [checklistHistory, setChecklistHistory] = useState<boolean>(true);
  const [checklistSafety, setChecklistSafety] = useState<boolean>(true);
  const [checklistCore, setChecklistCore] = useState<boolean>(true);

  // Query editing toggle
  const [isEditingQuery, setIsEditingQuery] = useState<boolean>(false);

  // Google Drive state
  const [showDriveModal, setShowDriveModal] = useState<boolean>(false);
  const [driveConfig, setDriveConfig] = useState<DriveConfig>(getDriveConfig);
  const [syncingDrive, setSyncingDrive] = useState<boolean>(false);
  const [driveNotice, setDriveNotice] = useState<{
    type: "success" | "error" | "info";
    text: string;
    url?: string;
  } | null>(null);

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

    // Load completed batches for this doctor
    try {
      const saved = localStorage.getItem(`nktt_completed_batches_${activeDoctor.id}`);
      if (saved) {
        const list = JSON.parse(saved);
        if (Array.isArray(list)) {
          setCompletedBatches(list);
          // Auto select first incomplete batch
          let foundFirstIncomplete = false;
          for (let b = 1; b <= 10; b++) {
            if (!list.includes(b)) {
              setCurrentBatchIndex(b);
              foundFirstIncomplete = true;
              break;
            }
          }
          if (!foundFirstIncomplete) {
            setCurrentBatchIndex(10);
          }
        }
      } else {
        setCompletedBatches([]);
        setCurrentBatchIndex(1);
      }
    } catch {
      setCompletedBatches([]);
      setCurrentBatchIndex(1);
    }
    setAnnotator(activeDoctor.name);
  }, [activeDoctor]);

  // Load stored annotations on mount
  useEffect(() => {
    let isMounted = true;
    async function initAnnotations() {
      const stored = getStoredAnnotations();
      try {
        const assetBase = getAssetBase();
        const res = await fetch(`${assetBase}/dataset/default_expert_annotations_500.json`);
        if (res.ok) {
          const defaultData = await res.json();
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

  // Auto-select first case of current batch
  useEffect(() => {
    if (batchCases.length > 0) {
      if (!selectedCaseId || !batchCases.some((c) => c.case_id === selectedCaseId)) {
        setSelectedCaseId(batchCases[0].case_id);
      }
    }
  }, [batchCases, selectedCaseId]);

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
          const tRes = await fetch(`${assetBase}/dataset/vident_longmem_500/timelines.jsonl`);
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
          const eRes = await fetch(`${assetBase}/dataset/vident_longmem_500/source_events.jsonl`);
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

        // Find relevant session index
        const upToSession = matchedCase.visible_history?.up_to_session;
        if (uTimeline && uTimeline.sessions && upToSession) {
          const idx = uTimeline.sessions.findIndex((s) => s.session_id === upToSession);
          setActiveSessionIndex(idx >= 0 ? idx : 0);
        } else {
          setActiveSessionIndex(0);
        }

        // Check for local working draft first
        let draftData: any = null;
        if (activeDoctor) {
          try {
            const rawDraft = localStorage.getItem(`nktt_draft_${activeDoctor.id}_${matchedCase.case_id}`);
            if (rawDraft) draftData = JSON.parse(rawDraft);
          } catch {}
        }

        const saved = annotationsMap[matchedCase.case_id];

        if (draftData) {
          // Restore from draft
          setEditedQuery(draftData.editedQuery || matchedCase.current_query || "");
          setClinicalNotes(draftData.clinicalNotes || "");
          setEditedTurns(draftData.editedTurns || {});
          setEditedFactors(
            draftData.editedFactors ||
              (matchedCase.targets?.factors ? JSON.parse(JSON.stringify(matchedCase.targets.factors)) : [])
          );
          setEditedRelevantEvents(draftData.editedRelevantEvents || "");
          setEditedStaleEvents(draftData.editedStaleEvents || "");
          setEditedForbiddenEvents(draftData.editedForbiddenEvents || "");
        } else if (saved) {
          // Restore from saved annotation
          setEditedQuery(saved.edited_query || matchedCase.current_query || "");
          setClinicalNotes(saved.clinical_notes || "");

          const tMap: Record<string, string> = {};
          if (saved.edited_turns) {
            saved.edited_turns.forEach((t) => {
              tMap[t.turn_id] = t.text;
            });
          }
          setEditedTurns(tMap);

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
        } else {
          // Fresh default state
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

  // Reset speedrun countdown and inspected sessions when switching cases
  useEffect(() => {
    if (!selectedCaseId) return;
    const isAlreadyConfirmed = confirmedCaseIds.has(selectedCaseId);
    if (isAlreadyConfirmed) {
      setReadingCountdown(0);
    } else {
      setReadingCountdown(15);
    }
    setInspectedSessions(new Set([0]));
    setIsEditingQuery(false);
  }, [selectedCaseId, confirmedCaseIds]);

  // Reading countdown timer tick
  useEffect(() => {
    if (readingCountdown <= 0) return;
    const timer = setInterval(() => {
      setReadingCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [readingCountdown]);

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

  const hasMultipleSessions = Boolean(timeline && timeline.sessions && timeline.sessions.length > 1);
  const hasInspectedRequiredSessions = !hasMultipleSessions || inspectedSessions.size >= 2;
  const isChecklistComplete = checklistHistory && checklistSafety && checklistCore;

  const canConfirmCase =
    readingCountdown === 0 &&
    hasInspectedRequiredSessions &&
    isChecklistComplete &&
    notesQuality.isValid;

  const handleSelectSession = (idx: number) => {
    setActiveSessionIndex(idx);
    setInspectedSessions((prev) => new Set([...prev, idx]));
  };

  // Real-time Auto-save Draft
  useEffect(() => {
    if (isInitialCaseLoadRef.current || !activeCase || !activeDoctor) return;

    setIsAutoSaving(true);
    const timer = setTimeout(() => {
      try {
        const draftKey = `nktt_draft_${activeDoctor.id}_${activeCase.case_id}`;
        const draftObj = {
          case_id: activeCase.case_id,
          editedQuery,
          clinicalNotes,
          editedTurns,
          editedFactors,
          editedRelevantEvents,
          editedStaleEvents,
          editedForbiddenEvents,
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
    editedQuery,
    clinicalNotes,
    editedTurns,
    editedFactors,
    editedRelevantEvents,
    editedStaleEvents,
    editedForbiddenEvents,
    activeCase,
    activeDoctor,
  ]);

  // Handle Turn edit
  const handleTurnChange = (turnId: string, text: string) => {
    setEditedTurns((prev) => ({
      ...prev,
      [turnId]: text,
    }));
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

  // Save current individual case annotation & register confirmation
  const handleSaveAnnotation = () => {
    if (!activeCase || !activeDoctor) return;

    // Check anti-speedrun
    if (readingCountdown > 0) {
      setSaveMessage({
        text: `Vui lòng dành thời gian thẩm định kỹ hồ sơ ca bệnh (còn ${readingCountdown} giây).`,
        isError: true,
      });
      return;
    }

    // Check session inspection
    if (!hasInspectedRequiredSessions) {
      setSaveMessage({
        text: "Ca bệnh có nhiều lần khám trong quá khứ. Bác sĩ vui lòng bấm xem ít nhất 1 đợt khám khác trước đó để kiểm tra tiền sử.",
        isError: true,
      });
      return;
    }

    // Check checklist
    if (!isChecklistComplete) {
      setSaveMessage({
        text: "Bác sĩ vui lòng đánh dấu xác nhận đầy đủ 3 tiêu chuẩn thẩm định lâm sàng.",
        isError: true,
      });
      return;
    }

    // Check notes quality
    if (!notesQuality.isValid) {
      setSaveMessage({
        text: notesQuality.errors[0] || "Biện giải lâm sàng chưa đạt chuẩn chất lượng.",
        isError: true,
      });
      return;
    }

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

    const record: ExpertAnnotationRecord = {
      case_id: activeCase.case_id,
      user_id: activeCase.user_id,
      verdict: "APPROVED",
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

    saveStoredAnnotation(record);
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

    setSaveMessage({ text: "Đã xác nhận và lưu trữ ca bệnh này thành công!", isError: false });
    setSaving(false);
  };

  // Batch switching handler (checks if unlocked)
  const handleSelectBatch = (batchNum: number, isUnlocked: boolean) => {
    if (!isUnlocked) {
      alert(`Đợt ${batchNum} hiện đang khóa. Bạn cần hoàn thành các ca và bấm "Lưu" ở Đợt ${batchNum - 1} trước.`);
      return;
    }
    // Auto-save current case before switching batch
    if (activeCase && activeDoctor) {
      try {
        const draftKey = `nktt_draft_${activeDoctor.id}_${activeCase.case_id}`;
        localStorage.setItem(
          draftKey,
          JSON.stringify({
            case_id: activeCase.case_id,
            editedQuery,
            clinicalNotes,
            editedTurns,
            editedFactors,
            editedRelevantEvents,
            editedStaleEvents,
            editedForbiddenEvents,
            updatedAt: new Date().toISOString(),
          })
        );
      } catch {}
    }
    setCurrentBatchIndex(batchNum);
  };

  // Main "Lưu" button handler for the entire batch
  const handleSaveBatch = () => {
    if (!activeDoctor || batchCases.length === 0) return;

    // 1. If currently open case has notes and passes quality, commit it
    if (notesQuality.isValid && canConfirmCase) {
      handleSaveAnnotation();
    }

    // 2. Strict check: All 10 cases in current batch must be explicitly confirmed by doctor
    const unconfirmed = batchCases.filter((c) => !confirmedCaseIds.has(c.case_id));
    if (unconfirmed.length > 0) {
      alert(
        `Đợt ${currentBatchIndex} còn ${unconfirmed.length}/10 ca chưa được Bác sĩ bấm nút "Xác nhận thẩm định ca này" (ví dụ ca: ${unconfirmed[0].case_id}).\n\nBác sĩ vui lòng đọc hồ sơ, nhập biện giải lâm sàng và bấm "Xác nhận thẩm định ca này" cho đủ cả 10 ca trước khi Lưu đợt.`
      );
      return;
    }

    // 3. Strict superficial evaluation detection using checkClinicalNotesQuality
    const findings: string[] = [];
    batchCases.forEach((c) => {
      const rec = annotationsMap[c.case_id];
      const note = rec?.clinical_notes?.trim() || "";
      if (!note) {
        findings.push(`Ca ${c.case_id}: Hoàn toàn chưa có biện giải lâm sàng cụ thể.`);
        return;
      }
      const isBigEdit = Boolean(
        rec.edited_query &&
        rec.original_query &&
        calculateQueryChangePercent(rec.original_query, rec.edited_query) > 50
      );
      const quality = checkClinicalNotesQuality(note, c.case_id, batchCases, annotationsMap, isBigEdit);
      if (!quality.isValid) {
        findings.push(`Ca ${c.case_id}: ${quality.errors[0]}`);
      }
    });

    if (findings.length > 0) {
      setQualityFindings(findings);
      setShowQualityWarning(true);
      return;
    }

    // Passed quality check -> proceed to final save and unlock
    executeBatchSaveAndUnlock();
  };

  // Execute batch save and unlock next batch
  const executeBatchSaveAndUnlock = async () => {
    setShowQualityWarning(false);
    if (!activeDoctor) return;

    // Mark current batch as completed
    const nextCompleted = Array.from(new Set([...completedBatches, currentBatchIndex]));
    setCompletedBatches(nextCompleted);
    try {
      localStorage.setItem(`nktt_completed_batches_${activeDoctor.id}`, JSON.stringify(nextCompleted));
    } catch {}

    // Synchronize to Google Drive webhook
    setSyncingDrive(true);
    setDriveNotice({
      type: "info",
      text: `Đang lưu Đợt ${currentBatchIndex} và đồng bộ dữ liệu lên Google Drive...`,
    });

    const stored = getStoredAnnotations();
    const result = await syncExpertAnnotationsToDrive(activeDoctor.name, stored);
    setSyncingDrive(false);

    if (result.ok) {
      setDriveNotice({
        type: "success",
        text: `Đã lưu thành công Đợt ${currentBatchIndex} và đồng bộ lên Google Drive (Thư mục: ${result.folderName || "NKTT_Expert_Evaluations"}). Đợt tiếp theo đã được mở khóa!`,
        url: result.folderUrl,
      });
      setTimeout(() => setDriveNotice(null), 8000);
    } else {
      setDriveNotice({
        type: "success",
        text: `Đã lưu thành công Đợt ${currentBatchIndex} vào bộ nhớ máy. Đợt tiếp theo đã được mở khóa!`,
      });
      setTimeout(() => setDriveNotice(null), 8000);
    }

    // Advance to next batch if available
    if (currentBatchIndex < 10) {
      const nextBatch = currentBatchIndex + 1;
      setCurrentBatchIndex(nextBatch);
      const nextBatchCases = doctorCases.slice((nextBatch - 1) * 10, nextBatch * 10);
      if (nextBatchCases.length > 0) {
        setSelectedCaseId(nextBatchCases[0].case_id);
      }
    } else {
      alert(`Chúc mừng Bác sĩ ${activeDoctor.name}! Bạn đã hoàn thành toàn bộ 10 đợt (100 ca) được phân công.`);
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

  // Confirmation of Clinical Rules -> enters workspace
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
      {/* Global Navigation Tabs: 200 cases tab is permanently locked */}
      <nav className={styles.globalNav}>
        <button
          type="button"
          className={styles.globalNavTabLocked}
          disabled={true}
          title="Tab 200 mẫu hiện đang khóa. Hệ thống đang tiến hành thẩm định tập trung 500 ca ViDent-LongMem."
        >
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
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span>Chấm điểm Lâm sàng Likert 5 mức (200 ca)</span>
          <span className={styles.lockedBadge}>Đã khóa</span>
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
          {/* Top Header - Streamlined for Doctor Focus */}
          <header className={styles.topBar}>
            <div className={styles.titleArea}>
              <h1 className={styles.titleMain}>Hệ thống Thẩm định Lâm sàng ViDent</h1>
              <p className={styles.titleSub}>
                Nền tảng đánh giá dữ liệu bệnh án dọc và câu hỏi chuyên khoa Răng Hàm Mặt
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

              {/* Auto-save Status Indicator */}
              <div className={styles.autoSaveBadge} title="Tự động lưu nháp liên tục vào trình duyệt">
                <span
                  className={[
                    styles.autoSaveDot,
                    isAutoSaving ? styles.autoSaveDotSaving : "",
                  ].join(" ")}
                />
                <span>
                  {isAutoSaving
                    ? "Đang lưu nháp..."
                    : lastAutoSavedAt
                    ? `Đã lưu nháp: ${lastAutoSavedAt}`
                    : "Tự động lưu nháp"}
                </span>
              </div>

              <span className={styles.statsBadge}>
                Tiến độ: {totalDoctorConfirmedCount}/100 ca ({completedBatches.length}/10 đợt hoàn tất)
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

              <button
                type="button"
                className={styles.guideBtn}
                onClick={() => setShowGuide(true)}
                title="Xem quy trình thao tác lâm sàng"
              >
                Quy trình thao tác
              </button>

              {/* Primary "Lưu" Button */}
              <button
                type="button"
                className={styles.saveMainBtn}
                onClick={handleSaveBatch}
                disabled={syncingDrive}
                title="Lưu đợt hiện tại, kiểm tra chất lượng và mở khóa đợt tiếp theo"
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
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                  <polyline points="7 3 7 8 15 8" />
                </svg>
                <span>{syncingDrive ? "Đang lưu..." : "Lưu"}</span>
              </button>
            </div>
          </header>

          {/* Batch Navigation Bar (10 batches, 10 cases each) */}
          <div className={styles.batchNavContainer}>
            <div className={styles.batchLabelArea}>
              <span className={styles.batchTitle}>
                Phân đợt làm việc ({activeDoctor?.name || "Bác sĩ"} - {activeDoctor?.caseRangeLabel || "100 ca"}):
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
                        ? `Cần hoàn thành và bấm "Lưu" ở Đợt ${batchNum - 1} để mở khóa Đợt ${batchNum}`
                        : `Đợt ${batchNum}: Ca ${(batchNum - 1) * 10 + 1} - ${batchNum * 10}`
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
                      Đợt {batchNum} ({isCompleted ? "Đã lưu" : "10 ca"})
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Drive & Batch Notice Banner */}
          {driveNotice && (
            <div
              className={
                driveNotice.type === "success"
                  ? styles.driveNoticeSuccess
                  : driveNotice.type === "error"
                  ? styles.driveNoticeError
                  : styles.driveNoticeInfo
              }
            >
              <div>
                <span>{driveNotice.text}</span>
                {driveNotice.url && (
                  <a
                    href={driveNotice.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.driveNoticeLink}
                  >
                    Mở thư mục Google Drive
                  </a>
                )}
                {driveNotice.type === "error" && (
                  <button
                    type="button"
                    onClick={() => setShowDriveModal(true)}
                    style={{
                      marginLeft: "1rem",
                      background: "transparent",
                      border: "none",
                      textDecoration: "underline",
                      cursor: "pointer",
                      fontWeight: 600,
                      color: "inherit",
                    }}
                  >
                    Cài đặt Drive
                  </button>
                )}
              </div>
              <button
                type="button"
                className={styles.driveNoticeClose}
                onClick={() => setDriveNotice(null)}
              >
                Đóng
              </button>
            </div>
          )}

          {/* Main Workspace: 3 Columns Focused on Clinical Review */}
          <div className={styles.workspace}>
            {/* Left Column: Cases of the current batch */}
            <section className={styles.sidebar} aria-label="Danh sách ca bệnh trong đợt">
              <div className={styles.filterSection}>
                <input
                  type="text"
                  placeholder="Tìm trong 10 ca của đợt này..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={styles.searchInput}
                />
              </div>

              <div className={styles.caseList}>
                {loadingList ? (
                  <p className={styles.emptyPlaceholder}>Đang tải danh sách ca bệnh...</p>
                ) : filteredCases.length === 0 ? (
                  <p className={styles.emptyPlaceholder}>Không tìm thấy ca nào trong đợt này</p>
                ) : (
                  filteredCases.map((c) => {
                    const globalIndex = allCases.findIndex((item) => item.case_id === c.case_id) + 1;
                    const doctorCaseIndex = doctorCases.findIndex((item) => item.case_id === c.case_id) + 1;
                    const isActive = c.case_id === selectedCaseId;
                    const friendlyFamily =
                      FAMILY_FRIENDLY_NAMES[c.category?.primary_family]?.label ||
                      c.category?.primary_family;
                    const isConfirmed = confirmedCaseIds.has(c.case_id);

                    return (
                      <button
                        key={c.case_id}
                        type="button"
                        className={[styles.caseCard, isActive ? styles.caseCardActive : ""]
                          .filter(Boolean)
                          .join(" ")}
                        onClick={() => setSelectedCaseId(c.case_id)}
                      >
                        <div className={styles.caseCardHeader}>
                          <span className={styles.caseId}>
                            Ca {doctorCaseIndex}/100
                          </span>
                          <span className={styles.caseCheckpoint}>Ca {globalIndex}/500</span>
                        </div>
                        <div className={styles.caseQueryPreview}>{c.current_query}</div>
                        <div className={styles.caseCardFooter}>
                          <span className={styles.familyTag} title={c.category?.primary_family}>
                            {friendlyFamily}
                          </span>
                          {isConfirmed && (
                            <span className={[styles.verdictBadge, styles.verdictApproved].join(" ")}>
                              Đã xác nhận
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
                  Đợt {currentBatchIndex}/10 ({batchCases.length} ca bệnh) - {activeDoctor?.name || "Bác sĩ"}
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
                        <h2 className={styles.sectionTitle}>
                          Ca {doctorCases.findIndex((c) => c.case_id === activeCase.case_id) + 1} / 100: Câu hỏi của người bệnh
                        </h2>
                      </div>
                      <div className={styles.queryActionGroup}>
                        <button
                          type="button"
                          className={styles.toggleEditBtn}
                          onClick={() => setIsEditingQuery(!isEditingQuery)}
                          title="Bật/tắt chế độ trau chuốt câu từ"
                        >
                          <svg
                            width="13"
                            height="13"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                          </svg>
                          <span>{isEditingQuery ? "Thu gọn chỉnh sửa" : "Hiệu chỉnh câu từ"}</span>
                        </button>
                        {editedQuery !== activeCase.current_query && (
                          <button
                            type="button"
                            className={styles.resetQueryBtn}
                            onClick={() => setEditedQuery(activeCase.current_query || "")}
                            title="Khôi phục nguyên văn câu hỏi ban đầu"
                          >
                            <svg
                              width="13"
                              height="13"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                              <path d="M3 3v5h5" />
                            </svg>
                            <span>Khôi phục bản gốc</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Original Query Box (Immutable Ground Truth Reference) */}
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
                        Bản gốc:
                      </span>
                      <p className={styles.originalQueryText}>{activeCase.current_query}</p>
                    </div>

                    {/* Editable Query Section (Controlled with Diff Tracking) */}
                    {isEditingQuery && (
                      <div className={styles.editQuerySection}>
                        <div className={styles.editQueryHeader}>
                          <span className={styles.editQueryLabel}>Bản hiệu chỉnh chuyên khoa:</span>
                          <span
                            className={[
                              styles.diffBadge,
                              queryChangePercent <= 20
                                ? styles.diffBadgeMinor
                                : queryChangePercent <= 50
                                ? styles.diffBadgeModerate
                                : styles.diffBadgeMajor,
                            ].join(" ")}
                          >
                            {queryChangePercent === 0
                              ? "Chưa thay đổi (0%)"
                              : queryChangePercent <= 20
                              ? `Trau chuốt nhẹ (thay đổi ${queryChangePercent}%)`
                              : queryChangePercent <= 50
                              ? `Điều chỉnh thuật ngữ (thay đổi ${queryChangePercent}%)`
                              : `Thay đổi lớn (thay đổi ${queryChangePercent}%)`}
                          </span>
                        </div>

                        {queryChangePercent > 50 && (
                          <div className={styles.diffAlertBanner}>
                            <strong>Cảnh báo thay đổi lớn:</strong> Bạn đang thay đổi đáng kể bản chất câu hỏi ban đầu (thay đổi {queryChangePercent}%). Bác sĩ vui lòng bảo đảm giữ nguyên cốt lõi tình huống lâm sàng và nêu rõ lý do chuyên môn trong ô biện giải (tối thiểu 35 ký tự).
                          </div>
                        )}

                        <textarea
                          value={editedQuery}
                          onChange={(e) => setEditedQuery(e.target.value)}
                          placeholder="Nhập nội dung hiệu chỉnh câu chữ chuẩn y khoa..."
                          className={styles.queryTextarea}
                          rows={2}
                          spellCheck={false}
                        />
                      </div>
                    )}
                  </div>

                  {/* Dialogue Timeline */}
                  <div className={styles.timelineCard}>
                    <div className={styles.timelineHeader}>
                      <div className={styles.timelineTitleGroup}>
                        <h2 className={styles.sectionTitle}>
                          Hồ sơ bệnh án & Diễn tiến:
                        </h2>
                      </div>
                      <div className={styles.sessionPills}>
                        {timeline && timeline.sessions && timeline.sessions.length > 0 ? (
                          timeline.sessions.map((s, idx) => {
                            const isSelected = idx === activeSessionIndex;
                            const isInspected = inspectedSessions.has(idx);
                            return (
                              <button
                                key={s.session_id}
                                type="button"
                                className={[
                                  styles.sessionPill,
                                  isSelected ? styles.sessionPillActive : "",
                                ]
                                  .filter(Boolean)
                                  .join(" ")}
                                onClick={() => handleSelectSession(idx)}
                                title={`Lần ${s.session_number} (${isInspected ? "Đã xem" : "Chưa xem"})`}
                              >
                                <span>Lần {s.session_number}</span>
                                {isInspected && (
                                  <svg
                                    width="10"
                                    height="10"
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
                              </button>
                            );
                          })
                        ) : (
                          <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
                            Ca độc lập, không có hồ sơ khám trước đó
                          </span>
                        )}
                      </div>
                    </div>

                    <div className={styles.chatArea}>
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
                                          {isDoctor ? "Bác sĩ" : "Người bệnh"}
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
                                        <span className={styles.turnBadgeSubtle}>{turn.turn_id}</span>
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

                          {/* Session Confirmation & Transition Bar */}
                          {timeline && timeline.sessions && timeline.sessions.length > 0 && (
                            <div className={styles.sessionFooterAction}>
                              <div className={styles.sessionFooterInfo}>
                                <span>
                                  Lần {currentSession.session_number} / {timeline.sessions.length} (Đã xem: {inspectedSessions.size}/{timeline.sessions.length} lần)
                                </span>
                              </div>
                              <div className={styles.sessionFooterBtns}>
                                {activeSessionIndex > 0 && (
                                  <button
                                    type="button"
                                    className={styles.sessionPrevBtn}
                                    onClick={() => handleSelectSession(activeSessionIndex - 1)}
                                    title={`Quay lại Lần ${timeline.sessions[activeSessionIndex - 1].session_number}`}
                                  >
                                    <svg
                                      width="13"
                                      height="13"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2.5"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    >
                                      <polyline points="15 18 9 12 15 6" />
                                    </svg>
                                    <span>Lần trước</span>
                                  </button>
                                )}

                                {activeSessionIndex < timeline.sessions.length - 1 ? (
                                  <button
                                    type="button"
                                    className={styles.sessionNextConfirmBtn}
                                    onClick={() => {
                                      const nextIdx = activeSessionIndex + 1;
                                      setInspectedSessions((prev) => new Set([...prev, activeSessionIndex, nextIdx]));
                                      setActiveSessionIndex(nextIdx);
                                    }}
                                    title={`Xác nhận đã xem Lần ${currentSession.session_number} và chuyển sang Lần ${timeline.sessions[activeSessionIndex + 1].session_number}`}
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
                                      <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                    <span>
                                      Xác nhận Lần {currentSession.session_number} & Chuyển Lần {timeline.sessions[activeSessionIndex + 1].session_number}
                                    </span>
                                    <svg
                                      width="13"
                                      height="13"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2.5"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    >
                                      <polyline points="9 18 15 12 9 6" />
                                    </svg>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    className={styles.sessionFinalConfirmBtn}
                                    onClick={() => {
                                      setInspectedSessions((prev) => new Set([...prev, activeSessionIndex]));
                                    }}
                                    title="Đã xem hết tất cả các lần khám trong hồ sơ"
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
                                      <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                    <span>
                                      Đã thẩm định xong Lần {currentSession.session_number} (Lần cuối)
                                    </span>
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
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
                      Biện giải & Xác nhận thẩm định
                    </h2>
                    {activeCase && confirmedCaseIds.has(activeCase.case_id) ? (
                      <span className={styles.confirmedBadge}>
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
                        Đã xác nhận
                      </span>
                    ) : (
                      <span className={styles.pendingBadge}>Chưa xác nhận</span>
                    )}
                  </div>
                  <p className={styles.sectionSubtitle}>
                    Nêu rõ nhận xét y khoa về tính an toàn, ngữ cảnh tiền sử và độ chuẩn xác của câu từ
                  </p>
                </div>

                {/* Clinical Verification Checklist (Replaces quick canned templates) */}
                <div className={styles.clinicalChecklistBox}>
                  <div className={styles.checklistTitle}>Tiêu chuẩn thẩm định bắt buộc:</div>
                  <div className={styles.checklistList}>
                    <label className={styles.checklistItem}>
                      <input
                        type="checkbox"
                        checked={checklistHistory}
                        onChange={(e) => setChecklistHistory(e.target.checked)}
                        className={styles.checklistCheckbox}
                      />
                      <span>Đã đối chiếu các lần khám và tiền sử bệnh nhân</span>
                    </label>
                    <label className={styles.checklistItem}>
                      <input
                        type="checkbox"
                        checked={checklistSafety}
                        onChange={(e) => setChecklistSafety(e.target.checked)}
                        className={styles.checklistCheckbox}
                      />
                      <span>Bảo đảm an toàn y khoa, không vi phạm chống chỉ định</span>
                    </label>
                    <label className={styles.checklistItem}>
                      <input
                        type="checkbox"
                        checked={checklistCore}
                        onChange={(e) => setChecklistCore(e.target.checked)}
                        className={styles.checklistCheckbox}
                      />
                      <span>Bảo toàn bản chất tình huống bệnh lý của câu hỏi</span>
                    </label>
                  </div>
                </div>

                <div className={styles.textareaWrapper}>
                  <textarea
                    value={clinicalNotes}
                    onChange={(e) => setClinicalNotes(e.target.value)}
                    placeholder="Biện giải chuyên môn: Nêu rõ đánh giá an toàn, tính chính xác của chẩn đoán và căn cứ đối chiếu tiền sử..."
                    className={styles.notesTextarea}
                    rows={4}
                    spellCheck={false}
                  />
                  <div className={styles.charCountRow}>
                    <span
                      className={
                        clinicalNotes.trim().length >= 20
                          ? styles.charCountValid
                          : styles.charCountWarning
                      }
                    >
                      {clinicalNotes.trim().length}/20 ký tự tối thiểu
                    </span>
                  </div>
                </div>

                {/* Guardrails Feedback Box */}
                <div className={styles.guardrailBox}>
                  <div className={styles.guardrailGrid}>
                    <div
                      className={[
                        styles.guardrailItem,
                        notesQuality.charCount >= 20 ? styles.guardrailPassed : styles.guardrailFailed,
                      ].join(" ")}
                    >
                      <span
                        className={[
                          styles.guardrailIndicator,
                          notesQuality.charCount >= 20 ? styles.indicatorPassed : styles.indicatorFailed,
                        ].join(" ")}
                      />
                      <span>Đủ 20 ký tự ({notesQuality.charCount}/20)</span>
                    </div>
                    <div
                      className={[
                        styles.guardrailItem,
                        notesQuality.hasAccent ? styles.guardrailPassed : styles.guardrailFailed,
                      ].join(" ")}
                    >
                      <span
                        className={[
                          styles.guardrailIndicator,
                          notesQuality.hasAccent ? styles.indicatorPassed : styles.indicatorFailed,
                        ].join(" ")}
                      />
                      <span>Tiếng Việt có dấu</span>
                    </div>
                    <div
                      className={[
                        styles.guardrailItem,
                        notesQuality.hasDomainKeywords ? styles.guardrailPassed : styles.guardrailFailed,
                      ].join(" ")}
                    >
                      <span
                        className={[
                          styles.guardrailIndicator,
                          notesQuality.hasDomainKeywords ? styles.indicatorPassed : styles.indicatorFailed,
                        ].join(" ")}
                      />
                      <span>Thuật ngữ RHM / Y khoa</span>
                    </div>
                    <div
                      className={[
                        styles.guardrailItem,
                        !notesQuality.hasSpamRepeat && !notesQuality.duplicateWithCaseId
                          ? styles.guardrailPassed
                          : styles.guardrailFailed,
                      ].join(" ")}
                    >
                      <span
                        className={[
                          styles.guardrailIndicator,
                          !notesQuality.hasSpamRepeat && !notesQuality.duplicateWithCaseId
                            ? styles.indicatorPassed
                            : styles.indicatorFailed,
                        ].join(" ")}
                      />
                      <span>Không trùng lặp spam</span>
                    </div>
                  </div>

                  {notesQuality.errors.length > 0 && clinicalNotes.trim().length > 0 && (
                    <div className={styles.guardrailWarningText}>
                      {notesQuality.errors[0]}
                    </div>
                  )}
                </div>

                {/* Speedrun or Session Inspection Reminder */}
                {readingCountdown > 0 ? (
                  <div className={styles.speedrunNotice}>
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
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <span>Đang thẩm định hồ sơ: Vui lòng đọc kỹ nội dung (còn {readingCountdown} giây)</span>
                  </div>
                ) : !hasInspectedRequiredSessions ? (
                  <div
                    className={styles.speedrunNotice}
                    style={{ color: "#9a3412", backgroundColor: "#fff7ed", borderColor: "#ffedd5" }}
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
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span>Hồ sơ có nhiều đợt khám: Bác sĩ cần bấm xem ít nhất 1 đợt khám khác trước đó.</span>
                  </div>
                ) : null}

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
                  disabled={saving || !canConfirmCase}
                  onClick={handleSaveAnnotation}
                  title={
                    readingCountdown > 0
                      ? `Đang trong thời gian đọc hồ sơ (còn ${readingCountdown}s)`
                      : !hasInspectedRequiredSessions
                      ? "Cần bấm xem ít nhất 1 đợt khám trước đó"
                      : !isChecklistComplete
                      ? "Cần đánh dấu đủ 3 tiêu chuẩn thẩm định"
                      : !notesQuality.isValid
                      ? "Biện giải lâm sàng chưa đạt chuẩn chất lượng"
                      : "Xác nhận thẩm định ca này"
                  }
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
                      : activeCase && confirmedCaseIds.has(activeCase.case_id)
                      ? `Cập nhật xác nhận Ca ${doctorCases.findIndex((c) => c.case_id === activeCase.case_id) + 1}`
                      : `Xác nhận Ca ${activeCase ? doctorCases.findIndex((c) => c.case_id === activeCase.case_id) + 1 : ""}`}
                  </span>
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

              {/* Clinical Verification Reminder Card */}
              <div className={styles.reminderCard}>
                <h4 className={styles.reminderTitle}>Nguyên tắc thẩm định bắt buộc</h4>
                <ul className={styles.reminderList}>
                  <li>Tuyệt đối không thay đổi cốt lõi tình huống bệnh lý của đoạn hội thoại.</li>
                  <li>Phân định rõ tiền sử còn hiệu lực với thủ thuật đã xong.</li>
                  <li>Bắt buộc bấm "Lưu" sau khi hoàn tất đủ 10 ca của đợt để chuyển tiếp.</li>
                </ul>
              </div>
            </section>
          </div>

          {/* Guide Modal for Operating Process */}
          {showGuide && (
            <div className={styles.guideModalOverlay} onClick={() => setShowGuide(false)}>
              <div className={styles.guideModal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.guideModalHeader}>
                  <h3 className={styles.guideModalTitle}>
                    Quy trình Thẩm định Lâm sàng Chuẩn mực
                  </h3>
                  <button
                    type="button"
                    className={styles.guideCloseIconBtn}
                    onClick={() => setShowGuide(false)}
                    title="Đóng cửa sổ hướng dẫn"
                  >
                    Đóng
                  </button>
                </div>

                <div className={styles.guideModalBody}>
                  <div className={styles.guideTipBox}>
                    <strong>Mục tiêu:</strong> Chuẩn hóa dữ liệu bệnh án dọc để làm chuẩn vàng (Gold Standard) cho AI tư vấn nha khoa, bảo đảm tuyệt đối tính an toàn sinh học và căn cứ y văn.
                  </div>

                  <div className={styles.guideStepCard}>
                    <div className={styles.guideStepHeader}>
                      <span className={styles.guideStepNumber}>Bước 1</span>
                      <span className={styles.guideStepTitle}>Thẩm định câu hỏi của người bệnh</span>
                    </div>
                    <p className={styles.guideStepDesc}>
                      Đọc kỹ câu hỏi ở khung giữa. Hiệu chỉnh câu chữ nếu diễn đạt lủng củng, thiếu tự nhiên hoặc dùng sai thuật ngữ giải phẫu, bệnh học Răng Hàm Mặt.
                    </p>
                  </div>

                  <div className={styles.guideStepCard}>
                    <div className={styles.guideStepHeader}>
                      <span className={styles.guideStepNumber}>Bước 2</span>
                      <span className={styles.guideStepTitle}>Đối chiếu dòng thời gian các lần khám</span>
                    </div>
                    <p className={styles.guideStepDesc}>
                      Bấm vào các thẻ <strong>"Lần khám 1, 2..."</strong> để kiểm tra tiền sử bệnh nhân. Chú ý các nhãn chỉ báo dữ kiện quan trọng để nắm bắt các can thiệp đã và đang diễn ra.
                    </p>
                  </div>

                  <div className={styles.guideStepCard}>
                    <div className={styles.guideStepHeader}>
                      <span className={styles.guideStepNumber}>Bước 3</span>
                      <span className={styles.guideStepTitle}>Nhập biện giải lâm sàng & Bấm Xác nhận</span>
                    </div>
                    <p className={styles.guideStepDesc}>
                      Ở cột bên phải, nhập nhận xét chuyên khoa tối thiểu 20 ký tự nêu rõ căn cứ y khoa, sau đó bấm nút <strong>"Xác nhận thẩm định ca này"</strong>.
                    </p>
                  </div>

                  <div className={styles.guideStepCard}>
                    <div className={styles.guideStepHeader}>
                      <span className={styles.guideStepNumber}>Bước 4</span>
                      <span className={styles.guideStepTitle}>Bấm Lưu đợt để chuyển tiếp</span>
                    </div>
                    <p className={styles.guideStepDesc}>
                      Sau khi hoàn tất đủ 10 ca trong đợt, bấm nút <strong>"Lưu"</strong> trên thanh công cụ để hệ thống kiểm tra chất lượng chuyên môn và mở khóa đợt kế tiếp.
                    </p>
                  </div>
                </div>

                <div className={styles.guideModalFooter}>
                  <button
                    type="button"
                    className={styles.guideDismissBtn}
                    onClick={() => setShowGuide(false)}
                  >
                    Đã hiểu và tiếp tục công việc
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Google Drive Configuration Modal */}
          <DriveSyncModal
            isOpen={showDriveModal}
            onClose={() => setShowDriveModal(false)}
            onConfigSaved={(cfg) => setDriveConfig(cfg)}
          />

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
            onClose={() => setShowRulesModal(false)}
            onAccept={handleAcceptRules}
          />

          {/* Quality Warning Modal for Superficial Evaluation */}
          <QualityWarningModal
            isOpen={showQualityWarning}
            batchNumber={currentBatchIndex}
            findings={qualityFindings}
            onBack={() => setShowQualityWarning(false)}
            onConfirmSave={executeBatchSaveAndUnlock}
          />
        </>
      )}
    </div>
  );
}
