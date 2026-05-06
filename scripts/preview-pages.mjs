// Preview docs/index.html (GitHub Pages site) for visual QA
// Usage: node scripts/preview-pages.mjs

import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const HTML = path.join(ROOT, 'docs', 'index.html');

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();

await page.goto(pathToFileURL(HTML).href, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

// Open all <details> in FAQ so we can see them rendered
await page.evaluate(() => {
  document.querySelectorAll('details').forEach(d => d.open = true);
});
await page.waitForTimeout(500);

await page.screenshot({ path: '/tmp/pages-full.png', fullPage: true });
console.log('✓ /tmp/pages-full.png (full page)');

// Capture key sections individually
const sections = [
  { sel: '#movimiento', name: 'movimiento' },
  { sel: '#producto', name: 'producto' },
  { sel: '#caso', name: 'caso' },
  { sel: '#migracion', name: 'migracion' },
  { sel: '#faq', name: 'faq' },
  { sel: '#reservar', name: 'reservar' },
];
for (const { sel, name } of sections) {
  const el = await page.$(sel);
  if (el) {
    await el.screenshot({ path: `/tmp/pages-${name}.png` });
    console.log(`✓ /tmp/pages-${name}.png`);
  } else {
    console.log(`✗ ${sel} not found`);
  }
}

await browser.close();
