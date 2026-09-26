"use client";

import React, { useState, useEffect } from "react";
import styles from "./DoctorAuth.module.css";
import { fetchAllBatchesSummaryFromDrive } from "../lib/driveSync";

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
  const [selectedDocId, setSelectedDocId] = useState<string | null>(activeDoctorId || null);
  const [passwordInput, setPasswordInput] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [progressMap, setProgressMap] = useState<Record<string, number>>({});

  // Làm mới và đồng bộ dữ liệu tiến độ từ bộ nhớ lưu trữ và các gói đã hoàn tất
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

    // Đồng bộ kiểm tra song song từ Google Drive và tệp tĩnh trên máy chủ
    let isSubscribed = true;
    async function syncProgressWithDriveAndFiles() {
      const updatedProgress: Record<string, number> = { ...progress };
      let changed = false;

      // Bước 1: Kéo tóm tắt toàn bộ các gói từ Google Drive (Xử lý nhanh không gây giật lag)
      try {
        const driveSummary = await fetchAllBatchesSummaryFromDrive({ timeoutMs: 4000 });
        if (driveSummary.ok && driveSummary.summary) {
          for (const doc of DOCTORS_LIST) {
            const folder = doc.folderCode.toUpperCase();
            const driveBatches = driveSummary.summary[folder] || [];
            if (driveBatches.length > 0) {
              const currentDocCount = updatedProgress[doc.id] || 0;
              if (driveBatches.length > currentDocCount) {
                updatedProgress[doc.id] = driveBatches.length;
                changed = true;
                try {
                  localStorage.setItem(
                    `nktt_completed_batches_${doc.id}`,
                    JSON.stringify(driveBatches)
                  );
                } catch {}
              }
            }
          }
          if (changed && isSubscribed) {
            setProgressMap({ ...updatedProgress });
          }
        }
      } catch (err) {
        console.warn("Lỗi khi kiểm tra tiến độ từ Google Drive:", err);
      }

      // Bước 2: Quét kiểm tra song song từ tệp tĩnh public/annotations trên máy chủ web
      const assetBase =
        typeof window !== "undefined" && window.location.pathname.startsWith("/nktt-expert-eval")
          ? "/nktt-expert-eval"
          : "";

      await Promise.all(
        DOCTORS_LIST.map(async (doc) => {
          const folder = doc.folderCode.toUpperCase();
          const docCompleted = new Set<number>();

          try {
            const saved = localStorage.getItem(`nktt_completed_batches_${doc.id}`);
            if (saved) {
              const list = JSON.parse(saved);
              if (Array.isArray(list)) list.forEach((n) => docCompleted.add(n));
            }
          } catch {}

          // Kiểm tra nhanh song song 10 gói thay vì đợi tuần tự từng gói
          const batchPromises = Array.from({ length: 10 }, (_, i) => i + 1).map(async (b) => {
            if (docCompleted.has(b)) return;
            try {
              const res = await fetch(`${assetBase}/annotations/${folder}/${folder}_batch_${b}.json?t=${Date.now()}`, {
                cache: "no-store",
              });
              if (res.ok) {
                const data = await res.json();
                if (data?.cases && Array.isArray(data.cases) && data.cases.length > 0) {
                  docCompleted.add(b);
                }
              }
            } catch {}
          });

          await Promise.all(batchPromises);

          const count = docCompleted.size;
          if (count > (updatedProgress[doc.id] || 0)) {
            updatedProgress[doc.id] = count;
            changed = true;
            try {
              localStorage.setItem(
                `nktt_completed_batches_${doc.id}`,
                JSON.stringify(Array.from(docCompleted).sort((a, b) => a - b))
              );
            } catch {}
          }
        })
      );

      if (changed && isSubscribed) {
        setProgressMap({ ...updatedProgress });
      }
    }

    syncProgressWithDriveAndFiles();
    return () => {
      isSubscribed = false;
    };
  }, [isOpen]);

  useEffect(() => {
    if (activeDoctorId) {
      setSelectedDocId(activeDoctorId);
    }
  }, [activeDoctorId]);

  if (!isOpen) return null;

  const currentDoctor = selectedDocId
    ? DOCTORS_LIST.find((d) => d.id === selectedDocId) || null
    : null;

  const handleCardClick = (docId: string) => {
    setSelectedDocId(docId);
    setPasswordInput("");
    setErrorMessage(null);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!currentDoctor) {
      setErrorMessage("Vui lòng chọn Bác sĩ chuyên khoa trước khi đăng nhập.");
      return;
    }

    const entered = passwordInput.trim();
    if (!entered) {
      setErrorMessage("Vui lòng nhập mật khẩu xác thực.");
      return;
    }

    const isValid = entered === currentDoctor.password;

    if (!isValid) {
      setErrorMessage("Mật khẩu không chính xác. Vui lòng kiểm tra lại.");
      return;
    }

    // Lưu phiên làm việc vào sessionStorage
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
                  </div>
                );
              })}
            </div>
          </div>

          {/* Password verification */}
          {currentDoctor ? (
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
            </form>
          ) : (
            <div
              style={{
                marginTop: "0.5rem",
                padding: "1rem",
                textAlign: "center",
                color: "var(--color-text-muted)",
                backgroundColor: "var(--color-surface-muted)",
                borderRadius: "var(--radius-md)",
                fontSize: "0.88rem",
              }}
            >
              Vui lòng chọn Bác sĩ chuyên khoa ở danh sách trên để tiếp tục đăng nhập.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
