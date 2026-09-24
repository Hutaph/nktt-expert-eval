"use client";

import React, { useState } from "react";
import styles from "./ExampleComparisonModal.module.css";

interface ExampleComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ExampleComparisonModal({
  isOpen,
  onClose,
}: ExampleComparisonModalProps) {
  const [activeTab, setActiveTab] = useState<"BEFORE" | "AFTER">("BEFORE");

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.modalCard}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Bang mau doi chieu truoc va sau khi tham dinh"
      >
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.headerTitleArea}>
            <h2 className={styles.modalTitle}>
              Bảng Mẫu Đối Chiếu: Trước & Sau Khi Thẩm Định Lâm Sàng
            </h2>
            <p className={styles.modalSubtitle}>
              Minh họa tình huống thực tế và cách Bác sĩ chuyên khoa chuẩn hóa hồ sơ tư vấn Răng Hàm Mặt
            </p>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            title="Đóng cửa sổ"
          >
            Đóng
          </button>
        </div>

        {/* Tab Navigation */}
        <div className={styles.tabBar}>
          <button
            type="button"
            className={[
              styles.tabBtn,
              activeTab === "BEFORE" ? styles.tabBtnActiveBefore : "",
            ].filter(Boolean).join(" ")}
            onClick={() => setActiveTab("BEFORE")}
          >
            <span>Tab 1: Trước khi thẩm định</span>
            <span className={styles.tabBadgeBefore}>Bản thô chưa duyệt</span>
          </button>

          <button
            type="button"
            className={[
              styles.tabBtn,
              activeTab === "AFTER" ? styles.tabBtnActiveAfter : "",
            ].filter(Boolean).join(" ")}
            onClick={() => setActiveTab("AFTER")}
          >
            <span>Tab 2: Sau khi thẩm định</span>
            <span className={styles.tabBadgeAfter}>Bác sĩ đã hiệu chỉnh</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className={styles.modalBody}>
          {activeTab === "BEFORE" ? (
            /* TAB 1: TRƯỚC KHI THẨM ĐỊNH */
            <>
              <div className={styles.infoBannerBefore}>
                <strong>Đặc điểm bản thô (Mô hình AI tự động sinh):</strong> Câu hỏi của Người hỏi còn cụt lủn, tư vấn lâm sàng mang tính chung chung, bỏ quên tiền sử Người hỏi đang đeo mắc cài chỉnh nha ở lần khám trước và chỉ định dung dịch sát khuẩn kéo dài thiếu an toàn sinh học.
              </div>

              {/* Meta Case Card */}
              <div className={styles.caseMetaCard}>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Mã ca minh họa:</span>
                  <span className={styles.metaValue}>VIDENT-ORTHO-042 (Thuộc Gói 1)</span>
                </div>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Tiền sử chặng khám:</span>
                  <span className={styles.metaValue}>
                    Lần khám 1 (S01): Gắn mắc cài kim loại hai hàm | Lần khám 2 (S02): Siết dây cung, hướng dẫn dùng sáp chỉnh nha | Lần khám 3 (S03): Thắc mắc chăm sóc răng miệng hiện tại
                  </span>
                </div>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Chủ đề Người hỏi:</span>
                  <span className={styles.metaValue}>
                    <span className={styles.metaHighlightRed}>
                      "cho em hỏi cách dùng bàn chải điện với nước súc miệng"
                    </span>
                    {" "}(Câu hỏi sơ sài, thiếu liên kết với tình trạng đang niềng răng)
                  </span>
                </div>
              </div>

              {/* Dialogue Box */}
              <div className={styles.dialogueSection}>
                <div className={styles.sectionHeading}>
                  <span>Diễn tiến câu thoại tại lần khám hiện tại (Bản thô):</span>
                  <span className={styles.metaHighlightRed}>Chưa qua kiểm duyệt lâm sàng</span>
                </div>

                <div className={styles.dialogueBox}>
                  {/* Pair 1 */}
                  <div className={[styles.utteranceItem, styles.utterancePatient].join(" ")}>
                    <span className={[styles.speakerTag, styles.speakerPatient].join(" ")}>
                      NGƯỜI HỎI [00:53]
                    </span>
                    <div className={styles.utteranceText}>
                      Khi đổi sang bàn chải điện thì nên chọn đầu bàn chải và lực chải thế nào?
                    </div>
                  </div>
                  <div className={[styles.utteranceItem, styles.utteranceDoctor].join(" ")}>
                    <span className={[styles.speakerTag, styles.speakerDoctor].join(" ")}>
                      BÁC SĨ (Bản thô) [01:00]
                    </span>
                    <div className={styles.utteranceText}>
                      Bạn nên chọn đầu bàn chải nhỏ lông mềm. Cứ chải qua lại các mặt răng là sạch. Nếu máy rung mạnh thì giảm bớt là được.
                      <span className={styles.textDiffRemoved}>
                        {" "}[Thiếu cảnh báo an toàn: không nhắc đến cảm biến áp lực, nguy cơ tụt nướu và ê buốt do tì đè mạnh]
                      </span>
                    </div>
                  </div>

                  {/* Pair 2 */}
                  <div className={[styles.utteranceItem, styles.utterancePatient].join(" ")}>
                    <span className={[styles.speakerTag, styles.speakerPatient].join(" ")}>
                      NGƯỜI HỎI [01:07]
                    </span>
                    <div className={styles.utteranceText}>
                      Nếu đang có dụng cụ trong miệng thì làm sạch kẽ răng ra sao?
                    </div>
                  </div>
                  <div className={[styles.utteranceItem, styles.utteranceDoctor].join(" ")}>
                    <span className={[styles.speakerTag, styles.speakerDoctor].join(" ")}>
                      BÁC SĨ (Bản thô) [01:14]
                    </span>
                    <div className={styles.utteranceText}>
                      Bạn dùng chỉ nha khoa thông thường chải sạch kẽ răng mỗi ngày là sạch sẽ.
                      <span className={styles.textDiffRemoved}>
                        {" "}[Lỗi lâm sàng nghiêm trọng: Người hỏi đang đeo mắc cài từ lần khám S01, dùng chỉ thường không có đầu luồn sẽ vướng mắc cài hoặc đứt chỉ; không nhắc bàn chải kẽ chuyên dụng]
                      </span>
                    </div>
                  </div>

                  {/* Pair 3 */}
                  <div className={[styles.utteranceItem, styles.utterancePatient].join(" ")}>
                    <span className={[styles.speakerTag, styles.speakerPatient].join(" ")}>
                      NGƯỜI HỎI [01:21]
                    </span>
                    <div className={styles.utteranceText}>
                      Có nên súc nước súc miệng hàng ngày thay cho đánh răng không?
                    </div>
                  </div>
                  <div className={[styles.utteranceItem, styles.utteranceDoctor].join(" ")}>
                    <span className={[styles.speakerTag, styles.speakerDoctor].join(" ")}>
                      BÁC SĨ (Bản thô) [01:28]
                    </span>
                    <div className={styles.utteranceText}>
                      Nước súc miệng diệt khuẩn rất tốt, bạn có thể mua loại chlorhexidine súc miệng hàng ngày cả tháng để răng luôn sạch và thơm tho.
                      <span className={styles.textDiffRemoved}>
                        {" "}[Vi phạm an toàn sinh học: Chlorhexidine súc dài ngày gây ố vàng răng, nhuộm màu khí cụ và mất vị giác]
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Evaluation Status Grid */}
              <div className={styles.evalSummaryGrid}>
                <div className={styles.evalCard}>
                  <h4 className={styles.evalCardTitle}>Trạng thái Thẩm định Chưa Thực Hiện</h4>
                  <div className={styles.verdictBadgeBefore}>KẾT LUẬN: CHƯA THẨM ĐỊNH</div>
                  <div className={styles.checklistSummary}>
                    <div className={styles.checklistItemMissing}>Chưa đối chiếu tiền sử lần khám S01 và S02</div>
                    <div className={styles.checklistItemMissing}>Chưa bảo đảm an toàn sinh học y khoa</div>
                    <div className={styles.checklistItemMissing}>Chưa chuẩn hóa thuật ngữ chuyên ngành Răng Hàm Mặt</div>
                  </div>
                </div>

                <div className={styles.evalCard}>
                  <h4 className={styles.evalCardTitle}>Ghi chú Nhận xét Lâm sàng</h4>
                  <div className={styles.notesContentBefore}>
                    [Chưa có nhận xét - Hệ thống sẽ chặn lưu gói nếu để trống hoặc viết dưới 20 ký tự]
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* TAB 2: SAU KHI THẨM ĐỊNH */
            <>
              <div className={styles.infoBannerAfter}>
                <strong>Kết quả sau khi Bác sĩ chuyên khoa hiệu chỉnh:</strong> Đã rà soát tiền sử 3 lần khám, trau chuốt câu hỏi của Người hỏi cho chuẩn xác, bổ sung hướng dẫn chuyên sâu cho người mang mắc cài chỉnh nha và chấn chỉnh an toàn sinh học đối với dung dịch sát khuẩn.
              </div>

              {/* Meta Case Card */}
              <div className={styles.caseMetaCard}>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Mã ca minh họa:</span>
                  <span className={styles.metaValue}>VIDENT-ORTHO-042 (Đã xác nhận chính thức)</span>
                </div>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Tiền sử chặng khám:</span>
                  <span className={styles.metaValue}>
                    Đã xem đủ 3/3 lần khám (S01, S02, S03) | Xác nhận Người hỏi đang mang mắc cài chỉnh nha kim loại hai hàm
                  </span>
                </div>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Chủ đề Người hỏi:</span>
                  <span className={styles.metaValue}>
                    <span className={styles.metaHighlightGreen}>
                      "Khi đổi sang bàn chải điện và có khí cụ chỉnh nha trong miệng thì nên vệ sinh răng và dùng nước súc miệng như thế nào?"
                    </span>
                    {" "}(Đã hiệu chỉnh đầy đủ ngữ cảnh y khoa)
                  </span>
                </div>
              </div>

              {/* Dialogue Box */}
              <div className={styles.dialogueSection}>
                <div className={styles.sectionHeading}>
                  <span>Diễn tiến câu thoại sau hiệu chỉnh lâm sàng:</span>
                  <span className={styles.metaHighlightGreen}>Chuẩn y khoa Răng Hàm Mặt</span>
                </div>

                <div className={styles.dialogueBox}>
                  {/* Pair 1 */}
                  <div className={[styles.utteranceItem, styles.utterancePatient].join(" ")}>
                    <span className={[styles.speakerTag, styles.speakerPatient].join(" ")}>
                      NGƯỜI HỎI [00:53]
                    </span>
                    <div className={styles.utteranceText}>
                      Khi đổi sang bàn chải điện thì nên chọn đầu bàn chải và mức lực như thế nào?
                    </div>
                  </div>
                  <div className={[styles.utteranceItem, styles.utteranceDoctor].join(" ")}>
                    <span className={[styles.speakerTag, styles.speakerDoctor].join(" ")}>
                      BÁC SĨ (Đã hiệu chỉnh) [01:00]
                    </span>
                    <div className={styles.utteranceText}>
                      Đầu bàn chải nhỏ, lông mềm giúp tiếp cận từng vùng mà không cần tạo lực lớn. <span className={styles.textDiffAdded}>Nếu máy có cảm biến áp lực, nên giữ lực dưới ngưỡng cảnh báo và để chuyển động của đầu bàn chải thực hiện phần lớn công việc thay vì chà qua lại mạnh.</span> Nếu xuất hiện đau, tụt nướu hoặc ê buốt tăng sau khi đổi dụng cụ, nên dừng mức lực cao và nhờ nha sĩ kiểm tra kỹ thuật.
                    </div>
                  </div>

                  {/* Pair 2 */}
                  <div className={[styles.utteranceItem, styles.utterancePatient].join(" ")}>
                    <span className={[styles.speakerTag, styles.speakerPatient].join(" ")}>
                      NGƯỜI HỎI [01:07]
                    </span>
                    <div className={styles.utteranceText}>
                      Nếu đang có khí cụ trong miệng thì vùng kẽ nên được làm sạch theo nguyên tắc nào?
                    </div>
                  </div>
                  <div className={[styles.utteranceItem, styles.utteranceDoctor].join(" ")}>
                    <span className={[styles.speakerTag, styles.speakerDoctor].join(" ")}>
                      BÁC SĨ (Đã hiệu chỉnh) [01:14]
                    </span>
                    <div className={styles.utteranceText}>
                      <span className={styles.textDiffAdded}>Khí cụ chỉnh nha tạo thêm nhiều bề mặt giữ mảng bám, vì vậy bàn chải thông thường thường cần phối hợp với bàn chải kẽ hoặc chỉ có đầu luồn. Với mắc cài, nên làm sạch cả phía trên và dưới cánh mắc cài; với khay trong suốt, cần vệ sinh răng trước khi đeo lại khay để hạn chế giữ đường và axit sát răng.</span> Nếu dây cung tuột, mắc cài bong, đau niêm mạc kéo dài hoặc khớp cắn thay đổi bất thường thì nên liên hệ bác sĩ chỉnh nha.
                    </div>
                  </div>

                  {/* Pair 3 */}
                  <div className={[styles.utteranceItem, styles.utterancePatient].join(" ")}>
                    <span className={[styles.speakerTag, styles.speakerPatient].join(" ")}>
                      NGƯỜI HỎI [01:21]
                    </span>
                    <div className={styles.utteranceText}>
                      Có cần dùng nước súc miệng mỗi ngày nếu mình đã chải răng và làm sạch kẽ đầy đủ không?
                    </div>
                  </div>
                  <div className={[styles.utteranceItem, styles.utteranceDoctor].join(" ")}>
                    <span className={[styles.speakerTag, styles.speakerDoctor].join(" ")}>
                      BÁC SĨ (Đã hiệu chỉnh) [01:28]
                    </span>
                    <div className={styles.utteranceText}>
                      Nước súc miệng không thay thế việc phá mảng bám bằng bàn chải và làm sạch kẽ. Một số sản phẩm có fluoride hoặc hoạt chất khác có thể hữu ích trong tình huống cụ thể, <span className={styles.textDiffAdded}>còn dung dịch sát khuẩn như chlorhexidine thường chỉ nên dùng ngắn hạn khi có chỉ định vì có thể gây nhuộm màu răng và thay đổi vị giác.</span> Nếu cần dùng kéo dài, nên hỏi nha sĩ về mục tiêu và thời gian sử dụng.
                    </div>
                  </div>
                </div>
              </div>

              {/* Evaluation Status Grid */}
              <div className={styles.evalSummaryGrid}>
                <div className={styles.evalCard}>
                  <h4 className={styles.evalCardTitle}>Kết Quả Thẩm Định Hoàn Tất</h4>
                  <div className={styles.verdictBadgeAfter}>KẾT LUẬN: HIỆU CHỈNH ĐẠT CHUẨN (EDITED)</div>
                  <div className={styles.checklistSummary}>
                    <div className={styles.checklistItemOk}>Đã đối chiếu tiền sử lần khám S01 (mắc cài kim loại) và S02 (siết cung)</div>
                    <div className={styles.checklistItemOk}>Bảo đảm an toàn sinh học: khuyến cáo dừng chlorhexidine dài hạn</div>
                    <div className={styles.checklistItemOk}>Chuẩn hóa thuật ngữ Răng Hàm Mặt: bàn chải kẽ, cánh mắc cài, đầu luồn</div>
                  </div>
                </div>

                <div className={styles.evalCard}>
                  <h4 className={styles.evalCardTitle}>Nhận Xét Lâm Sàng Của Bác Sĩ (286 ký tự)</h4>
                  <div className={styles.notesContentAfter}>
                    "Đối chiếu lần khám S01 và S02 xác định Người hỏi đang trong giai đoạn chỉnh nha với mắc cài kim loại và dây cung. Đã hiệu chỉnh bổ sung hướng dẫn làm sạch kẽ quanh mắc cài và cảnh báo an toàn sinh học: không lạm dụng chlorhexidine kéo dài để phòng biến chứng ố men răng và rối loạn vị giác. Câu thoại đạt chuẩn mực chuyên môn Răng Hàm Mặt."
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className={styles.modalFooter}>
          <button
            type="button"
            className={styles.switchTabBtn}
            onClick={() => setActiveTab(activeTab === "BEFORE" ? "AFTER" : "BEFORE")}
          >
            {activeTab === "BEFORE"
              ? "Chuyển sang xem Sau thẩm định"
              : "Quay lại xem Trước thẩm định"}
          </button>
          <button
            type="button"
            className={styles.dismissBtn}
            onClick={onClose}
          >
            Đóng cửa sổ
          </button>
        </div>
      </div>
    </div>
  );
}
