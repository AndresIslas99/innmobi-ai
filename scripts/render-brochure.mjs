// Render brochure: brochure/brochure.html -> brochure/brochure.pdf (A4, 2 páginas)
// Usage: node scripts/render-brochure.mjs

import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const HTML = path.join(ROOT, 'brochure', 'brochure.html');
const PDF = path.join(ROOT, 'brochure', 'brochure.pdf');

async function main() {
  console.log('Inmobi.ai — Rendering brochure to PDF');

  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  const url = pathToFileURL(HTML).href;
  console.log(`→ ${path.relative(ROOT, HTML)}`);
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800); // fonts

  await page.pdf({
    path: PDF,
    format: 'A4',
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
    preferCSSPageSize: true,
  });

  await browser.close();
  console.log(`✅ ${path.relative(ROOT, PDF)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
