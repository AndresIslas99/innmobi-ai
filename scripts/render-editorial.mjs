// Render editorial assets (one-off social posts) to PNGs.
// Scans editorial/assets/*.html, renders each <section.slide> at the size
// declared in data-w/data-h attributes, writes PNGs to a folder named after
// the source file.
//
// Usage: node scripts/render-editorial.mjs
//
// Per-slide attributes:
//   data-w="1080"  data-h="1080"   viewport size used to screenshot
//   data-slide="post-square"       output filename (without extension)

import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ASSETS_DIR = path.join(ROOT, 'editorial', 'assets');
const DEVICE_SCALE = 2;

async function listHtmlFiles() {
  const entries = await fs.readdir(ASSETS_DIR, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith('.html'))
    .map((e) => e.name)
    .sort();
}

async function renderFile(browser, file) {
  const slug = path.basename(file, '.html');
  const outDir = path.join(ASSETS_DIR, slug);
  await fs.mkdir(outDir, { recursive: true });

  const url = pathToFileURL(path.join(ASSETS_DIR, file)).href;
  console.log(`→ ${file}`);

  // Use a single page; reset viewport per slide.
  const ctx = await browser.newContext({
    viewport: { width: 1080, height: 1080 },
    deviceScaleFactor: DEVICE_SCALE,
  });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000); // allow web fonts to settle

  const slides = await page.$$('section.slide');
  console.log(`  ${slides.length} slide(s)`);

  for (const slide of slides) {
    const [name, w, h] = await slide.evaluate((el) => [
      el.getAttribute('data-slide'),
      Number(el.getAttribute('data-w')) || el.clientWidth,
      Number(el.getAttribute('data-h')) || el.clientHeight,
    ]);
    if (!name) {
      console.warn(`  ⚠ slide without data-slide attribute, skipping`);
      continue;
    }
    await page.setViewportSize({ width: w, height: h });
    // Re-resolve the element after viewport change in case layout shifted.
    const fresh = await page.$(`section.slide[data-slide="${name}"]`);
    if (!fresh) {
      console.warn(`  ⚠ could not resolve slide ${name} after resize`);
      continue;
    }
    const out = path.join(outDir, `${name}.png`);
    await fresh.screenshot({ path: out, omitBackground: false });
    console.log(`  ✓ ${name} ${w}×${h} → ${path.relative(ROOT, out)}`);
  }
  await ctx.close();
}

async function main() {
  console.log('Innmobi.ai — Rendering editorial assets');
  const files = await listHtmlFiles();
  if (files.length === 0) {
    console.log('  (no .html files in editorial/assets/)');
    return;
  }

  const browser = await chromium.launch();
  try {
    for (const f of files) {
      await renderFile(browser, f);
    }
  } finally {
    await browser.close();
  }

  console.log('\n✅ Done. PNGs ready in editorial/assets/<source>/<slide>.png');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
