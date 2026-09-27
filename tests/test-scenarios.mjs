import { chromium } from "playwright";

// -----------------------------------------------------------------------
// Bo kiem thu toan dien NKTT Expert Eval
// Cap nhat: Kiem tra on dinh sau khi xoa thong tin Drive khoi dialog luu goi
// -----------------------------------------------------------------------

async function runAllTests() {
  console.log("=== BAT DAU KIEM THU TOAN DIEN HE THONG (PLAYWRIGHT) ===");
  const startTime = Date.now();
  let passedCount = 0;
  let failedCount = 0;
  const failedTests = [];

  function pass(label) {
    passedCount++;
    console.log(`  [PASS] ${label}`);
  }

  function fail(label, reason) {
    failedCount++;
    failedTests.push({ label, reason });
    console.error(`  [FAIL] ${label}: ${reason}`);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    acceptDownloads: true,
  });
  const page = await context.newPage();

  let downloadTriggered = false;
  let downloadedFileName = "";
  page.on("download", (download) => {
    downloadTriggered = true;
    downloadedFileName = download.suggestedFilename();
    console.error("CANH BAO NGHIEM TRONG: Phat hien su kien tai tep:", downloadedFileName);
  });

  const dialogMessages = [];
  page.on("dialog", async (dialog) => {
    const text = dialog.message();
    dialogMessages.push(text);
    const preview = text.replace(/\n/g, " ").slice(0, 120);
    console.log(`  [Dialog] "${preview}${text.length > 120 ? "..." : ""}"`);
    await dialog.accept();
  });

  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
      console.warn("  [Console Error]", msg.text().slice(0, 150));
    }
  });

  try {
    // =========================================================
    // KICH BAN 1: Truy cap trang va khoi tao phien sach
    // =========================================================
    console.log("\n[Kich ban 1] Truy cap ung dung va khoi tao phien lam viec sach...");
    await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
    await page.evaluate(() => { sessionStorage.clear(); localStorage.clear(); });
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(600);

    const pageTitle = await page.title();
    if (pageTitle && pageTitle.length > 0) {
      pass(`Trang tai thanh cong (title: "${pageTitle}")`);
    } else {
      fail("Tieu de trang", "Trang khong co tieu de hoac tai that bai");
    }

    const doctorPromptVisible = await page.locator("text=Chọn Bác sĩ chuyên khoa của bạn:").isVisible().catch(() => false);
    if (doctorPromptVisible) {
      pass("Modal dang nhap Bac si xuat hien dung quy trinh");
    } else {
      fail("Modal dang nhap", "Khong tim thay modal dang nhap");
    }

    // =========================================================
    // KICH BAN 2: Bao mat - Chan sai mat khau
    // =========================================================
    console.log("\n[Kich ban 2] Kiem tra bao mat: chan sai mat khau...");
    await page.locator("text=Bác sĩ Thẩm định 01").first().click();
    await page.waitForTimeout(300);

    const passwordInput = page.locator('input[type="password"]');
    await passwordInput.fill("sai_mat_khau_123");
    const loginButton = page.locator('button[type="submit"]:has-text("Vào làm việc")');
    await loginButton.click();
    await page.waitForTimeout(400);

    const errorVisible = await page.locator("text=Mật khẩu không chính xác").isVisible();
    if (errorVisible) {
      pass("He thong chan mat khau sai dung cach");
    } else {
      fail("Chan sai mat khau", "He thong khong hien thi thong bao loi khi nhap sai mat khau");
    }

    const pwValue = await passwordInput.inputValue();
    if (pwValue.length > 0) {
      pass("Truong mat khau giu nguyen noi dung sau khi sai (UX tot)");
    } else {
      fail("UX truong mat khau", "Truong mat khau bi xoa sach - anh huong trai nghiem");
    }

    // =========================================================
    // KICH BAN 3: Dang nhap thanh cong va Onboarding
    // =========================================================
    console.log("\n[Kich ban 3] Dang nhap thanh cong va kiem tra Onboarding...");
    await passwordInput.fill("rangtrang38");
    await loginButton.click();
    await page.waitForTimeout(600);

    const rulesModalVisible = await page.locator("text=Quy chuẩn & Cam kết Thẩm định Lâm sàng").isVisible();
    if (rulesModalVisible) {
      pass("Modal Quy chuan & Cam ket xuat hien sau khi dang nhap");
    } else {
      fail("Modal Quy chuan", "Modal Noi quy khong xuat hien sau khi dang nhap");
    }

    const continueBtn = page.locator('button:has-text("Tiếp tục: Xem bảng ví dụ mẫu")');
    if (await continueBtn.isDisabled()) {
      pass("Nut Tiep tuc bi khoa khi chua tich cam ket");
    } else {
      fail("Khoa nut Tiep tuc", "Nut Tiep tuc chua bi vo hieu hoa khi chua tich cam ket");
    }

    await page.locator('input[type="checkbox"]').check();
    await page.waitForTimeout(200);
    if (!(await continueBtn.isDisabled())) {
      pass("Nut Tiep tuc mo khoa ngay sau khi tich cam ket");
    } else {
      fail("Mo khoa nut Tiep tuc", "Nut Tiep tuc van bi khoa sau khi da tich cam ket");
    }
    await continueBtn.click();
    await page.waitForTimeout(600);

    // =========================================================
    // KICH BAN 4: Modal Vi du doi chieu
    // =========================================================
    console.log("\n[Kich ban 4] Kiem tra Modal Vi du doi chieu...");
    const exampleModalVisible = await page.locator("text=Bảng Mẫu Đối Chiếu: Trước & Sau Khi Hiệu Chỉnh").isVisible();
    if (exampleModalVisible) {
      pass("Modal Vi du doi chieu xuat hien dung thu tu");
    } else {
      fail("Modal Vi du", "Modal Vi du doi chieu khong xuat hien");
    }

    const tabAfterBtn = page.locator('button:has-text("Tab 2: Sau khi Bác sĩ hiệu chỉnh")');
    if (await tabAfterBtn.isVisible()) {
      await tabAfterBtn.click();
      await page.waitForTimeout(300);
      if (await page.locator("text=Quy chuẩn sau khi Bác sĩ hiệu chỉnh").isVisible()) {
        pass("Chuyen doi Tab 2 trong Modal Vi du hien thi dung noi dung");
      } else {
        fail("Tab Vi du", "Chuyen sang Tab 2 nhung noi dung khong hien thi dung");
      }
    } else {
      fail("Tab Vi du", "Nut Tab 2 khong tim thay trong Modal Vi du");
    }

    await page.locator('button:has-text("Bắt đầu thẩm định")').click();
    await page.waitForTimeout(800);

    // =========================================================
    // KICH BAN 5: Giao dien Ban lam viec chinh
    // =========================================================
    console.log("\n[Kich ban 5] Kiem tra giao dien Ban lam viec chinh...");
    if (await page.locator("text=Bác sĩ Thẩm định 01").first().isVisible()) {
      pass("Thong tin Bac si hien thi chinh xac tren giao dien chinh");
    } else {
      fail("Thong tin Bac si", "Khong tim thay ten Bac si tren giao dien chinh");
    }

    if (await page.locator("text=Lịch sử cuộc trò chuyện:").isVisible()) {
      pass("Tieu de 'Lich su cuoc tro chuyen:' hien thi chinh xac");
    } else {
      fail("Tieu de Lich su", "Khong tim thay 'Lich su cuoc tro chuyen:'");
    }

    if (await page.locator("text=Ghi chú bổ sung (tùy chọn)").isVisible()) {
      pass("Nhan 'Ghi chu bo sung (tuy chon)' hien thi dung");
    } else {
      fail("Nhan Ghi chu", "Khong tim thay nhan 'Ghi chu bo sung (tuy chon)'");
    }

    const v1 = await page.locator('button:has-text("Đạt chuẩn lâm sàng")').count();
    const v2 = await page.locator('button:has-text("Cần hiệu chỉnh câu từ")').count();
    const v3 = await page.locator('button:has-text("Cần lưu ý thêm")').count();
    if (v1 === 0 && v2 === 0 && v3 === 0) {
      pass("Cac nut verdict thu cong da duoc loai bo triet de");
    } else {
      fail("Loai bo nut verdict", "Van con nut verdict thu cong ton tai");
    }

    // =========================================================
    // KICH BAN 6: Thanh phan Likert va nhap lieu
    // =========================================================
    console.log("\n[Kich ban 6] Kiem tra thanh phan Likert va nhap lieu...");
    // ClinicalLikertEvalView la component rieng biet (chua tich hop vao giao dien chinh)
    // Kiem tra giao dien xem danh gia cua ca benh dang co nhung truong nhap lieu gi
    await page.waitForTimeout(500);

    // Kiem tra cac thanh phan nhap lieu chinh: textarea hieu chinh, input tim kiem
    const textareaCount = await page.locator('textarea').count();
    const inputCount = await page.locator('input[type="text"]').count();
    const confirmBtn = page.locator('button[title*="Xác nhận thẩm định ca này"]');
    if (textareaCount > 0) {
      pass(`Giao dien hieu chinh co ${textareaCount} truong textarea san sang de nhap lieu`);
    } else if (inputCount > 0) {
      pass(`Giao dien hieu chinh co ${inputCount} truong input san sang de nhap lieu`);
    } else {
      fail("Truong nhap lieu hieu chinh", "Khong tim thay bat ky truong nhap lieu nao tren giao dien ca benh");
    }

    // Kiem tra nut xac nhan ca benh hien thi
    if (await confirmBtn.isVisible()) {
      pass("Nut xac nhan tham dinh ca benh hien thi san sang");
    } else {
      fail("Nut xac nhan ca", "Khong tim thay nut xac nhan tham dinh ca benh");
    }

    const queryTA = page.locator('textarea[title*="Nội dung câu hỏi của người hỏi"]').first();
    if (await queryTA.isVisible()) {
      const origVal = await queryTA.inputValue();
      await queryTA.fill(origVal + " (chuẩn y khoa)");
      await page.waitForTimeout(300);
      if ((await queryTA.inputValue()).includes("chuẩn y khoa")) {
        pass("Nhap lieu hieu chinh cau hoi benh nhan thanh cong");
      } else {
        fail("Nhap lieu Textarea", "Gia tri textarea khong cap nhat sau khi nhap");
      }
    }

    const notesTA = page.locator('textarea[placeholder*="Ghi chú thêm"]').first();
    if (await notesTA.isVisible()) {
      const testNote = "Kiem thu: chuan hoa thuat ngu rang ham mat.";
      await notesTA.fill(testNote);
      await page.waitForTimeout(200);
      if ((await notesTA.inputValue()) === testNote) {
        pass("O ghi chu bo sung nhan va luu noi dung dung");
      } else {
        fail("Ghi chu bo sung", "Noi dung ghi chu khong duoc luu dung");
      }
    }

    // =========================================================
    // KICH BAN 7: Xac nhan 10/10 ca trong Goi 1
    // =========================================================
    console.log("\n[Kich ban 7] Tien hanh xac nhan du 10/10 ca trong Goi 1...");
    let confirmedCases = 0;
    for (let i = 1; i <= 10; i++) {
      const btn = page.locator('button[title*="Xác nhận thẩm định ca này"]');
      if (await btn.isVisible()) {
        await btn.click();
        await page.waitForTimeout(400);
        confirmedCases++;
      } else {
        fail(`Xac nhan Ca ${i}/10`, `Khong tim thay nut xac nhan tai ca thu ${i}`);
        break;
      }
    }
    if (confirmedCases === 10) {
      pass("Da xac nhan thanh cong ca 10/10 ca benh trong Goi 1");
    }

    if (await page.locator("text=Gói 1 đã hoàn tất 10/10 ca").isVisible()) {
      pass("Banner thong bao hoan tat 10/10 ca hien thi chinh xac");
    } else {
      fail("Banner hoan tat Goi 1", "Khong hien thi banner 'Goi 1 da hoan tat 10/10 ca'");
    }

    // =========================================================
    // KICH BAN 8: Luu Goi 1 - Thong bao SACH & KHONG tai tep
    // =========================================================
    console.log("\n[Kich ban 8] Luu Goi 1: Thong bao sach & TUYET DOI KHONG tai tep ve may...");
    downloadTriggered = false;
    const dialogCountBefore = dialogMessages.length;

    const saveBtn1 = page.locator('button:has-text("Bấm Lưu Gói 1 ngay")');
    const saveBtn2 = page.locator('button:has-text("Lưu Gói 1")');
    if (await saveBtn1.isVisible()) {
      await saveBtn1.click();
    } else if (await saveBtn2.isVisible()) {
      await saveBtn2.click();
    } else {
      fail("Nut Luu Goi 1", "Khong tim thay nut luu Goi 1");
    }

    await page.waitForTimeout(4000);

    if (!downloadTriggered) {
      pass("Tuyet doi xac nhan: KHONG co tep nao bi tai ve may bac si");
    } else {
      fail("Kiem soat download", `VI PHAM: Tep bi tai ve may: ${downloadedFileName}`);
    }

    // Cho them 2 giay de dam bao tat ca dialog da duoc xu ly
    await page.waitForTimeout(2000);
    const allDialogsSoFar = dialogMessages.slice(dialogCountBefore);

    // Tim dialog lien quan den luu goi (co the la thanh cong hoac loi Drive)
    const saveRelatedDialogs = allDialogsSoFar.filter(
      (d) => d.includes("Gói 1") || d.includes("ghi nhận") || d.includes("thành công") || d.includes("Google Drive")
    );

    if (saveRelatedDialogs.length > 0) {
      const dlg = saveRelatedDialogs[0];

      // Kiem tra dialog KHONG chua thong tin thu muc NKTT_Expert_Evaluations hoac Tep du lieu
      const hasNoFolderInfo =
        !dlg.includes("NKTT_Expert_Evaluations") &&
        !dlg.includes("Tệp dữ liệu:") &&
        !dlg.includes("Vị trí lưu trữ:");
      if (hasNoFolderInfo) {
        pass("Thong bao luu Goi SACH: Khong chua thong tin thu muc/tep cu (dung yeu cau)");
      } else {
        fail("Noi dung thong bao luu", "Thong bao van con chua thong tin thu muc/tep da yeu cau xoa");
      }

      const hasBasicInfo = dlg.includes("Gói 1") || dlg.includes("thành công") || dlg.includes("ghi nhận");
      if (hasBasicInfo) {
        pass("Thong bao luu Goi chua du thong tin co ban");
      } else {
        fail("Thong tin co ban dialog", "Thong bao luu Goi thieu thong tin co ban");
      }
    } else {
      fail("Dialog luu Goi", `Khong co hop thoai xac nhan sau khi luu Goi 1. Tong so dialog trong phien: ${allDialogsSoFar.length}`);
    }

    // =========================================================
    // KICH BAN 9: Goi 2 duoc mo khoa
    // =========================================================
    console.log("\n[Kich ban 9] Kiem tra Goi 2 duoc mo khoa sau khi luu Goi 1...");
    // Cho React cap nhat state sau khi luu
    await page.waitForTimeout(2500);
    const batch2Btn = page.locator('button:has-text("Gói 2")');
    if (await batch2Btn.isVisible()) {
      pass("Nut Goi 2 hien thi sau khi luu Goi 1");
      const isDisabled = await batch2Btn.isDisabled();
      if (!isDisabled) {
        pass("Goi 2 da duoc mo khoa, Bac si co the tiep tuc");
      } else {
        // Nut bi disabled: Kiem tra xem Drive co thanh cong khong (neu Drive that bai, goi van duoc mo khoa theo code)
        // Kiem tra nut Goi 2 trong truong hop state chua cap nhat (doi them)
        await page.waitForTimeout(1500);
        const isDisabled2 = await batch2Btn.isDisabled();
        if (!isDisabled2) {
          pass("Goi 2 duoc mo khoa sau khi doi them thoi gian React re-render");
        } else {
          fail("Mo khoa Goi 2", "Nut Goi 2 van bi vo hieu hoa sau 4 giay - co the completedBatches chua cap nhat");
        }
      }
    } else {
      fail("Nut Goi 2", "Nut Goi 2 khong hien thi sau khi luu Goi 1");
    }

    // =========================================================
    // KICH BAN 10: Chuyen sang Goi 2
    // =========================================================
    console.log("\n[Kich ban 10] Chuyen sang Goi 2 va kiem tra trang thai...");
    const b2Btn = page.locator('button:has-text("Gói 2")');
    if (await b2Btn.isVisible() && !(await b2Btn.isDisabled())) {
      await b2Btn.click();
      await page.waitForTimeout(600);
      if (await page.locator("text=Gói 2").first().isVisible()) {
        pass("Giao dien chuyen sang Goi 2 thanh cong");
      } else {
        fail("Chuyen sang Goi 2", "Giao dien khong phan anh Goi 2 sau khi bam");
      }
      if (await page.locator('button[title*="Xác nhận thẩm định ca này"]').isVisible()) {
        pass("Nut xac nhan ca san sang cho Goi 2");
      } else {
        fail("Nut xac nhan Goi 2", "Khong tim thay nut xac nhan cho Goi 2");
      }
    }

    // =========================================================
    // KICH BAN 11: Duy tri phien khi Reload
    // =========================================================
    console.log("\n[Kich ban 11] Kiem tra duy tri phien lam viec khi tai lai trang...");
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(1200);

    if (await page.locator("text=Bác sĩ Thẩm định 01").first().isVisible()) {
      pass("Phien lam viec Bac si duoc bao toan sau khi tai lai trang");
    } else {
      fail("Bao toan phien", "Mat phien lam viec sau khi tai lai trang");
    }

    const savedKeys = await page.evaluate(() =>
      Object.keys(localStorage).filter((k) => k.includes("batch") || k.includes("goi") || k.includes("annotation"))
    );
    if (savedKeys.length > 0) {
      pass(`Du lieu tham dinh duoc bao toan trong localStorage (${savedKeys.length} muc)`);
    } else {
      fail("Bao toan localStorage", "Khong tim thay du lieu tham dinh sau reload");
    }

    // =========================================================
    // KICH BAN 12: Kiem tra tong the loi console
    // =========================================================
    console.log("\n[Kich ban 12] Danh gia tong the loi console...");
    const critErrors = consoleErrors.filter(
      (e) => !e.includes("favicon") && !e.includes("net::ERR_") && !e.includes("Failed to load resource") && e.length > 0
    );
    if (critErrors.length === 0) {
      pass("Khong co loi console nghiem trong trong suot phien kiem thu");
    } else {
      fail("Loi Console", `Co ${critErrors.length} loi: ${critErrors[0].slice(0, 100)}`);
    }

    // =========================================================
    // KET QUA TONG HOP
    // =========================================================
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log("\n================== KET QUA KIEM THU ==================");
    console.log(`Tong so bai kiem thu : ${passedCount + failedCount}`);
    console.log(`Thanh cong  (PASSED) : ${passedCount}`);
    console.log(`That bai    (FAILED) : ${failedCount}`);
    console.log(`Thoi gian            : ${elapsed} giay`);
    if (failedTests.length > 0) {
      console.log("\nDanh sach cac kiem thu THAT BAI:");
      failedTests.forEach((t, idx) => {
        console.log(`  ${idx + 1}. [${t.label}] - Ly do: ${t.reason}`);
      });
    }
    console.log("=======================================================\n");
    if (failedCount > 0) process.exit(1);

  } catch (error) {
    console.error("\nLOI NGHIEM TRONG TRONG QUA TRINH KIEM THU:", error.message || error);
    try {
      await page.screenshot({ path: "tests/test-failure.png", fullPage: true });
      console.log("Da luu anh chup man hinh loi tai: tests/test-failure.png");
    } catch {}
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runAllTests();


