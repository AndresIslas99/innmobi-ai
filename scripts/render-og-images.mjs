// Render per-page OG images (1200×630 PNG) into docs/og/<slug>.png
// Uses Playwright to render an HTML template per page, then screenshots it.
// Usage: PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node scripts/render-og-images.mjs

import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data', 'pages.json');
const OUT = path.join(ROOT, 'docs', 'og');

const TEMPLATES = {
  home:    { eyebrow: 'INNMOBI.AI · CDMX · 2026',        headline: 'El sistema operativo<br/>para inmobiliarias<br/>que cierran <em>de verdad</em>.' },
  producto:{ eyebrow: 'INNMOBI.AI · PRODUCTO',           headline: 'Un CRM que tu equipo <em>quiere</em> abrir.' },
  precios: { eyebrow: 'INNMOBI.AI · PRECIOS',            headline: 'Pago por asesor activo. <em>Sin sorpresas.</em>' },
  casos:   { eyebrow: 'INNMOBI.AI · CASOS DE ÉXITO',     headline: 'Inmobiliarias mexicanas<br/>que cerraron <em>de verdad</em>.' },
  'caso-agnor': { eyebrow: 'CASO · AGNOR INMOBILIARIA',  headline: 'AGNOR opera <em>100%</em><br/>sobre Innmobi.ai.' },
  seguridad:{ eyebrow: 'INNMOBI.AI · SEGURIDAD',         headline: 'Tu data está <em>en buenas manos</em>.' },
  sobre:   { eyebrow: 'INNMOBI.AI · SOBRE NOSOTROS',     headline: 'Nació en piso. <em>Vendiendo remates en CDMX.</em>' },
  recursos:{ eyebrow: 'INNMOBI.AI · RECURSOS',           headline: 'Lecturas para directores<br/>que <em>toman decisiones</em>.' },
  demo:    { eyebrow: 'INNMOBI.AI · RESERVAR DEMO',      headline: 'Treinta minutos. <em>Tu pipeline cambia.</em>' },
  legal:   { eyebrow: 'INNMOBI.AI · LEGAL',              headline: 'Términos y privacidad. <em>Léelos con tu abogado.</em>' },
  'blog-lead-rot':     { eyebrow: 'INNMOBI · ANÁLISIS',  headline: 'Por qué el 60% de los leads<br/>mueren en <em>24 horas</em>.' },
  'blog-checklist':    { eyebrow: 'INNMOBI · CHECKLIST', headline: '27 puntos para evaluar<br/>un CRM <em>inmobiliario</em>.' },
  'blog-whatsapp':     { eyebrow: 'INNMOBI · GUÍA',      headline: 'WhatsApp Business API.<br/>Lo que <em>nadie te dice</em>.' },
  'blog-mercadolibre': { eyebrow: 'INNMOBI · COMPARATIVA', headline: 'Mercado Libre Inmuebles.<br/>Nativa vs scraping vs <em>manual</em>.' },
  'blog-agnor':        { eyebrow: 'INNMOBI · CASO LARGO', headline: 'Caso AGNOR — automatizamos<br/>un pipeline de <em>remates</em>.' },
};

const TEMPLATE_HTML = (eyebrow, headline) => `<!doctype html>
<html><head><style>
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&family=JetBrains+Mono:wght@500&display=swap');
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 1200px; height: 630px; background: #F2EFE9; font-family: 'Fraunces', serif; color: #0F0F10; overflow: hidden; }
.frame { position: relative; width: 1200px; height: 630px; padding: 64px 80px; display: flex; flex-direction: column; justify-content: space-between; }
.top, .bot { display: flex; justify-content: space-between; font-family: 'JetBrains Mono', monospace; font-size: 13px; letter-spacing: 0.18em; color: #4A4A52; text-transform: uppercase; }
.eyebrow { color: #A77E2B; }
.head { font-size: 78px; font-weight: 600; font-variation-settings: 'opsz' 144; line-height: 1.05; letter-spacing: -1.6px; max-width: 1040px; }
em { font-style: italic; color: #1F3A2D; }
.wm { font-size: 32px; font-weight: 600; }
.wm .p { color: #A77E2B; }
.brassbar { position: absolute; left: 80px; right: 80px; height: 1px; background: #A77E2B; opacity: 0.4; }
.brassbar.t { top: 100px; }
.brassbar.b { bottom: 100px; }
</style></head>
<body>
<div class="frame">
  <div>
    <div class="top">
      <span class="eyebrow">${eyebrow}</span>
      <span>1200 × 630</span>
    </div>
    <div class="brassbar t"></div>
  </div>
  <h1 class="head">${headline}</h1>
  <div>
    <div class="brassbar b"></div>
    <div class="bot">
      <span class="wm">Innmobi<span class="p">.</span>ai</span>
      <span>INNMOBI.AI · CDMX 🇲🇽</span>
    </div>
  </div>
</div>
</body></html>`;

async function main() {
  console.log('Innmobi.ai — Rendering OG images');
  await fs.mkdir(OUT, { recursive: true });

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();

  for (const [slug, tpl] of Object.entries(TEMPLATES)) {
    await page.setContent(TEMPLATE_HTML(tpl.eyebrow, tpl.headline), { waitUntil: 'networkidle' });
    await page.waitForTimeout(400); // fonts
    const file = path.join(OUT, `${slug}.png`);
    await page.screenshot({ path: file, type: 'png', clip: { x: 0, y: 0, width: 1200, height: 630 } });
    console.log(`  ✓ docs/og/${slug}.png`);
  }

  await browser.close();
  console.log('✅ OG images ready.');
}

main().catch((err) => { console.error(err); process.exit(1); });
