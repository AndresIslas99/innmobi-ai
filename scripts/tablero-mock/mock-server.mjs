// Mock of the realestate-crm voice_demo panel API (ADR 0035) for developing and testing /demo-en-vivo/tablero/.
// Usage: node scripts/tablero-mock/mock-server.mjs [port]      (PIN: ABCD2345)
// Test controls (not part of the contract): POST /__play, /__play2, /__kill, /__restart, /__down, /__up, /__expire, /__emit
import http from 'node:http';
import crypto from 'node:crypto';

export const PIN = 'ABCD2345';
const TZ = 'America/Mexico_City';

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
        lead: { nombre: null, tipo_unidad: null, proposito: null, plazo: null }, presupuesto: null, visita: null, preguntas: [], traspaso: null, ledger: [] };
      calls.set(e.call_ref, c);
    }
    c.ledger.push({ seq: e.seq, at: e.at, type: e.type, text: e.text });
    if (e.type === 'call_started') c.caller = e.caller;
    if (e.type === 'interest') c.lead = { nombre: e.nombre, tipo_unidad: e.tipo_unidad, proposito: e.proposito, plazo: e.plazo };
    if (e.type === 'budget') c.presupuesto = e.rango;
    if (e.type === 'visit_reserved') c.visita = { dia: e.dia, hora: e.hora, iso: e.iso, sala: e.sala };
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

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const origin = req.headers.origin;
    const cors = origin ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin', 'Access-Control-Allow-Headers': 'Authorization, Content-Type, Last-Event-ID', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Max-Age': '600' } : {};
    const json = (code, body, extra = {}) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors, ...extra }); res.end(JSON.stringify(body)); };
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }

    // test controls
    if (url.pathname === '/__play') { playCall({ gap: Number(url.searchParams.get('gap') || 900) }); return json(200, { ok: true }); }
    if (url.pathname === '/__play2') { playCall({ gap: 300, caller: '+52 •• •••• ••47', name: 'Luis' }); return json(200, { ok: true }); }
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

  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({ server, port: server.address().port, close: () => { for (const s of streams) s.destroy(); server.close(); }, emit, playCall })));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { port } = await createMock(Number(process.argv[2] || 8787));
  console.log(`mock panel API on http://127.0.0.1:${port}  PIN=${PIN}`);
}
