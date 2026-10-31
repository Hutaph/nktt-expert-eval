# Rà soát và sửa dữ liệu ngày 21/10/2026

Nhánh: `codex/expert-eval-v5-9-52-3-cases`.

## Kết quả sửa

- Sửa 90 lượt thoại cũ: câu trả lời lệch câu hỏi, lặp từ, câu sai ngữ pháp, từ khó hiểu, giả định chưa được người dùng cung cấp và hướng dẫn thiếu bối cảnh.
- Thêm 66 cặp hỏi–đáp tiếp nối cho các lần hỏi 3 chỉ có một cặp. Mỗi câu mới hỏi tiếp về tình huống trong phiên; không khẳng định thêm một bệnh sử cá nhân mới.
- Viết lại 3 câu đánh giá cho dễ hiểu: U0063_Q3, U0066_Q3 và U0101_Q3. Giữ nguyên mục đích câu hỏi, các trường còn lại và đáp án tham chiếu.
- Các đoạn về mủ, sốt, sưng mặt được làm rõ thời điểm cần khám nha khoa khẩn; phân biệt với khó thở, khó nuốt hoặc sưng quanh mắt cần cấp cứu.
- Các câu trả lời tiếp theo trong phiên có phẫu thuật, thai kỳ hoặc triệu chứng cần khám khẩn đã được sửa ở những trường hợp phát hiện bỏ quên bối cảnh trước đó.
- Sửa hướng dẫn cầu răng cố định, khay chỉnh nha tháo lắp, ngừng sản phẩm gây kích ứng và cách hiểu nước có ga nguyên chất.

Nhật ký từng thay đổi và toàn bộ 66 cặp mới: `2026-10-21-full-data-fixes.json`. Một lượt có thể xuất hiện nhiều lần trong nhật ký khi được sửa tiếp; 90 là số lượt cũ khác nhau so với commit trước lượt sửa này.

## Số liệu sau sửa

| Nội dung | Số lượng |
| --- | ---: |
| Hồ sơ, từ U0026 đến U0125 | 100 |
| Câu đánh giá | 300, đúng 3/hồ sơ |
| Lần hỏi hiển thị | 300, đúng 3/hồ sơ |
| Lần hỏi hiển thị có 2 cặp | 195 |
| Lần hỏi hiển thị có 3 cặp | 105 |
| Toàn bộ phiên lịch sử được giữ | 1.449 |
| Toàn bộ lượt thoại | 4.266 |
| Cặp hỏi–đáp | 2.133 |
| Dẫn chứng nguồn | 1.261 |

Các phiên lịch sử ngoài ba lần hiển thị vẫn được giữ để không thay cơ chế đánh giá. Không đổi mã hoặc thời gian của lượt cũ, không xóa lượt cũ. Các khoảng trống trong mã phiên và mã lượt là từ dữ liệu đã tinh gọn trước đó, không đánh số lại.

## Cách kiểm tra

- Quét toàn bộ lời thoại để tìm câu trùng nguyên văn, câu mở đầu sai, từ lặp và các mẫu diễn đạt đáng ngờ; đọc các trường hợp liên quan để quyết định sửa, không thay hàng loạt theo từ khóa y khoa.
- Rà các đoạn có mủ, sưng mặt, sốt, khó nuốt, thuốc và chăm sóc sau thủ thuật; đối chiếu hướng dẫn công khai ở các nguồn dưới đây. Các trường hợp nghi ngờ không được tự đổi thành một chẩn đoán xác định.
- Đọc phần bổ sung cùng cặp trước trong phiên để tránh hỏi lại điều vừa trả lời, đổi chủ đề đột ngột hoặc đưa thêm tiền sử chưa có.
- Chạy `python scripts/validate_preview_dataset.py`: đạt. Kiểm tra 100 hồ sơ đúng phạm vi, ba câu đánh giá mỗi người, ít nhất hai cặp ở mỗi lần hiển thị, mã lượt, thứ tự vai, thời gian, số liệu, hai bản dữ liệu, trích dẫn và checksum.
- Kiểm tra toàn bộ nhóm/chunk dẫn chứng của 300 câu; không có mã không tồn tại hoặc chunk nằm ngoài nhóm đã chọn. Các sự kiện liên quan/cũ đều nằm trong lịch sử được phép xem.
- So sánh với Git HEAD trước sửa: đúng 90 lượt cũ đổi nội dung, thêm 132 lượt; không đổi trường khác của lượt cũ. `source_events.jsonl` và `evidence_catalog.json` giữ nguyên từng byte. Chỉ `current_query` của ba câu đánh giá thay đổi.
- Không có câu hỏi hoặc câu trả lời trùng nguyên văn trong 2.133 cặp hiện tại.
- `npm run build` với cấu hình GitHub Pages: đạt, xuất thành công trang `/label-data`.

## Nguồn đối chiếu chính

- [NHS: áp xe răng và dấu hiệu cần khám khẩn/cấp cứu](https://www.nhs.uk/conditions/dental-abscess/).
- [NHS: loét miệng, tổn thương kéo dài hoặc thay đổi cần kiểm tra](https://www.nhs.uk/conditions/mouth-ulcers/).
- [NHS: tác dụng không mong muốn của chlorhexidine](https://www.nhs.uk/medicines/chlorhexidine/side-effects-of-chlorhexidine/).
- [NHS: mảng trắng trong miệng](https://www.nhs.uk/conditions/leukoplakia/).
- [NHS: các dấu hiệu ở miệng cần được kiểm tra](https://www.nhs.uk/conditions/mouth-cancer/symptoms/).
- [ADA: nước có ga nguyên chất và nước có thêm đường/axit](https://www.mouthhealthy.org/nutrition/the-truth-about-sparkling-water-and-your-teeth).
- [ADA: axit trong thực phẩm và thời điểm chải](https://www.mouthhealthy.org/all-topics-a-z/dietary-acids-and-your-teeth).
- [UCLH: cầu răng cố định](https://www.uclh.nhs.uk/our-services/find-service/dental-services/hypodontia-clinic).
- Các hướng dẫn về lượng kem theo tuổi, thai kỳ, khay duy trì và chăm sóc sau thủ thuật đã ghi trong `2026-10-21-s01-followup-validation.md`.

## Giới hạn của lượt rà

Đây là lượt sửa do AI thực hiện và kiểm tra tính nhất quán dữ liệu, chưa phải xác nhận của chuyên gia nha khoa. Quét toàn bộ tệp không đồng nghĩa mọi lời thoại đã được một chuyên gia đọc độc lập. Tính tự nhiên và độ đúng lâm sàng vẫn cần lượt duyệt cuối; không thể dùng việc build hoặc kiểm tra cấu trúc thành công để cam kết không còn sai sót.
