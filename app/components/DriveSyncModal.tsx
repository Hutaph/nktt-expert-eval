"useclient";

import React, { useState, useEffect } from "react";
import styles from "./DriveSyncModal.module.css";
import { getDriveConfig, saveDriveConfig, testDriveConnection, DriveConfig } from "../lib/driveSync";

interface DriveSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved?: (config: DriveConfig) => void;
}

const GOOGLE_APPS_SCRIPT_TEMPLATE = `var DEFAULT_FOLDER_NAME = "NKTT_Expert_Evaluations";

function doGet(e) {
  try {
    var params = (e && e.parameter) ? e.parameter : {};
    var action = params.action || "status";

    if (action === "ping" || action === "status") {
      return createJsonResponse({
        status: action === "ping" ? "success" : "online",
        message: "Dich vu dong bo Google Drive cua NKTT Expert Eval dang hoat dong binh thuong.",
        timestamp: new Date().toISOString()
      });
    }

    if (action === "get_doctor_batches") {
      var folderName = params.folderName || DEFAULT_FOLDER_NAME;
      var doctorFolder = (params.doctorFolder || params.doctorId || "").toString().trim().toUpperCase();
      return handleGetDoctorBatches(folderName, doctorFolder);
    }

    if (action === "get_file") {
      var folderName = params.folderName || DEFAULT_FOLDER_NAME;
      var fileName = (params.fileName || "").toString().trim();
      return handleGetSingleFile(folderName, fileName);
    }

    return createJsonResponse({ status: "error", message: "Hanh dong khong hop le trong doGet: " + action });
  } catch (err) {
    return createJsonResponse({ status: "error", message: "Loi xu ly doGet: " + err.toString() });
  }
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse({ status: "error", message: "Khong tim thay du lieu postData." });
    }
    var payload = JSON.parse(e.postData.contents);
    var action = payload.action || "save_file";

    if (action === "ping") {
      return createJsonResponse({ status: "success", message: "Ket noi Google Drive thanh cong." });
    }

    if (action === "get_doctor_batches") {
      var folderName = payload.folderName || DEFAULT_FOLDER_NAME;
      var doctorFolder = (payload.doctorFolder || payload.doctorId || "").toString().trim().toUpperCase();
      return handleGetDoctorBatches(folderName, doctorFolder);
    }

    if (action === "get_file") {
      var folderName = payload.folderName || DEFAULT_FOLDER_NAME;
      var fileName = (payload.fileName || "").toString().trim();
      return handleGetSingleFile(folderName, fileName);
    }

    if (action === "save_file" || action === "save_bundle") {
      var folderName = payload.folderName || DEFAULT_FOLDER_NAME;
      var targetFolder = getOrCreateFolder(folderName);
      var results = [];

      if (payload.fileName && payload.content !== undefined) {
        results.push(saveSingleFile(targetFolder, payload.fileName, payload.content, payload.mimeType));
      }

      if (Array.isArray(payload.files)) {
        for (var i = 0; i < payload.files.length; i++) {
          var item = payload.files[i];
          if (item && item.fileName && item.content !== undefined) {
            results.push(saveSingleFile(targetFolder, item.fileName, item.content, item.mimeType));
          }
        }
      }

      return createJsonResponse({
        status: "success",
        message: "Da luu thanh cong len Google Drive.",
        folderName: folderName,
        folderUrl: targetFolder.getUrl(),
        files: results
      });
    }

    return createJsonResponse({ status: "error", message: "Hanh dong khong hop le: " + action });
  } catch (err) {
    return createJsonResponse({ status: "error", message: "Loi: " + err.toString() });
  }
}

function handleGetDoctorBatches(folderName, doctorFolder) {
  if (!doctorFolder) {
    return createJsonResponse({ status: "error", message: "Thieu ma bac si." });
  }
  var targetFolder = getOrCreateFolder(folderName);
  var filesIterator = targetFolder.getFiles();
  var batches = [];
  var regex = new RegExp("^" + doctorFolder + "_batch_(\\\\d+)\\\\.json$", "i");

  while (filesIterator.hasNext()) {
    var file = filesIterator.next();
    var fname = file.getName();
    var match = fname.match(regex);
    if (match) {
      var batchIndex = parseInt(match[1], 10);
      try {
        var contentStr = file.getBlob().getDataAsString("UTF-8");
        batches.push({
          batchIndex: batchIndex,
          fileName: fname,
          fileId: file.getId(),
          fileUrl: file.getUrl(),
          updatedAt: file.getLastUpdated().toISOString(),
          data: JSON.parse(contentStr)
        });
      } catch (err) {}
    }
  }

  batches.sort(function(a, b) { return a.batchIndex - b.batchIndex; });
  return createJsonResponse({
    status: "success",
    doctorFolder: doctorFolder,
    count: batches.length,
    batches: batches,
    timestamp: new Date().toISOString()
  });
}

function handleGetSingleFile(folderName, fileName) {
  if (!fileName) return createJsonResponse({ status: "error", message: "Thieu fileName." });
  var targetFolder = getOrCreateFolder(folderName);
  var files = targetFolder.getFilesByName(fileName);
  if (!files.hasNext()) return createJsonResponse({ status: "error", message: "Khong tim thay tap tin." });
  var file = files.next();
  return createJsonResponse({
    status: "success",
    fileName: fileName,
    fileId: file.getId(),
    content: file.getBlob().getDataAsString("UTF-8"),
    updatedAt: file.getLastUpdated().toISOString()
  });
}

function getOrCreateFolder(folderName) {
  var folders = DriveApp.getFoldersByName(folderName);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
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
  return { fileName: fileName, fileId: file.getId(), fileUrl: file.getUrl(), updatedAt: new Date().toISOString() };
}

function createJsonResponse(data) {
  var output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}`;

export default function DriveSyncModal({ isOpen, onClose, onConfigSaved }: DriveSyncModalProps) {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [folderName, setFolderName] = useState("NKTT_Expert_Evaluations");
  const [autoSync, setAutoSync] = useState(false);
  const [testStatus, setTestStatus] = useState<{
    loading: boolean;
    success?: boolean;
    message?: string;
  }>({ loading: false });
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const current = getDriveConfig();
      setWebhookUrl(current.webhookUrl);
      setFolderName(current.folderName);
      setAutoSync(current.autoSync);
      setTestStatus({ loading: false });
      setCopiedCode(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    if (!webhookUrl.trim()) {
      setTestStatus({
        loading: false,
        success: false,
        message: "Vui lòng nhập URL Web App trước khi kiểm tra kết nối.",
      });
      return;
    }

    setTestStatus({ loading: true, message: "Đang kiểm tra kết nối tới Google Apps Script..." });
    const result = await testDriveConnection(webhookUrl);
    setTestStatus({
      loading: false,
      success: result.ok,
      message: result.message,
    });
  };

  const handleSave = () => {
    const newConfig: Partial<DriveConfig> = {
      webhookUrl: webhookUrl.trim(),
      folderName: folderName.trim() || "NKTT_Expert_Evaluations",
      autoSync: autoSync,
    };
    saveDriveConfig(newConfig);

    if (onConfigSaved) {
      onConfigSaved(getDriveConfig());
    }
    onClose();
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_TEMPLATE);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 3000);
    } catch {
      alert("Không thể tự động sao chép mã. Vui lòng mở tập tin Code.gs trong thư mục google-drive-sync.");
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Cài đặt Đồng bộ Google Drive</h2>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Đóng">
            X
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.formGroup}>
            <label htmlFor="driveWebhookUrl" className={styles.label}>
              URL Web App Google Apps Script
            </label>
            <div className={styles.inputGroup}>
              <input
                id="driveWebhookUrl"
                type="text"
                className={styles.textInput}
                placeholder="https://script.google.com/macros/s/.../exec"
                value={webhookUrl}
                onChange={(e) => {
                  setWebhookUrl(e.target.value);
                  setTestStatus({ loading: false });
                }}
              />
              <button
                type="button"
                className={styles.testButton}
                onClick={handleTestConnection}
                disabled={testStatus.loading}
              >
                {testStatus.loading ? "Đang kiểm tra..." : "Kiểm tra kết nối"}
              </button>
            </div>
            <p className={styles.helperText}>
              Điểm cuối do Google Apps Script cung cấp để nhận dữ liệu JSON/JSONL và lưu trực tiếp vào Google Drive.
            </p>
          </div>

          {testStatus.message && (
            <div
              className={
                testStatus.loading
                  ? styles.statusBoxInfo
                  : testStatus.success
                  ? styles.statusBoxSuccess
                  : styles.statusBoxError
              }
            >
              {testStatus.message}
            </div>
          )}

          <div className={styles.formGroup}>
            <label htmlFor="driveFolderName" className={styles.label}>
              Tên thư mục lưu trữ trên Google Drive
            </label>
            <input
              id="driveFolderName"
              type="text"
              className={styles.textInput}
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="NKTT_Expert_Evaluations"
            />
            <p className={styles.helperText}>
              Thư mục này sẽ tự động được tạo trên Google Drive của bạn nếu chưa tồn tại.
            </p>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                className={styles.checkboxInput}
                checked={autoSync}
                onChange={(e) => setAutoSync(e.target.checked)}
              />
              Tự động đồng bộ lên Drive sau mỗi lượt chấm điểm một ca
            </label>
            <p className={styles.helperText}>
              Khi bật tùy chọn này, hệ thống sẽ tự động cập nhật kết quả lên Google Drive mỗi khi bạn chấm điểm xong một ca.
            </p>
          </div>

          <div className={styles.guideCard}>
            <div className={styles.guideHeader}>
              <h3 className={styles.guideTitle}>Hướng dẫn nhanh thiết lập Google Apps Script (2 phút)</h3>
              <button type="button" className={styles.copyCodeButton} onClick={handleCopyCode}>
                {copiedCode ? "Đã sao chép mã" : "Sao chép mã Google Apps Script"}
              </button>
            </div>
            <ol className={styles.guideList}>
              <li>Truy cập trang web https://script.google.com và nhấn nút "Dự án mới" (New project).</li>
              <li>Bấm nút "Sao chép mã Google Apps Script" ở trên và dán thay thế toàn bộ nội dung trong Code.gs.</li>
              <li>Nhấn Triển khai (Deploy) -&gt; Tùy chọn triển khai mới (New deployment).</li>
              <li>
                Chọn loại "Ứng dụng web" (Web app), đặt "Thực thi dưới dạng: Tôi (Me)", "Ai có quyền truy cập: Bất kỳ ai (Anyone)".
              </li>
              <li>Cấp quyền truy cập khi Google yêu cầu, sau đó sao chép URL Web App được cấp và dán vào ô phía trên.</li>
            </ol>
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button type="button" className={styles.cancelButton} onClick={onClose}>
            Đóng
          </button>
          <button type="button" className={styles.saveButton} onClick={handleSave}>
            Lưu cấu hình
          </button>
        </div>
      </div>
    </div>
  );
}
