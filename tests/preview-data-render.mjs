// Checks the static preview in an isolated browser; no requests reach Drive.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rows = (await fs.readFile(path.join(root, 'public/dataset/vident_longmem_500/timelines.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
const metadata = JSON.parse(await fs.readFile(path.join(root, 'public/dataset/vident_longmem_500/metadata.json'), 'utf8'));
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jsonl': 'application/x-ndjson', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const server = http.createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname.replace(/^\/nktt-expert-eval(?=\/|$)/, '');
  const out = path.join(root, 'out');
  let filename = path.resolve(out, '.' + pathname);
  if (!filename.startsWith(out + path.sep) && filename !== out) { res.writeHead(403).end(); return; }
  if (pathname.endsWith('/')) filename = path.join(filename, 'index.html');
  try {
    const content = await fs.readFile(filename);
    res.writeHead(200, { 'Content-Type': mime[path.extname(filename)] || 'application/octet-stream' }).end(content);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = process.env.PREVIEW_TEST_ORIGIN || `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  const timelineUrls = [];
  let externalRequests = 0;
  await context.route('**/*', async route => {
    const request = route.request();
    if (new URL(request.url()).origin === origin) {
      assert.equal(request.method(), 'GET', 'Render check must not submit data');
      if (request.url().includes('/timelines.jsonl')) timelineUrls.push(request.url());
      await route.continue();
    } else {
      externalRequests++;
      assert.equal(request.method(), 'GET', 'Render check unexpectedly tried to write externally');
      await route.fulfill({ json: { status: 'success', registry: {}, batches: [], summary: {} } });
    }
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', async dialog => { errors.push(dialog.message()); await dialog.dismiss(); });
  await page.goto(origin + '/nktt-expert-eval/label-data/', { waitUntil: 'networkidle' });
  const select = page.locator('select[title^="Chọn mẫu bệnh nhân"]');
  await select.locator('option').last().waitFor({ state: 'attached' });
  assert.equal(await select.locator('option').count(), 100);
  assert.equal(await page.evaluate(() => sessionStorage.getItem('nktt_active_doctor_session')), null);
  let sessions = 0, turns = 0;
  for (const [index, row] of rows.entries()) {
    await select.selectOption(String(index + 1));
    for (const [sessionIndex, session] of row.sessions.slice(0, 3).entries()) {
      const pills = page.locator('button[class*="sessionPill"]');
      assert.equal(await pills.count(), 3, row.user_id + ': session tabs');
      if (sessionIndex) await pills.nth(sessionIndex).evaluate(el => el.click());
      const heading = page.locator('[class*="sessionChatHeader"]');
      await heading.filter({ hasText: `Chi tiết Lần hỏi ${session.session_number}` }).waitFor();
      await page.waitForFunction(text => document.querySelector('p[class*="bubbleTextReadonly"]')?.textContent === text, session.turns[0].text);
      assert.ok((await heading.innerText()).includes(`${session.turns.length / 2} cặp hỏi–đáp`), session.session_id + ': pair count');
      const text = await page.locator('p[class*="bubbleTextReadonly"]').allTextContents();
      assert.deepEqual(text, session.turns.map(t => t.text), session.session_id + ': dialogue content');
      const accepts = page.locator('button[title="v: Chuẩn rồi - Đạt chuẩn lâm sàng"]');
      const rejects = page.locator('button[title="x: Chưa chuẩn - Bấm để mở ô sửa text"]');
      assert.equal(await accepts.count(), session.turns.length, session.session_id + ': accept buttons');
      assert.equal(await rejects.count(), session.turns.length, session.session_id + ': reject buttons');
      // This changes only disposable browser state, without a doctor session or save.
      await accepts.evaluateAll(elements => elements.forEach(el => el.click()));
      await page.waitForFunction(() => !document.querySelector('button[title="v: Chuẩn rồi - Đạt chuẩn lâm sàng"]'));
      sessions++; turns += text.length;
    }
    if ((index + 1) % 20 === 0) console.log(`Checked ${index + 1}/100 profiles`);
  }
  assert.equal(sessions, 300);
  assert.equal(turns, 1410);
  assert.deepEqual(errors, [], 'Browser errors or unexpected navigation warnings');
  assert.ok(timelineUrls.length > 0);
  for (const url of timelineUrls) assert.equal(new URL(url).searchParams.get('v'), metadata.version);
  console.log(JSON.stringify({ profiles: rows.length, sessions, renderedTurns: turns, cacheVersion: metadata.version, externalRequestsIntercepted: externalRequests, submittedReviews: 0, pageErrors: errors.length }));
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
