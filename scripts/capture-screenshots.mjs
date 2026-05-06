// Capture real CRM screenshots from running dev server
// Prereq:
//   cd ../agnor-crm-dev
//   PORT=9090 nohup python3 -m uvicorn agnor.presentation.web.app_v2:app --host 127.0.0.1 --port 9090 &
//   python3 -m agnor.db.seeds --clean   # if DB empty
// Usage:
//   CRM_BASE_URL=http://127.0.0.1:9090 npm run capture:screenshots

import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'screenshots');

const BASE = process.env.CRM_BASE_URL || 'http://127.0.0.1:9090';
const USER = process.env.CRM_USER || 'admin';
const PASS = process.env.CRM_PASS || 'admin123';

const VIEWPORT = { width: 1440, height: 900 };
const MOBILE_VIEWPORT = { width: 390, height: 844 };
const DEVICE_SCALE = 2;

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[name="username"]', USER);
  await page.fill('input[name="password"]', PASS);
  await Promise.all([
    page.waitForLoadState('networkidle').catch(() => {}),
    page.click('button[type="submit"], input[type="submit"]'),
  ]);
  await page.waitForTimeout(1500);
  if (!page.url().includes('/app/')) {
    throw new Error(`Login failed — url is ${page.url()}`);
  }
}

async function screenshot(page, route, file, opts = {}) {
  const url = `${BASE}${route}`;
  console.log(`→ ${file}  (${url})`);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 }).catch(() => {});
  // Charts/data take time to render
  await page.waitForTimeout(opts.wait ?? 2500);
  if (opts.action) await opts.action(page);
  const out = path.join(OUT_DIR, file);
  await page.screenshot({ path: out, fullPage: !!opts.fullPage });
  console.log(`  ✓ ${path.relative(ROOT, out)}`);
}

async function captureDesktop(browser) {
  const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: DEVICE_SCALE });
  const page = await ctx.newPage();
  await login(page);

  // 01 — Dashboard ejecutivo (Command Center)
  await screenshot(page, '/app/dashboard', '01-dashboard.png');

  // 02 — Lista de leads (tabla con filtros)
  await screenshot(page, '/app/leads', '02-leads-list.png');

  // 03 — Pipeline kanban (ruta directa)
  await screenshot(page, '/app/leads/pipeline', '03-pipeline-kanban.png', { wait: 3000 });

  // 04 — Detalle de lead (click en primera fila)
  await screenshot(page, '/app/leads', '04-lead-detail.png', {
    wait: 1500,
    action: async (p) => {
      // Click first lead row
      const firstRow = p.locator('tbody tr').first();
      await firstRow.click().catch(() => {});
      await p.waitForTimeout(2500);
    },
  });

  // 05 — Catálogo de propiedades
  await screenshot(page, '/app/properties', '05-properties.png');

  // 06 — Analytics dashboard
  await screenshot(page, '/app/analytics', '06-analytics.png');

  // 07 — Calendario de citas
  await screenshot(page, '/app/calendar', '07-calendar.png');

  // 08 — Lista de citas
  await screenshot(page, '/app/appointments', '08-appointments.png');

  await ctx.close();
}

async function captureMobile(browser) {
  const ctx = await browser.newContext({ viewport: MOBILE_VIEWPORT, deviceScaleFactor: DEVICE_SCALE });
  const page = await ctx.newPage();
  await login(page);
  await screenshot(page, '/app/dashboard', '09-mobile-dashboard.png', { wait: 2500 });
  await ctx.close();
}

async function main() {
  console.log('Inmobi.ai — Capturing real CRM screenshots');
  console.log(`Base URL: ${BASE}`);
  console.log(`User: ${USER}\n`);

  await fs.mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  try {
    await captureDesktop(browser);
    await captureMobile(browser);
  } finally {
    await browser.close();
  }

  console.log('\n✅ Done. Real CRM captures in screenshots/');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
