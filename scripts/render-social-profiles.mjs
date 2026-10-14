// innmobi — Render social media profiles + covers (mark B, "La voz")
// Genera todos los assets de perfil para Instagram, Facebook, LinkedIn (personal + company).
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
const IMG = path.join(ROOT, 'images');

// ====== LOGO ======
// Vector sources: images/innmobi-*.svg (copies of the brand kit's SVGs). Inlined as data URIs so the render needs no files next to the page.
//   color    = ink + brass, for cream backgrounds
//   reversed = cream + brass soft, for ink backgrounds
// Cut rule: a lockup shorter than ~26 px (= under 140 px wide) uses the small cut (dot instead of bubble).
const svgUri = async (name) => `data:image/svg+xml;base64,${(await fs.readFile(path.join(IMG, name))).toString('base64')}`;
const LOGO = {
  isotipo:  { color: await svgUri('innmobi-isotipo.svg'),  reversed: await svgUri('innmobi-isotipo-reversed.svg'),  ratio: 64 / 80 },
  lockup:   { color: await svgUri('innmobi-lockup.svg'),   reversed: await svgUri('innmobi-lockup-reversed.svg'),   ratio: 8254.9 / 1526.2 },
  lockupSm: { color: await svgUri('innmobi-lockup-small.svg'), reversed: await svgUri('innmobi-lockup-small-reversed.svg'), ratio: 8340.9 / 1525.9 },
};
// <img> of the lockup at a given height in px, colourway 'color' | 'reversed'
const lockupImg = (h, way) => {
  const L = h < 26 ? LOGO.lockupSm : LOGO.lockup;
  return `<img src="${L[way]}" alt="innmobi" style="display:block;height:${h}px;width:${Math.round(h * L.ratio)}px"/>`;
};

// ====== TEMPLATES ======

// Profile photo: the isotipo (general cut, arch + bubble) centred. Always 1024x1024 (escala bien).
// Platforms crop to a circle, so the mark sits well inside the inscribed circle (55 % of the side, as in the kit's avatars).
const profileHTML = (variant, size = 1024) => {
  const themes = {
    ink:   { bg: '#0F0F10', way: 'reversed' },
    bone:  { bg: '#F2EFE9', way: 'color' },
  };
  const t = themes[variant];
  const h = Math.round(size * 0.55);
  return `<!doctype html><html><head><style>
    *{box-sizing:border-box;margin:0;padding:0;}
    html,body{width:${size}px;height:${size}px;background:${t.bg};overflow:hidden;}
    .frame{position:relative;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;}
    img{display:block;height:${h}px;width:${Math.round(h * LOGO.isotipo.ratio)}px;}
  </style></head><body><div class="frame"><img src="${LOGO.isotipo[t.way]}" alt="innmobi"/></div></body></html>`;
};

// Cover: 5 plataformas × 2 variantes (light/dark) = 10
// Layout: top frame (eyebrow + meta), brass divider, headline center, brass divider, bottom frame (wordmark + meta)

const coverHTML = ({ width, height, variant, headline, subhead = '', topLeft = 'INNMOBI.AI · CDMX · 2026', topRight = 'AGENTE DE VOZ CON IA', headlineScale = 0.18 }) => {
  const themes = {
    light: { bg: '#F2EFE9', text: '#0F0F10', muted: '#4A4A52', frame: '#A77E2B', eyebrow: '#4A4A52', em: '#1F3A2D', way: 'color' },
    dark:  { bg: '#0F0F10', text: '#F2EFE9', muted: '#A8A6A0', frame: '#C9A661', eyebrow: '#C9A661', em: '#C9A661', way: 'reversed' },
  };
  const t = themes[variant];
  const headlineSize = Math.round(height * headlineScale);
  const padX = Math.round(width * 0.04);
  const padY = Math.round(height * 0.08);
  const eyebrowSize = Math.max(11, Math.round(height * 0.025));
  const wmHeight = Math.max(20, Math.round(height * 0.11));

  return `<!doctype html><html><head><style>
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&family=JetBrains+Mono:wght@500&display=swap');
    *{box-sizing:border-box;margin:0;padding:0;}
    html,body{width:${width}px;height:${height}px;background:${t.bg};font-family:'Fraunces',serif;color:${t.text};overflow:hidden;}
    .frame{width:${width}px;height:${height}px;padding:${padY}px ${padX}px;display:flex;flex-direction:column;justify-content:space-between;}
    .row{display:flex;justify-content:space-between;align-items:center;font-family:'JetBrains Mono',monospace;font-size:${eyebrowSize}px;letter-spacing:0.18em;color:${t.muted};text-transform:uppercase;}
    .eyebrow{color:${t.eyebrow};} /* brass never carries text on cream */
    .brass-line{height:1px;background:${t.frame};opacity:0.5;margin:${Math.round(padY*0.25)}px 0;}
    .head{font-size:${headlineSize}px;font-weight:600;font-variation-settings:'opsz' 144;line-height:1.04;letter-spacing:-0.025em;max-width:${Math.round(width*0.92)}px;}
    em{font-style:italic;color:${t.em};}
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
          <span class="wm">${lockupImg(wmHeight, t.way)}</span>
          <span>${width < 1200 ? 'CDMX 🇲🇽' : 'innmobi.ai · CDMX 🇲🇽'}</span>
        </div>
      </div>
    </div>
  </body></html>`;
};

// Instagram highlight cover (1080x1080, displayed as small circle on profile).
// Solo isotipo + etiqueta. Útil para categorías de stories.
const highlightHTML = ({ label, variant = 'bone' }) => {
  const themes = {
    ink:   { bg: '#0F0F10', way: 'reversed', label: '#C9A661' },
    bone:  { bg: '#F2EFE9', way: 'color',    label: '#4A4A52' },
  };
  const t = themes[variant];
  const h = 400;
  return `<!doctype html><html><head><style>
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500&display=swap');
    *{box-sizing:border-box;margin:0;padding:0;}
    html,body{width:1080px;height:1080px;background:${t.bg};overflow:hidden;}
    .frame{width:1080px;height:1080px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:64px;}
    img{display:block;height:${h}px;width:${Math.round(h * LOGO.isotipo.ratio)}px;}
    .lbl{font-family:'JetBrains Mono',monospace;font-size:48px;letter-spacing:0.32em;color:${t.label};text-transform:uppercase;padding-left:0.32em;}
  </style></head><body><div class="frame"><img src="${LOGO.isotipo[t.way]}" alt="innmobi"/><span class="lbl">${label}</span></div></body></html>`;
};

// ====== TARGETS ======

const TARGETS = [
  // Profile photos (square, displayed as circle)
  { name: 'profile-ink-1024',    size: { width: 1024, height: 1024 }, html: profileHTML('ink') },
  { name: 'profile-bone-1024',   size: { width: 1024, height: 1024 }, html: profileHTML('bone') },
  // Smaller profile size for some platforms (400 source)
  { name: 'profile-ink-400',     size: { width: 400,  height: 400  }, html: profileHTML('ink', 400) },

  // Facebook cover (1640×856 source, FB renders 851×315)
  { name: 'cover-facebook-light', size: { width: 1640, height: 856 }, html: coverHTML({
    width: 1640, height: 856, variant: 'light', headlineScale: 0.13,
    headline: 'Contesta, agenda<br/>y <em>deja todo registrado.</em>',
    subhead: 'Agente de voz con IA · Pilotos 2026 · CDMX'
  })},
  { name: 'cover-facebook-dark',  size: { width: 1640, height: 856 }, html: coverHTML({
    width: 1640, height: 856, variant: 'dark', headlineScale: 0.13,
    headline: 'Contesta, agenda<br/>y <em>deja todo registrado.</em>',
    subhead: 'Agente de voz con IA · Pilotos 2026 · CDMX'
  })},

  // LinkedIn personal profile banner (1584×396, ratio 4:1)
  { name: 'cover-linkedin-personal-light', size: { width: 1584, height: 396 }, html: coverHTML({
    width: 1584, height: 396, variant: 'light', headlineScale: 0.18,
    headline: 'Contesta, agenda y <em>deja todo registrado.</em>',
    topRight: 'INNMOBI.AI · CDMX'
  })},
  { name: 'cover-linkedin-personal-dark', size: { width: 1584, height: 396 }, html: coverHTML({
    width: 1584, height: 396, variant: 'dark', headlineScale: 0.18,
    headline: 'Contesta, agenda y <em>deja todo registrado.</em>',
    topRight: 'INNMOBI.AI · CDMX'
  })},

  // LinkedIn company page banner (1128×191, ratio ~5.9:1, muy aplastado)
  { name: 'cover-linkedin-company-light', size: { width: 1128, height: 191 }, html: coverHTML({
    width: 1128, height: 191, variant: 'light', headlineScale: 0.30,
    headline: 'Agente de voz con IA <em>para inmobiliarias.</em>',
    topRight: 'CDMX 🇲🇽'
  })},
  { name: 'cover-linkedin-company-dark', size: { width: 1128, height: 191 }, html: coverHTML({
    width: 1128, height: 191, variant: 'dark', headlineScale: 0.30,
    headline: 'Agente de voz con IA <em>para inmobiliarias.</em>',
    topRight: 'CDMX 🇲🇽'
  })},

  // Instagram highlight covers (round on profile, source 1080×1080)
  { name: 'ig-highlight-producto',  size: { width: 1080, height: 1080 }, html: highlightHTML({ label: 'Producto' }) },
  { name: 'ig-highlight-casos',     size: { width: 1080, height: 1080 }, html: highlightHTML({ label: 'Lecciones' }) },
  { name: 'ig-highlight-equipo',    size: { width: 1080, height: 1080 }, html: highlightHTML({ label: 'Equipo' }) },
  { name: 'ig-highlight-recursos',  size: { width: 1080, height: 1080 }, html: highlightHTML({ label: 'Recursos' }) },
];

async function main() {
  console.log('innmobi — Rendering social profile assets');
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
