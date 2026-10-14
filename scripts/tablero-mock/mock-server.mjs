// Mock of the realestate-crm voice_demo panel API (ADR 0035) for developing and testing /demo-en-vivo/tablero/.
// Usage: node scripts/tablero-mock/mock-server.mjs [port]      (PIN: ABCD2345)
// Test controls (not part of the contract): /__play, /__play2, /__props, /__kill, /__restart, /__down, /__up, /__expire, /__emit
import http from 'node:http';
import crypto from 'node:crypto';

export const PIN = 'ABCD2345';
const TZ = 'America/Mexico_City';

// Fictional brokerage catalog (subset of closer-v5/catalog.json, only the fields the panel events carry).
export const CATALOG = Object.fromEntries([
 {
  "id": "RN-NAR-01",
  "nombre": "Departamento de dos recámaras en Narvarte",
  "operacion": "renta",
  "zona": "Narvarte Poniente",
  "renta_mensual_mxn": 15500,
  "m2": 60,
  "recamaras": 2,
  "imagen": "/assets/demo/catalogo/RN-NAR-01.webp"
 },
 {
  "id": "RA-POL-01",
  "nombre": "Departamento amueblado en Polanco",
  "operacion": "renta_amueblada",
  "zona": "Polanco",
  "renta_mensual_mxn": 36000,
  "m2": 80,
  "recamaras": 2,
  "imagen": "/assets/demo/catalogo/RA-POL-01.webp"
 },
 {
  "id": "RM-IZT-01",
  "nombre": "Departamento en remate en Iztapalapa",
  "operacion": "remate",
  "zona": "El Prado",
  "precio_mxn": 1250000,
  "m2": 55,
  "recamaras": 2,
  "imagen": "/assets/demo/catalogo/RM-IZT-01.webp"
 },
 {
  "id": "PV-NAR-01",
  "nombre": "Residencial Demo Narvarte",
  "operacion": "preventa",
  "zona": "Narvarte Poniente",
  "precio_mxn": 3250000,
  "m2": 58,
  "recamaras": 1,
  "imagen": "/assets/demo/catalogo/PV-NAR-01.webp"
 },
 {
  "id": "RV-COY-01",
  "nombre": "Casa con jardín en Coyoacán",
  "operacion": "reventa",
  "zona": "Del Carmen",
  "precio_mxn": 7600000,
  "m2": 170,
  "recamaras": 3,
  "imagen": "/assets/demo/catalogo/RV-COY-01.webp"
 },
 {
  "id": "RV-PED-01",
  "nombre": "Casa premium en el Pedregal",
  "operacion": "reventa",
  "zona": "Fuentes del Pedregal",
  "precio_mxn": 14800000,
  "m2": 280,
  "recamaras": 4,
  "imagen": "/assets/demo/catalogo/RV-PED-01.webp"
 },
 {
  "id": "CM-ROM-01",
  "nombre": "Local a pie de calle en la Roma",
  "operacion": "renta_comercial",
  "zona": "Roma Norte",
  "renta_mensual_mxn": 35000,
  "m2": 70,
  "recamaras": 0,
  "imagen": "/assets/demo/catalogo/CM-ROM-01.webp"
 },
 {
  "id": "TE-HUI-01",
  "nombre": "Terreno residencial cerca de Interlomas",
  "operacion": "terreno",
  "zona": "Interlomas",
  "precio_mxn": 6400000,
  "m2": 400,
  "recamaras": null,
  "imagen": "/assets/demo/catalogo/TE-HUI-01.webp"
 },
 {
  "id": "OC-SAT-01",
  "nombre": "Departamento con opción a compra en Satélite",
  "operacion": "renta_opcion_compra",
  "zona": "Ciudad Satélite",
  "renta_mensual_mxn": 18000,
  "precio_mxn": 3600000,
  "m2": 100,
  "recamaras": 2,
  "imagen": "/assets/demo/catalogo/OC-SAT-01.webp"
 },
 {
  "id": "RCP-GAM-01",
  "nombre": "Vivienda recuperada en San Juan de Aragón",
  "operacion": "recuperada",
  "zona": "San Juan de Aragón",
  "precio_mxn": 1180000,
  "m2": 52,
  "recamaras": 2,
  "imagen": "/assets/demo/catalogo/RCP-GAM-01.webp"
 }
].map((x) => [x.id, x]));
// A listing whose photo does not exist, to exercise the card fallback.
CATALOG['ZZ-DEMO-99'] = { id: 'ZZ-DEMO-99', nombre: 'Casa sin foto en Tlalpan', operacion: 'reventa', zona: 'Tlalpan Centro', precio_mxn: 5800000, m2: 210, recamaras: 3 };
const pick = (...ids) => ids.map((i) => CATALOG[i]);


export function createMock(port = 0) {
  let epoch = crypto.randomBytes(4).toString('hex');
  let seq = 0;
  let ring = [];
  let calls = new Map();
  const streams = new Set();
  let down = false;
  let token = null;

  const fmtAt = (d = new Date()) => {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(d).map((x) => [x.type, x.value]));
    return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}-06:00`;
  };

  function emit(call_ref, type, extra, text) {
    const ev = { epoch, seq: ++seq, type, call_ref, at: fmtAt(), text, ...extra };
    ring.push(ev);
    if (ring.length > 500) ring.shift();
    apply(ev);
    for (const s of streams) send(s, ev);
    return ev;
  }

  function apply(e) {
    let c = calls.get(e.call_ref);
    if (!c) {
      c = { call_ref: e.call_ref, caller: 'Número no disponible', status: 'active', started_at: e.at, ended_at: null, end_reason: null,
        lead: { nombre: null, tipo_unidad: null, proposito: null, plazo: null }, presupuesto: null, visita: null, preguntas: [], traspaso: null, ledger: [], propiedades: [], propiedad_consultada: null };
      calls.set(e.call_ref, c);
    }
    c.ledger.push({ seq: e.seq, at: e.at, type: e.type, text: e.text });
    if (e.type === 'call_started') c.caller = e.caller;
    if (e.type === 'interest') c.lead = { nombre: e.nombre, tipo_unidad: e.tipo_unidad, proposito: e.proposito, plazo: e.plazo };
    if (e.type === 'budget') c.presupuesto = e.rango;
    if (e.type === 'properties_suggested') { const items = Array.isArray(e.items) ? e.items : []; const keys = new Set(items.map((x) => x && x.id)); c.propiedades = [...items, ...c.propiedades.filter((x) => !keys.has(x && x.id))]; } // tolerant on purpose: the tests send malformed items
    if (e.type === 'property_viewed') c.propiedad_consultada = e.id;
    if (e.type === 'visit_reserved') c.visita = { dia: e.dia, hora: e.hora, iso: e.iso, sala: e.sala, propiedad_id: e.propiedad_id, propiedad_nombre: e.propiedad_nombre, modalidad: e.modalidad };
    if (e.type === 'question') c.preguntas.push(e.pregunta);
    if (e.type === 'handoff') c.traspaso = { motivo: e.motivo, at: e.at };
    if (e.type === 'call_ended') { c.status = 'ended'; c.ended_at = e.at; c.end_reason = e.reason; }
  }

  function send(res, ev) {
    res.write(`id: ${ev.seq}\nevent: ${ev.type}\ndata: ${JSON.stringify(ev)}\n\n`);
  }

  const ref = () => crypto.randomBytes(4).toString('hex');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  async function playCall({ gap = 900, caller = '+52 •• •••• ••12', name = 'Mariana' } = {}) {
    const r = ref();
    emit(r, 'call_started', { caller, source: 'phone' }, `Llamada entrante de ${caller}`);
    await wait(gap);
    emit(r, 'interest', { nombre: name, tipo_unidad: 'dos recámaras', proposito: 'para vivir', plazo: 'en tres meses' }, 'Interés: dos recámaras, para vivir, en tres meses');
    await wait(gap);
    emit(r, 'budget', { rango: 'entre cuatro y cinco millones de pesos' }, 'Presupuesto declarado por la persona: entre cuatro y cinco millones de pesos');
    await wait(gap);
    emit(r, 'slots_offered', { dia: null, opciones: [{ dia: 'jueves 15 de octubre', hora: '11:00' }, { dia: 'jueves 15 de octubre', hora: '12:00' }] }, 'Horarios ofrecidos: jueves 15 de octubre a las 11:00, 12:00');
    await wait(gap);
    emit(r, 'visit_reserved', { dia: 'jueves 15 de octubre', hora: '11:00', iso: '2026-10-15T11:00:00-06:00', sala: 'Sala de ventas de Residencial Demo Narvarte', replaces: null }, 'Visita reservada: jueves 15 de octubre a las 11:00');
    await wait(gap);
    emit(r, 'question', { pregunta: '¿Aceptan mascotas grandes en el edificio?' }, 'Pregunta por confirmar: ¿Aceptan mascotas grandes en el edificio?');
    await wait(gap);
    emit(r, 'handoff', { motivo: 'quiere hablar con un asesor sobre el enganche' }, 'Pidió hablar con una persona: quiere hablar con un asesor sobre el enganche');
    await wait(gap);
    emit(r, 'call_ended', { reason: 'post_call', duration_s: 252 }, 'Llamada terminada (4 min 12 s)');
    return r;
  }

  // A brokerage call: the caller wants to rent, then looks at other operations, asks about one and books a visit.
  async function playProps({ gap = 900, caller = '+52 •• •••• ••31', name = 'Victor', modalidad = 'Videollamada', visitId = 'RA-POL-01' } = {}) {
    const r = ref();
    const name_ = (id) => CATALOG[id].nombre;
    emit(r, 'call_started', { caller, source: 'phone' }, `Llamada entrante de ${caller}`);
    await wait(gap);
    emit(r, 'interest', { nombre: name, tipo_unidad: 'departamento de dos recámaras', proposito: 'para rentar', plazo: 'este mes' }, 'Interés: departamento de dos recámaras, para rentar, este mes');
    await wait(gap);
    const first = pick('RN-NAR-01', 'RA-POL-01', 'RM-IZT-01');
    emit(r, 'properties_suggested', { items: first }, `Propiedades sugeridas: ${first.map((x) => x.nombre).join(', ')}`);
    await wait(gap);
    emit(r, 'property_viewed', { id: 'RA-POL-01' }, `Pidió detalles de ${name_('RA-POL-01')}`);
    await wait(gap);
    const second = pick('PV-NAR-01', 'RV-COY-01', 'CM-ROM-01', 'TE-HUI-01', 'OC-SAT-01', 'ZZ-DEMO-99');
    emit(r, 'properties_suggested', { items: second }, `Propiedades sugeridas: ${second.map((x) => x.nombre).join(', ')}`);
    await wait(gap);
    emit(r, 'slots_offered', { dia: null, opciones: [{ dia: 'viernes 16 de octubre', hora: '10:00' }] }, 'Horarios ofrecidos: viernes 16 de octubre a las 10:00');
    await wait(gap);
    emit(r, 'visit_reserved', { dia: 'viernes 16 de octubre', hora: '10:00', iso: '2026-10-16T10:00:00-06:00', sala: modalidad === 'Sala de ventas' ? 'Sala de ventas de Inmobiliaria Demo Valle, Narvarte' : null, propiedad_id: visitId, propiedad_nombre: CATALOG[visitId].nombre, modalidad, replaces: null },
      `Visita reservada: ${CATALOG[visitId].nombre}, ${modalidad}, viernes 16 de octubre a las 10:00`);
    await wait(gap);
    emit(r, 'call_ended', { reason: 'post_call', duration_s: 187 }, 'Llamada terminada (3 min 7 s)');
    return r;
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const origin = req.headers.origin;
    const cors = origin ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin', 'Access-Control-Allow-Headers': 'Authorization, Content-Type, Last-Event-ID', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Max-Age': '600' } : {};
    const json = (code, body, extra = {}) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors, ...extra }); res.end(JSON.stringify(body)); };
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }

    // test controls
    if (url.pathname === '/__play') { playCall({ gap: Number(url.searchParams.get('gap') || 900) }); return json(200, { ok: true }); }
    if (url.pathname === '/__play2') { playCall({ gap: 300, caller: '+52 •• •••• ••47', name: 'Luis' }); return json(200, { ok: true }); }
    if (url.pathname === '/__props') {
      const q = url.searchParams;
      playProps({ gap: Number(q.get('gap') || 900), modalidad: q.get('modalidad') || 'Videollamada', visitId: q.get('visit') || 'RA-POL-01' });
      return json(200, { ok: true });
    }
    if (url.pathname === '/__kill') { for (const s of streams) s.destroy(); streams.clear(); return json(200, { ok: true }); }
    if (url.pathname === '/__restart') { epoch = crypto.randomBytes(4).toString('hex'); seq = 0; ring = []; calls = new Map(); for (const s of streams) s.destroy(); streams.clear(); return json(200, { ok: true }); }
    if (url.pathname === '/__down') { down = true; for (const s of streams) s.destroy(); streams.clear(); return json(200, { ok: true }); }
    if (url.pathname === '/__up') { down = false; return json(200, { ok: true }); }
    if (url.pathname === '/__expire') { for (const s of streams) { s.write(`event: auth_expired\ndata: {}\n\n`); s.end(); } streams.clear(); token = null; return json(200, { ok: true }); }
    if (url.pathname === '/__emit') { const r = url.searchParams.get('ref'); emit(r, 'question', { pregunta: url.searchParams.get('q') || 'otra pregunta' }, `Pregunta por confirmar: ${url.searchParams.get('q') || 'otra pregunta'}`); return json(200, { ok: true }); }

    if (down) { res.writeHead(503, { ...cors }); return res.end(); }

    if (url.pathname === '/v1/demo/panel/session' && req.method === 'POST') {
      let body = '';
      for await (const chunk of req) body += chunk;
      let pin = '';
      try { pin = JSON.parse(body).pin; } catch {}
      if (typeof pin === 'string' && pin.startsWith('RATE')) return json(429, { type: 'about:blank', title: 'Too Many Requests', status: 429 }, { 'Retry-After': '90' });
      if (pin !== PIN) return json(401, { type: 'about:blank', title: 'Unauthorized', status: 401 }, { 'WWW-Authenticate': 'Bearer' });
      token = 'd1.' + crypto.randomBytes(12).toString('base64url');
      return json(200, { token, expires_in: 14400 });
    }

    const auth = req.headers.authorization || '';
    const okAuth = token && auth === `Bearer ${token}`;
    if (url.pathname === '/v1/demo/panel/state') {
      if (!okAuth) return json(401, { type: 'about:blank', title: 'Unauthorized', status: 401 }, { 'WWW-Authenticate': 'Bearer' });
      return json(200, { epoch, seq, server_time: fmtAt(), calls: [...calls.values()].reverse() });
    }
    if (url.pathname === '/v1/demo/panel/stream') {
      if (!okAuth) return json(401, { type: 'about:blank', title: 'Unauthorized', status: 401 }, { 'WWW-Authenticate': 'Bearer' });
      res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no', ...cors });
      res.write('retry: 2000\n\n');
      res.write(`event: hello\ndata: ${JSON.stringify({ epoch, seq, server_time: fmtAt() })}\n\n`);
      const last = req.headers['last-event-id'];
      if (last !== undefined && last !== '') {
        const n = Number(last);
        const oldest = ring.length ? ring[0].seq : seq + 1;
        if (!Number.isFinite(n) || n > seq || (ring.length && n < oldest - 1)) res.write(`event: resync\ndata: {}\n\n`);
        else for (const ev of ring) if (ev.seq > n) send(res, ev);
      }
      streams.add(res);
      const ka = setInterval(() => res.write(': keep-alive\n\n'), 15000);
      req.on('close', () => { clearInterval(ka); streams.delete(res); });
      return;
    }
    json(404, { type: 'about:blank', title: 'Not Found', status: 404 });
  });

  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({ server, port: server.address().port, close: () => { for (const s of streams) s.destroy(); server.close(); }, emit, playCall, playProps })));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { port } = await createMock(Number(process.argv[2] || 8787));
  console.log(`mock panel API on http://127.0.0.1:${port}  PIN=${PIN}`);
}
