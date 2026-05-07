// Render one-pager/one-pager.html → one-pager/one-pager.pdf (A4 single page)
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const HTML = path.join(ROOT, 'one-pager', 'one-pager.html');
const PDF = path.join(ROOT, 'one-pager', 'one-pager.pdf');

async function main() {
  console.log('Innmobi.ai — Rendering one-pager');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(pathToFileURL(HTML).href, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.pdf({ path: PDF, format: 'A4', printBackground: true, margin: { top: '0', right: '0', bottom: '0', left: '0' }, preferCSSPageSize: true });
  await browser.close();
  console.log(`✅ ${path.relative(ROOT, PDF)}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
