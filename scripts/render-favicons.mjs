// Render the favicon set for the innmobi mark B ("La voz": ink arch with a speech bubble standing in it).
// Geometry comes from the brand kit (innmobi-internal/brand/logo-2026-10/kit-b, tools/geometry_b.py); the three masters
// below are the kit's, on the 96-unit grid, drawn in the reversed colourway (cream arch, brass-soft bubble) on an ink tile.
// Cut rule: 16 px uses the small cut (the bubble is a dot fitted to the pixel grid); 32 px a bubble fitted to the 32 px grid;
// 48 px and up the general cut (bubble with tail).
// Outputs:
//   docs/favicon.ico        (16, 32, 48 PNG-encoded entries)
//   docs/favicon.svg        (dot cut, transparent, switches colours in dark mode)
//   docs/apple-touch-icon.png (180x180, opaque: iOS rounds it)
//   docs/icons/icon-192.png, icon-512.png, icon-maskable-512.png (mark inside the 80 % safe circle, full bleed)
// Usage: node scripts/render-favicons.mjs

import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'docs');
const ICONS = path.join(OUT, 'icons');

const INK = '#0F0F10';
const CREAM = '#F2EFE9';
const BRASS = '#A77E2B';
const SOFT = '#C9A661';

const ARCH_GEN = 'M16 88V40A32 32 0 0 1 80 40V88H67V40A19 24 0 0 0 29 40V88Z';
const BUBBLE_GEN = 'M38.35 72.4A11.5 11.5 0 1 1 46.5 78.33L37.43 81.69Z';
const ARCH_SMALL = 'M12 90V42A36 36 0 0 1 84 42V90H66V42A18 18 0 0 0 30 42V90Z';
const DOT_SMALL = '<rect x="36" y="60" width="24" height="24" rx="8" fill="%BRASS%"/>';
const ARCH_FIT32 = 'M12 90V42A36 36 0 0 1 84 42V90H72V42A24 24 0 0 0 24 42V90Z';
const BUBBLE_FIT32 = 'M35.4 71.13A15 15 0 1 1 49.5 81L33 87Z';

const general = `<path fill="${CREAM}" d="${ARCH_GEN}"/><path fill="${SOFT}" d="${BUBBLE_GEN}"/>`;
const small = `<path fill="${CREAM}" d="${ARCH_SMALL}"/>${DOT_SMALL.replace('%BRASS%', SOFT)}`;
const fit32 = `<path fill="${CREAM}" d="${ARCH_FIT32}"/><path fill="${SOFT}" d="${BUBBLE_FIT32}"/>`;

const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" role="img" aria-label="innmobi"><title>innmobi</title><style>.a{fill:${INK}}.b{fill:${BRASS}}@media (prefers-color-scheme:dark){.a{fill:${CREAM}}.b{fill:${SOFT}}}</style><path class="a" fill="${INK}" d="${ARCH_SMALL}"/>${DOT_SMALL.replace('%BRASS%', BRASS).replace('<rect ', '<rect class="b" ')}</svg>\n`;

const scaled = (sc) => `<g transform="translate(${48 - 48 * sc} ${48 - 48 * sc}) scale(${sc})">${general}</g>`;
const tile = (rx, inner) => `<rect width="96" height="96" rx="${rx}" fill="${INK}"/>${inner}`;

// file, px, rx = corner radius of the ink tile on the 96 grid (0 = full bleed), inner = the mark, transparent = keep alpha around the tile
const TARGETS = [
  { file: path.join(ICONS, 'favicon-16.tmp.png'), size: 16, rx: 14, inner: small, transparent: true },
  { file: path.join(ICONS, 'favicon-32.tmp.png'), size: 32, rx: 16, inner: fit32, transparent: true },
  { file: path.join(ICONS, 'favicon-48.tmp.png'), size: 48, rx: 16, inner: scaled(1), transparent: true },
  { file: path.join(OUT, 'apple-touch-icon.png'), size: 180, rx: 0, inner: scaled(0.8), transparent: false },
  { file: path.join(ICONS, 'icon-192.png'), size: 192, rx: 20, inner: scaled(0.84), transparent: true },
  { file: path.join(ICONS, 'icon-512.png'), size: 512, rx: 20, inner: scaled(0.84), transparent: true },
  { file: path.join(ICONS, 'icon-maskable-512.png'), size: 512, rx: 0, inner: scaled(0.7), transparent: false },
];

async function main() {
  console.log('innmobi — Rendering favicon set (mark B)');
  await fs.mkdir(ICONS, { recursive: true });

  const browser = await chromium.launch();
  for (const t of TARGETS) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="${t.size}" height="${t.size}" style="display:block">${tile(t.rx, t.inner)}</svg>`;
    const html = `<!doctype html><html><head><style>html,body{margin:0;padding:0;background:transparent;overflow:hidden}</style></head><body>${svg}</body></html>`;
    const ctx = await browser.newContext({ viewport: { width: t.size, height: t.size }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    await page.screenshot({ path: t.file, omitBackground: t.transparent, type: 'png' });
    await ctx.close();
    console.log(`  ✓ ${path.relative(ROOT, t.file)} (${t.size}×${t.size})`);
  }
  await browser.close();

  // favicon.ico: 16/32/48 PNG-in-ICO
  const png16 = await fs.readFile(path.join(ICONS, 'favicon-16.tmp.png'));
  const png32 = await fs.readFile(path.join(ICONS, 'favicon-32.tmp.png'));
  const png48 = await fs.readFile(path.join(ICONS, 'favicon-48.tmp.png'));
  await fs.writeFile(path.join(OUT, 'favicon.ico'), buildIco([
    { size: 16, png: png16 },
    { size: 32, png: png32 },
    { size: 48, png: png48 },
  ]));
  console.log('  ✓ docs/favicon.ico (16+32+48)');
  for (const f of ['favicon-16.tmp.png', 'favicon-32.tmp.png', 'favicon-48.tmp.png']) await fs.unlink(path.join(ICONS, f));

  await fs.writeFile(path.join(OUT, 'favicon.svg'), FAVICON_SVG);
  console.log('  ✓ docs/favicon.svg');
  console.log('✅ Favicons ready.');
}

function buildIco(entries) {
  // ICONDIR (6 bytes) + ICONDIRENTRY (16 bytes per image) + image data (PNGs)
  const headerSize = 6 + entries.length * 16;
  const totalSize = headerSize + entries.reduce((s, e) => s + e.png.length, 0);
  const buf = Buffer.alloc(totalSize);
  let offset = 0;

  // ICONDIR
  buf.writeUInt16LE(0, offset); offset += 2;          // reserved
  buf.writeUInt16LE(1, offset); offset += 2;          // type (1 = icon)
  buf.writeUInt16LE(entries.length, offset); offset += 2;

  let dataOffset = headerSize;
  for (const e of entries) {
    buf.writeUInt8(e.size === 256 ? 0 : e.size, offset); offset += 1; // width
    buf.writeUInt8(e.size === 256 ? 0 : e.size, offset); offset += 1; // height
    buf.writeUInt8(0, offset); offset += 1;           // colors in palette (0 = no palette)
    buf.writeUInt8(0, offset); offset += 1;           // reserved
    buf.writeUInt16LE(1, offset); offset += 2;        // color planes
    buf.writeUInt16LE(32, offset); offset += 2;       // bits per pixel
    buf.writeUInt32LE(e.png.length, offset); offset += 4; // image data size
    buf.writeUInt32LE(dataOffset, offset); offset += 4;   // image data offset
    dataOffset += e.png.length;
  }

  for (const e of entries) {
    e.png.copy(buf, offset);
    offset += e.png.length;
  }
  return buf;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
