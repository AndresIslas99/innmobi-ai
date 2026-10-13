// innmobi.ai · /demo-en-vivo/
// Live voice demo: Sofía (ElevenLabs agent) + a simulated team dashboard fed by client tools.
//
// Privacy by construction: nothing here touches localStorage, sessionStorage, cookies or
// IndexedDB, and the only network peer for the call is ElevenLabs (the SDK is served from this site). The agent id below is public
// (the agent is protected by an origin allowlist, call limits and a 300 s cap); no secret lives here.

// The SDK is vendored (no third-party script on a microphone page). See assets/js/vendor/README.md.
import { Conversation } from "./vendor/elevenlabs-client-1.26.0.js";

const AGENT_ID = "agent_1101m4ta3tvaf5c9wd0gp6q8z7xj";
const LIBSAMPLERATE_PATH = new URL("./vendor/libsamplerate.worklet-2.1.2.js", import.meta.url).href;
const TZ = "America/Mexico_City";
const MAX_CALL_SECONDS = 300;
const SALA = "Residencial Demo Narvarte";
const SLOT_HOURS = [10, 11, 12, 13, 14, 15, 16, 17];
const DAYS_AHEAD = 14; // today plus 13 days (Sundays skipped)

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

const $ = (id) => document.getElementById(id);
const root = $("dl");

// ---------------------------------------------------------------------------
// Dates (always Mexico City time, whatever the phone's timezone is)
// ---------------------------------------------------------------------------

const mxFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ, year: "numeric", month: "numeric", day: "numeric",
  hour: "numeric", minute: "numeric", second: "numeric", hourCycle: "h23",
});

function mxNow(date = new Date()) {
  const p = Object.fromEntries(mxFormatter.formatToParts(date).map((x) => [x.type, x.value]));
  const y = +p.year, m = +p.month, d = +p.day;
  return {
    y, m, d,
    h: +p.hour, min: +p.minute, s: +p.second,
    wd: new Date(Date.UTC(y, m - 1, d)).getUTCDay(),
  };
}

const pad = (n) => String(n).padStart(2, "0");
const dayLabel = (wd, d, m) => `${WEEKDAYS[wd]} ${d} de ${MONTHS[m - 1]}`;
const clock = (date) => { const n = mxNow(date); return `${pad(n.h)}:${pad(n.min)}:${pad(n.s)}`; };

function dynamicVariables() {
  const n = mxNow();
  return {
    fecha_hoy: `${dayLabel(n.wd, n.d, n.m)} de ${n.y}`,
    hora_actual: `${pad(n.h)}:${pad(n.min)}`,
  };
}

const strip = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[,.]/g, " ").replace(/\s+/g, " ").trim();

// ---------------------------------------------------------------------------
// Simulated agenda: next 14 days, no Sundays, 10:00-17:00 hourly, 2 random slots taken per day
// ---------------------------------------------------------------------------

function buildAgenda() {
  const now = mxNow();
  const days = [];
  for (let offset = 0; offset < DAYS_AHEAD; offset++) {
    const dt = new Date(Date.UTC(now.y, now.m - 1, now.d + offset));
    const wd = dt.getUTCDay();
    if (wd === 0) continue; // Sundays: sales room closed
    const y = dt.getUTCFullYear(), m = dt.getUTCMonth() + 1, d = dt.getUTCDate();
    let hours = SLOT_HOURS.slice();
    if (offset === 0) hours = hours.filter((h) => h * 60 > now.h * 60 + now.min + 30); // skip past hours today
    // Two random slots are already taken by other prospects.
    const takenCount = Math.min(2, Math.floor(hours.length / 2));
    for (let i = 0; i < takenCount; i++) hours.splice(Math.floor(Math.random() * hours.length), 1);
    days.push({
      offset, wd, y, m, d,
      label: dayLabel(wd, d, m),
      free: hours.map((h) => `${pad(h)}:00`),
    });
  }
  return days;
}

function findDay(agenda, raw) {
  const text = strip(raw);
  const today = mxNow();
  const dateMatch = text.match(/(\d{1,2})\s*(?:de\s+)?([a-z]+)/);
  if (dateMatch) {
    const month = MONTHS.findIndex((name) => strip(name) === dateMatch[2]) + 1;
    if (month) {
      const hit = agenda.find((x) => x.d === +dateMatch[1] && x.m === month);
      if (hit) return { day: hit };
      // A real date that is not bookable (Sunday or outside the window)?
      const year = today.y + (month < today.m ? 1 : 0);
      const wd = new Date(Date.UTC(year, month - 1, +dateMatch[1])).getUTCDay();
      return { day: null, sunday: wd === 0 };
    }
  }
  if (/\bhoy\b/.test(text)) return { day: agenda.find((x) => x.offset === 0) ?? null, sunday: today.wd === 0 };
  if (/\bmanana\b/.test(text)) {
    const tomorrow = agenda.find((x) => x.offset === 1) ?? null;
    return { day: tomorrow, sunday: (today.wd + 1) % 7 === 0 };
  }
  const wdIndex = WEEKDAYS.findIndex((name) => strip(name) === text.split(" ")[0]);
  if (wdIndex === 0) return { day: null, sunday: true };
  if (wdIndex > 0) return { day: agenda.find((x) => x.wd === wdIndex) ?? null };
  return { day: null };
}

function normalizeHour(raw) {
  const m = String(raw ?? "").trim().match(/^(\d{1,2})(?::(\d{2}))?/);
  return m ? `${pad(+m[1])}:${m[2] ?? "00"}` : "";
}

// ---------------------------------------------------------------------------
// Session state (in memory only)
// ---------------------------------------------------------------------------

const fresh = () => ({
  consentAt: null,
  startedAt: null,
  endedAt: null,
  agenda: null,
  lead: { nombre: "", tipo_unidad: "", proposito: "", plazo: "" },
  budget: "",
  visit: null,
  questions: [],
  handoff: "",
  ledger: [],
  turns: { ai: 0, user: 0 },
});

let state = fresh();
let conversation = null;
let connected = false;
let finishing = false;
let mode = "idle";
let timerId = null;
let rafId = null;
let wakeLock = null;
let pendingLedger = [];
const pendingTimers = new Set();

// ---------------------------------------------------------------------------
// UI helpers (everything is written with textContent: transcript and tool arguments are
// untrusted input from the model and from the person)
// ---------------------------------------------------------------------------

function setState(next) { root.dataset.state = next; }

function setMode(next, text) {
  mode = next;
  $("dl-status").dataset.mode = next;
  $("dl-status-text").textContent = text;
}

function flash(el) {
  el.classList.remove("is-new");
  void el.offsetWidth; // restart the animation
  el.classList.add("is-new");
}

function noteTeamUpdate() {
  if (root.dataset.view !== "team") $("dl-tab-team").classList.add("has-news");
}

function setField(container, name, value) {
  const el = container.querySelector(`[data-field="${name}"]`);
  const text = String(value ?? "").trim();
  el.textContent = text || "—";
  el.classList.toggle("is-empty", !text);
  if (text) flash(el);
}

function addTranscript(who, text) {
  const clean = String(text ?? "").trim();
  if (!clean) return;
  $("dl-transcript-empty")?.remove();
  const item = document.createElement("li");
  item.className = who === "user" ? "dl-line dl-line-user" : "dl-line dl-line-ai";
  const label = document.createElement("span");
  label.className = "dl-line-who";
  label.textContent = who === "user" ? "Tú" : "Sofía · IA";
  const body = document.createElement("p");
  body.textContent = clean;
  item.append(label, body);
  const list = $("dl-transcript");
  list.append(item);
  list.scrollTop = list.scrollHeight;
}

function addLedger(label, detail = "", at = new Date()) {
  state.ledger.push({ at, label, detail });
  $("dl-ledger-empty")?.remove();
  const item = document.createElement("li");
  item.className = "dl-ledger-row";
  const time = document.createElement("time");
  time.dateTime = at.toISOString();
  time.textContent = clock(at);
  const what = document.createElement("div");
  const strong = document.createElement("strong");
  strong.textContent = label;
  what.append(strong);
  if (detail) {
    const small = document.createElement("span");
    small.textContent = detail;
    what.append(small);
  }
  item.append(time, what);
  const list = $("dl-ledger");
  list.append(item);
  noteTeamUpdate();
}

function queueLedger(delayMs, label, detail) {
  const entry = { label, detail };
  pendingLedger.push(entry);
  const timer = setTimeout(() => {
    pendingTimers.delete(timer);
    pendingLedger = pendingLedger.filter((x) => x !== entry);
    addLedger(label, detail);
  }, delayMs);
  pendingTimers.add(timer);
}

function flushPendingLedger() {
  pendingTimers.forEach(clearTimeout);
  pendingTimers.clear();
  pendingLedger.forEach((x) => addLedger(x.label, x.detail));
  pendingLedger = [];
}

function renderQuestions() {
  const list = $("dl-questions-list");
  list.replaceChildren(...state.questions.map((q) => {
    const li = document.createElement("li");
    li.textContent = q;
    li.className = "is-new";
    return li;
  }));
  $("dl-questions-empty").hidden = state.questions.length > 0;
}

// ---------------------------------------------------------------------------
// Client tools: names and parameters exactly as configured on the agent
// ---------------------------------------------------------------------------

const clientTools = {
  registrar_interes: async ({ tipo_unidad, proposito, plazo } = {}) => {
    state.lead.tipo_unidad = String(tipo_unidad ?? "").trim();
    state.lead.proposito = String(proposito ?? "").trim();
    state.lead.plazo = String(plazo ?? "").trim();
    const lead = $("dl-lead");
    setField(lead, "tipo_unidad", state.lead.tipo_unidad);
    setField(lead, "proposito", state.lead.proposito);
    setField(lead, "plazo", state.lead.plazo);
    addLedger("Interés registrado", [state.lead.tipo_unidad, state.lead.proposito, state.lead.plazo].filter(Boolean).join(" · "));
  },

  registrar_presupuesto: async ({ rango } = {}) => {
    state.budget = String(rango ?? "").trim();
    const el = $("dl-budget-value");
    el.textContent = state.budget || "Sin registrar.";
    el.classList.toggle("is-empty", !state.budget);
    if (state.budget) flash(el);
    addLedger("Presupuesto declarado", `${state.budget} · dicho por la persona, tras su sí`);
  },

  consultar_horarios: async ({ dia } = {}) => {
    state.agenda ??= buildAgenda();
    const { day, sunday } = findDay(state.agenda, dia);
    if (sunday) return "La sala de ventas está cerrada los domingos. Horarios libres: ninguno ese día.";
    if (!day) {
      const options = state.agenda.map((x) => x.label).join(", ");
      return `Solo se agenda dentro de los próximos catorce días. Días con horarios: ${options}.`;
    }
    if (!day.free.length) return `No quedan horarios libres para ${day.label}.`;
    return `Horarios libres: ${day.free.join(", ")}`;
  },

  agendar_visita: async ({ nombre, dia, hora } = {}) => {
    state.agenda ??= buildAgenda();
    const { day } = findDay(state.agenda, dia);
    const slot = normalizeHour(hora);
    if (!day) return "No pude reservar: ese día no tiene horarios disponibles. Ofrezca otro día.";
    if (!day.free.includes(slot)) {
      return day.free.length
        ? `Ese horario no está libre. Horarios libres: ${day.free.join(", ")}`
        : `No quedan horarios libres para ${day.label}.`;
    }
    if (state.visit) state.visit.day.free = [...state.visit.day.free, state.visit.slot].sort(); // re-booking frees the old slot
    day.free = day.free.filter((x) => x !== slot);
    state.visit = { day, slot };

    const person = String(nombre ?? "").trim();
    if (person) {
      state.lead.nombre = person;
      setField($("dl-lead"), "nombre", person);
    }
    const visit = $("dl-visit");
    setField(visit, "dia", day.label);
    setField(visit, "hora", slot);
    setField(visit, "sala", SALA);
    $("dl-visit-note").hidden = false;
    addLedger("Visita reservada", `${day.label}, ${slot} · ${SALA}`);
    queueLedger(1100, "Confirmación por correo (simulada)", "No se envía ningún correo real: es una simulación.");
    return `Visita simulada registrada para ${day.label} a las ${slot} en la sala de ventas de Residencial Demo Narvarte.`;
  },

  registrar_pregunta: async ({ pregunta } = {}) => {
    const q = String(pregunta ?? "").trim();
    if (!q) return;
    state.questions.push(q);
    renderQuestions();
    addLedger("Pregunta anotada para el asesor", q);
  },

  pedir_humano: async ({ motivo } = {}) => {
    state.handoff = String(motivo ?? "").trim() || "La persona pidió hablar con alguien del equipo.";
    const el = $("dl-handoff-value");
    el.textContent = `Solicitado. Motivo: ${state.handoff}`;
    el.classList.remove("is-empty");
    el.classList.add("is-alert");
    flash(el);
    addLedger("Traspaso a una persona solicitado", state.handoff);
  },
};

// ---------------------------------------------------------------------------
// Audio level visual
// ---------------------------------------------------------------------------

const BAR_COUNT = 28;
const bars = Array.from({ length: BAR_COUNT }, () => document.createElement("span"));
$("dl-level").replaceChildren(...bars);

function paintLevel(value, now) {
  const level = Math.min(1, value);
  bars.forEach((bar, i) => {
    const centre = 1 - Math.abs(i - (BAR_COUNT - 1) / 2) / (BAR_COUNT / 2);
    const wobble = 0.55 + 0.45 * Math.sin(now / 110 + i * 0.9);
    bar.style.transform = `scaleY(${(0.06 + level * (0.35 + 0.65 * centre) * wobble).toFixed(3)})`;
  });
}

function levelLoop(now) {
  let value = 0;
  try {
    if (conversation && connected) {
      const raw = mode === "speaking" ? conversation.getOutputVolume?.() : conversation.getInputVolume?.();
      value = Math.min(1, (Number(raw) || 0) * 2.2);
    }
  } catch { /* volume is cosmetic */ }
  paintLevel(value, now);
  rafId = requestAnimationFrame(levelLoop);
}

function startLevel() { if (!rafId) rafId = requestAnimationFrame(levelLoop); }
function stopLevel() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
  paintLevel(0, 0);
}
paintLevel(0, 0);

// ---------------------------------------------------------------------------
// Call timer
// ---------------------------------------------------------------------------

const mmss = (s) => `${Math.floor(s / 60)}:${pad(s % 60)}`;

function startTimer() {
  stopTimer();
  const tick = () => {
    const seconds = Math.min(MAX_CALL_SECONDS, Math.floor((Date.now() - state.startedAt) / 1000));
    $("dl-timer").textContent = `${mmss(seconds)} / ${mmss(MAX_CALL_SECONDS)}`;
    $("dl-timer").dataset.warn = seconds >= MAX_CALL_SECONDS - 30 ? "1" : ""; // last 30 s
  };
  tick();
  timerId = setInterval(tick, 500);
}
function stopTimer() { if (timerId) clearInterval(timerId); timerId = null; }

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

const IN_APP_HINT = " Si abriste el enlace desde WhatsApp, Instagram o Facebook, ábrelo en Safari o Chrome.";

function describeError(error) {
  const name = error?.name ?? "";
  const text = `${error?.message ?? ""} ${error?.closeReason ?? ""} ${typeof error === "string" ? error : ""} ${error?.code ?? ""} ${error?.reason ?? ""}`;
  if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") {
    return "No pudimos usar el micrófono porque el navegador no dio permiso. Toca el candado junto a la dirección, permite el micrófono y vuelve a intentar." + IN_APP_HINT;
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No encontramos un micrófono en este dispositivo. Conecta unos audífonos con micrófono y vuelve a intentar.";
  if (name === "NotReadableError" || name === "AbortError") return "Otra aplicación está usando el micrófono. Ciérrala y vuelve a intentar.";
  if (name === "UnsupportedError") return "Este navegador no permite llamadas de voz en esta página." + IN_APP_HINT;
  if (/origin|allowlist|allow list|not allowed|forbidden|unauthori|\b40[13]\b/i.test(text)) {
    return "Esta página no está autorizada para iniciar la llamada de demostración. Avisa a la persona que te compartió el enlace.";
  }
  if (/limit|concurren|busy|too many|\b429\b|quota/i.test(text)) {
    return "La demostración está ocupada o llegó a su límite de hoy. Espera unos minutos y vuelve a intentar.";
  }
  return "No pudimos conectar la llamada. Revisa tu conexión a internet y vuelve a intentar.";
}

function showError(message) {
  $("dl-error-text").textContent = message;
  $("dl-error").hidden = false;
}
function clearError() { $("dl-error").hidden = true; }

// ---------------------------------------------------------------------------
// Call lifecycle
// ---------------------------------------------------------------------------

// iOS Safari keeps an AudioContext suspended unless it is started inside the tap, and the
// getUserMedia permission prompt below can use the tap up. Create and resume one synchronously
// (the SDK also stashes its own on touchstart, but only for 30 s), play one silent frame, and keep
// it for the length of the call.
let unlockCtx = null;
function unlockAudio() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx || unlockCtx) return;
    unlockCtx = new Ctx();
    const source = unlockCtx.createBufferSource();
    source.buffer = unlockCtx.createBuffer(1, 1, 22050);
    source.connect(unlockCtx.destination);
    source.start(0);
    unlockCtx.resume().catch(() => {});
  } catch { unlockCtx = null; }
}
function releaseAudio() {
  try { unlockCtx?.close().catch(() => {}); } catch { /* ignore */ }
  unlockCtx = null;
}

async function requestWakeLock() {
  try { wakeLock = await navigator.wakeLock?.request("screen"); } catch { wakeLock = null; }
}
function releaseWakeLock() {
  try { wakeLock?.release(); } catch { /* ignore */ }
  wakeLock = null;
}

async function startCall() {
  if (!$("dl-consent").checked || conversation || root.dataset.state === "connecting") return;
  unlockAudio(); // must run before the first await
  clearError();
  state.consentAt ??= new Date();
  connected = false;
  finishing = false;
  setState("connecting");
  $("dl-btn").disabled = true;
  $("dl-btn").textContent = "Conectando…";
  setMode("connecting", "Conectando…");

  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      const e = new Error("no mediaDevices"); e.name = "UnsupportedError"; throw e;
    }
    // Ask for the microphone inside the click (Safari needs the user gesture), then release it:
    // the SDK opens its own stream.
    const probe = await navigator.mediaDevices.getUserMedia({ audio: true });
    probe.getTracks().forEach((t) => t.stop());

    state.agenda = null;
    state.startedAt = Date.now();
    addLedger("Consentimiento aceptado", "La persona marcó la casilla antes de hablar.", state.consentAt);

    const session = await Conversation.startSession({
      agentId: AGENT_ID,
      connectionType: "websocket",
      libsampleratePath: LIBSAMPLERATE_PATH, // Safari/iOS resample worklet, served from this site (not a CDN)
      dynamicVariables: dynamicVariables(),
      clientTools,
      onConnect: () => {
        connected = true;
        setState("live");
        $("dl-btn").disabled = false;
        $("dl-btn").textContent = "Colgar";
        setMode("listening", "Escuchando");
        state.startedAt = Date.now();
        startTimer();
        startLevel();
        requestWakeLock();
        addLedger("Llamada iniciada", "Sofía se presenta como asistente de IA.");
      },
      onDisconnect: (details) => finishCall(details),
      onError: (error) => {
        if (!connected) { failCall(error); return; }
        showError(describeError(error));
      },
      onModeChange: ({ mode: next }) => {
        if (!connected) return;
        if (next === "speaking") setMode("speaking", "Sofía está hablando");
        else setMode("listening", "Escuchando");
      },
      onMessage: (message) => {
        const source = message?.source ?? message?.role;
        const who = source === "user" ? "user" : "ai";
        state.turns[who] += 1;
        addTranscript(who, message?.message);
      },
    });
    conversation = session;
    // The connection may have dropped while startSession was resolving.
    if (finishing) { try { await session.endSession(); } catch { /* ignore */ } conversation = null; }
  } catch (error) {
    failCall(error);
  }
}

function failCall(error) {
  if (error && error.name !== "NotAllowedError") console.error("demo-en-vivo:", error?.message ?? error);
  const message = describeError(error);
  teardown();
  // Nothing real happened: drop the rows of a call that never started.
  state.ledger = [];
  $("dl-ledger").replaceChildren(Object.assign(document.createElement("li"), { className: "dl-empty", id: "dl-ledger-empty", textContent: "Cada paso aparecerá aquí con su hora." }));
  state.startedAt = null;
  setState("error");
  showError(message);
  $("dl-btn").disabled = !$("dl-consent").checked;
  $("dl-btn").textContent = "Hablar ahora";
  setMode("idle", "No se pudo iniciar la llamada");
}

function teardown() {
  stopTimer();
  stopLevel();
  releaseWakeLock();
  releaseAudio();
  connected = false;
  conversation = null;
}

function finishCall(details) {
  if (finishing) return;
  finishing = true;
  const wasConnected = connected;
  teardown();
  if (!wasConnected) {
    // The server may close before onConnect (for example an origin refusal): report it as a failed start.
    if (root.dataset.state === "connecting") failCall(details);
    return;
  }
  state.endedAt = Date.now();
  flushPendingLedger();
  const timedOut = (state.endedAt - state.startedAt) / 1000 >= MAX_CALL_SECONDS - 6;
  addLedger("Llamada terminada", timedOut ? "Se acabó el tiempo de la prueba (cinco minutos)." : details?.reason === "agent" ? "Sofía cerró la llamada." : details?.reason === "error" ? "La conexión se cortó." : "La persona colgó.");
  setState("ended");
  setMode("idle", "Llamada terminada");
  $("dl-btn").textContent = "Hablar ahora";
  $("dl-btn").disabled = true;
  if (details?.reason === "error") showError("Se cortó la conexión durante la llamada. Puedes volver a probar.");
  renderSummary();
}

async function hangUp() {
  if (!conversation) return;
  $("dl-btn").disabled = true;
  try { await conversation.endSession(); } catch (error) { console.error("demo-en-vivo:", error?.message ?? error); finishCall({ reason: "user" }); }
}

// ---------------------------------------------------------------------------
// Summary + reset
// ---------------------------------------------------------------------------

function renderSummary() {
  const seconds = Math.max(0, Math.round((state.endedAt - state.startedAt) / 1000));
  const rows = [
    ["Duración", mmss(seconds)],
    ["Turnos", `${state.turns.ai} de Sofía · ${state.turns.user} tuyos`],
    ["Lead", [state.lead.nombre, state.lead.tipo_unidad, state.lead.proposito, state.lead.plazo].filter(Boolean).join(" · ") || "Sin datos registrados"],
    ["Presupuesto declarado", state.budget || "No registrado"],
    ["Visita", state.visit ? `${state.visit.day.label}, ${state.visit.slot} · ${SALA}` : "No se reservó"],
    ["Preguntas por confirmar", state.questions.length ? state.questions.join(" · ") : "Ninguna"],
    ["Traspaso a una persona", state.handoff ? `Solicitado: ${state.handoff}` : "No solicitado"],
    ["Pasos en el registro", String(state.ledger.length)],
  ];
  const list = $("dl-summary-list");
  list.replaceChildren(...rows.flatMap(([k, v]) => {
    const dt = document.createElement("dt"); dt.textContent = k;
    const dd = document.createElement("dd"); dd.textContent = v;
    return [dt, dd];
  }));
  $("dl-summary").hidden = false;
  $("dl-summary").scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function resetAll() {
  pendingTimers.forEach(clearTimeout);
  pendingTimers.clear();
  pendingLedger = [];
  teardown();
  state = fresh();
  finishing = false;
  $("dl-consent").checked = false;
  $("dl-btn").disabled = true;
  $("dl-btn").textContent = "Hablar ahora";
  $("dl-timer").textContent = `0:00 / ${mmss(MAX_CALL_SECONDS)}`;
  $("dl-timer").dataset.warn = "";
  setMode("idle", "Lista para llamar");
  clearError();
  $("dl-summary").hidden = true;
  $("dl-transcript").replaceChildren(Object.assign(document.createElement("li"), { className: "dl-empty", id: "dl-transcript-empty", textContent: "Aquí aparece lo que digan Sofía y tú." }));
  $("dl-ledger").replaceChildren(Object.assign(document.createElement("li"), { className: "dl-empty", id: "dl-ledger-empty", textContent: "Cada paso aparecerá aquí con su hora." }));
  for (const [id, names] of [["dl-lead", ["nombre", "tipo_unidad", "proposito", "plazo"]], ["dl-visit", ["dia", "hora", "sala"]]]) {
    for (const name of names) {
      const el = $(id).querySelector(`[data-field="${name}"]`);
      el.textContent = "—";
      el.classList.add("is-empty");
      el.classList.remove("is-new");
    }
  }
  const budget = $("dl-budget-value");
  budget.textContent = "Sin registrar. Solo se guarda si la persona lo acepta y lo dice.";
  budget.classList.add("is-empty");
  $("dl-visit-note").hidden = true;
  renderQuestions();
  const handoff = $("dl-handoff-value");
  handoff.textContent = "No solicitado.";
  handoff.classList.add("is-empty");
  handoff.classList.remove("is-alert");
  $("dl-tab-team").classList.remove("has-news");
  setView("call");
  setState("idle");
  window.scrollTo({ top: $("dl").offsetTop - 80, behavior: "smooth" });
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

function setView(view) {
  root.dataset.view = view;
  $("dl-tab-call").setAttribute("aria-pressed", String(view === "call"));
  $("dl-tab-team").setAttribute("aria-pressed", String(view === "team"));
  if (view === "team") $("dl-tab-team").classList.remove("has-news");
}

$("dl-consent").addEventListener("change", (event) => {
  const ok = event.target.checked;
  state.consentAt = ok ? new Date() : null;
  const idle = root.dataset.state === "idle" || root.dataset.state === "error";
  if (idle) $("dl-btn").disabled = !ok;
  if (!ok && conversation && connected) hangUp(); // withdrawing consent ends the call
});

$("dl-btn").addEventListener("click", () => {
  if (conversation && connected) hangUp();
  else startCall();
});
$("dl-retry").addEventListener("click", () => {
  clearError();
  setState("idle");
  if ($("dl-consent").checked) startCall();
});
$("dl-reset").addEventListener("click", resetAll);
document.querySelectorAll(".dl-tab").forEach((tab) => tab.addEventListener("click", () => setView(tab.dataset.view)));

// Leaving the page hangs up (no orphan sessions eating the daily limit).
window.addEventListener("pagehide", () => { try { conversation?.endSession(); } catch { /* ignore */ } });
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && connected && !wakeLock) requestWakeLock(); });

// A browser may restore a ticked checkbox after a reload or back navigation: honour what is on screen.
$("dl-consent").checked = false;
$("dl-btn").disabled = true;
