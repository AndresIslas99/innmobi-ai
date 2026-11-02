// End-to-end test of /demo-en-vivo/ (the web call page) against the mock API, with no real microphone and no ElevenLabs:
// the vendored SDK is replaced by a stub that "connects" with a conversation id, and getUserMedia is faked.
// Everything else is the real built page (docs/), the real script, and the mock of GET /v1/demo/web/state.
// Usage: node scripts/tablero-mock/test-web.mjs [shotsDir]      (build first: node scripts/build-site.mjs)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createMock } from './mock-server.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'docs');
const SHOTS = process.argv[2] || path.join(ROOT, '..', 'test-results', 'web-demo');
fs.mkdirSync(SHOTS, { recursive: true });

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon' };
const site = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => site.listen(0, '127.0.0.1', r));
const sitePort = site.address().port;
const mock = await createMock(0);
const PAGE = `http://127.0.0.1:${sitePort}/demo-en-vivo/?api=http://127.0.0.1:${mock.port}`;

// The SDK as the page sees it: startSession calls onConnect with an id (like the real one, before it resolves) and returns a session.
const SDK_STUB = `
export const Conversation = {
  async startSession(opts) {
    window.__sdk = { opts, ended: false, calls: (window.__sdk?.calls ?? 0) + 1 };
    const id = window.__convId ?? 'conv_webtest0001';
    await new Promise((r) => setTimeout(r, 40));
    opts.onConnect(window.__connectNoId ? {} : { conversationId: id });
    opts.onMessage({ source: 'ai', message: 'Hola, soy Valeria, asistente de inteligencia artificial de Inmobiliaria Demo Valle. Esta demostración se graba. ¿En qué le ayudo?' });
    return {
      getId: () => id,
      getInputVolume: () => 0.2,
      getOutputVolume: () => 0.3,
      endSession: async () => { window.__sdk.ended = true; opts.onDisconnect({ reason: 'user' }); },
    };
  },
};`;

const browser = await chromium.launch();
let failures = 0;
const step = async (name, fn) => { try { await fn(); console.log('ok  ', name); } catch (e) { failures++; console.log('FAIL', name, '\n    ', e.message.split('\n').slice(0, 8).join('\n     ')); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (page, name, settleMs = 500) => { await page.waitForTimeout(settleMs); await page.screenshot({ path: path.join(SHOTS, name + '.png') }); };
const text = (page, sel) => page.locator(sel).first().textContent().then((t) => t.replace(/\s+/g, ' ').trim()); // page may also be a Locator

// A fresh browser context per scenario, with the outside world blocked (fonts, analytics) and the SDK stubbed.
async function open(viewport, { convId, connectNoId = false } = {}) {
  const ctx = await browser.newContext({ viewport, locale: 'es-MX' });
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  await ctx.route('**/vendor/elevenlabs-client-1.26.0.js', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: SDK_STUB }));
  await ctx.addInitScript(({ convId, connectNoId }) => {
    if (convId !== undefined) window.__convId = convId;
    window.__connectNoId = connectNoId;
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) }, configurable: true });
  }, { convId, connectNoId });
  const page = await ctx.newPage();
  const requests = [];
  page.on('request', (r) => requests.push({ url: r.url(), headers: r.headers(), method: r.method() }));
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // Chromium logs every non-2xx fetch and image as a console error; those are expected here (404 = "not created yet", missing photos).
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.goto(PAGE);
  return { ctx, page, requests, errors };
}

async function call(page) {
  await page.check('#dl-consent');
  await page.click('#dl-btn');
  await page.waitForFunction(() => document.getElementById('dl').dataset.state === 'live');
}

const stateHits = (requests) => requests.filter((r) => r.url.includes('/v1/demo/web/state'));
const CONV = 'conv_webtest0001';

// The "imagen ilustrativa" caption says the photo is a look-alike, so it must be readable whole: inside its photo and not cut by it.
async function captionsWhole(page) {
  const caps = await page.evaluate(() => [...document.querySelectorAll('#dl-props-list .dl-prop-photo:not(.is-missing)')].map((photo) => {
    const ill = photo.querySelector('.dl-prop-ill');
    const range = document.createRange();
    range.selectNodeContents(ill);
    const t = range.getBoundingClientRect(), box = photo.getBoundingClientRect();
    return {
      text: ill.textContent,
      fits: ill.scrollWidth <= ill.clientWidth + 0.5 && ill.scrollHeight <= ill.clientHeight + 0.5,
      inside: t.left >= box.left - 0.5 && t.right <= box.right + 0.5 && t.top >= box.top - 0.5 && t.bottom <= box.bottom + 0.5,
    };
  }));
  assert.ok(caps.length >= 1, 'no card with a photo to check');
  for (const c of caps) assert.ok(c.fits && c.inside && c.text === 'imagen ilustrativa', `caption cut or changed: ${JSON.stringify(c)}`);
}

// The ribbon on a card ("Pidió detalles", "Visita agendada (demo)") stays inside the card.
async function ribbonsInside(page) {
  const out = await page.evaluate(() => [...document.querySelectorAll('#dl-props-list .dl-prop')].map((card) => {
    const flags = card.querySelector('.dl-prop-flags').getBoundingClientRect(), box = card.getBoundingClientRect();
    return { id: card.dataset.id, over: Math.max(0, flags.right - box.right) };
  }));
  for (const c of out) assert.ok(c.over <= 0.5, `ribbon of ${c.id} sticks out of its card by ${c.over}px`);
}

async function noPageOverflow(page, what) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(over <= 0, `${what}: the page overflows by ${over}px`);
}

// ---------------------------------------------------------------------------
console.log('--- desktop 1280x900');
{
  const { ctx, page, requests, errors } = await open({ width: 1280, height: 900 });

  await step('copy: recorded 30 days, Inmobiliaria Demo Valle, 15 minutes; no stale claims', async () => {
    const main = await page.locator('main').textContent();
    for (const must of ['Inmobiliaria Demo Valle', 'Ciudad de México y en Puebla', 'se graba', '30 días', 'ElevenLabs', 'Museo Soumaya', 'Angelópolis', 'BUAP', 'requisitos para rentar', 'videollamada', '0:00 / 15:00']) {
      assert.ok(main.includes(must), `missing "${must}"`);
    }
    for (const mustNot of ['SIMULACIÓN', 'Simulación', 'simulación', 'Narvarte', 'el audio no se graba', 'ni en servidores propios', '90 días', '5:00 ']) {
      assert.ok(!main.replace('0:00 / 15:00', '').includes(mustNot), `stale "${mustNot}"`);
    }
    assert.equal(await page.locator('.dl-sim-tag').count(), 0);
    assert.match(await page.locator('meta[name=description]').getAttribute('content'), /Puebla/);
    await shot(page, 'desktop-1-idle');
  });

  await step('the script has no client tools, the timeout text says quince minutos, the agent id is the placeholder or a real id', async () => {
    const js = await (await fetch(`http://127.0.0.1:${sitePort}/assets/js/demo-en-vivo.js`)).text();
    assert.ok(!/clientTools/.test(js.replace(/\/\/.*$/gm, '')));
    assert.ok(js.includes('Se acabó el tiempo de la prueba (quince minutos).'));
    assert.ok(js.includes('const MAX_CALL_SECONDS = 900;'));
    // The placeholder until the lead creates the web agent; then its id. The CI guard (validate.yml and the deploy workflow) refuses the placeholder.
    const agentId = /^const AGENT_ID = "([^"]*)";$/m.exec(js)?.[1];
    assert.ok(agentId === 'agent_PENDING_V6_WEB' || /^agent_[a-z0-9]+$/.test(agentId ?? ''), `AGENT_ID is "${agentId}"`);
    assert.ok(js.includes('connectionType: "websocket"') && js.includes('dynamicVariables: dynamicVariables()'));
  });

  await step('nothing is requested from the API before a call', async () => {
    await sleep(1200);
    assert.equal(stateHits(requests).length, 0);
    assert.equal(await text(page, '#dl-team-tag'), 'Sin llamada');
  });

  await step('connecting: id from the SDK is polled every 2 s; 404 is quiet; the request carries nothing', async () => {
    await call(page);
    assert.equal(await text(page, '#dl-status-text'), 'Escuchando');
    assert.match(await text(page, '#dl-timer'), /^0:0\d \/ 15:00$/);
    assert.equal(await text(page, '#dl-team-tag'), 'Esperando');
    await page.waitForFunction(() => document.querySelector('#dl-transcript .dl-line-ai') !== null);
    mock.clearWebHits();
    await sleep(5300);
    const hits = mock.webHits();
    assert.ok(hits.length >= 2 && hits.length <= 3, `expected 2-3 polls in 5.3 s, got ${hits.length}`);
    for (let i = 1; i < hits.length; i++) assert.ok(hits[i] - hits[i - 1] >= 1800 && hits[i] - hits[i - 1] <= 2600, `interval ${hits[i] - hits[i - 1]} ms`);
    assert.ok(await page.locator('#dl-team-notice').isHidden(), '404 must stay quiet');
    const req = stateHits(requests)[0];
    assert.equal(new URL(req.url).pathname, '/v1/demo/web/state');
    assert.equal(new URL(req.url).searchParams.get('conversation_id'), CONV);
    assert.equal(req.method, 'GET');
    for (const h of ['authorization', 'cookie', 'referer', 'content-type']) assert.equal(req.headers[h], undefined, `${h} must not be sent`);
    // fonts and analytics are the site's own (blocked in this test); the call itself goes nowhere but the stubbed SDK
    const outside = requests.filter((r) => !/^http:\/\/127\.0\.0\.1/.test(r.url) && !r.url.startsWith('data:') && !/^https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com|plausible\.io)\//.test(r.url));
    assert.deepEqual(outside.map((r) => r.url), [], 'no outside request');
  });

  await step('the team panel fills in from the server call (lead, budget, cards, visit, question, handoff, ledger)', async () => {
    mock.playWeb({ id: CONV, gap: 250 });
    await page.waitForFunction(() => document.querySelector('#dl-lead [data-field=nombre]').textContent === 'Mariana', null, { timeout: 8000 });
    await page.waitForFunction(() => /Solicitado/.test(document.getElementById('dl-handoff-value').textContent), null, { timeout: 12000 });
    assert.equal(await text(page, '#dl-team-tag'), 'En vivo');
    assert.equal(await text(page, '#dl-lead [data-field=tipo_unidad]'), 'departamento de dos recámaras en Anzures');
    assert.equal(await text(page, '#dl-lead [data-field=proposito]'), 'para rentar');
    assert.equal(await text(page, '#dl-lead [data-field=plazo]'), 'por definir');
    assert.equal(await text(page, '#dl-budget-value'), 'hasta treinta mil pesos al mes');

    const cards = page.locator('#dl-props-list .dl-prop');
    assert.equal(await cards.count(), 4);
    assert.equal(await text(page, '#dl-props-count'), '4');
    assert.ok(await page.locator('#dl-props-empty').isHidden());
    const c0 = (await cards.nth(0).innerText()).replace(/\s+/g, ' ');
    assert.match(c0, /RENTA/i); assert.match(c0, /Departamento de dos recámaras en Anzures/); assert.match(c0, /^.*Anzures/);
    assert.match(c0, /\$28,500 \/ mes/); assert.match(c0, /72 m² · 2 recámaras/); assert.match(c0, /imagen ilustrativa/);
    const c1 = (await cards.nth(1).innerText()).replace(/\s+/g, ' ');
    assert.match(c1, /Lomas de Angelópolis/); assert.match(c1, /\$21,000 \/ mes/);
    const c2 = (await cards.nth(2).innerText()).replace(/\s+/g, ' ');
    assert.match(c2, /PREVENTA/i); assert.match(c2, /Desde \$3,250,000/); assert.match(c2, /58 m² · 1 recámara\b/);
    const c3 = (await cards.nth(3).innerText()).replace(/\s+/g, ' ');
    assert.match(c3, /Casa en La Paz, Puebla/); assert.match(c3, /\$4,200,000/); assert.ok(!/Desde/.test(c3));
    // the city is on every card, so La Paz (Puebla) and a colonia of Mexico City cannot be mistaken for each other
    assert.deepEqual(await page.locator('#dl-props-list .dl-prop .dl-prop-zona').allInnerTexts(),
      ['Anzures · Ciudad de México', 'Lomas de Angelópolis · Puebla', 'Narvarte Poniente · Ciudad de México', 'La Paz · Puebla']);
    // photos: the site's own images, with a placeholder when the file is missing
    assert.equal(await cards.nth(0).locator('img').getAttribute('src'), '/assets/demo/catalogo/RN-NAR-01.webp');
    await page.waitForFunction(() => document.querySelector('#dl-props-list .dl-prop:nth-child(4) .dl-prop-photo').classList.contains('is-missing'));
    assert.equal(await cards.nth(3).locator('img').count(), 0);
    await page.waitForFunction(() => { const i = document.querySelector('#dl-props-list .dl-prop img'); return i && i.complete && i.naturalWidth > 0; });
    // the property asked about and the one with a visit
    assert.ok(await cards.nth(1).evaluate((n) => n.classList.contains('is-viewed') && n.classList.contains('is-visit')));
    assert.ok(await cards.nth(0).evaluate((n) => !n.classList.contains('is-viewed') && !n.classList.contains('is-visit')));

    // the booking is fictional and the panel says so where the visitor looks: the block title and the chip on the card
    assert.equal(await text(page, '#dl-visit .dl-h'), 'Visita agendada (demo)');
    assert.equal(await text(cards.nth(1), '.dl-flag-visit'), 'Visita agendada (demo)');
    assert.ok(await cards.nth(1).locator('.dl-flag-visit').isVisible());
    await captionsWhole(page);
    await ribbonsInside(page);
    assert.equal(await text(page, '#dl-visit [data-field=dia]'), 'martes 3 de noviembre');
    assert.equal(await text(page, '#dl-visit [data-field=hora]'), '16:00');
    assert.equal(await text(page, '#dl-visit [data-field=modalidad]'), 'Videollamada');
    assert.equal(await text(page, '#dl-visit-prop'), 'Propiedad: Departamento en Lomas de Angelópolis');
    assert.equal(await text(page, '#dl-visit-place'), 'Lugar: Videollamada con un asesor');
    assert.ok(await page.locator('#dl-visit-follow').isHidden());
    assert.equal(await text(page, '#dl-questions-list'), '¿Piden aval o fiador para rentar?');
    assert.ok(await page.locator('#dl-questions-empty').isHidden());
    assert.equal(await text(page, '#dl-handoff-value'), 'Solicitado. Motivo: quiere hablar con un asesor sobre el depósito');
    assert.ok(await page.locator('#dl-handoff-value').evaluate((n) => n.classList.contains('is-alert')));

    const rows = page.locator('#dl-ledger .dl-ledger-row');
    assert.equal(await rows.count(), 11, 'nine server rows and two page rows');
    assert.match(await rows.first().innerText(), /Pidió hablar con una persona/);
    const all = await page.locator('#dl-ledger').innerText();
    for (const want of ['Conversación web', 'Interés: departamento de dos recámaras', 'Horarios ofrecidos', 'Visita reservada', 'Consentimiento aceptado', 'Llamada iniciada']) assert.ok(all.includes(want), `ledger lacks "${want}"`);
    assert.match(await rows.first().locator('time').innerText(), /^\d\d:\d\d:\d\d$/);
    assert.ok(await page.locator('#dl-ledger-empty').isHidden());
    await shot(page, 'desktop-2-team-panel');
  });

  await step('polling does not replay animations: after the panel settles nothing in it is still animating', async () => {
    await sleep(3500); // at least one more poll with no news
    const running = await page.evaluate(() => document.getAnimations()
      .filter((a) => a.playState === 'running' && a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('#dl-team'))
      .map((a) => `${a.animationName || a.transitionProperty} on ${a.effect.target.className}`));
    assert.deepEqual(running, []);
    const faint = await page.evaluate(() => [...document.querySelectorAll('#dl-ledger .dl-ledger-row, #dl-props-list .dl-prop')].filter((n) => getComputedStyle(n).opacity !== '1').length);
    assert.equal(faint, 0, 'rows and cards are fully opaque once settled');
    await page.screenshot({ path: path.join(SHOTS, 'desktop-3-full-page.png'), fullPage: true, animations: 'disabled' });
  });

  await step('hanging up: summary from the server call, one last poll picks up a late event, then polling stops', async () => {
    await page.click('#dl-btn');
    await page.waitForFunction(() => document.getElementById('dl').dataset.state === 'ended');
    const endedAt = Date.now();
    assert.equal(await text(page, '#dl-team-tag'), 'Llamada terminada');
    assert.ok(await page.locator('#dl-summary').isVisible());
    const sum = (await page.locator('#dl-summary-list').innerText()).replace(/\s+/g, ' ');
    assert.match(sum, /Lead Mariana · departamento de dos recámaras en Anzures · para rentar · por definir/i);
    assert.match(sum, /Presupuesto declarado hasta treinta mil pesos al mes/i);
    assert.match(sum, /Propiedades sugeridas Departamento de dos recámaras en Anzures · Departamento en Lomas de Angelópolis/i);
    assert.match(sum, /Visita martes 3 de noviembre, 16:00 · Videollamada · Departamento en Lomas de Angelópolis/i);
    assert.match(sum, /Preguntas por confirmar ¿Piden aval o fiador para rentar\?/i);
    assert.match(sum, /Traspaso a una persona Solicitado: quiere hablar con un asesor sobre el depósito/i);
    assert.match(await page.locator('#dl-ledger .dl-ledger-row').first().innerText(), /Llamada terminada\s+La persona colgó\./);
    assert.match(await text(page, '.dl-summary-note'), /ficticias.*no se reservó ni se envió nada real/);
    await shot(page, 'desktop-4-ended');

    mock.emit(mock.refOf(CONV), 'question', { pregunta: 'pregunta tardía' }, 'Pregunta por confirmar: pregunta tardía');
    await page.waitForFunction(() => document.getElementById('dl-questions-list').textContent.includes('pregunta tardía'), null, { timeout: 6000 });
    await sleep(6000);
    const after = mock.webHits().filter((t) => t >= endedAt - 50).length;
    assert.equal(after, 1, `exactly one last poll after the call, got ${after}`);
    assert.match((await page.locator('#dl-summary-list').innerText()).replace(/\s+/g, ' '), /Preguntas por confirmar .*pregunta tardía/i);
  });

  await step('"Volver a probar" clears the panel and the tag, and nothing is polled', async () => {
    mock.clearWebHits();
    await page.click('#dl-reset');
    await page.waitForFunction(() => document.getElementById('dl').dataset.state === 'idle');
    assert.equal(await text(page, '#dl-lead [data-field=nombre]'), '—');
    assert.equal(await page.locator('#dl-props-list .dl-prop').count(), 0);
    assert.ok(await page.locator('#dl-props-empty').isVisible());
    assert.equal(await page.locator('#dl-questions-list li').count(), 0);
    assert.equal(await text(page, '#dl-handoff-value'), 'No solicitado.');
    assert.equal(await text(page, '#dl-visit [data-field=dia]'), '—');
    assert.equal(await page.locator('#dl-ledger .dl-ledger-row').count(), 0);
    assert.ok(await page.locator('#dl-ledger-empty').isVisible());
    assert.equal(await text(page, '#dl-team-tag'), 'Sin llamada');
    assert.equal(await text(page, '#dl-timer'), '0:00 / 15:00');
    assert.ok(await page.locator('#dl-summary').isHidden());
    await sleep(2500);
    assert.equal(mock.webHits().length, 0);
  });

  await step('no storage, no cookies, no page errors', async () => {
    const used = await page.evaluate(() => ({ ls: localStorage.length, ss: sessionStorage.length, cookie: document.cookie }));
    assert.deepEqual(used, { ls: 0, ss: 0, cookie: '' });
    assert.deepEqual(errors, []);
  });
  await ctx.close();
}

// ---------------------------------------------------------------------------
console.log('--- model-controlled text is never markup');
{
  const id = 'conv_webhostile1';
  const { ctx, page, requests, errors } = await open({ width: 1280, height: 900 }, { convId: id });
  await step('names, questions, property names and image URLs from the server are shown as text only', async () => {
    await call(page);
    mock.playWeb({ id, gap: 200, hostile: true });
    await page.waitForFunction(() => /Solicitado/.test(document.getElementById('dl-handoff-value').textContent), null, { timeout: 12000 });
    assert.equal(await page.evaluate(() => window.__pwned), undefined);
    assert.equal(await text(page, '#dl-lead [data-field=nombre]'), '<script>window.__pwned=2</script>Mariana');
    assert.equal(await page.locator('#dl-team script, #dl-team img[src="x"]').count(), 0);
    assert.match(await text(page, '#dl-questions-list'), /^<img src=x onerror="window.__pwned=3">/);
    const last = page.locator('#dl-props-list .dl-prop').nth(4);
    assert.match(await last.innerText(), /<img src=x onerror="window.__pwned=1">Casa trampa/);
    assert.match(await last.innerText(), /<b>Zona<\/b>/);
    // no municipality in the item and a `ciudad` that is no known code, so no city is guessed (and the server's text is never the label)
    assert.equal(await last.locator('.dl-prop-zona').innerText(), '<b>Zona</b>');
    // an unknown `ciudad` falls back to the municipality; a known one beats it
    assert.equal(await page.locator('#dl-props-list .dl-prop').nth(5).locator('.dl-prop-zona').innerText(), 'Centro · Puebla');
    assert.equal(await page.locator('#dl-props-list .dl-prop').nth(6).locator('.dl-prop-zona').innerText(), 'Centro · Ciudad de México');
    // the photo URL is derived from the id (and 404s here, so the placeholder shows), never the server's own URL
    await page.waitForFunction(() => document.querySelector('#dl-props-list .dl-prop:nth-child(5) .dl-prop-photo').classList.contains('is-missing'));
    assert.ok(requests.some((r) => r.url.endsWith('/assets/demo/catalogo/XX-1.webp')));
    assert.ok(requests.every((r) => !r.url.includes('evil.example')));
    await shot(page, 'hostile-1');
    assert.deepEqual(errors, []);
  });
  await ctx.close();
}

// ---------------------------------------------------------------------------
console.log('--- the server says "ended" while the call is still connected');
{
  const id = 'conv_webidle0001';
  const { ctx, page, errors } = await open({ width: 1280, height: 900 }, { convId: id });
  await step('the tag stays "En vivo" and the button "Colgar"; only the hang-up ends the call on screen', async () => {
    await call(page);
    await mock.playWeb({ id, gap: 40, end: true }); // ends with the server's own call_ended, as its idle timeout would
    await page.waitForFunction(() => document.getElementById('dl-ledger').textContent.includes('(1 min 35 s)'), null, { timeout: 8000 }); // the server's row
    assert.equal(await text(page, '#dl-team-tag'), 'En vivo');
    assert.equal(await page.locator('#dl-team-tag').getAttribute('data-state'), 'live');
    assert.equal(await text(page, '#dl-btn'), 'Colgar');
    assert.equal(await text(page, '#dl-status-text'), 'Escuchando');
    assert.equal(await page.locator('#dl').getAttribute('data-state'), 'live');
    assert.ok(await page.locator('#dl-summary').isHidden());
    await sleep(2500); // another poll with the same answer
    assert.equal(await text(page, '#dl-team-tag'), 'En vivo');
    await page.click('#dl-btn');
    await page.waitForFunction(() => document.getElementById('dl').dataset.state === 'ended');
    assert.equal(await text(page, '#dl-team-tag'), 'Llamada terminada');
    assert.equal(await page.locator('#dl-team-tag').getAttribute('data-state'), 'ended');
    assert.ok(await page.locator('#dl-summary').isVisible());
    assert.deepEqual(errors, []);
  });
  await ctx.close();
}

// ---------------------------------------------------------------------------
console.log('--- one long unbroken word from the server wraps, and the card captions are whole');
const LONG = 'https://' + 'x'.repeat(970); // under the backend's 1000-character cap
for (const [label, viewport, id] of [['desktop 1280', { width: 1280, height: 900 }, 'conv_weblong0001'], ['mobile 375', { width: 375, height: 812 }, 'conv_weblong0002']]) {
  const { ctx, page, errors } = await open(viewport, { convId: id });
  const mobile = viewport.width < 900;
  await step(`${label}: question, hand-off reason and ledger rows wrap; so does the summary after the call`, async () => {
    await call(page);
    await mock.playWeb({ id, gap: 30 });
    const ref = mock.refOf(id);
    mock.emit(ref, 'question', { pregunta: LONG }, `Pregunta por confirmar: ${LONG}`);
    mock.emit(ref, 'handoff', { motivo: LONG }, `Pidió hablar con una persona: ${LONG}`);
    if (mobile) await page.click('#dl-tab-team');
    await page.waitForFunction(() => document.getElementById('dl-handoff-value').textContent.includes('xxxxxxxxxx'), null, { timeout: 8000 });
    await noPageOverflow(page, label);
    for (const sel of ['#dl-questions-list li:last-child', '#dl-handoff-value', '#dl-ledger .dl-ledger-text']) {
      const fits = await page.locator(sel).first().evaluate((n) => n.scrollWidth <= n.clientWidth + 1);
      assert.ok(fits, `${sel} is wider than its box`);
    }
    // the cards at this width: whole caption, ribbons inside
    await page.waitForFunction(() => document.querySelector('#dl-props-list .dl-prop:nth-child(4) .dl-prop-photo').classList.contains('is-missing'));
    await captionsWhole(page);
    await ribbonsInside(page);
    await page.evaluate(() => document.getElementById('dl-props').scrollIntoView());
    await shot(page, `long-1-${viewport.width}-cards`);
    if (mobile) {
      for (const width of [320, 360, 414]) { // the ribbons and the caption hold on the other phone widths too
        await page.setViewportSize({ width, height: 812 });
        await sleep(150);
        await captionsWhole(page);
        await ribbonsInside(page);
        await noPageOverflow(page, `${width} px`);
      }
      await page.setViewportSize(viewport);
    }
    if (mobile) await page.click('#dl-tab-call');
    await page.click('#dl-btn');
    await page.waitForFunction(() => document.getElementById('dl').dataset.state === 'ended');
    await noPageOverflow(page, `${label} summary`);
    const dds = await page.locator('#dl-summary-list dd').evaluateAll((list) => list.filter((n) => n.textContent.includes('xxxxxxxxxx')).map((n) => n.scrollWidth <= n.clientWidth + 1));
    assert.ok(dds.length >= 2 && dds.every(Boolean), `summary rows with the long word: ${JSON.stringify(dds)}`);
    await shot(page, `long-2-${viewport.width}-summary`);
    assert.deepEqual(errors, []);
  });
  await ctx.close();
}

// ---------------------------------------------------------------------------
console.log('--- the id');
{
  const { ctx, page } = await open({ width: 1280, height: 900 }, { connectNoId: true });
  await step('without an id in onConnect, session.getId() is used', async () => {
    mock.clearWebHits();
    await call(page);
    await sleep(500);
    assert.ok(mock.webHits().length >= 1);
  });
  await ctx.close();
}
{
  const { ctx, page, requests } = await open({ width: 1280, height: 900 }, { convId: 'bad id/../x' });
  await step('an id that does not have the backend pattern never goes into a URL', async () => {
    await call(page);
    await sleep(3000);
    assert.equal(stateHits(requests).length, 0);
    assert.equal(await text(page, '#dl-team-tag'), 'Esperando');
  });
  await ctx.close();
}

// ---------------------------------------------------------------------------
console.log('--- mobile 390x844');
{
  const id = 'conv_webmobile01';
  const { ctx, page, errors } = await open({ width: 390, height: 844 }, { convId: id });
  await step('the team tab lights up, then shows the panel; no horizontal scroll', async () => {
    await call(page);
    assert.ok(await page.locator('#dl-team').isHidden());
    mock.playWeb({ id, gap: 200 });
    await page.waitForFunction(() => document.getElementById('dl-tab-team').classList.contains('has-news'), null, { timeout: 8000 });
    await shot(page, 'mobile-1-call');
    await page.click('#dl-tab-team');
    await page.waitForFunction(() => /Solicitado/.test(document.getElementById('dl-handoff-value').textContent), null, { timeout: 12000 });
    assert.ok(await page.locator('#dl-team').isVisible());
    assert.ok(!(await page.locator('#dl-tab-team').evaluate((n) => n.classList.contains('has-news'))));
    assert.equal(await page.locator('#dl-props-list .dl-prop').count(), 4);
    assert.deepEqual(await page.locator('#dl-props-list .dl-prop .dl-prop-zona').allInnerTexts().then((a) => a.map((t) => t.replace(/\s+/g, ' '))),
      ['Anzures · Ciudad de México', 'Lomas de Angelópolis · Puebla', 'Narvarte Poniente · Ciudad de México', 'La Paz · Puebla']);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflow <= 0, `horizontal overflow ${overflow}px`);
    await page.locator('#dl-team').scrollIntoViewIfNeeded();
    await page.evaluate(() => document.getElementById('dl-props').scrollIntoView());
    await shot(page, 'mobile-2-team-cards');
    await page.evaluate(() => document.getElementById('dl-ledger').scrollIntoView());
    await shot(page, 'mobile-3-team-ledger');
    assert.deepEqual(errors, []);
  });
  await ctx.close();
}

// ---------------------------------------------------------------------------
console.log('--- backoff (takes about 70 s)');
{
  const id = 'conv_webrate0001';
  const { ctx, page } = await open({ width: 1280, height: 900 }, { convId: id });
  const hitsAt = () => mock.webHits();
  const waitHits = async (n, timeout) => {
    const t0 = Date.now();
    while (hitsAt().length < n) { if (Date.now() - t0 > timeout) throw new Error(`still ${hitsAt().length} polls after ${timeout} ms, wanted ${n}`); await sleep(50); }
  };
  const gap = (hits, i) => hits[i] - hits[i - 1];
  await step('429 backs off 4 s then 8 s, each plus 20-30 percent; the notice comes with the third failure', async () => {
    await call(page);
    mock.playWeb({ id, gap: 100 });
    await page.waitForFunction(() => document.querySelector('#dl-lead [data-field=nombre]').textContent === 'Mariana', null, { timeout: 8000 });
    mock.setWebMode('rate'); // Retry-After 1 s: shorter than the steps, so the steps decide
    mock.clearWebHits();
    await page.waitForFunction(() => !document.getElementById('dl-team-notice').hidden, null, { timeout: 30000 });
    const hits = hitsAt();
    assert.equal(hits.length, 3, `three failed polls before the notice, got ${hits.length}`);
    assert.ok(gap(hits, 1) >= 4800 - 60 && gap(hits, 1) <= 5200 + 400, `first back-off ${gap(hits, 1)} ms, wanted 4800-5200`);
    assert.ok(gap(hits, 2) >= 9600 - 60 && gap(hits, 2) <= 10400 + 400, `second back-off ${gap(hits, 2)} ms, wanted 9600-10400`);
    const notice = await text(page, '#dl-team-notice');
    assert.match(notice, /muchas consultas/);
    assert.match(notice, /dentro de unos (20|25) segundos/, 'the notice says roughly how long the wait is');
    assert.doesNotMatch(notice, /en unos segundos/);
    assert.equal(await text(page, '#dl-lead [data-field=nombre]'), 'Mariana', 'the last good data stays on screen');
    await shot(page, 'desktop-5-rate-limited');
  });

  await step('one good read only eases off one step (still slow, notice stays); the second returns to 2 s and clears the notice', async () => {
    mock.setWebMode('ok');
    await waitHits(4, 30000); // the third back-off: 16 s plus 20-30 percent
    const t4 = hitsAt()[3];
    assert.ok(t4 - hitsAt()[2] >= 19200 - 60, `third back-off ${t4 - hitsAt()[2]} ms`);
    await sleep(300);
    assert.ok(await page.locator('#dl-team-notice').isVisible(), 'one good read does not clear the notice');
    await waitHits(5, 15000); // one step shorter than the failure that put the page here: 8 s plus 20-30 percent
    const h = hitsAt();
    assert.ok(gap(h, 4) >= 9600 - 60 && gap(h, 4) <= 10400 + 400, `after the first good read the page waited ${gap(h, 4)} ms, wanted 9600-10400`);
    await page.waitForFunction(() => document.getElementById('dl-team-notice').hidden, null, { timeout: 3000 });
    await waitHits(6, 6000);
    const after = hitsAt();
    assert.ok(gap(after, 5) >= 1800 && gap(after, 5) <= 2800, `after two good reads the cadence is 2 s again, got ${gap(after, 5)} ms`);
  });
  await ctx.close();
}

{
  const id = 'conv_webrate0002';
  const { ctx, page } = await open({ width: 1280, height: 900 }, { convId: id });
  await step('a Retry-After of 10 s or more shows the notice at once, says how long, and is never retried early', async () => {
    mock.setWebMode('rate', 10);
    mock.clearWebHits();
    await call(page);
    await page.waitForFunction(() => !document.getElementById('dl-team-notice').hidden, null, { timeout: 4000 });
    assert.equal(mock.webHits().length, 1, 'the notice came with the very first refusal');
    const notice = await text(page, '#dl-team-notice');
    assert.match(notice, /muchas consultas/);
    assert.match(notice, /dentro de unos 15 segundos/); // Retry-After 10 s plus 20-30 percent is 12 to 13 s
    assert.doesNotMatch(notice, /en unos segundos/);
    const t0 = Date.now();
    while (mock.webHits().length < 2) { if (Date.now() - t0 > 20000) throw new Error('no retry within 20 s'); await sleep(50); }
    const h = mock.webHits();
    assert.ok(h[1] - h[0] >= 12000 - 60 && h[1] - h[0] <= 13000 + 400, `retry after ${h[1] - h[0]} ms, wanted 12000-13000 (Retry-After plus 20-30 percent)`);
    mock.setWebMode('ok');
  });
  await ctx.close();
}

mock.close();
site.close();
await browser.close();
console.log(failures ? `\n${failures} step(s) FAILED` : `\nall steps passed; screenshots in ${SHOTS}`);
process.exit(failures ? 1 : 0);
