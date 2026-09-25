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
                Quy chuẩn & Cam kết Thẩm định Lâm sàng
              </h2>
              <p className={styles.rulesSubtitle}>
                Bộ tiêu chuẩn đánh giá và chuẩn hóa hồ sơ lâm sàng chuyên khoa Răng Hàm Mặt
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
            <strong>Kính gửi Bác sĩ {doctorName || "chuyên khoa"}:</strong> Nhiệm vụ của Bác sĩ là thẩm định tính đúng sai của lượt thoại AI và biên tập lại câu trả lời theo các nguyên tắc ngắn gọn dưới đây:
          </div>

          <div className={styles.rulesList}>
            {/* Rule 1 */}
            <div className={styles.ruleItem}>
              <div className={styles.ruleBadge}>Nguyên tắc 1</div>
              <div className={styles.ruleContent}>
                <h4 className={styles.ruleHeading}>
                  Thẩm Định Kiến Thức &amp; An Toàn Lâm Sàng Ở Thời Điểm Hiện Tại
                </h4>
                <p className={styles.ruleDesc}>
                  Đánh giá tính chính xác y khoa ngay trong lượt thoại hiện tại. Sửa triệt để các tư vấn sai hoặc nguy hiểm (tự ý chỉ định kháng sinh, giảm đau liều cao, hoặc hướng dẫn sai kỹ thuật chăm sóc).
                </p>
              </div>
            </div>

            {/* Rule 2 */}
            <div className={styles.ruleItem}>
              <div className={styles.ruleBadge}>Nguyên tắc 2</div>
              <div className={styles.ruleContent}>
                <h4 className={styles.ruleHeading}>
                  Thẩm Định Ngữ Nghĩa Ở Thời Điểm Hiện Tại
                </h4>
                <p className={styles.ruleDesc}>
                  Kiểm tra câu trả lời có giải quyết đúng thắc mắc của bệnh nhân hay không. Chỉ cần thẩm định ngữ nghĩa và kiến thức tại thời điểm hiện tại, không cần đọc toàn bộ dòng thời gian của ca bệnh.
                </p>
              </div>
            </div>

            {/* Rule 3 */}
            <div className={styles.ruleItem}>
              <div className={styles.ruleBadge}>Nguyên tắc 3</div>
              <div className={styles.ruleContent}>
                <h4 className={styles.ruleHeading}>
                  Giữ Nguyên Ý Nghĩa Của Câu &amp; Cuộc Trò Chuyện
                </h4>
                <p className={styles.ruleDesc}>
                  Tuyệt đối không thay đổi ý định của bệnh nhân, không đảo ngược tình huống lâm sàng hay thêm bớt triệu chứng bệnh lý mới làm lệch bối cảnh gốc.
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
                  Biên tập câu từ trôi chảy, tự nhiên, chuẩn thuật ngữ Răng Hàm Mặt và dễ hiểu với người bệnh; tránh văn phong cứng nhắc, máy móc.
                </p>
              </div>
            </div>

            {/* Rule 5 */}
            <div className={styles.ruleItem}>
              <div className={styles.ruleBadge}>Nguyên tắc 5</div>
              <div className={styles.ruleContent}>
                <h4 className={styles.ruleHeading}>
                  Ghi Chú Ngắn Gọn &amp; Hoàn Thành Đủ 10 Ca/Gói
                </h4>
                <p className={styles.ruleDesc}>
                  Ghi chú ngắn gọn lý do duyệt hoặc nội dung đã chỉnh sửa (tối thiểu 20 ký tự). Hoàn thành đủ 10 ca và nhấn nút Lưu Gói để mở gói tiếp theo.
                </p>
              </div>
            </div>
          </div>

          {/* Agreement Checkbox */}
          <div className={styles.agreementBox}>
            <label className={styles.agreementLabel}>
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className={styles.agreementCheckbox}
              />
              <span className={styles.agreementText}>
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
