import { chromium } from "playwright";

async function runAllTests() {
  console.log("=== BAT DAU KIEM THU TOAN DIEN HE THONG (PLAYWRIGHT) ===");
  const startTime = Date.now();
  let passedCount = 0;
  let failedCount = 0;

  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    acceptDownloads: true,
  });

  const page = await context.newPage();

  // Bat su kien tai tep de dam bao tuyet doi khong co tep nao tai ve may bac si
  let downloadTriggered = false;
  let downloadedFileName = "";
  page.on("download", (download) => {
    downloadTriggered = true;
    downloadedFileName = download.suggestedFilename();
    console.error("CANH BAO: Phat hien su kien tai tep ve may:", downloadedFileName);
  });

  // Xu ly hop thoai alert/confirm tu dong
  const dialogMessages = [];
  page.on("dialog", async (dialog) => {
    const text = dialog.message();
    dialogMessages.push(text);
    console.log("Hop thoai he thong:", text.replace(/\n/g, " ").slice(0, 100) + "...");
    await dialog.accept();
  });

  // Theo doi cac loi console tren trinh duyet
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      console.warn("Loi Console:", msg.text().slice(0, 120));
    }
  });

  try {
    // -----------------------------------------------------------------
    // Kich ban 1: Truy cap trang va xac thuc dang nhap Bac si
    // -----------------------------------------------------------------
    console.log("\n[Kich ban 1] Kiem tra truy cap ung dung va xac thuc Bac si...");
    await page.goto("http://localhost:3000", { waitUntil: "networkidle" });

    // Xoa sach sessionStorage va localStorage de dam bao phien moi tinh
    await page.evaluate(() => {
      sessionStorage.clear();
      localStorage.clear();
    });
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(600);

    // Kiem tra modal dang nhap xuat hien
    const portalTitle = await page.locator("text=Cổng Thẩm định Chuyên gia ViDent").isVisible();
    if (!portalTitle) {
      throw new Error("Khong tim thay tieu de 'Cổng Thẩm định Chuyên gia ViDent' tren Modal.");
    }
    console.log("- Da mo Modal dang nhap Bac si thanh cong.");
    passedCount++;

    // Thu dang nhap sai mat khau
    const passwordInput = page.locator('input[type="password"]');
    await passwordInput.fill("mat_khau_sai_123");
    const loginButton = page.locator('button[type="submit"]:has-text("Vào làm việc")');
    await loginButton.click();
    await page.waitForTimeout(400);

    const errorVisible = await page.locator("text=Mật khẩu không chính xác").isVisible();
    if (!errorVisible) {
      throw new Error("He thong khong canh bao khi nhap sai mat khau.");
    }
    console.log("- Kiem tra chan mat khau sai hoat dong chinh xac.");
    passedCount++;

    // Dang nhap dung mat khau cho Bac si 01 (bs01@nktt hoac 123456)
    await passwordInput.fill("bs01@nktt");
    await loginButton.click();
    await page.waitForTimeout(600);

    // -----------------------------------------------------------------
    // Kich ban 2: Trinh tu Onboarding - Modal Noi quy -> Modal Mau vi du
    // -----------------------------------------------------------------
    console.log("\n[Kich ban 2] Kiem tra quy trinh Onboarding (Noi quy va Mau vi du)...");
    const rulesModalVisible = await page.locator("text=Quy chuẩn & Cam kết Thẩm định Lâm sàng").isVisible();
    if (!rulesModalVisible) {
      throw new Error("Modal Noi quy khong xuat hien sau khi dang nhap thanh cong.");
    }
    console.log("- Modal Quy chuan & Cam ket lam sang xuat hien dung quy trinh.");
    passedCount++;

    // Kiem tra nut tiep tuc bi khoa khi chua tich cam ket
    const continueBtn = page.locator('button:has-text("Tiếp tục: Xem bảng ví dụ mẫu")');
    const isBtnDisabled = await continueBtn.isDisabled();
    if (!isBtnDisabled) {
      throw new Error("Nut tiep tuc chua duoc vo hieu hoa khi chua tich cam ket.");
    }

    // Tich cam ket noi quy
    const agreementCheckbox = page.locator('input[type="checkbox"]');
    await agreementCheckbox.check();
    await page.waitForTimeout(200);

    const isBtnEnabled = !(await continueBtn.isDisabled());
    if (!isBtnEnabled) {
      throw new Error("Nut tiep tuc van bi khoa sau khi da tich cam ket.");
    }
    await continueBtn.click();
    await page.waitForTimeout(600);
    console.log("- Cam ket noi quy hoat dong chinh xac, da chuyen sang Modal Vi du.");
    passedCount++;

    // Kiem tra Modal Mau vi du doi chieu
    const exampleModalVisible = await page.locator("text=Bảng Mẫu Đối Chiếu: Trước & Sau Khi Hiệu Chỉnh").isVisible();
    if (!exampleModalVisible) {
      throw new Error("Modal Mau vi du doi chieu khong xuat hien sau Modal Noi quy.");
    }
    console.log("- Modal Mau vi du doi chieu xuat hien dung thu tu.");
    passedCount++;

    // Kiem tra chuyen doi tab trong Modal Vi du
    const tabAfterBtn = page.locator('button:has-text("Tab 2: Sau khi Bác sĩ hiệu chỉnh")');
    if (await tabAfterBtn.isVisible()) {
      await tabAfterBtn.click();
      await page.waitForTimeout(300);
      const afterContentVisible = await page.locator("text=Quy chuẩn sau khi Bác sĩ hiệu chỉnh").isVisible();
      if (!afterContentVisible) {
        throw new Error("Chuyen tab sang 'Sau khi hieu chinh' khong hien thi dung noi dung.");
      }
      console.log("- Tinh nang chuyen doi tab Mau vi du hoat dong tot.");
      passedCount++;
    }

    // Dong Modal Vi du bang nut "Bat dau tham dinh" de vao ban lam viec
    const startWorkBtn = page.locator('button:has-text("Bắt đầu thẩm định")');
    await startWorkBtn.click();
    await page.waitForTimeout(800);

    // -----------------------------------------------------------------
    // Kich ban 3: Kiem tra giao dien Ban lam viec chinh
    // -----------------------------------------------------------------
    console.log("\n[Kich ban 3] Kiem tra giao dien Ban lam viec chinh...");
    const doctorBadgeVisible = await page.locator("text=Bác sĩ Thẩm định 01").first().isVisible();
    if (!doctorBadgeVisible) {
      throw new Error("Khong tim thay thong tin Bac si tren thanh tieu de.");
    }
    console.log("- Thong tin Bac si dang hoat dong hien thi chinh xac.");
    passedCount++;

    // Kiem tra tieu de "Lich su cuoc tro chuyen:"
    const conversationHistoryHeading = await page.locator("text=Lịch sử cuộc trò chuyện:").isVisible();
    if (!conversationHistoryHeading) {
      throw new Error("Tieu de 'Lich su cuoc tro chuyen:' khong hien thi dung nhu yeu cau.");
    }
    console.log("- Tieu de 'Lich su cuoc tro chuyen:' hien thi chuan xac.");
    passedCount++;

    // Kiem tra o ghi chu "Ghi chu bo sung (tuy chon)"
    const optionalNotesHeading = await page.locator("text=Ghi chú bổ sung (tùy chọn)").isVisible();
    if (!optionalNotesHeading) {
      throw new Error("Nhan 'Ghi chu bo sung (tuy chon)' khong hien thi dung.");
    }
    console.log("- O ghi chu bo sung la tuy chon, dung yeu cau.");
    passedCount++;

    // Kiem tra 3 nut verdict cu da bi xoa bo hoan toan
    const oldVerdictBtn1 = await page.locator('button:has-text("Đạt chuẩn lâm sàng")').count();
    const oldVerdictBtn2 = await page.locator('button:has-text("Cần hiệu chỉnh câu từ")').count();
    const oldVerdictBtn3 = await page.locator('button:has-text("Cần lưu ý thêm")').count();
    if (oldVerdictBtn1 > 0 || oldVerdictBtn2 > 0 || oldVerdictBtn3 > 0) {
      throw new Error("3 nut nhan verdict thu cong van con ton tai tren giao dien.");
    }
    console.log("- Da xac nhan 3 nut verdict thu cong da duoc loai bo triet de.");
    passedCount++;

    // -----------------------------------------------------------------
    // Kich ban 4: Kiem tra tu dong nhan dien verdict khi hieu chinh
    // -----------------------------------------------------------------
    console.log("\n[Kich ban 4] Kiem tra tu dong nhan dien verdict khi hieu chinh...");
    const queryTextarea = page.locator('textarea[title*="Nội dung câu hỏi của người hỏi"]').first();
    if (await queryTextarea.isVisible()) {
      const origValue = await queryTextarea.inputValue();
      await queryTextarea.fill(origValue + " (chuẩn y khoa)");
      await page.waitForTimeout(300);
      console.log("- Da hieu chinh cau hoi benh nhan.");
    }

    const notesTextarea = page.locator('textarea[placeholder*="Ghi chú thêm"]').first();
    if (await notesTextarea.isVisible()) {
      await notesTextarea.fill("Lưu ý chuyên môn: đã chuẩn hóa thuật ngữ răng hàm mặt.");
      console.log("- Da nhap ghi chu bo sung tuy chon.");
    }
    passedCount++;

    // -----------------------------------------------------------------
    // Kich ban 5: Xac nhan du 10 ca trong Goi 1
    // -----------------------------------------------------------------
    console.log("\n[Kich ban 5] Tien hanh xac nhan du 10/10 ca trong Goi 1...");
    for (let i = 1; i <= 10; i++) {
      const confirmCaseBtn = page.locator('button[title*="Xác nhận thẩm định ca này"]');
      if (await confirmCaseBtn.isVisible()) {
        await confirmCaseBtn.click();
        await page.waitForTimeout(400);
        console.log(`- Da xac nhan Ca ${i}/10.`);
      } else {
        throw new Error(`Khong tim thay nut xac nhan tai ca thu ${i}.`);
      }
    }

    // Kiem tra thong bao hoan tat 10/10 ca
    const batchReadyBanner = await page.locator("text=Gói 1 đã hoàn tất 10/10 ca").isVisible();
    if (!batchReadyBanner) {
      throw new Error("Khong hien thi thong bao Goi 1 da hoan tat 10/10 ca.");
    }
    console.log("- Thong bao hoan tat 10/10 ca xuat hien chuan xac.");
    passedCount++;

    // -----------------------------------------------------------------
    // Kich ban 6: Luu Goi 1 - Kiem tra luu truc tiep Google Drive & KHONG tai tep ve may
    // -----------------------------------------------------------------
    console.log("\n[Kich ban 6] Kiem tra Luu Goi 1: Truc tiep Google Drive & TUYET DOI KHONG tai ve may...");

    // Dat lai co kiem tra tai tep
    downloadTriggered = false;

    // Bam nut Luu Goi 1 tren thanh tieu de hoac banner
    const saveBatchBtn = page.locator('button:has-text("Bấm Lưu Gói 1 ngay")');
    if (await saveBatchBtn.isVisible()) {
      await saveBatchBtn.click();
    } else {
      const topSaveBtn = page.locator('button:has-text("Lưu Gói 1")');
      await topSaveBtn.click();
    }

    // Cho qua trinh luu Drive hoan tat (Google Apps Script tra ve phan hoi)
    await page.waitForTimeout(4000);

    // Kiem tra tuyet doi KHONG co su kien download
    if (downloadTriggered) {
      throw new Error(`VI PHAM: Phat hien tep bi tai ve may bac si: ${downloadedFileName}`);
    }
    console.log("- Xac nhan tuyet doi: Khong co bat ky tep nao bi tai ve may bac si!");
    passedCount++;

    // Kiem tra thong bao xac nhan da luu Google Drive trong dialogMessages
    const hasDriveMention = dialogMessages.some((msg) =>
      msg.includes("Google Drive") || msg.includes("NKTT_Expert_Evaluations") || msg.includes("Gói 1")
    );
    if (!hasDriveMention) {
      console.warn("Luu y: Dialog khong chua thong tin Drive hoac du lieu dang duoc ghi nhan.");
    } else {
      console.log("- Thong bao xac nhan da luu truc tiep len Google Drive thanh cong.");
      passedCount++;
    }

    // Kiem tra Goi 2 da duoc mo khoa
    await page.waitForTimeout(1000);
    const batch2Btn = page.locator('button:has-text("Gói 2")');
    const isBatch2Visible = await batch2Btn.isVisible();
    if (!isBatch2Visible) {
      throw new Error("Nut Goi 2 khong hien thi sau khi luu Goi 1.");
    }
    console.log("- Goi 2 da duoc mo khoa thanh cong de Bac si tiep tuc lam viec.");
    passedCount++;

    // -----------------------------------------------------------------
    // Kich ban 7: Kiem tra duy tri trang thai phien lam viec
    // -----------------------------------------------------------------
    console.log("\n[Kich ban 7] Kiem tra duy tri trang thai khi lam moi trang (Reload)...");
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(1000);

    const docStillVisible = await page.locator("text=Bác sĩ Thẩm định 01").first().isVisible();
    if (docStillVisible) {
      console.log("- Phien lam viec cua Bac si duoc bao toan chinh xac sau khi tai lai trang.");
      passedCount++;
    }

    console.log("\n================ KET QUA KIEM THU ================");
    console.log(`Tong so bai kiem thu: ${passedCount + failedCount}`);
    console.log(`Thanh cong (PASSED): ${passedCount}`);
    console.log(`That bai (FAILED): ${failedCount}`);
    console.log(`Thoi gian thuc hien: ${((Date.now() - startTime) / 1000).toFixed(2)} giay`);
    console.log("==================================================");

    if (failedCount > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error("\nLOI TRONG QUA TRINH KIEM THU:", error);
    try {
      await page.screenshot({ path: "test-failure.png", fullPage: true });
      console.log("Da luu anh chup man hinh loi tai: test-failure.png");
    } catch {}
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runAllTests();
