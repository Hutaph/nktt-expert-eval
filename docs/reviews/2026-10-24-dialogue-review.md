# Rà lại câu hỏi và mạch hội thoại trước khi bác sĩ duyệt

Ngày 24/10/2026. Bản đối chiếu trước sửa: `2a2219b`.

## Đã xem và sửa gì

Đọc các câu hỏi theo thứ tự trong 300 phiên đang hiển thị của 100 hồ sơ, tổng cộng 705 câu hỏi. Chọn những chỗ có dấu hiệu lặp ý, hỏi vòng vo, chuyển ý thiếu liên kết hoặc dùng một giả định không cần thiết; đọc đầy đủ các cặp liên quan trước khi viết lại. Kiểm tra tự động vẫn bao phủ toàn bộ 1.449 phiên và 4.266 lượt trong tệp.

Sửa 65 lượt: 32 câu hỏi và 33 câu trả lời. Không thêm hoặc xóa cặp. Ba lần hỏi hiển thị mỗi người vẫn có 2–3 cặp mỗi lần.

| Vấn đề | Ví dụ đã sửa |
| --- | --- |
| Hỏi lại đúng điều vừa được trả lời | U0057: chọn cỡ bàn chải kẽ; U0094: kẹo cao su thay chải và làm sạch kẽ; U0096: dùng bàn chải tay khi máy hết pin |
| Chỉ hỏi có nên hỏi người khác | U0039: thông tin để cân nhắc bổ sung fluoride; U0063: vai trò của vecni; U0070: đánh giá trước phục hồi răng |
| Hỏi không tự nhiên hoặc thiếu tình huống | U0062: cấu trúc câu về sản phẩm vệ sinh cũ; U0078: đợi lâu sau vệ sinh khay; U0086: cố hít khí lạnh để thử kem |
| Cặp sau cần một bước mới có ích | U0061: bảo quản bộ vệ sinh ở công ty; U0103: thông tin cần báo về chỉ khâu; U0124: hỗ trợ trẻ chải răng hàm |
| Bỏ quên việc cần xử lý trước | U0083 và U0095: câu hỏi thường quy được đặt rõ sau việc đánh giá cấp cứu/triệu chứng tái phát |

Các câu hỏi về hiểu lầm thường gặp có ý nghĩa thực tế vẫn được giữ. Không coi mọi câu hỏi cơ bản của người bệnh là lỗi. Không sửa hàng loạt dựa trên việc câu có từ “có nên” hay “nha sĩ”.

## Hai câu nguồn được làm rõ

- **U0055_S02_T05:** viết rõ người dùng lo trẻ nuốt vecni khi bôi, thay cụm “sản phẩm có nuốt không”. Cập nhật cùng lúc lời thoại, câu trích trong sự kiện và vị trí ký tự.
- **U0057_S02_T05:** hồ sơ đã kể việc hỗ trợ trẻ chải răng, sau đó lại ghi mới mọc “răng đầu tiên” ngay trong cùng phiên. Bỏ chi tiết “đầu tiên”, giữ thông tin trẻ đang mọc răng và chưa đi nha sĩ. Không tự thêm tuổi, loại răng hoặc giả định có hai trẻ. Tuổi và khả năng nhổ kem trong đáp án của hồ sơ vẫn là chưa có đủ thông tin.

Ngoài hai trường hợp này, 1.259 sự kiện nguồn khác giữ nguyên. Tệp `benchmark_cases.jsonl` và `evidence_catalog.json` giữ nguyên từng byte; không đổi đáp án, mốc lịch sử, mã lượt hoặc thời gian. Cập nhật phiên bản tải dữ liệu để tránh lấy bản lưu cũ trên trình duyệt.

Nhật ký:

- `2026-10-24-dialogue-changes.json`: 65 lượt trước/sau cùng lý do sửa.
- `2026-10-24-source-clarifications.json`: hai đoạn nguồn trước/sau.

## Đối chiếu chuyên môn

- [ADA: bàn chải, cách chải và bảo quản](https://www.ada.org/resources/ada-library/oral-health-topics/toothbrushes).
- [ADA: lựa chọn dụng cụ và thao tác làm sạch kẽ](https://www.ada.org/resources/ada-library/oral-health-topics/floss).
- [NHS: lượng kem theo tuổi và nhổ kem sau chải](https://www.nhs.uk/live-well/healthy-teeth-and-gums/how-to-keep-your-teeth-clean/).
- [BOS: khay chỉnh nha trong suốt, thời gian tháo và đeo](https://bos.org.uk/wp-content/uploads/2024/01/Aligners-version-2024.pdf).
- [ADA: tác động axit và thời điểm chải](https://www.mouthhealthy.org/all-topics-a-z/dietary-acids-and-your-teeth).
- [ADA: kẹo cao su không đường và khó chịu ở hàm](https://www.mouthhealthy.org/all-topics-a-z/chewing-gum).
- [NHS: chăm sóc khô miệng](https://www.nhs.uk/symptoms/dry-mouth/).
- [NHS: tổn thương trắng và thuốc lá](https://www.nhs.uk/conditions/leukoplakia/).

Các lời đáp là nội dung biên tập cho tình huống, không phải bản dịch nguyên văn của các nguồn. Thời gian và cách dùng sản phẩm kê riêng vẫn cần theo người điều trị và nhãn sản phẩm cụ thể.

## Kiểm tra trước khi giao bác sĩ

- `python scripts/validate_preview_dataset.py`: kiểm tra hai bản tệp, số hồ sơ/cặp, vai và mã lượt, thời gian, trích dẫn, đáp án và checksum.
- Build với cấu hình GitHub Pages.
- `node tests/preview-data-render.mjs`: đối chiếu 100 hồ sơ, 300 phiên, 1.410 lượt đang hiển thị, số cặp và nút accept/reject. Không gửi kết quả duyệt lên dịch vụ bên ngoài.
- Sau triển khai, đối chiếu các tệp trực tiếp trên web và chạy lại phép kiểm tra hiển thị với `PREVIEW_TEST_ORIGIN=https://hutaph.github.io`.

Kết quả trước triển khai: kiểm tra dữ liệu, build và kiểm tra trình duyệt đều đạt. Trình duyệt đối chiếu đủ 100 hồ sơ, 300 phiên và 1.410 lượt, không có lỗi JavaScript và không gửi kết quả duyệt.

Đây là lượt biên tập và kiểm tra do AI thực hiện. Không ghi nhận là bác sĩ đã duyệt và không cam kết không thể còn sai sót. Lượt duyệt độc lập của bác sĩ vẫn cần thiết để xác nhận nội dung lâm sàng.
