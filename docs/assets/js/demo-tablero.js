// innmobi.ai · /demo-en-vivo/tablero/
// Live panel for the phone demo: while a prospect talks with Valeria on the phone, this page fills in
// from the backend (realestate-crm, module voice_demo) through a server-sent event stream.
//
// Contract (ADR 0035):
//   POST {API}/v1/demo/panel/session  {pin}                 -> {token, expires_in}
//   GET  {API}/v1/demo/panel/state    Authorization: Bearer -> {epoch, seq, server_time, calls[]}
//   GET  {API}/v1/demo/panel/stream   Authorization: Bearer, Last-Event-ID -> text/event-stream
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

  const LEDGER_TYPES = new Set(["call_started", "interest", "budget", "slots_offered", "visit_reserved", "question", "handoff", "call_ended"]);

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
    call.ledger.push({ seq: e.seq, at: e.at, type: e.type, text: e.text || "" });

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
        call.visita = { dia: e.dia, hora: e.hora, iso: e.iso, sala: e.sala };
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
    let kicker = "PRUEBE A SOFÍA AHORA";
    let sub = "Desde cualquier teléfono. Valeria es una asistente de IA y atiende por Residencial Demo Narvarte, un desarrollo ficticio.";
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
      }
      const btn = li.firstElementChild;
      btn.setAttribute("aria-pressed", String(c.call_ref === selectedRef));
      li.dataset.status = c.status;
      btn.children[0].textContent = c.status === "active" ? "En llamada" : "Terminada";
      btn.children[1].textContent = c.caller;
      order.push(li);
    }
    list.replaceChildren(...order);
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
    setField("visita_sala", call.visita && call.visita.sala, "—", animate);
    setField("traspaso", call.traspaso && (call.traspaso.motivo || "Pidió hablar con una persona"), "No solicitado.", animate);

    renderQuestions(call, animate);
    renderLedger(call, sameCall);
    ledgerShown.ref = call.call_ref;
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
