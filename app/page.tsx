"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import styles from "./LabelData.module.css";
import ClinicalLikertEvalView from "./components/ClinicalLikertEvalView";
import DoctorLoginModal, {
  DOCTORS_LIST,
  getAllDoctorsList,
  DoctorProfile,
} from "./components/DoctorLoginModal";
import QualityWarningModal from "./components/QualityWarningModal";
import ClinicalRulesModal from "./components/ClinicalRulesModal";
import ExampleComparisonModal from "./components/ExampleComparisonModal";
import {
  uploadToDrive,
  syncExpertAnnotationsToDrive,
  fetchDoctorBatchesFromDrive,
  fetchAllBatchesSummaryFromDrive,
  fetchClaimsRegistry,
  claimSampleOnDrive,
  releaseClaimOnDrive,
  getFileFromDrive,
  SampleClaimRecord,
  ClaimsRegistry,
  isClaimExpired,
  touchClaimOnDrive,
  formatSaveTimestamp,
  getSampleFileName,
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
    requestAnimationFrame(() => {
      if (!el) return;
      el.style.height = "auto";
      const targetHeight = Math.max(el.scrollHeight, 22);
      if (Math.abs(el.clientHeight - targetHeight) > 2) {
        el.style.height = `${targetHeight}px`;
      }
    });
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

export interface SampleItem {
  sampleIndex: number;
  userId: string;
  totalSessions: number;
  totalTurns: number;
  timeline: TimelineRecord;
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
  turn_evaluations?: Record<string, "v" | "x">;
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
const DATASET_VERSION_TAG = "v5_20260925_refresh_current";

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

function extractCaseAnnotationFromBatchData(c: any, doctorName: string): {
  record: ExpertAnnotationRecord;
  turnsMap: Record<string, string>;
} {
  const editedTurnsList: TurnRecord[] = [];
  const turnsMap: Record<string, string> = {};

  if (c.dialogue_history && Array.isArray(c.dialogue_history)) {
    for (const sess of c.dialogue_history) {
      if (sess.turns && Array.isArray(sess.turns)) {
        for (const t of sess.turns) {
          const isEdited = Boolean(
            t.was_edited ||
            (t.final_text && t.original_text && t.final_text !== t.original_text)
          );
          if (isEdited && t.final_text) {
            editedTurnsList.push({
              turn_id: t.turn_id,
              speaker: t.speaker || "Người hỏi",
              text: t.final_text,
              turn_timestamp: t.turn_timestamp,
            });
            turnsMap[t.turn_id] = t.final_text;
          }
        }
      }
    }
  }

  const queryWasEdited = Boolean(
    c.user_query?.was_edited ||
    (c.user_query?.final_text && c.user_query?.original_text && c.user_query.final_text !== c.user_query.original_text)
  );

  const finalQueryText = c.user_query?.final_text || c.user_query?.original_text;

  const record: ExpertAnnotationRecord = {
    case_id: c.case_id,
    user_id: c.user_id,
    verdict: (c.clinical_appraisal?.verdict || "APPROVED") as "APPROVED" | "EDITED" | "FLAGGED",
    clinical_notes: c.clinical_appraisal?.clinical_notes || "",
    original_query: c.user_query?.original_text || "",
    edited_query: queryWasEdited ? finalQueryText : undefined,
    query_change_percent: c.user_query?.change_percent,
    edited_turns: editedTurnsList.length > 0 ? editedTurnsList : undefined,
    factors: c.clinical_factors,
    memory_events: c.memory_events,
    annotator: doctorName,
    updated_at: c.annotated_at || new Date().toISOString(),
  };

  return { record, turnsMap };
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
let cachedSamplesList: SampleItem[] | null = null;

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

  // 125 Samples State (Mỗi mẫu là 1 người bệnh với đầy đủ tất cả các lần khám)
  const [allSamples, setAllSamples] = useState<SampleItem[]>([]);
  const [currentSampleIndex, setCurrentSampleIndex] = useState<number>(1);
  const [confirmedSampleIds, setConfirmedSampleIds] = useState<Set<number>>(new Set());
  const [driveCompletedMap, setDriveCompletedMap] = useState<Record<number, string>>({});
  const [claimsRegistry, setClaimsRegistry] = useState<Record<number, SampleClaimRecord>>({});
  const [isRegistryLoaded, setIsRegistryLoaded] = useState<boolean>(false);
  const [driveSummaryLoading, setDriveSummaryLoading] = useState<boolean>(false);
  const [driveSyncLoading, setDriveSyncLoading] = useState<boolean>(false);
  const [driveSyncLoadingText, setDriveSyncLoadingText] = useState<string>("");

  const activeDoctorRef = useRef(activeDoctor);
  activeDoctorRef.current = activeDoctor;

  const currentSampleIndexRef = useRef(currentSampleIndex);
  currentSampleIndexRef.current = currentSampleIndex;

  const lastRegistryJsonRef = useRef<string>("");
  const isClaimingRef = useRef<boolean>(false);
  const loadedSampleIndexRef = useRef<number | null>(null);
  const isSyncingRegistryRef = useRef<boolean>(false);
  const lastSyncTimestampRef = useRef<number>(0);
  const draftSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Tu dong tat man hinh loading sau 20 giay phong truong hop mang cham de tranh treo UI
  useEffect(() => {
    if (driveSyncLoading) {
      const timer = setTimeout(() => {
        setDriveSyncLoading(false);
      }, 20000);
      return () => clearTimeout(timer);
    }
  }, [driveSyncLoading, driveSyncLoadingText]);

  // Batch states (dự phòng)
  const [currentBatchIndex, setCurrentBatchIndex] = useState<number>(1);
  const [completedBatches, setCompletedBatches] = useState<number[]>([]);
  const [driveCompletedBatches, setDriveCompletedBatches] = useState<Set<number>>(new Set());

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
  const [isSyncingDrive, setIsSyncingDrive] = useState<boolean>(false);

  // Anti-speedrun & session inspection tracking
  const [readingCountdown, setReadingCountdown] = useState<number>(0);
  const [inspectedSessions, setInspectedSessions] = useState<Set<number>>(new Set());

  // Clinical Verification Checklist (Checkpoints)
  const [checklistHistory, setChecklistHistory] = useState<boolean>(false);
  const [checklistSafety, setChecklistSafety] = useState<boolean>(false);
  const [checklistCore, setChecklistCore] = useState<boolean>(false);

  // Query editing toggle
  const [isEditingQuery, setIsEditingQuery] = useState<boolean>(false);

  // Trạng thái đánh giá từng lượt thoại: "v" (chuẩn rồi) hoặc "x" (chưa chuẩn)
  // Mặc định rỗng {}, không chọn sẵn bất kỳ nút nào
  const [turnEvaluations, setTurnEvaluations] = useState<Record<string, "v" | "x">>({});

  // Trạng thái bật chế độ sửa nội dung cho từng lượt thoại (tùy chọn khi chọn x)
  const [editingTurnIds, setEditingTurnIds] = useState<Record<string, boolean>>({});

  // Độ rộng và trạng thái mở rộng / ẩn của cột bên trái (danh sách ca bệnh)
  const [leftWidth, setLeftWidth] = useState<number>(260);
  const [isLeftExtended, setIsLeftExtended] = useState<boolean>(false);
  const [isLeftCollapsed, setIsLeftCollapsed] = useState<boolean>(false);
  const isDraggingLeftRef = useRef(false);
  const workspaceRef = useRef<HTMLDivElement>(null);

  // Độ rộng và trạng thái mở rộng của cột bên phải
  const [rightWidth, setRightWidth] = useState<number>(390);
  const [isRightExtended, setIsRightExtended] = useState<boolean>(false);
  const isDraggingRef = useRef(false);

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

  // Initialize doctor session from sessionStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = sessionStorage.getItem("nktt_active_doctor_session");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.name) {
          setActiveDoctor(parsed);
          setAnnotator(parsed.name);
          setShowDoctorModal(false);
          return;
        }
      }
    } catch {}
    // If no active session, show Doctor Login Modal
    setShowDoctorModal(true);
  }, []);

  // Tự động nhận mẫu trống chưa có ai làm (chống trùng lặp tuyệt đối giữa các bác sĩ, tự động phân công)
  const handleClaimEmptySample = useCallback(async (
    attemptOrEvent?: number | React.MouseEvent,
    isSilentAuto: boolean = false,
    preferFromStart: boolean = false,
    excludeIndex?: number
  ) => {
    if (isClaimingRef.current) return;
    isClaimingRef.current = true;

    try {
      const attempt = typeof attemptOrEvent === "number" ? attemptOrEvent : 1;
      const curDoc = activeDoctorRef.current;
      if (allSamples.length === 0 || !curDoc) return;
      if (attempt > 5) {
        if (!isSilentAuto) {
          alert("Hệ thống đang có nhiều Bác sĩ cùng nhận mẫu đồng thời. Vui lòng thử lại sau vài giây!");
        }
        return;
      }

      if (!isSilentAuto) {
        setDriveSyncLoading(true);
        setDriveSyncLoadingText("Đang tìm mẫu trống tiếp theo...");
      }

      let latestRegistry: ClaimsRegistry = {};
      try {
        const regRes = await fetchClaimsRegistry({ timeoutMs: 4000 });
        if (regRes.ok && regRes.registry) {
          latestRegistry = regRes.registry;
          lastRegistryJsonRef.current = JSON.stringify(regRes.registry);
          setClaimsRegistry(regRes.registry);
        }
      } catch {}

      const myFolder = (curDoc.folderCode || curDoc.id || "").toUpperCase();

      const myInProgress = Object.values(latestRegistry).find(
        (c) =>
          c &&
          c.status === "IN_PROGRESS" &&
          !isClaimExpired(c) &&
          !confirmedSampleIds.has(c.sampleIndex) &&
          !driveCompletedMap[c.sampleIndex] &&
          (c.doctorId === curDoc.id || c.doctorFolder?.toUpperCase() === myFolder)
      );

      // Nếu đang tự động khôi phục khi mới đăng nhập thì mở ca dở dang của chính bác sĩ nếu có
      if (isSilentAuto && myInProgress && myInProgress.sampleIndex) {
        setCurrentSampleIndex(myInProgress.sampleIndex);
        setActiveSessionIndex(0);
        return;
      }

      try {
        // Tìm mẫu trống trong 125 mẫu mà CHƯA CÓ BẤT KỲ AI NHẬN (hoặc đã hết hạn TTL)
        const isAvailable = (idx: number) => {
          if (excludeIndex && idx === excludeIndex) return false;
          if (confirmedSampleIds.has(idx)) return false;
          if (driveCompletedMap[idx]) return false;
          const claim = latestRegistry[idx];
          if (!claim) return true;
          if (claim.status === "COMPLETED") return false;
          if (isClaimExpired(claim)) return true;
          return false;
        };

        const total = allSamples.length || 125;
        let targetIndex = -1;
        const curIdx = currentSampleIndexRef.current || 1;

        // Khi đăng nhập lần đầu (isSilentAuto), hoặc yêu cầu tìm từ đầu (preferFromStart),
        // hoặc khi curIdx <= 1: LUÔN ưu tiên kiểm tra tuần tự từ Mẫu 1 đến Mẫu total
        if (isSilentAuto || preferFromStart || curIdx <= 1) {
          for (let i = 1; i <= total; i++) {
            if (isAvailable(i)) {
              targetIndex = i;
              break;
            }
          }
        } else {
          // Bác sĩ vừa hoàn tất mẫu hiện tại (curIdx) và muốn chuyển sang mẫu tiếp theo:
          // Vòng 1: Tìm từ curIdx + 1 đến total
          for (let i = curIdx + 1; i <= total; i++) {
            if (isAvailable(i)) {
              targetIndex = i;
              break;
            }
          }
          // Vòng 2: Vòng lại tìm từ 1 đến curIdx
          if (targetIndex === -1) {
            for (let i = 1; i <= curIdx; i++) {
              if (isAvailable(i)) {
                targetIndex = i;
                break;
              }
            }
          }
        }

        if (targetIndex !== -1) {
          const sampleItem = allSamples[targetIndex - 1];
          if (!isSilentAuto) {
            setDriveSyncLoadingText(`Đang nhận Mẫu ${targetIndex}...`);
          }

          const claimRes = await claimSampleOnDrive(targetIndex, sampleItem.userId, curDoc);
          if (!claimRes.ok) {
            latestRegistry[targetIndex] = {
              sampleIndex: targetIndex,
              userId: sampleItem.userId,
              doctorFolder: "OCCUPIED",
              doctorId: "other",
              doctorName: "Bác sĩ khác",
              status: "IN_PROGRESS",
              claimedAt: new Date().toISOString(),
            };
            setClaimsRegistry({ ...latestRegistry });
            isClaimingRef.current = false;
            // Bật màn hình loading chuyển mẫu do đụng độ với Bác sĩ khác
            setDriveSyncLoading(true);
            setDriveSyncLoadingText(`Đụng độ Mẫu ${targetIndex} - Đang tìm mẫu trống khác...`);
            await handleClaimEmptySample(attempt + 1, false, false, targetIndex);
            return;
          }

          const now = new Date().toISOString();
          const updatedRegistry: ClaimsRegistry = {
            ...latestRegistry,
            [targetIndex]: {
              sampleIndex: targetIndex,
              userId: sampleItem.userId,
              doctorFolder: myFolder,
              doctorId: curDoc.id,
              doctorName: curDoc.name,
              status: "IN_PROGRESS",
              claimedAt: now,
              updatedAt: now,
            },
          };
          lastRegistryJsonRef.current = JSON.stringify(updatedRegistry);
          setClaimsRegistry(updatedRegistry);

          setCurrentSampleIndex(targetIndex);
          setActiveSessionIndex(0);
          setSaveMessage({
            text: `Đã tự động nhận độc quyền Mẫu ${targetIndex} cho bạn.`,
            isError: false,
          });
          return;
        }

        if (!isSilentAuto) {
          alert("Toàn bộ 125 mẫu hồ sơ đã được các bác sĩ nhận hoặc hoàn tất thẩm định!");
        }
      } finally {
        if (!isSilentAuto) {
          setDriveSyncLoading(false);
        }
      }
    } finally {
      isClaimingRef.current = false;
    }
  }, [allSamples, confirmedSampleIds, driveCompletedMap]);

  // Cảnh báo trước khi thoát hoặc tải lại trang web nếu gói chưa hoàn thành hoặc chưa lưu
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Kích hoạt khi bác sĩ đang làm việc và chưa hoàn thành đủ 10 gói hoặc gói hiện tại chưa lưu
      const hasUncompletedBatch =
        Boolean(activeDoctor) &&
        (!completedBatches.includes(currentBatchIndex) || completedBatches.length < 10);

      if (hasUncompletedBatch) {
        e.preventDefault();
        const warningMsg =
          "Lưu ý quan trọng: Bác sĩ cần hoàn thành đủ 10/10 ca trong gói và bấm nút Lưu Gói để dữ liệu được lưu an toàn lên Google Drive. Nếu thoát bây giờ, tiến độ dở dang chỉ lưu nháp trên trình duyệt này và không thể xem từ thiết bị khác.";
        e.returnValue = warningMsg;
        return warningMsg;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [activeDoctor, completedBatches, currentBatchIndex]);

  // When active doctor changes, load their confirmed cases and completed batches
  useEffect(() => {
    if (!activeDoctor) return;
    setSelectedCaseId(null);

    // Purge only ancient legacy global keys
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("nktt_expert_annotations_v5");
        localStorage.removeItem("nktt_expert_annotations_v4");
        localStorage.removeItem("nktt_expert_annotations_v3");
        localStorage.removeItem("nktt_expert_annotations");
      } catch {}
    }

    // 1. Load confirmed cases for this specific doctor from localStorage
    let initialConfirmed = new Set<string>();
    try {
      const savedConfirmed = localStorage.getItem(`nktt_confirmed_cases_${activeDoctor.id}`);
      if (savedConfirmed) {
        const list = JSON.parse(savedConfirmed);
        if (Array.isArray(list)) {
          initialConfirmed = new Set(list);
          setConfirmedCaseIds(initialConfirmed);
        }
      } else {
        setConfirmedCaseIds(new Set());
      }
    } catch {
      setConfirmedCaseIds(new Set());
    }

    // 2. Load annotations strictly saved by this active doctor from localStorage
    const docAnnotations = getDoctorAnnotations(activeDoctor.id);
    setAnnotationsMap(docAnnotations);

    // 3. Load completed batches for this doctor from localStorage
    let completedList: number[] = [];
    try {
      const saved = localStorage.getItem(`nktt_completed_batches_${activeDoctor.id}`);
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
        if (parsed >= 1 && parsed <= 50) {
          preferredBatch = parsed;
        }
      } else {
        // Auto select first incomplete batch
        for (let b = 1; b <= 50; b++) {
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

    // 4. Đồng bộ hai chiều: Quét và khôi phục các gói đã hoàn tất từ Google Drive (chống trùng lặp giữa các bác sĩ)
    let isSubscribed = true;
    async function reconcileServerBatches() {
      if (!activeDoctor) return;
      const docFolder = (
        activeDoctor.folderCode ||
        activeDoctor.id ||
        "BS01"
      ).toUpperCase();

      try {
        setDriveSummaryLoading(true);

        // 4.1. Quét tóm tắt toàn bộ các gói đã hoàn tất của MỌI Bác sĩ trên Drive
        const summaryRes = await fetchAllBatchesSummaryFromDrive({ timeoutMs: 6000 });
        const globalCompletedSet = new Set<number>();
        if (summaryRes.ok && summaryRes.summary) {
          Object.values(summaryRes.summary).forEach((bList) => {
            if (Array.isArray(bList)) {
              bList.forEach((b) => globalCompletedSet.add(b));
            }
          });
        }

        // 4.2. Lấy dữ liệu chi tiết các gói của Bác sĩ hiện tại
        const driveRes = await fetchDoctorBatchesFromDrive(docFolder, { timeoutMs: 6000 });
        const driveBatches = driveRes.ok && Array.isArray(driveRes.batches) ? driveRes.batches : [];
        const thisDocCompletedIndices = new Set<number>(driveBatches.map((b) => b.batchIndex));
        driveBatches.forEach((b) => globalCompletedSet.add(b.batchIndex));

        const sortedThisDocCompleted = Array.from(thisDocCompletedIndices).sort((a, b) => a - b);

        const validConfirmed = new Set<string>();
        const validAnnotations: Record<string, ExpertAnnotationRecord> = {};
        const validSharedTurns: Record<string, string> = {};

        for (const bItem of driveBatches) {
          const cList = bItem.data?.cases;
          if (Array.isArray(cList)) {
            for (const c of cList) {
              if (c.case_id) {
                validConfirmed.add(c.case_id);
                const { record, turnsMap } = extractCaseAnnotationFromBatchData(c, activeDoctor.name);
                validAnnotations[c.case_id] = record;
                Object.assign(validSharedTurns, turnsMap);
              }
            }
          }
        }

        // Dọn dẹp nháp của các gói không tồn tại trên Google Drive
        for (let b = 1; b <= 50; b++) {
          if (!globalCompletedSet.has(b)) {
            try {
              localStorage.removeItem(`nktt_batch_draft_${activeDoctor.id}_${b}`);
            } catch {}
          }
        }

        if (isSubscribed) {
          setDriveCompletedBatches(globalCompletedSet);
          setCompletedBatches(sortedThisDocCompleted);
          setConfirmedCaseIds(validConfirmed);
          if (Object.keys(validSharedTurns).length > 0) {
            setEditedTurns((prev) => ({ ...validSharedTurns, ...prev }));
            try {
              localStorage.setItem(`nktt_shared_turns_v5_${activeDoctor.id}`, JSON.stringify(validSharedTurns));
            } catch {}
          }

          // Phát gói tự động không trùng lặp: Tìm gói đầu tiên từ 1 đến 50 CHƯA có bác sĩ nào hoàn thành
          let nextBatch = 1;
          for (let b = 1; b <= 50; b++) {
            if (!globalCompletedSet.has(b)) {
              nextBatch = b;
              break;
            }
          }

          // Nếu gói hiện tại đã bị trùng (đã xong trên Drive bởi bác sĩ khác), tự động điều hướng sang gói mới
          setCurrentBatchIndex((prev) => {
            if (globalCompletedSet.has(prev)) {
              return nextBatch;
            }
            return prev;
          });

          if (globalCompletedSet.size > 0) {
            setSaveMessage({
              text: `Đã kết nối Google Drive: ${globalCompletedSet.size}/50 gói đã được thẩm định trên toàn hệ thống.`,
              isError: false,
            });
          } else if (completedList.length > 0 || initialConfirmed.size > 0) {
            setSaveMessage({
              text: "Dữ liệu trên Google Drive đã được làm mới (0 gói). Web đã được đồng bộ về trạng thái ban đầu!",
              isError: false,
            });
          }
        }
      } catch (err) {
        console.warn("Lỗi khi kiểm tra Google Drive:", err);
      } finally {
        if (isSubscribed) {
          setDriveSummaryLoading(false);
        }
      }
    }

    reconcileServerBatches();

    const handleWindowFocus = () => {
      reconcileServerBatches();
    };
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      isSubscribed = false;
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [activeDoctor]);

  // Xóa các khóa bộ nhớ cũ đã lỗi thời (chỉ xóa khóa v3, v4 không còn sử dụng, tuyệt đối không xóa tiến trình của bác sĩ)
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("nktt_expert_annotations_v5");
        localStorage.removeItem("nktt_expert_annotations_v4");
        localStorage.removeItem("nktt_expert_annotations_v3");
        localStorage.removeItem("nktt_expert_annotations");
      } catch {}
    }
  }, []);

  // Load all 125 samples from public/dataset/vident_longmem_500/timelines.jsonl
  useEffect(() => {
    let isMounted = true;
    async function fetchTimelines() {
      // Nếu đã có trong bộ nhớ cache, nạp ngay lập tức tránh parse lại file lớn
      if (cachedSamplesList && cachedSamplesList.length > 0) {
        setAllSamples(cachedSamplesList);
        setLoadingList(false);
        return;
      }

      setLoadingList(true);
      try {
        const assetBase = getAssetBase();
        // Cho phép trình duyệt lưu HTTP cache theo DATASET_VERSION_TAG để tải tức thì
        const res = await fetch(
          `${assetBase}/dataset/vident_longmem_500/timelines.jsonl?v=${DATASET_VERSION_TAG}`
        );
        const text = await res.text();
        const list: SampleItem[] = [];
        const lines = text.split("\n");
        let idx = 1;
        const tMap = new Map<string, TimelineRecord>();
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const parsed = JSON.parse(trimmed) as TimelineRecord;
            list.push({
              sampleIndex: idx,
              userId: parsed.user_id,
              totalSessions: parsed.total_sessions || parsed.sessions?.length || 0,
              totalTurns: parsed.total_turns || parsed.sessions?.reduce((acc, s) => acc + (s.turns?.length || 0), 0) || 0,
              timeline: parsed,
            });
            tMap.set(parsed.user_id, parsed);
            idx++;
          } catch {}
        }
        cachedSamplesList = list;
        if (!cachedTimelinesMap) {
          cachedTimelinesMap = tMap;
        }
        if (isMounted) {
          setAllSamples(list);
        }
      } catch (err) {
        console.error("Lỗi khi tải danh sách 125 mẫu:", err);
      } finally {
        if (isMounted) setLoadingList(false);
      }
    }

    fetchTimelines();
    return () => {
      isMounted = false;
    };
  }, []);

  // Đồng bộ claims registry từ Google Drive định kỳ mỗi 35 giây (chống nghẽn mạng và chống giật lag)
  useEffect(() => {
    let timer: NodeJS.Timeout;
    const syncRegistry = async () => {
      if (isSyncingRegistryRef.current) return;
      isSyncingRegistryRef.current = true;
      lastSyncTimestampRef.current = Date.now();

      try {
        const res = await fetchClaimsRegistry({ timeoutMs: 5000 });
        if (res.ok && res.registry) {
          const newJson = JSON.stringify(res.registry);
          // Chỉ cập nhật state nếu dữ liệu trên Google Drive thực sự thay đổi
          if (newJson !== lastRegistryJsonRef.current) {
            lastRegistryJsonRef.current = newJson;
            setClaimsRegistry(res.registry);
            const completedMap: Record<number, string> = {};
            Object.entries(res.registry).forEach(([idxStr, rec]) => {
              if (rec.status === "COMPLETED") {
                completedMap[Number(idxStr)] = rec.doctorFolder;
              }
            });

            // Chỉ cập nhật state completedMap nếu có sự khác biệt để tránh re-render thừa
            setDriveCompletedMap((prevMap) => {
              const prevKeys = Object.keys(prevMap);
              const newKeys = Object.keys(completedMap);
              if (prevKeys.length !== newKeys.length) return completedMap;
              for (const k of newKeys) {
                if (prevMap[Number(k)] !== completedMap[Number(k)]) return completedMap;
              }
              return prevMap;
            });

            // Kiểm tra nếu mẫu hiện tại bác sĩ đang xem bị người khác nhận mất trên Google Drive
            const curDoc = activeDoctorRef.current;
            const curIdx = currentSampleIndexRef.current;
            if (curDoc && curIdx && !isClaimingRef.current) {
              const myF = (curDoc.folderCode || curDoc.id || "").toUpperCase();
              const curClaim = res.registry[curIdx];
              const isTakenByOther = Boolean(
                curClaim &&
                curClaim.doctorFolder &&
                curClaim.doctorFolder.toUpperCase() !== myF &&
                !isClaimExpired(curClaim) &&
                curClaim.status !== "COMPLETED"
              );
              if (isTakenByOther) {
                setDriveSyncLoading(true);
                setDriveSyncLoadingText(`Mẫu ${curIdx} vừa bị nhận bởi ${curClaim?.doctorName || curClaim?.doctorFolder}. Đang tìm mẫu trống...`);
                handleClaimEmptySample(1, false, false, curIdx);
              }
            }
          }
        }
      } catch (err) {
        console.warn("Lỗi khi tải sổ đăng ký claims từ Drive:", err);
      } finally {
        isSyncingRegistryRef.current = false;
        setIsRegistryLoaded(true);
      }
    };

    syncRegistry();
    timer = setInterval(syncRegistry, 35000);

    const handleVisibilityChange = () => {
      if (typeof document !== "undefined" && !document.hidden) {
        // Chỉ kích hoạt lại nếu đã hơn 15 giây kể từ lần đồng bộ trước
        if (Date.now() - lastSyncTimestampRef.current >= 15000) {
          syncRegistry();
        }
      }
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    return () => {
      clearInterval(timer);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
    };
  }, []);

  // Heartbeat định kỳ 10 phút một lần làm tươi updatedAt cho mẫu đang làm dở dang để không bao giờ bị hết hạn TTL
  useEffect(() => {
    if (!activeDoctor || !isRegistryLoaded) return;
    const myFolder = (activeDoctor.folderCode || activeDoctor.id || "BS01").toUpperCase();
    const curClaim = claimsRegistry[currentSampleIndex];
    if (!curClaim || curClaim.doctorFolder?.toUpperCase() !== myFolder || curClaim.status !== "IN_PROGRESS") {
      return;
    }

    // Heartbeat định kỳ 2 phút một lần làm tươi updatedAt cho mẫu đang làm dở dang để không bao giờ bị hết hạn TTL
    const hbTimer = setInterval(() => {
      touchClaimOnDrive(currentSampleIndex, myFolder);
    }, 2 * 60 * 1000);

    return () => clearInterval(hbTimer);
  }, [activeDoctor, isRegistryLoaded, currentSampleIndex, claimsRegistry]);

  const currentSample = useMemo(() => {
    if (allSamples.length === 0) return null;
    const clamped = Math.max(1, Math.min(currentSampleIndex, allSamples.length));
    return allSamples[clamped - 1] || null;
  }, [allSamples, currentSampleIndex]);

  // Tự động phân công độc quyền hoặc khôi phục ca dở dang cho bác sĩ khi đăng nhập
  const hasAutoResumedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!activeDoctor || allSamples.length === 0 || !isRegistryLoaded) return;
    if (hasAutoResumedRef.current === activeDoctor.id) return;

    hasAutoResumedRef.current = activeDoctor.id;
    handleClaimEmptySample(1, true);
  }, [activeDoctor?.id, allSamples.length, isRegistryLoaded, handleClaimEmptySample]);

  useEffect(() => {
    if (!currentSample) return;
    setTimeline(currentSample.timeline);
    setActiveCase({
      case_id: currentSample.userId,
      user_id: currentSample.userId,
      query_time: "",
      visible_history: {
        timeline_id: currentSample.userId,
        up_to_session: `S${String(currentSample.totalSessions).padStart(2, "0")}`,
        up_to_turn: "",
      },
      current_query: "",
      personalization_needed: false,
      category: {
        primary_family: "GENERAL_DENTAL",
        secondary_tags: [],
      },
      targets: { factors: [], memory_events: { relevant_event_ids: [], stale_event_ids: [], forbidden_event_ids: [] } },
      state_snapshots: [],
      evidence_pass1: { target_groups: [], acceptable_chunks: [] },
      evidence_pass2: { target_groups: [], acceptable_chunks: [] },
      clinical_requirements: { must_personalize: false, must_not_use_events: [], must_not_diagnose: true },
    } as unknown as CaseDetail);

    // Tải lại các đánh giá: Ưu tiên bản lưu trong máy, nếu chưa có thì tải trực tiếp từ hệ thống
    if (activeDoctor && currentSample) {
      const targetSampleIndex = currentSample.sampleIndex;
      const targetUserId = currentSample.userId;
      const myF = (activeDoctor.folderCode || activeDoctor.id || "").toUpperCase();

      // Tạm ngưng auto-save draft trong khi đang nạp dữ liệu cho mẫu mới
      loadedSampleIndexRef.current = null;

      const applyLoadedState = (evals: Record<string, "v" | "x">, turns: Record<string, string>, inspected: number[]) => {
        if (currentSampleIndexRef.current !== targetSampleIndex) return;
        setTurnEvaluations(evals);
        setEditedTurns(turns);
        setInspectedSessions(new Set(inspected));
        loadedSampleIndexRef.current = targetSampleIndex;
      };

      let hasLoadedLocal = false;
      let localSavedFileName: string | undefined = undefined;

      // 1. Kiểm tra trước trong bản lưu chính thức trên máy
      try {
        const savedRaw = localStorage.getItem(`nktt_sample_eval_${activeDoctor.id}_${targetSampleIndex}`);
        if (savedRaw) {
          const parsed = JSON.parse(savedRaw);
          if (parsed.fileName) localSavedFileName = parsed.fileName;
          const evals = parsed.turnEvaluations || {};
          const turns = parsed.editedTurns || {};
          const inspected = parsed.inspectedSessions || [];
          if (Object.keys(evals).length > 0 || Object.keys(turns).length > 0) {
            applyLoadedState(evals, turns, inspected);
            hasLoadedLocal = true;
          }
        }
      } catch {}

      // 2. Nếu chưa có, kiểm tra tiếp trong bản lưu nháp trên máy
      if (!hasLoadedLocal) {
        try {
          const draftRaw = localStorage.getItem(`nktt_sample_draft_${activeDoctor.id}_${targetSampleIndex}`);
          if (draftRaw) {
            const parsed = JSON.parse(draftRaw);
            if (parsed.fileName && !localSavedFileName) localSavedFileName = parsed.fileName;
            const evals = parsed.turnEvaluations || {};
            const turns = parsed.editedTurns || {};
            const inspected = parsed.inspectedSessions || [];
            if (Object.keys(evals).length > 0 || Object.keys(turns).length > 0) {
              applyLoadedState(evals, turns, inspected);
              hasLoadedLocal = true;
            }
          }
        } catch {}
      }

      // 3. Nếu chưa có dữ liệu trên máy, tải từ hệ thống Google Drive
      if (!hasLoadedLocal) {
        setTurnEvaluations({});
        setEditedTurns({});
        setInspectedSessions(new Set());

        const targetFolder =
          driveCompletedMap[targetSampleIndex] ||
          claimsRegistry[targetSampleIndex]?.doctorFolder ||
          myF;

        // Ưu tiên tên tập tin có mốc thời gian đã lưu
        let targetFileName =
          claimsRegistry[targetSampleIndex]?.fileName ||
          localSavedFileName;

        if (!targetFileName) {
          try {
            const namesMapRaw = localStorage.getItem(`nktt_sample_file_names_${activeDoctor.id}`);
            if (namesMapRaw) {
              const namesMap = JSON.parse(namesMapRaw);
              if (namesMap[targetSampleIndex]) {
                targetFileName = namesMap[targetSampleIndex];
              }
            }
          } catch {}
        }

        if (!targetFileName) {
          targetFileName = `mau_${String(targetSampleIndex).padStart(3, "0")}_${targetUserId}_${targetFolder}.json`;
        }

        getFileFromDrive(targetFileName, { timeoutMs: 6000, sampleIndex: targetSampleIndex })
          .then((res) => {
            if (res.ok && res.content) {
              try {
                const parsed = JSON.parse(res.content);
                const recoveredEvals: Record<string, "v" | "x"> = {};
                const recoveredTurns: Record<string, string> = {};

                if (Array.isArray(parsed.sessions)) {
                  parsed.sessions.forEach((s: any) => {
                    if (Array.isArray(s.turns)) {
                      s.turns.forEach((t: any) => {
                        if (t.turn_id && t.evaluation) {
                          recoveredEvals[t.turn_id] = t.evaluation;
                        }
                        const orig = (t.original_text !== undefined ? t.original_text : (t.text || "")).toString();
                        const final = (t.final_text !== undefined ? t.final_text : (t.text || "")).toString();
                        if (t.turn_id && (t.was_edited || final.trim() !== orig.trim())) {
                          recoveredTurns[t.turn_id] = final;
                        }
                      });
                    }
                  });
                }

                if (Array.isArray(parsed.edited_turns)) {
                  parsed.edited_turns.forEach((t: any) => {
                    if (t.turn_id && t.text) {
                      recoveredTurns[t.turn_id] = t.text;
                    }
                  });
                }

                applyLoadedState(recoveredEvals, recoveredTurns, []);

                // Lưu bản nạp thành công vào bộ nhớ máy ngay để không bị mất khi chuyển mẫu
                if (Object.keys(recoveredEvals).length > 0 || Object.keys(recoveredTurns).length > 0) {
                  const resolvedFileName = res.fileName || targetFileName;
                  const cachePayload = {
                    fileName: resolvedFileName,
                    turnEvaluations: recoveredEvals,
                    editedTurns: recoveredTurns,
                    inspectedSessions: [],
                    savedAt: parsed.saved_at || new Date().toISOString(),
                  };
                  try {
                    localStorage.setItem(
                      `nktt_sample_eval_${activeDoctor.id}_${targetSampleIndex}`,
                      JSON.stringify(cachePayload)
                    );
                    localStorage.setItem(
                      `nktt_sample_draft_${activeDoctor.id}_${targetSampleIndex}`,
                      JSON.stringify(cachePayload)
                    );
                  } catch {}
                }
              } catch {
                loadedSampleIndexRef.current = targetSampleIndex;
              }
            } else {
              loadedSampleIndexRef.current = targetSampleIndex;
            }
          })
          .catch(() => {
            loadedSampleIndexRef.current = targetSampleIndex;
          });
      }
    }
  }, [currentSample, activeDoctor]);

  // Tự động lưu nháp dữ liệu chấm của mẫu vào bộ nhớ cục bộ
  useEffect(() => {
    if (!currentSample || !activeDoctor) return;
    // Tuyệt đối không lưu nháp nếu dữ liệu trong state chưa được nạp xong cho đúng mẫu hiện tại
    if (loadedSampleIndexRef.current !== currentSample.sampleIndex) return;

    const draftKey = `nktt_sample_draft_${activeDoctor.id}_${currentSample.sampleIndex}`;
    try {
      localStorage.setItem(
        draftKey,
        JSON.stringify({
          turnEvaluations,
          editedTurns,
          inspectedSessions: Array.from(inspectedSessions),
          updatedAt: new Date().toISOString(),
        })
      );
    } catch {}
  }, [currentSample?.sampleIndex, activeDoctor, turnEvaluations, editedTurns, inspectedSessions]);


  // Toàn bộ 500 ca bệnh dùng chung
  const doctorCases = useMemo(() => {
    return allCases;
  }, [allCases]);

  // 10 ca của gói đang chọn (Gói 1 đến Gói 50)
  const batchCases = useMemo(() => {
    if (allCases.length === 0) return [];
    const start = (currentBatchIndex - 1) * 10;
    return allCases.slice(start, start + 10);
  }, [allCases, currentBatchIndex]);

  // Tổng số 50 gói cho 500 ca bệnh
  const totalDoctorBatches = useMemo(() => {
    if (allCases.length === 0) return 50;
    return Math.max(1, Math.ceil(allCases.length / 10));
  }, [allCases]);

  // Tự động chọn ca phù hợp trong gói hiện tại:
  // Luôn bắt đầu từ ca đầu tiên chưa xác nhận trong gói.
  // Nếu gói đã hoàn tất 100% (tất cả 10 ca đã xác nhận), mở Ca 1 để bác sĩ rà soát lại từ đầu.
  useEffect(() => {
    if (batchCases.length > 0) {
      if (!selectedCaseId || !batchCases.some((c) => c.case_id === selectedCaseId)) {
        // 1. Tìm ca đầu tiên chưa được xác nhận trong gói này
        const firstUnconfirmed = batchCases.find((c) => !confirmedCaseIds.has(c.case_id));
        // 2. Mặc định là ca chưa xác nhận đầu tiên, nếu đã xong cả gói thì mở Ca 1 của gói để rà soát
        let targetCaseId = firstUnconfirmed ? firstUnconfirmed.case_id : batchCases[0].case_id;

        // 3. Nếu bác sĩ có lưu ca đang xem dở trong localStorage thuộc gói này
        const isBatchFullyConfirmed = batchCases.every((c) => confirmedCaseIds.has(c.case_id));
        if (activeDoctor && !isBatchFullyConfirmed) {
          try {
            const savedCaseId = localStorage.getItem(`nktt_active_case_${activeDoctor.id}`);
            if (savedCaseId && batchCases.some((c) => c.case_id === savedCaseId)) {
              const savedIdxInBatch = batchCases.findIndex((c) => c.case_id === savedCaseId);
              const isUnlocked =
                savedIdxInBatch === 0 ||
                (savedIdxInBatch > 0 &&
                  batchCases.slice(0, savedIdxInBatch).every((c) => confirmedCaseIds.has(c.case_id)));

              if (isUnlocked) {
                targetCaseId = savedCaseId;
              }
            }
          } catch {}
        }

        setSelectedCaseId(targetCaseId);
        if (activeDoctor) {
          try {
            localStorage.setItem(`nktt_active_case_${activeDoctor.id}`, targetCaseId);
          } catch {}
        }
      }
    }
  }, [batchCases, selectedCaseId, activeDoctor, confirmedCaseIds, doctorCases]);

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

  // Các lần khám hiển thị trên thanh tab: Toàn bộ tất cả các lần khám của người bệnh (đủ tất cả các lần luôn)
  const visibleSessions = useMemo(() => {
    return currentSample?.timeline?.sessions || timeline?.sessions || [];
  }, [currentSample, timeline]);

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
            `${assetBase}/dataset/vident_longmem_500/timelines.jsonl?v=${DATASET_VERSION_TAG}&t=${Date.now()}`,
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
            `${assetBase}/dataset/vident_longmem_500/source_events.jsonl?v=${DATASET_VERSION_TAG}&t=${Date.now()}`,
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

  // Danh sách toàn bộ các câu thoại trong tất cả các lần khám hiển thị của ca
  const allVisibleTurns = useMemo(() => {
    return visibleSessions.flatMap((s) => s.turns || []);
  }, [visibleSessions]);

  // Số lượng câu thoại chưa được chọn (v hoặc x)
  const unevaluatedTurnsCount = useMemo(() => {
    return allVisibleTurns.filter((t) => !turnEvaluations[t.turn_id]).length;
  }, [allVisibleTurns, turnEvaluations]);

  // Số lượng câu thoại đã được chọn đánh giá (v hoặc x)
  const evaluatedTurnsCount = useMemo(() => {
    return allVisibleTurns.length - unevaluatedTurnsCount;
  }, [allVisibleTurns, unevaluatedTurnsCount]);

  // Đã đánh giá toàn bộ câu thoại (v hoặc x) trong tất cả các lần khám
  const hasEvaluatedAllTurns = useMemo(() => {
    if (allVisibleTurns.length === 0) return true;
    return unevaluatedTurnsCount === 0;
  }, [allVisibleTurns, unevaluatedTurnsCount]);

  const isAnyTurnEditing = useMemo(() => {
    return Object.values(editingTurnIds).some(Boolean);
  }, [editingTurnIds]);

  // Yêu cầu thẩm định: Đánh dấu đủ 3 tiêu chuẩn + nhận xét đạt chuẩn + xem qua toàn bộ các lần khám + chọn đủ (v hoặc x) cho mọi câu thoại + không có câu nào đang sửa dở
  const canConfirmCase =
    isChecklistComplete &&
    notesQuality.isValid &&
    hasInspectedAllSessions &&
    hasEvaluatedAllTurns &&
    !isAnyTurnEditing;

  const handleSelectSession = useCallback((idx: number) => {
    if (idx === activeSessionIndex) return;

    // Kiểm tra: Đang có câu thoại mở ô sửa chưa nhấn Xong
    const activeEditingId = Object.keys(editingTurnIds).find((id) => editingTurnIds[id]);
    if (activeEditingId) {
      alert("Bác sĩ vui lòng nhấn \"Xong\" ở câu thoại đang sửa trước khi chuyển sang lần hỏi khác.");
      return;
    }

    // Kiểm tra: Phải tích hết các bubble (đánh giá câu thoại) ở lần hỏi hiện tại mới được chuyển
    const curTurns = timeline?.sessions?.[activeSessionIndex]?.turns || [];
    const unevaluatedTurns = curTurns.filter((t) => !turnEvaluations[t.turn_id]);
    if (unevaluatedTurns.length > 0) {
      alert(`Bác sĩ vui lòng đánh giá đầy đủ tất cả các câu thoại trong Lần hỏi hiện tại (còn ${unevaluatedTurns.length} câu chưa tích) trước khi chuyển sang lần hỏi khác.`);
      return;
    }

    setActiveSessionIndex(idx);
    if (timeline?.sessions?.[idx]) {
      const sNum = timeline.sessions[idx].session_number;
      setInspectedSessions((prev) => {
        if (prev.has(sNum)) return prev;
        const next = new Set(prev);
        next.add(sNum);
        if (activeDoctor && activeCase) {
          try {
            const draftKey = `${DRAFT_PREFIX}${activeDoctor.id}_${activeCase.case_id}`;
            const rawDraft = localStorage.getItem(draftKey);
            const draftObj = rawDraft ? JSON.parse(rawDraft) : {};
            draftObj.inspectedSessions = Array.from(next);
            draftObj.activeSessionIndex = idx;
            draftObj.updatedAt = new Date().toISOString();
            localStorage.setItem(draftKey, JSON.stringify(draftObj));
          } catch {}
        }
        return next;
      });
    }
    setTimeout(() => {
      const chatEl = document.getElementById("clinical-chat-area");
      if (chatEl) {
        chatEl.scrollTo({ top: 0, behavior: "smooth" });
      }
    }, 50);
  }, [timeline, activeDoctor, activeCase, activeSessionIndex, turnEvaluations, editingTurnIds]);

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
      // Kiểm tra khóa tuần tự trong cùng một gói:
      // Ca 1 của gói luôn mở; Ca n mở khi Ca n-1 trong gói đã được xác nhận
      if (!bypassLockCheck) {
        const caseIdxInBatch = batchCases.findIndex((c) => c.case_id === caseId);
        if (caseIdxInBatch > 0) {
          const prevCase = batchCases[caseIdxInBatch - 1];
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
            alert(`Ca ${caseIdxInBatch + 1} trong gói hiện đang khóa. Bác sĩ vui lòng hoàn thành và xác nhận Ca ${caseIdxInBatch} trước.`);
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

        // Cap nhat timeline va events ngay lap tuc
        const uTimeline = cachedTimelinesMap?.get(matched.user_id) || null;
        if (uTimeline) setTimeline(uTimeline);
        const uEvents = cachedEventsMap?.get(matched.user_id) || [];
        if (uEvents.length > 0) setEvents(uEvents);

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
          if (saved.turn_evaluations) {
            setTurnEvaluations(saved.turn_evaluations);
          } else {
            const fallbackEvals: Record<string, "v" | "x"> = {};
            const editedIds = new Set((saved.edited_turns || []).map((t) => t.turn_id));
            uTimeline?.sessions?.forEach((s) => {
              s.turns?.forEach((t) => {
                fallbackEvals[t.turn_id] = editedIds.has(t.turn_id) ? "x" : "v";
              });
            });
            setTurnEvaluations(fallbackEvals);
          }
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
          setTurnEvaluations(draftData.turnEvaluations || {});
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
          setTurnEvaluations({});
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
        setEditingTurnIds({});

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
    [allCases, annotationsMap, activeDoctor, doctorCases, batchCases, confirmedCaseIds]
  );


  const handleConfirmAndNextCase = () => {
    if (!activeCase || !activeDoctor) return;

    // 0. Kiểm tra nếu có câu thoại đang mở sửa mà chưa bấm Xong
    const activeEditingId = Object.keys(editingTurnIds).find((id) => editingTurnIds[id]);
    if (activeEditingId) {
      alert("Bác sĩ vui lòng nhấn \"Xong\" ở câu thoại đang sửa trước khi xác nhận ca bệnh.");
      return;
    }

    // 1. Kiểm tra tất cả câu thoại trong tất cả các lần khám hiển thị đã được đánh giá (v hoặc x) chưa
    for (const sess of visibleSessions) {
      const unselected = (sess.turns || []).filter((t) => !turnEvaluations[t.turn_id]);
      if (unselected.length > 0) {
        alert(
          `Chưa hoàn tất đánh giá: Lần hỏi ${sess.session_number} còn ${unselected.length}/${sess.turns.length} câu thoại chưa được chọn (v hoặc x).\n\n` +
          `Bác sĩ vui lòng chọn đầy đủ trước khi xác nhận ca bệnh.`
        );
        const sessIdx = timeline?.sessions?.findIndex((s) => s.session_id === sess.session_id);
        if (sessIdx !== undefined && sessIdx >= 0) {
          setActiveSessionIndex(sessIdx);
        }
        return;
      }
    }

    // 2. Kiểm tra điều kiện bắt buộc: Bác sĩ phải xem hết các lần khám của ca này
    if (!hasInspectedAllSessions) {
      const uninspected = visibleSessions.filter((s) => !inspectedSessions.has(s.session_number));
      const uninspectedListStr = uninspected.map((s) => `Lần hỏi ${s.session_number}`).join(", ");
      alert(
        `Điều kiện thẩm định: Bác sĩ cần xem hết tất cả các lần hỏi của ca này trước khi bấm xác nhận.\n\n` +
        `Tiến độ hiện tại: Đã xem ${inspectedCount}/${visibleSessions.length} lần hỏi.\n` +
        `Các lần hỏi chưa xem: ${uninspectedListStr}.\n\n` +
        `Hệ thống sẽ tự động chuyển đến lần hỏi chưa xem tiếp theo để Bác sĩ rà soát.`
      );

      // Tự động chuyển ngay đến lần khám chưa xem đầu tiên
      if (uninspected.length > 0) {
        const firstUninspected = uninspected[0];
        const actualIdx = timeline?.sessions?.findIndex((sess) => sess.session_id === firstUninspected.session_id);
        if (actualIdx !== undefined && actualIdx >= 0) {
          handleSelectSession(actualIdx);
        }
      }
      return;
    }

    const success = handleSaveAnnotation();
    if (success) {
      const currentCaseId = activeCase.case_id;
      const currentIdxInBatch = batchCases.findIndex((c) => c.case_id === currentCaseId);
      const doctorCaseIndex = doctorCases.findIndex((c) => c.case_id === currentCaseId);

      if (currentIdxInBatch >= 0 && currentIdxInBatch < batchCases.length - 1) {
        const nextCase = batchCases[currentIdxInBatch + 1];
        handleSelectCase(nextCase.case_id, true);
        setSaveMessage({
          text: `Đã xác nhận Ca ${doctorCaseIndex + 1}/500 (Ca ${currentIdxInBatch + 1}/10 trong Gói ${currentBatchIndex}) thành công. Đã chuyển ngay sang Ca ${doctorCaseIndex + 2}/500.`,
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
          turnEvaluations,
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
    turnEvaluations,
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

  // Handle Turn edit & cross-case auto sync (Đã tối ưu hóa debounce chống giật lag khi gõ phím)
  const handleTurnChange = (turnId: string, text: string) => {
    // Chặn sửa đổi nếu xem mẫu của bác sĩ khác
    const curClaim = claimsRegistry[currentSampleIndex];
    const myF = (activeDoctor?.folderCode || activeDoctor?.id || "").toUpperCase();
    const isOther = Boolean(
      (curClaim && curClaim.doctorFolder && curClaim.doctorFolder.toUpperCase() !== myF && !isClaimExpired(curClaim)) ||
      (driveCompletedMap[currentSampleIndex] && driveCompletedMap[currentSampleIndex].toUpperCase() !== myF)
    );
    if (isOther) return;

    // 1. Cập nhật phản hồi ngay trên giao diện mượt mà 60fps
    const nextEditedTurns = { ...editedTurns, [turnId]: text };
    setEditedTurns(nextEditedTurns);

    // 2. Debounce lưu trữ localStorage sau 400ms khi ngừng gõ để không block giao diện
    if (draftSaveTimerRef.current) {
      clearTimeout(draftSaveTimerRef.current);
    }
    draftSaveTimerRef.current = setTimeout(() => {
      if (activeDoctor && currentSample) {
        try {
          const draftKey = `nktt_sample_draft_${activeDoctor.id}_${currentSample.sampleIndex}`;
          const raw = localStorage.getItem(draftKey);
          const d = raw ? JSON.parse(raw) : {};
          d.editedTurns = nextEditedTurns;
          d.updatedAt = new Date().toISOString();
          localStorage.setItem(draftKey, JSON.stringify(d));
        } catch {}
      }

      if (activeDoctor) {
        try {
          const storageKey = `nktt_shared_turns_v5_${activeDoctor.id}`;
          const raw = localStorage.getItem(storageKey);
          const shared = raw ? JSON.parse(raw) : {};
          shared[turnId] = text;
          localStorage.setItem(storageKey, JSON.stringify(shared));

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
    }, 400);
  };

  // Thao tác đánh giá từng lượt thoại (nút v hoặc x)
  const handleToggleTurnEval = (turnId: string, val: "v" | "x") => {
    // Chặn nếu mẫu thuộc sở hữu của bác sĩ khác và chưa hết hạn TTL
    const curClaim = claimsRegistry[currentSampleIndex];
    const myF = (activeDoctor?.folderCode || activeDoctor?.id || "").toUpperCase();
    const isOther = Boolean(
      (curClaim && curClaim.doctorFolder && curClaim.doctorFolder.toUpperCase() !== myF && !isClaimExpired(curClaim)) ||
      (driveCompletedMap[currentSampleIndex] && driveCompletedMap[currentSampleIndex].toUpperCase() !== myF)
    );
    if (isOther) {
      alert("Mẫu này đã được phân công độc quyền cho bác sĩ khác. Bạn không thể chỉnh sửa mẫu này!");
      return;
    }

    // Nếu mẫu chưa được giữ chỗ hoặc đã hết hạn TTL, giữ chỗ cho bác sĩ này
    if (!curClaim || isClaimExpired(curClaim) || curClaim.doctorFolder?.toUpperCase() !== myF) {
      ensureSampleClaimed(currentSampleIndex);
    }

    // Nếu đang có một câu thoại khác đang ở chế độ sửa chưa nhấn Xong, chặn lại!
    const activeEditingId = Object.keys(editingTurnIds).find((id) => editingTurnIds[id]);
    if (activeEditingId && activeEditingId !== turnId) {
      alert("Bác sĩ vui lòng nhấn \"Xong\" ở câu thoại đang sửa trước khi chuyển qua câu thoại khác.");
      return;
    }

    if (val === "x") {
      // Bấm x thì mở ô cho sửa text luôn
      setTurnEvaluations((prev) => ({
        ...prev,
        [turnId]: "x",
      }));
      setEditingTurnIds((prev) => ({
        ...prev,
        [turnId]: true,
      }));
    } else {
      // val === "v": Đánh dấu chuẩn và đóng ô sửa
      setTurnEvaluations((prev) => {
        const next = { ...prev };
        if (next[turnId] === "v") {
          delete next[turnId];
        } else {
          next[turnId] = "v";
        }
        return next;
      });
      setEditingTurnIds((prev) => ({
        ...prev,
        [turnId]: false,
      }));
    }
  };

  // Thao tác bật/tắt ô chỉnh sửa câu thoại
  const handleToggleTurnEdit = (turnId: string) => {
    // Chặn nếu mẫu thuộc sở hữu của bác sĩ khác và chưa hết hạn TTL
    const curClaim = claimsRegistry[currentSampleIndex];
    const myF = (activeDoctor?.folderCode || activeDoctor?.id || "").toUpperCase();
    const isOther = Boolean(
      (curClaim && curClaim.doctorFolder && curClaim.doctorFolder.toUpperCase() !== myF && !isClaimExpired(curClaim)) ||
      (driveCompletedMap[currentSampleIndex] && driveCompletedMap[currentSampleIndex].toUpperCase() !== myF)
    );
    if (isOther) {
      alert("Mẫu này đã được phân công độc quyền cho bác sĩ khác. Bạn không thể chỉnh sửa mẫu này!");
      return;
    }

    // Nếu mẫu chưa được giữ chỗ hoặc đã hết hạn TTL, giữ chỗ cho bác sĩ này
    if (!curClaim || isClaimExpired(curClaim) || curClaim.doctorFolder?.toUpperCase() !== myF) {
      ensureSampleClaimed(currentSampleIndex);
    }

    const activeEditingId = Object.keys(editingTurnIds).find((id) => editingTurnIds[id]);
    if (activeEditingId && activeEditingId !== turnId) {
      alert("Bác sĩ vui lòng nhấn \"Xong\" ở câu thoại đang sửa trước khi chuyển qua câu thoại khác.");
      return;
    }
    setEditingTurnIds((prev) => ({
      ...prev,
      [turnId]: !prev[turnId],
    }));
  };

  const handleCloseTurnEdit = (turnId: string) => {
    setEditingTurnIds((prev) => ({
      ...prev,
      [turnId]: false,
    }));
  };

  const handleMarkTurnStandard = (turnId: string) => {
    handleToggleTurnEval(turnId, "v");
    setEditingTurnIds((prev) => ({
      ...prev,
      [turnId]: false,
    }));
  };

  const handleRevertTurn = (turnId: string, originalText: string) => {
    setEditedTurns((prev) => {
      const next = { ...prev };
      delete next[turnId];
      if (activeDoctor && currentSample) {
        try {
          const draftKey = `nktt_sample_draft_${activeDoctor.id}_${currentSample.sampleIndex}`;
          const raw = localStorage.getItem(draftKey);
          const d = raw ? JSON.parse(raw) : {};
          d.editedTurns = next;
          d.updatedAt = new Date().toISOString();
          localStorage.setItem(draftKey, JSON.stringify(d));
        } catch {}
      }
      return next;
    });
    setEditingTurnIds((prev) => ({
      ...prev,
      [turnId]: false,
    }));
  };

  // Mở rộng hoặc thu gọn cột bên phải
  const toggleExtendRight = () => {
    if (isRightExtended || rightWidth > 450) {
      setRightWidth(390);
      setIsRightExtended(false);
    } else {
      setRightWidth(600);
      setIsRightExtended(true);
    }
  };

  // Kéo chuột thay đổi kích thước cột bên phải
  const handleMouseDownResizer = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const newWidth = Math.max(300, Math.min(800, window.innerWidth - moveEvent.clientX));
      setRightWidth(newWidth);
      setIsRightExtended(newWidth > 450);
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Mở rộng hoặc đưa về kích thước chuẩn cho cột bên trái
  const toggleExtendLeft = () => {
    if (isLeftCollapsed) {
      setIsLeftCollapsed(false);
      return;
    }
    if (isLeftExtended || leftWidth > 320) {
      setLeftWidth(260);
      setIsLeftExtended(false);
    } else {
      setLeftWidth(380);
      setIsLeftExtended(true);
    }
  };

  // Ẩn hoặc hiện cột bên trái
  const toggleHideLeft = () => {
    setIsLeftCollapsed((prev) => !prev);
  };

  // Kéo chuột thay đổi kích thước cột bên trái
  const handleMouseDownLeftResizer = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingLeftRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const workspaceEl = workspaceRef.current;
    const workspaceLeft = workspaceEl ? workspaceEl.getBoundingClientRect().left : 0;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingLeftRef.current) return;
      const newWidth = Math.max(180, Math.min(520, moveEvent.clientX - workspaceLeft));
      setLeftWidth(newWidth);
      setIsLeftExtended(newWidth > 320);
    };

    const handleMouseUp = () => {
      isDraggingLeftRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
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
  const handleSaveAnnotation = (): boolean => {
    if (!activeCase || !activeDoctor) return false;

    // Chặn tuyệt đối nếu chưa xem hết các lần khám trong ca
    if (!hasInspectedAllSessions) {
      setSaving(false);
      setSaveMessage({
        text: `Cần xem hết tất cả các lần khám trong ca này trước khi xác nhận (Đã xem: ${inspectedCount}/${visibleSessions.length} lần).`,
        isError: true,
      });
      return false;
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

    const hasTurnEdits = editedTurnsList.length > 0;
    const hasTurnFlaggedX = Object.values(turnEvaluations).some((val) => val === "x");
    const hasQueryEdit = Boolean(activeCase.current_query && editedQuery.trim() !== activeCase.current_query.trim());
    let resolvedVerdict: "APPROVED" | "EDITED" | "FLAGGED" = currentVerdict;
    if (currentVerdict === "APPROVED" && (hasTurnEdits || hasQueryEdit || hasTurnFlaggedX)) {
      resolvedVerdict = "EDITED";
    }
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
      turn_evaluations: turnEvaluations,
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
    const allSessionNums = visibleSessions.map((s) => s.session_number);
    if (allSessionNums.length > 0) {
      setInspectedSessions(new Set(allSessionNums));
    }
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

  // Batch switching handler
  const handleSelectBatch = (batchNum: number) => {
    if (batchNum < 1 || batchNum > totalDoctorBatches) return;
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
            turnEvaluations,
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
    setSelectedCaseId(null);
    if (activeDoctor) {
      try {
        localStorage.setItem(`nktt_active_batch_${activeDoctor.id}`, String(batchNum));
      } catch {}
    }
  };

  // Đảm bảo mẫu hiện tại đã được giữ chỗ độc quyền thành công trước khi thao tác
  const ensureSampleClaimed = async (sampleIndex: number): Promise<boolean> => {
    if (!activeDoctor || allSamples.length === 0) return false;
    const myFolder = (activeDoctor.folderCode || activeDoctor.id || "BS01").toUpperCase();
    const curClaim = claimsRegistry[sampleIndex];

    const isCompleted =
      confirmedSampleIds.has(sampleIndex) ||
      Boolean(driveCompletedMap[sampleIndex]) ||
      curClaim?.status === "COMPLETED";

    // Nếu mẫu đã hoàn tất, không cần giữ chỗ lại, cho phép xem hoặc điều chỉnh an toàn
    if (isCompleted) {
      return true;
    }

    // Nếu đã thuộc về bác sĩ này, cho phép thao tác
    if (curClaim && curClaim.doctorFolder && curClaim.doctorFolder.toUpperCase() === myFolder) {
      return true;
    }

    // Nếu thuộc về bác sĩ khác và chưa hết hạn TTL 24h
    if (curClaim && curClaim.doctorFolder && curClaim.doctorFolder.toUpperCase() !== myFolder && !isClaimExpired(curClaim)) {
      setDriveSyncLoading(true);
      setDriveSyncLoadingText(`Mẫu ${sampleIndex} đã thuộc ${curClaim.doctorFolder}. Đang tìm mẫu trống...`);
      setTimeout(() => {
        handleClaimEmptySample(1, false);
      }, 1200);
      return false;
    }

    // Cho phép chuyển sang mẫu mới nếu bác sĩ muốn bỏ ca dở dang để làm lại sau
    const hasOtherInProgress = Object.values(claimsRegistry).find(
      (c) =>
        c &&
        c.status === "IN_PROGRESS" &&
        c.sampleIndex !== sampleIndex &&
        !isClaimExpired(c) &&
        (c.doctorId === activeDoctor.id || c.doctorFolder?.toUpperCase() === myFolder)
    );
    if (hasOtherInProgress) {
      const wantSwitch = window.confirm(
        `Bạn đang có Mẫu ${hasOtherInProgress.sampleIndex} chưa lưu.\n` +
        `Bạn có muốn hủy giữ chỗ Mẫu ${hasOtherInProgress.sampleIndex} để chuyển sang Mẫu ${sampleIndex} không?`
      );
      if (!wantSwitch) {
        setCurrentSampleIndex(hasOtherInProgress.sampleIndex);
        return false;
      }
      try {
        localStorage.removeItem(`nktt_sample_draft_${activeDoctor.id}_${hasOtherInProgress.sampleIndex}`);
      } catch {}
      releaseClaimOnDrive(hasOtherInProgress.sampleIndex, myFolder).catch(() => {});
      setClaimsRegistry((prev) => {
        const next = { ...prev };
        delete next[hasOtherInProgress.sampleIndex];
        return next;
      });
    }

    const sampleItem = allSamples.find((s) => s.sampleIndex === sampleIndex);
    if (!sampleItem) return false;

    try {
      const claimRes = await claimSampleOnDrive(sampleIndex, sampleItem.userId, activeDoctor);
      if (!claimRes.ok) {
        setSaveMessage({
          text: claimRes.error || "Mẫu này vừa được Bác sĩ khác nhận.",
          isError: true,
        });
        setDriveSyncLoading(true);
        setDriveSyncLoadingText(`Đụng độ Mẫu ${sampleIndex}. Đang tìm mẫu trống...`);
        try {
          const regRes = await fetchClaimsRegistry({ timeoutMs: 3000 });
          if (regRes.ok && regRes.registry) setClaimsRegistry(regRes.registry);
        } catch {}
        setTimeout(() => {
          handleClaimEmptySample(1, false);
        }, 1200);
        return false;
      }

      const now = new Date().toISOString();
      setClaimsRegistry((prev) => ({
        ...prev,
        [sampleIndex]: {
          sampleIndex,
          userId: sampleItem.userId,
          doctorFolder: myFolder,
          doctorId: activeDoctor.id,
          doctorName: activeDoctor.name,
          status: "IN_PROGRESS",
          claimedAt: now,
          updatedAt: now,
        },
      }));
      return true;
    } catch {
      return false;
    }
  };

  // Chuyển mẫu nhanh chóng, linh hoạt và tự động xử lý đụng độ với Bác sĩ khác
  const handleSwitchToSample = async (targetIdx: number) => {
    if (targetIdx === currentSampleIndex) return;
    if (!activeDoctor || allSamples.length === 0) {
      setCurrentSampleIndex(targetIdx);
      setActiveSessionIndex(0);
      return;
    }

    const myFolder = (activeDoctor.folderCode || activeDoctor.id || "").toUpperCase();

    const isCurrentCompleted =
      confirmedSampleIds.has(currentSampleIndex) ||
      Boolean(driveCompletedMap[currentSampleIndex]) ||
      claimsRegistry[currentSampleIndex]?.status === "COMPLETED";

    const isMyCurrentClaim =
      claimsRegistry[currentSampleIndex]?.doctorFolder?.toUpperCase() === myFolder;

    // Kiểm tra nếu bác sĩ đang có đánh giá dở dang trên mẫu hiện tại
    const hasEdits =
      Object.keys(turnEvaluations).length > 0 ||
      Object.keys(editedTurns).length > 0;

    if (isMyCurrentClaim && !isCurrentCompleted && hasEdits) {
      const confirmSwitch = window.confirm(
        `Bạn đang có đánh giá dở dang ở Mẫu ${currentSampleIndex}.\n` +
        `Bạn có muốn lưu nháp Mẫu ${currentSampleIndex} để chuyển sang Mẫu ${targetIdx} không?`
      );
      if (!confirmSwitch) return;

      // Lưu nháp mẫu hiện tại trước khi chuyển để bác sĩ không bao giờ bị mất đánh giá
      try {
        localStorage.setItem(
          `nktt_sample_draft_${activeDoctor.id}_${currentSampleIndex}`,
          JSON.stringify({
            turnEvaluations,
            editedTurns,
            inspectedSessions: Array.from(inspectedSessions),
            updatedAt: new Date().toISOString(),
          })
        );
      } catch {}
    } else if (isMyCurrentClaim && !isCurrentCompleted && !hasEdits) {
      // Nếu chưa chỉnh sửa gì trên mẫu hiện tại, tự động nhả quyền giữ chỗ để bác sĩ khác có thể nhận
      releaseClaimOnDrive(currentSampleIndex, myFolder).catch(() => {});
      setClaimsRegistry((prev) => {
        const next = { ...prev };
        delete next[currentSampleIndex];
        return next;
      });
    }

    // Xóa đánh giá hiển thị của mẫu cũ trước khi nạp mẫu mới
    setTurnEvaluations({});
    setEditedTurns({});
    setInspectedSessions(new Set());

    // Thực hiện chuyển mẫu ngay trong state
    setCurrentSampleIndex(targetIdx);
    setActiveSessionIndex(0);

    const curClaim = claimsRegistry[targetIdx];
    const isCompleted =
      confirmedSampleIds.has(targetIdx) ||
      Boolean(driveCompletedMap[targetIdx]) ||
      curClaim?.status === "COMPLETED";

    const isOther = Boolean(
      (curClaim && curClaim.doctorFolder && curClaim.doctorFolder.toUpperCase() !== myFolder && !isClaimExpired(curClaim)) ||
      (driveCompletedMap[targetIdx] && driveCompletedMap[targetIdx].toUpperCase() !== myFolder)
    );

    // Kịch bản 1: Mẫu đã thuộc về Bác sĩ khác hoặc đã hoàn tất -> Cho phép mở xem ở chế độ chỉ đọc
    if (isCompleted || isOther) {
      return;
    }

    // Kịch bản 2: Mẫu trống hoặc mẫu của chính mình -> Đăng ký giữ chỗ trên hệ thống
    if (!curClaim || isClaimExpired(curClaim) || curClaim.doctorFolder?.toUpperCase() === myFolder) {
      const sampleItem = allSamples.find((s) => s.sampleIndex === targetIdx);
      if (sampleItem) {
        const now = new Date().toISOString();
        setClaimsRegistry((prev) => ({
          ...prev,
          [targetIdx]: {
            sampleIndex: targetIdx,
            userId: sampleItem.userId,
            doctorFolder: myFolder,
            doctorId: activeDoctor.id,
            doctorName: activeDoctor.name,
            status: "IN_PROGRESS",
            claimedAt: now,
            updatedAt: now,
          },
        }));

        try {
          const claimRes = await claimSampleOnDrive(targetIdx, sampleItem.userId, activeDoctor);
          if (!claimRes.ok) {
            setSaveMessage({
              text: claimRes.error || "Mẫu này vừa được Bác sĩ khác nhận.",
              isError: true,
            });
            await handleClaimEmptySample(1, false, false, targetIdx);
            return;
          }
        } catch (err) {
          console.warn("Lỗi khi giữ chỗ trên hệ thống:", err);
        }
      }
    }
  };

  // Bác sĩ làm lại mẫu từ đầu (xóa sạch toàn bộ đánh giá dở dang của mẫu chưa lưu)
  const handleResetCurrentSample = () => {
    if (!currentSample || !activeDoctor) return;
    const isConfirmed =
      confirmedSampleIds.has(currentSample.sampleIndex) ||
      Boolean(driveCompletedMap[currentSample.sampleIndex]);
    if (isConfirmed) {
      alert("Mẫu này đã được Lưu hoàn tất lên hệ thống. Không thể đặt lại.");
      return;
    }

    const ok = window.confirm(
      `Bạn có chắc chắn muốn xóa toàn bộ đánh giá dở dang của Mẫu ${currentSample.sampleIndex} để làm lại từ đầu không?`
    );
    if (!ok) return;

    try {
      localStorage.removeItem(`nktt_sample_draft_${activeDoctor.id}_${currentSample.sampleIndex}`);
    } catch {}

    setTurnEvaluations({});
    setEditedTurns({});
    setInspectedSessions(new Set());
    setActiveSessionIndex(0);
    setSaveMessage({
      text: `Đã làm mới Mẫu ${currentSample.sampleIndex}. Bạn có thể bắt đầu đánh giá lại từ đầu.`,
      isError: false,
    });
  };

  // Bác sĩ chủ động nhả mẫu hiện tại (chỉ chính bác sĩ đó mới có quyền nhả)
  const handleReleaseCurrentSample = async () => {
    if (!currentSample || !activeDoctor) return;
    const myFolder = (activeDoctor.folderCode || activeDoctor.id || "BS01").toUpperCase();
    const curClaim = claimsRegistry[currentSample.sampleIndex];
    if (curClaim && curClaim.doctorFolder && curClaim.doctorFolder.toUpperCase() !== myFolder) {
      alert("Bạn không thể nhả mẫu thuộc quyền sở hữu của bác sĩ khác!");
      return;
    }

    setDriveSyncLoading(true);
    setDriveSyncLoadingText(`Đang nhả Mẫu ${currentSample.sampleIndex}...`);
    try {
      try {
        localStorage.removeItem(`nktt_sample_draft_${activeDoctor.id}_${currentSample.sampleIndex}`);
      } catch {}

      setTurnEvaluations({});
      setEditedTurns({});
      setInspectedSessions(new Set());

      setClaimsRegistry((prev) => {
        const next = { ...prev };
        delete next[currentSample.sampleIndex];
        return next;
      });

      await releaseClaimOnDrive(currentSample.sampleIndex, myFolder);
      setSaveMessage({
        text: `Đã nhả Mẫu ${currentSample.sampleIndex} thành công. Mẫu này hiện đã trở về trạng thái trống.`,
        isError: false,
      });
      await handleClaimEmptySample(1, false, false, currentSample.sampleIndex);
    } finally {
      setDriveSyncLoading(false);
    }
  };

  // Lưu thẩm định Mẫu bệnh nhân hiện tại lên Google Drive và máy
  const handleSaveSample = async () => {
    if (!currentSample || !activeDoctor || saving) return;

    // Kiểm tra quyền sở hữu độc quyền (chặn nếu đang thuộc bác sĩ khác và chưa hết hạn TTL)
    const docFolder = (activeDoctor.folderCode || activeDoctor.id || "BS01").toUpperCase();
    const curClaim = claimsRegistry[currentSample.sampleIndex];
    if (curClaim && curClaim.doctorFolder && curClaim.doctorFolder.toUpperCase() !== docFolder && !isClaimExpired(curClaim)) {
      alert(`Mẫu ${currentSample.sampleIndex} đã thuộc quyền sở hữu của ${curClaim.doctorFolder}. Bạn không có quyền lưu mẫu này!`);
      return;
    }

    if (driveCompletedMap[currentSample.sampleIndex]) {
      alert(
        `Mẫu ${currentSample.sampleIndex} đã được Lưu hoàn tất lên hệ thống Google Drive. Theo quy chuẩn thẩm định, Bác sĩ cần đảm bảo chính xác trước khi bấm lưu và không được lưu đè để tránh sai lệch dữ liệu.`
      );
      return;
    }

    if (!hasEvaluatedAllTurns) {
      alert(
        `Cần chọn (v hoặc x) cho tất cả ${allVisibleTurns.length} câu thoại của Mẫu ${currentSample.sampleIndex} trước khi lưu!\n` +
        `Hiện tại còn ${unevaluatedTurnsCount}/${allVisibleTurns.length} câu chưa chọn.`
      );
      return;
    }

    setSaving(true);
    setDriveSyncLoading(true);
    setDriveSyncLoadingText(`Đang lưu Mẫu ${currentSample.sampleIndex} lên hệ thống...`);
    try {
      // Hợp nhất toàn bộ lượt thoại đã sửa từ state và bản nháp cục bộ
      let effectiveEditedTurns = { ...editedTurns };
      try {
        const draftRaw = localStorage.getItem(`nktt_sample_draft_${activeDoctor.id}_${currentSample.sampleIndex}`);
        if (draftRaw) {
          const draftParsed = JSON.parse(draftRaw);
          if (draftParsed.editedTurns) {
            effectiveEditedTurns = { ...draftParsed.editedTurns, ...effectiveEditedTurns };
          }
        }
      } catch {}

      const editedTurnsList: { turn_id: string; speaker: string; text: string; original_text: string }[] = [];

      const sessionsPayload = currentSample.timeline.sessions.map((sess) => ({
        session_id: sess.session_id,
        session_number: sess.session_number,
        session_timestamp: sess.session_timestamp || "",
        turns: sess.turns.map((t) => {
          const origTxt = (t.text !== undefined ? t.text : ((t as any).original_text || "")).toString();
          const hasEdit = effectiveEditedTurns[t.turn_id] !== undefined;
          const finalTxt = hasEdit ? effectiveEditedTurns[t.turn_id] : origTxt;
          const wasEdited = Boolean(hasEdit && effectiveEditedTurns[t.turn_id].trim() !== origTxt.trim());

          if (wasEdited) {
            editedTurnsList.push({
              turn_id: t.turn_id,
              speaker: t.speaker,
              text: finalTxt,
              original_text: origTxt,
            });
          }

          return {
            turn_id: t.turn_id,
            speaker: t.speaker,
            original_text: origTxt,
            final_text: finalTxt,
            evaluation: turnEvaluations[t.turn_id] || "v",
            was_edited: wasEdited,
          };
        }),
      }));

      const saveTimestamp = formatSaveTimestamp();
      const fileName = getSampleFileName(
        currentSample.sampleIndex,
        currentSample.userId,
        docFolder,
        saveTimestamp
      );

      const payload = {
        sample_index: currentSample.sampleIndex,
        user_id: currentSample.userId,
        doctor_folder: docFolder,
        doctor_id: activeDoctor.id,
        doctor_name: activeDoctor.name,
        saved_at: new Date().toISOString(),
        file_name: fileName,
        total_sessions: currentSample.totalSessions,
        total_turns: currentSample.totalTurns,
        all_evaluated: true,
        edited_turns: editedTurnsList.length > 0 ? editedTurnsList : undefined,
        sessions: sessionsPayload,
      };

      const jsonContent = JSON.stringify(payload, null, 2);

      const driveRes = await uploadToDrive({
        fileName,
        content: jsonContent,
        mimeType: "application/json",
        metadata: {
          batchIndex: currentSample.sampleIndex,
          sampleIndex: currentSample.sampleIndex,
          userId: currentSample.userId,
          doctorId: activeDoctor.id,
          doctorName: activeDoctor.name,
          doctorFolder: docFolder,
          fileName,
          isCompleted: true,
        },
      });

      // Chặn báo hoàn tất giả nếu việc lưu lên Google Drive thất bại
      if (!driveRes.ok) {
        const errorText = driveRes.error || "Không thể kết nối hệ thống.";
        setSaveMessage({
          text: `Lưu thất bại: ${errorText}`,
          isError: true,
        });
        alert(`Không thể lưu Mẫu ${currentSample.sampleIndex}:\n${errorText}\n\nVui lòng thử lại!`);
        return;
      }

      // Lưu trữ cục bộ cả đánh giá và bản nháp
      const sampleKey = `nktt_sample_eval_${activeDoctor.id}_${currentSample.sampleIndex}`;
      const evalData = {
        fileName,
        turnEvaluations,
        editedTurns: effectiveEditedTurns,
        inspectedSessions: Array.from(inspectedSessions),
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(sampleKey, JSON.stringify(evalData));

      const draftKey = `nktt_sample_draft_${activeDoctor.id}_${currentSample.sampleIndex}`;
      localStorage.setItem(draftKey, JSON.stringify(evalData));

      try {
        const namesMapKey = `nktt_sample_file_names_${activeDoctor.id}`;
        const existingNamesRaw = localStorage.getItem(namesMapKey);
        const namesMap = existingNamesRaw ? JSON.parse(existingNamesRaw) : {};
        namesMap[currentSample.sampleIndex] = fileName;
        localStorage.setItem(namesMapKey, JSON.stringify(namesMap));
      } catch {}

      const newConfirmed = new Set(confirmedSampleIds);
      newConfirmed.add(currentSample.sampleIndex);
      setConfirmedSampleIds(newConfirmed);
      try {
        localStorage.setItem(`nktt_confirmed_samples_${activeDoctor.id}`, JSON.stringify(Array.from(newConfirmed)));
      } catch {}

      setDriveCompletedMap((prev) => ({ ...prev, [currentSample.sampleIndex]: docFolder }));

      // Cập nhật state registry cục bộ (Server đã tự cập nhật mau_claims_registry.json an toàn với LockService)
      setClaimsRegistry((prev) => ({
        ...prev,
        [currentSample.sampleIndex]: {
          sampleIndex: currentSample.sampleIndex,
          userId: currentSample.userId,
          doctorFolder: docFolder,
          doctorId: activeDoctor.id,
          doctorName: activeDoctor.name,
          status: "COMPLETED" as const,
          fileName,
          claimedAt: prev[currentSample.sampleIndex]?.claimedAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      }));

      setSaveMessage({
        text: `Đã lưu Mẫu ${currentSample.sampleIndex} thành công!`,
        isError: false,
      });

      // Tự động nhận mẫu trống tiếp theo
      setDriveSyncLoadingText(`Đã lưu Mẫu ${currentSample.sampleIndex} thành công. Đang chuyển sang mẫu tiếp theo...`);
      await handleClaimEmptySample(1, false, false, currentSample.sampleIndex);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setSaveMessage({
        text: `Lỗi khi lưu: ${errMsg}`,
        isError: true,
      });
      setDriveSyncLoading(false);
    } finally {
      setSaving(false);
    }
  };

  // Main "Lưu" button handler for the entire batch
  const handleSaveBatch = () => {
    if (!activeDoctor || batchCases.length === 0 || saving) return;

    // 1. Commit ca hiện tại nếu đang mở
    if (activeCase && !confirmedCaseIds.has(activeCase.case_id)) {
      if (!hasInspectedAllSessions) {
        alert(
          `Ca hiện tại (${activeCase.case_id}) chưa được xem hết các lần khám (${inspectedCount}/${visibleSessions.length} lần).\n\n` +
          `Bác sĩ vui lòng rà soát đầy đủ các lần khám và bấm xác nhận ca trước khi Lưu gói.`
        );
        return;
      }
      const savedOk = handleSaveAnnotation();
      if (!savedOk) return;
    }

    // 2. Kiểm tra tất cả 10 ca trong gói đã được bác sĩ bấm xác nhận
    const unconfirmed = batchCases.filter((c) => !confirmedCaseIds.has(c.case_id));
    if (unconfirmed.length > 0) {
      alert(
        `Lưu ý bắt buộc: Bác sĩ cần hoàn thành và bấm xác nhận đủ 10/10 ca trong Gói ${currentBatchIndex} thì mới được lưu gói lên Google Drive.\n\n` +
        `Hiện tại còn ${unconfirmed.length}/10 ca chưa xác nhận (ví dụ ca: ${unconfirmed[0].case_id}).\n\n` +
        `Tiến độ làm việc từng ca của Bác sĩ vẫn đang được hệ thống tự động lưu nháp liên tục trên trình duyệt này.`
      );
      return;
    }

    // Đã xác nhận đủ 10 ca -> thực hiện lưu và mở khóa gói tiếp theo
    executeBatchSaveAndUnlock();
  };

  // Execute batch save and unlock next batch
  const executeBatchSaveAndUnlock = async () => {
    setShowQualityWarning(false);
    if (!activeDoctor || batchCases.length === 0 || saving) return;
    setSaving(true);

    try {
      // Chuẩn hóa mã thư mục bác sĩ (BS01 .. BS05)
      const doctorFolder = (
        activeDoctor.folderCode ||
        activeDoctor.id ||
        "BS01"
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
            const isPatient =
              t.speaker?.toUpperCase() === "PATIENT" ||
              t.speaker?.toUpperCase() === "USER" ||
              t.speaker?.toLowerCase().includes("patient") ||
              t.speaker?.toLowerCase().includes("user");
            return {
              turn_id: t.turn_id,
              speaker: isPatient ? "Người hỏi" : "Bác sĩ / Trợ lý",
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


      // 4. Lưu trực tiếp lên Google Drive qua Google Apps Script Webhook
      setSaveMessage({
        text: `Đang lưu Gói ${currentBatchIndex} trực tiếp lên Google Drive...`,
        isError: false,
      });

      const jsonStr = JSON.stringify(batchData, null, 2);
      let driveUploadSuccess = false;
      let driveMessage = "";

      try {
        const driveResult = await uploadToDrive({
          fileName: `${doctorFolder}_batch_${currentBatchIndex}.json`,
          content: jsonStr,
          mimeType: "application/json",
          folderName: "NKTT_Expert_Evaluations",
          metadata: {
            doctorFolder,
            doctorId: activeDoctor.id,
            doctorName: activeDoctor.name,
            batchIndex: currentBatchIndex,
            caseRange: `${batchCases[0]?.case_id} - ${batchCases[batchCases.length - 1]?.case_id}`,
            totalCases: batchCases.length,
            savedAt: new Date().toISOString(),
          },
        });

        if (driveResult.ok) {
          driveUploadSuccess = true;
          driveMessage = driveResult.message || "Đã lưu thành công lên Google Drive.";
        } else {
          driveMessage = driveResult.error || "Không nhận được phản hồi xác nhận từ Google Drive.";
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        driveMessage = `Lỗi kết nối khi gửi dữ liệu lên Google Drive: ${errMsg}`;
      }

      // 5. Đánh dấu gói đã hoàn thành
      const nextCompleted = Array.from(new Set([...completedBatches, currentBatchIndex]));
      setCompletedBatches(nextCompleted);
      setDriveCompletedBatches((prev) => new Set([...prev, currentBatchIndex]));
      try {
        localStorage.setItem(`nktt_completed_batches_${activeDoctor.id}`, JSON.stringify(nextCompleted));
      } catch {}

      // Tự động tìm gói tiếp theo chưa có ai làm (1 đến 50)
      let nextBatch = -1;
      for (let b = 1; b <= totalDoctorBatches; b++) {
        if (!driveCompletedBatches.has(b) && !nextCompleted.includes(b) && b !== currentBatchIndex) {
          nextBatch = b;
          break;
        }
      }

      if (driveUploadSuccess) {
        setSaveMessage({
          text: `Đã lưu thành công Gói ${currentBatchIndex} lên Google Drive!`,
          isError: false,
        });

        if (nextBatch !== -1) {
          alert(
            `Đã lưu thành công toàn bộ Gói ${currentBatchIndex} lên Google Drive!\n\n` +
            `Hệ thống tự động phát Gói ${nextBatch} (Ca ${(nextBatch - 1) * 10 + 1} - ${nextBatch * 10}/500) để Bác sĩ tiếp tục thẩm định không trùng lặp.`
          );
        } else {
          alert(
            `Chúc mừng Bác sĩ ${activeDoctor.name}!\n\n` +
            `Toàn bộ 50 gói (500 ca bệnh) đã được các Bác sĩ hoàn tất và lưu an toàn trên Google Drive.`
          );
        }
      } else {
        setSaveMessage({
          text: `Gói ${currentBatchIndex} đã được ghi nhận trong phiên làm việc. Cảnh báo Drive: ${driveMessage}`,
          isError: true,
        });

        alert(
          `Đã ghi nhận Gói ${currentBatchIndex} trong phiên làm việc!\n\n` +
          `Lưu ý khi gửi lên Google Drive: ${driveMessage}\n\n` +
          `Dữ liệu thẩm định đã được lưu an toàn trong trình duyệt. Bác sĩ vẫn có thể tiếp tục làm việc bình thường.`
        );
      }

      // Chuyển sang gói tiếp theo nếu có
      if (nextBatch !== -1) {
        setCurrentBatchIndex(nextBatch);
        const nextBatchCases = allCases.slice((nextBatch - 1) * 10, nextBatch * 10);
        if (nextBatchCases.length > 0) {
          const nextFirstCaseId = nextBatchCases[0].case_id;
          setSelectedCaseId(nextFirstCaseId);
          if (activeDoctor) {
            try {
              localStorage.setItem(`nktt_active_case_${activeDoctor.id}`, nextFirstCaseId);
              localStorage.setItem(`nktt_active_batch_${activeDoctor.id}`, String(nextBatch));
            } catch {}
          }
        }
      }
    } finally {
      setSaving(false);
    }
  };

  // Đồng bộ toàn bộ dữ liệu thẩm định lên Google Drive
  const handleExportAnnotations = async () => {
    const stored = getStoredAnnotations();
    const values = Object.values(stored);
    if (values.length === 0) {
      alert("Chưa có ca bệnh nào được lưu xác nhận.");
      return;
    }
    try {
      const res = await syncExpertAnnotationsToDrive(activeDoctor?.name || "Bác sĩ", stored);
      if (res.ok) {
        alert("Đã lưu trực tiếp toàn bộ dữ liệu đánh giá lên Google Drive thành công.");
      } else {
        alert(`Lỗi khi lưu lên Google Drive: ${res.error}`);
      }
    } catch {
      alert("Lỗi kết nối khi gửi dữ liệu lên Google Drive.");
    }
  };

  // Đồng bộ thủ công dữ liệu các gói từ Google Drive về trình duyệt
  const handleManualDriveSync = async () => {
    if (!activeDoctor) return;
    setIsSyncingDrive(true);
    try {
      const docFolder = (
        activeDoctor.folderCode ||
        activeDoctor.id ||
        "BS01"
      ).toUpperCase();

      const driveRes = await fetchDoctorBatchesFromDrive(docFolder);
      if (!driveRes.ok) {
        alert(`Không thể đồng bộ từ Google Drive: ${driveRes.error || "Lỗi kết nối"}`);
        return;
      }

      const driveBatches = Array.isArray(driveRes.batches) ? driveRes.batches : [];
      const driveCompletedIndices = new Set<number>(driveBatches.map((b) => b.batchIndex));
      const sortedCompleted = Array.from(driveCompletedIndices).sort((a, b) => a - b);

      const nextConfirmed = new Set<string>();
      const nextAnnotations: Record<string, ExpertAnnotationRecord> = {};
      const sharedTurnsObj: Record<string, string> = {};

      for (const bItem of driveBatches) {
        const cList = bItem.data?.cases;
        if (Array.isArray(cList)) {
          for (const c of cList) {
            if (c.case_id) {
              nextConfirmed.add(c.case_id);
              const { record, turnsMap } = extractCaseAnnotationFromBatchData(c, activeDoctor.name);
              nextAnnotations[c.case_id] = record;
              Object.assign(sharedTurnsObj, turnsMap);
            }
          }
        }
      }

      // Xóa nháp của các gói không tồn tại trên Drive
      for (let b = 1; b <= 50; b++) {
        if (!driveCompletedIndices.has(b)) {
          try {
            localStorage.removeItem(`nktt_batch_draft_${activeDoctor.id}_${b}`);
          } catch {}
        }
      }

      // Quét thêm toàn bộ tóm tắt các bác sĩ khác trên Drive
      const allSummaryRes = await fetchAllBatchesSummaryFromDrive({ timeoutMs: 5000 });
      const globalCompleted = new Set<number>(driveCompletedIndices);
      if (allSummaryRes.ok && allSummaryRes.summary) {
        Object.values(allSummaryRes.summary).forEach((bList) => {
          if (Array.isArray(bList)) {
            bList.forEach((b) => globalCompleted.add(b));
          }
        });
      }
      setDriveCompletedBatches(globalCompleted);

      const sortedConfirmed = Array.from(nextConfirmed);
      setCompletedBatches(sortedCompleted);
      setConfirmedCaseIds(nextConfirmed);
      setAnnotationsMap(nextAnnotations);

      localStorage.setItem(`nktt_completed_batches_${activeDoctor.id}`, JSON.stringify(sortedCompleted));
      localStorage.setItem(`nktt_confirmed_cases_${activeDoctor.id}`, JSON.stringify(sortedConfirmed));
      localStorage.setItem(`nktt_doctor_annotations_${activeDoctor.id}`, JSON.stringify(nextAnnotations));
      localStorage.setItem(`nktt_shared_turns_v5_${activeDoctor.id}`, JSON.stringify(sharedTurnsObj));

      setEditedTurns(sharedTurnsObj);
      if (selectedCaseId && nextAnnotations[selectedCaseId]) {
        const cur = nextAnnotations[selectedCaseId];
        setEditedQuery(cur.edited_query || "");
        setClinicalNotes(cur.clinical_notes || "");
        setCurrentVerdict(cur.verdict || "APPROVED");
      }

      let nextBatch = 1;
      for (let b = 1; b <= 50; b++) {
        if (!globalCompleted.has(b)) {
          nextBatch = b;
          break;
        }
      }
      setCurrentBatchIndex(nextBatch);

      alert(
        `Đồng bộ thành công từ Google Drive!\n\n` +
        `- Toàn hệ thống: ${globalCompleted.size}/50 gói đã hoàn tất trên Google Drive\n` +
        `- Gói bác sĩ này đã lưu: ${sortedCompleted.length} gói (${sortedConfirmed.length} ca)`
      );
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      alert(`Lỗi khi đồng bộ Google Drive: ${errMsg}`);
    } finally {
      setIsSyncingDrive(false);
    }
  };

  // Doctor profile badge click -> confirm if switching while current batch in progress
  const handleOpenDoctorModal = () => {
    if (activeDoctor && !completedBatches.includes(currentBatchIndex) && currentBatchConfirmedCount > 0) {
      const confirmSwitch = window.confirm(
        `Lưu ý quan trọng: Gói ${currentBatchIndex} đang thẩm định dở dang (${currentBatchConfirmedCount}/10 ca).\n\n` +
        `Bác sĩ cần hoàn thành đủ 10/10 ca và bấm nút "Lưu Gói ${currentBatchIndex}" thì dữ liệu mới được đồng bộ lên Google Drive.\n\n` +
        `Bác sĩ có chắc chắn muốn chuyển đổi tài khoản Bác sĩ không?`
      );
      if (!confirmSwitch) return;
    }
    setShowDoctorModal(true);
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
      {/* Man hinh loading dong bo he thong */}
      {driveSyncLoading && (() => {
        const isCollision = driveSyncLoadingText.includes("đụng độ") || driveSyncLoadingText.includes("thuộc");
        // Trich xuat ten bac si tu text loading: "Mau X thuoc Y. ..." hoac "Dung do Mau X..."
        const matchDoctor = driveSyncLoadingText.match(/thu\u1ed9c\s+([^\s.]+)/);
        const otherDrName = matchDoctor ? matchDoctor[1] : null;
        const matchSample = driveSyncLoadingText.match(/M\u1eabu\s+(\d+)/);
        const collidedSample = matchSample ? matchSample[1] : null;

        return (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(15, 23, 42, 0.50)",
              backdropFilter: "blur(4px)",
              zIndex: 99999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {isCollision ? (
              /* Card UI khi dung do */
              <div
                style={{
                  backgroundColor: "#fff",
                  border: "2px solid #f59e0b",
                  borderRadius: "16px",
                  padding: "2rem 2.4rem",
                  boxShadow: "0 24px 50px rgba(0,0,0,0.28)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "1rem",
                  maxWidth: "400px",
                  textAlign: "center",
                }}
              >
                {/* Icon canh bao */}
                <div
                  style={{
                    width: "56px",
                    height: "56px",
                    borderRadius: "50%",
                    backgroundColor: "#fef3c7",
                    border: "2px solid #f59e0b",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1.6rem",
                  }}
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                </div>

                <div style={{ fontWeight: 700, fontSize: "1.05rem", color: "#92400e" }}>
                  {otherDrName
                    ? `BS ${otherDrName} đang làm mẫu này`
                    : "Bác sĩ khác đang làm mẫu này"}
                </div>

                <div style={{ fontSize: "0.85rem", color: "#78350f", lineHeight: 1.6 }}>
                  {collidedSample
                    ? `Mẫu ${collidedSample} vừa được nhận bởi bác sĩ khác.`
                    : driveSyncLoadingText}
                  <br />
                  <span style={{ color: "#92400e", fontWeight: 500 }}>Đang tự động tìm mẫu trống khác...</span>
                </div>

                {/* Progress bar dong tien */}
                <div
                  style={{
                    width: "100%",
                    height: "4px",
                    backgroundColor: "#fde68a",
                    borderRadius: "2px",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      backgroundColor: "#f59e0b",
                      borderRadius: "2px",
                      animation: "slideProgress 1.4s ease-in-out infinite",
                    }}
                  />
                </div>
              </div>
            ) : (
              /* Card loading binh thuong */
              <div
                style={{
                  backgroundColor: "#ffffff",
                  border: "1.5px solid #2563eb",
                  borderRadius: "12px",
                  padding: "1.6rem 2.2rem",
                  boxShadow: "0 20px 45px rgba(0, 0, 0, 0.25)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "0.9rem",
                  maxWidth: "430px",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    width: "44px",
                    height: "44px",
                    border: "4px solid #f1f5f9",
                    borderTopColor: "#2563eb",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                  }}
                />
                <div style={{ fontWeight: 700, fontSize: "1.05rem", color: "#0f172a" }}>
                  {driveSyncLoadingText.includes("lưu") || driveSyncLoadingText.includes("Lưu")
                    ? "Đang lưu dữ liệu"
                    : driveSyncLoadingText.includes("Mẫu") || driveSyncLoadingText.includes("mẫu")
                    ? "Đang chuyển mẫu"
                    : "Đang đồng bộ hệ thống"}
                </div>
                <div style={{ fontSize: "0.88rem", color: "#475569", lineHeight: 1.55 }}>
                  {driveSyncLoadingText || "Đang kết nối hệ thống. Vui lòng đợi..."}
                </div>
              </div>
            )}
          </div>
        );
      })()}


      {/* Top Header - Minimal Single Line with 1 Box Only, No Loose Text */}
      <header className={styles.topBarMinimal}>
        <div className={styles.topBarMinimalLeft}>
          {/* Doctor Profile Badge */}
          <button
            type="button"
            className={styles.doctorNameMinimal}
            onClick={handleOpenDoctorModal}
            title="Bấm để chuyển đổi Bác sĩ chuyên khoa"
          >
            {activeDoctor?.name || "Bác sĩ thẩm định"}
          </button>

          <div className={styles.batchDivider} />

          {/* Điều hướng 125 Mẫu: Tối giản CHỈ CÒN 1 BOX, không có text riêng */}
          <div className={styles.batchControlsMinimal}>

            {/* 1 BOX DUY NHẤT */}
            <select
              className={styles.sampleSelectMinimal}
              value={currentSampleIndex}
              onChange={(e) => handleSwitchToSample(Number(e.target.value))}
              title="Chọn mẫu bệnh nhân (1 - 125)"
            >
              {allSamples.map((s) => {
                const claim = claimsRegistry[s.sampleIndex];
                const isConfirmedHere = confirmedSampleIds.has(s.sampleIndex);
                const myFolder = (activeDoctor?.folderCode || activeDoctor?.id || "").toUpperCase();
                let tag = "[Chưa có ai nhận]";

                if (claim) {
                  const isMine = claim.doctorFolder && claim.doctorFolder.toUpperCase() === myFolder;
                  if (claim.status === "COMPLETED" || isConfirmedHere) {
                    tag = isMine ? `[Đã xong - Của bạn]` : `[Đã xong - ${claim.doctorFolder}]`;
                  } else if (isClaimExpired(claim)) {
                    tag = `[Chưa có ai nhận]`;
                  } else {
                    tag = isMine ? `[ĐANG LÀM DỞ DANG - Cần hoàn thành]` : `[Đã giao ${claim.doctorFolder} - Đã khóa]`;
                  }
                } else if (driveCompletedMap[s.sampleIndex]) {
                  const isMine = driveCompletedMap[s.sampleIndex].toUpperCase() === myFolder;
                  tag = isMine ? `[Đã xong - Của bạn]` : `[Đã xong - ${driveCompletedMap[s.sampleIndex]}]`;
                } else if (isConfirmedHere) {
                  tag = `[Đã xong - Của bạn]`;
                }

                return (
                  <option key={s.sampleIndex} value={s.sampleIndex}>
                    Mẫu {s.sampleIndex}/125 {tag}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        <div className={styles.topBarMinimalRight}>
          {/* Nút Quy định */}
          <button
            type="button"
            className={styles.rulesBtn}
            onClick={() => setShowRulesModal(true)}
            title="Xem lại 5 nguyên tắc và cam kết thẩm định lâm sàng"
          >
            Quy định
          </button>

          {/* Nút Ví dụ */}
          <button
            type="button"
            className={styles.exampleModalBtn}
            onClick={() => setShowExampleModal(true)}
            title="Xem bảng mẫu đối chiếu hồ sơ trước và sau khi thẩm định"
          >
            Ví dụ
          </button>



          {/* Nút Save (Lưu) */}
          {(() => {
            const curClaim = claimsRegistry[currentSampleIndex];
            const myF = (activeDoctor?.folderCode || activeDoctor?.id || "").toUpperCase();
            const isOther = Boolean(
              (curClaim && curClaim.doctorFolder && curClaim.doctorFolder.toUpperCase() !== myF && !isClaimExpired(curClaim)) ||
              (driveCompletedMap[currentSampleIndex] && driveCompletedMap[currentSampleIndex].toUpperCase() !== myF)
            );
            const otherCode = curClaim?.doctorFolder || driveCompletedMap[currentSampleIndex] || "Bác sĩ khác";

            return (
              <button
                type="button"
                className={[
                  styles.saveMainBtn,
                  hasEvaluatedAllTurns && !saving && !driveCompletedMap[currentSampleIndex] && !isOther
                    ? styles.saveMainBtnReady
                    : styles.saveMainBtnLocked,
                ].join(" ")}
                onClick={handleSaveSample}
                disabled={saving || isOther || Boolean(driveCompletedMap[currentSampleIndex])}
                style={{ padding: "0.25rem 0.65rem", fontSize: "0.75rem" }}
                title={
                  isOther
                    ? `Mẫu này đã thuộc ${otherCode}`
                    : driveCompletedMap[currentSampleIndex]
                    ? `Mẫu ${currentSampleIndex} đã lưu bởi ${driveCompletedMap[currentSampleIndex]}`
                    : saving
                    ? "Đang lưu..."
                    : !hasEvaluatedAllTurns
                    ? `Cần đánh giá đủ ${allVisibleTurns.length} câu thoại (đã làm ${evaluatedTurnsCount}/${allVisibleTurns.length})`
                    : `Lưu Mẫu ${currentSampleIndex}`
                }
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
                  {confirmedSampleIds.has(currentSampleIndex) || driveCompletedMap[currentSampleIndex] ? (
                    <polyline points="20 6 9 17 4 12" />
                  ) : (
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                  )}
                </svg>
                <span>
                  {isOther
                    ? `Khóa (${otherCode})`
                    : driveCompletedMap[currentSampleIndex]
                    ? `Đã lưu (${driveCompletedMap[currentSampleIndex]})`
                    : saving
                    ? "Đang lưu..."
                    : hasEvaluatedAllTurns
                    ? `Lưu Mẫu ${currentSampleIndex}`
                    : `Lưu (${evaluatedTurnsCount}/${allVisibleTurns.length})`}
                </span>
              </button>
            );
          })()}
        </div>
      </header>

      {/* Cảnh báo nếu mẫu đã lưu hoặc đang làm trên Drive bởi bác sĩ khác */}
      {(() => {
        const curClaim = claimsRegistry[currentSampleIndex];
        const myF = (activeDoctor?.folderCode || activeDoctor?.id || "").toUpperCase();
        const isOther = Boolean(
          (curClaim && curClaim.doctorFolder && curClaim.doctorFolder.toUpperCase() !== myF && !isClaimExpired(curClaim)) ||
          (driveCompletedMap[currentSampleIndex] && driveCompletedMap[currentSampleIndex].toUpperCase() !== myF)
        );
        if (!isOther) return null;

        const otherCode = curClaim?.doctorFolder || driveCompletedMap[currentSampleIndex] || "Bác sĩ khác";
        const isCompleted = curClaim?.status === "COMPLETED" || Boolean(driveCompletedMap[currentSampleIndex]);

        return (
          <div
            className={styles.batchDriveLockedAlert}
            style={{
              padding: "0.35rem 0.75rem",
              fontSize: "0.8rem",
              backgroundColor: "#fef2f2",
              border: "1px solid #fca5a5",
              color: "#991b1b",
            }}
          >
            <div className={styles.batchDriveLockedAlertText}>
              <span style={{ fontWeight: 600 }}>
                {isCompleted
                  ? `Mẫu ${currentSampleIndex} đã hoàn tất bởi ${otherCode}.`
                  : `Mẫu ${currentSampleIndex} đã được phân công cho ${otherCode}.`}
              </span>
            </div>
            <div style={{ display: "flex", gap: "0.35rem", alignItems: "center" }}>
              <button
                type="button"
                className={styles.batchNavAutoBtn}
                onClick={() => {
                  setDriveSyncLoading(true);
                  setDriveSyncLoadingText("Đang tìm mẫu trống tiếp theo...");
                  handleClaimEmptySample(1, false);
                }}
                style={{
                  padding: "0.2rem 0.65rem",
                  fontSize: "0.75rem",
                  backgroundColor: "#2563eb",
                  color: "#ffffff",
                  borderColor: "#1d4ed8",
                }}
              >
                Chuyển sang mẫu chưa làm
              </button>
            </div>
          </div>
        );
      })()}

      {/* Thong bao neu mau tung duoc giu cho nhung da het han giu cho (qua 30 phut khong hoat dong) */}
      {(() => {
        const curClaim = claimsRegistry[currentSampleIndex];
        const myF = (activeDoctor?.folderCode || activeDoctor?.id || "").toUpperCase();
        const isAbandoned = Boolean(
          curClaim &&
          curClaim.doctorFolder &&
          curClaim.doctorFolder.toUpperCase() !== myF &&
          curClaim.status !== "COMPLETED" &&
          isClaimExpired(curClaim) &&
          !driveCompletedMap[currentSampleIndex]
        );
        if (!isAbandoned) return null;

        return (
          <div
            className={styles.batchDriveLockedAlert}
            style={{
              padding: "0.35rem 0.75rem",
              fontSize: "0.8rem",
              backgroundColor: "#fffbeb",
              border: "1px solid #fcd34d",
              color: "#92400e",
            }}
          >
            <div className={styles.batchDriveLockedAlertText}>
              <span style={{ fontWeight: 600 }}>
                {`Mẫu ${currentSampleIndex} chưa có ai nhận. Bạn có thể tiếp nhận và bắt đầu thẩm định.`}
              </span>
            </div>
            <div style={{ display: "flex", gap: "0.35rem", alignItems: "center" }}>
              <button
                type="button"
                className={styles.batchNavAutoBtn}
                onClick={async () => {
                  setDriveSyncLoading(true);
                  setDriveSyncLoadingText(`Đang tiếp quản Mẫu ${currentSampleIndex}...`);
                  const sampleItem = allSamples.find((s) => s.sampleIndex === currentSampleIndex);
                  if (sampleItem && activeDoctor) {
                    const claimRes = await claimSampleOnDrive(currentSampleIndex, sampleItem.userId, activeDoctor);
                    if (claimRes.ok) {
                      const now = new Date().toISOString();
                      setClaimsRegistry((prev) => ({
                        ...prev,
                        [currentSampleIndex]: {
                          sampleIndex: currentSampleIndex,
                          userId: sampleItem.userId,
                          doctorFolder: myF,
                          doctorId: activeDoctor.id,
                          doctorName: activeDoctor.name,
                          status: "IN_PROGRESS",
                          claimedAt: now,
                          updatedAt: now,
                        },
                      }));
                    }
                  }
                  setDriveSyncLoading(false);
                }}
                style={{
                  padding: "0.2rem 0.65rem",
                  fontSize: "0.75rem",
                  backgroundColor: "#d97706",
                  color: "#ffffff",
                  borderColor: "#b45309",
                }}
              >
                Tiếp quản mẫu này
              </button>
            </div>
          </div>
        );
      })()}

      {/* Main Workspace: 100% Focused on Clinical Chat Review */}
      <div
        ref={workspaceRef}
        className={styles.workspace}
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
        }}
      >

            {/* Center Column: Query Editor & Dialogue Timeline */}
            <section className={styles.mainContent} aria-label="Nội dung hội thoại">
              {loadingList ? (
                <div className={styles.emptyPlaceholder}>Đang nạp dữ liệu 125 mẫu hồ sơ...</div>
              ) : !currentSample ? (
                <div className={styles.emptyPlaceholder}>Vui lòng chọn một mẫu bệnh nhân ở thanh trên để thẩm định</div>
              ) : (
                <>
                  {/* Dialogue Timeline */}
                  <div key={`sample-timeline-${currentSampleIndex}`} className={styles.timelineCard}>
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
                            const sTurns = s.turns || [];
                            const sEvalCount = sTurns.filter((t) => Boolean(turnEvaluations[t.turn_id])).length;
                            const isSessTurnsDone = sTurns.length === 0 || sEvalCount === sTurns.length;
                            const curTurns = currentSession?.turns || [];
                            const curUnselected = curTurns.filter((t) => !turnEvaluations[t.turn_id]).length;
                            const isCurrentDone = curTurns.length === 0 || curUnselected === 0;

                            return (
                              <button
                                key={s.session_id}
                                type="button"
                                className={[
                                  styles.sessionPill,
                                  isSelected ? styles.sessionPillActive : "",
                                  isSessTurnsDone && !isSelected ? styles.sessionPillCompleted : "",
                                  !isSessTurnsDone && !isSelected ? styles.sessionPillUnread : "",
                                ]
                                  .filter(Boolean)
                                  .join(" ")}
                                onClick={() => {
                                  if (!isSelected && !isCurrentDone) {
                                    alert(`Bác sĩ vui lòng đánh giá đầy đủ tất cả các câu thoại trong Lần hỏi hiện tại (còn ${curUnselected} câu chưa chọn) trước khi chuyển sang lần hỏi khác.`);
                                    return;
                                  }
                                  if (actualIdx >= 0) handleSelectSession(actualIdx);
                                }}
                                style={{
                                  cursor: isSelected || isCurrentDone ? "pointer" : "not-allowed",
                                  opacity: !isSelected && !isCurrentDone ? 0.65 : 1,
                                }}
                                title={
                                  !isSelected && !isCurrentDone
                                    ? `Cần tích đủ các câu thoại ở Lần hỏi hiện tại (còn ${curUnselected} câu) trước khi chuyển`
                                    : `Lần hỏi ${s.session_number}: ${
                                        sTurns.length > 0
                                          ? `Đã chọn ${sEvalCount}/${sTurns.length} câu thoại`
                                          : "Không có câu thoại"
                                      }`
                                }
                              >
                                <span>Lần hỏi {s.session_number}</span>
                                <span style={{ fontSize: "0.65rem", marginLeft: "2px", opacity: 0.85 }}>
                                  {sTurns.length > 0
                                    ? isSessTurnsDone
                                      ? "(Đã chọn đủ)"
                                      : `(${sEvalCount}/${sTurns.length})`
                                    : isInspected ? "(Đã xem)" : "(Chưa xem)"}
                                </span>
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

                    <div id="clinical-chat-area" className={styles.chatArea}>
                      {!currentSession ? (
                        <div className={styles.emptyPlaceholder}>
                          Ca bệnh này là câu hỏi độc lập, chưa ghi nhận hồ sơ khám trước đó
                        </div>
                      ) : (
                        <div className={styles.sessionChatContainer}>
                          <div className={styles.sessionChatHeader}>
                            <span>
                              Chi tiết Lần hỏi {currentSession.session_number}
                              {currentSession.session_timestamp &&
                                ` - Ngày: ${new Date(currentSession.session_timestamp).toLocaleDateString("vi-VN")}`}
                            </span>
                            <span style={{ fontWeight: "normal", color: "var(--color-text-muted)" }}>
                              (Gồm {currentSession.turns.length} lượt trao đổi)
                            </span>
                          </div>

                          <div className={styles.turnsList}>
                            {(() => {
                              const activeEditingId = Object.keys(editingTurnIds).find((id) => editingTurnIds[id]) || null;
                              return currentSession.turns.map((turn) => {
                                const isDoctor =
                                  turn.speaker?.toLowerCase().includes("doctor") ||
                                  turn.speaker?.toLowerCase().includes("assistant");
                                const origTurnText = (turn.text !== undefined ? turn.text : ((turn as any).original_text || "")).toString();
                                const currentTurnText =
                                  editedTurns[turn.turn_id] !== undefined
                                    ? editedTurns[turn.turn_id]
                                    : origTurnText;
                                const isModified =
                                  editedTurns[turn.turn_id] !== undefined &&
                                  editedTurns[turn.turn_id].trim() !== origTurnText.trim();
                                const isEditing = Boolean(editingTurnIds[turn.turn_id]);
                                const isOtherEditing = Boolean(activeEditingId && activeEditingId !== turn.turn_id);
                                const currentEval = turnEvaluations[turn.turn_id];
                                const isV = currentEval === "v";
                                const isX = currentEval === "x";

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
                                          {/* Nút x hoặc v: bấm x thì mở ô sửa text luôn, bắt buộc nhấn xong để chuyển qua bubble khác */}
                                          <div
                                            className={[
                                              styles.bubbleActionGroup,
                                              !currentEval ? styles.bubbleActionGroupUnselected : "",
                                              isOtherEditing ? styles.bubbleActionGroupBlocked : "",
                                            ]
                                              .filter(Boolean)
                                              .join(" ")}
                                          >
                                            <button
                                              type="button"
                                              className={[
                                                styles.bubbleBtnV,
                                                isV ? styles.bubbleBtnVActive : "",
                                              ].filter(Boolean).join(" ")}
                                              onClick={() => handleToggleTurnEval(turn.turn_id, "v")}
                                              title={
                                                isOtherEditing
                                                  ? "Vui lòng nhấn Xong ở câu thoại đang sửa trước khi chuyển qua câu khác"
                                                  : isV
                                                  ? "Đã chọn: v (Chuẩn rồi) - Bấm lại để bỏ chọn"
                                                  : "v: Chuẩn rồi - Đạt chuẩn lâm sàng"
                                              }
                                            >
                                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
                                            </button>
                                            <button
                                              type="button"
                                              className={[
                                                styles.bubbleBtnX,
                                                isX ? styles.bubbleBtnXActive : "",
                                              ].filter(Boolean).join(" ")}
                                              onClick={() => handleToggleTurnEval(turn.turn_id, "x")}
                                              title={
                                                isOtherEditing
                                                  ? "Vui lòng nhấn Xong ở câu thoại đang sửa trước khi chuyển qua câu khác"
                                                  : isX && isEditing
                                                  ? "Đang mở ô chỉnh sửa"
                                                  : isX
                                                  ? "Đã chọn: x (Chưa chuẩn) - Bấm để mở lại ô sửa"
                                                  : "x: Chưa chuẩn - Bấm để mở ô sửa text"
                                              }
                                            >
                                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                                            </button>
                                          </div>

                                          {isX && !isEditing && (
                                            <button
                                              type="button"
                                              className={styles.bubbleEditToggleBtn}
                                              onClick={() => handleToggleTurnEdit(turn.turn_id)}
                                              title={isOtherEditing ? "Vui lòng nhấn Xong ở câu thoại đang sửa" : "Mở lại ô chỉnh sửa nội dung"}
                                            >
                                              <span>Sửa lại</span>
                                            </button>
                                          )}

                                          {isModified && (
                                            <button
                                              type="button"
                                              className={styles.bubbleRevertBtn}
                                              onClick={() => handleRevertTurn(turn.turn_id, origTurnText)}
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

                                      {isEditing ? (
                                        <div className={styles.bubbleEditWrapper}>
                                          <AutoExpandingTextarea
                                            value={currentTurnText}
                                            onChange={(e) => handleTurnChange(turn.turn_id, e.target.value)}
                                            className={styles.bubbleTextarea}
                                            placeholder="Nội dung câu thoại..."
                                            title="Đang chỉnh sửa nội dung lượt thoại này"
                                          />
                                          <div className={styles.bubbleEditFooter}>
                                            <span className={styles.bubbleEditStatus}>
                                              Đang sửa câu thoại (Bắt buộc nhấn Xong để hoàn tất)
                                            </span>
                                            <button
                                              type="button"
                                              className={styles.bubbleCloseEditBtn}
                                              onClick={() => handleCloseTurnEdit(turn.turn_id)}
                                              title="Nhấn Xong để hoàn tất chỉnh sửa và tiếp tục câu khác"
                                            >
                                              <span>Xong</span>
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        <p className={styles.bubbleTextReadonly}>{currentTurnText}</p>
                                      )}
                                    </div>
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        </div>
                      )}

                      {visibleSessions.length > 1 && (
                        <div className={styles.chatSessionNav}>
                          <div>
                            {(() => {
                              const curVisIdx = visibleSessions.findIndex(
                                (s) => s.session_id === currentSession?.session_id
                              );
                              if (curVisIdx > 0) {
                                const prevSess = visibleSessions[curVisIdx - 1];
                                const prevActualIdx = timeline?.sessions?.findIndex(
                                  (sess) => sess.session_id === prevSess.session_id
                                ) ?? -1;
                                const curTurns = currentSession?.turns || [];
                                const curUnselected = curTurns.filter((t) => !turnEvaluations[t.turn_id]).length;
                                const isCurDone = curTurns.length === 0 || curUnselected === 0;

                                return (
                                  <button
                                    type="button"
                                    className={styles.chatSessionNavBtn}
                                    onClick={() => {
                                      if (!isCurDone) {
                                        alert(`Bác sĩ vui lòng đánh giá đầy đủ tất cả các câu thoại trong Lần hỏi hiện tại (còn ${curUnselected} câu chưa chọn) trước khi chuyển về Lần hỏi ${prevSess.session_number}.`);
                                        return;
                                      }
                                      if (prevActualIdx >= 0) handleSelectSession(prevActualIdx);
                                    }}
                                    disabled={!isCurDone}
                                    style={{
                                      opacity: isCurDone ? 1 : 0.55,
                                      cursor: isCurDone ? "pointer" : "not-allowed",
                                    }}
                                    title={
                                      isCurDone
                                        ? `Chuyển về xem Lần hỏi ${prevSess.session_number}`
                                        : `Cần tích đủ các câu thoại ở Lần hỏi hiện tại (còn ${curUnselected} câu) để chuyển về Lần hỏi ${prevSess.session_number}`
                                    }
                                  >
                                    <span>&larr; Xem Lần hỏi {prevSess.session_number}</span>
                                  </button>
                                );
                              }
                              return null;
                            })()}
                          </div>


                          <div>
                            {(() => {
                              const curVisIdx = visibleSessions.findIndex(
                                (s) => s.session_id === currentSession?.session_id
                              );
                              if (curVisIdx >= 0 && curVisIdx < visibleSessions.length - 1) {
                                const nextSess = visibleSessions[curVisIdx + 1];
                                const nextActualIdx = timeline?.sessions?.findIndex(
                                  (sess) => sess.session_id === nextSess.session_id
                                ) ?? -1;
                                const curTurns = currentSession?.turns || [];
                                const curUnselected = curTurns.filter((t) => !turnEvaluations[t.turn_id]).length;
                                const isCurDone = curTurns.length === 0 || curUnselected === 0;

                                return (
                                  <button
                                    type="button"
                                    className={[
                                      styles.chatSessionNavBtn,
                                      styles.chatSessionNavNext,
                                    ]
                                      .filter(Boolean)
                                      .join(" ")}
                                    onClick={() => {
                                      if (!isCurDone) {
                                        alert(`Bác sĩ vui lòng đánh giá đầy đủ tất cả các câu thoại trong Lần hỏi hiện tại (còn ${curUnselected} câu chưa chọn) trước khi chuyển sang Lần hỏi ${nextSess.session_number}.`);
                                        return;
                                      }
                                      if (nextActualIdx >= 0) handleSelectSession(nextActualIdx);
                                    }}
                                    disabled={!isCurDone}
                                    style={{
                                      opacity: isCurDone ? 1 : 0.55,
                                      cursor: isCurDone ? "pointer" : "not-allowed",
                                    }}
                                    title={
                                      isCurDone
                                        ? `Chuyển sang xem tiếp Lần hỏi ${nextSess.session_number}`
                                        : `Cần tích đủ các câu thoại ở Lần hỏi hiện tại (còn ${curUnselected} câu) để chuyển sang Lần hỏi ${nextSess.session_number}`
                                    }
                                  >
                                    <span>
                                      {isCurDone
                                        ? `Tiếp theo: Xem Lần hỏi ${nextSess.session_number} →`
                                        : `Hoàn tất lần hỏi này để tiếp →`}
                                    </span>
                                  </button>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        </div>
                      )}
                      {/* Chat Action Bar with Evaluation Status & Confirm Button */}
                      <div className={styles.chatActionBar}>
                        <div className={styles.chatActionBarLeft}>

                          {saveMessage && (
                            <span
                              style={{
                                fontSize: "0.75rem",
                                color: saveMessage.isError ? "#dc2626" : "#059669",
                                marginLeft: "0.5rem",
                                fontWeight: 600,
                              }}
                            >
                              {saveMessage.text}
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          className={[
                            styles.saveBtn,
                            confirmedSampleIds.has(currentSampleIndex) || driveCompletedMap[currentSampleIndex]
                              ? styles.saveBtnConfirmed
                              : hasEvaluatedAllTurns && (hasInspectedAllSessions || visibleSessions.length <= 1)
                              ? styles.saveBtnReady
                              : styles.saveBtnDisabled,
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          disabled={saving || !hasEvaluatedAllTurns || (!hasInspectedAllSessions && visibleSessions.length > 1)}
                          onClick={handleSaveSample}
                          title={
                            !hasEvaluatedAllTurns
                              ? `Cần chọn (v hoặc x) cho tất cả ${allVisibleTurns.length} câu thoại trước khi lưu (Đã chọn: ${evaluatedTurnsCount}/${allVisibleTurns.length})`
                              : !hasInspectedAllSessions && visibleSessions.length > 1
                              ? `Cần xem hết ${visibleSessions.length} lần khám trước khi lưu (${inspectedCount}/${visibleSessions.length})`
                              : `Xác nhận & Lưu Mẫu ${currentSampleIndex} lên Google Drive`
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
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          <span>
                            {saving
                              ? "Đang lưu..."
                              : !hasEvaluatedAllTurns
                              ? `Đánh giá đủ câu thoại (${evaluatedTurnsCount}/${allVisibleTurns.length})`
                              : !hasInspectedAllSessions && visibleSessions.length > 1
                              ? `Xem đủ ${visibleSessions.length} lần khám (${inspectedCount}/${visibleSessions.length})`
                              : confirmedSampleIds.has(currentSampleIndex) || driveCompletedMap[currentSampleIndex]
                              ? `Đã lưu Mẫu ${currentSampleIndex} (Bấm để lưu lại)`
                              : `Xác nhận & Lưu Mẫu ${currentSampleIndex}`}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
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
