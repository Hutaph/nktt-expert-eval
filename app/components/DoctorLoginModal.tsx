"use client";

import React, { useState, useEffect } from "react";
import styles from "./DoctorAuth.module.css";

export interface DoctorProfile {
  id: string;
  folderCode: string; // BS01 .. BS05
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
    folderCode: "BS01",
    index: 0,
    name: "Bác sĩ Thẩm định 01",
    role: "Chuyên khoa Răng Hàm Mặt - Nhóm 1",
    caseRangeLabel: "Ca 001 - 100",
    startIndex: 0,
    endIndex: 99,
    password: "rangtrang38",
  },
  {
    id: "bs_2",
    folderCode: "BS02",
    index: 1,
    name: "Bác sĩ Thẩm định 02",
    role: "Chuyên khoa Răng Hàm Mặt - Nhóm 2",
    caseRangeLabel: "Ca 101 - 200",
    startIndex: 100,
    endIndex: 199,
    password: "nhakhoa72",
  },
  {
    id: "bs_3",
    folderCode: "BS03",
    index: 2,
    name: "Bác sĩ Thẩm định 03",
    role: "Chuyên khoa Răng Hàm Mặt - Nhóm 3",
    caseRangeLabel: "Ca 201 - 300",
    startIndex: 200,
    endIndex: 299,
    password: "chinhnha19",
  },
  {
    id: "bs_4",
    folderCode: "BS04",
    index: 3,
    name: "Bác sĩ Thẩm định 04",
    role: "Chuyên khoa Răng Hàm Mặt - Nhóm 4",
    caseRangeLabel: "Ca 301 - 400",
    startIndex: 300,
    endIndex: 399,
    password: "nuourang85",
  },
  {
    id: "bs_5",
    folderCode: "BS05",
    index: 4,
    name: "Bác sĩ Thẩm định 05",
    role: "Chuyên khoa Răng Hàm Mặt - Nhóm 5",
    caseRangeLabel: "Ca 401 - 500",
    startIndex: 400,
    endIndex: 499,
    password: "menrang46",
  },
];

const MASTER_PASSWORD = "nktt2026";


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
  const [resetMode, setResetMode] = useState<boolean>(false);
  const [resetPin, setResetPin] = useState<string>("");
  const [resetStatus, setResetStatus] = useState<string | null>(null);

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
      entered === MASTER_PASSWORD;

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

  const handleReset = () => {
    if (resetPin.trim() !== MASTER_PASSWORD) {
      setResetStatus("Sai mật khẩu quản trị.");
      return;
    }
    if (typeof window === "undefined") return;
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("nktt_")) keysToRemove.push(k);
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
    sessionStorage.removeItem("nktt_active_doctor_session");
    setProgressMap({});
    setResetPin("");
    setResetMode(false);
    setResetStatus(null);
    window.location.reload();
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
                Hệ thống phân công 5 Bác sĩ chuyên khoa phụ trách tập dữ liệu 500 ca bệnh (100 ca/bác sĩ, gồm 10 gói làm việc).
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
                      <span>{completedCount}/10 gói hoàn tất</span>
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
              Mật khẩu được cung cấp riêng cho từng bác sĩ. Vui lòng liên hệ nhóm nghiên cứu nếu cần hỗ trợ.
            </div>

            {!resetMode ? (
              <button
                type="button"
                onClick={() => { setResetMode(true); setResetStatus(null); setResetPin(""); }}
                style={{
                  marginTop: "1.2rem",
                  background: "none",
                  border: "none",
                  color: "var(--color-text-muted)",
                  fontSize: "0.72rem",
                  cursor: "pointer",
                  opacity: 0.45,
                  textDecoration: "underline",
                  padding: 0,
                }}
              >
                Quản trị: Xoa du lieu thu nghiem
              </button>
            ) : (
              <div style={{ marginTop: "1rem", padding: "0.85rem", background: "rgba(220,38,38,0.07)", borderRadius: "8px", border: "1px solid rgba(220,38,38,0.25)" }}>
                <p style={{ margin: "0 0 0.5rem", fontSize: "0.82rem", color: "#dc2626", fontWeight: 600 }}>
                  Xac nhan xoa toan bo du lieu thi nghiem?
                </p>
                <p style={{ margin: "0 0 0.75rem", fontSize: "0.76rem", color: "var(--color-text-muted)" }}>
                  Hanh dong nay se xoa het annotation, tien do cua 5 bac si tren trinh duyet nay. Khong the hoan tac.
                </p>
                <input
                  type="password"
                  placeholder="Nhap mat khau quan tri de xac nhan"
                  value={resetPin}
                  onChange={(e) => { setResetPin(e.target.value); setResetStatus(null); }}
                  style={{
                    width: "100%",
                    padding: "0.5rem 0.75rem",
                    border: "1px solid rgba(220,38,38,0.4)",
                    borderRadius: "6px",
                    fontSize: "0.82rem",
                    marginBottom: "0.6rem",
                    background: "transparent",
                    color: "inherit",
                    boxSizing: "border-box",
                  }}
                />
                {resetStatus && (
                  <p style={{ margin: "0 0 0.5rem", fontSize: "0.78rem", color: "#dc2626" }}>{resetStatus}</p>
                )}
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    type="button"
                    onClick={handleReset}
                    style={{
                      flex: 1,
                      padding: "0.45rem",
                      background: "#dc2626",
                      color: "#fff",
                      border: "none",
                      borderRadius: "6px",
                      fontSize: "0.8rem",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    Xac nhan xoa sach
                  </button>
                  <button
                    type="button"
                    onClick={() => { setResetMode(false); setResetPin(""); setResetStatus(null); }}
                    style={{
                      flex: 1,
                      padding: "0.45rem",
                      background: "transparent",
                      border: "1px solid var(--color-border)",
                      borderRadius: "6px",
                      fontSize: "0.8rem",
                      cursor: "pointer",
                      color: "var(--color-text-muted)",
                    }}
                  >
                    Huy
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
