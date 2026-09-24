"use client";

import React, { useState } from "react";
import styles from "./DoctorAuth.module.css";

interface ClinicalRulesModalProps {
  isOpen: boolean;
  doctorName?: string;
  onAccept: () => void;
  onClose?: () => void;
  canDismiss?: boolean;
}

export default function ClinicalRulesModal({
  isOpen,
  doctorName,
  onAccept,
  onClose,
  canDismiss = false,
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
            <strong>Kính gửi Bác sĩ {doctorName || "chuyên khoa"}:</strong> Chương trình thẩm định chuyên môn nha khoa nhằm chuẩn hóa hồ sơ tư vấn lâm sàng chất lượng cao. Đề nghị Bác sĩ thực hiện nghiêm túc 5 nguyên tắc chuyên môn dưới đây:
          </div>

          <div className={styles.rulesList}>
            {/* Rule 1 */}
            <div className={styles.ruleItem}>
              <div className={styles.ruleBadge}>Nguyên tắc 1</div>
              <div className={styles.ruleContent}>
                <h4 className={styles.ruleHeading}>
                  Bảo đảm An toàn Sinh học & Giới hạn Tư vấn Sơ bộ
                </h4>
                <p className={styles.ruleDesc}>
                  Tuyệt đối không xác nhận các nội dung tư vấn nguy hiểm, vi phạm chống chỉ định y khoa (ví dụ: tự ý chỉ định thuốc kháng sinh, giảm đau liều cao khi chưa thăm khám trực tiếp, hoặc bỏ qua triệu chứng chấn thương cấp cứu hàm mặt).
                </p>
              </div>
            </div>

            {/* Rule 2 */}
            <div className={styles.ruleItem}>
              <div className={styles.ruleBadge}>Nguyên tắc 2</div>
              <div className={styles.ruleContent}>
                <h4 className={styles.ruleHeading}>
                  Đối chiếu Diễn tiến Hồ sơ & Tránh Nhầm lẫn Tiền sử
                </h4>
                <p className={styles.ruleDesc}>
                  Bác sĩ bắt buộc phải bấm xem lại các lần khám trước trong dòng thời gian. Phải phân biệt chính xác dữ liệu tiền sử đang còn hiệu lực (như cơ địa dị ứng, đang mang mắc cài niềng răng) với các thủ thuật đã hoàn tất từ lâu (đã tháo niềng, răng khôn đã nhổ lành thương) để tránh tình trạng tư vấn sai lệch.
                </p>
              </div>
            </div>

            {/* Rule 3 */}
            <div className={styles.ruleItem}>
              <div className={styles.ruleBadge}>Nguyên tắc 3</div>
              <div className={styles.ruleContent}>
                <h4 className={styles.ruleHeading}>
                  Bảo toàn Ý nghĩa Cốt lõi & Chuẩn hóa Ngôn ngữ Lâm sàng Tự nhiên
                </h4>
                <p className={styles.ruleDesc}>
                  Khi hiệu chỉnh câu hỏi hoặc lời thoại trong các lần khám, Bác sĩ chỉ trau chuốt câu từ cho tự nhiên và chuẩn xác thuật ngữ chuyên ngành Răng Hàm Mặt. Tuyệt đối KHÔNG tự ý thay đổi bản chất bệnh lý, không đảo ngược tình huống lâm sàng hoặc làm biến đổi hoàn toàn ý nghĩa ngữ cảnh gốc của đoạn hội thoại (ví dụ: không được tự ý đổi từ "đang đeo hàm duy trì" thành "đã tháo hoàn toàn", hoặc tự ý thêm bớt triệu chứng mới làm sai lệch tiến trình điều trị).
                </p>
              </div>
            </div>

            {/* Rule 4 */}
            <div className={styles.ruleItem}>
              <div className={styles.ruleBadge}>Nguyên tắc 4</div>
              <div className={styles.ruleContent}>
                <h4 className={styles.ruleHeading}>
                  Biện giải Lâm sàng Bắt buộc cho Từng Ca bệnh
                </h4>
                <p className={styles.ruleDesc}>
                  Mỗi ca thẩm định phải có ghi chú chuyên môn tối thiểu từ 20 đến 30 ký tự, nêu rõ lý do chuẩn y hoặc điểm chỉnh sửa lâm sàng. Hệ thống sẽ từ chối lưu các gói thẩm định hời hợt, để trống ghi chú hoặc sao chép nội dung lặp lại mang tính đối phó.
                </p>
              </div>
            </div>

            {/* Rule 5 */}
            <div className={styles.ruleItem}>
              <div className={styles.ruleBadge}>Nguyên tắc 5</div>
              <div className={styles.ruleContent}>
                <h4 className={styles.ruleHeading}>
                  Kỷ luật Quy trình: 10 Ca/Gói, Bắt buộc Lưu Trước Khi Chuyển
                </h4>
                <p className={styles.ruleDesc}>
                  Bác sĩ hoàn thành đủ 10 ca trong gói hiện tại, kiểm tra lại cẩn trọng và nhấn nút Lưu. Chỉ khi gói hiện tại được lưu và xác thực thành công thì gói tiếp theo mới được mở khóa.
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
            Vào Không Gian Thẩm Định
          </button>
        </div>
      </div>
    </div>
  );
}
