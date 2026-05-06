// Capture real CRM screenshots from running dev server
// Prereq: cd ../agnor-crm-dev && make serve   (server on http://localhost:8080)
// Usage:  node scripts/capture-screenshots.mjs

import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'screenshots');

const BASE = process.env.CRM_BASE_URL || 'http://localhost:8080';
const USER = process.env.CRM_USER || 'admin';
const PASS = process.env.CRM_PASS || 'admin123';

const VIEWPORT = { width: 1440, height: 900 };
const MOBILE_VIEWPORT = { width: 390, height: 844 };
const DEVICE_SCALE = 2;

const SHOTS = [
  { file: '01-dashboard.png',        path: '/app/dashboard',      label: 'Dashboard ejecutivo' },
  { file: '02-pipeline-kanban.png',  path: '/app/leads',          label: 'Pipeline kanban' },
  { file: '03-lead-detail.png',      path: '/app/leads/1',        label: 'Detalle de lead' },
  { file: '04-analytics-funnel.png', path: '/app/analytics',      label: 'Analytics funnel' },
  { file: '05-properties.png',       path: '/app/properties',     label: 'Catálogo' },
  { file: '06-whatsapp.png',         path: '/app/whatsapp',       label: 'WhatsApp templates' },
  { file: '07-calendar.png',         path: '/app/calendar',       label: 'Calendar' },
  // Mobile
  { file: '08-mobile.png',           path: '/app/dashboard',      label: 'Vista mobile', mobile: true },
];

async function loginIfNeeded(page) {
  // Try the login route — adjust selectors if your CRM differs
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' }).catch(() => {});
  const hasUser = await page.locator('input[name="username"]').count();
  if (!hasUser) return;
  await page.fill('input[name="username"]', USER);
  await page.fill('input[name="password"]', PASS);
  await Promise.all([
    page.waitForLoadState('networkidle').catch(() => {}),
    page.click('button[type="submit"], input[type="submit"]'),
  ]);
  await page.waitForTimeout(1200);
}

async function capture(browser, shot) {
  const viewport = shot.mobile ? MOBILE_VIEWPORT : VIEWPORT;
  const ctx = await browser.newContext({
    viewport,
    deviceScaleFactor: DEVICE_SCALE,
    storageState: undefined,
  });
  const page = await ctx.newPage();

  await loginIfNeeded(page);

  const url = `${BASE}${shot.path}`;
  console.log(`→ ${shot.label}  (${url})`);
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(1500); // let charts/animations settle
  } catch (err) {
    console.warn(`  ⚠ navigation issue: ${err.message}`);
  }

  const out = path.join(OUT_DIR, shot.file);
  await page.screenshot({ path: out, fullPage: false });
  console.log(`  ✓ ${path.relative(ROOT, out)}`);
  await ctx.close();
}

async function main() {
  console.log('Inmobi.ai — Capturing CRM screenshots');
  console.log(`Base URL: ${BASE}`);
  console.log(`User: ${USER}\n`);

  await fs.mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  try {
    for (const shot of SHOTS) {
      await capture(browser, shot);
    }
  } finally {
    await browser.close();
  }

  console.log('\n✅ Done. Screenshots in screenshots/');
  console.log('Tip: si alguna ruta no existe en tu CRM, edita la lista SHOTS arriba.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
