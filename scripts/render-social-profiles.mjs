// Innmobi.ai — Render social media profiles + covers
// Genera todos los assets de perfil para Instagram, Facebook, LinkedIn (personal + company), X.
// Output: images/social/*.png
//
// Usage: PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node scripts/render-social-profiles.mjs

import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'images', 'social');

// ====== TEMPLATES ======

// Profile photo: monogram square. 3 variants. Always 1024x1024 (escala bien).
const profileHTML = (variant) => {
  const themes = {
    brass: { bg: '#A77E2B', mark: '#F2EFE9', accent: '#0F0F10' },
    ink:   { bg: '#0F0F10', mark: '#A77E2B', accent: '#C9A661' },
    bone:  { bg: '#F2EFE9', mark: '#0F0F10', accent: '#A77E2B' },
  };
  const t = themes[variant];
  return `<!doctype html><html><head><style>
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&display=swap');
    *{box-sizing:border-box;margin:0;padding:0;}
    html,body{width:1024px;height:1024px;background:${t.bg};overflow:hidden;}
    .frame{position:relative;width:1024px;height:1024px;display:flex;align-items:center;justify-content:center;}
    .I {
      font-family:'Fraunces',serif;font-variation-settings:'opsz' 144;font-weight:700;
      font-size:760px;line-height:0.78;color:${t.mark};letter-spacing:-0.04em;
      position:relative;
    }
    /* Tipografía Fraunces ya tiene serifs, así que la I es muy distintiva */
  </style></head><body><div class="frame"><span class="I">I</span></div></body></html>`;
};

// Cover: 5 plataformas × 2 variantes (light/dark) = 10
// Layout: top frame (eyebrow + meta), brass divider, headline center, brass divider, bottom frame (wordmark + meta)

const coverHTML = ({ width, height, variant, headline, subhead = '', topLeft = 'INNMOBI.AI · CDMX · 2026', topRight = 'CRM INMOBILIARIO · IA NATIVA', headlineScale = 0.18 }) => {
  const themes = {
    light: { bg: '#F2EFE9', text: '#0F0F10', muted: '#4A4A52', frame: '#A77E2B', em: '#1F3A2D', wmPeriod: '#A77E2B', wm: '#0F0F10' },
    dark:  { bg: '#0F0F10', text: '#F2EFE9', muted: '#A8A6A0', frame: '#A77E2B', em: '#C9A661', wmPeriod: '#A77E2B', wm: '#F2EFE9' },
  };
  const t = themes[variant];
  const headlineSize = Math.round(height * headlineScale);
  const padX = Math.round(width * 0.04);
  const padY = Math.round(height * 0.08);
  const eyebrowSize = Math.max(11, Math.round(height * 0.025));
  const wmSize = Math.max(20, Math.round(height * 0.085));

  return `<!doctype html><html><head><style>
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&family=JetBrains+Mono:wght@500&display=swap');
    *{box-sizing:border-box;margin:0;padding:0;}
    html,body{width:${width}px;height:${height}px;background:${t.bg};font-family:'Fraunces',serif;color:${t.text};overflow:hidden;}
    .frame{width:${width}px;height:${height}px;padding:${padY}px ${padX}px;display:flex;flex-direction:column;justify-content:space-between;}
    .row{display:flex;justify-content:space-between;align-items:center;font-family:'JetBrains Mono',monospace;font-size:${eyebrowSize}px;letter-spacing:0.18em;color:${t.muted};text-transform:uppercase;}
    .eyebrow{color:${t.frame};}
    .brass-line{height:1px;background:${t.frame};opacity:0.5;margin:${Math.round(padY*0.25)}px 0;}
    .head{font-size:${headlineSize}px;font-weight:600;font-variation-settings:'opsz' 144;line-height:1.04;letter-spacing:-0.025em;max-width:${Math.round(width*0.92)}px;}
    em{font-style:italic;color:${t.em};}
    .wm{font-family:'Fraunces',serif !important;font-weight:600;font-size:${wmSize}px;color:${t.wm};font-variation-settings:'opsz' 144;letter-spacing:-0.02em;text-transform:none !important;}
    .wm .p{color:${t.wmPeriod};}
    .sub{font-family:'JetBrains Mono',monospace;font-size:${eyebrowSize}px;letter-spacing:0.12em;color:${t.muted};margin-top:${Math.round(headlineSize*0.18)}px;text-transform:uppercase;}
    .center{display:flex;flex-direction:column;justify-content:center;flex:1;}
  </style></head><body>
    <div class="frame">
      <div>
        <div class="row"><span class="eyebrow">${topLeft}</span><span>${topRight}</span></div>
        <div class="brass-line"></div>
      </div>
      <div class="center">
        <h1 class="head">${headline}</h1>
        ${subhead ? `<p class="sub">${subhead}</p>` : ''}
      </div>
      <div>
        <div class="brass-line"></div>
        <div class="row">
          <span class="wm">Innmobi<span class="p">.</span>ai</span>
          <span>${width < 1200 ? 'CDMX 🇲🇽' : 'innmobi.ai · CDMX 🇲🇽'}</span>
        </div>
      </div>
    </div>
  </body></html>`;
};

// Instagram highlight cover (1080x1080, displayed as small circle on profile).
// Solo wordmark/icono distintivo. Útil para categorías de stories.
const highlightHTML = ({ label, variant = 'bone' }) => {
  const themes = {
    brass: { bg: '#A77E2B', text: '#F2EFE9', label: '#0F0F10' },
    ink:   { bg: '#0F0F10', text: '#C9A661', label: '#A77E2B' },
    bone:  { bg: '#F2EFE9', text: '#0F0F10', label: '#A77E2B' },
  };
  const t = themes[variant];
  return `<!doctype html><html><head><style>
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&family=JetBrains+Mono:wght@500&display=swap');
    *{box-sizing:border-box;margin:0;padding:0;}
    html,body{width:1080px;height:1080px;background:${t.bg};overflow:hidden;}
    .frame{width:1080px;height:1080px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:48px;}
    .I{font-family:'Fraunces',serif;font-weight:600;font-variation-settings:'opsz' 144;font-size:540px;line-height:0.8;color:${t.text};}
    .lbl{font-family:'JetBrains Mono',monospace;font-size:48px;letter-spacing:0.32em;color:${t.label};text-transform:uppercase;}
  </style></head><body><div class="frame"><span class="I">I</span><span class="lbl">${label}</span></div></body></html>`;
};

// ====== TARGETS ======

const TARGETS = [
  // Profile photos (square, displayed as circle)
  { name: 'profile-brass-1024',  size: { width: 1024, height: 1024 }, html: profileHTML('brass') },
  { name: 'profile-ink-1024',    size: { width: 1024, height: 1024 }, html: profileHTML('ink') },
  { name: 'profile-bone-1024',   size: { width: 1024, height: 1024 }, html: profileHTML('bone') },
  // Smaller profile size for some platforms (X uses 400 source)
  { name: 'profile-brass-400',   size: { width: 400,  height: 400  }, html: profileHTML('brass') },

  // Facebook cover (1640×856 source, FB renders 851×315)
  { name: 'cover-facebook-light', size: { width: 1640, height: 856 }, html: coverHTML({
    width: 1640, height: 856, variant: 'light', headlineScale: 0.13,
    headline: 'El sistema operativo<br/>para inmobiliarias <em>que cierran de verdad.</em>',
    subhead: 'CRM con IA · WhatsApp Business · Mercado Libre · CDMX'
  })},
  { name: 'cover-facebook-dark',  size: { width: 1640, height: 856 }, html: coverHTML({
    width: 1640, height: 856, variant: 'dark', headlineScale: 0.13,
    headline: 'El sistema operativo<br/>para inmobiliarias <em>que cierran de verdad.</em>',
    subhead: 'CRM con IA · WhatsApp Business · Mercado Libre · CDMX'
  })},

  // LinkedIn personal profile banner (1584×396, ratio 4:1)
  { name: 'cover-linkedin-personal-light', size: { width: 1584, height: 396 }, html: coverHTML({
    width: 1584, height: 396, variant: 'light', headlineScale: 0.18,
    headline: 'Sistema operativo para inmobiliarias. <em>De verdad.</em>',
    topRight: 'INNMOBI.AI · ORZATECH'
  })},
  { name: 'cover-linkedin-personal-dark', size: { width: 1584, height: 396 }, html: coverHTML({
    width: 1584, height: 396, variant: 'dark', headlineScale: 0.18,
    headline: 'Sistema operativo para inmobiliarias. <em>De verdad.</em>',
    topRight: 'INNMOBI.AI · ORZATECH'
  })},

  // LinkedIn company page banner (1128×191, ratio ~5.9:1, muy aplastado)
  { name: 'cover-linkedin-company-light', size: { width: 1128, height: 191 }, html: coverHTML({
    width: 1128, height: 191, variant: 'light', headlineScale: 0.30,
    headline: 'CRM Inmobiliario con IA <em>nativa.</em>',
    topRight: 'CDMX 🇲🇽'
  })},
  { name: 'cover-linkedin-company-dark', size: { width: 1128, height: 191 }, html: coverHTML({
    width: 1128, height: 191, variant: 'dark', headlineScale: 0.30,
    headline: 'CRM Inmobiliario con IA <em>nativa.</em>',
    topRight: 'CDMX 🇲🇽'
  })},

  // X (Twitter) header (1500×500, ratio 3:1)
  { name: 'cover-x-light', size: { width: 1500, height: 500 }, html: coverHTML({
    width: 1500, height: 500, variant: 'light', headlineScale: 0.16,
    headline: 'Sistema operativo para inmobiliarias. <em>De verdad.</em>',
    subhead: 'CRM · IA · WhatsApp · Mercado Libre · CDMX'
  })},
  { name: 'cover-x-dark', size: { width: 1500, height: 500 }, html: coverHTML({
    width: 1500, height: 500, variant: 'dark', headlineScale: 0.16,
    headline: 'Sistema operativo para inmobiliarias. <em>De verdad.</em>',
    subhead: 'CRM · IA · WhatsApp · Mercado Libre · CDMX'
  })},

  // Instagram highlight covers (round on profile, source 1080×1080)
  { name: 'ig-highlight-producto',  size: { width: 1080, height: 1080 }, html: highlightHTML({ label: 'Producto' }) },
  { name: 'ig-highlight-casos',     size: { width: 1080, height: 1080 }, html: highlightHTML({ label: 'Casos' }) },
  { name: 'ig-highlight-equipo',    size: { width: 1080, height: 1080 }, html: highlightHTML({ label: 'Equipo' }) },
  { name: 'ig-highlight-recursos',  size: { width: 1080, height: 1080 }, html: highlightHTML({ label: 'Recursos' }) },
];

async function main() {
  console.log('Innmobi.ai — Rendering social profile assets');
  await fs.mkdir(OUT, { recursive: true });

  const browser = await chromium.launch();

  for (const t of TARGETS) {
    const ctx = await browser.newContext({
      viewport: t.size,
      deviceScaleFactor: 1,
    });
    const page = await ctx.newPage();
    await page.setContent(t.html, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500); // fonts
    const file = path.join(OUT, `${t.name}.png`);
    await page.screenshot({ path: file, type: 'png', clip: { x: 0, y: 0, ...t.size } });
    await ctx.close();
    console.log(`  ✓ images/social/${t.name}.png  (${t.size.width}×${t.size.height})`);
  }

  await browser.close();
  console.log(`✅ ${TARGETS.length} social assets ready en images/social/`);
}

main().catch((err) => { console.error(err); process.exit(1); });
