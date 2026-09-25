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
              Bảng Mẫu Đối Chiếu: Trước & Sau Khi Hiệu Chỉnh
            </h2>
            <p className={styles.modalSubtitle}>
              Minh họa nguyên tắc: Trau chuốt câu hỏi tự nhiên (không đổi ngữ nghĩa) và hoàn thiện câu trả lời của Bác sĩ (sửa sai, bổ sung đầy đủ, dễ hiểu)
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
            <span>Tab 1: Trước khi chỉnh sửa</span>
            <span className={styles.tabBadgeBefore}>Bản thô từ mô hình</span>
          </button>

          <button
            type="button"
            className={[
              styles.tabBtn,
              activeTab === "AFTER" ? styles.tabBtnActiveAfter : "",
            ].filter(Boolean).join(" ")}
            onClick={() => setActiveTab("AFTER")}
          >
            <span>Tab 2: Sau khi Bác sĩ hiệu chỉnh</span>
            <span className={styles.tabBadgeAfter}>Bản chuẩn mực y khoa</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className={styles.modalBody}>
          {activeTab === "BEFORE" ? (
            /* TAB 1: TRƯỚC KHI CHỈNH SỬA */
            <>
              <div className={styles.infoBannerBefore}>
                <strong>Các khiếm khuyết thường gặp ở bản thô:</strong>
                <br />• <strong>Câu hỏi Người hỏi:</strong> Diễn đạt cộc lốc, luộm thuộm hoặc thiếu tự nhiên.
                <br />• <strong>Câu trả lời Bác sĩ:</strong> Câu cụt ngủn thiếu chỉ dẫn, câu từ dịch máy khó hiểu, hoặc tư vấn sai kiến thức y khoa chuyên sâu.
              </div>

              {/* Meta Case Card */}
              <div className={styles.caseMetaCard}>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Tình huống lâm sàng:</span>
                  <span className={styles.metaValue}>Chăm sóc vệ sinh răng miệng khi đang có khí cụ niềng răng trong miệng</span>
                </div>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Chủ đề Người hỏi (Bản thô):</span>
                  <span className={styles.metaValue}>
                    <span className={styles.metaHighlightRed}>
                      "cho em hỏi cách xài bàn chải điện với nước súc miệng khi niềng"
                    </span>
                    {" "}(Câu văn cộc lốc, diễn đạt thiếu tự nhiên)
                  </span>
                </div>
              </div>

              {/* Dialogue Box */}
              <div className={styles.dialogueSection}>
                <div className={styles.sectionHeading}>
                  <span>Diễn tiến câu thoại bản thô (Cần Bác sĩ biên tập lại):</span>
                  <span className={styles.metaHighlightRed}>Chưa đạt chuẩn văn phong & chuyên môn</span>
                </div>

                <div className={styles.dialogueBox}>
                  {/* Pair 1: Cụt ngủn, thiếu đầy đủ */}
                  <div className={[styles.utteranceItem, styles.utterancePatient].join(" ")}>
                    <span className={[styles.speakerTag, styles.speakerPatient].join(" ")}>
                      NGƯỜI HỎI [00:53]
                    </span>
                    <div className={styles.utteranceText}>
                      Khi đổi sang bàn chải điện thì xài đầu nào với lực sao cho đỡ buốt?
                      <span className={styles.textDiffRemoved}> [Văn phong nói cộc lốc, thiếu tự nhiên]</span>
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
                  <h4 className={styles.evalCardTitle}>Nhận diện lỗi cần chỉnh sửa</h4>
                  <div className={styles.checklistSummary}>
                    <div className={styles.checklistItemMissing}>Câu hỏi: Thiếu tự nhiên, câu từ cộc lốc</div>
                    <div className={styles.checklistItemMissing}>Câu trả lời 1: Cụt ngủn, thiếu hướng dẫn an toàn</div>
                    <div className={styles.checklistItemMissing}>Câu trả lời 2: Khó hiểu, sai kiến thức vệ sinh khí cụ</div>
                    <div className={styles.checklistItemMissing}>Câu trả lời 3: Sai kiến thức an toàn sinh học</div>
                  </div>
                </div>

                <div className={styles.evalCard}>
                  <h4 className={styles.evalCardTitle}>Hướng xử lý của Bác sĩ</h4>
                  <div className={styles.notesContentBefore}>
                    Bác sĩ nhấp trực tiếp vào biểu tượng cây bút để sửa lại câu hỏi của người hỏi và từng câu trả lời của bác sĩ cho chuẩn xác.
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* TAB 2: SAU KHI BÁC SĨ HIỆU CHỈNH */
            <>
              <div className={styles.infoBannerAfter}>
                <strong>Quy chuẩn sau khi Bác sĩ hiệu chỉnh:</strong>
                <br />• <strong>Câu hỏi:</strong> Trau chuốt lại tự nhiên, trôi chảy nhưng <strong>bảo toàn 100% ngữ nghĩa gốc</strong>.
                <br />• <strong>Câu trả lời:</strong> Viết lại mạch lạc, dễ hiểu; sửa triệt để kiến thức sai; bổ sung đầy đủ chỉ dẫn chuyên môn.
              </div>

              {/* Meta Case Card */}
              <div className={styles.caseMetaCard}>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Tình huống lâm sàng:</span>
                  <span className={styles.metaValue}>Chăm sóc vệ sinh răng miệng khi đang có khí cụ niềng răng trong miệng</span>
                </div>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Chủ đề Người hỏi (Đã chỉnh):</span>
                  <span className={styles.metaValue}>
                    <span className={styles.metaHighlightGreen}>
                      "Khi đổi sang bàn chải điện và đang có khí cụ trong miệng thì nên vệ sinh và dùng nước súc miệng như thế nào?"
                    </span>
                    {" "}(Đã chỉnh câu từ tự nhiên, mạch lạc, giữ nguyên vẹn ý hỏi)
                  </span>
                </div>
              </div>

              {/* Dialogue Box */}
              <div className={styles.dialogueSection}>
                <div className={styles.sectionHeading}>
                  <span>Diễn tiến câu thoại sau khi Bác sĩ đã hiệu chỉnh:</span>
                  <span className={styles.metaHighlightGreen}>Chuẩn văn phong & chuyên môn Răng Hàm Mặt</span>
                </div>

                <div className={styles.dialogueBox}>
                  {/* Pair 1: Đã sửa câu cộc lốc & câu cụt ngủn */}
                  <div className={[styles.utteranceItem, styles.utterancePatient].join(" ")}>
                    <span className={[styles.speakerTag, styles.speakerPatient].join(" ")}>
                      NGƯỜI HỎI (Đã chỉnh tự nhiên) [00:53]
                    </span>
                    <div className={styles.utteranceText}>
                      Khi đổi sang bàn chải điện thì nên chọn đầu bàn chải và mức lực như thế nào?
                      <span className={styles.textDiffAdded}> [Văn phong tự nhiên, giữ trọn vẹn ngữ nghĩa ban đầu]</span>
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
                  <h4 className={styles.evalCardTitle}>Kết quả sau biên tập</h4>
                  <div className={styles.verdictBadgeAfter}>KẾT LUẬN: HIỆU CHỈNH CÂU TỪ (EDITED)</div>
                  <div className={styles.checklistSummary}>
                    <div className={styles.checklistItemOk}>Câu hỏi: Đã chỉnh trôi chảy, không đổi ngữ nghĩa gốc</div>
                    <div className={styles.checklistItemOk}>Khắc phục câu cụt ngủn: Đã bổ sung đầy đủ chỉ dẫn an toàn</div>
                    <div className={styles.checklistItemOk}>Khắc phục khó hiểu / sai: Đã sửa chuẩn kiến thức bàn chải kẽ</div>
                    <div className={styles.checklistItemOk}>An toàn y khoa: Đã giới hạn thời gian dùng chlorhexidine</div>
                  </div>
                </div>

                <div className={styles.evalCard}>
                  <h4 className={styles.evalCardTitle}>Ghi chú nhận xét của Bác sĩ</h4>
                  <div className={styles.notesContentAfter}>
                    "Đã chỉnh lại câu hỏi của người hỏi cho tự nhiên hơn (giữ nguyên ngữ nghĩa gốc). Hiệu chỉnh các câu trả lời của bác sĩ: sửa câu cụt ngủn, làm rõ kỹ thuật dùng bàn chải kẽ cho người mang khí cụ và chấn chỉnh chỉ định an toàn của chlorhexidine."
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
              ? "Chuyển sang xem Sau khi Bác sĩ hiệu chỉnh"
              : "Quay lại xem Trước khi chỉnh sửa"}
          </button>
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
