// Render brand-bible/brand-bible.html → brand-bible/brand-bible.pdf (A4 multi-page)
// Usage: PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node scripts/render-brand-bible.mjs

import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const HTML = path.join(ROOT, 'brand-bible', 'brand-bible.html');
const PDF = path.join(ROOT, 'brand-bible', 'brand-bible.pdf');

async function main() {
  console.log('Innmobi.ai — Rendering brand bible PDF');
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(pathToFileURL(HTML).href, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.pdf({ path: PDF, format: 'A4', printBackground: true, margin: { top: '0', right: '0', bottom: '0', left: '0' }, preferCSSPageSize: true });
  await browser.close();
  console.log(`✅ ${path.relative(ROOT, PDF)}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
