/**
 * Google Apps Script - Webhook Dong bo Du lieu Danh gia Nha khoa Thuong thuc (2 chieu)
 * 
 * Huong dan trien khai:
 * 1. Mo trang https://script.google.com va mo du an Apps Script hien tai (hoac tao "Du an moi").
 * 2. Dan toan bo noi dung tap tin nay vao trinh soan thao Code.gs (thay the ma cu).
 * 3. Nhan nut "Trien khai" (Deploy) -> "Quan ly cac ban trien khai" (Manage deployments).
 * 4. Chon ban trien khai dang dung, bam bieu tuong Chinh sua (hinh cay but), chon Phien ban: "Phien ban moi" (New version).
 * 5. Nhan "Trien khai" (Deploy) de luu thay doi.
 */

var DEFAULT_FOLDER_NAME = "NKTT_Expert_Evaluations";

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
      } catch (parseError) {
        // Neu tap tin bi loi parse JSON, bo qua de tranh loi ca danh sach
      }
    }
  }

  // Sap xep tang dan theo chi so goi lam viec
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

function handleGetSingleFile(folderName, fileName) {
  if (!fileName) {
    return createJsonResponse({
      status: "error",
      message: "Thieu ten tap tin (fileName)."
    });
  }

  var targetFolder = getOrCreateFolder(folderName);
  var files = targetFolder.getFilesByName(fileName);
  if (!files.hasNext()) {
    return createJsonResponse({
      status: "error",
      message: "Khong tim thay tap tin: " + fileName
    });
  }

  var file = files.next();
  var content = file.getBlob().getDataAsString("UTF-8");
  return createJsonResponse({
    status: "success",
    fileName: fileName,
    fileId: file.getId(),
    content: content,
    updatedAt: file.getLastUpdated().toISOString()
  });
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
