"use client";

import React from "react";
import styles from "./DoctorAuth.module.css";

interface QualityWarningModalProps {
  isOpen: boolean;
  batchNumber: number;
  findings: string[];
  onBack: () => void;
  onConfirmSave: () => void;
}

export default function QualityWarningModal({
  isOpen,
  batchNumber,
  findings,
  onBack,
  onConfirmSave,
}: QualityWarningModalProps) {
  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.warningCard}>
        {/* Header */}
        <div className={styles.warningHeader}>
          <svg
            className={styles.warningSvg}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <h3 className={styles.warningTitle}>
            Cảnh báo chất lượng thẩm định lâm sàng (Gói {batchNumber})
          </h3>
        </div>

        {/* Body */}
        <div className={styles.warningBody}>
          <p style={{ margin: 0, fontWeight: 600 }}>
            Hệ thống phát hiện một số dấu hiệu thẩm định sơ sài trong gói này:
          </p>

          <ul className={styles.warningList}>
            {findings.map((finding, idx) => (
              <li key={idx}>{finding}</li>
            ))}
          </ul>

          <p style={{ margin: 0, color: "var(--color-text-muted)", fontSize: "0.825rem" }}>
            Khuyến nghị: Nhận xét chuyên khoa chi tiết là căn cứ lâm sàng quan trọng để tinh chỉnh mô hình AI y tế. Vui lòng ghi chú lý do chấp thuận hoặc điều chỉnh đối với các ca bệnh.
          </p>
        </div>

        {/* Footer */}
        <div className={styles.warningFooter}>
          <button type="button" className={styles.btnBack} onClick={onBack}>
            Quay lại bổ sung nhận xét cho đạt chuẩn
          </button>
        </div>
      </div>
    </div>
  );
}
