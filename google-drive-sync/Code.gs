/**
 * Google Apps Script - Webhook Đồng bộ Dữ liệu Đánh giá Nha khoa Thường thức
 * 
 * Hướng dẫn triển khai:
 * 1. Mở trang https://script.google.com và nhấn nút "Dự án mới" (New project).
 * 2. Dán toàn bộ nội dung tập tin này vào trình soạn thảo Code.gs (thay thế mã mặc định).
 * 3. Đặt tên dự án (ví dụ: "NKTT Drive Sync Webhook").
 * 4. Nhấn nút "Triển khai" (Deploy) -> "Tùy chọn triển khai mới" (New deployment).
 * 5. Chọn loại triển khai: "Ứng dụng web" (Web app).
 *    - Mô tả: "NKTT Sync Service"
 *    - Thực thi dưới dạng (Execute as): "Tôi" (Me)
 *    - Ai có quyền truy cập (Who has access): "Bất kỳ ai" (Anyone)
 * 6. Nhấn "Triển khai" (Deploy) và cấp quyền truy cập Google Drive khi Google yêu cầu.
 * 7. Sao chép URL ứng dụng web (dạng https://script.google.com/macros/s/.../exec) và dán vào ứng dụng web.
 */

var DEFAULT_FOLDER_NAME = "NKTT_Expert_Evaluations";

function doGet(e) {
  return createJsonResponse({
    status: "online",
    message: "Dịch vụ đồng bộ Google Drive của ứng dụng NKTT Expert Eval đang hoạt động bình thường.",
    timestamp: new Date().toISOString()
  });
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse({
        status: "error",
        message: "Không tìm thấy dữ liệu nội dung trong yêu cầu gửi lên."
      });
    }

    var payload;
    try {
      payload = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return createJsonResponse({
        status: "error",
        message: "Dữ liệu gửi lên không đúng định dạng JSON: " + parseErr.toString()
      });
    }

    var action = payload.action || "save_file";

    if (action === "ping") {
      return createJsonResponse({
        status: "success",
        message: "Kết nối tới dịch vụ Google Drive thành công.",
        timestamp: new Date().toISOString()
      });
    }

    if (action === "save_file" || action === "save_bundle") {
      var folderName = payload.folderName || DEFAULT_FOLDER_NAME;
      var targetFolder = getOrCreateFolder(folderName);
      var results = [];

      // Lưu một tập tin đơn lẻ
      if (payload.fileName && payload.content !== undefined) {
        var res = saveSingleFile(targetFolder, payload.fileName, payload.content, payload.mimeType);
        results.push(res);
      }

      // Lưu danh sách nhiều tập tin cùng lúc
      if (Array.isArray(payload.files)) {
        for (var i = 0; i < payload.files.length; i++) {
          var item = payload.files[i];
          if (item && item.fileName && item.content !== undefined) {
            var r = saveSingleFile(targetFolder, item.fileName, item.content, item.mimeType);
            results.push(r);
          }
        }
      }

      if (results.length === 0) {
        return createJsonResponse({
          status: "error",
          message: "Không tìm thấy nội dung tập tin hợp lệ để lưu trữ."
        });
      }

      return createJsonResponse({
        status: "success",
        message: "Đã lưu dữ liệu thành công lên Google Drive.",
        folderName: folderName,
        folderUrl: targetFolder.getUrl(),
        files: results,
        timestamp: new Date().toISOString()
      });
    }

    return createJsonResponse({
      status: "error",
      message: "Hành động yêu cầu không hợp lệ: " + action
    });

  } catch (err) {
    return createJsonResponse({
      status: "error",
      message: "Lỗi xử lý phía Google Apps Script: " + err.toString()
    });
  }
}

function getOrCreateFolder(folderName) {
  var folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(folderName);
}

function saveSingleFile(folder, fileName, content, mimeType) {
  var contentType = mimeType || "application/json";
  var stringContent = typeof content === "string" ? content : JSON.stringify(content, null, 2);

  var existingFiles = folder.getFilesByName(fileName);
  var file;

  if (existingFiles.hasNext()) {
    file = existingFiles.next();
    file.setContent(stringContent);
  } else {
    file = folder.createFile(fileName, stringContent, contentType);
  }

  return {
    fileName: fileName,
    fileId: file.getId(),
    fileUrl: file.getUrl(),
    updatedAt: new Date().toISOString(),
    sizeBytes: stringContent.length
  };
}

function createJsonResponse(data) {
  var output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}
