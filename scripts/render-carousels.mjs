// Render LinkedIn carousels: each .slide -> PNG 1080x1080
// Usage: node scripts/render-carousels.mjs

import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const LINKEDIN_DIR = path.join(ROOT, 'linkedin');

const CAROUSELS = [
  'carousel-01-features.html',
  'carousel-02-stack.html',
  'carousel-03-case-study.html',
];

const VIEWPORT = { width: 1080, height: 1080 };
const DEVICE_SCALE = 2; // retina-quality PNGs

async function renderOne(browser, file) {
  const slug = path.basename(file, '.html');
  const outDir = path.join(LINKEDIN_DIR, slug);
  await fs.mkdir(outDir, { recursive: true });

  const ctx = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: DEVICE_SCALE,
  });
  const page = await ctx.newPage();

  const url = pathToFileURL(path.join(LINKEDIN_DIR, file)).href;
  console.log(`→ ${file}`);
  await page.goto(url, { waitUntil: 'networkidle' });
  // Wait extra to ensure web fonts render
  await page.waitForTimeout(800);

  const slides = await page.$$('.slide');
  console.log(`  ${slides.length} slides`);

  let i = 0;
  for (const slide of slides) {
    i++;
    const num = String(i).padStart(2, '0');
    const out = path.join(outDir, `slide-${num}.png`);
    await slide.screenshot({ path: out, omitBackground: false });
    console.log(`  ✓ slide ${num} → ${path.relative(ROOT, out)}`);
  }
  await ctx.close();
}

async function main() {
  console.log('Innmobi.ai — Rendering carousels');
  console.log(`Viewport: ${VIEWPORT.width}×${VIEWPORT.height} @${DEVICE_SCALE}x\n`);

  const browser = await chromium.launch();
  try {
    for (const c of CAROUSELS) {
      await renderOne(browser, c);
    }
  } finally {
    await browser.close();
  }

  console.log('\n✅ Done. PNGs ready in linkedin/<carousel>/slide-NN.png');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
