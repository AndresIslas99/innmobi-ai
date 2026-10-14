// innmobi.ai · /demo-en-vivo/tablero/
// Live panel for the phone demo: while a prospect talks with Valeria on the phone, this page fills in
// from the backend (realestate-crm, module voice_demo) through a server-sent event stream.
//
// Contract (ADR 0035):
//   POST {API}/v1/demo/panel/session  {pin}                 -> {token, expires_in}
//   GET  {API}/v1/demo/panel/state    Authorization: Bearer -> {epoch, seq, server_time, calls[]}
//   GET  {API}/v1/demo/panel/stream   Authorization: Bearer, Last-Event-ID -> text/event-stream
//
// Property events (brokerage catalog; every field is optional and read defensively):
//   properties_suggested {call_ref, items:[{id, nombre, operacion, zona, precio_mxn | renta_mensual_mxn, m2, recamaras, imagen}]}
//   property_viewed      {call_ref, id}
//   visit_reserved       {..., propiedad_id, propiedad_nombre, modalidad, seguimiento}
//   The state snapshot may carry per call: propiedades[] (same item shape) and propiedad_consultada (id).
//
// Privacy / safety by construction:
//   - The PIN lives only in the input while it is typed; it is wiped on submit and never stored or put in a URL.
//   - The session token (short-lived, 4 h) is kept in sessionStorage only, inside try/catch; the page works without it.
//   - EventSource cannot send headers, so the stream is read with fetch() + ReadableStream.
//   - All server text goes in through textContent. No innerHTML with data, no third-party scripts.
//   - The API base comes from the data-api-base attribute. A ?api= override exists only on localhost (tests),
//     so a crafted link can never make the page send the PIN to another host.

(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const root = $("tb");
  if (!root) return;

  // ---------------------------------------------------------------------------
  // Config
  // ---------------------------------------------------------------------------

  const TOKEN_KEY = "innmobi.tablero.token";
  const BACKOFF_MS = [1000, 2000, 4000, 8000, 10000];
  const STALL_MS = 40000; // the server sends ": keep-alive" every 15 s
  const OFFLINE_AFTER = 3; // failed attempts before "Sin conexión"
  const IS_LOCAL = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);

  function resolveApiBase() {
    let base = root.dataset.apiBase || "";
    if (IS_LOCAL) {
      const override = new URLSearchParams(location.search).get("api");
      if (override && /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(override)) base = override;
    }
    return base.replace(/\/+$/, "");
  }

  const API = resolveApiBase();
  const API_OK = (/^https:\/\//.test(API) && !/REEMPLAZAR/i.test(API)) || (IS_LOCAL && /^http:\/\//.test(API));

  // ---------------------------------------------------------------------------
  // Small helpers
  // ---------------------------------------------------------------------------

  const pad = (n) => String(n).padStart(2, "0");
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  };

  // "2026-10-13T14:05:12-06:00" is already Mexico City time: read the clock straight from the string.
  const clockOf = (iso) => (/T(\d{2}:\d{2}:\d{2})/.exec(iso || "") || [])[1] || "";
  const hhmmOf = (iso) => clockOf(iso).slice(0, 5);
  const ms = (iso) => { const t = Date.parse(iso || ""); return Number.isFinite(t) ? t : null; };

  function mmss(totalSeconds) {
    const s = Math.max(0, Math.floor(totalSeconds));
    return `${Math.floor(s / 60)}:${pad(s % 60)}`;
  }
  function longDuration(totalSeconds) {
    const s = Math.max(0, Math.round(totalSeconds));
    return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${pad(s % 60)} s`;
  }

  // ---------------------------------------------------------------------------
  // Properties (catalog of the fictional brokerage)
  // ---------------------------------------------------------------------------

  const OP_LABEL = {
    preventa: "Preventa", reventa: "Reventa", remate: "Remate bancario", recuperada: "Recuperada",
    renta: "Renta", renta_amueblada: "Renta amueblada", renta_comercial: "Renta comercial", terreno: "Terreno",
    renta_opcion_compra: "Opción a compra",
  };
  const OP_BY_PREFIX = { PV: "preventa", RV: "reventa", RM: "remate", RCP: "recuperada", RN: "renta", RA: "renta_amueblada", CM: "renta_comercial", TE: "terreno", OC: "renta_opcion_compra" };
  const MODALIDAD_LABEL = { sala: "Sala de ventas", propiedad: "En la propiedad", video: "Videollamada" };
  const MAX_PROPS = 10;
  const IMG_DIR = "/assets/demo/catalogo/";

  const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : (typeof v === "number" && Number.isFinite(v) ? String(v) : null));
  const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const mxn = (n) => "$" + new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 }).format(n);
  const safeId = (id) => (id && /^[A-Za-z0-9_-]{1,40}$/.test(id) ? id : null);

  function opOf(raw, id) {
    const op = str(raw && raw.operacion);
    if (op && OP_LABEL[op]) return op;
    const prefix = id && /^([A-Z]{2,3})-/.exec(id);
    return (prefix && OP_BY_PREFIX[prefix[1]]) || null;
  }

  function normItem(raw) {
    if (!raw || typeof raw !== "object") return null;
    const id = str(raw.id);
    const nombre = str(raw.nombre);
    if (!id && !nombre) return null;
    const operacion = opOf(raw, id);
    return {
      id, key: id || nombre, nombre, operacion, zona: str(raw.zona),
      precio: num(raw.precio_mxn), renta: num(raw.renta_mensual_mxn), desde: raw.precio_es_desde === true || operacion === "preventa",
      m2: num(raw.m2), recamaras: num(raw.recamaras), imagen: str(raw.imagen),
    };
  }

  function normItems(list) {
    const out = [];
    for (const raw of Array.isArray(list) ? list : []) {
      const it = normItem(raw);
      if (it && !out.some((x) => x.key === it.key)) out.push(it);
    }
    return out.slice(0, MAX_PROPS);
  }

  // Only same-origin catalog images: the server's path if it looks right, else the one derived from the id.
  function imageSrc(item) {
    if (item.imagen && /^\/assets\/demo\/catalogo\/[\w.-]+\.webp$/.test(item.imagen)) return item.imagen;
    const id = safeId(item.id);
    return id ? `${IMG_DIR}${id}.webp` : null;
  }

  const findProp = (call, id) => (id ? call.propiedades.find((p) => p.id === id) || null : null);

  // A property the caller asked about that was never listed (e.g. a replay gap): keep a minimal card so it can be highlighted.
  function ensureProperty(call, id, raw) {
    let it = findProp(call, id);
    if (!it) {
      it = normItem({ ...(raw || {}), id });
      if (!it) return null;
      call.propiedades.unshift(it);
      call.propiedades.length = Math.min(call.propiedades.length, MAX_PROPS);
    }
    return it;
  }

  function mergeSuggested(call, items) {
    const fresh = normItems(items);
    const keys = new Set(fresh.map((x) => x.key));
    call.propiedades = [...fresh, ...call.propiedades.filter((x) => !keys.has(x.key))].slice(0, MAX_PROPS);
    return fresh;
  }

  function modalidadLabel(raw) {
    const v = str(raw);
    if (!v) return null;
    const k = v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, "");
    if (k.includes("video")) return MODALIDAD_LABEL.video;
    if (k.includes("sala") || k.includes("showroom")) return MODALIDAD_LABEL.sala;
    if (k.includes("propiedad") || k.includes("presencial") || k.includes("inmueble")) return MODALIDAD_LABEL.propiedad;
    return v;
  }

  function normVisit(v) {
    const out = {
      dia: v.dia, hora: v.hora, iso: v.iso, sala: str(v.sala), seguimiento: str(v.seguimiento),
      propiedad_id: str(v.propiedad_id), propiedad_nombre: str(v.propiedad_nombre), modalidad: modalidadLabel(v.modalidad),
    };
    // Older events (single presale development) only carried the sales room.
    if (!out.modalidad && out.sala && !out.propiedad_id) out.modalidad = MODALIDAD_LABEL.sala;
    return out;
  }

  function suggestedText(items) {
    const names = items.map((x) => x.nombre || x.id).filter(Boolean);
    return names.length ? `Propiedades sugeridas: ${names.join(", ")}` : "Propiedades sugeridas";
  }

  // ---------------------------------------------------------------------------
  // State (memory only)
  // ---------------------------------------------------------------------------

  let token = null;
  let tokenExpiresAt = 0;
  let epoch = null;
  let lastSeq = null;
  let skewMs = 0; // server clock minus local clock
  let calls = []; // newest first
  let selectedRef = null;
  let follow = true; // follow the newest call until the user picks another one
  let runGen = 0; // bumped to cancel the connection loop
  let streamAbort = null;
  let conn = "off";
  let attemptsFailed = 0;

  const serverNow = () => Date.now() + skewMs;

  function newCall(ref) {
    return {
      call_ref: ref, caller: "Número no disponible", status: "active",
      started_at: null, started_ms: null, ended_at: null, ended_ms: null, end_reason: null, duration_s: null,
      lead: { nombre: null, tipo_unidad: null, proposito: null, plazo: null },
      presupuesto: null, visita: null, preguntas: [], traspaso: null, ledger: [],
      propiedades: [], consultada: null,
    };
  }

  function fromServerCall(c) {
    const call = newCall(c.call_ref);
    call.caller = c.caller || call.caller;
    call.status = c.status === "ended" ? "ended" : "active";
    call.started_at = c.started_at || null;
    call.started_ms = ms(c.started_at);
    call.ended_at = c.ended_at || null;
    call.ended_ms = ms(c.ended_at);
    call.end_reason = c.end_reason || null;
    if (call.ended_ms !== null && call.started_ms !== null) call.duration_s = (call.ended_ms - call.started_ms) / 1000;
    Object.assign(call.lead, c.lead || {});
    call.presupuesto = c.presupuesto || null;
    call.visita = c.visita || null;
    call.preguntas = Array.isArray(c.preguntas) ? c.preguntas.slice() : [];
    call.traspaso = c.traspaso || null;
    call.ledger = (Array.isArray(c.ledger) ? c.ledger : []).slice().sort((a, b) => a.seq - b.seq);
    call.propiedades = normItems(c.propiedades || c.propiedades_sugeridas || c.items);
    const viewed = str(c.propiedad_consultada) || str(c.consultada);
    if (viewed) { call.consultada = viewed; ensureProperty(call, viewed); }
    if (call.visita) call.visita = normVisit(call.visita);
    return call;
  }

  const byNewest = (a, b) => (b.started_ms ?? 0) - (a.started_ms ?? 0);

  // ---------------------------------------------------------------------------
  // Screen state: gate <-> app
  // ---------------------------------------------------------------------------

  function showGate(message) {
    runGen++; // cancel any connection loop
    abortStream();
    token = null;
    tokenExpiresAt = 0;
    try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* storage may be blocked */ }
    resetData();
    root.dataset.state = "locked";
    $("tb-app").hidden = true;
    $("tb-gate").hidden = false;
    setGateError(message || "");
    $("tb-pin").value = "";
    setConn("off");
    setTimeout(() => $("tb-pin").focus(), 0);
  }

  function showApp() {
    root.dataset.state = "open";
    $("tb-gate").hidden = true;
    $("tb-app").hidden = false;
  }

  function setGateError(text) {
    const p = $("tb-gate-error");
    p.textContent = text;
    p.hidden = !text;
    $("tb-pin").setAttribute("aria-invalid", text ? "true" : "false");
  }

  function resetData() {
    epoch = null;
    lastSeq = null;
    calls = [];
    selectedRef = null;
    follow = true;
    ledgerShown = { ref: null, count: 0 };
    renderAll();
  }

  // ---------------------------------------------------------------------------
  // Connection indicator + notices
  // ---------------------------------------------------------------------------

  const CONN_TEXT = { off: "Sin conexión", connecting: "Conectando", live: "Conectado", reconnecting: "Reconectando", offline: "Sin conexión" };

  function setConn(next) {
    conn = next;
    root.dataset.conn = next;
    $("tb-conn-text").textContent = CONN_TEXT[next] || "";
  }

  function setNotice(text) {
    const n = $("tb-notice");
    n.textContent = text || "";
    n.hidden = !text;
  }

  // ---------------------------------------------------------------------------
  // HTTP
  // ---------------------------------------------------------------------------

  class HttpError extends Error {
    constructor(status, retryAfter) { super(`HTTP ${status}`); this.status = status; this.retryAfter = retryAfter; }
  }
  class AuthError extends Error {}
  class ResyncSignal extends Error {}

  const retryAfterOf = (res) => {
    const n = Number(res.headers.get("Retry-After"));
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  async function api(path, init = {}) {
    const headers = { Accept: "application/json", ...(init.headers || {}) };
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(API + path, { cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer", ...init, headers });
  }

  async function loadState() {
    const res = await api("/v1/demo/panel/state");
    if (res.status === 401) throw new AuthError();
    if (!res.ok) throw new HttpError(res.status, retryAfterOf(res));
    const body = await res.json();
    epoch = body.epoch ?? null;
    lastSeq = Number.isFinite(body.seq) ? body.seq : 0;
    const t = ms(body.server_time);
    if (t !== null) skewMs = t - Date.now();
    calls = (Array.isArray(body.calls) ? body.calls : []).map(fromServerCall).sort(byNewest);
    if (!calls.some((c) => c.call_ref === selectedRef)) selectedRef = null;
    ledgerShown = { ref: null, count: 0 }; // rebuild the ledger from the snapshot, no animation
    renderAll();
  }

  // ---------------------------------------------------------------------------
  // PIN -> token
  // ---------------------------------------------------------------------------

  // Crockford base32 has no I, L, O or U: read them the way a person misreads them.
  function normalizePin(raw) {
    return raw.toUpperCase().replace(/[\s-]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");
  }

  async function submitPin(event) {
    event.preventDefault();
    const input = $("tb-pin");
    const pin = normalizePin(input.value);
    if (!pin) { setGateError("Escribe el PIN."); input.focus(); return; }
    if (!API_OK) {
      setGateError("Falta configurar la dirección del servidor en esta página (data-api-base). Avisa a Andrés.");
      return;
    }
    setGateError("");
    const button = $("tb-enter");
    button.disabled = true;
    button.textContent = "Entrando…";
    try {
      const res = await fetch(`${API}/v1/demo/panel/session`, {
        method: "POST", cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ pin }),
      });
      input.value = ""; // the PIN is gone from the page as soon as it was sent
      if (res.status === 401) { setGateError("PIN incorrecto. Revísalo e inténtalo de nuevo."); return; }
      if (res.status === 429) {
        const wait = retryAfterOf(res);
        setGateError(wait && wait < 120
          ? `Demasiados intentos, espera ${Math.ceil(wait)} segundos.`
          : "Demasiados intentos, espera unos minutos.");
        return;
      }
      if (res.status === 404) { setGateError("El servidor de la demo está apagado. Avisa a Andrés."); return; }
      if (!res.ok) { setGateError("El servidor tuvo un problema. Inténtalo en un momento."); return; }
      const body = await res.json();
      if (!body.token) { setGateError("Respuesta inesperada del servidor."); return; }
      token = body.token;
      tokenExpiresAt = Date.now() + (Number(body.expires_in) || 14400) * 1000;
      try {
        sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ token, exp: tokenExpiresAt }));
      } catch { /* works without storage */ }
      begin();
    } catch {
      setGateError("No se pudo conectar con el servidor. Revisa el internet de la laptop; si sí hay, el servidor está caído.");
    } finally {
      button.disabled = false;
      button.textContent = "Entrar";
    }
  }

  function restoreToken() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(TOKEN_KEY) || "null");
      if (saved && saved.token && saved.exp > Date.now() + 60000) {
        token = saved.token;
        tokenExpiresAt = saved.exp;
        return true;
      }
      sessionStorage.removeItem(TOKEN_KEY);
    } catch { /* ignore */ }
    return false;
  }

  // ---------------------------------------------------------------------------
  // Connection loop: state, then stream, with backoff
  // ---------------------------------------------------------------------------

  function begin() {
    const gen = ++runGen;
    showApp();
    setConn("connecting");
    setNotice("");
    attemptsFailed = 0;
    run(gen);
  }

  function abortStream() {
    if (streamAbort) { try { streamAbort.abort(); } catch { /* noop */ } streamAbort = null; }
  }

  async function run(gen) {
    let needState = true;
    while (gen === runGen) {
      let wait = 0;
      try {
        if (needState) { await loadState(); needState = false; }
        if (gen !== runGen) return;
        await streamOnce(gen); // resolves when the stream ends
        attemptsFailed++;
      } catch (err) {
        if (gen !== runGen) return;
        if (err instanceof AuthError) { showGate("La sesión expiró. Vuelve a escribir el PIN."); return; }
        if (err instanceof ResyncSignal) { needState = true; continue; }
        attemptsFailed++;
        if (err instanceof HttpError && err.status === 429) {
          wait = Math.max(5000, (err.retryAfter || 0) * 1000);
          setNotice("Hay demasiados tableros abiertos. Cierra los que no uses; reintento solo.");
        } else if (err instanceof HttpError && err.status === 404) {
          setNotice("El servidor de la demo está apagado. Avisa a Andrés.");
        } else if (err instanceof HttpError && err.status >= 500) {
          setNotice("El servidor tuvo un problema. Reintentando…");
        } else if (!(err instanceof HttpError) && !needState) {
          // stream dropped; keep the data on screen and try again with the last seen id
        } else {
          setNotice("No se pudo conectar con el servidor. Reintentando…");
        }
      }
      if (gen !== runGen) return;
      setConn(attemptsFailed >= OFFLINE_AFTER ? "offline" : "reconnecting");
      if (attemptsFailed >= OFFLINE_AFTER) {
        setNotice("Sin conexión con el servidor. Lo que ves puede estar desactualizado; sigo reintentando.");
      }
      const backoff = BACKOFF_MS[Math.min(attemptsFailed - 1, BACKOFF_MS.length - 1)] ?? 10000;
      await sleep(Math.max(backoff, wait));
    }
  }

  async function streamOnce(gen) {
    const ac = new AbortController();
    streamAbort = ac;
    const headers = { Accept: "text/event-stream" };
    if (lastSeq !== null) headers["Last-Event-ID"] = String(lastSeq);
    const res = await api("/v1/demo/panel/stream", { headers, signal: ac.signal });
    if (res.status === 401) throw new AuthError();
    if (!res.ok || !res.body) throw new HttpError(res.status, retryAfterOf(res));

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let lastByteAt = Date.now();
    const watchdog = setInterval(() => {
      if (Date.now() - lastByteAt > STALL_MS) ac.abort();
      if (tokenExpiresAt && Date.now() > tokenExpiresAt) ac.abort();
    }, 5000);
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (gen !== runGen) return;
        if (done) return;
        lastByteAt = Date.now();
        buffer += decoder.decode(value, { stream: true });
        let cut;
        // Events end with a blank line (LF or CRLF).
        while ((cut = buffer.search(/\r?\n\r?\n/)) !== -1) {
          const raw = buffer.slice(0, cut);
          buffer = buffer.slice(cut).replace(/^\r?\n\r?\n/, "");
          parseBlock(raw);
        }
      }
    } finally {
      clearInterval(watchdog);
      if (streamAbort === ac) streamAbort = null;
      try { await reader.cancel(); } catch { /* already closed */ }
    }
  }

  function parseBlock(raw) {
    let name = "message";
    let id = null;
    const data = [];
    for (const line of raw.split(/\r?\n/)) {
      if (!line || line.startsWith(":")) continue; // comment / keep-alive
      const i = line.indexOf(":");
      const field = i === -1 ? line : line.slice(0, i);
      let value = i === -1 ? "" : line.slice(i + 1);
      if (value.startsWith(" ")) value = value.slice(1);
      if (field === "event") name = value;
      else if (field === "data") data.push(value);
      else if (field === "id") id = value;
      // "retry" is ignored: the backoff is ours
    }
    if (!data.length && name === "message") return;
    let payload = null;
    try { payload = data.length ? JSON.parse(data.join("\n")) : null; } catch { return; }
    handleEvent(name, payload, id);
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  const LEDGER_TYPES = new Set(["call_started", "interest", "budget", "slots_offered", "properties_suggested", "property_viewed", "visit_reserved", "question", "handoff", "call_ended"]);

  function handleEvent(name, p, id) {
    if (name === "hello") {
      attemptsFailed = 0;
      setConn("live");
      setNotice("");
      const t = ms(p && p.server_time);
      if (t !== null) skewMs = t - Date.now();
      if (epoch !== null && p && p.epoch && p.epoch !== epoch) throw new ResyncSignal();
      return;
    }
    if (name === "resync") throw new ResyncSignal();
    if (name === "auth_expired") throw new AuthError();
    if (!p || !LEDGER_TYPES.has(p.type || name)) return;

    if (p.epoch && epoch !== null && p.epoch !== epoch) throw new ResyncSignal();
    const seq = Number.isFinite(p.seq) ? p.seq : Number(id);
    if (Number.isFinite(seq)) {
      if (lastSeq !== null && seq <= lastSeq) return; // already applied (state snapshot or replay overlap)
      lastSeq = seq;
    }
    applyEvent(p);
  }

  function callFor(ref, at) {
    let call = calls.find((c) => c.call_ref === ref);
    if (!call) {
      call = newCall(ref);
      call.started_at = at || null;
      call.started_ms = ms(at);
      calls.push(call);
      calls.sort(byNewest);
    }
    return call;
  }

  function applyEvent(e) {
    const call = callFor(e.call_ref, e.at);
    const known = new Set(call.ledger.map((x) => x.seq));
    if (known.has(e.seq)) return;
    let text = e.text || "";
    let suggestedNow = [];
    let viewedNow = null;
    if (e.type === "properties_suggested") {
      suggestedNow = mergeSuggested(call, e.items);
      if (!text) text = suggestedText(suggestedNow);
    } else if (e.type === "property_viewed") {
      const id = str(e.id) || str(e.propiedad_id);
      const it = id ? ensureProperty(call, id, e) : null;
      if (id) { call.consultada = id; viewedNow = id; }
      if (!text) text = `Pidió detalles de ${(it && (it.nombre || it.id)) || id || "una propiedad"}`;
    }
    call.ledger.push({ seq: e.seq, at: e.at, type: e.type, text });

    switch (e.type) {
      case "call_started":
        if (e.caller) call.caller = e.caller;
        call.started_at = e.at;
        call.started_ms = ms(e.at);
        call.status = "active";
        calls.sort(byNewest);
        break;
      case "interest":
        call.lead = { nombre: e.nombre ?? call.lead.nombre, tipo_unidad: e.tipo_unidad ?? null, proposito: e.proposito ?? null, plazo: e.plazo ?? null };
        break;
      case "budget":
        call.presupuesto = e.rango || null;
        break;
      case "visit_reserved":
        call.visita = normVisit(e);
        break;
      case "question":
        if (e.pregunta && !call.preguntas.some((q) => q.toLowerCase() === e.pregunta.toLowerCase())) call.preguntas.push(e.pregunta);
        break;
      case "handoff":
        call.traspaso = { motivo: e.motivo, at: e.at };
        break;
      case "call_ended":
        call.status = "ended";
        call.ended_at = e.at;
        call.ended_ms = ms(e.at);
        call.end_reason = e.reason || null;
        call.duration_s = Number.isFinite(e.duration_s) ? e.duration_s : (call.started_ms !== null && call.ended_ms !== null ? (call.ended_ms - call.started_ms) / 1000 : null);
        break;
      default:
        break;
    }
    renderAll(e);
    if (e.type === "visit_reserved" && call.visita && call.visita.propiedad_id) scrollToProperty(call.visita.propiedad_id);
    else if (viewedNow) scrollToProperty(viewedNow);
    else if (suggestedNow.length && call.call_ref === selectedRef) scrollStrip(0);
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  let ledgerShown = { ref: null, count: 0 };
  let renderedFields = {};

  const selected = () => calls.find((c) => c.call_ref === selectedRef) || null;

  function renderAll(event) {
    if (follow || !selected()) selectedRef = calls[0] ? calls[0].call_ref : null;
    renderBanner();
    renderCards();
    renderDetail(event);
    tick();
  }

  function renderBanner() {
    const banner = $("tb-banner");
    const active = calls.filter((c) => c.status === "active").length;
    let mode = "idle";
    let kicker = "PRUEBE A VALERIA AHORA";
    let sub = "Desde cualquier teléfono. Valeria es una asistente de IA y atiende por Inmobiliaria Demo Valle, una inmobiliaria ficticia con propiedades de ejemplo.";
    if (active) {
      mode = "live";
      kicker = "EN LLAMADA";
      sub = "Mire cómo se llena el panel mientras la persona habla con Valeria.";
    } else if (calls.length) {
      mode = "ended";
      kicker = "LLAMADA TERMINADA";
      sub = "¿Otra prueba? Marque de nuevo desde el mismo teléfono o desde otro.";
    }
    banner.dataset.mode = mode;
    root.dataset.calls = calls.length ? "1" : "0";
    $("tb-banner-kicker").textContent = kicker;
    $("tb-banner-sub").textContent = sub;
    const number = root.dataset.phoneDisplay || "+1 915 745 7187";
    const a = $("tb-banner-number");
    a.textContent = number;
    a.href = `tel:${number.replace(/[^+\d]/g, "")}`;
  }

  function renderCards() {
    const list = $("tb-calls");
    $("tb-calls-empty").hidden = calls.length > 0;
    list.hidden = calls.length === 0;
    const existing = new Map([...list.children].map((li) => [li.dataset.ref, li]));
    const order = [];
    for (const c of calls) {
      let li = existing.get(c.call_ref);
      if (!li) {
        li = el("li", "tb-call");
        li.dataset.ref = c.call_ref;
        const btn = el("button", "tb-call-btn");
        btn.type = "button";
        btn.append(
          el("span", "tb-call-state"),
          el("span", "tb-call-caller"),
          el("span", "tb-call-meta"),
        );
        btn.addEventListener("click", () => selectCall(c.call_ref));
        li.append(btn);
        li.classList.add("is-new");
        settleOnEnd(li, "dl-in");
      }
      const btn = li.firstElementChild;
      btn.setAttribute("aria-pressed", String(c.call_ref === selectedRef));
      li.dataset.status = c.status;
      btn.children[0].textContent = c.status === "active" ? "En llamada" : "Terminada";
      btn.children[1].textContent = c.caller;
      order.push(li);
    }
    syncChildren(list, order);
  }

  function selectCall(ref) {
    selectedRef = ref;
    follow = calls[0] && calls[0].call_ref === ref;
    ledgerShown = { ref: null, count: 0 };
    renderAll();
  }

  // Set a text field; flash it when the value changes while the call is on screen.
  function setField(key, value, emptyText, animate) {
    const node = root.querySelector(`[data-f="${key}"]`);
    if (!node) return;
    const has = value !== null && value !== undefined && value !== "";
    const text = has ? String(value) : emptyText;
    if (node.textContent !== text) {
      node.textContent = text;
      if (animate && has) flash(node);
    }
    node.classList.toggle("is-empty", !has);
  }

  function flash(node) {
    node.classList.remove("is-new");
    void node.offsetWidth; // restart the animation
    node.classList.add("is-new");
  }

  // Make `list` hold exactly `nodes`, in order, without detaching the ones already in place
  // (a detached node replays its CSS animation when it comes back).
  function syncChildren(list, nodes) {
    nodes.forEach((node, i) => { if (list.children[i] !== node) list.insertBefore(node, list.children[i] || null); });
    while (list.children.length > nodes.length) list.lastElementChild.remove();
  }

  // Re-inserting a node restarts its CSS animation, so the "just arrived" class is dropped once it has played.
  function settleOnEnd(node, name) {
    node.addEventListener("animationend", (ev) => {
      if (ev.target === node && ev.animationName === name) node.classList.remove("is-new");
    });
  }

  function renderDetail(event) {
    const call = selected();
    $("tb-detail").hidden = !call;
    if (!call) return;
    const sameCall = ledgerShown.ref === call.call_ref;
    const animate = sameCall && !!event;

    $("tb-caller").textContent = `${call.caller} · inicio ${hhmmOf(call.started_at) || "—"}`;
    const chip = $("tb-state-chip");
    chip.dataset.status = call.status;
    chip.textContent = call.status === "active" ? "En llamada" : "Llamada terminada";

    setField("nombre", call.lead.nombre, "—", animate);
    setField("tipo_unidad", call.lead.tipo_unidad, "—", animate);
    setField("proposito", call.lead.proposito, "—", animate);
    setField("plazo", call.lead.plazo, "—", animate);
    setField("presupuesto", call.presupuesto, "Sin registrar. Solo aparece si la persona acepta y lo dice.", animate);
    setField("visita_dia", call.visita && call.visita.dia, "—", animate);
    setField("visita_hora", call.visita && call.visita.hora, "—", animate);
    const v = call.visita;
    const vProp = v && (v.propiedad_nombre || (findProp(call, v.propiedad_id) || {}).nombre || v.propiedad_id);
    setField("visita_modalidad", v && v.modalidad, "—", animate);
    setField("visita_propiedad", vProp, "—", animate);
    const place = $("tb-visit-place");
    place.textContent = v && v.sala ? v.sala : "";
    place.hidden = !(v && v.sala);
    $("tb-visit-follow-text").textContent = v && v.seguimiento ? v.seguimiento : "";
    $("tb-visit-follow").hidden = !(v && v.seguimiento);
    setField("traspaso", call.traspaso && (call.traspaso.motivo || "Pidió hablar con una persona"), "No solicitado.", animate);

    renderQuestions(call, animate);
    renderProperties(call, sameCall);
    renderLedger(call, sameCall);
    ledgerShown.ref = call.call_ref;
  }

  // ----- Suggested properties strip -----

  function propertyCard(item, call) {
    const li = el("li", "tb-prop");
    li.dataset.key = item.key;
    if (item.id) li.dataset.id = item.id;
    li.dataset.op = item.operacion || "otro";

    const photo = el("div", "tb-prop-photo");
    const src = imageSrc(item);
    if (src) {
      const img = el("img", "tb-prop-img");
      img.alt = item.nombre ? `Imagen ilustrativa de ${item.nombre}` : "Imagen ilustrativa de la propiedad";
      img.decoding = "async";
      img.loading = "lazy";
      img.addEventListener("error", () => { photo.classList.add("is-missing"); img.remove(); }, { once: true });
      img.src = src;
      photo.append(img);
    } else {
      photo.classList.add("is-missing");
    }
    photo.append(el("span", "tb-prop-ill", "imagen ilustrativa"));

    const body = el("div", "tb-prop-body");
    body.append(el("span", "tb-prop-op", OP_LABEL[item.operacion] || "Propiedad"));
    const name = el("span", "tb-prop-name", item.nombre || item.id || "Propiedad");
    name.title = item.nombre || "";
    body.append(name);
    if (item.zona) body.append(el("span", "tb-prop-zona", item.zona));
    const price = priceOf(item);
    if (price.main) {
      const p = el("span", "tb-prop-price", price.main);
      if (price.unit) p.append(el("span", "tb-prop-unit", price.unit));
      body.append(p);
    }
    if (price.sub) body.append(el("span", "tb-prop-sub", price.sub));
    const meta = metaOf(item);
    if (meta) body.append(el("span", "tb-prop-meta", meta));

    const flags = el("div", "tb-prop-flags");
    flags.append(el("span", "tb-prop-flag tb-flag-viewed", "Pidió detalles"), el("span", "tb-prop-flag tb-flag-visit", "Visita reservada"));
    li.append(flags, photo, body);
    return li;
  }

  function priceOf(item) {
    if (item.renta !== null) return { main: mxn(item.renta), unit: " / mes", sub: item.precio !== null ? `Compra ${mxn(item.precio)}` : null };
    if (item.precio !== null) return { main: `${item.desde ? "Desde " : ""}${mxn(item.precio)}`, unit: null, sub: null };
    return { main: null, unit: null, sub: null };
  }

  function metaOf(item) {
    const parts = [];
    if (item.m2 !== null) parts.push(`${new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 }).format(item.m2)} m²`);
    if (item.recamaras !== null && item.recamaras > 0) parts.push(`${item.recamaras} ${item.recamaras === 1 ? "recámara" : "recámaras"}`);
    return parts.join(" · ");
  }

  function renderProperties(call, sameCall) {
    const wrap = $("tb-props");
    const list = $("tb-props-list");
    const items = call.propiedades;
    wrap.hidden = items.length === 0;
    if (!items.length) root.dataset.props = "0";
    $("tb-props-count").textContent = items.length ? String(items.length) : "";
    const existing = new Map([...list.children].map((li) => [li.dataset.key, li]));
    const order = items.map((item) => {
      let li = existing.get(item.key);
      if (!li || li.dataset.call !== call.call_ref) {
        li = propertyCard(item, call);
        li.dataset.call = call.call_ref;
        if (sameCall) { li.classList.add("is-new"); settleOnEnd(li, "dl-flash"); }
      }
      const viewed = !!call.consultada && item.id === call.consultada;
      const visit = !!(call.visita && call.visita.propiedad_id && item.id === call.visita.propiedad_id);
      li.classList.toggle("is-viewed", viewed);
      li.classList.toggle("is-visit", visit);
      return li;
    });
    syncChildren(list, order);
    root.dataset.props = items.length ? "1" : "0";
  }

  function scrollStrip(left) {
    const strip = $("tb-props-list");
    if (strip.scrollWidth <= strip.clientWidth) return;
    strip.scrollTo({ left: Math.max(0, left), behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }

  // The newest suggestions sit at the left edge; asking about one brings that card into view.
  function scrollToProperty(id) {
    const strip = $("tb-props-list");
    const card = [...strip.children].find((li) => li.dataset.id === id);
    if (card) scrollStrip(card.offsetLeft - strip.offsetLeft - 8);
  }

  function renderQuestions(call, animate) {
    const list = $("tb-questions");
    const had = list.children.length;
    list.replaceChildren(...call.preguntas.map((q, i) => {
      const li = el("li", "", q);
      if (animate && i >= had) li.classList.add("is-new");
      return li;
    }));
    list.hidden = call.preguntas.length === 0;
    $("tb-questions-empty").hidden = call.preguntas.length > 0;
  }

  function ledgerRow(entry, animate) {
    const li = el("li", "dl-ledger-row tb-ledger-row");
    li.dataset.type = entry.type;
    if (!animate) li.classList.add("no-anim");
    const time = el("time", "", clockOf(entry.at));
    time.dateTime = entry.at || "";
    li.append(time, el("div", "tb-ledger-text", entry.text));
    return li;
  }

  function renderLedger(call, sameCall) {
    const list = $("tb-ledger");
    const entries = call.ledger;
    $("tb-ledger-empty").hidden = entries.length > 0;
    if (sameCall && entries.length >= ledgerShown.count) {
      // Incremental: prepend only what is new (newest first).
      for (let i = ledgerShown.count; i < entries.length; i++) list.prepend(ledgerRow(entries[i], true));
    } else {
      list.replaceChildren(...entries.slice().reverse().map((x) => ledgerRow(x, false)));
    }
    ledgerShown.count = entries.length;
  }

  // Duration clocks (cards + header), once a second.
  function tick() {
    for (const li of $("tb-calls").children) {
      const c = calls.find((x) => x.call_ref === li.dataset.ref);
      if (!c) continue;
      const meta = li.firstElementChild.children[2];
      const started = hhmmOf(c.started_at) || "—";
      let text;
      if (c.status === "active") {
        const secs = c.started_ms !== null ? (serverNow() - c.started_ms) / 1000 : 0;
        text = `Inicio ${started} · ${mmss(secs)}`;
      } else {
        text = `Inicio ${started} · ${c.duration_s !== null ? longDuration(c.duration_s) : "terminada"}`;
      }
      if (meta.textContent !== text) meta.textContent = text;
    }
    const call = selected();
    if (call) {
      const chip = $("tb-state-chip");
      let text;
      if (call.status === "active") {
        const secs = call.started_ms !== null ? (serverNow() - call.started_ms) / 1000 : 0;
        text = `En llamada · ${mmss(secs)}`;
      } else {
        text = call.duration_s !== null ? `Terminada · ${longDuration(call.duration_s)}` : "Llamada terminada";
      }
      if (chip.textContent !== text) chip.textContent = text;
    }
  }

  // ---------------------------------------------------------------------------
  // Wiring
  // ---------------------------------------------------------------------------

  $("tb-form").addEventListener("submit", submitPin);
  $("tb-peek").addEventListener("click", () => {
    const input = $("tb-pin");
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    $("tb-peek").textContent = show ? "Ocultar" : "Mostrar";
    $("tb-peek").setAttribute("aria-pressed", String(show));
    input.focus();
  });
  $("tb-exit").addEventListener("click", () => showGate(""));
  $("tb-pin").addEventListener("input", () => setGateError(""));
  setInterval(tick, 1000);

  window.addEventListener("online", () => { if (root.dataset.state === "open" && conn !== "live") setNotice(""); });

  if (!API_OK) {
    showGate("");
  } else if (restoreToken()) {
    begin();
  } else {
    showGate("");
  }
})();
