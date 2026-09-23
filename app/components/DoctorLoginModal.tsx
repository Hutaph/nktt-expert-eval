"use client";

import React, { useState, useEffect } from "react";
import styles from "./DoctorAuth.module.css";

export interface DoctorProfile {
  id: string;
  index: number; // 0 to 4
  name: string;
  role: string;
  caseRangeLabel: string;
  startIndex: number; // 0, 100, 200, 300, 400
  endIndex: number; // 99, 199, 299, 399, 499
  password: string;
}

export const DOCTORS_LIST: DoctorProfile[] = [
  {
    id: "bs_1",
    index: 0,
    name: "Bác sĩ Thẩm định 01",
    role: "Chuyên khoa Răng Hàm Mặt - Nhóm 1",
    caseRangeLabel: "Ca 001 - 100",
    startIndex: 0,
    endIndex: 99,
    password: "bs01@nktt",
  },
  {
    id: "bs_2",
    index: 1,
    name: "Bác sĩ Thẩm định 02",
    role: "Chuyên khoa Răng Hàm Mặt - Nhóm 2",
    caseRangeLabel: "Ca 101 - 200",
    startIndex: 100,
    endIndex: 199,
    password: "bs02@nktt",
  },
  {
    id: "bs_3",
    index: 2,
    name: "Bác sĩ Thẩm định 03",
    role: "Chuyên khoa Răng Hàm Mặt - Nhóm 3",
    caseRangeLabel: "Ca 201 - 300",
    startIndex: 200,
    endIndex: 299,
    password: "bs03@nktt",
  },
  {
    id: "bs_4",
    index: 3,
    name: "Bác sĩ Thẩm định 04",
    role: "Chuyên khoa Răng Hàm Mặt - Nhóm 4",
    caseRangeLabel: "Ca 301 - 400",
    startIndex: 300,
    endIndex: 399,
    password: "bs04@nktt",
  },
  {
    id: "bs_5",
    index: 4,
    name: "Bác sĩ Thẩm định 05",
    role: "Chuyên khoa Răng Hàm Mặt - Nhóm 5",
    caseRangeLabel: "Ca 401 - 500",
    startIndex: 400,
    endIndex: 499,
    password: "bs05@nktt",
  },
];

const MASTER_PASSWORD = "nktt2026";
const MASTER_PIN = "123456";

interface DoctorLoginModalProps {
  isOpen: boolean;
  canClose?: boolean;
  onClose?: () => void;
  onSelectDoctor: (doctor: DoctorProfile) => void;
  activeDoctorId?: string | null;
}

export default function DoctorLoginModal({
  isOpen,
  canClose = false,
  onClose,
  onSelectDoctor,
  activeDoctorId,
}: DoctorLoginModalProps) {
  const [selectedDocId, setSelectedDocId] = useState<string>(activeDoctorId || "bs_1");
  const [passwordInput, setPasswordInput] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [progressMap, setProgressMap] = useState<Record<string, number>>({});

  // Load completed batches per doctor from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const progress: Record<string, number> = {};
    DOCTORS_LIST.forEach((doc) => {
      try {
        const saved = localStorage.getItem(`nktt_completed_batches_${doc.id}`);
        if (saved) {
          const list = JSON.parse(saved);
          progress[doc.id] = Array.isArray(list) ? list.length : 0;
        } else {
          progress[doc.id] = 0;
        }
      } catch {
        progress[doc.id] = 0;
      }
    });
    setProgressMap(progress);
  }, [isOpen]);

  useEffect(() => {
    if (activeDoctorId) {
      setSelectedDocId(activeDoctorId);
    }
  }, [activeDoctorId]);

  if (!isOpen) return null;

  const currentDoctor = DOCTORS_LIST.find((d) => d.id === selectedDocId) || DOCTORS_LIST[0];

  const handleCardClick = (docId: string) => {
    setSelectedDocId(docId);
    setPasswordInput("");
    setErrorMessage(null);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const entered = passwordInput.trim();
    if (!entered) {
      setErrorMessage("Vui lòng nhập mật khẩu xác thực.");
      return;
    }

    const isValid =
      entered === currentDoctor.password ||
      entered === MASTER_PASSWORD ||
      entered === MASTER_PIN;

    if (!isValid) {
      setErrorMessage("Mật khẩu không chính xác. Vui lòng kiểm tra lại.");
      return;
    }

    // Save session in sessionStorage (expires when browser/tab is closed)
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem(
          "nktt_active_doctor_session",
          JSON.stringify({
            id: currentDoctor.id,
            name: currentDoctor.name,
            loggedInAt: new Date().toISOString(),
          })
        );
        // Also remove any legacy persistent session
        localStorage.removeItem("nktt_active_doctor_session");
      } catch (err) {
        console.error("Lỗi khi lưu phiên bác sĩ:", err);
      }
    }

    onSelectDoctor(currentDoctor);
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.portalCard}>
        {/* Header */}
        <div className={styles.portalHeader}>
          <div className={styles.portalTitleRow}>
            <svg
              className={styles.portalIconSvg}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <div>
              <h2 className={styles.portalTitle}>Cổng Thẩm định Chuyên gia ViDent</h2>
              <p className={styles.portalSubtitle}>
                Hệ thống phân công 5 Bác sĩ chuyên khoa phụ trách tập dữ liệu 500 ca bệnh (100 ca/bác sĩ, gồm 10 đợt làm việc).
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className={styles.portalBody}>
          <div>
            <label className={styles.passwordLabel}>
              Chọn Bác sĩ chuyên khoa của bạn:
            </label>
            <div className={styles.doctorGrid}>
              {DOCTORS_LIST.map((doc) => {
                const isSelected = doc.id === selectedDocId;
                const completedCount = progressMap[doc.id] || 0;
                return (
                  <div
                    key={doc.id}
                    className={[
                      styles.doctorCard,
                      isSelected ? styles.doctorCardSelected : "",
                    ].join(" ")}
                    onClick={() => handleCardClick(doc.id)}
                  >
                    <div className={styles.doctorHeaderRow}>
                      <span className={styles.doctorBadge}>{doc.caseRangeLabel}</span>
                      {completedCount === 10 && (
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#237653"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      )}
                    </div>
                    <h3 className={styles.doctorName}>{doc.name}</h3>
                    <p className={styles.doctorQuota}>{doc.role}</p>
                    <div className={styles.doctorProgressRow}>
                      <span>Tiến độ:</span>
                      <span>{completedCount}/10 đợt hoàn tất</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Password verification */}
          <form className={styles.passwordSection} onSubmit={handleLogin}>
            <label className={styles.passwordLabel}>
              <svg
                width="16"
                height="16"
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
              Nhập mật khẩu cho {currentDoctor.name} ({currentDoctor.caseRangeLabel}):
            </label>

            <div className={styles.passwordInputRow}>
              <input
                type="password"
                className={styles.passwordInput}
                placeholder="Nhập mật khẩu xác thực..."
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                autoFocus
              />
              <button type="submit" className={styles.loginSubmitBtn}>
                Vào làm việc
              </button>
              {canClose && onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    padding: "0.65rem 1rem",
                    border: "1px solid var(--color-border)",
                    backgroundColor: "transparent",
                    color: "var(--color-text-muted)",
                    borderRadius: "var(--radius-sm)",
                    cursor: "pointer",
                    fontWeight: 500,
                  }}
                >
                  Quay lại
                </button>
              )}
            </div>

            {errorMessage && <div className={styles.errorMessage}>{errorMessage}</div>}

            <div className={styles.passwordHint}>
              Gợi ý mật khẩu: Mật khẩu mặc định là <code>{currentDoctor.password}</code> hoặc mã PIN phổ quát <code>123456</code> (hoặc <code>nktt2026</code>).
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
