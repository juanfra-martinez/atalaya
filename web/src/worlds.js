/* Estadísticas de la vista de mundos: lógica pura, sin DOM, para poder probarla con node --test. */
"use strict";
(() => {
  const A = window.A;
  const WEEK = 7;
  const MAX_GAP = 3; // días que una instantánea cubre a un mundo que no se pudo descargar
  const dayNum = (iso) => Date.parse(iso + "T00:00:00Z") / 864e5;
  const todayNum = () => Math.floor(Date.now() / 864e5);
  const sum = (arr) => arr.reduce((a, b) => a + (b || 0), 0);

  A.hasData = (s) => !!s && !!s.day;

  /* Métricas derivadas de un mundo. Se cachean por objeto: la lista se sustituye entera al refrescar. */
  const cache = new WeakMap();
  A.worldStats = (s) => {
    if (cache.has(s)) return cache.get(s);
    const data = A.hasData(s);
    const out = {
      popPerPlayer: data && s.players ? s.population / s.players : null,
      villagesPerPlayer: data && s.players ? s.villages / s.players : null,
      d7: { players: null, villages: null, population: null }, d7Pct: null,
      conquered7: null, founded7: null, destroyed7: null, conqueredPrev7: null, history: 0,
    };
    const tr = s.trend, n = tr?.days?.length || 0;
    if (data && n) {
      const days = tr.days.map(dayNum), last = days[n - 1];
      out.history = n;
      if (n > 1) {
        let base = 0;
        for (let i = n - 2; i >= 0; i--) if (days[i] <= last - WEEK) { base = i; break; }
        for (const k of Object.keys(out.d7)) out.d7[k] = tr[k][n - 1] - tr[k][base];
        if (tr.players[base]) out.d7Pct = (out.d7.players / tr.players[base]) * 100;
      }
      const windowSum = (key, from, to) => sum(days.map((d, i) => (d > from && d <= to ? tr[key][i] : 0)));
      out.conquered7 = windowSum("conquered", last - WEEK, last);
      out.founded7 = windowSum("founded", last - WEEK, last);
      out.destroyed7 = windowSum("destroyed", last - WEEK, last);
      /* Solo con la semana anterior completa: una semana a medias haría parecer que la guerra se ha disparado. */
      if (days[0] <= last - 2 * WEEK + 1) out.conqueredPrev7 = windowSum("conquered", last - 2 * WEEK, last - WEEK);
    }
    cache.set(s, out);
    return out;
  };

  /* Avance de la partida: con fecha de fin es exacto; sin ella, la estimación por velocidad de siempre. */
  A.lifePct = (s) => {
    if (s.status === "upcoming") return 0;
    if (s.start && s.end) {
      const span = dayNum(s.end) - dayNum(s.start);
      if (span > 0) return Math.max(0, Math.min(100, ((todayNum() - dayNum(s.start)) / span) * 100));
    }
    return Math.min(100, ((s.age || 0) / (s.speed >= 3 ? 80 : 200)) * 100 * (s.speed > 1 ? s.speed / 2 : 1));
  };
  /* Días que faltan para que abra un mundo; null si no se conoce la fecha. */
  A.daysToStart = (s) => (s.start ? dayNum(s.start) - todayNum() : null);

  /* Tres clases de velocidad: con más colores los puntos del gráfico dejan de distinguirse. */
  A.speedClass = (speed) => (speed >= 5 ? "c" : speed > 1 ? "b" : "a");

  /* Ordenación. Lo que no tiene dato va siempre al final, sea cual sea el sentido. */
  const stat = (fn) => (s) => (A.hasData(s) ? fn(A.worldStats(s), s) : null);
  A.WORLD_SORTS = {
    players: { get: stat((_, s) => s.players), dir: -1 },
    growth: { get: stat((m) => m.d7.players), dir: -1 },
    growthPct: { get: stat((m) => m.d7Pct), dir: -1 },
    population: { get: stat((_, s) => s.population), dir: -1 },
    villages: { get: stat((_, s) => s.villages), dir: -1 },
    alliances: { get: stat((_, s) => s.alliances), dir: -1 },
    popPerPlayer: { get: stat((m) => m.popPerPlayer), dir: -1 },
    conquered7: { get: stat((m) => m.conquered7), dir: -1 },
    founded7: { get: stat((m) => m.founded7), dir: -1 },
    age: { get: (s) => (s.status === "upcoming" ? null : s.age ?? null), dir: 1 },
    speed: { get: (s) => s.speed, dir: -1 },
    start: { get: (s) => s.start || null, dir: 1 },
    name: { get: (s) => s.name, dir: 1 },
    region: { get: (s) => s.region || null, dir: 1 },
  };
  const byName = (a, b) => a.name.localeCompare(b.name, A.locale?.(), { numeric: true });
  A.sortWorlds = (list, key, dir) => {
    const get = (A.WORLD_SORTS[key] || A.WORLD_SORTS.players).get;
    return list.slice().sort((a, b) => {
      const va = get(a), vb = get(b);
      if (va == null || vb == null) return (va == null) - (vb == null) || byName(a, b);
      const c = typeof va === "string" ? va.localeCompare(vb, A.locale?.(), { numeric: true }) : va - vb;
      return c * dir || byName(a, b);
    });
  };

  /* Valores de un mundo alineados con `days`, arrastrando el último dato si falta poco: un mundo que falla
     una descarga no debe parecer una caída de jugadores en el total. */
  const aligned = (s, key, days) => {
    const tr = s.trend, map = new Map(tr.days.map((d, i) => [d, tr[key][i]]));
    let last = null, lastDay = null;
    return days.map((d) => {
      if (map.has(d)) { last = map.get(d); lastDay = dayNum(d); return last; }
      return last != null && dayNum(d) - lastDay <= MAX_GAP ? last : null;
    });
  };

  /* Totales de un conjunto de mundos: lo que alimenta los indicadores y los gráficos. */
  A.worldTotals = (list) => {
    const data = list.filter((s) => A.hasData(s));
    const withTrend = data.filter((s) => s.trend?.days?.length);
    const stats = data.map(A.worldStats);
    const days = [...new Set(withTrend.flatMap((s) => s.trend.days))].sort();
    const level = (key) => {
      const rows = withTrend.map((s) => aligned(s, key, days));
      return days.map((_, i) => { const v = rows.map((r) => r[i]).filter((x) => x != null); return v.length ? sum(v) : null; });
    };
    const flow = (key) => days.map((d) => sum(withTrend.map((s) => { const i = s.trend.days.indexOf(d); return i < 0 ? 0 : s.trend[key][i]; })));
    /* Sale de la misma serie que la línea del indicador: sumar mundo a mundo dejaría fuera los recién abiertos y daría una cifra que la contradice. */
    const series = { players: level("players"), villages: level("villages"), population: level("population") };
    const delta = (key) => {
      const n = days.length;
      if (n < 2) return null;
      const nums = days.map(dayNum), v = series[key];
      let base = 0;
      for (let i = n - 2; i >= 0; i--) if (nums[i] <= nums[n - 1] - WEEK) { base = i; break; }
      return v[n - 1] != null && v[base] != null ? v[n - 1] - v[base] : null;
    };
    const total =(fn) => { const v = stats.map(fn).filter((x) => x != null); return v.length ? sum(v) : null; };
    const ages = data.map((s) => s.age).filter((x) => x != null);
    return {
      worlds: list.length, withData: data.length,
      players: sum(data.map((s) => s.players)), villages: sum(data.map((s) => s.villages)),
      alliances: sum(data.map((s) => s.alliances)), population: sum(data.map((s) => s.population)),
      avgAge: ages.length ? sum(ages) / ages.length : null,
      d7: { players: delta("players"), villages: delta("villages"), population: delta("population") },
      conquered7: total((m) => m.conquered7), founded7: total((m) => m.founded7), destroyed7: total((m) => m.destroyed7),
      conqueredPrev7: total((m) => m.conqueredPrev7),
      days, series,
      flows: { conquered: flow("conquered"), founded: flow("founded"), destroyed: flow("destroyed") },
    };
  };

  /* Reparto por una dimensión, de mayor a menor número de jugadores. */
  A.worldGroups = (list, keyOf) => {
    const groups = new Map();
    for (const s of list) {
      const k = keyOf(s);
      const g = groups.get(k) || { key: k, worlds: 0, players: 0, population: 0 };
      g.worlds++; g.players += s.players || 0; g.population += s.population || 0;
      groups.set(k, g);
    }
    return [...groups.values()].sort((a, b) => b.players - a.players || b.worlds - a.worlds || String(a.key).localeCompare(String(b.key), A.locale?.(), { numeric: true }));
  };

  A.AGE_BANDS = [[1, 7], [8, 30], [31, 90], [91, 180], [181, Infinity]];
  A.ageHistogram = (list) => A.AGE_BANDS.map(([lo, hi]) => list.filter((s) => s.age != null && s.age >= lo && s.age <= hi).length);

  /* El mundo con el valor más alto de cada categoría; se omite la categoría si nadie tiene un valor positivo. */
  A.worldHighlights = (list) => {
    const data = list.filter((s) => A.hasData(s));
    const best = (key, fn, min = true) => {
      let top = null, val = null;
      for (const s of data) {
        const v = fn(s);
        if (v == null || (min && v <= 0)) continue;
        if (val == null || v > val) { top = s; val = v; }
      }
      return top ? { key, world: top, value: val } : null;
    };
    const m = A.worldStats;
    return [
      best("players", (s) => s.players),
      best("population", (s) => s.population),
      best("growth", (s) => m(s).d7.players),
      best("war", (s) => m(s).conquered7),
      best("young", (s) => (s.age == null ? null : -s.age), false),
    ].filter(Boolean);
  };

  /* CSV de la lista visible. Los textos van entre comillas y sin fórmulas: esto suele acabar en una hoja de cálculo. */
  const cell = (v) => {
    if (v == null) return "";
    if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(2);
    const text = String(v).replace(/"/g, '""');
    return `"${/^[=+\-@\t\r]/.test(text) ? "'" : ""}${text}"`;
  };
  A.worldsCsv = (list) => {
    const head = ["id", "name", "region", "speed", "status", "day", "players", "players_7d", "villages", "alliances", "population", "pop_per_player", "conquered_7d", "founded_7d", "start", "map_sql"];
    const rows = list.map((s) => {
      const m = A.worldStats(s), d = A.hasData(s);
      return [s.id, s.name, s.region, s.speed, s.status, s.age, d ? s.players : null, m.d7.players, d ? s.villages : null, d ? s.alliances : null, d ? s.population : null, m.popPerPlayer, m.conquered7, m.founded7, s.start, s.day];
    });
    return [head.join(","), ...rows.map((r) => r.map(cell).join(","))].join("\r\n") + "\r\n";
  };
})();
