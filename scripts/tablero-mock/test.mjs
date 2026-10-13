// End-to-end test of /demo-en-vivo/tablero/ against the mock API. Usage: node scripts/tablero-mock/test.mjs [shotsDir]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createMock, PIN } from './mock-server.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'docs');
const SHOTS = process.argv[2] || path.join(ROOT, '..', 'test-results', 'tablero');
fs.mkdirSync(SHOTS, { recursive: true });

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
const site = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => site.listen(0, '127.0.0.1', r));
const sitePort = site.address().port;
const mock = await createMock(0);
const URL_PAGE = `http://127.0.0.1:${sitePort}/demo-en-vivo/tablero/?api=http://127.0.0.1:${mock.port}`;

const browser = await chromium.launch();
let failures = 0;
const step = async (name, fn) => { try { await fn(); console.log('ok  ', name); } catch (e) { failures++; console.log('FAIL', name, '\n    ', e.message.split('\n')[0]); } };

async function open(viewport) {
  const ctx = await browser.newContext({ viewport, locale: 'es-MX' });
  const page = await ctx.newPage();
  const requests = [];
  page.on('request', (r) => requests.push({ url: r.url(), headers: r.headers(), method: r.method(), body: r.postData() }));
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(URL_PAGE);
  return { ctx, page, requests, errors };
}
const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, name + '.png') });
const text = (page, sel) => page.locator(sel).textContent().then((t) => t.replace(/\s+/g, ' ').trim());

for (const vp of [{ width: 1440, height: 900, tag: 'desktop-1440x900' }, { width: 1280, height: 800, tag: 'laptop-1280x800' }]) {
  const { ctx, page, requests, errors } = await open({ width: vp.width, height: vp.height });
  console.log(`--- ${vp.tag}`);

  await step('gate visible, noindex, no analytics script', async () => {
    assert.ok(await page.locator('#tb-gate').isVisible());
    assert.ok(await page.locator('#tb-app').isHidden());
    assert.equal(await page.locator('meta[name=robots]').getAttribute('content'), 'noindex, nofollow');
    assert.equal(await page.locator('script[src*=plausible]').count(), 0);
    await shot(page, `${vp.tag}-1-gate`);
  });

  await step('wrong PIN shows a clear error and clears the input', async () => {
    await page.fill('#tb-pin', 'WRONG123');
    await page.click('#tb-enter');
    await page.waitForFunction(() => /PIN incorrecto/.test(document.getElementById('tb-gate-error').textContent));
    assert.match(await text(page, '#tb-gate-error'), /PIN incorrecto/);
    assert.equal(await page.inputValue('#tb-pin'), '');
    await shot(page, `${vp.tag}-2-wrong-pin`);
  });

  await step('rate limited PIN shows the wait message', async () => {
    await page.fill('#tb-pin', 'RATE0000');
    await page.click('#tb-enter');
    await page.waitForFunction(() => /Demasiados intentos/.test(document.getElementById('tb-gate-error').textContent));
    assert.match(await text(page, '#tb-gate-error'), /Demasiados intentos/);
  });

  await step('correct PIN (typed lowercase with an O) opens the panel; banner shows the number', async () => {
    await page.fill('#tb-pin', PIN.toLowerCase());
    await page.click('#tb-enter');
    await page.waitForSelector('#tb-app:not([hidden])');
    await page.waitForFunction(() => document.getElementById('tb').dataset.conn === 'live');
    assert.match(await text(page, '#tb-conn'), /Conectado/i);
    assert.match(await text(page, '#tb-banner'), /Marque al\s+\+1 956 225 2738/);
    assert.ok(await page.locator('#tb-calls-empty').isVisible());
    await shot(page, `${vp.tag}-3-waiting`);
  });

  await step('the full call fills the panel as events arrive', async () => {
    await fetch(`http://127.0.0.1:${mock.port}/__play?gap=700`);
    await page.waitForSelector('.tb-call');
    assert.match(await text(page, '#tb-calls'), /\+52 •• •••• ••12/);
    await page.waitForFunction(() => document.querySelector('[data-f=nombre]').textContent === 'Mariana');
    await page.waitForFunction(() => document.querySelector('[data-f=presupuesto]').textContent.includes('cuatro y cinco'));
    await page.waitForFunction(() => document.querySelector('[data-f=visita_hora]').textContent === '11:00');
    await shot(page, `${vp.tag}-4-mid-call`);
    await page.waitForFunction(() => document.querySelector('[data-f=traspaso]').textContent.includes('enganche'));
    assert.equal(await page.locator('#tb-banner').getAttribute('data-mode'), 'live');
    await page.waitForFunction(() => document.getElementById('tb-banner').dataset.mode === 'ended', null, { timeout: 8000 });
    assert.match(await text(page, '#tb-state-chip'), /Terminada · 4 min 12 s/);
    assert.equal(await page.locator('#tb-ledger .tb-ledger-row').count(), 8);
    assert.match(await text(page, '#tb-questions'), /mascotas/);
    // newest first
    assert.match(await page.locator('#tb-ledger .tb-ledger-row').first().innerText(), /Llamada terminada/);
    assert.match(await page.locator('#tb-ledger .tb-ledger-row time').first().innerText(), /^\d\d:\d\d:\d\d$/);
    await shot(page, `${vp.tag}-5-ended`);
  });

  await step('a second live call gets its own card and is followed; clicking the old one switches', async () => {
    await fetch(`http://127.0.0.1:${mock.port}/__play2`);
    await page.waitForFunction(() => document.querySelectorAll('.tb-call').length === 2);
    await page.waitForFunction(() => document.querySelector('[data-f=nombre]').textContent === 'Luis');
    await page.waitForFunction(() => document.getElementById('tb-banner').dataset.mode === 'ended', null, { timeout: 8000 });
    await shot(page, `${vp.tag}-6-two-calls`);
    await page.locator('.tb-call').nth(1).locator('button').click();
    assert.equal(await text(page, '[data-f=nombre]'), 'Mariana');
  });

  await step('stream drop: reconnects, shows Reconectando, replays missed events', async () => {
    const ref = await page.locator('.tb-call').first().getAttribute('data-ref');
    await fetch(`http://127.0.0.1:${mock.port}/__kill`);
    await page.waitForFunction(() => document.getElementById('tb').dataset.conn !== 'live');
    mock.emit(ref, 'question', { pregunta: 'pregunta durante la caída' }, 'Pregunta por confirmar: pregunta durante la caída');
    await shot(page, `${vp.tag}-7-reconnecting`);
    await page.waitForFunction(() => document.getElementById('tb').dataset.conn === 'live', null, { timeout: 8000 });
    await page.locator('.tb-call').first().locator('button').click();
    await page.waitForFunction(() => document.getElementById('tb-ledger').textContent.includes('durante la caída'));
  });

  await step('server restart (epoch change) resyncs: calls disappear', async () => {
    await fetch(`http://127.0.0.1:${mock.port}/__restart`);
    await page.waitForFunction(() => document.querySelectorAll('.tb-call').length === 0, null, { timeout: 10000 });
    await page.waitForFunction(() => document.getElementById('tb').dataset.conn === 'live', null, { timeout: 8000 });
    assert.ok(await page.locator('#tb-calls-empty').isVisible());
  });

  await step('server down shows Sin conexión and a clear notice, then recovers', async () => {
    await fetch(`http://127.0.0.1:${mock.port}/__down`);
    await page.waitForFunction(() => document.getElementById('tb').dataset.conn === 'offline', null, { timeout: 20000 });
    assert.match(await text(page, '#tb-conn'), /Sin conexión/i);
    assert.ok(await page.locator('#tb-notice').isVisible());
    await shot(page, `${vp.tag}-8-offline`);
    await fetch(`http://127.0.0.1:${mock.port}/__up`);
    await page.waitForFunction(() => document.getElementById('tb').dataset.conn === 'live', null, { timeout: 15000 });
    assert.ok(await page.locator('#tb-notice').isHidden());
  });

  await step('auth_expired returns to the PIN gate', async () => {
    await fetch(`http://127.0.0.1:${mock.port}/__expire`);
    await page.waitForSelector('#tb-gate:not([hidden])', { timeout: 8000 });
    assert.match(await text(page, '#tb-gate-error'), /sesión expiró/);
  });

  await step('privacy: PIN only in the session POST body; nothing in URLs/storage; no plausible; no page errors', async () => {
    const withPin = requests.filter((r) => JSON.stringify(r).includes(PIN));
    assert.ok(withPin.every((r) => r.method === 'POST' && r.url.endsWith('/v1/demo/panel/session')), 'PIN leaked: ' + withPin.map((r) => r.url));
    assert.ok(!requests.some((r) => /plausible/.test(r.url)));
    assert.ok(!requests.some((r) => r.url.includes('token') || r.url.includes('Bearer')));
    const store = await page.evaluate(() => JSON.stringify({ l: { ...localStorage }, s: { ...sessionStorage }, c: document.cookie }));
    assert.ok(!store.includes(PIN) && !store.includes('ABCD2345'), 'PIN in storage');
    assert.equal(await page.evaluate(() => localStorage.length + document.cookie.length), 0);
    assert.deepEqual(errors.filter((e) => !/503|Failed to load resource|ERR_/.test(e)), []);
  });
  await ctx.close();
  mock.server.emit?.('x');
  await fetch(`http://127.0.0.1:${mock.port}/__restart`);
}

// Mobile smoke
{
  const { ctx, page } = await open({ width: 390, height: 844 });
  await step('mobile: gate renders and a call fits', async () => {
    await page.fill('#tb-pin', PIN);
    await page.click('#tb-enter');
    await page.waitForFunction(() => document.getElementById('tb').dataset.conn === 'live');
    await fetch(`http://127.0.0.1:${mock.port}/__play?gap=150`);
    await page.waitForFunction(() => document.getElementById('tb-banner').dataset.mode === 'ended', null, { timeout: 8000 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'horizontal overflow');
    await shot(page, 'mobile-390');
  });
  await ctx.close();
}

await browser.close();
mock.close();
site.close();
console.log(failures ? `\n${failures} FAILED` : '\nall passed');
process.exit(failures ? 1 : 0);
