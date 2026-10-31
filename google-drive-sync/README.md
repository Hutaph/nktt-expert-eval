# Hướng dẫn kết nối Google Drive cho Ứng dụng Thẩm định Nha khoa Thường thức

Tài liệu này hướng dẫn cách tạo và kích hoạt điểm cuối webhook Google Apps Script để lưu trữ trực tiếp các tập tin đánh giá JSON và JSONL từ giao diện web lên Google Drive.

## Các bước thiết lập (khoảng 2 phút)

### Bước 1: Mở Google Apps Script
1. Truy cập vào trang web: https://script.google.com
2. Đăng nhập bằng tài khoản Google Drive mà bạn muốn chứa dữ liệu đánh giá của các chuyên gia.
3. Nhấn vào nút "Dự án mới" (New project) ở góc trên bên trái.

### Bước 2: Dán mã kịch bản
1. Xóa toàn bộ nội dung mẫu mặc định trong tập tin `Code.gs`.
2. Mở tập tin [Code.gs](Code.gs) trong thư mục này, sao chép toàn bộ nội dung và dán vào trình soạn thảo trên Google Apps Script.
3. Nhấn tổ hợp phím `Ctrl + S` để lưu dự án. Bạn có thể đổi tên dự án thành `NKTT Drive Sync Service`.

### Bước 3: Triển khai dưới dạng Ứng dụng Web (Web App)
1. Ở góc trên bên phải, nhấn nút "Triển khai" (Deploy) -> chọn "Tùy chọn triển khai mới" (New deployment).
2. Nhấn vào biểu tượng bánh răng cạnh dòng "Chọn loại" (Select type) và chọn "Ứng dụng web" (Web app).
3. Điền các trường thông tin:
   - Mô tả (Description): `Dịch vụ lưu kết quả đánh giá NKTT`
   - Thực thi dưới dạng (Execute as): Chọn `Tôi` (Me - địa chỉ email của bạn)
   - Ai có quyền truy cập (Who has access): Chọn `Bất kỳ ai` (Anyone)
4. Nhấn nút "Triển khai" (Deploy).
5. Trình duyệt sẽ xuất hiện hộp thoại yêu cầu cấp quyền:
   - Nhấn "Ủy quyền truy cập" (Authorize access).
   - Chọn tài khoản Google của bạn.
   - Nếu thấy cảnh báo "Google chưa xác minh ứng dụng này" (Google hasn't verified this app), hãy nhấn vào "Nâng cao" (Advanced) ở dưới, sau đó chọn "Đi tới [Tên dự án] (không an toàn)".
   - Nhấn "Cho phép" (Allow) để hoàn tất.

### Bước 4: Lấy URL và dán vào Ứng dụng Web
1. Sau khi triển khai xong, Google sẽ cung cấp cho bạn một đường dẫn tại mục "Ứng dụng web" (Web app URL), dạng:
   `https://script.google.com/macros/s/AKfycb.../exec`
2. Sao chép đường dẫn này.
3. Mở ứng dụng web đánh giá lâm sàng, nhấn nút "Cài đặt Drive" trên thanh công cụ phía trên.
4. Dán URL vừa sao chép vào ô "URL Web App Google Apps Script" và nhấn "Kiểm tra kết nối".
5. Khi hệ thống báo kết nối thành công, nhấn "Lưu cấu hình".

## Cơ chế lưu trữ trên Google Drive
- Tập tin sẽ tự động được lưu vào thư mục có tên mặc định là: `NKTT_Expert_Evaluations` trên Google Drive của bạn (nếu chưa có thư mục này, script sẽ tự động tạo mới).
- Định dạng tập tin được lưu:
  - `clinical_eval_[ma_chuyen_gia].json`: Dữ liệu đánh giá chi tiết theo định dạng JSON.
  - `clinical_eval_[ma_chuyen_gia].jsonl`: Dữ liệu đánh giá theo từng dòng JSONL để phục vụ tính toán các chỉ số Kappa/ICC/F-score.
  - `expert_annotations.jsonl`: Dữ liệu nhãn lịch sử và yếu tố bệnh nhân từ trang gán nhãn.
- Mỗi lần chuyên gia bấm "Lưu lên Google Drive" hoặc khi hệ thống tự động đồng bộ, nội dung mới nhất sẽ được cập nhật trực tiếp vào tập tin tương ứng.
