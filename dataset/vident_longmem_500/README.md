# ViDent-LongMem-500 — bản xem thử

Bản dữ liệu mới nhất từ `v5_9_52_round62_question_naturalization_candidate`, dành cho việc thử giao diện và rà soát chuyên gia.

- 100 hồ sơ: giữ hồ sơ 26–125, bỏ 25 hồ sơ đầu.
- 300 câu hỏi: đúng 3 câu cho mỗi hồ sơ.
- Mỗi hồ sơ giữ một câu đối chứng và hai câu cần cá nhân hóa.
- Nội dung chưa được chuyên gia duyệt độc lập.
- Giao diện hiển thị 3 lần hỏi cho mỗi hồ sơ, mỗi lần có ít nhất 2 cặp hỏi–đáp. Đã bổ sung 66 cặp tiếp nối ở lần hỏi 3, sửa diễn đạt và hướng dẫn chưa phù hợp trong lịch sử.
- Tất cả 1.261 dẫn chứng khớp lời thoại; hai câu nguồn diễn đạt lại ngày 24/10 có trích dẫn và vị trí được cập nhật. Ba câu đánh giá được viết lại cho dễ hiểu, giữ nguyên mục đích và đáp án tham chiếu. Nhật ký sửa nằm trong `docs/reviews/2026-10-21-full-data-fixes.json`.

Các tệp: `timelines.jsonl`, `benchmark_cases.jsonl`, `source_events.jsonl`, `evidence_catalog.json`, `metadata.json`.

Lượt kiểm tra cuối ngày 21/10/2026 sửa thêm 7 lượt thoại và 5 giá trị tham chiếu theo đúng câu nguồn, đồng thời cập nhật phiên bản tải trên web. Xem `docs/reviews/2026-10-21-final-check.md` và nhật ký đi kèm.

Ngày 24/10/2026: rà lại 705 câu hỏi trong 300 phiên hiển thị, sửa 65 lượt thoại để bớt lặp ý và hỏi vòng vo; làm rõ 2 câu nguồn, trong đó bỏ chi tiết “răng đầu tiên” không khớp mạch kể về trẻ. Các đáp án tham chiếu giữ nguyên. Xem `docs/reviews/2026-10-24-dialogue-review.md`.
