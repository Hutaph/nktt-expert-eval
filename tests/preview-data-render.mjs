// Checks the static preview in an isolated browser; no requests reach Drive.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
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
      const pills = page.getByTestId('session-tab');
      assert.equal(await pills.count(), 3, row.user_id + ': session tabs');
      if (index === 0 && sessionIndex === 0) {
        await pills.last().evaluate(el => el.click());
        await page.getByTestId('session-heading').filter({ hasText: 'Lần hỏi 3' }).waitFor();
        await pills.first().evaluate(el => el.click());
      }
      if (sessionIndex) await pills.nth(sessionIndex).evaluate(el => el.click());
      const heading = page.getByTestId('session-heading');
      await heading.filter({ hasText: `Lần hỏi ${session.session_number}` }).waitFor();
      await page.waitForFunction(text => document.querySelector('[data-testid="turn-text"]')?.textContent === text, session.turns[0].text);
      assert.ok((await heading.innerText()).includes(`${session.turns.length / 2} cặp hỏi–đáp`), session.session_id + ': pair count');
      const text = await page.getByTestId('turn-text').allTextContents();
      assert.deepEqual(text, session.turns.map(t => t.text), session.session_id + ': dialogue content');
      const accepts = page.getByRole('button', { name: /Accept$/ });
      const rejects = page.getByRole('button', { name: /Reject$/ });
      assert.equal(await accepts.count(), session.turns.length, session.session_id + ': accept buttons');
      assert.equal(await rejects.count(), session.turns.length, session.session_id + ': reject buttons');
      // Reject is a decision only; it must not open an editor or prevent browsing.
      await rejects.first().evaluate(el => el.click());
      assert.equal(await rejects.first().getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator('textarea').count(), 0);
      await accepts.evaluateAll(elements => elements.forEach(el => el.click()));
      await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="review-turn"] button')].filter(el => el.textContent.includes('Accept')).every(el => el.getAttribute('aria-pressed') === 'true'));
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

  if (!process.env.PREVIEW_TEST_ORIGIN) {
    // All login, claim and save traffic stays inside this disposable mock context.
    const reviewContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    let failSave = true;
    const savedPayloads = [];
    await reviewContext.route('**/*', async route => {
      const request = route.request();
      if (new URL(request.url()).origin === origin) {
        assert.equal(request.method(), 'GET');
        await route.continue();
        return;
      }
      let body = {};
      if (request.postData()) body = JSON.parse(request.postData());
      if (body.action === 'save_file') {
        savedPayloads.push(JSON.parse(body.content));
        await route.fulfill({ json: failSave ? { status: 'error', message: 'Mock save failure' } : { status: 'success' } });
      } else if (body.action === 'get_file') {
        await route.fulfill({ json: { status: 'error', message: 'Not found' } });
      } else {
        await route.fulfill({ json: { status: 'success', registry: {}, batches: [], summary: {} } });
      }
    });
    const review = await reviewContext.newPage();
    const unexpected = [];
    review.on('pageerror', error => unexpected.push(error.message));
    review.on('dialog', async dialog => {
      if (!dialog.message().includes('Mock save failure') && dialog.type() !== 'beforeunload') unexpected.push(dialog.message());
      await dialog.accept();
    });
    await review.goto(origin + '/nktt-expert-eval/label-data/', { waitUntil: 'networkidle' });
    await review.getByLabel('Tên bác sĩ', { exact: true }).fill('Bác sĩ kiểm tra giao diện');
    await review.getByRole('button', { name: 'Bắt đầu duyệt', exact: true }).click();
    await review.getByRole('dialog').waitFor({ state: 'hidden' });
    await review.getByRole('button', { name: /Reject$/ }).first().click();
    await review.getByTestId('session-tab').last().click();
    await review.getByTestId('session-heading').filter({ hasText: 'Lần hỏi 3' }).waitFor();
    await review.getByTestId('session-tab').first().click();
    assert.equal(await review.getByRole('button', { name: /Reject$/ }).first().getAttribute('aria-pressed'), 'true');
    assert.equal(await review.locator('textarea').count(), 0);
    await review.waitForFunction(() => Object.entries(localStorage).some(([key, value]) => key.startsWith('nktt_sample_draft_') && value.includes('"x"')));
    await review.reload({ waitUntil: 'networkidle' });
    await review.waitForFunction(() => document.querySelector('[data-testid="review-turn"] button:last-child')?.getAttribute('aria-pressed') === 'true');
    await review.screenshot({ path: path.join(os.tmpdir(), 'nktt-simple-review-desktop.png') });
    await review.setViewportSize({ width: 390, height: 844 });
    assert.equal(await review.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Mobile horizontal overflow');
    assert.equal(await review.getByTestId('session-tab').count(), 3);
    await review.screenshot({ path: path.join(os.tmpdir(), 'nktt-simple-review-mobile.png') });
    await review.setViewportSize({ width: 1440, height: 1000 });
    for (let i = 0; i < 3; i++) {
      await review.getByTestId('session-tab').nth(i).click();
      await review.getByTestId('session-heading').filter({ hasText: `Lần hỏi ${i + 1}` }).waitFor();
      await review.getByRole('button', { name: /Accept$/ }).evaluateAll(elements => elements.forEach(el => {
        if (el.getAttribute('aria-pressed') !== 'true') el.click();
      }));
      if (i === 0) await review.getByRole('button', { name: /Reject$/ }).first().click();
    }
    const save = review.getByRole('button', { name: 'Lưu và tiếp', exact: true });
    await save.click();
    await review.getByRole('alert').filter({ hasText: 'Mock save failure' }).waitFor();
    assert.equal(await review.getByLabel('Chọn người', { exact: true }).inputValue(), '1');
    failSave = false;
    await save.click();
    await review.waitForFunction(() => document.querySelector('select[aria-label="Chọn người"]')?.value === '2');
    assert.equal(savedPayloads.length, 2);
    const payload = savedPayloads[1];
    assert.equal(payload.total_sessions, 3);
    assert.equal(payload.sessions.length, 3);
    assert.equal(payload.total_turns, rows[0].sessions.slice(0, 3).reduce((sum, session) => sum + session.turns.length, 0));
    assert.equal(payload.sessions[0].turns[0].evaluation, 'x');
    assert.deepEqual(payload.sessions.flatMap(session => session.turns.map(turn => turn.turn_id)), rows[0].sessions.slice(0, 3).flatMap(session => session.turns.map(turn => turn.turn_id)));
    assert.deepEqual(unexpected, []);
    console.log('Simple review: login, Reject, free navigation, draft reload, mobile layout, failed save and 3-session save payload passed (all external requests mocked).');
    await reviewContext.close();
  }
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
