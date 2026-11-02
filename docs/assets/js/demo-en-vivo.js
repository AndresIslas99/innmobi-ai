// innmobi.ai · /demo-en-vivo/
// Live voice demo: Valeria (an ElevenLabs agent on the same v6 pipeline as the phone line) + the team panel
// for this conversation, read from the backend.
//
// The tools run on the server (api.innmobi.ai), not in the browser. While the call is connected this page asks
//   GET {API}/v1/demo/web/state?conversation_id=<id>   -> 200 {server_time, call} | 404 | 429
// every 2 seconds and paints `call` (the Call.as_json shape of the realestate-crm voice_demo module, the same
// one the team's panel shows). 404 means "not created yet" (the call exists after Valeria's first tool call)
// and is not an error. The route is public, covers only web conversations and needs no credential, so the
// request carries no cookie, no header beyond Accept and no referrer.
//
// Privacy by construction: nothing here touches localStorage, sessionStorage, cookies or IndexedDB. The
// network peers are ElevenLabs (the call; the SDK itself is served from this site) and api.innmobi.ai (the
// panel). The agent id below is public (the agent is protected by an origin allowlist and call limits); no
// secret lives here. The conversation is recorded (audio and transcript, 30 days): the page says so.

// The SDK is vendored (no third-party script on a microphone page). See assets/js/vendor/README.md.
import { Conversation } from "./vendor/elevenlabs-client-1.26.0.js";

// The web agent "innmobi · demo corretaje v6 (web)", created 2026-11-02 by apply_v6.py --channel=web; check_routing.py
// verifies this value against the live platform. The validate and deploy workflows fail on the placeholder
// "agent_PENDING_V6_WEB" this line held before. Never roll the page back by changing
// only this id: the older agent's tools run in the browser (clientTools) and this page registers none, so revert the
// whole site commit instead. The release order is in README.md ("Releasing the live demo page").
const AGENT_ID = "agent_9401m6edv6k8e3xbbm4g92y1q8yv";
const LIBSAMPLERATE_PATH = new URL("./vendor/libsamplerate.worklet-2.1.2.js", import.meta.url).href;
const TZ = "America/Mexico_City";
const MAX_CALL_SECONDS = 900; // the agent's max_duration_seconds
const WARN_SECONDS = 30; // the timer turns red for the last 30 s

const POLL_MS = 2000; // panel refresh while connected
const FINAL_POLL_MS = 3000; // one last read after the call ends
const BACKOFF_MS = [4000, 8000, 16000, 30000]; // after a 429, a server error or a network error
const JITTER_MIN = 0.2; // every back-off wait gets 20 to 30 percent more, at random, so pages behind one address do not retry together
const JITTER_MAX = 0.3;
const CLEAN_READS_TO_RECOVER = 2; // answers in a row before the page goes back to POLL_MS
const MAX_RETRY_AFTER_MS = 60000;
const LONG_RETRY_MS = 10000; // a Retry-After this long shows the notice at once
const REQUEST_TIMEOUT_MS = 8000;
const FAILS_BEFORE_NOTICE = 3;
const CONVERSATION_ID = /^[A-Za-z0-9_-]{8,80}$/; // the backend's pattern; the SDK id is checked before it goes in a URL

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

const $ = (id) => document.getElementById(id);
const root = $("dl");

// ---------------------------------------------------------------------------
// API base: the data-api-base attribute. A ?api= override works only on localhost (tests), so a crafted
// link can never point this page at another host.
// ---------------------------------------------------------------------------

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
const API_OK = /^https:\/\//.test(API) || (IS_LOCAL && /^http:\/\//.test(API));

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

// The agent reads these two as {{fecha_hoy}} and {{hora_actual}}: "domingo 1 de noviembre de 2026" and "23:38".
function dynamicVariables() {
  const n = mxNow();
  return {
    fecha_hoy: `${dayLabel(n.wd, n.d, n.m)} de ${n.y}`,
    hora_actual: `${pad(n.h)}:${pad(n.min)}`,
  };
}

// "2026-10-13T14:05:12-06:00" is already Mexico City time: read the clock straight from the string.
const clockOf = (iso) => (/T(\d{2}:\d{2}:\d{2})/.exec(iso || "") || [])[1] || "";
const msOf = (iso) => { const t = Date.parse(iso || ""); return Number.isFinite(t) ? t : null; };

// ---------------------------------------------------------------------------
// Reading the server's call defensively (every field is optional; text only ever goes in via textContent)
// ---------------------------------------------------------------------------

const OP_LABEL = {
  preventa: "Preventa", reventa: "Reventa", remate: "Remate bancario", recuperada: "Recuperada",
  renta: "Renta", renta_amueblada: "Renta amueblada", renta_comercial: "Renta comercial", terreno: "Terreno",
  renta_opcion_compra: "Opción a compra",
};
const OP_BY_PREFIX = { PV: "preventa", RV: "reventa", RM: "remate", RCP: "recuperada", RN: "renta", RA: "renta_amueblada", CM: "renta_comercial", TE: "terreno", OC: "renta_opcion_compra" };
const MODALIDAD_LABEL = { sala: "Sala de ventas", propiedad: "En la propiedad", video: "Videollamada" };
const MAX_PROPS = 8; // what the backend remembers per call
const MAX_LEDGER = 200;
const IMG_DIR = "/assets/demo/catalogo/";

const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : (typeof v === "number" && Number.isFinite(v) ? String(v) : null));
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const mxn = (n) => "$" + new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 }).format(n);
const safeId = (id) => (id && /^[A-Za-z0-9_-]{1,40}$/.test(id) ? id : null);

// The demo has two cities. A panel item names its city in `ciudad` ("cdmx" or "puebla"); that wins when it is there. Items without it
// carry only the municipality (`alcaldia_municipio`), and a listing is in Puebla exactly when its municipality is one of these (the
// backend's PUEBLA_MUNICIPALITIES); any other municipality is Mexico City or its metro area. Keep this list in step with the backend.
// An item with neither gets no city. The label only ever comes from the two fixed strings below, never from server text.
const CITY_CDMX = "Ciudad de México";
const CITY_PUEBLA = "Puebla";
const foldName = (v) => v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const CITY_BY_CODE = new Map([["cdmx", CITY_CDMX], ["ciudad de mexico", CITY_CDMX], ["puebla", CITY_PUEBLA]]);
const PUEBLA_MUNICIPIOS = new Set([
  "Puebla", "San Andrés Cholula", "San Pedro Cholula", "Cuautlancingo", "Coronango", "Amozoc",
  "Santa Clara Ocoyucan", "Juan C. Bonilla", "Tlaltenango", "San Gregorio Atzompa",
].map(foldName));

function cityOf(raw) {
  const code = str(raw && raw.ciudad);
  const named = code && CITY_BY_CODE.get(foldName(code));
  if (named) return named;
  const municipio = str(raw && raw.alcaldia_municipio);
  if (!municipio) return null;
  return PUEBLA_MUNICIPIOS.has(foldName(municipio)) ? CITY_PUEBLA : CITY_CDMX;
}

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
    id, key: id || nombre, nombre, operacion, zona: str(raw.zona), ciudad: cityOf(raw),
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
  if (!v || typeof v !== "object") return null;
  const out = {
    dia: str(v.dia), hora: str(v.hora), sala: str(v.sala), seguimiento: str(v.seguimiento),
    propiedad_id: str(v.propiedad_id), propiedad_nombre: str(v.propiedad_nombre), modalidad: modalidadLabel(v.modalidad),
  };
  return out.dia || out.hora ? out : null;
}

const EMPTY_CALL = Object.freeze({
  ref: null, status: "active",
  lead: Object.freeze({ nombre: null, tipo_unidad: null, proposito: null, plazo: null }),
  presupuesto: null, propiedades: [], consultada: null, visita: null, preguntas: [], traspaso: null, ledger: [],
});

// `Call.as_json` of the backend, reduced to what this page draws.
function normCall(raw) {
  if (!raw || typeof raw !== "object") return null;
  const lead = raw.lead && typeof raw.lead === "object" ? raw.lead : {};
  const traspaso = raw.traspaso && typeof raw.traspaso === "object" ? raw.traspaso : null;
  const ledger = (Array.isArray(raw.ledger) ? raw.ledger : [])
    .filter((x) => x && typeof x === "object" && str(x.text))
    .map((x) => ({ seq: num(x.seq) ?? 0, at: str(x.at) || "", text: str(x.text) }))
    .sort((a, b) => a.seq - b.seq)
    .slice(-MAX_LEDGER);
  return {
    ref: str(raw.call_ref),
    status: raw.status === "ended" ? "ended" : "active",
    lead: { nombre: str(lead.nombre), tipo_unidad: str(lead.tipo_unidad), proposito: str(lead.proposito), plazo: str(lead.plazo) },
    presupuesto: str(raw.presupuesto),
    propiedades: normItems(raw.propiedades),
    consultada: str(raw.propiedad_consultada),
    visita: normVisit(raw.visita),
    preguntas: (Array.isArray(raw.preguntas) ? raw.preguntas : []).map(str).filter(Boolean),
    traspaso: traspaso ? { motivo: str(traspaso.motivo) } : null,
    ledger,
  };
}

// ---------------------------------------------------------------------------
// Session state (in memory only)
// ---------------------------------------------------------------------------

const fresh = () => ({
  consentAt: null,
  startedAt: null,
  endedAt: null,
  turns: { ai: 0, user: 0 },
});

let state = fresh();
let view = EMPTY_CALL; // the last call read from the server (normalised)
let localRows = []; // page-side ledger rows: consent, start, end. {at: Date, label, detail}
let skewMs = 0; // server clock minus this device's clock, to order page rows among the server's
let conversation = null;
let conversationId = null;
let connected = false;
let finishing = false;
let mode = "idle";
let timerId = null;
let rafId = null;
let wakeLock = null;

// ---------------------------------------------------------------------------
// UI helpers (everything is written with textContent: transcript and server fields are
// untrusted input from the model and from the person)
// ---------------------------------------------------------------------------

function setState(next) { root.dataset.state = next; }

function setMode(next, text) {
  mode = next;
  $("dl-status").dataset.mode = next;
  $("dl-status-text").textContent = text;
}

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};

function flash(node) {
  node.classList.remove("is-new");
  void node.offsetWidth; // restart the animation
  node.classList.add("is-new");
}

function noteTeamUpdate() {
  if (root.dataset.view !== "team") $("dl-tab-team").classList.add("has-news");
}

function addTranscript(who, text) {
  const clean = String(text ?? "").trim();
  if (!clean) return;
  $("dl-transcript-empty")?.remove();
  const item = document.createElement("li");
  item.className = who === "user" ? "dl-line dl-line-user" : "dl-line dl-line-ai";
  const label = document.createElement("span");
  label.className = "dl-line-who";
  label.textContent = who === "user" ? "Tú" : "Valeria · IA";
  const body = document.createElement("p");
  body.textContent = clean;
  item.append(label, body);
  const list = $("dl-transcript");
  list.append(item);
  list.scrollTop = list.scrollHeight;
}

// ---------------------------------------------------------------------------
// The team panel: one function paints a normalised call. Every paint helper returns true when
// something the person would notice changed, which lights the news dot on the mobile tab.
// ---------------------------------------------------------------------------

// Writes `value` (or the empty text) into `node`; flashes when a real value changed.
function paint(node, value, empty, animate) {
  const text = str(value);
  const next = text ?? empty;
  const changed = node.textContent !== next;
  if (changed) {
    node.textContent = next;
    if (text && animate) flash(node);
  }
  node.classList.toggle("is-empty", !text);
  return changed && !!text;
}

const field = (container, name) => container.querySelector(`[data-field="${name}"]`);

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

const propNodes = new Map(); // item.key -> <li>
const ledgerNodes = new Map(); // row key -> <li>
const findProp = (call, id) => (id ? call.propiedades.find((p) => p.id === id) || null : null);

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

function propertyCard(item) {
  const li = el("li", "dl-prop");
  li.dataset.key = item.key;
  if (item.id) li.dataset.id = item.id;
  li.dataset.op = item.operacion || "otro";

  const photo = el("div", "dl-prop-photo");
  const src = imageSrc(item);
  if (src) {
    const img = el("img", "dl-prop-img");
    img.alt = item.nombre ? `Imagen ilustrativa de ${item.nombre}` : "Imagen ilustrativa de la propiedad";
    img.decoding = "async";
    img.loading = "lazy";
    img.addEventListener("error", () => { photo.classList.add("is-missing"); img.remove(); }, { once: true });
    img.src = src;
    photo.append(img);
  } else {
    photo.classList.add("is-missing");
  }
  photo.append(el("span", "dl-prop-ill", "imagen ilustrativa"));

  const body = el("div", "dl-prop-body");
  body.append(el("span", "dl-prop-op", OP_LABEL[item.operacion] || "Propiedad"));
  body.append(el("span", "dl-prop-name", item.nombre || item.id || "Propiedad"));
  const place = [item.zona, item.ciudad].filter(Boolean).join(" · ");
  if (place) body.append(el("span", "dl-prop-zona", place));
  const price = priceOf(item);
  if (price.main) {
    const p = el("span", "dl-prop-price", price.main);
    if (price.unit) p.append(el("span", "dl-prop-unit", price.unit));
    body.append(p);
  }
  if (price.sub) body.append(el("span", "dl-prop-sub", price.sub));
  const meta = metaOf(item);
  if (meta) body.append(el("span", "dl-prop-meta", meta));

  const flags = el("div", "dl-prop-flags");
  flags.append(el("span", "dl-prop-flag dl-flag-viewed", "Pidió detalles"), el("span", "dl-prop-flag dl-flag-visit", "Visita agendada (demo)"));
  li.append(flags, photo, body);
  return li;
}

function renderProps(call, animate) {
  const items = call.propiedades;
  let news = false;
  const order = items.map((item) => {
    let li = propNodes.get(item.key);
    if (!li) {
      li = propertyCard(item);
      propNodes.set(item.key, li);
      if (animate) { li.classList.add("is-new"); settleOnEnd(li, "dl-flash"); news = true; }
    }
    li.classList.toggle("is-viewed", !!call.consultada && item.id === call.consultada);
    li.classList.toggle("is-visit", !!(call.visita && call.visita.propiedad_id && item.id === call.visita.propiedad_id));
    return li;
  });
  const keys = new Set(items.map((x) => x.key));
  for (const key of [...propNodes.keys()]) if (!keys.has(key)) propNodes.delete(key);
  syncChildren($("dl-props-list"), order);
  $("dl-props-empty").hidden = items.length > 0;
  $("dl-props-count").textContent = items.length ? String(items.length) : "";
  return news;
}

function renderQuestions(call, animate) {
  const list = $("dl-questions-list");
  const had = list.children.length;
  list.replaceChildren(...call.preguntas.map((q, i) => {
    const li = el("li", "", q);
    if (animate && i >= had) li.classList.add("is-new");
    return li;
  }));
  $("dl-questions-empty").hidden = call.preguntas.length > 0;
  return animate && call.preguntas.length > had;
}

function renderVisit(call, animate) {
  const box = $("dl-visit");
  const v = call.visita;
  let news = false;
  news = paint(field(box, "dia"), v && v.dia, "—", animate) || news;
  news = paint(field(box, "hora"), v && v.hora, "—", animate) || news;
  news = paint(field(box, "modalidad"), v && v.modalidad, "—", animate) || news;
  const propName = v && (v.propiedad_nombre || (findProp(call, v.propiedad_id) || {}).nombre || v.propiedad_id);
  for (const [id, text] of [["dl-visit-prop", propName ? `Propiedad: ${propName}` : ""], ["dl-visit-place", v && v.sala ? `Lugar: ${v.sala}` : ""], ["dl-visit-follow", v && v.seguimiento ? v.seguimiento : ""]]) {
    const node = $(id);
    node.textContent = text;
    node.hidden = !text;
  }
  return news;
}

// Server rows keep the sentence the backend wrote; page rows (consent, start, end) have a label and a detail.
function ledgerRows(call) {
  const rows = call.ledger.map((e) => ({
    key: `s${e.seq}`, ms: msOf(e.at) ?? 0, time: clockOf(e.at), iso: e.at, label: e.text, detail: "", page: false,
  }));
  localRows.forEach((r, i) => {
    const at = new Date(r.at.getTime() + skewMs);
    rows.push({ key: `p${i}`, ms: at.getTime(), time: clock(at), iso: at.toISOString(), label: r.label, detail: r.detail, page: true });
  });
  rows.sort((a, b) => a.ms - b.ms || (a.key < b.key ? -1 : 1));
  return rows.reverse(); // newest first
}

function ledgerRow(row, animate) {
  const li = el("li", "dl-ledger-row");
  if (!animate) li.classList.add("no-anim");
  const time = el("time", "", row.time);
  time.dateTime = row.iso;
  const what = el("div");
  if (row.page) {
    what.append(el("strong", "", row.label));
    if (row.detail) what.append(el("span", "", row.detail));
  } else {
    what.append(el("div", "dl-ledger-text", row.label));
  }
  li.append(time, what);
  return li;
}

function renderLedger(call, animate) {
  const rows = ledgerRows(call);
  let news = false;
  const order = rows.map((row) => {
    let li = ledgerNodes.get(row.key);
    if (!li) {
      li = ledgerRow(row, animate);
      ledgerNodes.set(row.key, li);
      if (animate) news = true;
    } else {
      const t = li.firstElementChild; // page rows move with the clock skew
      if (t.textContent !== row.time) t.textContent = row.time;
    }
    return li;
  });
  const keys = new Set(rows.map((x) => x.key));
  for (const key of [...ledgerNodes.keys()]) if (!keys.has(key)) ledgerNodes.delete(key);
  const empty = $("dl-ledger-empty");
  empty.hidden = rows.length > 0;
  syncChildren($("dl-ledger"), [...order, empty]);
  return news;
}

function renderTeam(call, animate = true) {
  const lead = $("dl-lead");
  let news = false;
  news = paint(field(lead, "nombre"), call.lead.nombre, "—", animate) || news;
  news = paint(field(lead, "tipo_unidad"), call.lead.tipo_unidad, "—", animate) || news;
  news = paint(field(lead, "proposito"), call.lead.proposito, "—", animate) || news;
  news = paint(field(lead, "plazo"), call.lead.plazo, "—", animate) || news;
  news = paint($("dl-budget-value"), call.presupuesto, "Sin registrar. Solo se guarda si la persona lo acepta y lo dice.", animate) || news;
  news = renderProps(call, animate) || news;
  news = renderVisit(call, animate) || news;
  news = renderQuestions(call, animate) || news;
  const handoff = $("dl-handoff-value");
  const asked = !!call.traspaso;
  news = paint(handoff, asked ? `Solicitado. Motivo: ${call.traspaso.motivo || "la persona pidió hablar con alguien del equipo"}` : null, "No solicitado.", animate) || news;
  handoff.classList.toggle("is-alert", asked);
  news = renderLedger(call, animate) || news;
  refreshTag();
  if (news && animate) noteTeamUpdate();
}

// "Sin llamada" -> "Esperando" (connected, no tool called yet) -> "En vivo" -> "Llamada terminada".
// Only this page ends the call on screen: the visitor's hang-up or the connection closing sets state.endedAt. The server's own
// "ended" status (for example its idle timeout) says nothing about the audio session, so while that is open the tag stays "En vivo".
function refreshTag() {
  let tag = "idle", text = "Sin llamada";
  if (state.endedAt) { tag = "ended"; text = "Llamada terminada"; }
  else if (view.ref) { tag = "live"; text = "En vivo"; }
  else if (connected) { tag = "waiting"; text = "Esperando"; }
  const node = $("dl-team-tag");
  node.dataset.state = tag;
  node.textContent = text;
}

function setTeamNotice(text) {
  const n = $("dl-team-notice");
  n.textContent = text || "";
  n.hidden = !text;
}

function addPageRow(label, detail = "", at = new Date()) {
  localRows.push({ at, label, detail });
  renderTeam(view);
}

function clearTeamNodes() {
  propNodes.clear();
  ledgerNodes.clear();
  $("dl-props-list").replaceChildren();
  $("dl-ledger").replaceChildren($("dl-ledger-empty"));
}

function resetTeam() {
  view = EMPTY_CALL;
  localRows = [];
  skewMs = 0;
  clearTeamNodes();
  $("dl-questions-list").replaceChildren();
  setTeamNotice("");
  renderTeam(EMPTY_CALL, false);
  $("dl-tab-team").classList.remove("has-news");
}

// ---------------------------------------------------------------------------
// Polling the panel of this conversation
// ---------------------------------------------------------------------------

let pollGen = 0; // bumped to cancel the loop and any answer still in flight
let pollTimer = null;
let pollAbort = null;
let pollFails = 0; // failed reads since the last full recovery (it is not reset by a single good read)
let cleanReads = 0; // good reads in a row while pollFails > 0
let lastWasRate = false;
let noticeUp = false; // the notice stays up until the page is back to POLL_MS

function stopPolling() {
  pollGen++;
  clearTimeout(pollTimer);
  pollTimer = null;
  try { pollAbort?.abort(); } catch { /* ignore */ }
  pollAbort = null;
}

function startPolling() {
  if (!API_OK || !conversationId) return;
  stopPolling();
  pollFails = 0;
  cleanReads = 0;
  lastWasRate = false;
  noticeUp = false;
  const gen = pollGen;
  pollTimer = setTimeout(() => poll(gen, false), 0);
}

// Once the call is over: one more read a few seconds later (the last tool call may land just after the hang-up).
function pollOnceMore() {
  if (!API_OK || !conversationId) return;
  stopPolling();
  const gen = pollGen;
  pollTimer = setTimeout(() => poll(gen, true), FINAL_POLL_MS);
}

function retryAfterMs(res) {
  const n = Number(res.headers.get("Retry-After"));
  return Number.isFinite(n) && n > 0 ? Math.min(n * 1000, MAX_RETRY_AFTER_MS) : 0;
}

// Back-off steps: the n-th failed read waits BACKOFF_MS[n - 1] (the last step repeats), plus the jitter.
const backoffMs = (fails) => BACKOFF_MS[Math.min(Math.max(fails, 1), BACKOFF_MS.length) - 1];
const withJitter = (ms) => Math.round(ms * (1 + JITTER_MIN + Math.random() * (JITTER_MAX - JITTER_MIN)));

// Book-keeping of one finished read; each returns how long to wait before the next one.
// A failed read backs off. A good read right after it only eases off one step: the page goes back to POLL_MS after
// CLEAN_READS_TO_RECOVER good reads in a row, so a server that is just coming back is not hit at full speed by every page at once.
function readFailed(rate, retryMs = 0) {
  lastWasRate = rate;
  cleanReads = 0;
  pollFails++;
  if (rate && retryMs >= LONG_RETRY_MS) noticeUp = true;
  return withJitter(Math.max(retryMs, backoffMs(pollFails)));
}

function readSucceeded() {
  if (pollFails === 0) return POLL_MS;
  cleanReads++;
  if (cleanReads < CLEAN_READS_TO_RECOVER) return withJitter(backoffMs(pollFails - 1));
  pollFails = 0;
  cleanReads = 0;
  lastWasRate = false;
  noticeUp = false;
  setTeamNotice("");
  return POLL_MS;
}

// "dentro de unos segundos" only for a short wait; a long one says roughly how long.
function waitPhrase(ms) {
  const s = Math.round(ms / 1000);
  if (s < 10) return "en unos segundos";
  if (s < 55) return `dentro de unos ${Math.ceil(s / 5) * 5} segundos`; // never less than the wait
  return "dentro de aproximadamente un minuto";
}

// nextMs is the wait before the next read; null when no read follows (the last one after the call).
function noticeText(nextMs) {
  if (nextMs === null) return "No pudimos actualizar el panel al final de la llamada. Puede faltar lo último que pasó.";
  return lastWasRate
    ? `El panel está recibiendo muchas consultas. Se actualizará ${waitPhrase(nextMs)}; la llamada sigue igual.`
    : "No podemos actualizar este panel por ahora. Lo seguimos intentando; la llamada no se ve afectada.";
}

function applyServerCall(body) {
  const t = msOf(body && body.server_time);
  if (t !== null) skewMs = t - Date.now();
  const call = normCall(body && body.call);
  if (!call) return;
  if (view.ref && call.ref && view.ref !== call.ref) clearTeamNodes(); // another call under the same id: start over
  view = call;
  renderTeam(call, true);
  if (root.dataset.state === "ended") renderSummary(false);
}

async function poll(gen, last) {
  if (gen !== pollGen) return;
  const controller = new AbortController();
  pollAbort = controller;
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let delay = POLL_MS;
  let ok = false;
  try {
    const url = `${API}/v1/demo/web/state?conversation_id=${encodeURIComponent(conversationId)}`;
    const res = await fetch(url, {
      method: "GET", cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer",
      headers: { Accept: "application/json" }, signal: controller.signal,
    });
    if (gen !== pollGen) return;
    if (res.status === 200) {
      const body = await res.json();
      if (gen !== pollGen) return;
      applyServerCall(body);
      delay = readSucceeded();
      ok = true;
    } else if (res.status === 404) {
      delay = readSucceeded(); // not created yet: it appears after Valeria's first tool call. Wait quietly.
      ok = true;
    } else if (res.status === 429) {
      delay = readFailed(true, retryAfterMs(res));
    } else {
      throw new Error(`HTTP ${res.status}`);
    }
  } catch {
    if (gen !== pollGen) return;
    delay = readFailed(false);
  } finally {
    clearTimeout(timeout);
  }
  if (gen !== pollGen) return;
  if (last && ok) { setTeamNotice(""); return; } // the read after the hang-up worked: nothing is pending
  if (pollFails >= FAILS_BEFORE_NOTICE) noticeUp = true;
  if (noticeUp && pollFails > 0) setTeamNotice(noticeText(last ? null : delay));
  if (!last) pollTimer = setTimeout(() => poll(gen, false), delay);
}

// The id comes from the SDK (onConnect, or session.getId()). Only an id with the backend's shape goes into a URL.
function adoptConversation(id) {
  if (conversationId || typeof id !== "string" || !CONVERSATION_ID.test(id)) return;
  conversationId = id;
  startPolling();
}

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
    $("dl-timer").dataset.warn = seconds >= MAX_CALL_SECONDS - WARN_SECONDS ? "1" : ""; // last 30 s
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
  conversationId = null;
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

    state.startedAt = Date.now();
    state.endedAt = null;
    addPageRow("Consentimiento aceptado", "La persona marcó la casilla antes de hablar.", state.consentAt);

    const session = await Conversation.startSession({
      agentId: AGENT_ID,
      connectionType: "websocket",
      libsampleratePath: LIBSAMPLERATE_PATH, // Safari/iOS resample worklet, served from this site (not a CDN)
      dynamicVariables: dynamicVariables(),
      onConnect: (info) => {
        connected = true;
        setState("live");
        $("dl-btn").disabled = false;
        $("dl-btn").textContent = "Colgar";
        setMode("listening", "Escuchando");
        state.startedAt = Date.now();
        startTimer();
        startLevel();
        requestWakeLock();
        addPageRow("Llamada iniciada", "Valeria se presenta como asistente de IA y avisa que la demostración se graba.");
        adoptConversation(info?.conversationId);
      },
      onDisconnect: (details) => finishCall(details),
      onError: (error) => {
        if (!connected) { failCall(error); return; }
        showError(describeError(error));
      },
      onModeChange: ({ mode: next }) => {
        if (!connected) return;
        if (next === "speaking") setMode("speaking", "Valeria está hablando");
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
    try { adoptConversation(session.getId?.()); } catch { /* the id also arrives through onConnect */ }
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
  stopPolling();
  conversationId = null;
  // Nothing real happened: drop the rows of a call that never started.
  resetTeam();
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
  const timedOut = (state.endedAt - state.startedAt) / 1000 >= MAX_CALL_SECONDS - 6;
  addPageRow("Llamada terminada", timedOut ? "Se acabó el tiempo de la prueba (quince minutos)." : details?.reason === "agent" ? "Valeria cerró la llamada." : details?.reason === "error" ? "La conexión se cortó." : "La persona colgó.");
  setState("ended");
  setMode("idle", "Llamada terminada");
  $("dl-btn").textContent = "Hablar ahora";
  $("dl-btn").disabled = true;
  if (details?.reason === "error") showError("Se cortó la conexión durante la llamada. Puedes volver a probar.");
  renderSummary(true);
  pollOnceMore();
}

async function hangUp() {
  if (!conversation) return;
  $("dl-btn").disabled = true;
  try { await conversation.endSession(); } catch (error) { console.error("demo-en-vivo:", error?.message ?? error); finishCall({ reason: "user" }); }
}

// ---------------------------------------------------------------------------
// Summary + reset
// ---------------------------------------------------------------------------

function renderSummary(scroll) {
  const call = view;
  const seconds = Math.max(0, Math.round((state.endedAt - state.startedAt) / 1000));
  const leadParts = [call.lead.nombre, call.lead.tipo_unidad, call.lead.proposito, call.lead.plazo].filter(Boolean);
  const v = call.visita;
  const visitProp = v && (v.propiedad_nombre || (findProp(call, v.propiedad_id) || {}).nombre);
  const visit = v ? [[v.dia, v.hora].filter(Boolean).join(", "), v.modalidad, visitProp].filter(Boolean).join(" · ") : "";
  const names = call.propiedades.map((p) => p.nombre || p.id).filter(Boolean);
  const rows = [
    ["Duración", mmss(seconds)],
    ["Turnos", `${state.turns.ai} de Valeria · ${state.turns.user} tuyos`],
    ["Lead", leadParts.join(" · ") || "Sin datos registrados"],
    ["Presupuesto declarado", call.presupuesto || "No registrado"],
    ["Propiedades sugeridas", names.length ? names.join(" · ") : "Ninguna"],
    ["Visita", visit || "No se agendó"],
    ["Preguntas por confirmar", call.preguntas.length ? call.preguntas.join(" · ") : "Ninguna"],
    ["Traspaso a una persona", call.traspaso ? `Solicitado: ${call.traspaso.motivo || "la persona pidió hablar con alguien del equipo"}` : "No solicitado"],
    ["Pasos en el registro", String(ledgerRows(call).length)],
  ];
  const list = $("dl-summary-list");
  list.replaceChildren(...rows.flatMap(([k, val]) => {
    const dt = document.createElement("dt"); dt.textContent = k;
    const dd = document.createElement("dd"); dd.textContent = val;
    return [dt, dd];
  }));
  const wasHidden = $("dl-summary").hidden;
  $("dl-summary").hidden = false;
  if (scroll && wasHidden) $("dl-summary").scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function resetAll() {
  stopPolling();
  conversationId = null;
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
  $("dl-transcript").replaceChildren(Object.assign(document.createElement("li"), { className: "dl-empty", id: "dl-transcript-empty", textContent: "Aquí aparece lo que digan Valeria y tú." }));
  resetTeam();
  setView("call");
  setState("idle");
  window.scrollTo({ top: $("dl").offsetTop - 80, behavior: "smooth" });
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

function setView(next) {
  root.dataset.view = next;
  $("dl-tab-call").setAttribute("aria-pressed", String(next === "call"));
  $("dl-tab-team").setAttribute("aria-pressed", String(next === "team"));
  if (next === "team") $("dl-tab-team").classList.remove("has-news");
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

// Leaving the page hangs up (no orphan sessions eating the daily limit) and stops asking for the panel.
window.addEventListener("pagehide", () => { stopPolling(); try { conversation?.endSession(); } catch { /* ignore */ } });
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && connected && !wakeLock) requestWakeLock(); });

// A browser may restore a ticked checkbox after a reload or back navigation: honour what is on screen.
$("dl-consent").checked = false;
$("dl-btn").disabled = true;
