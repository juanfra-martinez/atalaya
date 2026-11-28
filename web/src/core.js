/* Atalaya — núcleo: estado, datos, geometría, unidades y utilidades. */
"use strict";
const A = (window.A = window.A || {});

/* ---------- utilidades ---------- */
A.$ = (s, r = document) => r.querySelector(s);
A.$$ = (s, r = document) => Array.from(r.querySelectorAll(s));
A.esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
A.fmt = (n, d = 0) => (n == null || isNaN(n) ? "—" : Number(n).toLocaleString(A.locale(), { maximumFractionDigits: d, minimumFractionDigits: d }));
A.compact = (n) => (n == null ? "—" : Math.abs(n) >= 10000 ? Number(n).toLocaleString(A.locale(), { notation: "compact", maximumFractionDigits: 1 }) : A.fmt(n));
A.signed = (n) => (n == null ? "—" : (n > 0 ? "+" : n < 0 ? "−" : "±") + A.fmt(Math.abs(n)));
A.cls = (n) => (n == null ? "flat" : n > 0 ? "up" : n < 0 ? "down" : "flat");
A.coord = (x, y) => `(${x}|${y})`;
A.debounce = (fn, ms = 150) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
A.store = {
  get(k, d) { try { const v = localStorage.getItem("atalaya:" + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("atalaya:" + k, JSON.stringify(v)); } catch { /* sin almacenamiento */ return; } A.store.onSet?.(k, v); },
  onSet: null, // sync.js apunta aquí cada escritura para subirla a la nube si hay sesión
};
A.parseCoord = (s) => {
  const m = String(s || "").replace(/[‭‬‎‏]/g, "").replace(/[−–]/g, "-").match(/(-?\d{1,3})\s*[|,;/ ]\s*(-?\d{1,3})/);
  return m ? { x: +m[1], y: +m[2] } : null;
};
A.copy = async (text, msg) => {
  try { await navigator.clipboard.writeText(text); A.toast(msg || A.t("toast.copied")); }
  catch { A.showCopyModal(text); }
};
A.toast = (msg) => {
  let host = A.$(".toasts");
  if (!host) { host = document.createElement("div"); host.className = "toasts"; host.setAttribute("role", "status"); document.body.appendChild(host); }
  const el = document.createElement("div"); el.className = "toast"; el.textContent = msg; host.appendChild(el);
  setTimeout(() => el.remove(), 2600);
};
/* "hace 3 h", "hace 2 días"… con el idioma de la interfaz. null si no hay fecha. */
A.ago = (ts, now = Date.now()) => {
  if (ts == null || !isFinite(ts)) return null;
  const s = Math.round((ts - now) / 1000), a = Math.abs(s);
  const [v, u] = a < 5400 ? [s / 60, "minute"] : a < 129600 ? [s / 3600, "hour"] : [s / 86400, "day"];
  try { return new Intl.RelativeTimeFormat(A.locale?.() || "es", { numeric: "auto", style: "short" }).format(Math.round(v), u); }
  catch { return `${Math.round(v)} ${u}`; }
};
A.dayLabel = (iso, opts = { day: "numeric", month: "short" }) => new Date(iso + "T12:00:00Z").toLocaleDateString(A.locale(), opts);

/* ---------- tribus y unidades: [nombre ES, nombre EN, velocidad (casillas/hora a ×1), capacidad de carga] ----------
   Romanos, germanos y galos: velocidad y carga comprobadas en el manual del juego (/api/v1/manual/troop/N).
   Egipcios y hunos: comprobados también en el manual. Espartanos y vikingos: tablas públicas de la comunidad (Kirilloid). */
A.TRIBES = {
  1: { key: "romans", color: "--t-romans" }, 2: { key: "teutons", color: "--t-teutons" }, 3: { key: "gauls", color: "--t-gauls" },
  4: { key: "nature", color: "--t-nature" }, 5: { key: "natars", color: "--t-natars" }, 6: { key: "egyptians", color: "--t-egyptians" },
  7: { key: "huns", color: "--t-huns" }, 8: { key: "spartans", color: "--t-spartans" }, 9: { key: "vikings", color: "--t-vikings" },
};
A.PLAYABLE = [1, 2, 3, 6, 7, 8, 9];
A.UNITS = {
  1: [["Legionario", "Legionnaire", 6, 50], ["Pretoriano", "Praetorian", 5, 20], ["Imperano", "Imperian", 7, 50], ["Equites Legati", "Equites Legati", 16, 0], ["Equites Imperatoris", "Equites Imperatoris", 14, 100], ["Equites Caesaris", "Equites Caesaris", 10, 70], ["Carnero", "Battering ram", 4, 0], ["Catapulta de fuego", "Fire catapult", 3, 0], ["Senador", "Senator", 4, 0], ["Colono", "Settler", 5, 3000]],
  2: [["Luchador de porra", "Clubswinger", 7, 60], ["Lancero", "Spearman", 7, 40], ["Luchador de hacha", "Axeman", 6, 50], ["Emisario", "Scout", 9, 0], ["Paladín", "Paladin", 10, 110], ["Caballero teutón", "Teutonic knight", 9, 80], ["Ariete", "Ram", 4, 0], ["Catapulta", "Catapult", 3, 0], ["Cabecilla", "Chief", 4, 0], ["Colono", "Settler", 5, 3000]],
  3: [["Falange", "Phalanx", 7, 35], ["Luchador de espada", "Swordsman", 6, 45], ["Batidor", "Pathfinder", 17, 0], ["Rayo de Teutates", "Theutates thunder", 19, 75], ["Jinete druida", "Druidrider", 16, 35], ["Jinete eduo", "Haeduan", 13, 65], ["Carnero", "Ram", 4, 0], ["Trebuchet", "Trebuchet", 3, 0], ["Cacique", "Chieftain", 5, 0], ["Colono", "Settler", 5, 3000]],
  6: [["Milicia de esclavos", "Slave militia", 7, 15], ["Guardián de ceniza", "Ash warden", 6, 50], ["Guerrero khopesh", "Khopesh warrior", 7, 45], ["Explorador sopdu", "Sopdu explorer", 16, 0], ["Guardia de Anhur", "Anhur guard", 15, 50], ["Carro de Resheph", "Resheph chariot", 10, 70], ["Ariete", "Ram", 4, 0], ["Catapulta de piedra", "Stone catapult", 3, 0], ["Nomarca", "Nomarch", 4, 0], ["Colono", "Settler", 5, 3000]],
  7: [["Mercenario", "Mercenary", 6, 50], ["Arquero", "Bowman", 6, 30], ["Observador", "Spotter", 19, 0], ["Jinete estepario", "Steppe rider", 16, 75], ["Tirador", "Marksman", 15, 105], ["Merodeador", "Marauder", 14, 80], ["Ariete", "Ram", 4, 0], ["Catapulta", "Catapult", 3, 0], ["Logades", "Logades", 5, 0], ["Colono", "Settler", 5, 3000]],
  8: [["Hoplita", "Hoplite", 6, 60], ["Centinela", "Sentinel", 9, 0], ["Escudero", "Shieldsman", 8, 40], ["Therion de doble acero", "Twinsteel therion", 6, 50], ["Jinete de Elpida", "Elpida rider", 16, 110], ["Aplastador corintio", "Corinthian crusher", 9, 80], ["Ariete", "Ram", 4, 0], ["Balista", "Ballista", 3, 0], ["Éforo", "Ephor", 4, 0], ["Colono", "Settler", 5, 3000]],
  9: [["Siervo", "Thrall", 7, 55], ["Escudera", "Shield maiden", 7, 40], ["Berserker", "Berserker", 5, 75], ["Ojo de Heimdall", "Heimdall's eye", 9, 0], ["Jinete huscarle", "Huskarl rider", 12, 110], ["Bendición de la valquiria", "Valkyrie's blessing", 9, 80], ["Ariete", "Ram", 4, 0], ["Catapulta", "Catapult", 3, 0], ["Jarl", "Jarl", 5, 0], ["Colono", "Settler", 5, 3000]],
};
/* Cereal por hora de las seis primeras unidades de cada tribu, según la tabla oficial de soporte de Travian (artículo 187).
   La caballería romana va sin abrevadero: esa tabla lo incluye a nivel 20 y resta 1 por unidad. */
A.CROP = { 1: [1, 1, 1, 2, 3, 4], 2: [1, 1, 1, 1, 2, 3], 3: [1, 1, 2, 2, 2, 3], 6: [1, 1, 1, 2, 2, 3], 7: [1, 1, 2, 2, 2, 3], 8: [1, 1, 1, 1, 2, 3], 9: [1, 1, 2, 1, 2, 2] };
/* Posición de las unidades especiales, igual en todas las tribus. */
A.SIEGE = [6, 7];
A.CHIEF = 8;
A.unitName = (tid, i) => (A.UNITS[tid] || A.UNITS[1])[i][A.lang === "en" ? 1 : 0];
A.tribeColor = (tid) => getComputedStyle(document.documentElement).getPropertyValue((A.TRIBES[tid] || A.TRIBES[5]).color).trim() || "#888";

/* ---------- JSON pegado por el jugador ----------
   Devuelve todos los valores JSON (objetos o arrays) que aparezcan en un texto: una respuesta copiada de la pestaña
   Red, varias pegadas una detrás de otra, un HAR entero o el HTML de una página con datos incrustados. Recorre el
   texto llevando la cuenta de llaves y comillas, así que tolera texto antes, entre y después de cada valor. Los
   valores de los HAR (log.entries[].response.content.text) se abren también, para que basten "Copiar todo como HAR". */
A.jsonValues = (text, { max = 400 } = {}) => {
  const out = [];
  const s = String(text ?? "");
  const open = /[{[]/g;
  /* Lo que sigue a la llave o al corchete tiene que poder empezar un valor JSON: así se saltan sin recorrerlos casi
     todos los bloques de código JavaScript de una página entera. */
  const OBJ = /^\s*["}]/, ARR = /^\s*["{[\]\d\-tfn]/;
  let m;
  while ((m = open.exec(s)) && out.length < max) {
    const start = m.index;
    if (!(s[start] === "{" ? OBJ : ARR).test(s.slice(start + 1, start + 40))) continue;
    let depth = 0, inStr = false, esc = false, j = start;
    for (; j < s.length; j++) {
      const c = s[j];
      if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; continue; }
      if (c === '"') inStr = true;
      else if (c === "{" || c === "[") depth++;
      else if ((c === "}" || c === "]") && --depth === 0) break;
    }
    if (depth !== 0) continue;
    try { out.push(JSON.parse(s.slice(start, j + 1))); open.lastIndex = j + 1; } catch { /* sigue buscando dentro */ }
  }
  const har = [];
  for (const v of out) for (const e of v?.log?.entries || []) {
    const c = e?.response?.content;
    if (!c?.text) continue;
    let body = c.text;
    if (c.encoding === "base64") { try { body = new TextDecoder().decode(Uint8Array.from(atob(body), (ch) => ch.charCodeAt(0))); } catch { continue; } }
    har.push(...A.jsonValues(body, { max }));
  }
  return har.length ? har : out;
};

/* ---------- geometría del mapa (toroide) ----------
   Los bordes del mapa se tocan solo si el mundo tiene la regla travelOverTheWorldEdge (así lo calcula el propio
   juego en crypt.js). A.WRAP lo fija hydrate() con las reglas del mundo; sin ellas se supone que sí, como en los
   mundos normales. */
A.WRAP = true;
A.wrap = (a, b, R) => { if (!A.WRAP) return Math.abs(a - b); const size = 2 * R + 1; const d = Math.abs(a - b) % size; return Math.min(d, size - d); };
A.dist = (x1, y1, x2, y2, R) => Math.hypot(A.wrap(x1, x2, R), A.wrap(y1, y2, R));
A.travel = (dist, unitSpeed, { serverSpeed = 1, ts = 0, tsBonus = 0.2, artifact = 1 } = {}) => {
  const v = unitSpeed * serverSpeed * artifact;
  if (!v) return Infinity;
  if (dist <= 20 || ts <= 0) return (dist / v) * 3600;
  return (20 / v + (dist - 20) / (v * (1 + tsBonus * ts))) * 3600;
};
/* Velocidad de las tropas según la velocidad del mundo. No es proporcional: en los mundos ×3 y ×5 las tropas van
   a ×2 y en los ×10 a ×4 (tabla de Kirilloid, server.js; sin comprobar en un mundo rápido real). Para una velocidad
   que no esté en la tabla se toma el tramo que le corresponde. */
A.troopSpeed = (speed) => ({ 1: 1, 2: 2, 3: 2, 5: 2, 10: 4 })[speed] || (speed >= 10 ? 4 : speed >= 2 ? 2 : 1);
A.dur = (s) => {
  if (!isFinite(s)) return "—";
  s = Math.round(s);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

/* ---------- enlaces al juego (rutas comprobadas en un mundo real) ----------
   "tile" abre la ficha de la casilla, desde donde el juego ofrece "Agregar a la lista de vacas";
   "send" abre Plaza de reuniones → Enviar tropas con x|y ya rellenos: el envío lo confirma siempre el jugador. */
A.gameUrl = (kind, a, b) => {
  const sid = A.state?.sid;
  if (A.DEMO || !sid || !/^[a-z0-9.-]+\.travian\.com$/i.test(sid)) return null;
  const base = "https://" + sid;
  if (kind === "tile") return `${base}/karte.php?x=${a}&y=${b}`;
  if (kind === "send") return `${base}/build.php?gid=16&tt=2&x=${a}&y=${b}`;
  if (kind === "player") return `${base}/profile/${a}`;
  if (kind === "alliance") return `${base}/alliance/${a}`;
  return null;
};

/* ---------- datos ---------- */
A.DEMO = !!window.__ATALAYA_DEMO__;
/* Versión publicada sin servidor (GitHub Pages): los datos son ficheros JSON que el recolector
   regenera tras cada pasada (backend/atalaya/publish.py). window.ATALAYA_STATIC = carpeta de datos. */
A.STATIC = !A.DEMO && typeof window.ATALAYA_STATIC === "string";
A.LOCAL = A.DEMO || A.STATIC; // sin API: las alertas se guardan en el navegador
A.api = {
  base: window.ATALAYA_API || "/api",
  staticPath(path) {
    const root = window.ATALAYA_STATIC.replace(/\/$/, "");
    let m;
    if (path === "/servers") return `${root}/servers.json`;
    if ((m = path.match(/^\/servers\/([^/?]+)\/(world|events)(?:\?.*)?$/))) return `${root}/${m[2] === "world" ? "worlds" : "events"}/${m[1]}.json`;
    return null;
  },
  async get(path) {
    if (A.DEMO) return A.api.demo(path);
    const url = A.STATIC ? A.api.staticPath(path) : A.api.base + path;
    if (!url) throw new Error("404 " + path);
    // no-cache: el navegador revalida (304 si no ha cambiado) y siempre ve la última pasada.
    const r = await fetch(url, A.STATIC ? { cache: "no-cache" } : undefined);
    if (!r.ok) throw new Error(`${r.status} ${path}`);
    return r.json();
  },
  async send(method, path, body) {
    if (A.LOCAL) throw new Error(A.DEMO ? "demo" : "static");
    const r = await fetch(A.api.base + path, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    if (!r.ok) { let msg = r.status; try { msg = (await r.json()).detail || msg; } catch { /* */ } throw new Error(msg); }
    return r.status === 204 ? null : r.json();
  },
  demo(path) {
    const b = window.__ATALAYA_DEMO__;
    let m;
    if (path === "/servers") return b.servers;
    if ((m = path.match(/^\/servers\/([^/]+)\/world$/))) return b.worlds[decodeURIComponent(m[1])];
    if ((m = path.match(/^\/servers\/([^/]+)\/events/))) return b.events[decodeURIComponent(m[1])] || [];
    throw new Error("404 " + path);
  },
};

/* Convierte la exportación compacta en objetos indexados. */
A.hydrate = (raw) => {
  const S = raw.schema || {};
  const obj = (keys, arr) => { const o = {}; keys.forEach((k, i) => (o[k] = arr[i])); return o; };
  const feats = raw.server.info?.features;
  const w = { server: raw.server, days: raw.days, R: raw.server.radius || 200, wrap: Array.isArray(feats) ? feats.includes("travelOverTheWorldEdge") : true };
  A.WRAP = w.wrap;
  w.alliances = raw.alliances.map((a) => obj(S.alliances, a));
  w.aById = new Map(w.alliances.map((a) => [a.aid, a]));
  w.players = raw.players.map((p) => obj(S.players, p));
  w.pById = new Map(w.players.map((p) => [p.uid, p]));
  w.villages = raw.villages.map((v) => obj(S.villages, v));
  w.vById = new Map();
  w.vAt = new Map();
  const byP = new Map();
  for (const v of w.villages) {
    w.vById.set(v.vid, v);
    w.vAt.set(v.x + "," + v.y, v);
    if (!byP.has(v.uid)) byP.set(v.uid, []);
    byP.get(v.uid).push(v);
  }
  w.villagesOf = (uid) => byP.get(uid) || [];
  let place = 0;
  w.players.forEach((p) => {
    p.rank = p.status === "natar" ? null : ++place; // los Natares no puntúan: no ocupan puesto en la clasificación
    const h = p.popHist.filter((x) => x != null);
    p.d1 = h.length >= 2 ? h[h.length - 1] - h[h.length - 2] : null;
    p.d7 = h.length >= 2 ? h[h.length - 1] - h[Math.max(0, h.length - 8)] : null;
    p.tag = p.aid ? (w.aById.get(p.aid)?.tag || "") : "";
    const cap = w.villagesOf(p.uid).find((v) => v.capital) || w.villagesOf(p.uid)[0];
    p.cap = cap;
  });
  w.alliances.forEach((a, i) => {
    a.rank = i + 1;
    const h = a.popHist.filter((x) => x != null);
    a.d7 = h.length >= 2 ? h[h.length - 1] - h[Math.max(0, h.length - 8)] : null;
    a.d1 = h.length >= 2 ? h[h.length - 1] - h[h.length - 2] : null;
  });
  const total = new Array(w.days.length).fill(0);
  const counts = new Array(w.days.length).fill(0);
  w.players.forEach((p) => p.popHist.forEach((v, i) => { if (v != null) { total[i] += v; counts[i]++; } }));
  w.popSeries = total;
  w.playerSeries = counts;
  w.counts = { inactive: 0, slowing: 0, active: 0, new: 0, unknown: 0 };
  w.players.forEach((p) => { if (w.counts[p.status] != null) w.counts[p.status]++; });
  return w;
};

A.state = {
  servers: [],
  sid: A.store.get("sid", null),
  world: null,
  events: [],
  homes: A.store.get("homes", {}), // sid -> {x,y,tid}
  watch: A.store.get("watch", {}), // sid -> [{type, id, x, y, r, addedPop, addedAt}]
};
Object.defineProperty(A.state, "home", {
  get() { return this.homes[this.sid] || null; },
  set(v) { this.homes[this.sid] = v; A.store.set("homes", this.homes); },
});
A.saveWatch = () => A.store.set("watch", A.state.watch);
A.watchList = () => (A.state.watch[A.state.sid] ||= []);
A.isWatched = (type, id) => A.watchList().some((w) => w.type === type && w.id === id);
A.toggleWatch = (type, id, extra = {}) => {
  const list = A.watchList();
  const i = list.findIndex((w) => w.type === type && w.id === id);
  if (i >= 0) { list.splice(i, 1); A.toast(A.t("toast.unwatched")); }
  else { list.push({ type, id, addedAt: A.state.world?.server.day, ...extra }); A.toast(A.t("toast.watched")); }
  A.saveWatch();
  A.emit("watch");
};

/* bus de eventos mínimo */
A._subs = {};
A.on = (ev, fn) => ((A._subs[ev] ||= []).push(fn));
A.emit = (ev, d) => (A._subs[ev] || []).forEach((fn) => fn(d));

A.loadServers = async () => { A.state.servers = await A.api.get("/servers"); return A.state.servers; };
let loadSeq = 0;
A.loadWorld = async (sid) => {
  const seq = ++loadSeq;
  const [raw, events] = await Promise.all([A.api.get(`/servers/${encodeURIComponent(sid)}/world`), A.api.get(`/servers/${encodeURIComponent(sid)}/events?days=14`)]);
  if (seq !== loadSeq) return A.state.world; // el usuario eligió otro mundo mientras tanto
  A.state.sid = sid;
  A.store.set("sid", sid);
  A.state.world = A.hydrate(raw);
  A.state.events = events;
  A.emit("world");
  return A.state.world;
};

/* Puntuación de prioridad de un objetivo de farmeo: confianza × tamaño / distancia. */
A.priority = (conf, pop, dist) => Math.round((conf / 100) * Math.sqrt(Math.max(pop, 1)) * 100 / (1 + dist / 6)) / 10;

/* Razones legibles de la confianza (coinciden con analytics.player_inactivity del backend). */
A.reasons = (p) => {
  const r = [];
  if (p.status === "natar") return [A.t("why.natar")];
  if (p.status === "unknown") return [A.t("why.noHistory")];
  if (p.streak === 0) r.push(A.t("why.grew"));
  else r.push(A.t(p.bounded ? "why.streakBounded" : "why.streak", { n: p.streak }));
  if (p.flags.includes("attacked")) r.push(A.t("why.attacked"));
  if (p.flags.includes("lost_village")) r.push(A.t("why.lost"));
  if (p.flags.includes("new")) r.push(A.t("why.new"));
  if (p.bounded && p.popHist.filter((x) => x != null).length < 3) r.push(A.t("why.short"));
  return r;
};
A.confColor = (c) => (c >= 80 ? "var(--bad)" : c >= 55 ? "var(--warn)" : c > 0 ? "var(--info)" : "var(--line)");
