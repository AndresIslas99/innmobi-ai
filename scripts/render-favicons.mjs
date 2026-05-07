// Render favicon set from images/logo-innmobi-ai-icon.svg
// Outputs:
//   docs/favicon.ico (32x32 PNG-encoded ICO bytes — most browsers accept this)
//   docs/apple-touch-icon.png (180×180)
//   docs/icons/icon-192.png
//   docs/icons/icon-512.png
//   docs/icons/icon-maskable-512.png (with safe-area padding 10%)
// Usage: PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node scripts/render-favicons.mjs

import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SVG = path.join(ROOT, 'images', 'logo-innmobi-ai-icon.svg');
const OUT = path.join(ROOT, 'docs');
const ICONS = path.join(OUT, 'icons');

const TARGETS = [
  { file: path.join(OUT, 'apple-touch-icon.png'), size: 180, maskable: false },
  { file: path.join(ICONS, 'icon-192.png'), size: 192, maskable: false },
  { file: path.join(ICONS, 'icon-512.png'), size: 512, maskable: false },
  { file: path.join(ICONS, 'icon-maskable-512.png'), size: 512, maskable: true },
  { file: path.join(OUT, 'favicon-32.png'), size: 32, maskable: false },
  { file: path.join(OUT, 'favicon-16.png'), size: 16, maskable: false },
];

async function main() {
  console.log('Innmobi.ai — Rendering favicon set');
  await fs.mkdir(ICONS, { recursive: true });

  const svg = await fs.readFile(SVG, 'utf-8');
  const browser = await chromium.launch();

  for (const t of TARGETS) {
    const inner = t.maskable
      ? `<div style="background:#A77E2B;width:100vw;height:100vh;display:flex;align-items:center;justify-content:center;"><div style="width:75%;height:75%;">${svg}</div></div>`
      : svg;
    const html = `<!doctype html><html><head><style>html,body{margin:0;padding:0;background:transparent;}svg{display:block;width:100vw;height:100vh;}</style></head><body>${inner}</body></html>`;

    const ctx = await browser.newContext({
      viewport: { width: t.size, height: t.size },
      deviceScaleFactor: 1,
    });
    const page = await ctx.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    await page.screenshot({ path: t.file, omitBackground: !t.maskable, type: 'png' });
    await ctx.close();
    console.log(`  ✓ ${path.relative(ROOT, t.file)} (${t.size}×${t.size}${t.maskable ? ' maskable' : ''})`);
  }

  // Build a minimal ICO containing 16 and 32 PNG-encoded entries.
  const png16 = await fs.readFile(path.join(OUT, 'favicon-16.png'));
  const png32 = await fs.readFile(path.join(OUT, 'favicon-32.png'));
  const ico = buildIco([
    { size: 16, png: png16 },
    { size: 32, png: png32 },
  ]);
  await fs.writeFile(path.join(OUT, 'favicon.ico'), ico);
  console.log(`  ✓ docs/favicon.ico (16+32)`);

  // Cleanup intermediate PNGs we only used for ICO
  await fs.unlink(path.join(OUT, 'favicon-16.png'));
  await fs.unlink(path.join(OUT, 'favicon-32.png'));

  await browser.close();
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
