"use client";

import React, { useState } from "react";
import styles from "./ExampleComparisonModal.module.css";

interface ExampleComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  dismissText?: string;
}

export default function ExampleComparisonModal({
  isOpen,
  onClose,
  dismissText = "Đóng cửa sổ",
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
              Bảng Mẫu Đối Chiếu: Bản Thô và Sau Khi Thẩm Định
            </h2>
            <p className={styles.modalSubtitle}>
              Minh họa nhiệm vụ: Đánh giá lượt thoại AI (v/x), biên tập lại câu từ (không đổi ngữ nghĩa gốc) và sửa triệt để kiến thức sai hoặc nguy hiểm
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
            <span>Tab 1: Bản thô từ AI</span>
            <span className={styles.tabBadgeBefore}>Chưa thẩm định</span>
          </button>

          <button
            type="button"
            className={[
              styles.tabBtn,
              activeTab === "AFTER" ? styles.tabBtnActiveAfter : "",
            ].filter(Boolean).join(" ")}
            onClick={() => setActiveTab("AFTER")}
          >
            <span>Tab 2: Sau khi Bác sĩ thẩm định</span>
            <span className={styles.tabBadgeAfter}>Bản chuẩn mực y khoa</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className={styles.modalBody}>
          {activeTab === "BEFORE" ? (
            /* TAB 1: TRƯỚC KHI CHỈNH SỬA */
            <>

              {/* Dialogue Box */}
              <div className={styles.dialogueSection}>
                <div className={styles.sectionHeading}>
                  <span>Lượt thoại bản thô (Cần Bác sĩ thẩm định và biên tập lại):</span>
                  <span className={styles.metaHighlightRed}>Chưa đạt chuẩn — Đánh dấu x và sửa</span>
                </div>

                <div className={styles.dialogueBox}>
                  {/* Pair 1: Cụt ngủn, thiếu đầy đủ */}
                  <div className={[styles.utteranceItem, styles.utterancePatient].join(" ")}>
                    <span className={[styles.speakerTag, styles.speakerPatient].join(" ")}>
                      NGƯỜI HỎI [00:53]
                    </span>
                    <div className={styles.utteranceText}>
                      Khi đổi sang bàn chải điện thì xài đầu nào với lực sao cho đỡ buốt?
                      <span style={{ color: "#166534", fontSize: "0.8rem", fontWeight: 600 }}> [Câu hỏi đã rõ nghĩa: Bác sĩ có thể bỏ qua không cần sửa]</span>
                    </div>
                  </div>
                  <div className={[styles.utteranceItem, styles.utteranceDoctor].join(" ")}>
                    <span className={[styles.speakerTag, styles.speakerDoctor].join(" ")}>
                      BÁC SĨ (Bản thô) [01:00]
                    </span>
                    <div className={styles.utteranceText}>
                      Đầu nhỏ lông mềm là được. Máy rung mạnh thì tự giảm bớt, cứ chải như bình thường.
                      <span className={styles.textDiffRemoved}>
                        {" "}[Khiếm khuyết: Trả lời cụt ngủn, chưa đầy đủ, thiếu cảnh báo cảm biến áp lực và nguy cơ tụt nướu do tì đè mạnh]
                      </span>
                    </div>
                  </div>

                  {/* Pair 2: Khó hiểu, sai kiến thức */}
                  <div className={[styles.utteranceItem, styles.utterancePatient].join(" ")}>
                    <span className={[styles.speakerTag, styles.speakerPatient].join(" ")}>
                      NGƯỜI HỎI [01:07]
                    </span>
                    <div className={styles.utteranceText}>
                      Nếu đang có khí cụ trong miệng thì vùng kẽ làm sạch ra sao?
                    </div>
                  </div>
                  <div className={[styles.utteranceItem, styles.utteranceDoctor].join(" ")}>
                    <span className={[styles.speakerTag, styles.speakerDoctor].join(" ")}>
                      BÁC SĨ (Bản thô) [01:14]
                    </span>
                    <div className={styles.utteranceText}>
                      Bạn dùng chỉ nha khoa thông thường chèn vào kẽ răng đẩy qua lại là sạch.
                      <span className={styles.textDiffRemoved}>
                        {" "}[Khiếm khuyết: Khó hiểu và sai kiến thức; người niềng răng dùng chỉ thường không có đầu luồn sẽ bị vướng mắc cài gây đứt chỉ hoặc bật khí cụ; không nhắc bàn chải kẽ]
                      </span>
                    </div>
                  </div>

                  {/* Pair 3: Sai kiến thức nghiêm trọng */}
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
                      Nước súc miệng chlorhexidine diệt khuẩn rất tốt, bạn mua súc hàng ngày liên tục cả tháng thay đánh răng cho tiện.
                      <span className={styles.textDiffRemoved}>
                        {" "}[Khiếm khuyết: Sai kiến thức y khoa nghiêm trọng; nước súc miệng không thay thế bàn chải; chlorhexidine dùng kéo dài gây ố vàng răng và rối loạn vị giác]
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Evaluation Status Grid */}
              <div className={styles.evalSummaryGrid}>
                <div className={styles.evalCard}>
                  <h4 className={styles.evalCardTitle}>Quy tắc thẩm định thực tế</h4>
                  <div className={styles.checklistSummary}>
                    <div className={styles.checklistItemOk}>Lượt thoại Người hỏi: Có thể bỏ qua nếu câu đã ổn và có nghĩa (chọn V)</div>
                    <div className={styles.checklistItemMissing}>Tập trung Câu trả lời 1: Cụt ngủn, thiếu hướng dẫn an toàn áp lực</div>
                    <div className={styles.checklistItemMissing}>Tập trung Câu trả lời 2: Khó hiểu, sai kiến thức vệ sinh khí cụ</div>
                    <div className={styles.checklistItemMissing}>Tập trung Câu trả lời 3: Sai an toàn y khoa, lạm dụng thuốc súc miệng</div>
                  </div>
                </div>

                <div className={styles.evalCard}>
                  <h4 className={styles.evalCardTitle}>Hướng xử lý trọng tâm</h4>
                  <div className={styles.notesContentBefore}>
                    Bác sĩ tập trung cao độ vào câu trả lời của Bác sĩ AI. Đối với lượt thoại của Người hỏi, có thể bỏ qua (chọn V) nếu câu hỏi đã ổn và rõ nghĩa. Đối với các câu trả lời sai hoặc thiếu an toàn, chọn X để chỉnh sửa chuẩn y khoa.
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* TAB 2: SAU KHI BÁC SĨ HIỆU CHỈNH */
            <>

              {/* Dialogue Box */}
              <div className={styles.dialogueSection}>
                <div className={styles.sectionHeading}>
                  <span>Lượt thoại sau khi Bác sĩ thẩm định xong:</span>
                  <span className={styles.metaHighlightGreen}>Chuẩn văn phong & chuyên môn Răng Hàm Mặt</span>
                </div>

                <div className={styles.dialogueBox}>
                  {/* Pair 1: Giữ nguyên câu hỏi rõ nghĩa & bổ sung câu trả lời */}
                  <div className={[styles.utteranceItem, styles.utterancePatient].join(" ")}>
                    <span className={[styles.speakerTag, styles.speakerPatient].join(" ")}>
                      NGƯỜI HỎI [00:53]
                    </span>
                    <div className={styles.utteranceText}>
                      Khi đổi sang bàn chải điện thì xài đầu nào với lực sao cho đỡ buốt?
                      <span style={{ color: "#166534", fontSize: "0.8rem", fontWeight: 600 }}> [Câu hỏi đã rõ nghĩa — Giữ nguyên, chọn V]</span>
                    </div>
                  </div>
                  <div className={[styles.utteranceItem, styles.utteranceDoctor].join(" ")}>
                    <span className={[styles.speakerTag, styles.speakerDoctor].join(" ")}>
                      BÁC SĨ (Đã bổ sung đầy đủ) [01:00]
                    </span>
                    <div className={styles.utteranceText}>
                      Đầu bàn chải nhỏ, lông mềm giúp tiếp cận từng vùng mà không cần tạo lực lớn. <span className={styles.textDiffAdded}>Nếu máy có cảm biến áp lực, nên giữ lực dưới ngưỡng cảnh báo và để chuyển động của đầu bàn chải thực hiện phần lớn công việc thay vì chà qua lại mạnh.</span> Nếu xuất hiện đau, tụt nướu hoặc ê buốt tăng sau khi đổi dụng cụ, nên dừng mức lực cao và nhờ nha sĩ kiểm tra kỹ thuật.
                    </div>
                  </div>

                  {/* Pair 2: Đã sửa câu khó hiểu và sai kiến thức */}
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
                      BÁC SĨ (Đã sửa kiến thức chuẩn) [01:14]
                    </span>
                    <div className={styles.utteranceText}>
                      <span className={styles.textDiffAdded}>Khí cụ chỉnh nha tạo thêm nhiều bề mặt giữ mảng bám, vì vậy bàn chải thông thường thường cần phối hợp với bàn chải kẽ hoặc chỉ có đầu luồn. Với mắc cài, nên làm sạch cả phía trên và dưới cánh mắc cài; với khay trong suốt, cần vệ sinh răng trước khi đeo lại khay để hạn chế giữ đường và axit sát răng.</span> Nếu dây cung tuột, mắc cài bong, đau niêm mạc kéo dài hoặc khớp cắn thay đổi bất thường thì nên liên hệ bác sĩ chỉnh nha.
                    </div>
                  </div>

                  {/* Pair 3: Đã chấn chỉnh sai sót an toàn sinh học */}
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
                      BÁC SĨ (Đã chuẩn hóa an toàn) [01:28]
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
                  <h4 className={styles.evalCardTitle}>Kết quả sau thẩm định</h4>
                  <div className={styles.verdictBadgeAfter}>KẾT LUẬN: ĐÃ CHUẨN HÓA CÂU TRẢ LỜI CỦA BÁC SĨ</div>
                  <div className={styles.checklistSummary}>
                    <div className={styles.checklistItemOk}>Người hỏi: Đã ổn và rõ nghĩa, giữ nguyên để tập trung cho câu trả lời</div>
                    <div className={styles.checklistItemOk}>Câu trả lời 1: Bổ sung cảm biến áp lực và kỹ thuật tránh ê buốt</div>
                    <div className={styles.checklistItemOk}>Câu trả lời 2: Sửa chuẩn kiến thức bàn chải kẽ cho người mang khí cụ</div>
                    <div className={styles.checklistItemOk}>Câu trả lời 3: Chấn chỉnh an toàn y khoa, giới hạn chỉ định chlorhexidine</div>
                  </div>
                </div>

                <div className={styles.evalCard}>
                  <h4 className={styles.evalCardTitle}>Ghi chú nhận xét của Bác sĩ</h4>
                  <div className={styles.notesContentAfter}>
                    "Lượt thoại của người hỏi đã rõ nghĩa nên được giữ nguyên (chọn V). Tập trung hoàn thiện toàn diện các câu trả lời của bác sĩ AI: làm rõ kỹ thuật chải răng, chuẩn hóa chỉ dẫn vệ sinh khí cụ và chấn chỉnh an toàn dùng dung dịch chlorhexidine."
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className={styles.modalFooter} style={{ justifyContent: "flex-end" }}>
          <button
            type="button"
            className={styles.dismissBtn}
            onClick={onClose}
          >
            {dismissText}
          </button>
        </div>
      </div>
    </div>
  );
}
