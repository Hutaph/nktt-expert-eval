"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import styles from "../ClinicalLikertEval.module.css";
import DriveSyncModal from "./DriveSyncModal";
import {
  getDriveConfig,
  syncClinicalEvaluationToDrive,
  DriveConfig,
} from "../lib/driveSync";

interface PairedSystemResponse {
  system_id: string;
  system_name: string;
  hex_id: string;
  masked_id: string;
  masked_label: string;
  response: string;
}

interface HistoryTurn {
  session_id: string;
  session_number: number;
  session_timestamp?: string;
  speaker: string;
  text: string;
}

interface PairedCase {
  case_id: string;
  user_id: string;
  index: number;
  is_cross_validation_subset: boolean;
  query_time: string;
  primary_family: string;
  category_vietnamese: string;
  current_query: string;
  clinical_requirement?: Record<string, unknown>;
  history_turns?: HistoryTurn[];
  systems: PairedSystemResponse[];
}

interface EvaluationRating {
  dental_correctness: number;
  evidence_grounding: number;
  personalization_appropriateness: number;
  personalization_restraint: number;
  clarity_usefulness: number;
  overall_score: number;
  clinical_notes: string;
  adjudication_status?: string;
}

interface CaseEvaluationRecord {
  case_id: string;
  is_evaluated: boolean;
  evaluated_at: string;
  doctor_id: string;
  doctor_name: string;
  responses: Record<string, EvaluationRating>;
}

const CLINICAL_CRITERIA = [
  {
    key: "dental_correctness",
    name: "Tính chính xác về mặt nha khoa",
    nameEn: "Dental Correctness",
    desc: "Mức độ chuẩn xác theo phác đồ nha khoa, bảo đảm an toàn sinh học và không vi phạm chống chỉ định y khoa.",
    spec1: "Đưa ra lời khuyên y khoa nguy hiểm, vi phạm chống chỉ định nha khoa hoặc vượt quá ranh giới tư vấn sơ bộ.",
    spec3: "Lời khuyên an toàn nhưng chung chung; có sai sót nhỏ không gây nguy hại sức khỏe răng miệng.",
    spec5: "Chuẩn xác tuyệt đối theo hướng dẫn thực hành nha khoa; tuân thủ đúng ranh giới sàng lọc y tế.",
  },
  {
    key: "evidence_grounding",
    name: "Căn cứ bằng chứng y khoa",
    nameEn: "Evidence Grounding",
    desc: "Mọi khẳng định y khoa phải dựa trên y văn chính thống, không bịa đặt trích dẫn hoặc khuyến nghị mẹo dân gian chưa kiểm chứng.",
    spec1: "Bịa đặt dữ kiện y khoa, giả mạo tài liệu trích dẫn hoặc gợi ý mẹo dân gian chưa được kiểm chứng.",
    spec3: "Luận điểm chính có căn cứ y văn một phần nhưng còn có suy diễn bổ sung ngoài tài liệu.",
    spec5: "Mọi khẳng định lâm sàng đều dựa trên y văn nha khoa chuẩn mực; không bịa đặt hay suy diễn sai.",
  },
  {
    key: "personalization_appropriateness",
    name: "Cá nhân hóa phù hợp tiền sử",
    nameEn: "Personalization Appropriateness",
    desc: "Nhận biết và vận dụng chính xác các can thiệp hoặc điều kiện đang kích hoạt trong hồ sơ bệnh án của bệnh nhân.",
    spec1: "Bỏ qua hoàn toàn tiền sử quan trọng của người bệnh (niềng răng, chấn thương hậu phẫu, dị ứng thuốc), gây hại.",
    spec3: "Ghi nhận tiền sử một cách hời hợt hoặc chung chung, chưa cá nhân hóa đúng tình trạng thực tế của bệnh nhân.",
    spec5: "Tích hợp hoàn hảo các yếu tố tiền sử đang kích hoạt để hiệu chỉnh hướng dẫn điều trị và chăm sóc.",
  },
  {
    key: "personalization_restraint",
    name: "Tiết chế thông tin cũ (Tránh ô nhiễm)",
    nameEn: "Personalization Restraint",
    desc: "Tuyệt đối không nhắc lại các thủ thuật cũ đã hết hiệu lực; bảo toàn tính thận trọng ở các ca câu hỏi thông thường.",
    spec1: "Ô nhiễm ngữ cảnh nghiêm trọng: đưa thủ thuật cũ đã xong vào tư vấn hiện tại gây hoang mang, hoặc bịa đặt tiền sử ở ca đối chứng âm.",
    spec3: "Đề cập đến dữ kiện cũ ít liên quan nhưng không gây hiểu lầm nghiêm trọng; cá nhân hóa thừa nhẹ ở ca đối chứng.",
    spec5: "Tiết chế xuất sắc: triệt để loại bỏ thông tin cũ lỗi thời, bảo toàn sự thận trọng lâm sàng, không suy diễn sai.",
  },
  {
    key: "clarity_usefulness",
    name: "Tính rõ ràng và hữu ích thực tiễn",
    nameEn: "Clarity & Usefulness",
    desc: "Diễn đạt mạch lạc, thấu cảm, có chỉ dẫn tự chăm sóc răng miệng rõ ràng và dấu hiệu cảnh báo cần đi khám trực tiếp.",
    spec1: "Khó hiểu, lạm dụng thuật ngữ kỹ thuật, giọng điệu gây hoang mang hoặc thiếu hướng dẫn chăm sóc tại nhà cụ thể.",
    spec3: "Dễ hiểu nhưng dài dòng, thiếu cấu trúc rõ ràng hoặc thiếu dấu hiệu cảnh báo lâm sàng cần tái khám.",
    spec5: "Thấu cảm, cấu trúc mạch lạc, hướng dẫn chăm sóc tại nhà rõ ràng, chỉ rõ dấu hiệu cần đến khám trực tiếp ngay.",
  },
] as const;

type CriteriaKey = typeof CLINICAL_CRITERIA[number]["key"];

const DOCTOR_PRESETS = [
  { id: "doctor_1", name: "Bác sĩ CKI Răng Hàm Mặt 1 (D.D.S. 1 - Sơ bộ 1)", defaultFile: "/dataset/default_eval_doctor_1.json" },
  { id: "doctor_2", name: "Bác sĩ CKI Răng Hàm Mặt 2 (D.D.S. 2 - Sơ bộ 2)", defaultFile: "/dataset/default_eval_doctor_2.json" },
  { id: "adjudication_panel", name: "Hội đồng 2 Chuyên gia Đối chiếu (Senior Adjudicators - Đồng thuận)", defaultFile: "/dataset/default_eval_adjudication_consensus.json" },
  { id: "custom_eval", name: "Chuyên gia độc lập (Đánh giá mới)", defaultFile: null },
];

function getAssetBase(): string {
  if (typeof window === "undefined") return "";
  if (window.location.pathname.startsWith("/nktt-expert-eval")) {
    return "/nktt-expert-eval";
  }
  return "";
}

async function fetchDatasetJson<T>(filePath: string): Promise<T | null> {
  const assetBase = getAssetBase();
  const urlsToTry: string[] = [];

  if (assetBase) {
    urlsToTry.push(`${assetBase}${filePath}`);
  }
  urlsToTry.push(filePath);
  const ghPath = `/nktt-expert-eval${filePath}`;
  if (!urlsToTry.includes(ghPath)) {
    urlsToTry.push(ghPath);
  }

  for (const url of urlsToTry) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        return (await res.json()) as T;
      }
    } catch {
      // Continue to next URL attempt
    }
  }

  return null;
}

export default function ClinicalLikertEvalView() {
  const [pairedCases, setPairedCases] = useState<PairedCase[]>([]);
  const [loadingCases, setLoadingCases] = useState<boolean>(true);
  const [selectedCaseId, setSelectedCaseId] = useState<string>("");
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("doctor_1");
  const [selectedSystemHex, setSelectedSystemHex] = useState<string>("");

  const [evaluations, setEvaluations] = useState<Record<string, CaseEvaluationRecord>>({});
  const [showRubricModal, setShowRubricModal] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<{ text: string; isError: boolean } | null>(null);

  // Google Drive sync state
  const [showDriveModal, setShowDriveModal] = useState<boolean>(false);
  const [driveConfig, setDriveConfig] = useState<DriveConfig>(getDriveConfig);
  const [syncingDrive, setSyncingDrive] = useState<boolean>(false);
  const [driveSyncNotice, setDriveSyncNotice] = useState<{
    type: "success" | "error" | "info";
    text: string;
    url?: string;
  } | null>(null);

  // Load 200 paired cases from dataset
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        setLoadingCases(true);
        const data = await fetchDatasetJson<PairedCase[]>("/dataset/clinical_eval_paired_cases.json?v=v5_20260924_v5clean");
        if (isMounted && data) {
          setPairedCases(data);
          if (data.length > 0) {
            setSelectedCaseId(data[0].case_id);
            if (data[0].systems && data[0].systems.length > 0) {
              setSelectedSystemHex(data[0].systems[0].hex_id);
            }
          }
        }
      } catch (err) {
        console.warn("Lỗi khi tải tập dữ liệu ca thẩm định lâm sàng:", err);
      } finally {
        if (isMounted) setLoadingCases(false);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  // Load doctor evaluations from localStorage or default files
  useEffect(() => {
    let isMounted = true;
    async function loadDoctorEvals() {
      const storageKey = `nktt_expert_likert_${selectedDoctorId}`;
      const saved = typeof window !== "undefined" ? localStorage.getItem(storageKey) : null;
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as Record<string, CaseEvaluationRecord>;
          if (isMounted) setEvaluations(parsed);
          return;
        } catch { }
      }

      const preset = DOCTOR_PRESETS.find((d) => d.id === selectedDoctorId);
      if (preset && preset.defaultFile) {
        try {
          const defaultData = await fetchDatasetJson<Record<string, CaseEvaluationRecord>>(preset.defaultFile);
          if (isMounted && defaultData) {
            setEvaluations(defaultData);
            if (typeof window !== "undefined") {
              localStorage.setItem(storageKey, JSON.stringify(defaultData));
            }
          } else if (isMounted) {
            setEvaluations({});
          }
        } catch (err) {
          console.warn("Lỗi khi nạp dữ liệu đánh giá mẫu:", err);
          if (isMounted) setEvaluations({});
        }
      } else {
        if (isMounted) setEvaluations({});
      }
    }

    loadDoctorEvals();
    return () => {
      isMounted = false;
    };
  }, [selectedDoctorId]);

  // Active case object
  const currentCase = useMemo(() => {
    return pairedCases.find((c) => c.case_id === selectedCaseId) || pairedCases[0] || null;
  }, [pairedCases, selectedCaseId]);

  // When active case changes, select its first system if current is not in systems
  useEffect(() => {
    if (!currentCase || !currentCase.systems || currentCase.systems.length === 0) return;
    const exists = currentCase.systems.some((s) => s.hex_id === selectedSystemHex);
    if (!exists) {
      setSelectedSystemHex(currentCase.systems[0].hex_id);
    }
    setSaveStatus(null);
  }, [currentCase, selectedSystemHex]);

  // Current active system
  const currentSystem = useMemo(() => {
    if (!currentCase) return null;
    return currentCase.systems.find((s) => s.hex_id === selectedSystemHex) || currentCase.systems[0] || null;
  }, [currentCase, selectedSystemHex]);

  // Current evaluation record for active case
  const activeCaseRecord = useMemo(() => {
    if (!currentCase) return null;
    return evaluations[currentCase.case_id] || null;
  }, [evaluations, currentCase]);

  // Current rating for active system response
  const activeRating: EvaluationRating = useMemo(() => {
    if (activeCaseRecord && currentSystem && activeCaseRecord.responses[currentSystem.hex_id]) {
      return activeCaseRecord.responses[currentSystem.hex_id];
    }
    return {
      dental_correctness: 0,
      evidence_grounding: 0,
      personalization_appropriateness: 0,
      personalization_restraint: 0,
      clarity_usefulness: 0,
      overall_score: 0,
      clinical_notes: "",
    };
  }, [activeCaseRecord, currentSystem]);

  // Handle score change for a criterion
  const handleScoreChange = (criterionKey: CriteriaKey, score: number) => {
    if (!currentCase || !currentSystem) return;

    const updatedRating: EvaluationRating = {
      ...activeRating,
      [criterionKey]: score,
    };

    // Recalculate overall score
    const scores = [
      criterionKey === "dental_correctness" ? score : updatedRating.dental_correctness,
      criterionKey === "evidence_grounding" ? score : updatedRating.evidence_grounding,
      criterionKey === "personalization_appropriateness" ? score : updatedRating.personalization_appropriateness,
      criterionKey === "personalization_restraint" ? score : updatedRating.personalization_restraint,
      criterionKey === "clarity_usefulness" ? score : updatedRating.clarity_usefulness,
    ].filter((s) => s > 0);

    const overall = scores.length > 0 ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)) : 0;
    updatedRating.overall_score = overall;

    saveRating(updatedRating);
  };

  // Handle clinical notes change
  const handleNotesChange = (text: string) => {
    if (!currentCase || !currentSystem) return;
    const updatedRating: EvaluationRating = {
      ...activeRating,
      clinical_notes: text,
    };
    saveRating(updatedRating);
  };

  // Helper to persist rating to evaluations map and localStorage
  const saveRating = useCallback((rating: EvaluationRating) => {
    if (!currentCase || !currentSystem) return;

    setEvaluations((prev) => {
      const caseRec = prev[currentCase.case_id] || {
        case_id: currentCase.case_id,
        is_evaluated: true,
        evaluated_at: new Date().toISOString(),
        doctor_id: selectedDoctorId,
        doctor_name: DOCTOR_PRESETS.find((d) => d.id === selectedDoctorId)?.name || "Chuyên gia",
        responses: {},
      };

      const newRecord: CaseEvaluationRecord = {
        ...caseRec,
        is_evaluated: true,
        evaluated_at: new Date().toISOString(),
        responses: {
          ...caseRec.responses,
          [currentSystem.hex_id]: rating,
        },
      };

      const updated = {
        ...prev,
        [currentCase.case_id]: newRecord,
      };

      if (typeof window !== "undefined") {
        const storageKey = `nktt_expert_likert_${selectedDoctorId}`;
        localStorage.setItem(storageKey, JSON.stringify(updated));

        // Tự động đồng bộ lên Google Drive nếu đã bật tùy chọn
        const cfg = getDriveConfig();
        if (cfg.autoSync && cfg.webhookUrl) {
          const docName = DOCTOR_PRESETS.find((d) => d.id === selectedDoctorId)?.name || selectedDoctorId;
          syncClinicalEvaluationToDrive(selectedDoctorId, docName, updated).then((res) => {
            if (res.ok) {
              setDriveConfig(getDriveConfig());
            }
          });
        }
      }

      return updated;
    });

    setSaveStatus({ text: "Đã ghi nhận điểm thẩm định cho mẫu này.", isError: false });
  }, [currentCase, currentSystem, selectedDoctorId]);

  // Navigate to previous case
  const handlePrevCase = () => {
    if (!currentCase) return;
    const idx = pairedCases.findIndex((c) => c.case_id === currentCase.case_id);
    if (idx > 0) {
      setSelectedCaseId(pairedCases[idx - 1].case_id);
    }
  };

  // Navigate to next case
  const handleNextCase = () => {
    if (!currentCase) return;
    const idx = pairedCases.findIndex((c) => c.case_id === currentCase.case_id);
    if (idx >= 0 && idx < pairedCases.length - 1) {
      setSelectedCaseId(pairedCases[idx + 1].case_id);
    }
  };

  // Export annotations as JSON or JSONL
  const handleExportJson = () => {
    const list = Object.values(evaluations);
    if (list.length === 0) {
      alert("Chưa có dữ liệu đánh giá nào để xuất.");
      return;
    }
    const jsonStr = JSON.stringify(evaluations, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clinical_eval_${selectedDoctorId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportJsonl = () => {
    const list = Object.values(evaluations);
    if (list.length === 0) {
      alert("Chưa có dữ liệu đánh giá nào để xuất.");
      return;
    }
    const lines = list.map((item) => JSON.stringify(item)).join("\n") + "\n";
    const blob = new Blob([lines], { type: "application/x-ndjson;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clinical_eval_${selectedDoctorId}.jsonl`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Đồng bộ toàn bộ dữ liệu đánh giá lên Google Drive
  const handleSyncToDrive = async () => {
    const config = getDriveConfig();
    if (!config.webhookUrl) {
      setShowDriveModal(true);
      return;
    }

    const list = Object.values(evaluations);
    if (list.length === 0) {
      alert("Chưa có dữ liệu đánh giá nào để lưu lên Google Drive.");
      return;
    }

    setSyncingDrive(true);
    setDriveSyncNotice({ type: "info", text: "Đang tải dữ liệu đánh giá lên Google Drive..." });

    const currentDoctorName = DOCTOR_PRESETS.find((d) => d.id === selectedDoctorId)?.name || selectedDoctorId;
    const result = await syncClinicalEvaluationToDrive(selectedDoctorId, currentDoctorName, evaluations);

    setSyncingDrive(false);
    if (result.ok) {
      setDriveConfig(getDriveConfig());
      setDriveSyncNotice({
        type: "success",
        text: `Đã lưu thành công dữ liệu lên Google Drive (Thư mục: ${result.folderName || "NKTT_Expert_Evaluations"}).`,
        url: result.folderUrl,
      });
      setTimeout(() => setDriveSyncNotice(null), 8000);
    } else {
      setDriveSyncNotice({
        type: "error",
        text: result.error || "Không thể đồng bộ lên Google Drive.",
      });
    }
  };

  // Calculate statistics
  const currentCaseIndex = pairedCases.findIndex((c) => c.case_id === selectedCaseId);
  const totalCasesCount = pairedCases.length;
  const evaluatedCount = useMemo(() => {
    return Object.values(evaluations).filter((e) => e.is_evaluated && Object.keys(e.responses).length > 0).length;
  }, [evaluations]);

  return (
    <div className={styles.container}>
      {/* Top Header Bar */}
      <header className={styles.topBar}>
        <div className={styles.topBarLeft}>
          <h1 className={styles.topTitle}>Chấm điểm Lâm sàng Likert Thang 5 Chuyên gia Nha khoa</h1>
          <p className={styles.topSubtitle}>
            Thẩm định mù đối chứng đôi theo 5 tiêu chí lâm sàng chuyên môn nha khoa
          </p>
        </div>
        <div className={styles.topBarRight}>
          <div className={styles.doctorSelectWrapper}>
            <label htmlFor="doctorSelect">Chuyên gia:</label>
            <select
              id="doctorSelect"
              className={styles.doctorSelect}
              value={selectedDoctorId}
              onChange={(e) => setSelectedDoctorId(e.target.value)}
            >
              {DOCTOR_PRESETS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <span className={styles.badgeProgress}>
            Đã thẩm định: {evaluatedCount}/{totalCasesCount || 200} ca
          </span>
          <button
            type="button"
            className={styles.actionButtonOutline}
            onClick={() => setShowRubricModal(true)}
            title="Xem bảng tiêu chí chuẩn 5 mức điểm"
          >
            Xem bảng tiêu chí
          </button>
          <button
            type="button"
            className={styles.actionButtonPrimary}
            onClick={handleExportJsonl}
            title="Xuất file kết quả theo định dạng JSONL"
          >
            Xuất JSONL
          </button>
          <button
            type="button"
            className={styles.actionButtonDrive}
            onClick={handleSyncToDrive}
            disabled={syncingDrive}
            title="Lưu toàn bộ kết quả thẩm định lên Google Drive"
          >
            {syncingDrive ? "Đang lưu..." : "Lưu lên Google Drive"}
          </button>
          <button
            type="button"
            className={styles.actionButtonOutline}
            onClick={() => setShowDriveModal(true)}
            title="Cài đặt kết nối dịch vụ Google Drive"
          >
            Cài đặt Drive
          </button>
        </div>
      </header>

      {driveSyncNotice && (
        <div
          className={
            driveSyncNotice.type === "success"
              ? styles.driveBannerSuccess
              : driveSyncNotice.type === "error"
              ? styles.driveBannerError
              : styles.driveBannerInfo
          }
        >
          <div>
            <span>{driveSyncNotice.text}</span>
            {driveSyncNotice.url && (
              <a
                href={driveSyncNotice.url}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.driveLink}
              >
                Mở thư mục Google Drive
              </a>
            )}
          </div>
          <button
            type="button"
            className={styles.driveDismissBtn}
            onClick={() => setDriveSyncNotice(null)}
          >
            Đóng
          </button>
        </div>
      )}

      {/* Main Workspace Area */}
      <div className={styles.mainContent}>
        {/* Compact Question Selector & Metadata Bar */}
        <div className={styles.selectorBar}>
          <div className={styles.selectorLeft}>
            <label htmlFor="caseSelect" className={styles.selectorLabel}>
              Ca:
            </label>
            <select
              id="caseSelect"
              className={styles.querySelect}
              value={selectedCaseId}
              onChange={(e) => setSelectedCaseId(e.target.value)}
              disabled={loadingCases}
            >
              {loadingCases ? (
                <option>Đang nạp danh sách câu hỏi...</option>
              ) : (
                pairedCases.map((c, idx) => (
                  <option key={c.case_id} value={c.case_id}>
                    Ca {idx + 1}/200: {c.current_query}
                  </option>
                ))
              )}
            </select>
            <div className={styles.navButtonGroup}>
              <button
                type="button"
                className={styles.navButton}
                onClick={handlePrevCase}
                disabled={currentCaseIndex <= 0}
                title="Ca trước"
              >
                Trước
              </button>
              <button
                type="button"
                className={styles.navButton}
                onClick={handleNextCase}
                disabled={currentCaseIndex >= pairedCases.length - 1}
                title="Ca tiếp theo"
              >
                Tiếp
              </button>
            </div>
          </div>
          {currentCase && (
            <div className={styles.activeQueryMeta}>
              <span className={styles.metaTag}>
                Mã: <strong>{currentCase.case_id}</strong>
              </span>
              <span className={styles.metaTag}>
                BN: <strong>{currentCase.user_id}</strong>
              </span>
              <span className={styles.metaTagHighlight}>
                <strong>{currentCase.category_vietnamese || currentCase.primary_family}</strong>
              </span>
            </div>
          )}
        </div>

        {/* Compact Active Question Banner */}
        {currentCase && (
          <div className={styles.activeQueryCard}>
            <span className={styles.activeQueryLabel}>Câu hỏi của bệnh nhân:</span>
            <span className={styles.activeQueryTitle} title={currentCase.current_query}>
              {currentCase.current_query}
            </span>
          </div>
        )}

        {/* Two Column Layout: Ground Truth vs Generated Answer */}
        <div className={styles.comparisonGrid}>
          {/* Left Column: Ground Truth & Clinical Context */}
          <div className={styles.panelCard}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Hồ sơ bệnh án & Bối cảnh lâm sàng (Ground Truth)</h2>
              <span className={styles.panelBadge}>
                {currentCase?.history_turns ? `${currentCase.history_turns.length} lượt thoại trước` : "Kiến thức chung"}
              </span>
            </div>

            {/* Clinical Context & Target Requirements */}
            <div className={styles.clinicalTargetBox}>
              <span className={styles.clinicalTargetTitle}>Lưu ý:</span>
              <span>
                {currentCase?.category_vietnamese || currentCase?.primary_family}. Kiểm tra kỹ các đợt khám để phát hiện các yếu tố đã thay đổi hoặc mâu thuẫn.
              </span>
            </div>

            {/* Conversation History Turns */}
            <div className={styles.historyList}>
              {!currentCase?.history_turns || currentCase.history_turns.length === 0 ? (
                <p style={{ color: "var(--color-text-muted)", fontSize: "0.84375rem", fontStyle: "italic", margin: 0 }}>
                  Đây là ca câu hỏi nha khoa đại cương (đối chứng âm), không có tiền sử bệnh án trước đó. Hệ thống không được tự suy diễn hoặc bịa đặt tiền sử của bệnh nhân.
                </p>
              ) : (
                currentCase.history_turns.map((turn, tIdx) => {
                  const isUser = turn.speaker === "user";
                  return (
                    <div
                      key={`${turn.session_id}_${tIdx}`}
                      className={[
                        styles.historyTurn,
                        isUser ? styles.historyTurnUser : styles.historyTurnAssistant,
                      ].join(" ")}
                    >
                      <span
                        className={[
                          styles.turnSpeaker,
                          isUser ? styles.turnSpeakerUser : styles.turnSpeakerAssistant,
                        ].join(" ")}
                      >
                        {isUser ? "Bệnh nhân" : "Bác sĩ / Trợ lý"} (Lần khám {turn.session_number})
                      </span>
                      <div>{turn.text}</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Generated Answer & Blind Model Tabs */}
          <div className={styles.panelCard}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Câu trả lời của Hệ thống RAG (Generated Answer)</h2>
              <span className={styles.panelBadge}>Thẩm định mù (Blinded Model)</span>
            </div>

            {/* Blinded Model Tabs */}
            <div className={styles.modelTabs}>
              {currentCase?.systems.map((sys) => {
                const isSelected = sys.hex_id === selectedSystemHex;
                const evaluatedSys = activeCaseRecord?.responses[sys.hex_id];
                const hasScore = evaluatedSys && evaluatedSys.overall_score > 0;
                const match = sys.masked_label ? sys.masked_label.match(/#([A-D])/i) : null;
                const tabLetter = match ? match[1].toUpperCase() : sys.hex_id?.slice(0, 4);
                return (
                  <button
                    key={sys.hex_id}
                    type="button"
                    className={[
                      styles.modelTabButton,
                      isSelected ? styles.modelTabButtonActive : "",
                    ].join(" ")}
                    onClick={() => setSelectedSystemHex(sys.hex_id)}
                    title={`${sys.masked_label || sys.hex_id} - ${hasScore ? `Điểm: ${evaluatedSys.overall_score}/5` : "Chưa chấm"}`}
                  >
                    <span className={styles.modelTabLabel}>
                      Mẫu {tabLetter} <span className={styles.modelTabHex}>({sys.hex_id})</span>
                    </span>
                    <span className={styles.modelTabStatus}>
                      {hasScore ? `${evaluatedSys.overall_score}/5` : "--"}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Generated Response Content */}
            <div className={styles.responseContentBox}>
              {currentSystem ? (
                currentSystem.response
              ) : (
                <p style={{ color: "var(--color-text-muted)" }}>Chưa chọn mẫu phản hồi nào.</p>
              )}
            </div>
          </div>
        </div>

        {/* Likert 1-5 Rubric Evaluation Section */}
        <section className={styles.evalSection} aria-label="Bảng chấm điểm Likert 5 mức">
          <div className={styles.evalHeader}>
            <div className={styles.evalHeadingRow}>
              <h2 className={styles.evalHeading}>
                Chấm điểm Likert (1-5) &mdash; {currentSystem?.masked_label}
              </h2>
              {activeRating.adjudication_status && (
                <span
                  style={{
                    display: "inline-block",
                    padding: "2px 8px",
                    borderRadius: "4px",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    backgroundColor:
                      activeRating.adjudication_status === "SENIOR_ADJUDICATED"
                        ? "rgba(255, 193, 7, 0.15)"
                        : "rgba(13, 110, 253, 0.12)",
                    color:
                      activeRating.adjudication_status === "SENIOR_ADJUDICATED"
                        ? "#b58105"
                        : "#0d6efd",
                    border:
                      activeRating.adjudication_status === "SENIOR_ADJUDICATED"
                        ? "1px solid rgba(255, 193, 7, 0.35)"
                        : "1px solid rgba(13, 110, 253, 0.25)",
                  }}
                >
                  {activeRating.adjudication_status === "SENIOR_ADJUDICATED"
                    ? "Đã qua hội đồng đối chiếu phân xử"
                    : "Đồng thuận trực tiếp sơ bộ"}
                </span>
              )}
              <span className={styles.evalSubheading}>
                Đánh giá theo 5 tiêu chí lâm sàng nha khoa (1: Rất tệ &bull; 3: Tạm được &bull; 5: Rất tốt)
              </span>
            </div>
          </div>

          {/* Likert Table Matrix */}
          <div className={styles.tableWrapper}>
            <table className={styles.likertTable}>
              <thead>
                <tr>
                  <th>Tiêu chí đánh giá lâm sàng</th>
                  <th>
                    <div className={styles.scoreHeader}>
                      <span className={styles.scoreHeaderNum}>1</span>
                      <span className={styles.scoreHeaderLabel}>Rất tệ</span>
                    </div>
                  </th>
                  <th>
                    <div className={styles.scoreHeader}>
                      <span className={styles.scoreHeaderNum}>2</span>
                      <span className={styles.scoreHeaderLabel}>Kém</span>
                    </div>
                  </th>
                  <th>
                    <div className={styles.scoreHeader}>
                      <span className={styles.scoreHeaderNum}>3</span>
                      <span className={styles.scoreHeaderLabel}>Tạm được</span>
                    </div>
                  </th>
                  <th>
                    <div className={styles.scoreHeader}>
                      <span className={styles.scoreHeaderNum}>4</span>
                      <span className={styles.scoreHeaderLabel}>Tốt</span>
                    </div>
                  </th>
                  <th>
                    <div className={styles.scoreHeader}>
                      <span className={styles.scoreHeaderNum}>5</span>
                      <span className={styles.scoreHeaderLabel}>Rất tốt</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {CLINICAL_CRITERIA.map((criterion) => {
                  const currentValue = activeRating[criterion.key] || 0;
                  return (
                    <tr key={criterion.key}>
                      <td>
                        <div className={styles.criterionCell}>
                          <span className={styles.criterionName}>
                            {criterion.name} ({criterion.nameEn})
                          </span>
                          <span className={styles.criterionDesc}>{criterion.desc}</span>
                        </div>
                      </td>
                      {[1, 2, 3, 4, 5].map((score) => {
                        const isSelected = currentValue === score;
                        return (
                          <td
                            key={score}
                            className={[
                              styles.radioCell,
                              isSelected ? styles.radioCellSelected : "",
                            ].join(" ")}
                            onClick={() => handleScoreChange(criterion.key, score)}
                          >
                            <input
                              type="radio"
                              name={`likert_${currentSystem?.hex_id}_${criterion.key}`}
                              checked={isSelected}
                              onChange={() => handleScoreChange(criterion.key, score)}
                              className={styles.radioInput}
                              aria-label={`${criterion.name} mức ${score}`}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Notes and Overall Score Card - Single Compact Row */}
          <div className={styles.evalBottomRow}>
            <div className={styles.notesGroup}>
              <label htmlFor="clinicalNotes" className={styles.notesLabel}>
                Ghi chú:
              </label>
              <input
                id="clinicalNotes"
                type="text"
                className={styles.notesInput}
                value={activeRating.clinical_notes || ""}
                onChange={(e) => handleNotesChange(e.target.value)}
                placeholder="Nhận xét của bác sĩ: ví dụ chỉ rõ thông tin sai lệch, nguy cơ dị ứng..."
              />
            </div>

            <div className={styles.scoreBadgeInline}>
              <span>Điểm TB:</span>
              <strong className={styles.scoreBadgeValue}>
                {activeRating.overall_score > 0 ? `${activeRating.overall_score.toFixed(1)}/5.0` : "-- / 5.0"}
              </strong>
              <span className={styles.scoreBadgeStatus}>
                {activeRating.overall_score >= 4.5
                  ? "(Chuẩn mực)"
                  : activeRating.overall_score >= 3.5
                  ? "(Tốt)"
                  : activeRating.overall_score >= 2.5
                  ? "(Tạm được)"
                  : activeRating.overall_score > 0
                  ? "(Thất bại)"
                  : "(Chưa chấm)"}
              </span>
            </div>

            <div className={styles.bottomActionsGroup}>
              {saveStatus && (
                <span className={saveStatus.isError ? styles.saveMessageError : styles.saveMessageSuccess}>
                  {saveStatus.text}
                </span>
              )}
              <button
                type="button"
                className={styles.actionButtonPrimary}
                onClick={() => saveRating(activeRating)}
              >
                Lưu đánh giá
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Modal for Paper Rubric Specifications */}
      {showRubricModal && (
        <div className={styles.modalOverlay} onClick={() => setShowRubricModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                Bảng Tiêu chí Đánh giá Lâm sàng 5 Mức
              </h3>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setShowRubricModal(false)}
              >
                Đóng
              </button>
            </div>
            <div className={styles.modalBody}>
              <div
                style={{
                  padding: "10px 14px",
                  marginBottom: "14px",
                  borderRadius: "6px",
                  backgroundColor: "var(--color-bg-subtle, #f8f9fa)",
                  border: "1px solid var(--color-border, #e9ecef)",
                  fontSize: "0.85rem",
                  lineHeight: "1.5",
                }}
              >
                <strong>Quy trình Hội đồng 2 - 2 Chuyên gia:</strong>
                <div>
                  1. Hai bác sĩ CKI Răng Hàm Mặt (D.D.S. 1 &amp; 2) chấm độc lập mù đôi 200 ca ghép cặp (800 câu trả lời).
                </div>
                <div>
                  2. Khi có chênh lệch &ge; 2 điểm trên bất kỳ tiêu chí nào hoặc có cảnh báo vi phạm an toàn lâm sàng, hai chuyên gia cao cấp (Senior Adjudicators) sẽ phân xử và chốt điểm đồng thuận (Adjudicated Consensus).
                </div>
              </div>
              <p>
                Bảng phân loại chi tiết các mức điểm theo chuẩn thẩm định lâm sàng 5 mức:
              </p>
              <table className={styles.rubricSpecTable}>
                <thead>
                  <tr>
                    <th style={{ width: "22%" }}>Tiêu chí</th>
                    <th style={{ width: "26%" }}>Điểm 1 (Thất bại nghiêm trọng)</th>
                    <th style={{ width: "26%" }}>Điểm 3 (Tạm được / Dưới chuẩn)</th>
                    <th style={{ width: "26%" }}>Điểm 5 (Chuẩn mực lâm sàng)</th>
                  </tr>
                </thead>
                <tbody>
                  {CLINICAL_CRITERIA.map((c) => (
                    <tr key={c.key}>
                      <td>
                        <strong>{c.name}</strong>
                        <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
                          {c.nameEn}
                        </div>
                      </td>
                      <td>{c.spec1}</td>
                      <td>{c.spec3}</td>
                      <td>{c.spec5}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      <DriveSyncModal
        isOpen={showDriveModal}
        onClose={() => setShowDriveModal(false)}
        onConfigSaved={(cfg) => setDriveConfig(cfg)}
      />
    </div>
  );
}
