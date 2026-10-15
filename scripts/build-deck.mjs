// Build the pitch deck pages and PDFs from src/deck/<lang>/ (the files of the claude.ai Slides decks, copied here
// WITHOUT speaker notes: this repo is public; the full decks with notes live in innmobi-internal/deck/).
//   src/deck/<lang>/deck.json + slides/<id>.html  ->  docs/deck/<lang>/index.html  (web viewer, noindex)
//                                                 ->  docs/deck/innmobi-pitch-deck-<lang>.pdf  (one 1920x1080 page per slide)
// The slides use the Slides format (inline styles on a 1920x1080 canvas). This script:
//   - drops the speaker notes (<aside>): the public version carries the slides only;
//   - maps the decks' uploaded images (/_blob/<id>) to site files;
//   - replaces <x-icon> with inline SVG line icons.
// Run after build:site:  node scripts/build-deck.mjs

import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src', 'deck');
const OUT = path.join(ROOT, 'docs', 'deck');

// Uploaded images of each deck -> files of the site (paths relative to docs/deck/<lang>/).
const BLOBS = {
  '22677a7e629038b2f356f57b4cb256cf': '../../assets/images/innmobi-lockup-reversed.svg',
  '9019cff4ba760185338cc443e40b2730': '../../assets/images/innmobi-lockup-reversed.svg',
  '4ee380f5e4169655876ddb2c585d26e6': '../../assets/deck/tablero-demo.jpg',
  'dc8833447357eefe226a79f3fd50ff27': '../../assets/deck/tablero-demo.jpg',
};

// Line icons, 24x24, drawn with the current color.
const ICONS = {
  Chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
  Search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  CheckCircle: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  Verified: '<path d="M12 3 4 6v6c0 4.5 3.4 8.1 8 9 4.6-.9 8-4.5 8-9V6l-8-3z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  Clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  Warning: '<path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
};

const TEXT = {
  es: {
    lang: 'es-MX', other: 'en', otherLabel: 'English', title: 'Pitch deck · innmobi.ai',
    kicker: 'Pitch deck · Pre-seed · Octubre 2026', pdf: 'Descargar PDF', present: 'Presentar',
    hint: 'Clic en una lámina para verla en pantalla completa; flechas para avanzar, Esc para salir.',
    contact: 'Contacto', description: 'Pitch deck pre-seed de innmobi.ai.',
  },
  en: {
    lang: 'en', other: 'es', otherLabel: 'Español', title: 'Pitch deck · innmobi.ai',
    kicker: 'Pitch deck · Pre-seed · October 2026', pdf: 'Download PDF', present: 'Present',
    hint: 'Click a slide to view it full screen; arrow keys to move, Esc to exit.',
    contact: 'Contact', description: 'innmobi.ai pre-seed pitch deck.',
  },
};

function icon(name, style) {
  const body = ICONS[name];
  if (!body) throw new Error(`no icon for x-icon "${name}"`);
  const size = (style.match(/width:\s*(\d+)px/) || [])[1] || '48';
  const color = (style.match(/color:\s*(#[0-9A-Fa-f]{3,8})/) || [])[1] || 'currentColor';
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none">${body}</svg>`;
}

function slideHtml(raw, id) {
  let html = raw.replace(/<aside>[\s\S]*?<\/aside>\s*/g, '');
  html = html.replace(/<x-icon name="(\w+)" style="([^"]*)"><\/x-icon>/g, (_, name, style) => icon(name, style));
  html = html.replace(/\/_blob\/([0-9a-f]{32})/g, (_, blob) => {
    if (!BLOBS[blob]) throw new Error(`slide ${id}: unknown image ${blob}`);
    return BLOBS[blob];
  });
  if (/x-icon|\/_blob\/|<aside/.test(html)) throw new Error(`slide ${id}: something was not converted`);
  return html.trim();
}

function page(lang, deck, slides) {
  const t = TEXT[lang];
  const fonts = Object.values(deck.faces).map((f) => `<link rel="stylesheet" href="${f.href}">`).join('\n');
  const frames = slides
    .map((s, i) => `<div class="frame" tabindex="0" role="button" aria-label="${i + 1} / ${slides.length}"><div class="canvas">${s}</div></div>`)
    .join('\n');
  return `<!doctype html>
<html lang="${t.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${t.title}</title>
<meta name="description" content="${t.description}">
<meta name="robots" content="noindex, nofollow">
<meta name="referrer" content="no-referrer">
<link rel="icon" href="../../favicon.ico">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
${fonts}
<style>
  :root { --ink: #16181A; --bone: #F2EFE9; --paper: #FBF9F4; --line: #DDD7CA; --brass: #7A5A1C; --forest: #1F3A2D; }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: #E8E3D7; color: var(--ink); font-family: 'Inter', Arial, sans-serif; }
  .bar { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; gap: 16px; padding: 14px 24px; background: var(--bone); border-bottom: 1px solid var(--line); }
  .bar img { height: 26px; width: auto; display: block; }
  .bar .kicker { font: 500 12px/1 'JetBrains Mono', monospace; letter-spacing: .14em; text-transform: uppercase; color: var(--brass); }
  .bar .spacer { flex: 1; }
  .bar a, .bar button { font: 600 14px/1 'Inter', Arial, sans-serif; color: var(--ink); text-decoration: none; padding: 10px 14px; border: 1px solid var(--line); background: var(--paper); border-radius: 8px; cursor: pointer; }
  .bar a.primary { background: var(--forest); border-color: var(--forest); color: var(--bone); }
  .deck { max-width: 1280px; margin: 0 auto; padding: 24px 16px 48px; display: flex; flex-direction: column; gap: 20px; }
  .hint { font-size: 13px; color: #66625B; margin: 0; }
  .frame { position: relative; width: 100%; aspect-ratio: 16 / 9; overflow: hidden; border-radius: 10px; box-shadow: 0 10px 30px rgba(31, 58, 45, .14); cursor: zoom-in; background: var(--bone); }
  .frame:focus-visible { outline: 3px solid var(--brass); outline-offset: 3px; }
  .canvas { position: absolute; left: 0; top: 0; width: 1920px; height: 1080px; transform-origin: 0 0; }
  .canvas section { position: relative; width: 1920px; height: 1080px; overflow: hidden; }
  .canvas section * { box-sizing: border-box; margin: 0; }
  .canvas ul { padding-left: 1.25em; }
  .canvas img { display: block; }
  .canvas table { width: 100%; border-collapse: separate; border-spacing: 0; overflow: hidden; }
  .canvas th, .canvas td { padding: 16px 28px; text-align: left; vertical-align: top; border-bottom: 1px solid var(--line); }
  .canvas tr:first-child th { background: #E8E3D7; }
  .canvas tr:first-child th:first-child { border-top-left-radius: 15px; }
  .canvas tr:first-child th:last-child { border-top-right-radius: 15px; }
  .canvas tr:last-child td { border-bottom: none; }
  .foot { text-align: center; font-size: 13px; color: #66625B; padding: 0 16px 40px; }
  .foot a { color: var(--forest); }
  body.presenting { overflow: hidden; }
  body.presenting .frame.current { position: fixed; inset: 0; z-index: 20; width: 100vw; height: 100vh; aspect-ratio: auto; border-radius: 0; box-shadow: none; background: #0F0F10; cursor: zoom-out; }
  @media (max-width: 760px) { .bar .kicker, #present { display: none; } .bar { padding: 10px 12px; gap: 8px; flex-wrap: wrap; } .bar img { height: 22px; } .bar a, .bar button { padding: 8px 10px; font-size: 13px; } }
  @media print {
    @page { size: 1920px 1080px; margin: 0; }
    html, body { background: none; }
    .bar, .hint, .foot { display: none; }
    .deck { max-width: none; padding: 0; gap: 0; display: block; }
    .frame { width: 1920px; height: 1080px; aspect-ratio: auto; border-radius: 0; box-shadow: none; break-after: page; page-break-after: always; }
    .canvas { transform: none !important; }
  }
</style>
</head>
<body>
<header class="bar">
  <a href="../../" style="padding:0;border:none;background:none"><img src="../../assets/images/innmobi-lockup.svg" alt="innmobi"></a>
  <span class="kicker">${t.kicker}</span>
  <span class="spacer"></span>
  <a href="../${t.other}/" hreflang="${t.other}">${t.otherLabel}</a>
  <button type="button" id="present">${t.present}</button>
  <a class="primary" href="../innmobi-pitch-deck-${lang}.pdf" download>${t.pdf}</a>
</header>
<main class="deck">
<p class="hint">${t.hint}</p>
${frames}
</main>
<p class="foot">${t.contact}: <a href="mailto:ventas@innmobi.ai">ventas@innmobi.ai</a> · <a href="../../">innmobi.ai</a></p>
<script>
(() => {
  const frames = [...document.querySelectorAll('.frame')];
  const fit = (f) => {
    const box = f.getBoundingClientRect();
    const s = Math.min(box.width / 1920, box.height / 1080);
    const c = f.firstElementChild;
    c.style.transform = 'translate(' + (box.width - 1920 * s) / 2 + 'px,' + (box.height - 1080 * s) / 2 + 'px) scale(' + s + ')';
  };
  const ro = new ResizeObserver((entries) => entries.forEach((e) => fit(e.target)));
  frames.forEach((f) => ro.observe(f));
  let current = -1;
  const show = (i) => {
    frames.forEach((f) => f.classList.remove('current'));
    if (i < 0) { current = -1; document.body.classList.remove('presenting'); return; }
    current = Math.max(0, Math.min(frames.length - 1, i));
    document.body.classList.add('presenting');
    frames[current].classList.add('current');
    fit(frames[current]);
  };
  frames.forEach((f, i) => {
    f.addEventListener('click', () => (current === i ? show(-1) : show(i)));
    f.addEventListener('keydown', (e) => { if (e.key === 'Enter') show(i); });
  });
  document.getElementById('present').addEventListener('click', () => show(0));
  document.addEventListener('keydown', (e) => {
    if (current < 0) return;
    if (e.key === 'Escape') show(-1);
    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); show(current + 1); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); show(current - 1); }
  });
  addEventListener('resize', () => { if (current >= 0) fit(frames[current]); });
})();
</script>
</body>
</html>
`;
}

async function main() {
  const browser = await chromium.launch();
  for (const lang of ['es', 'en']) {
    const deck = JSON.parse(await fs.readFile(path.join(SRC, lang, 'deck.json'), 'utf-8'));
    const slides = [];
    for (const id of deck.order) {
      const raw = await fs.readFile(path.join(SRC, lang, 'slides', `${id}.html`), 'utf-8');
      slides.push(slideHtml(raw, id));
    }
    const dir = path.join(OUT, lang);
    await fs.mkdir(dir, { recursive: true });
    const file = path.join(dir, 'index.html');
    await fs.writeFile(file, page(lang, deck, slides), 'utf-8');
    console.log(`  ✓ ${path.relative(ROOT, file)} (${slides.length} slides)`);

    const tab = await browser.newPage();
    await tab.goto(pathToFileURL(file).href, { waitUntil: 'networkidle' });
    await tab.evaluate(() => document.fonts.ready);
    const pdf = path.join(OUT, `innmobi-pitch-deck-${lang}.pdf`);
    await tab.pdf({ path: pdf, width: '1920px', height: '1080px', printBackground: true, preferCSSPageSize: true });
    await tab.close();
    console.log(`  ✓ ${path.relative(ROOT, pdf)}`);
  }
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
