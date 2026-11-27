/* Análisis que cruzan lo que el jugador ve en el juego con los datos públicos de map.sql:
   lista de vacas pegada, unidad de un ataque entrante y vecindario. Sin DOM, para poder probarlo con Node. */
"use strict";
(() => {
  const A = window.A;

  /* El juego envuelve números y coordenadas en marcas de dirección (U+202D…U+202C) y usa el signo menos U+2212. */
  const BIDI = /[‎‏‪-‮⁦-⁩]/g;
  A.cleanText = (s) => String(s ?? "").replace(BIDI, "").replace(/ /g, " ").replace(/[−–]/g, "-");
  const normName = (s) => A.cleanText(s).trim().toLowerCase();
  const int = (s) => { const d = A.cleanText(s).replace(/\D/g, ""); return d ? +d : null; };

  /* ================= LISTA DE VACAS ================= */

  /* Formato copiado de Plaza de reuniones → Lista de vacas (comprobado en un mundo real):
       "⇥⇥thorkel`s village⇥12⇥3.2⇥"   nombre, habitantes y distancia
       "2"                              tropas enviadas
       "19:36:17"                       hora del último atraco (si lo hubo)
       "70" / "420"                     botín de ese atraco y botín total
     También acepta una lista de coordenadas x|y (una por línea), como la que exporta Atalaya. */
  const HEAD = /^\s*([^\t]+?)\t+(\d[\d.,]*)\t+(\d{1,3}(?:[.,]\d+)?)\s*$/;
  const COORD = /(-?\d{1,3})\s*\|\s*(-?\d{1,3})/;
  const TIME = /\b\d{1,2}:\d{2}(?::\d{2})?\b/;
  A.parseFarmList = (text) => {
    if (/"slots"\s*:/.test(text)) { const d = A.parseFarmData(text); if (d) return d.entries; }
    const out = [];
    let cur = null;
    for (const raw of A.cleanText(text).split(/\r?\n/)) {
      const m = raw.match(HEAD);
      if (m) {
        cur = { name: m[1].trim(), pop: int(m[2]), dist: +m[3].replace(",", "."), units: null, time: null, loot: null, total: null };
        out.push(cur);
        continue;
      }
      const line = raw.trim();
      if (!line) continue;
      const c = line.match(COORD);
      if (c) { out.push({ x: +c[1], y: +c[2], name: null, pop: null, dist: null }); cur = null; continue; }
      if (!cur) continue;
      if (/^\d[\d.,]*$/.test(line)) {
        const n = int(line);
        if (cur.time == null) { if (cur.units == null) cur.units = n; }
        else if (cur.loot == null) cur.loot = n;
        else if (cur.total == null) cur.total = n;
      } else if (cur.time == null && TIME.test(line)) cur.time = line.match(TIME)[0];
    }
    return out;
  };

  /* Datos de la lista de vacas tal como los recibe el navegador. El juego no los pide aparte: van incrustados en el
     HTML de Plaza de reuniones → Lista de vacas (window.Travian.React.FarmList.render({gql, viewData: {…}}),
     comprobado en International 7 el 19 nov 2026). Por objetivo:
       {"id":229,"target":{"id":7315,"mapId":68023,"x":53,"y":31,"name":"","population":0,"type":3},
        "troop":{"t1":0,"t2":2,…},"distance":1.41421,"isActive":true,"runningAttacks":1,
        "lastRaid":{"time":1795103234,"raidedResources":{"lumber":18,"clay":5,"iron":5,"crop":5},"bootyMax":100,"icon":1,
                    "reportObjectId":"…","authKey":"…"},"totalBooty":{"booty":536,"raids":10}}
     target.type: 0 aldea, 1 capital, 2 oasis ocupado, 3 oasis libre (Travian.Constants.VILLAGE_TYPE_*).
     lastRaid.icon: 1 ganado sin bajas, 2 ganado con bajas, 3 perdido.
     Vale el código fuente de la página (Ctrl+U, copiar todo), la respuesta del documento en la pestaña Red o un JSON
     con farmLists. Devuelve { lists, entries, compact } o null. "compact" es lo mismo sin authKey ni reportObjectId
     (abren el informe), que es lo único que se guarda en el navegador. */
  const TROOPS = ["t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8", "t9", "t10"];
  const isList = (o) => o && typeof o === "object" && Array.isArray(o.slots) && o.slots.some((s) => s?.target && Number.isInteger(s.target.x));
  const listsIn = (v, depth = 0, out = []) => {
    if (!v || typeof v !== "object" || depth > 6) return out;
    if (isList(v)) { out.push(v); return out; }
    for (const x of Array.isArray(v) ? v : Object.values(v)) listsIn(x, depth + 1, out);
    return out;
  };
  A.parseFarmData = (text) => {
    const seen = new Set(), lists = [];
    for (const v of typeof text === "string" ? A.jsonValues(text) : [text]) for (const l of listsIn(v)) {
      const k = l.id != null ? "id" + l.id : "n" + lists.length;
      if (!seen.has(k)) { seen.add(k); lists.push(l); }
    }
    if (!lists.length) return null;
    const res = (r) => (r ? (r.lumber || 0) + (r.clay || 0) + (r.iron || 0) + (r.crop || 0) : null);
    const compact = { atalayaFarm: 1, lists: lists.map((l) => ({ id: l.id, name: l.name || "", ownerVillage: l.ownerVillage?.id != null ? { id: l.ownerVillage.id } : undefined,
      slots: l.slots.filter((s) => s?.target).map((s) => ({ target: { x: s.target.x, y: s.target.y, name: s.target.name ?? "", population: s.target.population ?? null, type: s.target.type ?? null },
        troop: s.troop || null, distance: s.distance ?? null, isActive: s.isActive !== false, runningAttacks: s.runningAttacks || 0,
        lastRaid: s.lastRaid ? { time: s.lastRaid.time, raidedResources: s.lastRaid.raidedResources, bootyMax: s.lastRaid.bootyMax, icon: s.lastRaid.icon } : null,
        totalBooty: s.totalBooty || null })) })) };
    const entries = [];
    for (const l of compact.lists) for (const s of l.slots) {
      const troops = s.troop ? TROOPS.map((k) => +s.troop[k] || 0) : null;
      const lr = s.lastRaid, tb = s.totalBooty;
      const type = s.target.type;
      entries.push({ x: s.target.x, y: s.target.y, name: s.target.name || null, pop: type === 2 || type === 3 ? null : s.target.population, dist: s.distance,
        oasis: type === 2 ? "taken" : type === 3 ? "free" : null, list: l.name, active: s.isActive, running: s.runningAttacks,
        troops, units: troops ? troops.reduce((a, b) => a + b, 0) : null,
        time: lr?.time ? lr.time * 1000 : null, loot: res(lr?.raidedResources), cap: lr?.bootyMax ?? null, icon: lr?.icon ?? null,
        raids: tb?.raids ?? null, booty: tb?.booty ?? null, avg: tb?.raids ? tb.booty / tb.raids : null, total: tb?.booty ?? null });
    }
    entries.source = "game";
    return { lists: compact.lists.map((l) => ({ id: l.id, name: l.name, n: l.slots.length })), entries, compact };
  };

  /* Localiza cada objetivo en el map.sql: por coordenadas si las hay; si no, por nombre y distancia desde el
     origen (el juego redondea la distancia a un decimal). Si el nombre ya no existe, prueba con la única aldea
     a esa distancia y con una población parecida: probablemente la han renombrado. */
  A.matchFarm = (entries, w, home) => {
    const byName = new Map();
    for (const v of w.villages) { const k = normName(v.name); if (!byName.has(k)) byName.set(k, []); byName.get(k).push(v); }
    const d = (v) => A.dist(home.x, home.y, v.x, v.y, w.R);
    return entries.map((e) => {
      if (e.oasis) return { e, v: null, how: "coord" }; // el juego dice que es un oasis: map.sql no tiene nada que añadir
      if (e.x != null) { const v = w.vAt.get(e.x + "," + e.y) || null; return { e, v, how: v ? "coord" : null }; }
      let best = null, bd = Infinity;
      for (const v of byName.get(normName(e.name)) || []) {
        const dd = Math.abs(d(v) - e.dist) + Math.abs(v.pop - (e.pop ?? v.pop)) / 1e4;
        if (dd < bd) { bd = dd; best = v; }
      }
      if (best && bd <= 0.15) return { e, v: best, how: "name" };
      const tol = Math.max(3, (e.pop || 0) * 0.25);
      const cands = e.pop == null ? [] : w.villages.filter((v) => Math.abs(d(v) - e.dist) <= 0.06 && Math.abs(v.pop - e.pop) <= tol);
      return cands.length === 1 ? { e, v: cands[0], how: "guess" } : { e, v: null, how: null };
    });
  };

  /* Veredicto de un objetivo. Las notas son [clave i18n, variables]. Gravedad: gone > risk > check > nohist > keep. */
  A.FARM_SEV = { gone: 0, risk: 1, check: 2, nohist: 3, keep: 4 };
  A.farmVerdict = (m, w, tid, profit = null) => {
    const notes = [], e = m.e;
    let verdict, p = null;
    const worse = (v) => { if (A.FARM_SEV[v] < A.FARM_SEV[verdict]) verdict = v; };
    if (!m.v && e.oasis) {
      /* Los oasis no están en map.sql: se juzgan solo por lo que dice el juego. */
      verdict = e.oasis === "taken" ? "check" : "keep";
      notes.push([e.oasis === "taken" ? "farm.n.oasisTaken" : "farm.n.oasis"]);
    } else {
      if (!m.v) return { verdict: "gone", notes: [["farm.n.gone"]], p: null };
      p = w.pById.get(m.v.uid);
      if (!p) return { verdict: "gone", notes: [["farm.n.gone"]], p: null };
      if (m.how === "guess") notes.push(["farm.n.renamed", { name: m.v.name }]);
      switch (p.status) {
        case "inactive": verdict = "keep"; notes.push(["farm.n.inactive", { n: p.streak }]); break;
        case "slowing": verdict = "check"; notes.push(["farm.n.slowing"]); break;
        case "active": verdict = "risk"; notes.push(p.d7 > 0 ? ["farm.n.active7", { n: p.d7 }] : ["farm.n.active"]); break;
        case "new": verdict = "risk"; notes.push(["farm.n.new"]); break;
        case "natar": verdict = "check"; notes.push(["farm.n.natar"]); break;
        default: verdict = "nohist"; notes.push(["farm.n.nohist"]);
      }
      /* La población que muestra el juego es de ahora; la del map.sql, de la última descarga. Si ha subido, alguien está construyendo. */
      if (e.pop != null && e.pop - m.v.pop >= 3) {
        notes.unshift(["farm.n.grewNow", { a: m.v.pop, b: e.pop }]);
        worse("risk");
      }
      if (p.aid) notes.push(["farm.n.ally", { tag: w.aById.get(p.aid)?.tag || "#" + p.aid }]);
      if (p.flags?.includes("attacked")) notes.push(["farm.n.attacked"]);
    }
    /* Icono del último informe (solo con los datos del juego): perdido o con bajas pesa más que cualquier otra cosa. */
    if (e.icon === 3) { notes.unshift(["farm.n.lostRaid"]); worse("risk"); }
    else if (e.icon === 2) { notes.unshift(["farm.n.lossesRaid"]); worse("check"); }
    /* Botín: lleno si llega a la capacidad del juego o, sin ella, si es justo tropas × carga de alguna unidad. */
    const loot = A.lootState(e, tid);
    const soft = () => { if (verdict === "keep" || verdict === "nohist") verdict = "check"; };
    if (loot === "full") notes.push(["farm.n.full"]);
    else if (loot === "low") { notes.push(["farm.n.low", { l: e.loot }]); soft(); }
    if (e.avg != null && e.raids >= 3) notes.push(["farm.n.avg", { a: Math.round(e.avg), n: e.raids }]);
    if (profit && profit.net <= 0) { notes.push(["farm.n.loss", { l: e.loot, c: profit.cost }]); soft(); }
    if (e.active === false) notes.push(["farm.n.disabled"]);
    return { verdict, notes, p };
  };

  /* Rentabilidad del último atraco: botín menos el cereal que consumen las tropas en la ida y la vuelta.
     No se aplica la velocidad del mundo porque no está documentado si el consumo escala con ella: si escala, se
     compensa con el viaje más corto y el resultado es exacto; si no, el coste real es menor y esto es un máximo. */
  A.farmProfit = (e, dist, tid, unit, ts = 0) => {
    if (e.loot == null || !e.units || dist == null) return null;
    /* Con los datos del juego se conocen las tropas exactas: consumo de cada una y la más lenta marca el viaje. */
    if (e.troops && A.STATS?.[tid]) {
      let upkeep = 0, speed = Infinity;
      e.troops.forEach((n, i) => { if (!n) return; upkeep += n * (A.STATS[tid][i]?.[7] ?? 1); speed = Math.min(speed, A.UNITS[tid][i][2]); });
      if (!isFinite(speed)) return null;
      const hours = (2 * A.travel(dist, speed, { ts })) / 3600;
      const cost = Math.round(upkeep * hours);
      return { hours, cost, net: e.loot - cost, exact: true };
    }
    const crop = A.CROP[tid]?.[unit], speed = A.UNITS[tid]?.[unit]?.[2];
    if (crop == null || !speed) return null;
    const hours = (2 * A.travel(dist, speed, { ts })) / 3600;
    const cost = Math.round(e.units * crop * hours);
    return { hours, cost, net: e.loot - cost };
  };
  A.lootState = (e, tid) => {
    if (e.loot == null) return null;
    if (e.cap) return e.loot >= e.cap ? "full" : e.loot < 0.3 * e.cap ? "low" : "partial";
    if (!e.units) return null;
    const carries = (A.UNITS[tid] || A.UNITS[1]).slice(0, 6).map((u) => u[3]).filter((c) => c > 0);
    if (!carries.length) return null;
    if (carries.some((c) => c * e.units === e.loot)) return "full";
    return e.loot < 0.3 * e.units * Math.min(...carries) ? "low" : "partial";
  };

  /* ================= ATAQUE ENTRANTE ================= */

  /* El ataque salió como muy tarde cuando se vio, así que su viaje dura al menos (llegada − visto).
     Las unidades más rápidas que eso no pueden ser la más lenta del ataque. Si se vio nada más salir, la más
     probable es la posible con el viaje más corto. Los colonos no atacan y se descartan. */
  A.inferIncoming = ({ dist, arrival, seen, tid, serverSpeed = 1, ts = 0, art = 1, tolerance = 2 }) => {
    const need = (arrival - seen) / 1000;
    const units = (A.UNITS[tid] || A.UNITS[1]).slice(0, 9).map((u, i) => {
      const sec = A.travel(dist, u[2], { serverSpeed, ts, artifact: art });
      return { i, speed: u[2], sec, launch: new Date(arrival - sec * 1000), possible: sec + tolerance >= need, best: false };
    });
    const poss = units.filter((u) => u.possible);
    const min = poss.length ? Math.min(...poss.map((u) => u.sec)) : null;
    poss.forEach((u) => (u.best = u.sec === min));
    const best = poss.filter((u) => u.best);
    let kind = null;
    if (best.length) {
      const us = A.UNITS[tid] || A.UNITS[1];
      if (best.some((u) => u.i === A.CHIEF)) kind = "chief";
      else if (best.some((u) => A.SIEGE.includes(u.i))) kind = "siege";
      else if (best.every((u) => us[u.i][3] === 0)) kind = "scout";
      else kind = best[0].speed >= 9 ? "fast" : "infantry";
    }
    return { need, units, best, kind };
  };

  /* Un fake se confirma explorando: esto solo ordena indicios para decidir qué mirar antes. Cada señal suma a favor
     de fake (positivo) o de ataque real (negativo), y hace falta un saldo de 2 para decantarse. Un cacique no
     puede llegar a «fake» por muchos indicios que tenga, porque equivocarse ahí cuesta la aldea. */
  const SMALL_ORIGIN = 0.25, TRAIN_GAP = 10e3, SYNC_GAP = 60e3, SPREAD_GAP = 300e3, SPREAD_TARGETS = 3;
  const WEIGHT = { smallOrigin: 2, spread: 1, train: -2, multiOrigin: -2, chief: -3 };
  const key = (c) => c.x + "|" + c.y;

  A.assessAttacks = (attacks, w) => {
    const all = attacks.map((a) => {
      const v = w.vAt.get(a.from.x + "," + a.from.y) || null;
      return { a, v, p: v ? w.pById.get(v.uid) || null : null, origin: key(a.from), target: key(a.to) };
    });
    const near = (x, y, gap) => Math.abs(x.a.arrival - y.a.arrival) <= gap;
    return all.map((e) => {
      const signals = [];
      if (e.p && e.p.status !== "natar") {
        const max = Math.max(...w.villagesOf(e.p.uid).map((v) => v.pop));
        if (w.villagesOf(e.p.uid).length > 1 && e.v.pop < max * SMALL_ORIGIN) signals.push({ k: "smallOrigin", pop: e.v.pop, max });
      }
      const train = all.filter((o) => o.origin === e.origin && o.target === e.target && near(o, e, TRAIN_GAP));
      if (train.length > 1) signals.push({ k: "train", n: train.length });
      if (e.p) {
        const mine = all.filter((o) => o.p?.uid === e.p.uid);
        const origins = new Set(mine.filter((o) => o.target === e.target && near(o, e, SYNC_GAP)).map((o) => o.origin));
        if (origins.size > 1) signals.push({ k: "multiOrigin", n: origins.size });
        const targets = new Set(mine.filter((o) => near(o, e, SPREAD_GAP)).map((o) => o.target));
        if (targets.size >= SPREAD_TARGETS) signals.push({ k: "spread", n: targets.size });
      }
      if (e.a.kind === "chief") signals.push({ k: "chief" });
      const net = signals.reduce((s, x) => s + WEIGHT[x.k], 0);
      return { ...e.a, v: e.v, p: e.p, signals, level: net >= 2 ? "fake" : net <= -2 ? "real" : "unclear" };
    });
  };

  /* ================= PLAZA DE REUNIONES ================= */

  /* Texto copiado de Plaza de reuniones → Resumen. Cada movimiento es una tabla con la misma forma (comprobado en
     un mundo real con tropas salientes; el juego usa esa misma tabla para las entrantes):
       "A-00⇥Explorar valle abandonado (57|32)"   aldea de origen y descripción (a veces con el destino)
       "(52|32)⇥⇥…"                               coordenadas de la aldea de origen
       "Tropas⇥4⇥2⇥0…"                            diez u once cifras
       "Llegada" · "en  0:10:03  h." · "a las  08:43:00"
     Se lee por estructura, sin depender del idioma. Las tropas que están en la aldea no traen cuenta atrás y se
     descartan. Devuelve [{ village, title, from, to, troops, eta (segundos), at }]. */
  const ONLY_COORD = /^\(?\s*(-?\d{1,3})\s*\|\s*(-?\d{1,3})\s*\)?$/;
  const HMS = /\b(\d{1,3}):(\d{2}):(\d{2})\b/;
  A.parseRallyPoint = (text) => {
    const lines = A.cleanText(text).split(/\r?\n/);
    const starts = [];
    lines.forEach((l, i) => { const m = l.trim().match(ONLY_COORD); if (m && i > 0) starts.push({ i, x: +m[1], y: +m[2] }); });
    const out = [];
    starts.forEach((s, n) => {
      let h = s.i - 1;
      while (h > 0 && !lines[h].trim()) h--;
      const head = lines[h].split("\t").map((c) => c.trim()).filter(Boolean);
      const title = head.slice(1).join(" ") || "";
      const tc = title.match(COORD);
      const end = starts[n + 1] ? starts[n + 1].i - 1 : lines.length;
      let troops = null, eta = null, at = null;
      for (let j = s.i + 1; j < end; j++) {
        const c = lines[j].split("\t").map((x) => x.trim()).filter(Boolean);
        const nums = c.filter((x) => /^\d[\d.,]*$/.test(x));
        if (!troops && nums.length >= 10 && nums.length >= c.length - 1) { troops = nums.map(int); continue; }
        const t = lines[j].match(HMS);
        if (!t) continue;
        if (eta == null) eta = (+t[1] * 60 + +t[2]) * 60 + +t[3];
        else if (at == null) at = t[0];
      }
      if (eta == null) return;
      out.push({ village: head[0] || "", title, from: { x: s.x, y: s.y }, to: tc ? { x: +tc[1], y: +tc[2] } : null, troops, eta, at });
    });
    return out;
  };

  /* ================= GUERRAS ENTRE ALIANZAS ================= */

  /* Quién conquista a quién: cada conquista suma a la pareja (alianza que gana, alianza que pierde). Las aldeas de
     jugadores sin alianza cuentan con aid 0, y las conquistas dentro de una misma alianza se apartan porque suelen
     ser traspasos acordados. Devuelve las parejas ordenadas por aldeas, con el marcador de vuelta ("back"). */
  A.conflicts = (events) => {
    const pairs = new Map();
    let internal = 0;
    for (const e of events) {
      if (e.type !== "conquered") continue;
      const a = e.aid || 0, b = e.aid_prev || 0;
      if (a && a === b) { internal++; continue; }
      if (!a && !b) continue;
      const k = a + ">" + b;
      let p = pairs.get(k);
      if (!p) pairs.set(k, (p = { a, b, n: 0, pop: 0, last: e.day, back: 0 }));
      p.n++; p.pop += e.pop || 0;
      if (e.day > p.last) p.last = e.day;
    }
    const list = [...pairs.values()];
    list.forEach((p) => (p.back = pairs.get(p.b + ">" + p.a)?.n || 0));
    list.sort((x, y) => y.n - x.n || y.pop - x.pop);
    return { pairs: list, internal };
  };

  /* ================= INFORMES DE BATALLA ================= */

  /* Formato copiado de un informe (comprobado con tres informes reales en español). Se lee por estructura, no por
     etiquetas, para que sirva en otros idiomas y aunque se copie la página entera:
       título y fecha · bloques de tropas (cabecera de 10-11 unidades, enviadas, perdidas): el primero es el agresor
       y el resto, defensores y refuerzos · botín tras el agresor (4 recursos y "llevado/capacidad") ·
       estadísticas (dos cabeceras y tríos etiqueta, agresor, defensor). */
  const NUM = /^\d[\d.,]*$/;
  const DATE = /\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4},?\s+\d{1,2}:\d{2}:\d{2}\b/;
  const cells = (l) => l.split("\t").map((s) => s.trim()).filter(Boolean);
  const parseOwner = (line) => {
    const raw = line.trim();
    const m = raw.match(/^(?:\[(.*?)\]\s*)?(.+?)(?:\s+(?:desde|from)\s+(.+))?$/);
    return { raw, tag: m?.[1]?.trim() || null, name: m?.[2] || "?", village: m?.[3] || null }; // sin línea previa si se pega desde la tabla
  };

  A.parseReport = (text) => {
    let lines = A.cleanText(text).split(/\r?\n/);
    const start = lines.findIndex((l) => DATE.test(l));
    let title = null, date = null;
    if (start >= 0) {
      date = lines[start].match(DATE)[0];
      for (let k = start - 1; k >= 0 && title == null; k--) if (lines[k].trim()) title = lines[k].trim();
      const next = lines.findIndex((l, i) => i > start && DATE.test(l)); // si pegan dos informes, solo el primero
      lines = lines.slice(start, next < 0 ? undefined : next);
    }
    const blocks = [];
    for (let i = 0; i < lines.length; i++) {
      const head = cells(lines[i]);
      if (head.length < 10 || head.some((c) => NUM.test(c))) continue;
      const rows = [];
      let j = i + 1;
      for (; j < lines.length; j++) {
        const c = lines[j].trim().split(/\s+/);
        if (c.length !== head.length || !c.every((x) => NUM.test(x))) break;
        rows.push(c.map(int));
      }
      if (!rows.length) continue;
      let k = i - 1;
      while (k > 0 && !lines[k].trim()) k--;
      blocks.push({ who: parseOwner(lines[k] ?? ""), units: head, rows, start: i, end: j });
      i = j - 1;
    }
    if (!blocks.length) return null;

    const part = lines.slice(blocks[0].end, blocks[1]?.start ?? lines.length).map((l) => l.trim()).filter(Boolean);
    let loot = null;
    part.forEach((l, i) => {
      const m = l.match(/^(\d[\d.,]*)\/(\d[\d.,]*)$/);
      if (m && !loot && i >= 4 && part.slice(i - 4, i).every((x) => NUM.test(x))) loot = { res: part.slice(i - 4, i).map(int), carried: int(m[1]), capacity: int(m[2]) };
    });
    const infoAt = part.findIndex((l) => /^info$/i.test(l));
    const info = infoAt >= 0 && part[infoAt + 1] && !NUM.test(part[infoAt + 1]) ? part[infoAt + 1] : null;

    const rest = lines.slice(blocks[blocks.length - 1].end).map((l) => l.trim()).filter(Boolean);
    const triple = (p) => p + 2 < rest.length && !NUM.test(rest[p]) && NUM.test(rest[p + 1]) && NUM.test(rest[p + 2]);
    const stats = [];
    const at = rest.findIndex((l, p) => cells(l).length === 2 && triple(p + 1));
    if (at >= 0) for (let p = at + 1; triple(p); p += 3) stats.push({ label: rest[p], a: int(rest[p + 1]), d: int(rest[p + 2]) });
    return { title, date, blocks: blocks.map(({ who, units, rows }) => ({ who, units, rows })), loot, info, stats };
  };

  /* Resumen de un informe. Las estadísticas van por posición (fuerza, consumo antes, consumo perdido y materias
     perdidas) para no depender del idioma; si el juego no da esas cuatro filas, esos datos quedan vacíos. */
  A.reportSummary = (r) => {
    const side = (bs) => {
      const add = (i) => bs.reduce((s, b) => s + (b.rows[i] || []).reduce((x, n) => x + n, 0), 0);
      const sent = add(0), lost = add(1);
      return { sent, lost, pct: sent ? (lost / sent) * 100 : null };
    };
    const atk = side(r.blocks.slice(0, 1)), def = side(r.blocks.slice(1));
    const known = r.stats.length === 4;
    const lostRes = known ? { a: r.stats[3].a, d: r.stats[3].d } : null;
    const lootTotal = r.loot ? r.loot.res.reduce((s, n) => s + n, 0) : null;
    const fill = r.loot?.capacity ? (r.loot.carried / r.loot.capacity) * 100 : null;
    const net = lootTotal != null && lostRes ? lootTotal - lostRes.a : null;
    const outcome = atk.sent && atk.lost >= atk.sent ? "wiped" : atk.lost ? "losses" : "clean";
    const notes = [];
    if (outcome === "wiped") notes.push("rp.n.wiped");
    else if (net != null && net < 0) notes.push("rp.n.negative");
    if (outcome === "clean" && fill != null && fill >= 100) notes.push("rp.n.full");
    return { atk, def, lostRes, lootTotal, fill, net, outcome, notes };
  };

  /* ================= CÁLCULOS DE MUNDO Y CUENTA ================= */

  /* Reparto del mundo por tribu. Los natares no son jugadores y no cuentan. d7 es null si nadie tiene historial. */
  A.tribeStats = (w) => {
    const all = w.players.filter((p) => A.PLAYABLE.includes(p.tid) && p.status !== "natar");
    return A.PLAYABLE.map((tid) => {
      const ps = all.filter((p) => p.tid === tid);
      const pop = ps.reduce((s, p) => s + p.pop, 0), villages = ps.reduce((s, p) => s + p.villages, 0);
      const known = ps.filter((p) => p.d7 != null);
      return { tid, players: ps.length, share: (ps.length / Math.max(1, all.length)) * 100, villages, pop, avgPop: pop / Math.max(1, ps.length),
        avgVillages: villages / Math.max(1, ps.length), d7: known.length ? known.reduce((s, p) => s + p.d7, 0) : null };
    }).filter((r) => r.players);
  };

  /* Cuándo se alcanzan los puntos de cultura de la siguiente aldea. La cifra necesaria la da el juego, porque
     depende de la versión, de la velocidad y del número de aldeas. Devuelve null si los datos no bastan. */
  A.cultureEta = ({ have, need, perDay, now }) => {
    if (!(have >= 0) || !(need > 0)) return null;
    const missing = Math.max(0, need - have);
    if (!missing) return { missing, days: 0, at: new Date(now) };
    if (!(perDay > 0)) return { missing, days: Infinity, at: null };
    const days = missing / perDay;
    return { missing, days, at: new Date(now + days * 864e5) };
  };

  /* ================= VECINDARIO ================= */

  /* Jugadores y alianzas con aldeas a ≤ r casillas de c (en el toroide). */
  A.neighbourhood = (w, c, r) => {
    const players = new Map();
    const vids = new Set();
    for (const v of w.villages) {
      const d = A.dist(c.x, c.y, v.x, v.y, w.R);
      if (d > r) continue;
      const p = w.pById.get(v.uid); if (!p) continue;
      vids.add(v.vid);
      let e = players.get(p.uid);
      if (!e) players.set(p.uid, (e = { p, n: 0, pop: 0, dist: Infinity, near: null }));
      e.n++; e.pop += v.pop;
      if (d < e.dist) { e.dist = d; e.near = v; }
    }
    const list = [...players.values()];
    const allies = new Map();
    for (const e of list) {
      const k = e.p.status === "natar" ? -1 : e.p.aid || 0;
      if (!allies.has(k)) allies.set(k, { aid: k, players: 0, villages: 0, pop: 0, active: 0 });
      const a = allies.get(k);
      a.players++; a.villages += e.n; a.pop += e.pop; if (e.p.status === "active" || e.p.status === "new") a.active++;
    }
    return { players: list, alliances: [...allies.values()].sort((a, b) => b.pop - a.pop), pop: list.reduce((s, e) => s + e.pop, 0), vids };
  };

  /* Unidad de atraco más rápida de una tribu: la que antes puede llegar a robarte (excluye exploradores, arietes y catapultas). */
  A.fastestRaider = (tid) => {
    const us = A.UNITS[tid] || A.UNITS[1];
    let best = 0;
    for (let i = 1; i < 6; i++) if (us[i][3] !== 0 && us[i][2] > us[best][2]) best = i;
    return best;
  };

  /* Peligro relativo de un vecino: tamaño (raíz de la población en la zona), actividad y cercanía. */
  const ACT = { active: 1, new: 0.8, unknown: 0.7, slowing: 0.5, natar: 0.3, inactive: 0.1 };
  A.threat = (e) => Math.round((Math.sqrt(e.pop) * (ACT[e.p.status] ?? 0.5) * 10) / (1 + e.dist / 10)) / 10;
})();
