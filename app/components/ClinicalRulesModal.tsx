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
            <strong>Kính gửi Bác sĩ {doctorName || "chuyên khoa"}:</strong> Nhiệm vụ của Bác sĩ là đọc từng ca hội thoại giữa bệnh nhân và hệ thống AI nha khoa, sau đó đánh giá chất lượng tư vấn và biên tập lại (nếu cần) theo đúng chuẩn mực lâm sàng Răng Hàm Mặt. Đề nghị Bác sĩ thực hiện nghiêm túc 5 nguyên tắc dưới đây trước khi bắt đầu:
          </div>

          <div className={styles.rulesList}>
            {/* Rule 1 */}
            <div className={styles.ruleItem}>
              <div className={styles.ruleBadge}>Nguyên tắc 1</div>
              <div className={styles.ruleContent}>
                <h4 className={styles.ruleHeading}>
                  Phát Hiện &amp; Chấn Chỉnh Sai Sót An Toàn Lâm Sàng
                </h4>
                <p className={styles.ruleDesc}>
                  Bác sĩ phải xác định và sửa triệt để mọi nội dung AI tư vấn sai về mặt y khoa: khuyến cáo dùng thuốc kháng sinh hoặc giảm đau liều cao mà không có chỉ định khám trực tiếp; xem nhẹ dấu hiệu cấp cứu hàm mặt; hoặc hướng dẫn kỹ thuật sai gây nguy hiểm cho bệnh nhân (ví dụ: dùng chlorhexidine thay thế hoàn toàn bàn chải răng; dùng chỉ thường không có đầu luồn khi đang mang mắc cài). Trường hợp phát hiện sai sót nghiêm trọng, Bác sĩ viết lại câu trả lời đúng chuẩn, không để nguyên bản thô.
                </p>
              </div>
            </div>

            {/* Rule 2 */}
            <div className={styles.ruleItem}>
              <div className={styles.ruleBadge}>Nguyên tắc 2</div>
              <div className={styles.ruleContent}>
                <h4 className={styles.ruleHeading}>
                  Đọc Toàn Bộ Dòng Thời Gian Trước Khi Thẩm Định
                </h4>
                <p className={styles.ruleDesc}>
                  Trước khi thẩm định từng lượt thoại, Bác sĩ bắt buộc xem lại toàn bộ lịch sử các lần khám trước trong dòng thời gian của ca bệnh. Phải phân biệt chính xác tiền sử đang còn hiệu lực (ví dụ: đang mang mắc cài, đang dùng hàm duy trì cố định, dị ứng vật liệu nha khoa) với các thủ thuật đã hoàn tất (đã tháo niềng, răng khôn đã nhổ lành hẳn). Không thẩm định dựa trên một lượt thoại riêng lẻ mà bỏ qua bối cảnh lâm sàng xuyên suốt của bệnh nhân.
                </p>
              </div>
            </div>

            {/* Rule 3 */}
            <div className={styles.ruleItem}>
              <div className={styles.ruleBadge}>Nguyên tắc 3</div>
              <div className={styles.ruleContent}>
                <h4 className={styles.ruleHeading}>
                  Trau Chuốt Câu Từ Tự Nhiên, Không Thay Đổi Bản Chất Lâm Sàng
                </h4>
                <p className={styles.ruleDesc}>
                  Khi biên tập câu hỏi của bệnh nhân hoặc câu trả lời của AI, Bác sĩ chỉ chỉnh sửa câu từ cho trôi chảy, tự nhiên và chuẩn xác thuật ngữ Răng Hàm Mặt. Tuyệt đối không tự ý đổi bản chất bệnh lý, đảo ngược tình trạng lâm sàng hoặc thêm bớt triệu chứng không có trong ngữ cảnh gốc. Ví dụ: không được đổi “đang đeo hàm duy trì” thành “đã tháo hoàn toàn”; không thêm triệu chứng đau khu trú vào ca bệnh vốn chỉ hỏi về vệ sinh răng miệng thông thường.
                </p>
              </div>
            </div>

            {/* Rule 4 */}
            <div className={styles.ruleItem}>
              <div className={styles.ruleBadge}>Nguyên tắc 4</div>
              <div className={styles.ruleContent}>
                <h4 className={styles.ruleHeading}>
                  Ghi Chú Chuyên Môn Rõ Ràng Cho Từng Ca
                </h4>
                <p className={styles.ruleDesc}>
                  Sau mỗi ca thẩm định, Bác sĩ bắt buộc điền ghi chú chuyên môn tối thiểu 20 ký tự, nêu cụ thể lý do chuẩn y (ví dụ: &ldquo;Câu trả lời đủ chỉ dẫn kỹ thuật, an toàn lâm sàng&rdquo;) hoặc mô tả điểm đã chỉnh sửa (ví dụ: &ldquo;Sửa chỉ định chlorhexidine: chỉ dùng ngắn hạn khi có chỉ định, không thay thế bàn chải&rdquo;). Ghi chú sao chép lặp lại hoặc để trống sẽ bị hệ thống từ chối lưu.
                </p>
              </div>
            </div>

            {/* Rule 5 */}
            <div className={styles.ruleItem}>
              <div className={styles.ruleBadge}>Nguyên tắc 5</div>
              <div className={styles.ruleContent}>
                <h4 className={styles.ruleHeading}>
                  Hoàn Thành Đủ 10 Ca/Gói, Lưu Trước Khi Chuyển Gói Tiếp Theo
                </h4>
                <p className={styles.ruleDesc}>
                  Mỗi gói thẩm định gồm 10 ca liên tiếp. Bác sĩ phải hoàn thành và kiểm tra lại toàn bộ 10 ca trong gói hiện tại, sau đó nhấn nút Xác nhận &amp; Lưu Gói để đồng bộ lên hệ thống. Chỉ khi gói hiện tại được lưu thành công, gói kế tiếp mới được mở khóa. Không bỏ qua ca, không chuyển gói khi chưa lưu đầy đủ.
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
