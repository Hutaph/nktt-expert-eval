/**
 * Google Apps Script - Webhook Dong bo Du lieu Danh gia Nha khoa Thuong thuc
 * Phien ban bao ve tranh dung do toi da:
 * 1. Khoa doc quyen LockService 30 giay ngan chan Race Condition.
 * 2. So dang ky doc quyen 1-1 co co che het han TTL 30 phut tranh deadlock/abandoned claim.
 * 3. Co che tu dong sao luu registry (backup) chong xoa trang du lieu khi loi mang.
 * 4. Tu dong don dep tap tin trung lap (file duplication cleanup) tren Google Drive.
 * 5. Ho tro lam tuoi thoi gian lam viec (touch claim) va kiem tra quyen so huu truoc khi luu.
 */

var DEFAULT_FOLDER_NAME = "NKTT_Expert_Evaluations";
var CLAIM_EXPIRATION_MINUTES = 30;
var CLAIM_EXPIRATION_HOURS = CLAIM_EXPIRATION_MINUTES / 60;

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

    if (action === "get_claims_registry") {
      var folderName = params.folderName || DEFAULT_FOLDER_NAME;
      return handleGetClaimsRegistry(folderName);
    }

    if (action === "get_all_batches_summary") {
      var folderName = params.folderName || DEFAULT_FOLDER_NAME;
      return handleGetAllBatchesSummary(folderName);
    }

    if (action === "get_doctor_batches") {
      var folderName = params.folderName || DEFAULT_FOLDER_NAME;
      var doctorFolder = (params.doctorFolder || params.doctorId || "").toString().trim().toUpperCase();
      return handleGetDoctorBatches(folderName, doctorFolder);
    }

    if (action === "get_file" || action === "get_latest_sample_file") {
      var folderName = params.folderName || DEFAULT_FOLDER_NAME;
      var fileName = (params.fileName || "").toString().trim();
      var sampleIndex = params.sampleIndex ? parseInt(params.sampleIndex, 10) : null;
      return handleGetSingleFile(folderName, fileName, sampleIndex);
    }

    return createJsonResponse({
      status: "error",
      message: "Hanh dong khong hop le trong doGet: " + action
    });
  } catch (err) {
    return createJsonResponse({
      status: "error",
      message: "Loi xu ly doGet: " + err.toString()
    });
  }
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse({
        status: "error",
        message: "Khong tim thay du lieu noi dung trong yeu cau gui len."
      });
    }

    var payload;
    try {
      payload = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return createJsonResponse({
        status: "error",
        message: "Du lieu gui len khong dung dinh dang JSON: " + parseErr.toString()
      });
    }

    var action = payload.action || "save_file";

    if (action === "ping") {
      return createJsonResponse({
        status: "success",
        message: "Ket noi toi dich vu Google Drive thanh cong.",
        timestamp: new Date().toISOString()
      });
    }

    if (action === "get_claims_registry") {
      var folderName = payload.folderName || DEFAULT_FOLDER_NAME;
      return handleGetClaimsRegistry(folderName);
    }

    if (action === "claim_sample") {
      return handleClaimSample(payload);
    }

    if (action === "touch_claim") {
      return handleTouchClaim(payload);
    }

    if (action === "release_claim") {
      return handleReleaseClaim(payload);
    }

    if (action === "get_all_batches_summary") {
      var folderName = payload.folderName || DEFAULT_FOLDER_NAME;
      return handleGetAllBatchesSummary(folderName);
    }

    if (action === "get_doctor_batches") {
      var folderName = payload.folderName || DEFAULT_FOLDER_NAME;
      var doctorFolder = (payload.doctorFolder || payload.doctorId || "").toString().trim().toUpperCase();
      return handleGetDoctorBatches(folderName, doctorFolder);
    }

    if (action === "get_file" || action === "get_latest_sample_file") {
      var folderName = payload.folderName || DEFAULT_FOLDER_NAME;
      var fileName = (payload.fileName || "").toString().trim();
      var sampleIndex = payload.sampleIndex ? parseInt(payload.sampleIndex, 10) : null;
      return handleGetSingleFile(folderName, fileName, sampleIndex);
    }

    if (action === "save_file" || action === "save_bundle") {
      return handleSaveFile(payload);
    }

    return createJsonResponse({
      status: "error",
      message: "Hanh dong yeu cau khong hop le: " + action
    });

  } catch (err) {
    return createJsonResponse({
      status: "error",
      message: "Loi xu ly phia Google Apps Script: " + err.toString()
    });
  }
}

/**
 * Kiem tra xem mot ban ghi claim da het han TTL (30 phut khong hoat dong) hay chua
 */
function isClaimExpiredOnServer(claim) {
  if (!claim || claim.status === "COMPLETED") {
    return false;
  }
  var timeStr = claim.updatedAt || claim.claimedAt;
  if (!timeStr) {
    return true;
  }
  var claimTime = new Date(timeStr).getTime();
  if (isNaN(claimTime)) {
    return false;
  }
  var now = new Date().getTime();
  return (now - claimTime) > (CLAIM_EXPIRATION_MINUTES * 60 * 1000);
}

/**
 * Xu ly giu cho doc quyen mot mau benh nhan voi thoi gian cho lock 30 giay
 */
function handleClaimSample(payload) {
  var folderName = payload.folderName || DEFAULT_FOLDER_NAME;
  var targetFolder = getOrCreateFolder(folderName);
  var sampleIndex = parseInt(payload.sampleIndex, 10);
  var userId = payload.userId || "";
  var doctorId = payload.doctorId || "";
  var doctorName = payload.doctorName || "";
  var doctorFolder = (payload.doctorFolder || doctorId || "").toString().trim().toUpperCase();

  if (!sampleIndex || !doctorFolder) {
    return createJsonResponse({
      status: "error",
      message: "Thieu thong tin sampleIndex hoac doctorFolder."
    });
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    var regResult = readRegistryFile(targetFolder);
    var registry = regResult.registry;
    var existing = registry[sampleIndex];

    if (existing) {
      var existingDocFolder = (existing.doctorFolder || existing.doctorId || "").toString().toUpperCase();
      if (existingDocFolder && existingDocFolder !== doctorFolder) {
        if (existing.status === "COMPLETED") {
          return createJsonResponse({
            status: "error",
            error: "EXCLUSIVE_LOCK_HELD",
            message: "Mau " + sampleIndex + " da duoc hoan tat boi " + (existing.doctorName || existingDocFolder) + ". Mau da khoa khong the nhan lai.",
            existingClaim: existing
          });
        }

        // Kiem tra het han TTL doi voi ca dang lam do dang
        if (!isClaimExpiredOnServer(existing)) {
          return createJsonResponse({
            status: "error",
            error: "EXCLUSIVE_LOCK_HELD",
            message: "Mau " + sampleIndex + " dang duoc giu doc quyen boi " + (existing.doctorName || existingDocFolder) + ". Ban khong duoc phep nhan mau nay.",
            existingClaim: existing
          });
        }
      }
    }

    var now = new Date().toISOString();
    registry[sampleIndex] = {
      sampleIndex: sampleIndex,
      userId: userId || (existing ? existing.userId : ""),
      doctorId: doctorId || (existing ? existing.doctorId : ""),
      doctorName: doctorName || (existing ? existing.doctorName : ""),
      doctorFolder: doctorFolder,
      status: (existing && existing.status === "COMPLETED") ? "COMPLETED" : "IN_PROGRESS",
      claimedAt: (existing && existing.claimedAt && !isClaimExpiredOnServer(existing)) ? existing.claimedAt : now,
      updatedAt: now
    };

    writeRegistryFile(targetFolder, regResult.fileObj, registry);

    return createJsonResponse({
      status: "success",
      message: "Da xac nhan doc quyen Mau " + sampleIndex + " cho bac si " + doctorFolder,
      claim: registry[sampleIndex]
    });
  } catch (err) {
    return createJsonResponse({
      status: "error",
      message: "Loi he thong khi giu cho mau: " + err.toString()
    });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Lam tuoi thoi gian lam viec (Heartbeat) de tranh het han TTL khi bac si dang lam viec tich cuc
 */
function handleTouchClaim(payload) {
  var folderName = payload.folderName || DEFAULT_FOLDER_NAME;
  var targetFolder = getOrCreateFolder(folderName);
  var sampleIndex = parseInt(payload.sampleIndex, 10);
  var doctorFolder = (payload.doctorFolder || payload.doctorId || "").toString().trim().toUpperCase();

  if (!sampleIndex || !doctorFolder) {
    return createJsonResponse({
      status: "error",
      message: "Thieu sampleIndex hoac doctorFolder."
    });
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    var regResult = readRegistryFile(targetFolder);
    var registry = regResult.registry;
    var existing = registry[sampleIndex];

    if (existing) {
      var existingDoc = (existing.doctorFolder || existing.doctorId || "").toString().toUpperCase();
      if (existingDoc === doctorFolder) {
        existing.updatedAt = new Date().toISOString();
        writeRegistryFile(targetFolder, regResult.fileObj, registry);
        return createJsonResponse({
          status: "success",
          message: "Da lam tuoi thoi gian lam viec cho Mau " + sampleIndex
        });
      }
    }

    return createJsonResponse({
      status: "error",
      message: "Khong tim thay quyen so huu hop le de lam tuoi."
    });
  } catch (err) {
    return createJsonResponse({
      status: "error",
      message: "Loi khi lam tuoi claim: " + err.toString()
    });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Xu ly bac si chu dong nha mau khi khong the tiep tuc
 */
function handleReleaseClaim(payload) {
  var folderName = payload.folderName || DEFAULT_FOLDER_NAME;
  var targetFolder = getOrCreateFolder(folderName);
  var sampleIndex = parseInt(payload.sampleIndex, 10);
  var doctorFolder = (payload.doctorFolder || payload.doctorId || "").toString().trim().toUpperCase();

  var adminSecret = (payload.adminSecret || "").toString().trim();
  var ADMIN_KEY = "NKTT_ADMIN_OVERRIDE_2026";
  var isAdmin = (adminSecret === ADMIN_KEY);

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    var regResult = readRegistryFile(targetFolder);
    var registry = regResult.registry;
    var existing = registry[sampleIndex];

    if (!existing) {
      return createJsonResponse({ status: "success", message: "Mau nay hien dang trong." });
    }

    var existingDocFolder = (existing.doctorFolder || existing.doctorId || "").toString().toUpperCase();
    if (!isAdmin && existingDocFolder !== doctorFolder) {
      return createJsonResponse({
        status: "error",
        message: "Ban khong phai chu so huu cua Mau " + sampleIndex + " va khong co quyen Admin de nha mau."
      });
    }

    delete registry[sampleIndex];
    writeRegistryFile(targetFolder, regResult.fileObj, registry);

    return createJsonResponse({
      status: "success",
      message: "Da nha Mau " + sampleIndex + " ve trang thai trong thanh cong."
    });
  } catch (err) {
    return createJsonResponse({
      status: "error",
      message: "Loi khi nha mau: " + err.toString()
    });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Lay so dang ky doc quyen 125 mau
 */
function handleGetClaimsRegistry(folderName) {
  var targetFolder = getOrCreateFolder(folderName);
  var regResult = readRegistryFile(targetFolder);
  return createJsonResponse({
    status: "success",
    registry: regResult.registry,
    timestamp: new Date().toISOString()
  });
}

/**
 * Luu tap tin tham dinh voi co che kiem tra quyen so huu va khoa 30 giay
 */
function handleSaveFile(payload) {
  var folderName = payload.folderName || DEFAULT_FOLDER_NAME;
  var targetFolder = getOrCreateFolder(folderName);
  var metadata = payload.metadata || {};
  var results = [];

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);

    // Kiem tra quyen so huu doc quyen neu la tap tin mau benh nhan
    var sampleIndex = metadata.sampleIndex ? parseInt(metadata.sampleIndex, 10) : null;
    var doctorFolder = (metadata.doctorFolder || metadata.doctorId || "").toString().trim().toUpperCase();

    if (sampleIndex) {
      var regResult = readRegistryFile(targetFolder);
      var registry = regResult.registry;
      var existing = registry[sampleIndex];

      if (existing) {
        var existingDocFolder = (existing.doctorFolder || existing.doctorId || "").toString().toUpperCase();
        if (doctorFolder && existingDocFolder && existingDocFolder !== doctorFolder) {
          if (existing.status === "COMPLETED" || !isClaimExpiredOnServer(existing)) {
            return createJsonResponse({
              status: "error",
              error: "EXCLUSIVE_PERMISSION_DENIED",
              message: "Loi quyen so huu: Mau " + sampleIndex + " da duoc giao doc quyen cho " + (existing.doctorName || existingDocFolder) + ". Ban khong co quyen luu de len mau nay."
            });
          }
        }
      }

      // Cap nhat so dang ky
      var now = new Date().toISOString();
      var isCompleted = Boolean(metadata.isCompleted);
      registry[sampleIndex] = {
        sampleIndex: sampleIndex,
        userId: metadata.userId || (existing ? existing.userId : ""),
        doctorId: metadata.doctorId || (existing ? existing.doctorId : ""),
        doctorName: metadata.doctorName || (existing ? existing.doctorName : ""),
        doctorFolder: doctorFolder || (existing ? existing.doctorFolder : ""),
        status: isCompleted ? "COMPLETED" : "IN_PROGRESS",
        fileName: payload.fileName || metadata.fileName || (existing ? existing.fileName : ""),
        claimedAt: (existing && existing.claimedAt) ? existing.claimedAt : now,
        updatedAt: now
      };
      writeRegistryFile(targetFolder, regResult.fileObj, registry);
    }

    // Luu mot tap tin don le
    if (payload.fileName && payload.content !== undefined) {
      var res = saveSingleFile(targetFolder, payload.fileName, payload.content, payload.mimeType);
      results.push(res);
    }

    // Luu danh sach nhieu tap tin cung luc
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
        message: "Khong tim thay noi dung tap tin hop le de luu tru."
      });
    }

    return createJsonResponse({
      status: "success",
      message: "Da luu du lieu thanh cong len Google Drive.",
      folderName: folderName,
      folderUrl: targetFolder.getUrl(),
      files: results,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return createJsonResponse({
      status: "error",
      message: "Loi xu ly luu tap tin tren Google Apps Script: " + err.toString()
    });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Doc registry an toan, tu dong phuc hoi tu ban sao backup neu bi loi JSON
 */
function readRegistryFile(targetFolder) {
  var regFileIterator = targetFolder.getFilesByName("mau_claims_registry.json");
  var registry = {};
  var fileObj = null;

  if (regFileIterator.hasNext()) {
    fileObj = regFileIterator.next();
    var content = "";
    try {
      content = fileObj.getBlob().getDataAsString("UTF-8");
      if (content && content.trim().length > 0) {
        registry = JSON.parse(content);
      }
    } catch (parseErr) {
      // Neu loi doc file chinh, thu phuc hoi tu ban sao backup
      var backupIterator = targetFolder.getFilesByName("mau_claims_registry.backup.json");
      if (backupIterator.hasNext()) {
        try {
          var backupContent = backupIterator.next().getBlob().getDataAsString("UTF-8");
          registry = JSON.parse(backupContent);
        } catch (bErr) {
          throw new Error("Tep mau_claims_registry.json bi hong va khong the doc tu ban sao backup.");
        }
      } else {
        throw new Error("Tep mau_claims_registry.json bi hong dinh dang JSON va chua co ban sao luu: " + parseErr.toString());
      }
    }
  }

  return { registry: registry || {}, fileObj: fileObj };
}

/**
 * Ghi registry dong thoi luu ban sao backup de phong ngua loi ghi/doc
 */
function writeRegistryFile(targetFolder, fileObj, registry) {
  var jsonStr = JSON.stringify(registry, null, 2);
  if (fileObj) {
    fileObj.setContent(jsonStr);
  } else {
    targetFolder.createFile("mau_claims_registry.json", jsonStr, "application/json");
  }

  // Luu ban sao du phong
  try {
    var backupIter = targetFolder.getFilesByName("mau_claims_registry.backup.json");
    if (backupIter.hasNext()) {
      backupIter.next().setContent(jsonStr);
    } else {
      targetFolder.createFile("mau_claims_registry.backup.json", jsonStr, "application/json");
    }
  } catch (backupErr) {}
}

/**
 * Lay tong hop cac goi va mau da luu tren Drive
 */
function handleGetAllBatchesSummary(folderName) {
  var targetFolder = getOrCreateFolder(folderName);
  var filesIterator = targetFolder.getFiles();
  var summary = {};
  var regex = /^([A-Za-z0-9_]+)_batch_(\d+)\.json$/i;

  while (filesIterator.hasNext()) {
    var file = filesIterator.next();
    var fname = file.getName();
    var match = fname.match(regex);
    if (match) {
      var docCode = match[1].toUpperCase();
      var batchIndex = parseInt(match[2], 10);
      if (!summary[docCode]) {
        summary[docCode] = [];
      }
      if (summary[docCode].indexOf(batchIndex) === -1) {
        summary[docCode].push(batchIndex);
      }
    }
  }

  for (var k in summary) {
    summary[k].sort(function(a, b) { return a - b; });
  }

  return createJsonResponse({
    status: "success",
    summary: summary,
    timestamp: new Date().toISOString()
  });
}

function handleGetDoctorBatches(folderName, doctorFolder) {
  if (!doctorFolder) {
    return createJsonResponse({
      status: "error",
      message: "Thieu ma bac si (doctorFolder hoac doctorId)."
    });
  }

  var targetFolder = getOrCreateFolder(folderName);
  var filesIterator = targetFolder.getFiles();
  var batches = [];
  var regex = new RegExp("^" + doctorFolder + "_batch_(\\d+)\\.json$", "i");

  while (filesIterator.hasNext()) {
    var file = filesIterator.next();
    var fname = file.getName();
    var match = fname.match(regex);
    if (match) {
      var batchIndex = parseInt(match[1], 10);
      try {
        var contentStr = file.getBlob().getDataAsString("UTF-8");
        var parsedData = JSON.parse(contentStr);
        batches.push({
          batchIndex: batchIndex,
          fileName: fname,
          fileId: file.getId(),
          fileUrl: file.getUrl(),
          updatedAt: file.getLastUpdated().toISOString(),
          data: parsedData
        });
      } catch (parseError) {}
    }
  }

  batches.sort(function(a, b) {
    return a.batchIndex - b.batchIndex;
  });

  return createJsonResponse({
    status: "success",
    doctorFolder: doctorFolder,
    count: batches.length,
    batches: batches,
    timestamp: new Date().toISOString()
  });
}

function handleGetSingleFile(folderName, fileName, sampleIndex) {
  var targetFolder = getOrCreateFolder(folderName);
  var file = null;

  // 1. Tim theo ten tap tin chinh xac neu co
  if (fileName) {
    var files = targetFolder.getFilesByName(fileName);
    if (files.hasNext()) {
      file = files.next();
    }
  }

  // 2. Neu chua tim thay hoac co sampleIndex, tim theo tien to mau de lay ban ghi moi nhat
  if (!file) {
    var prefix = "";
    if (sampleIndex) {
      var padIdx = ("000" + sampleIndex).slice(-3);
      prefix = "mau_" + padIdx + "_";
    } else if (fileName && fileName.indexOf("mau_") === 0) {
      var parts = fileName.split("_");
      if (parts.length >= 2) {
        prefix = parts[0] + "_" + parts[1] + "_";
      }
    }

    if (prefix) {
      var allFiles = targetFolder.getFiles();
      var candidates = [];
      while (allFiles.hasNext()) {
        var f = allFiles.next();
        var fn = f.getName();
        if (fn.indexOf(prefix) === 0 && fn.indexOf(".json") !== -1) {
          candidates.push(f);
        }
      }

      if (candidates.length > 0) {
        candidates.sort(function(a, b) {
          var timeA = a.getLastUpdated().getTime();
          var timeB = b.getLastUpdated().getTime();
          if (timeA !== timeB) return timeB - timeA;
          return b.getName().localeCompare(a.getName());
        });
        file = candidates[0];
      }
    }
  }

  if (!file) {
    return createJsonResponse({
      status: "error",
      message: "Khong tim thay tap tin: " + (fileName || ("Mau " + sampleIndex))
    });
  }

  var content = file.getBlob().getDataAsString("UTF-8");
  return createJsonResponse({
    status: "success",
    fileName: file.getName(),
    fileId: file.getId(),
    content: content,
    updatedAt: file.getLastUpdated().toISOString()
  });
}

function getOrCreateFolder(folderName) {
  var folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    var primary = folders.next();
    // Don dep cac thu muc trung ten neu co
    while (folders.hasNext()) {
      try {
        folders.next().setTrashed(true);
      } catch (e) {}
    }
    return primary;
  }
  return DriveApp.createFolder(folderName);
}

/**
 * Luu tap tin, tu dong loai bo cac tap tin trung ten bi loi tao thua
 */
function saveSingleFile(folder, fileName, content, mimeType) {
  var contentType = mimeType || "application/json";
  var stringContent = typeof content === "string" ? content : JSON.stringify(content, null, 2);

  var existingFiles = folder.getFilesByName(fileName);
  var file = null;

  if (existingFiles.hasNext()) {
    file = existingFiles.next();
    file.setContent(stringContent);
    // Don dep cac tap tin trung ten rac neu co
    while (existingFiles.hasNext()) {
      try {
        existingFiles.next().setTrashed(true);
      } catch (delErr) {}
    }
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
