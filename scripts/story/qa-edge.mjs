// Edge-case QA for the home scroll story: short phones, wide screens, Save-Data, slow network gate, rail + keyboard.
// Usage: node scripts/story/qa-edge.mjs <outDir>
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DOCS = path.join(ROOT, 'docs');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'screenshots', 'story-qa'));
fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = path.join(DOCS, p);
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!file.startsWith(DOCS) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const out = {};
const noise = (t) => /Ignoring Event/.test(t);

async function open(name, ctxOpts, init) {
  const context = await browser.newContext(ctxOpts);
  if (init) await context.addInitScript(init);
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !noise(m.text())) errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  return { context, page, errors, name };
}
const mode = (page) => page.evaluate(() => document.querySelector('[data-story]').dataset.mode);
async function goto(s, wait = 1500) { await s.page.goto(BASE + '/', { waitUntil: 'load' }); await s.page.waitForTimeout(wait); }
async function scrollFrac(page, frac) {
  await page.evaluate((f) => {
    const root = document.querySelector('[data-story]'); const st = root.querySelector('.story-stage');
    const top = root.getBoundingClientRect().top + scrollY; const hd = document.querySelector('.site-header').offsetHeight;
    scrollTo({ top: top - hd + f * (root.offsetHeight - st.offsetHeight), behavior: 'instant' });
  }, frac);
  await page.waitForTimeout(1400);
}

// 1. short phone 375x667
{
  const s = await open('short', { viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await goto(s);
  await s.page.screenshot({ path: path.join(OUT, 'short-phone-1-hero.png') });
  await scrollFrac(s.page, 0.25);
  await s.page.screenshot({ path: path.join(OUT, 'short-phone-2-voz.png') });
  await scrollFrac(s.page, 0.88);
  await s.page.screenshot({ path: path.join(OUT, 'short-phone-3-firma.png') });
  // does the copy fit inside the sheet? (bottom of the visible article vs the stage)
  out.shortPhone = await s.page.evaluate(() => {
    const st = document.querySelector('.story-stage').getBoundingClientRect();
    return [...document.querySelectorAll('.story-scene')].map((a) => { const r = a.querySelector('.story-copy').getBoundingClientRect(); return Math.round(r.bottom - st.bottom); });
  });
  out.shortPhoneMode = await mode(s.page); out.shortPhoneErrors = s.errors;
  await s.context.close();
}

// 2. wide + small laptop
for (const [n, w, h] of [['wide', 1920, 1080], ['laptop', 1280, 720]]) {
  const s = await open(n, { viewport: { width: w, height: h } });
  await goto(s);
  await s.page.screenshot({ path: path.join(OUT, `${n}-1-hero.png`) });
  await scrollFrac(s.page, 0.55);
  await s.page.screenshot({ path: path.join(OUT, `${n}-2-scene4.png`) });
  out[n] = { mode: await mode(s.page), overflowX: await s.page.evaluate(() => document.documentElement.scrollWidth - innerWidth), errors: s.errors };
  await s.context.close();
}

// 3. Save-Data and 3G: must stay static
for (const [n, conn] of [['savedata', '{saveData:true}'], ['3g', '{effectiveType:"3g"}']]) {
  const s = await open(n, { viewport: { width: 1440, height: 900 } }, `Object.defineProperty(navigator,'connection',{get:()=>(${conn})})`);
  await goto(s, 1200);
  await s.page.screenshot({ path: path.join(OUT, `${n}-1-top.png`) });
  out[n] = { mode: await mode(s.page), liveClass: await s.page.evaluate(() => document.querySelector('[data-story]').classList.contains('story--live')), canvasVisible: await s.page.evaluate(() => getComputedStyle(document.querySelector('.story-canvas')).display), errors: s.errors };
  await s.context.close();
}

// 3b. a fast network Chrome estimates as slow (4g, downlink 3.4): must go live, the frame gate decides
{
  const s = await open('lowestimate', { viewport: { width: 1440, height: 900 } }, `Object.defineProperty(navigator,'connection',{get:()=>({effectiveType:'4g',downlink:3.4})})`);
  await goto(s, 2500);
  out.lowestimate = { mode: await mode(s.page), errors: s.errors };
  await s.context.close();
}

// 4. slow network: the gate (24 frames in 6 s) must fail and leave the static page
{
  const s = await open('slow', { viewport: { width: 1440, height: 900 } }, `Object.defineProperty(navigator,'connection',{get:()=>({effectiveType:'4g'})})`);
  const cdp = await s.context.newCDPSession(s.page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 300, downloadThroughput: 60 * 1024, uploadThroughput: 60 * 1024 });
  await s.page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await s.page.waitForFunction(() => /^static:/.test(document.querySelector('[data-story]').dataset.mode) && document.querySelector('[data-story]').dataset.mode !== 'static', null, { timeout: 30000 }).catch(() => {});
  out.slow = { mode: await mode(s.page), errors: s.errors };
  await s.page.screenshot({ path: path.join(OUT, 'slow-1-top.png') });
  await s.context.close();
}

// 5. rail click + keyboard
{
  const s = await open('kbd', { viewport: { width: 1440, height: 900 } });
  await goto(s);
  const fresh = await open('tab', { viewport: { width: 1440, height: 900 } });
  await goto(fresh);
  const tabs0 = [];
  for (let i = 0; i < 12; i++) { await fresh.page.keyboard.press('Tab'); tabs0.push(await fresh.page.evaluate(() => { const a = document.activeElement; return a ? (a.getAttribute('aria-label') || a.textContent || a.tagName).trim().slice(0, 32) : null; })); }
  out.tabFromTop = tabs0;
  await fresh.context.close();
  await s.page.click('.story-rail a[data-i="3"]');
  await s.page.waitForTimeout(2600);
  out.rail = await s.page.evaluate(() => ({ current: document.querySelector('.story-rail a[aria-current]')?.dataset.i, scrollY: Math.round(scrollY) }));
  await s.page.screenshot({ path: path.join(OUT, 'rail-click-scene4.png') });
  await scrollFrac(s.page, 0.02);
  // keyboard: Tab through the first stop
  await s.page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await s.page.waitForTimeout(800);
  const tabs = [];
  for (let i = 0; i < 6; i++) { await s.page.keyboard.press('Tab'); tabs.push(await s.page.evaluate(() => { const a = document.activeElement; return a ? (a.textContent || a.getAttribute('aria-label') || a.tagName).trim().slice(0, 40) : null; })); }
  out.tabOrder = tabs;
  await s.page.screenshot({ path: path.join(OUT, 'kbd-focus.png') });
  // after the hero fades, its CTAs must not be focusable/visible
  await scrollFrac(s.page, 0.1);
  out.heroCtaVisibility = await s.page.evaluate(() => getComputedStyle(document.querySelector('.story-hero .btn')).visibility);
  // last-scene link visible only at its scene
  await scrollFrac(s.page, 0.93);
  out.moreLinkVisibility = await s.page.evaluate(() => getComputedStyle(document.querySelector('.story-more a')).visibility);
  out.errors = s.errors;
  await s.context.close();
}

await browser.close();
server.close();
console.log(JSON.stringify(out, null, 2));
