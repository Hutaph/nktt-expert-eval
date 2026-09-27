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

export interface DoctorBatchRemote {
  batchIndex: number;
  fileName: string;
  fileId?: string;
  fileUrl?: string;
  updatedAt?: string;
  data: {
    batch_meta?: Record<string, unknown>;
    cases: any[];
  };
}

/**
 * Tải toàn bộ danh sách các gói đã hoàn tất của một bác sĩ từ Google Drive (Đồng bộ 2 chiều)
 */
export async function fetchDoctorBatchesFromDrive(
  doctorFolder: string,
  options?: { webhookUrl?: string; folderName?: string; timeoutMs?: number }
): Promise<{
  ok: boolean;
  batches: DoctorBatchRemote[];
  error?: string;
}> {
  const config = getDriveConfig();
  const url = (options?.webhookUrl || config.webhookUrl).trim();
  const folderName = (options?.folderName || config.folderName).trim() || DEFAULT_FOLDER;
  const timeoutMs = options?.timeoutMs || 8000;

  if (!url) {
    return {
      ok: false,
      batches: [],
      error: "Chưa cấu hình URL Web App Google Apps Script.",
    };
  }

  // Phương thức 1: Gọi GET có tham số query và timeout
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const getUrl = `${url}?action=get_doctor_batches&doctorFolder=${encodeURIComponent(
      doctorFolder
    )}&folderName=${encodeURIComponent(folderName)}&t=${Date.now()}`;

    const res = await fetch(getUrl, {
      method: "GET",
      signal: controller.signal,
      redirect: "follow",
      cache: "no-store",
    });

    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      if (data && data.status === "success" && Array.isArray(data.batches)) {
        return {
          ok: true,
          batches: data.batches,
        };
      }
    }
  } catch {
    // Nếu GET gặp trục trặc, tiếp tục chuyển sang thử bằng POST
  }

  // Phương thức 2: Dự phòng bằng POST dạng text/plain để vượt CORS
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify({
        action: "get_doctor_batches",
        doctorFolder: doctorFolder,
        folderName: folderName,
      }),
      signal: controller.signal,
      redirect: "follow",
    });

    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      if (data && data.status === "success" && Array.isArray(data.batches)) {
        return {
          ok: true,
          batches: data.batches,
        };
      }
      return {
        ok: false,
        batches: [],
        error: data?.message || "Dữ liệu trả về từ Google Drive không hợp lệ.",
      };
    }
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      batches: [],
      error: `Không thể kết nối tới Google Drive: ${errMsg}`,
    };
  }

  return {
    ok: false,
    batches: [],
    error: "Không thể lấy dữ liệu từ Google Drive.",
  };
}

/**
 * Tải danh sách tóm tắt tất cả các gói đã hoàn tất của mọi bác sĩ từ Google Drive
 * Trả về định dạng: { BS01: [1], BS05: [1] }
 */
export async function fetchAllBatchesSummaryFromDrive(
  options?: { webhookUrl?: string; folderName?: string; timeoutMs?: number }
): Promise<{
  ok: boolean;
  summary: Record<string, number[]>;
  error?: string;
}> {
  const config = getDriveConfig();
  const url = (options?.webhookUrl || config.webhookUrl).trim();
  const folderName = (options?.folderName || config.folderName).trim() || DEFAULT_FOLDER;
  const timeoutMs = options?.timeoutMs || 4000;

  if (!url) {
    return { ok: false, summary: {}, error: "Chưa cấu hình URL Google Apps Script." };
  }

  // Phương thức 1: Gọi lệnh tổng hợp get_all_batches_summary
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const getUrl = `${url}?action=get_all_batches_summary&folderName=${encodeURIComponent(
      folderName
    )}&t=${Date.now()}`;

    const res = await fetch(getUrl, {
      method: "GET",
      signal: controller.signal,
      redirect: "follow",
      cache: "no-store",
    });

    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      if (data && data.status === "success" && data.summary && typeof data.summary === "object") {
        return { ok: true, summary: data.summary };
      }
    }
  } catch {}

  // Phương thức 2: Dự phòng quét song song 5 bác sĩ qua get_doctor_batches
  try {
    const docCodes = ["BS01", "BS02", "BS03", "BS04", "BS05"];
    const results = await Promise.all(
      docCodes.map((code) =>
        fetchDoctorBatchesFromDrive(code, { webhookUrl: url, folderName, timeoutMs: 3500 })
      )
    );

    const summary: Record<string, number[]> = {};
    docCodes.forEach((code, idx) => {
      const r = results[idx];
      if (r && r.ok && Array.isArray(r.batches) && r.batches.length > 0) {
        summary[code] = r.batches.map((b) => b.batchIndex).sort((a, b) => a - b);
      }
    });

    return { ok: true, summary };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return { ok: false, summary: {}, error: errMsg };
  }
}

/**
 * Dinh dang thoi gian luu cho ten tap tin JSON: YYYYMMDD_HHmmss
 */
export function formatSaveTimestamp(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  return `${y}${m}${d}_${h}${mi}${s}`;
}

/**
 * Tao ten tap tin JSON luu mau danh gia co dinh kem moc thoi gian ro rang
 */
export function getSampleFileName(
  sampleIndex: number,
  userId: string,
  doctorFolder: string,
  timestamp?: string
): string {
  const padIndex = String(sampleIndex).padStart(3, "0");
  const ts = timestamp || formatSaveTimestamp();
  return `mau_${padIndex}_${userId}_${doctorFolder}_${ts}.json`;
}

/**
 * Đọc nội dung 1 file trực tiếp từ Google Drive
 */
export async function getFileFromDrive(
  fileName: string,
  options?: { webhookUrl?: string; folderName?: string; timeoutMs?: number; sampleIndex?: number }
): Promise<{
  ok: boolean;
  content?: string;
  updatedAt?: string;
  fileName?: string;
  error?: string;
}> {
  const config = getDriveConfig();
  const url = (options?.webhookUrl || config.webhookUrl).trim();
  const folderName = (options?.folderName || config.folderName).trim() || DEFAULT_FOLDER;
  const timeoutMs = options?.timeoutMs || 6000;

  if (!url) {
    return { ok: false, error: "Chưa cấu hình URL Google Apps Script." };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify({
        action: "get_file",
        folderName: folderName,
        fileName: fileName,
        sampleIndex: options?.sampleIndex,
      }),
      signal: controller.signal,
      redirect: "follow",
    });

    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      if (data && data.status === "success") {
        return {
          ok: true,
          content: data.content,
          updatedAt: data.updatedAt,
          fileName: data.fileName || fileName,
        };
      }
      return {
        ok: false,
        error: data?.message || "Không tìm thấy tập tin.",
      };
    }
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: errMsg };
  }

  return { ok: false, error: "Không thể đọc tập tin từ Drive." };
}

export interface SampleClaimRecord {
  sampleIndex: number;
  userId: string;
  doctorFolder: string;
  doctorId: string;
  doctorName: string;
  status: "IN_PROGRESS" | "COMPLETED";
  claimedAt: string;
  updatedAt?: string;
  fileName?: string;
}

export type ClaimsRegistry = Record<number, SampleClaimRecord>;

/**
 * Lấy danh sách toàn bộ các mẫu đang được giữ chỗ / đã hoàn tất từ Drive
 */
export async function fetchClaimsRegistry(
  options?: { webhookUrl?: string; folderName?: string; timeoutMs?: number }
): Promise<{ ok: boolean; registry: ClaimsRegistry; error?: string }> {
  const config = getDriveConfig();
  const url = (options?.webhookUrl || config.webhookUrl).trim();
  const folderName = (options?.folderName || config.folderName).trim() || DEFAULT_FOLDER;
  const timeoutMs = options?.timeoutMs || 4000;

  if (url) {
    // Phương thức 1: Gọi action get_claims_registry
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const getUrl = `${url}?action=get_claims_registry&folderName=${encodeURIComponent(
        folderName
      )}&t=${Date.now()}`;

      const res = await fetch(getUrl, {
        method: "GET",
        signal: controller.signal,
        redirect: "follow",
        cache: "no-store",
      });

      clearTimeout(timer);

      if (res.ok) {
        const data = await res.json();
        if (data && data.status === "success" && data.registry && typeof data.registry === "object") {
          return { ok: true, registry: data.registry };
        }
      }
    } catch {}
  }

  // Phương thức 2: Đọc file mau_claims_registry.json trực tiếp
  const res = await getFileFromDrive("mau_claims_registry.json", options);
  if (res.ok && res.content) {
    try {
      const parsed = JSON.parse(res.content);
      return { ok: true, registry: parsed };
    } catch {}
  }
  return { ok: true, registry: {} };
}

/**
 * Giữ chỗ độc quyền một mẫu trên Google Drive:
 * 1. Gọi lệnh claim_sample trên server (kiểm tra khóa độc quyền, ngăn chặn người thứ hai)
 * 2. Lưu file JSON nháp (chưa đầy đủ) của mẫu lên Drive
 */
export async function claimSampleOnDrive(
  sampleIndex: number,
  userId: string,
  doctor: { id: string; name: string; folderCode: string },
  initialPayload?: Record<string, unknown>,
  options?: { webhookUrl?: string; folderName?: string }
): Promise<{ ok: boolean; error?: string }> {
  try {
    const config = getDriveConfig();
    const url = (options?.webhookUrl || config.webhookUrl).trim();
    const folderName = (options?.folderName || config.folderName).trim() || DEFAULT_FOLDER;
    const docFolder = (doctor.folderCode || doctor.id || "BS01").toUpperCase();
    const now = new Date().toISOString();

    // 1. Kiem tra va xac nhan quyen doc quyen tren server Google Apps Script
    if (url) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({
            action: "claim_sample",
            folderName,
            sampleIndex,
            userId,
            doctorId: doctor.id,
            doctorName: doctor.name,
            doctorFolder: docFolder,
          }),
          redirect: "follow",
        });

        const claimRes = await response.json();
        if (claimRes && claimRes.status === "error") {
          const errMsg = claimRes.message || "";
          const isUnsupported =
            errMsg.includes("khong hop le") ||
            errMsg.includes("không hợp lệ") ||
            errMsg.includes("claim_sample");

          // Neu server chua deploy action claim_sample moi, bo qua loi nay de tiep tuc luu qua save_file
          if (!isUnsupported) {
            return {
              ok: false,
              error: errMsg || "Mẫu này đã thuộc quyền sở hữu của bác sĩ khác.",
            };
          }
        }
      } catch (e) {
        // Khong de loi mang ngat quang qua trinh lam viec cua bac si
        console.warn("Luu y khi goi claim_sample tren server:", e);
      }
    }

    // 2. Chỉ lưu tệp JSON lên Drive nếu người gọi truyền sẵn initialPayload đầy đủ dữ liệu
    if (initialPayload && Object.keys(initialPayload).length > 0) {
      const fileName = `mau_${String(sampleIndex).padStart(3, "0")}_${userId}_${docFolder}.json`;
      await uploadToDrive({
        fileName,
        content: JSON.stringify(initialPayload, null, 2),
        mimeType: "application/json",
        metadata: {
          sampleIndex,
          userId,
          doctorId: doctor.id,
          doctorName: doctor.name,
          doctorFolder: docFolder,
          status: "IN_PROGRESS",
          isDraft: true,
        },
      });
    }

    return { ok: true };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: errMsg };
  }
}

export const CLAIM_EXPIRATION_MINUTES = 30;
export const CLAIM_EXPIRATION_HOURS = CLAIM_EXPIRATION_MINUTES / 60;

/**
 * Thoi han giu cho: Mau dang lam do dang (IN_PROGRESS) neu khong co cap nhat trong 30 phut
 * se duoc coi la het han (abandoned claim), cho phep bac si khac tiep nhan de tranh tac nghen du an.
 */
export function isClaimExpired(claim?: SampleClaimRecord | null): boolean {
  if (!claim || claim.status === "COMPLETED") return false;
  const timeStr = claim.updatedAt || claim.claimedAt;
  if (!timeStr) return true;
  const time = new Date(timeStr).getTime();
  if (isNaN(time)) return false;
  return Date.now() - time > CLAIM_EXPIRATION_MINUTES * 60 * 1000;
}

/**
 * Lam tuoi thoi gian lam viec (Heartbeat) de mau khong bi het han khi bac si dang tich cuc cham diem
 */
export async function touchClaimOnDrive(
  sampleIndex: number,
  doctorFolder: string,
  options?: { webhookUrl?: string; folderName?: string }
): Promise<{ ok: boolean }> {
  try {
    const config = getDriveConfig();
    const url = (options?.webhookUrl || config.webhookUrl).trim();
    const folderName = (options?.folderName || config.folderName).trim() || DEFAULT_FOLDER;
    if (!url) return { ok: false };
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "touch_claim",
        folderName,
        sampleIndex,
        doctorFolder,
      }),
      redirect: "follow",
    });
    const data = await res.json();
    return { ok: Boolean(data && data.status === "success") };
  } catch {
    return { ok: false };
  }
}

/**
 * Huy giu cho mot mau tren Google Drive (chi bac si so huu hoac Quan tri vien moi co quyen nha)
 */
export async function releaseClaimOnDrive(
  sampleIndex: number,
  doctorFolder?: string,
  options?: { webhookUrl?: string; folderName?: string; adminSecret?: string }
): Promise<{ ok: boolean; error?: string }> {
  try {
    const config = getDriveConfig();
    const url = (options?.webhookUrl || config.webhookUrl).trim();
    const folderName = (options?.folderName || config.folderName).trim() || DEFAULT_FOLDER;

    if (url) {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: "release_claim",
          folderName,
          sampleIndex,
          doctorFolder: doctorFolder || "",
          adminSecret: options?.adminSecret || "",
        }),
        redirect: "follow",
      });

      const data = await response.json();
      if (data && data.status === "error") {
        const errMsg = data.message || "";
        const isUnsupported =
          errMsg.includes("khong hop le") ||
          errMsg.includes("không hợp lệ") ||
          errMsg.includes("release_claim");
        if (!isUnsupported) {
          return { ok: false, error: data.message };
        }
      }
    }

    return { ok: true };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: errMsg };
  }
}



