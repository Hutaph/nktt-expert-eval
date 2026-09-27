"use client";

import React, { useState, useEffect } from "react";
import styles from "./DoctorAuth.module.css";

export interface DoctorProfile {
  id: string;
  name: string;
  folderCode: string;
  role?: string;
  caseRangeLabel?: string;
  startIndex?: number;
  endIndex?: number;
}

export const PRESET_DOCTOR_CODES: string[] = [];

export const DOCTORS_LIST: DoctorProfile[] = [];

export function getAllDoctorsList(): DoctorProfile[] {
  return [];
}

/**
 * Tự động tạo hồ sơ Bác sĩ và mã phân chia độc quyền dựa trên họ tên được nhập
 */
export function generateDoctorProfileFromName(rawName: string): DoctorProfile {
  const trimmed = rawName.trim();
  if (!trimmed) {
    return {
      id: "bs_anonym",
      name: "Bác sĩ Thẩm định",
      folderCode: "BS_ANONYM",
      role: "Bác sĩ Chuyên khoa Răng Hàm Mặt",
      caseRangeLabel: "Kho 125 Mẫu",
      startIndex: 0,
      endIndex: 124,
    };
  }

  // 1. Chuyển tiếng Việt có dấu sang không dấu để tạo mã phân vùng đồng nhất
  const asciiClean = trimmed
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, (m) => (m === "Đ" ? "D" : "d"));

  // 2. Kiểm tra nếu người dùng nhập mã trực tiếp như BS01, BS1, BS 01...
  const matchCode = asciiClean.match(/^BS\s*0*([0-9]+)$/i);
  if (matchCode) {
    const num = parseInt(matchCode[1], 10);
    const padded = String(num).padStart(2, "0");
    const code = `BS${padded}`;
    return {
      id: code.toLowerCase(),
      name: trimmed.toUpperCase().startsWith("BS") ? trimmed : `Bác sĩ ${trimmed}`,
      folderCode: code,
      role: "Bác sĩ Chuyên khoa Răng Hàm Mặt",
      caseRangeLabel: "Kho 125 Mẫu",
      startIndex: 0,
      endIndex: 124,
    };
  }

  // 3. Tách từ và loại bỏ tiền tố chức danh để tạo mã slug ngắn gọn
  const words = asciiClean
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const ignoredPrefixes = new Set([
    "BAC",
    "SI",
    "BS",
    "DR",
    "DOCTOR",
    "TS",
    "THS",
    "PGS",
    "GS",
    "NHA",
    "KHOA",
  ]);

  const meaningfulWords = words.filter(
    (w) => !ignoredPrefixes.has(w.toUpperCase())
  );

  const slugWords = meaningfulWords.length > 0 ? meaningfulWords : words;
  const slug = slugWords.join("_").toUpperCase();
  const folderCode = slug.startsWith("BS_") ? slug : `BS_${slug}`;
  const docId = folderCode.toLowerCase();

  return {
    id: docId,
    name: trimmed,
    folderCode: folderCode,
    role: "Bác sĩ Chuyên khoa Răng Hàm Mặt",
    caseRangeLabel: "Kho 125 Mẫu",
    startIndex: 0,
    endIndex: 124,
  };
}

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
  const [doctorNameInput, setDoctorNameInput] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Khôi phục tên bác sĩ từ phiên làm việc trước nếu có
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const savedSession = sessionStorage.getItem("nktt_active_doctor_session");
      if (savedSession) {
        const parsed = JSON.parse(savedSession);
        if (parsed?.name) setDoctorNameInput(parsed.name);
      } else {
        const localSavedName = localStorage.getItem("nktt_last_doctor_name");
        if (localSavedName) setDoctorNameInput(localSavedName);
      }
    } catch {}
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmed = doctorNameInput.trim();
    if (!trimmed) {
      setErrorMessage("Vui lòng nhập họ và tên bác sĩ.");
      return;
    }

    const profile = generateDoctorProfileFromName(trimmed);

    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem(
          "nktt_active_doctor_session",
          JSON.stringify({
            id: profile.id,
            name: profile.name,
            folderCode: profile.folderCode,
            loggedInAt: new Date().toISOString(),
          })
        );
        localStorage.setItem("nktt_last_doctor_name", profile.name);
        localStorage.setItem("nktt_last_doctor_code", profile.folderCode);
      } catch (err) {
        console.error("Lỗi khi lưu phiên bác sĩ:", err);
      }
    }

    onSelectDoctor(profile);
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.portalCard} style={{ maxWidth: "460px" }}>
        {/* Tiêu đề hộp thoại */}
        <div
          className={styles.portalHeader}
          style={{
            background: "linear-gradient(135deg, #14532d 0%, #166534 100%)",
            borderBottom: "1px solid #14532d",
            borderRadius: "8px 8px 0 0",
          }}
        >
          <div className={styles.portalTitleRow}>
            <div>
              <h2 className={styles.portalTitle} style={{ color: "#ffffff", fontSize: "1.15rem", fontWeight: 700, margin: 0 }}>
                Hệ thống Thẩm định Lâm sàng Chuyên khoa
              </h2>
              <p className={styles.portalSubtitle} style={{ color: "#bbf7d0", fontSize: "0.85rem", marginTop: "4px" }}>
                Kho 125 hồ sơ bệnh nhân
              </p>
            </div>
          </div>
        </div>

        {/* Nội dung hộp thoại */}
        <div className={styles.portalBody} style={{ padding: "1.25rem 1.5rem" }}>
          {/* Form nhập họ tên Bác sĩ */}
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              <label style={{ fontSize: "0.88rem", fontWeight: 700, color: "#0f172a" }}>
                Họ và tên Bác sĩ:
              </label>
              <input
                type="text"
                className={styles.passwordInput}
                placeholder="Ví dụ: Nguyễn Văn A..."
                value={doctorNameInput}
                onChange={(e) => {
                  setDoctorNameInput(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                autoFocus
                style={{
                  fontSize: "0.95rem",
                  padding: "0.7rem 0.9rem",
                  border: "1.5px solid #166534",
                  borderRadius: "6px",
                  color: "#0f172a",
                  fontWeight: 600,
                  backgroundColor: "#f8fafc",
                }}
              />
            </div>

            {errorMessage && <div className={styles.errorMessage}>{errorMessage}</div>}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.25rem" }}>
              {canClose && onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    padding: "0.65rem 1.1rem",
                    border: "1.5px solid #cbd5e1",
                    backgroundColor: "#ffffff",
                    color: "#475569",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: "0.85rem",
                  }}
                >
                  Quay lại
                </button>
              )}
              <button
                type="submit"
                className={styles.loginSubmitBtn}
                style={{
                  backgroundColor: "#166534",
                  padding: "0.65rem 1.4rem",
                  fontSize: "0.9rem",
                  fontWeight: 700,
                  borderRadius: "6px",
                  boxShadow: "0 2px 8px rgba(22, 101, 52, 0.25)",
                }}
              >
                Vào thẩm định
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
