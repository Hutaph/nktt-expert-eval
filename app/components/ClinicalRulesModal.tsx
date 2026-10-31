"use client";

import React, { useState } from "react";
import styles from "./DoctorAuth.module.css";

interface ClinicalRulesModalProps {
  isOpen: boolean;
  doctorName?: string;
  onAccept: () => void;
  onClose?: () => void;
  canDismiss?: boolean;
  acceptButtonText?: string;
}

export default function ClinicalRulesModal({
  isOpen,
  doctorName,
  onAccept,
  onClose,
  canDismiss = false,
  acceptButtonText,
}: ClinicalRulesModalProps) {
  const [agreed, setAgreed] = useState<boolean>(false);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.rulesCard}>
        {/* Header */}
        <div className={styles.rulesHeader}>
          <div className={styles.rulesHeaderRow}>
            <svg
              className={styles.rulesIconSvg}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            <div>
              <h2 className={styles.rulesTitle}>
                Quy chuẩn &amp; Cam kết Thẩm định Lâm sàng
              </h2>
              <p className={styles.rulesSubtitle}>
                Bộ tiêu chuẩn đánh giá và chuẩn hóa hội thoại AI chuyên khoa Răng Hàm Mặt
              </p>
            </div>
          </div>
          {canDismiss && onClose && (
            <button
              type="button"
              className={styles.rulesCloseBtn}
              onClick={onClose}
              title="Đóng cửa sổ quy chuẩn"
            >
              Đóng
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className={styles.rulesBody}>
          <div className={styles.rulesNoticeBox}>
            <strong>Kính gửi Bác sĩ {doctorName || "chuyên khoa"}:</strong> Trọng tâm thẩm định là câu trả lời của Bác sĩ AI. Đối với lượt thoại của Người hỏi: Bác sĩ có thể bỏ qua nếu câu hỏi đã ổn và có nghĩa. Hãy tập trung đánh giá chuyên sâu vào tính đúng đắn và an toàn y khoa trong câu trả lời của Bác sĩ.
          </div>

          <div className={styles.rulesList}>
            {/* Rule 1 */}
            <div className={styles.ruleItem}>
              <div className={styles.ruleBadge}>Nguyên tắc 1</div>
              <div className={styles.ruleContent}>
                <h4 className={styles.ruleHeading}>
                  Thẩm Định Kiến Thức &amp; An Toàn Lâm Sàng
                </h4>
                <p className={styles.ruleDesc}>
                  Đánh giá tính chính xác y khoa của từng lượt thoại. Sửa triệt để các tư vấn sai hoặc nguy hiểm: tự ý chỉ định kháng sinh, giảm đau liều cao, hướng dẫn sai kỹ thuật chăm sóc răng miệng.
                </p>
              </div>
            </div>

            {/* Rule 2 */}
            <div className={styles.ruleItem}>
              <div className={styles.ruleBadge}>Nguyên tắc 2</div>
              <div className={styles.ruleContent}>
                <h4 className={styles.ruleHeading}>
                  Thẩm Định Ngữ Nghĩa &amp; Tập Trung Câu Trả Lời Của Bác Sĩ
                </h4>
                <p className={styles.ruleDesc}>
                  Kiểm tra câu trả lời của Bác sĩ AI có giải quyết đúng thắc mắc của bệnh nhân không. Có thể bỏ qua câu hỏi của Người hỏi nếu câu đó đã ổn và có nghĩa; tập trung tối đa vào việc chuẩn hóa câu trả lời của Bác sĩ.
                </p>
              </div>
            </div>

            {/* Rule 3 */}
            <div className={styles.ruleItem}>
              <div className={styles.ruleBadge}>Nguyên tắc 3</div>
              <div className={styles.ruleContent}>
                <h4 className={styles.ruleHeading}>
                  Giữ Nguyên Ý Nghĩa Gốc &amp; Giảm Can Thiệp Người Hỏi
                </h4>
                <p className={styles.ruleDesc}>
                  Không cần sửa câu hỏi của người hỏi nếu câu đã hiểu được ý và rõ nghĩa. Tuyệt đối không thay đổi ý định của bệnh nhân, không đảo ngược tình huống lâm sàng, không thêm bớt triệu chứng mới làm lệch bối cảnh gốc.
                </p>
              </div>
            </div>

            {/* Rule 4 */}
            <div className={styles.ruleItem}>
              <div className={styles.ruleBadge}>Nguyên tắc 4</div>
              <div className={styles.ruleContent}>
                <h4 className={styles.ruleHeading}>
                  Ngôn Ngữ Tự Nhiên &amp; Chuẩn Xác Thuật Ngữ
                </h4>
                <p className={styles.ruleDesc}>
                  Biên tập câu từ trôi chảy, tự nhiên, chuẩn thuật ngữ Răng Hàm Mặt và dễ hiểu với người bệnh; tránh văn phong cứng nhắc, máy móc hoặc dịch máy.
                </p>
              </div>
            </div>

            {/* Rule 5 */}
            <div className={styles.ruleItem}>
              <div className={styles.ruleBadge}>Nguyên tắc 5</div>
              <div className={styles.ruleContent}>
                <h4 className={styles.ruleHeading}>
                  Hoàn Tất Mẫu Hiện Tại Trước Khi Chuyển Sang Mẫu Khác
                </h4>
                <p className={styles.ruleDesc}>
                  Bác sĩ bắt buộc phải hoàn tất đánh giá đủ toàn bộ lượt thoại (chọn V hoặc X) và hoàn thiện các câu cần chỉnh sửa cho mẫu đang phụ trách trước khi chuyển sang mẫu khác, tránh làm ảnh hưởng đến các mẫu và tiến độ phân bổ của các bác sĩ khác.
                </p>
              </div>
            </div>
          </div>

          {/* Important Storage Notice */}
          <div className={styles.rulesNoticeBox} style={{ marginTop: "1rem", backgroundColor: "#f0fdf4", borderColor: "#bbf7d0", borderLeft: "4px solid #166534", color: "#14532d" }}>
            <strong>Lưu ý bắt buộc:</strong> Bác sĩ cần kiểm tra kỹ lưỡng và đảm bảo chuẩn xác trước khi bấm nút <em>&quot;Lưu Mẫu&quot;</em>, tránh trường hợp phải quay lại sửa làm gián đoạn tiến độ và ảnh hưởng dữ liệu đồng bộ của hệ thống. Mỗi mẫu chỉ được ghi nhận hoàn tất khi đã thẩm định đủ toàn bộ lượt thoại và được bấm Lưu Mẫu thành công.
          </div>

          {/* Agreement Checkbox */}
          <div
            className={styles.agreementBox}
            style={{
              backgroundColor: "#f0fdf4",
              border: "2px solid #166534",
              borderRadius: "8px",
            }}
          >
            <label className={styles.agreementLabel}>
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className={styles.agreementCheckbox}
                style={{ accentColor: "#166534" }}
              />
              <span
                className={styles.agreementText}
                style={{
                  color: "#dc2626",
                  fontWeight: 700,
                  fontSize: "0.88rem",
                }}
              >
                Tôi đã đọc kỹ, nắm vững toàn bộ quy chuẩn lâm sàng trên và cam kết thực hiện thẩm định một cách trung thực, cẩn trọng và chuẩn xác.
              </span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className={styles.rulesFooter}>
          {canDismiss && onClose && (
            <button type="button" className={styles.rulesBtnSecondary} onClick={onClose}>
              Đóng
            </button>
          )}
          <button
            type="button"
            className={styles.rulesBtnPrimary}
            disabled={!agreed}
            onClick={onAccept}
          >
            {acceptButtonText || "Tiếp tục: Xem bảng ví dụ mẫu"}
          </button>
        </div>
      </div>
    </div>
  );
}
