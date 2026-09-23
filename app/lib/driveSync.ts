/**
 * Dịch vụ đồng bộ dữ liệu đánh giá lâm sàng với Google Drive qua Google Apps Script Web App.
 */

export interface DriveConfig {
  webhookUrl: string;
  folderName: string;
  autoSync: boolean;
  lastSyncTime: string | null;
}

export interface DriveSyncResult {
  ok: boolean;
  message?: string;
  folderUrl?: string;
  folderName?: string;
  files?: Array<{
    fileName: string;
    fileId: string;
    fileUrl: string;
    sizeBytes: number;
    updatedAt: string;
  }>;
  error?: string;
}

const STORAGE_KEYS = {
  WEBHOOK_URL: "nktt_drive_webhook_url",
  FOLDER_NAME: "nktt_drive_folder_name",
  AUTO_SYNC: "nktt_drive_auto_sync",
  LAST_SYNC: "nktt_drive_last_sync",
};

const DEFAULT_FOLDER = "NKTT_Expert_Evaluations";
const DEFAULT_WEBHOOK_URL =
  process.env.NEXT_PUBLIC_DRIVE_WEBHOOK_URL ||
  "https://script.google.com/macros/s/AKfycbyw4w3gNhHdUgs0YAIwUIwaER7QPoTafjsRaNuHAcMEKGyzZ1f8Ktsq6_lco0bknOpTXg/exec";

/**
 * Lấy cấu hình Google Drive hiện tại từ localStorage hoặc biến môi trường
 */
export function getDriveConfig(): DriveConfig {
  if (typeof window === "undefined") {
    return {
      webhookUrl: DEFAULT_WEBHOOK_URL,
      folderName: process.env.NEXT_PUBLIC_DRIVE_FOLDER_NAME || DEFAULT_FOLDER,
      autoSync: false,
      lastSyncTime: null,
    };
  }

  const storedUrl = localStorage.getItem(STORAGE_KEYS.WEBHOOK_URL);
  const storedFolder = localStorage.getItem(STORAGE_KEYS.FOLDER_NAME);
  const storedAutoSync = localStorage.getItem(STORAGE_KEYS.AUTO_SYNC);
  const storedLastSync = localStorage.getItem(STORAGE_KEYS.LAST_SYNC);

  return {
    webhookUrl: storedUrl !== null ? storedUrl : DEFAULT_WEBHOOK_URL,
    folderName: storedFolder || process.env.NEXT_PUBLIC_DRIVE_FOLDER_NAME || DEFAULT_FOLDER,
    autoSync: storedAutoSync === "true",
    lastSyncTime: storedLastSync || null,
  };
}

/**
 * Lưu cấu hình Google Drive vào localStorage
 */
export function saveDriveConfig(config: Partial<DriveConfig>): void {
  if (typeof window === "undefined") return;

  if (config.webhookUrl !== undefined) {
    localStorage.setItem(STORAGE_KEYS.WEBHOOK_URL, config.webhookUrl.trim());
  }
  if (config.folderName !== undefined) {
    localStorage.setItem(STORAGE_KEYS.FOLDER_NAME, config.folderName.trim() || DEFAULT_FOLDER);
  }
  if (config.autoSync !== undefined) {
    localStorage.setItem(STORAGE_KEYS.AUTO_SYNC, config.autoSync ? "true" : "false");
  }
  if (config.lastSyncTime !== undefined) {
    if (config.lastSyncTime === null) {
      localStorage.removeItem(STORAGE_KEYS.LAST_SYNC);
    } else {
      localStorage.setItem(STORAGE_KEYS.LAST_SYNC, config.lastSyncTime);
    }
  }
}

/**
 * Kiểm tra kết nối tới Google Apps Script Web App
 */
export async function testDriveConnection(webhookUrl: string): Promise<{ ok: boolean; message: string }> {
  const url = webhookUrl.trim();
  if (!url) {
    return { ok: false, message: "URL dịch vụ Google Apps Script chưa được điền." };
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify({ action: "ping" }),
      redirect: "follow",
    });

    if (!response.ok && response.status !== 0) {
      return {
        ok: false,
        message: `Máy chủ phản hồi với mã lỗi HTTP: ${response.status}`,
      };
    }

    const data = await response.json();
    if (data.status === "success") {
      return { ok: true, message: "Kết nối thành công tới dịch vụ Google Drive." };
    }
    return {
      ok: false,
      message: data.message || "Kết nối thất bại (phản hồi không hợp lệ từ dịch vụ).",
    };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      message: `Không thể kết nối tới Google Apps Script: ${errMsg}. Vui lòng kiểm tra quyền truy cập (Who has access: Anyone) và URL Web App.`,
    };
  }
}

/**
 * Gửi tải tập tin hoặc danh sách tập tin lên Google Drive
 */
export async function uploadToDrive(options: {
  webhookUrl?: string;
  folderName?: string;
  fileName?: string;
  content?: string;
  mimeType?: string;
  files?: Array<{
    fileName: string;
    content: string;
    mimeType?: string;
  }>;
  metadata?: Record<string, unknown>;
}): Promise<DriveSyncResult> {
  const config = getDriveConfig();
  const url = (options.webhookUrl || config.webhookUrl).trim();
  const folderName = (options.folderName || config.folderName).trim() || DEFAULT_FOLDER;

  if (!url) {
    return {
      ok: false,
      error: "Chưa cấu hình URL Web App Google Apps Script. Vui lòng mở Cài đặt Drive để thiết lập.",
    };
  }

  const payload: Record<string, unknown> = {
    action: options.files && options.files.length > 0 ? "save_bundle" : "save_file",
    folderName: folderName,
    metadata: options.metadata || {},
  };

  if (options.fileName && options.content !== undefined) {
    payload.fileName = options.fileName;
    payload.content = options.content;
    payload.mimeType = options.mimeType || "application/json";
  }

  if (options.files && options.files.length > 0) {
    payload.files = options.files;
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify(payload),
      redirect: "follow",
    });

    const data = await response.json();

    if (data.status === "success") {
      const now = new Date().toISOString();
      saveDriveConfig({ lastSyncTime: now });

      return {
        ok: true,
        message: data.message || "Đã lưu thành công lên Google Drive.",
        folderUrl: data.folderUrl,
        folderName: data.folderName,
        files: data.files || [],
      };
    }

    return {
      ok: false,
      error: data.message || "Lỗi lưu trữ không xác định từ dịch vụ Google Drive.",
    };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: `Lỗi kết nối khi gửi dữ liệu lên Google Drive: ${errMsg}`,
    };
  }
}

/**
 * Hàm tiện ích: Lưu kết quả thẩm định lâm sàng theo cả 2 định dạng JSON và JSONL lên Drive
 */
export async function syncClinicalEvaluationToDrive(
  doctorId: string,
  doctorName: string,
  evaluations: Record<string, unknown>
): Promise<DriveSyncResult> {
  const list = Object.values(evaluations);
  if (list.length === 0) {
    return {
      ok: false,
      error: "Chưa có dữ liệu đánh giá nào để đồng bộ lên Google Drive.",
    };
  }

  const jsonContent = JSON.stringify(evaluations, null, 2);
  const jsonlContent = list.map((item) => JSON.stringify(item)).join("\n") + "\n";

  const files = [
    {
      fileName: `clinical_eval_${doctorId}.json`,
      content: jsonContent,
      mimeType: "application/json",
    },
    {
      fileName: `clinical_eval_${doctorId}.jsonl`,
      content: jsonlContent,
      mimeType: "application/x-ndjson",
    },
  ];

  return uploadToDrive({
    files,
    metadata: {
      doctorId,
      doctorName,
      casesCount: list.length,
      syncedAt: new Date().toISOString(),
    },
  });
}

/**
 * Hàm tiện ích: Lưu tập tin gán nhãn chuyên gia expert_annotations.jsonl lên Drive
 */
export async function syncExpertAnnotationsToDrive(
  annotatorName: string,
  annotations: Record<string, unknown>
): Promise<DriveSyncResult> {
  const values = Object.values(annotations);
  if (values.length === 0) {
    return {
      ok: false,
      error: "Chưa có ca bệnh nào được xác nhận để lưu lên Google Drive.",
    };
  }

  const jsonlContent = values.map((v) => JSON.stringify(v)).join("\n") + "\n";
  const jsonContent = JSON.stringify(annotations, null, 2);

  const files = [
    {
      fileName: "expert_annotations.jsonl",
      content: jsonlContent,
      mimeType: "application/x-ndjson",
    },
    {
      fileName: "expert_annotations.json",
      content: jsonContent,
      mimeType: "application/json",
    },
  ];

  return uploadToDrive({
    files,
    metadata: {
      annotatorName,
      casesCount: values.length,
      syncedAt: new Date().toISOString(),
    },
  });
}
