/* Planificador de operaciones: varias oleadas desde aldeas distintas que deben llegar a una hora común.
   Sin DOM, para poder probarlo con Node. El plan viaja entero en el enlace (tras la #), nunca al servidor. */
"use strict";
(() => {
  const A = window.A;

  /* Un lugar escrito por el usuario: coordenadas x|y o el nombre exacto de un jugador (su capital). */
  A.resolvePlace = (w, s) => {
    const c = A.parseCoord(s); if (c) return c;
    const q = String(s ?? "").trim().toLowerCase(); if (!q) return null;
    const p = w.players.find((p) => p.name.toLowerCase() === q);
    return p?.cap ? { x: p.cap.x, y: p.cap.y } : null;
  };

  /* Plan: { name, land (ms de la llegada común), speed (multiplicador de velocidad de tropas), rows }.
     Fila: { from, to, tid, unit, ts, kind ("real" | "fake"), offset (segundos respecto a la llegada común), who }.
     La tribu sale de la aldea de origen si está en map.sql; si no, vale la que guarde la fila. */
  A.opsNew = (w, now = Date.now()) => ({ name: "", land: Math.ceil((now + 6 * 3600e3) / 3600e3) * 3600e3, speed: A.troopSpeed(w?.server?.speed || 1), rows: [] });
  A.opsRowNew = (prev, home) => (prev
    ? { ...prev, offset: (prev.offset || 0) + 1 }
    : { from: home ? `${home.x}|${home.y}` : "", to: "", tid: home?.tid || 1, unit: 0, ts: 0, kind: "real", offset: 0, who: "" });

  A.opsRow = (r, op, w) => {
    const from = A.resolvePlace(w, r.from), to = A.resolvePlace(w, r.to);
    const v = from ? w.vAt.get(from.x + "," + from.y) || null : null, tv = to ? w.vAt.get(to.x + "," + to.y) || null : null;
    const tid = v && A.UNITS[v.tid] ? v.tid : A.UNITS[r.tid] ? r.tid : 1;
    const unit = Math.max(0, Math.min(8, r.unit | 0));
    const base = { from, to, v, tv, tid, unit, p: v ? w.pById.get(v.uid) || null : null, tp: tv ? w.pById.get(tv.uid) || null : null };
    if (!from || !to || (from.x === to.x && from.y === to.y)) return { ok: false, ...base };
    const dist = A.dist(from.x, from.y, to.x, to.y, w.R);
    const sec = Math.round(A.travel(dist, A.UNITS[tid][unit][2], { serverSpeed: op.speed || 1, ts: Math.max(0, Math.min(20, +r.ts || 0)) }));
    const land = op.land + (+r.offset || 0) * 1000;
    return { ok: true, ...base, dist, sec, land, send: land - sec * 1000 };
  };
  A.planOps = (op, w) => op.rows.map((r, i) => ({ i, r, ...A.opsRow(r, op, w) }));

  /* Resumen: primera salida, cuántas reales y fakes, objetivos distintos y oleadas que ya no llegan a tiempo. */
  A.opsSummary = (plan, now = Date.now()) => {
    const ok = plan.filter((x) => x.ok);
    const first = ok.length ? Math.min(...ok.map((x) => x.send)) : null;
    return { n: plan.length, ok: ok.length, real: ok.filter((x) => x.r.kind !== "fake").length, fake: ok.filter((x) => x.r.kind === "fake").length,
      targets: new Set(ok.map((x) => x.to.x + "|" + x.to.y)).size, origins: new Set(ok.map((x) => x.from.x + "|" + x.from.y)).size,
      late: ok.filter((x) => x.send < now).length, first, last: ok.length ? Math.max(...ok.map((x) => x.land)) : null };
  };

  /* Enlace: JSON compacto en base64 seguro para URL. Las filas van como arrays para que el enlace sea corto. */
  const b64 = (s) => { const b = new TextEncoder().encode(s); let o = ""; for (const c of b) o += String.fromCharCode(c); return btoa(o).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
  const unb64 = (s) => { const raw = atob(String(s).replace(/-/g, "+").replace(/_/g, "/")); return new TextDecoder().decode(Uint8Array.from(raw, (c) => c.charCodeAt(0))); };
  A.opsEncode = (op) => b64(JSON.stringify({ n: op.name || "", l: op.land, s: op.speed || 1, r: op.rows.map((r) => [r.from, r.to, r.tid, r.unit, r.ts, r.kind === "fake" ? 1 : 0, r.offset || 0, r.who || ""]) }));
  A.opsDecode = (code) => {
    try {
      const d = JSON.parse(unb64(code));
      if (!d || typeof d.l !== "number" || !Array.isArray(d.r)) return null;
      const txt = (x) => String(x ?? "").slice(0, 60);
      return { name: txt(d.n), land: d.l, speed: Math.max(1, Math.min(10, +d.s || 1)),
        rows: d.r.slice(0, 200).filter(Array.isArray).map((a) => ({ from: txt(a[0]), to: txt(a[1]), tid: +a[2] || 1, unit: +a[3] || 0, ts: +a[4] || 0, kind: a[5] ? "fake" : "real", offset: +a[6] || 0, who: txt(a[7]) })) };
    } catch { return null; }
  };

  /* Texto para compartir, ordenado por hora de salida. `clock` da la hora ya formateada (local o UTC). */
  A.opsText = (op, plan, { fmt = "dc", clock, labels }) => {
    const b = (x) => (fmt === "bb" ? `[b]${x}[/b]` : `**${x}**`);
    const xy = (c) => (fmt === "bb" ? `[x|y]${c.x}|${c.y}[/x|y]` : `(${c.x}|${c.y})`);
    const rows = plan.filter((x) => x.ok).sort((a, c) => a.send - c.send);
    const out = [b(op.name || labels.title) + ` · ${labels.land} ${clock(op.land)}`];
    for (const x of rows) {
      out.push(`${b(clock(x.send))} ${x.r.who ? x.r.who + " " : ""}${xy(x.from)} → ${xy(x.to)} · ${x.r.kind === "fake" ? labels.fake : labels.real} · ${A.unitName(x.tid, x.unit)}${+x.r.ts ? ` · ${labels.ts} ${x.r.ts}` : ""} · ${labels.land} ${clock(x.land)}`);
    }
    return out.join("\n");
  };
})();
