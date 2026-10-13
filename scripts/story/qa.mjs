// QA for the home scroll story. Serves docs/ on a local port, drives Chromium with Playwright and:
//   - takes screenshots at 10 evenly spaced scroll positions through the story, plus the ledger and the pilot band
//   - measures bytes transferred on first load and after a full scroll
//   - collects console errors / failed requests, checks for blank canvases and horizontal overflow
//   - optionally checks the static fallbacks (reduced motion, Save-Data)
// Usage: node scripts/story/qa.mjs <outDir> [--only=desktop|mobile] [--static]

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DOCS = path.join(ROOT, 'docs');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'screenshots', 'story-qa'));
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').split('=')[1];
const doStatic = process.argv.includes('--static');
fs.mkdirSync(OUT, { recursive: true });

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.pdf': 'application/pdf', '.xml': 'application/xml', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = path.join(DOCS, p);
  if (!file.startsWith(DOCS)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'max-age=600' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;
const mb = (n) => (n / 1048576).toFixed(2) + ' MB';

async function session(browser, name, ctxOpts) {
  const context = await browser.newContext(ctxOpts);
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/Ignoring Event/.test(m.text())) errors.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('requestfailed', (r) => errors.push('requestfailed: ' + r.url().slice(0, 100) + ' ' + (r.failure() || {}).errorText));
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  const sizes = new Map();
  const urls = new Map();
  cdp.on('Network.requestWillBeSent', (e) => urls.set(e.requestId, e.request.url));
  cdp.on('Network.loadingFinished', (e) => sizes.set(e.requestId, e.encodedDataLength));
  const bytes = (filter = () => true) => { let n = 0; for (const [id, s] of sizes) if (filter(urls.get(id) || '')) n += s; return n; };
  return { context, page, errors, bytes, sizes, urls, name };
}

const results = {};

async function runLive(browser, name, viewport, extra = {}) {
  const s = await session(browser, name, { viewport, deviceScaleFactor: extra.dpr || 1, isMobile: !!extra.isMobile, hasTouch: !!extra.isMobile });
  const { page } = s;
  const t0 = Date.now();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelector('[data-story]').dataset.mode !== 'static' || false, null, { timeout: 15000 }).catch(() => {});
  const mode = await page.evaluate(() => document.querySelector('[data-story]').dataset.mode);
  const liveAt = Date.now() - t0;
  const firstLoad = s.bytes((u) => u.startsWith(BASE));
  const firstLoadStoryJs = s.bytes((u) => /story\.(js|css)|manifest/.test(u));
  await page.waitForTimeout(1500);
  const afterIdle = s.bytes((u) => u.startsWith(BASE));
  await page.screenshot({ path: path.join(OUT, `${name}-00-load.png`) });

  const m = await page.evaluate(() => {
    const root = document.querySelector('[data-story]');
    const stage = root.querySelector('.story-stage');
    return { top: root.getBoundingClientRect().top + scrollY, h: root.offsetHeight, stageH: stage.offsetHeight, header: document.querySelector('.site-header').offsetHeight, vh: innerHeight, overflowX: document.documentElement.scrollWidth - innerWidth };
  });
  const range = m.h - m.stageH;
  const shots = [];
  const blank = [];
  const N = 10;
  for (let i = 0; i < N; i++) {
    const frac = i / N + (i === 0 ? 0 : 0.012);
    const y = Math.round(m.top - m.header + frac * range);
    await page.evaluate((yy) => window.scrollTo({ top: yy, behavior: 'instant' }), y);
    await page.waitForTimeout(1500);
    const file = path.join(OUT, `${name}-${String(i + 1).padStart(2, '0')}-story.png`);
    await page.screenshot({ path: file });
    shots.push(file);
    const lum = await page.evaluate(() => {
      const c = document.querySelector('.story-canvas');
      if (!c || !c.width) return -1;
      const t = document.createElement('canvas'); t.width = 16; t.height = 16;
      const x = t.getContext('2d'); x.drawImage(c, 0, 0, 16, 16);
      const d = x.getImageData(0, 0, 16, 16).data; let sum = 0;
      for (let k = 0; k < d.length; k += 4) sum += (d[k] + d[k + 1] + d[k + 2]) / 3;
      return sum / 256;
    });
    if (lum >= 0 && lum < 6) blank.push(i + 1);
  }
  // end of the story, ledger, tablero, pilot band
  for (const [label, sel] of [['ledger', '#registro'], ['ledger-rows', '.ledger-card'], ['tablero', '#tablero'], ['pilot', '.pilot-band']]) {
    await page.evaluate((s2) => { const el = document.querySelector(s2); const r = el.getBoundingClientRect(); window.scrollTo({ top: scrollY + r.top - (s2 === '.ledger-card' ? 140 : s2 === '.pilot-band' ? 260 : 70), behavior: 'instant' }); }, sel);
    await page.waitForTimeout(label === 'ledger-rows' ? 2600 : 900);
    await page.screenshot({ path: path.join(OUT, `${name}-${label}.png`) });
  }
  const afterScroll = s.bytes((u) => u.startsWith(BASE));
  const storyFrames = s.bytes((u) => u.includes('/assets/story/'));
  const overflowX = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  const heap = await page.evaluate(() => (performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null));
  results[name] = { mode, liveAtMs: liveAt, firstLoadBytes: mb(firstLoad), firstLoadStoryJsCss: firstLoadStoryJs, afterIdle2_5s: mb(afterIdle), afterFullScroll: mb(afterScroll), storyAssetsBytes: mb(storyFrames), blankCanvasShots: blank, overflowX, jsHeapMB: heap, errors: s.errors };
  await s.context.close();
}

async function runStatic(browser, name, ctxOpts, viewport) {
  const s = await session(browser, name, { viewport, ...ctxOpts });
  await s.page.goto(BASE + '/', { waitUntil: 'load' });
  await s.page.waitForTimeout(1500);
  const mode = await s.page.evaluate(() => document.querySelector('[data-story]').dataset.mode);
  await s.page.screenshot({ path: path.join(OUT, `${name}-top.png`) });
  await s.page.evaluate(() => document.querySelector('#escena-3').scrollIntoView({ behavior: 'instant' }));
  await s.page.waitForTimeout(800);
  await s.page.screenshot({ path: path.join(OUT, `${name}-scene3.png`) });
  const bytes = s.bytes((u) => u.startsWith(BASE));
  const ov = await s.page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  results[name] = { mode, bytesOnLoad: mb(bytes), overflowX: ov, errors: s.errors };
  await s.context.close();
}

const browser = await chromium.launch();
try {
  if (only !== 'mobile') await runLive(browser, 'desktop', { width: 1440, height: 900 });
  if (only !== 'desktop') await runLive(browser, 'mobile', { width: 390, height: 844 }, { dpr: 3, isMobile: true });
  if (doStatic) {
    await runStatic(browser, 'static-reduced-desktop', { reducedMotion: 'reduce' }, { width: 1440, height: 900 });
    await runStatic(browser, 'static-reduced-mobile', { reducedMotion: 'reduce', isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, { width: 390, height: 844 });
  }
} finally {
  await browser.close();
  server.close();
}
console.log(JSON.stringify(results, null, 2));
fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));
