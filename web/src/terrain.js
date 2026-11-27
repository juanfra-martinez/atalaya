/* Terreno: casillas libres (croppers) y oasis. map.sql solo trae aldeas, así que el tipo de cada casilla y los
   oasis salen de lo que el propio mapa del juego ya ha cargado en el navegador del jugador, que él copia y pega.
   Sin DOM, para poder probarlo con Node. */
"use strict";
(() => {
  const A = window.A;
  const K = (x, y) => x + "," + y;

  /* Respuesta del mapa del juego (POST /api/v1/map/position), comprobada en International 7 (18 y 19 nov 2026):
       {"tiles":[{"position":{"x":38,"y":47},"title":"{k.vt} {k.f9}","text":"…"},            casilla libre de tipo 9
                 {"position":{"x":44,"y":47},"did":-1,"title":"{k.fo}",
                  "text":"<br />{a:r3} {a.r3} 25%<br />{a:r4} {a.r4} 25%<br />{k.animals}<br />…<i class=\"unit u35\"></i><span class=\"value \">4</span>…"},
                 {"position":{"x":53,"y":37},"did":-1,"title":"{k.fo}",                       oasis que el jugador ya atracó:
                  "text":"…<br />{b:ri1} hoy, 17:16 {b.ri1}<br />{b:bi2} &#x202d;75&#x202c;/&#x202d;75&#x202c;"},  informe y botín
                 {"position":{…},"uid":80,"aid":15,"did":24361,"title":"{k.dt} ATLANTIS",…},  aldea (ya está en map.sql)
                 {"position":{…},"title":"Bosque",…}]}                                         relleno del paisaje
     Cuándo la pide el juego (crypt.js): solo al pasar el ratón por una casilla cuyo tooltip no tiene ya en memoria,
     y para un rectángulo que depende del zoom: 11×9 casillas con zoom 1, 21×17 con zoom 2 y 31×31 con zoom 3.
     Mover el mapa no la lanza: las imágenes llegan aparte (/map/block/…png).

     Acepta una respuesta, varias pegadas seguidas o un HAR de la pestaña Red (A.jsonValues). Si una casilla aparece
     dos veces, manda la última. Devuelve { free: [[x, y, tipo]], oases: [[x, y, bono %, [[animal, n]], ocupado,
     atraco]], covered: ["x,y"], parts } o null si el texto no trae casillas. "atraco" es null o
     [icono del informe 1…7, fecha en ms o null, llevado, capacidad, texto de la fecha tal cual]. */
  const BONUS = /\{a:r([1-4])\}[^%<]*?(\d+)\s*%/g;
  const ANIMAL = /unit u(\d+)"[^>]*>\s*<\/i>\s*<span class="value[^"]*">\s*(\d+)/g;
  const RAID = /\{b:ri(\d)\}\s*(.*?)\s*\{b\.ri\d\}(?:\s*<br\s*\/?>\s*\{b:bi(\d)\}\s*([\d.,]+)\s*\/\s*([\d.,]+))?/;
  const isTile = (t) => t && typeof t === "object" && Number.isInteger(t.position?.x) && Number.isInteger(t.position?.y) && ("title" in t || "text" in t);
  const tilesIn = (v, depth = 0) => {
    if (!v || typeof v !== "object" || depth > 4) return [];
    if (Array.isArray(v)) return v.some(isTile) ? v.filter(isTile) : v.flatMap((x) => tilesIn(x, depth + 1));
    if (Array.isArray(v.tiles)) return v.tiles.filter(isTile);
    return Object.values(v).flatMap((x) => tilesIn(x, depth + 1));
  };
  const num = (s) => +String(s).replace(/[.,]/g, "");

  /* Fecha del último atraco tal como la escribe el juego: "hoy, 17:16", "ayer, 00:45" o "17.11.26, 22:42" (en
     inglés "today", "yesterday" y la fecha con barras). Es relativa al momento en que se copió el mapa. */
  A.raidDate = (s, now = Date.now()) => {
    const txt = String(s || "").toLowerCase(), hm = txt.match(/(\d{1,2}):(\d{2})/);
    if (!hm) return null;
    const d = new Date(now);
    if (/hoy|today|heute|oggi|aujourd|hoje|dzisiaj|bugün/.test(txt)) { /* el mismo día */ }
    else if (/ayer|yesterday|gestern|ieri|hier|ontem|wczoraj|dün/.test(txt)) d.setDate(d.getDate() - 1);
    else {
      const m = txt.match(/(\d{1,2})([./-])(\d{1,2})\2(\d{2,4})/);
      if (!m) return null;
      let [day, mon] = [+m[1], +m[3]];
      if (m[2] === "/" && mon > 12) [day, mon] = [mon, day]; // mm/dd/yy
      const y = +m[4] < 100 ? 2000 + +m[4] : +m[4];
      d.setFullYear(y, mon - 1, day);
    }
    d.setHours(+hm[1], +hm[2], 0, 0);
    const ts = d.getTime();
    return ts > now + 6e4 ? ts - 864e5 : ts; // "hoy, 23:50" copiado a las 00:05 de otro huso: es de ayer
  };

  A.parseMapTiles = (text, now = Date.now()) => {
    const values = typeof text === "string" ? A.jsonValues(text) : [text];
    const byKey = new Map();
    for (const v of values) for (const t of tilesIn(v)) byKey.set(K(t.position.x, t.position.y), t);
    if (!byKey.size) return null;
    const out = { free: [], oases: [], covered: [...byKey.keys()], parts: values.length };
    for (const t of byKey.values()) {
      const { x, y } = t.position;
      const title = String(t.title || ""), body = String(t.text || "").replace(/&#x202[a-e];|[‪-‮]/gi, "");
      const f = title.match(/\{k\.f(\d{1,2})\}/);
      if (f && A.FIELDS[+f[1]] && t.uid == null) { out.free.push([x, y, +f[1]]); continue; }
      const bonus = [0, 0, 0, 0];
      let m, any = false;
      BONUS.lastIndex = 0;
      while ((m = BONUS.exec(body))) { bonus[+m[1] - 1] += +m[2]; any = true; }
      if (!any) continue;
      const animals = [];
      ANIMAL.lastIndex = 0;
      while ((m = ANIMAL.exec(body))) if (A.ANIMALS[+m[1]]) animals.push([+m[1], +m[2]]);
      const r = body.match(RAID);
      const raid = r ? [+r[1], A.raidDate(r[2], now), r[4] != null ? num(r[4]) : null, r[5] != null ? num(r[5]) : null, r[2].replace(/<[^>]*>/g, "").trim()] : null;
      out.oases.push([x, y, bonus, animals, t.uid != null ? 1 : 0, raid]);
    }
    return out;
  };

  /* Une una importación con lo ya guardado. Lo importado manda en toda la zona que cubre: una casilla que ya no
     aparece como libre (alguien ha fundado) desaparece de la lista. */
  A.landMerge = (old, parsed, now = Date.now()) => {
    const cov = new Set(parsed.covered);
    const keep = (rows) => (rows || []).filter((r) => !cov.has(K(r[0], r[1])));
    return { free: keep(old?.free).concat(parsed.free), oases: keep(old?.oases).concat(parsed.oases), at: now, tiles: (old?.tiles || 0) + cov.size };
  };

  const fieldLabel = (d) => (d[3] >= 9 ? d[3] + "c" : d.join("-"));
  A.fieldLabel = (f) => fieldLabel(A.FIELDS[f]);

  /* Sitios para fundar. Una aldea puede anexionar hasta tres oasis de su cuadrado de 7×7 (a tres casillas como
     mucho en cada eje): el bono de cereal posible es la suma de los tres mejores oasis libres de ese cuadrado.
     "crop" es el cereal efectivo, campos × (1 + bono), que es lo que ordena los croppers. */
  A.settleSpots = (land, w, home, { reach = 3, crowd = 7 } = {}) => {
    const size = 2 * w.R + 1;
    const norm = (v) => ((((v + w.R) % size) + size) % size) - w.R;
    const oasisAt = new Map((land.oases || []).map((o) => [K(o[0], o[1]), o]));
    return (land.free || []).filter(([x, y]) => !w.vAt.has(K(x, y))).map(([x, y, f]) => {
      const fields = A.FIELDS[f];
      const near = [];
      for (let dx = -reach; dx <= reach; dx++) for (let dy = -reach; dy <= reach; dy++) {
        const o = oasisAt.get(K(norm(x + dx), norm(y + dy)));
        if (o) near.push(o);
      }
      const freeO = near.filter((o) => !o[4]);
      const top = (score) => freeO.map(score).sort((a, b) => b - a).slice(0, 3).reduce((a, b) => a + b, 0);
      const cropBonus = top((o) => o[2][3]);
      let villages = 0, nearest = null, nd = Infinity;
      for (let dx = -crowd; dx <= crowd; dx++) for (let dy = -crowd; dy <= crowd; dy++) {
        const v = w.vAt.get(K(norm(x + dx), norm(y + dy)));
        if (!v) continue;
        const d = Math.hypot(dx, dy);
        if (d > crowd) continue;
        villages++;
        if (d < nd) { nd = d; nearest = v; }
      }
      return { x, y, f, fields, label: fieldLabel(fields), cropBonus, anyBonus: top((o) => o[2].reduce((a, b) => a + b, 0)),
        oases: freeO.length, taken: near.length - freeO.length, crop: Math.round(fields[3] * (1 + cropBonus / 100) * 100) / 100,
        dist: home ? A.dist(home.x, home.y, x, y, w.R) : null, villages, nearest, nearestDist: nearest ? nd : null };
    });
  };

  /* Oasis libres: fuerza de los animales (suma de sus defensas) y "xp", la suma de su consumo de cereal. Según el
     soporte de Travian, al matarlos el héroe recibe 40 × consumo de cada recurso; que la experiencia sea ese mismo
     consumo es lo que se dice en la comunidad y no está comprobado. Sin animales el oasis se atraca sin bajas. */
  A.oasisTargets = (land, w, home) => (land.oases || []).filter((o) => !o[4]).map(([x, y, bonus, animals, , r]) => {
    let n = 0, defInf = 0, defCav = 0, att = 0, xp = 0;
    for (const [id, c] of animals) { const a = A.ANIMALS[id]; n += c; att += c * a[2]; defInf += c * a[3]; defCav += c * a[4]; xp += c * a[5]; }
    return { x, y, bonus, animals, n, att, defInf, defCav, xp, dist: home ? A.dist(home.x, home.y, x, y, w.R) : null, raid: A.raidInfo(r) };
  });

  /* Último atraco del jugador a un oasis, tal como lo enseña el tooltip del mapa. Iconos del juego (b.ri1…7):
     1 ganado sin bajas, 2 ganado con bajas, 3 perdido. Botín (b.bi0…2): vacío, a medias o lleno. */
  A.raidInfo = (r) => {
    if (!r) return null;
    const [icon, at, carried, cap, text] = r;
    const fill = carried != null && cap ? Math.min(100, (carried / cap) * 100) : null;
    return { icon, at, carried, cap, text, fill, losses: icon === 2 || icon === 3, lost: icon === 3 };
  };
  A.bonusLabel = (b) => ["r1", "r2", "r3", "r4"].map((k, i) => (b[i] ? `${b[i]}% ${A.t("land." + k)}` : "")).filter(Boolean).join(" + ");
})();
