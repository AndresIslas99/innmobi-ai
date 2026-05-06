// Preview brochure: render each .page to PNG for visual sanity check
// Usage: node scripts/preview-brochure.mjs   (writes /tmp/brochure-pNN.png)

import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const HTML = path.join(ROOT, 'brochure', 'brochure.html');

const A4_PX = { width: 794, height: 1123 }; // A4 @ 96dpi

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: A4_PX, deviceScaleFactor: 2 });
const page = await ctx.newPage();

await page.goto(pathToFileURL(HTML).href, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);

const pages = await page.$$('.page');
console.log(`Found ${pages.length} pages`);
let i = 0;
for (const p of pages) {
  i++;
  const num = String(i).padStart(2, '0');
  const out = `/tmp/brochure-p${num}.png`;
  await p.screenshot({ path: out });
  console.log(`✓ page ${num} → ${out}`);
}

await browser.close();
