// Render pitch-deck/index.html → pitch-deck/pitch-deck.pdf + pitch-deck/slides/slide-NN.png
// Usage: PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node scripts/render-pitch-deck.mjs

import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const HTML = path.join(ROOT, 'pitch-deck', 'index.html');
const PDF = path.join(ROOT, 'pitch-deck', 'pitch-deck.pdf');
const SLIDES = path.join(ROOT, 'pitch-deck', 'slides');

async function main() {
  console.log('Innmobi.ai — Rendering pitch deck');
  await fs.mkdir(SLIDES, { recursive: true });

  const browser = await chromium.launch();

  // PDF
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await ctx.newPage();
  await page.goto(pathToFileURL(HTML).href, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.pdf({
    path: PDF,
    width: '1920px', height: '1080px',
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
    preferCSSPageSize: false,
  });
  console.log(`  ✓ ${path.relative(ROOT, PDF)}`);

  // PNGs per slide
  const slides = await page.locator('.slide').all();
  for (let i = 0; i < slides.length; i++) {
    const num = String(i + 1).padStart(2, '0');
    await slides[i].screenshot({ path: path.join(SLIDES, `slide-${num}.png`), type: 'png' });
    console.log(`  ✓ pitch-deck/slides/slide-${num}.png`);
  }

  await browser.close();
  console.log('✅ Pitch deck ready.');
}

main().catch((err) => { console.error(err); process.exit(1); });
