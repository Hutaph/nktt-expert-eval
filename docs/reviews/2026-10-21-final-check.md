# Kiểm tra cuối trước lượt duyệt chuyên gia

Ngày: 21/10/2026. Bản đối chiếu trước sửa: `19cdf41`.

## Phạm vi và kết quả

| Phần kiểm tra | Phạm vi | Kết quả |
| --- | --- | --- |
| Hồ sơ và câu đánh giá | 100 hồ sơ U0026–U0125, 300 câu | Đúng 3 câu/hồ sơ; một câu đối chứng, hai câu cần cá nhân hóa |
| Lịch sử đầy đủ | 1.449 phiên, 4.266 lượt, 2.133 cặp | Vai hỏi–đáp, mã, thời gian, số lượng, bản sao và checksum khớp |
| Ba lần hỏi hiển thị | 300 phiên, 1.410 lượt | Mỗi phiên có 2–3 cặp, nội dung trình duyệt khớp tệp |
| Dẫn chứng | 1.261 sự kiện | Trích dẫn và vị trí ký tự khớp; không đổi sự kiện nguồn |
| Trạng thái tham chiếu | 282 mục: 209 đã biết, 64 chưa có thông tin, 9 chưa chắc chắn | Trạng thái và giá trị thống nhất giữa các trường; nguồn đúng hồ sơ và không vượt mốc lịch sử |
| Nhóm và đoạn tài liệu | Hai bước chọn bằng chứng của cả 300 câu | Không có mã nhóm lạ hoặc đoạn ngoài nhóm đã chọn |
| Câu trùng và ký tự lỗi | Toàn bộ lời thoại và các tệp JSON/JSONL | Không trùng nguyên văn lời hỏi/lời đáp; không có ký tự thay thế UTF-8 hoặc ký tự null |

Đã quét toàn bộ tệp và đọc các trường hợp có dấu hiệu cần xem xét, gồm nội dung về mủ, sốt, sưng mặt, khó nuốt, thuốc, dị ứng, điều trị ung thư, sau thủ thuật và tổn thương kéo dài. Đã so lại 35 giá trị tham chiếu được diễn đạt khác nguyên văn nguồn; diễn đạt khác không tự động được coi là lỗi.

## Sửa thêm trong lượt này

- Sửa 7 lượt thoại: bỏ giả định đã xạ trị, nêu tên ba dụng cụ khi câu hỏi thiếu đối tượng, trả lời đủ ba loại, sửa câu sai ngữ pháp, làm rõ việc khám vết loét đã quá ba tuần và trả lời đúng người đang hỏi về việc nuốt kem.
- Sửa 5 giá trị tham chiếu: bỏ vị trí khí cụ chưa được câu nguồn xác nhận, sửa cách diễn đạt phóng đại số ngày có thói quen và khôi phục liên từ/dấu câu. Cập nhật đồng thời `state_snapshots.value` và `factors.expected_value`. Mã, trạng thái, sự kiện và lịch sử tham chiếu giữ nguyên.
- Đổi mã phiên bản tải dữ liệu trên web sang đúng `metadata.version`. Mã cũ không đổi qua nhiều lần thay dữ liệu, nên trình duyệt có thể dùng bản lưu cũ. Đây là một thay đổi hằng số; không đổi cách duyệt, phân công hoặc lưu đánh giá.
- Bổ sung kiểm tra việc khớp phiên bản, hai cách lưu giá trị tham chiếu, thứ tự thời gian giữa các phiên, mối quan hệ giữa sự kiện và trạng thái, vai nguồn và thời gian nguồn.

Nhật ký từng thay đổi: `2026-10-21-final-check-changes.json`.

## Các lệnh kiểm tra

- `python scripts/validate_preview_dataset.py`: đạt trên toàn bộ dữ liệu.
- `GITHUB_ACTIONS=true npm run build` (đặt biến môi trường tương ứng trong PowerShell): build và xuất trang thành công.
- `node tests/preview-data-render.mjs`: chạy qua 100 hồ sơ, 300 phiên và đối chiếu nguyên văn 1.410 lượt hiển thị; đủ nút accept/reject cho mỗi lượt, không có lỗi JavaScript.
- Kiểm tra trình duyệt dùng ngữ cảnh tạm, không đăng nhập bác sĩ, không lưu kết quả duyệt. Các yêu cầu ra dịch vụ bên ngoài được chặn và thay bằng dữ liệu thử; không có yêu cầu ghi nào được gửi ra ngoài. Đây là kiểm tra hiển thị dữ liệu, không phải kiểm tra đồng bộ Google Drive.
- Có thể chạy cùng phép kiểm tra trên bản đã deploy bằng cách đặt `PREVIEW_TEST_ORIGIN=https://hutaph.github.io` rồi chạy lại lệnh Node; các dịch vụ ngoài trang vẫn được chặn.

## Nguồn đối chiếu

- [ADA: khô miệng và những thông tin cần đánh giá](https://www.mouthhealthy.org/all-topics-a-z/dry-mouth).
- [ADA: các dụng cụ làm sạch kẽ và cách lựa chọn](https://www.ada.org/resources/ada-library/oral-health-topics/floss).
- [NHS: vết loét kéo dài và các dấu hiệu cần khám](https://www.nhs.uk/conditions/mouth-ulcers/).
- [NHS: dấu hiệu nhiễm trùng nha khoa và cấp cứu](https://www.nhs.uk/conditions/dental-abscess/).
- Các nguồn bổ sung và lịch sử sửa trước nằm trong hai báo cáo cùng ngày.

## Kết luận trong phạm vi kiểm tra

Các phép kiểm tra tự động và hiển thị nêu trên đạt sau sửa. Lượt này không thay thế việc chuyên gia đọc độc lập toàn bộ nội dung lâm sàng và không chứng minh dữ liệu tuyệt đối không còn sai. Trạng thái chuyên gia trong metadata vẫn là chưa duyệt độc lập; không ghi nhận các thao tác thử trình duyệt thành kết quả duyệt của chuyên gia.
