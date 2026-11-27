/* Vistas: panel e inactivos. */
"use strict";
(() => {
  const A = window.A;
  const t = (...a) => A.t(...a);
  A.views = A.views || {};

  const head = (title, sub, actions = "") => `<div class="page-head rise"><div><h1>${A.esc(title)}</h1>${sub ? `<p>${sub}</p>` : ""}</div>${actions ? `<div class="actions">${actions}</div>` : ""}</div>`;
  A.head = head;
  A.worldSub = () => {
    const s = A.state.world.server;
    return t("dash.sub", { day: s.age ?? "?", speed: s.speed, date: s.day ? A.dayLabel(s.day, { day: "numeric", month: "long", year: "numeric" }) : "—" });
  };

  /* ================= PANEL ================= */
  A.views.dashboard = (root) => {
    const w = A.state.world, s = w.server, ev = s.eventsToday || {};
    const n = w.days.length;
    const pl = w.playerSeries;
    const inactPct = Math.round((w.counts.inactive / Math.max(1, w.players.length)) * 100);
    const labels = w.days.map((d) => A.dayLabel(d));
    root.innerHTML = head(s.name, A.worldSub(),
      `<button class="btn" data-go="map">${A.icon("map")}${t("nav.map")}</button><button class="btn primary" data-go="inactives">${A.icon("target")}${t("dash.findInactives")}</button>`) +
      `<div class="grid g-kpi">
        ${kpi(t("common.players"), A.fmt(s.players), n > 1 ? pl[n - 1] - pl[n - 2] : null, A.spark(pl, { color: "var(--info)" }))}
        ${kpi(t("common.villages"), A.fmt(s.villages), null, "")}
        ${kpi(t("dash.population"), A.compact(s.population), n > 1 ? w.popSeries[n - 1] - w.popSeries[n - 2] : null, A.spark(w.popSeries))}
        ${kpi(t("dash.inactives"), A.fmt(w.counts.inactive), null, "", "accent", t("dash.ofPlayers", { p: inactPct }))}
        ${kpi(t("dash.conqToday"), A.fmt(ev.conquered || 0), null, "", "", t("dash.destroyed", { n: ev.destroyed || 0 }))}
        ${kpi(t("dash.foundedToday"), A.fmt(ev.founded || 0), null, "", "", t("dash.newPlayers", { n: ev.player_new || 0 }))}
      </div>
      ${s.info ? `<div class="card"><div class="card-h"><h2>${t("cal.title")}</h2><span class="sub">${t("cal.sub")}</span></div><div class="card-b">${A.calendarHtml(s)}</div></div>` : ""}
      <div class="grid g-2">
        <div class="card"><div class="card-h"><h2>${t("dash.growth")}</h2><span class="sub">${t("dash.growthSub", { n })}</span>
          <div class="right seg" id="dash-series"><button aria-pressed="true" data-v="pop">${t("dash.population")}</button><button aria-pressed="false" data-v="players">${t("common.players")}</button></div></div>
          <div class="card-b"><div id="dash-chart"></div></div></div>
        <div class="card"><div class="card-h"><h2>${t("dash.latest")}</h2><span class="right"><button class="btn sm" data-go="events">${t("common.seeAll")}</button></span></div>
          <div class="feed" id="dash-feed" style="max-height:300px;overflow:auto;margin-top:8px"></div></div>
      </div>
      <div class="grid g-2e">
        <div class="card"><div class="card-h"><h2>${t("dash.opps")}</h2><span class="sub">${A.state.home ? t("dash.oppsSub", { c: A.coord(A.state.home.x, A.state.home.y) }) : ""}</span>
          <span class="right"><button class="btn sm" id="dash-home">${A.icon("home")}${A.state.home ? t("home.change") : t("home.set")}</button></span></div>
          <div class="table-wrap card-b" id="dash-opps"></div></div>
        <div class="card"><div class="card-h"><h2>${t("dash.movers")}</h2><div class="right seg" id="dash-mv"><button aria-pressed="true" data-v="up">${t("dash.risers")}</button><button aria-pressed="false" data-v="down">${t("dash.fallers")}</button></div></div>
          <div class="table-wrap card-b" id="dash-movers"></div></div>
      </div>
      <div class="grid g-2e">
        <div class="card"><div class="card-h"><h2>${t("dash.topPlayers")}</h2><span class="right"><button class="btn sm" data-go="rankings">${t("common.seeAll")}</button></span></div><div class="table-wrap card-b">${topPlayers(w.players.filter((p) => p.status !== "natar").slice(0, 10))}</div></div>
        <div class="card"><div class="card-h"><h2>${t("dash.topAlliances")}</h2></div><div class="table-wrap card-b">${topAlliances(w.alliances.slice(0, 10))}</div></div>
      </div>`;

    const chartEl = A.$("#dash-chart", root);
    const drawChart = (which) => A.lineChart(chartEl, which === "players"
      ? { labels, series: [{ name: t("common.players"), values: w.playerSeries, color: "var(--info)" }] }
      : { labels, series: [{ name: t("dash.population"), values: w.popSeries, color: "var(--accent)" }] });
    requestAnimationFrame(() => drawChart("pop"));
    A.$("#dash-series", root).onclick = (e) => { const b = e.target.closest("button"); if (!b) return; A.$$("#dash-series button", root).forEach((x) => x.setAttribute("aria-pressed", x === b)); drawChart(b.dataset.v); };
    A.$("#dash-feed", root).innerHTML = A.eventRows(A.state.events.slice(0, 14), { compact: true });
    A.$("#dash-home", root).onclick = () => A.homeModal(() => A.route());

    const opp = A.$("#dash-opps", root);
    if (!A.state.home) opp.innerHTML = A.ui.empty(t("dash.noHome"), t("dash.noHomeSub"));
    else {
      const rows = A.findTargets({ ...A.filters(), maxDist: 40 }).slice(0, 7);
      opp.innerHTML = rows.length ? `<table class="t"><thead><tr><th>${t("inact.village")}</th><th>${t("common.player")}</th><th class="r">${t("common.pop")}</th><th class="r">${t("inact.days")}</th><th class="r">${t("inact.dist")}</th><th>${t("inact.conf")}</th></tr></thead><tbody>
        ${rows.map((r) => `<tr><td>${A.ui.coord(r.v.x, r.v.y)}</td><td>${A.ui.player(r.p)}</td><td class="r">${A.fmt(r.v.pop)}</td><td class="r">${r.p.streak}</td><td class="r">${A.fmt(r.dist, 1)}</td><td>${A.ui.conf(r.p)}</td></tr>`).join("")}</tbody></table>`
        : w.days.length < 2 ? A.ui.empty(t("inact.needHistory"), t("inact.needHistorySub")) : A.ui.empty(t("inact.none"));
    }
    const mv = A.$("#dash-movers", root);
    const drawMovers = (dir) => {
      const list = w.players.filter((p) => p.d7 != null && p.status !== "natar").sort((a, b) => (dir === "up" ? b.d7 - a.d7 : a.d7 - b.d7)).slice(0, 7);
      mv.innerHTML = `<table class="t"><thead><tr><th>${t("common.player")}</th><th>${t("common.alliance")}</th><th class="r">${t("common.pop")}</th><th class="r">${t("dash.d7")}</th><th></th></tr></thead><tbody>
        ${list.map((p) => `<tr><td>${A.ui.player(p)}</td><td>${A.ui.ally(p.aid)}</td><td class="r">${A.fmt(p.pop)}</td><td class="r">${A.ui.delta(p.d7)}</td><td>${A.spark(p.popHist, { w: 80, h: 22, color: dir === "up" ? "var(--good)" : "var(--bad)" })}</td></tr>`).join("")}</tbody></table>`;
    };
    drawMovers("up");
    A.$("#dash-mv", root).onclick = (e) => { const b = e.target.closest("button"); if (!b) return; A.$$("#dash-mv button", root).forEach((x) => x.setAttribute("aria-pressed", x === b)); drawMovers(b.dataset.v); };
  };
  const kpi = (label, value, delta, spark, cls = "", note = "") => `<div class="card kpi rise ${cls}"><span class="label">${A.esc(label)}</span><span class="value">${value}</span>
    <span class="delta ${delta != null ? A.cls(delta) : "muted"}">${delta != null ? A.signed(delta) + " " + A.esc(t("dash.vsYesterday")) : A.esc(note)}</span>${spark}</div>`;
  const topPlayers = (list) => `<table class="t"><thead><tr><th>#</th><th>${t("common.player")}</th><th>${t("common.alliance")}</th><th class="r">${t("common.villagesShort")}</th><th class="r">${t("common.pop")}</th><th class="r">${t("dash.d7")}</th><th></th></tr></thead><tbody>
    ${list.map((p, i) => `<tr><td class="rank">${i + 1}</td><td>${A.ui.tribe(p.tid, false)} ${A.ui.player(p)}</td><td>${A.ui.ally(p.aid)}</td><td class="r">${p.villages}</td><td class="r">${A.fmt(p.pop)}</td><td class="r">${A.ui.delta(p.d7)}</td><td>${A.spark(p.popHist, { w: 72, h: 20 })}</td></tr>`).join("")}</tbody></table>`;
  const topAlliances = (list) => `<table class="t"><thead><tr><th>#</th><th>${t("common.alliance")}</th><th class="r">${t("common.members")}</th><th class="r">${t("common.villagesShort")}</th><th class="r">${t("common.pop")}</th><th class="r">${t("dash.d7")}</th><th></th></tr></thead><tbody>
    ${list.map((a, i) => `<tr><td class="rank">${i + 1}</td><td>${A.ui.ally(a.aid)}</td><td class="r">${a.members}</td><td class="r">${a.villages}</td><td class="r">${A.fmt(a.pop)}</td><td class="r">${A.ui.delta(a.d7)}</td><td>${A.spark(a.popHist, { w: 72, h: 20, color: A.PALETTE[i % A.PALETTE.length] })}</td></tr>`).join("")}</tbody></table>`;

  /* ================= INACTIVOS ================= */
  const DEF = { maxDist: 25, popMin: 0, popMax: 2000, minDays: 3, minConf: 50, tribes: A.PLAYABLE.slice(), noAlly: false, exclude: "", hideNew: true, slowing: false, natars: false, attacked: true, hideListed: true, group: "village", unit: 0, ts: 0, art: 1 };
  A.filters = () => ({ ...DEF, ...A.store.get("filters", {}) });
  A.saveFilters = (f) => A.store.set("filters", f);

  A.findTargets = (f) => {
    const w = A.state.world, h = A.state.home;
    if (!w || !h) return [];
    const ex = new Set(String(f.exclude || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean));
    const tribes = new Set(f.tribes);
    const unitTid = A.UNITS[h.tid] ? h.tid : 1;
    const unitSpeed = A.UNITS[unitTid][f.unit || 0][2];
    const out = [];
    const okStatus = (p) => (p.status === "natar" ? f.natars : p.status === "inactive" || (f.slowing && p.status === "slowing") || (!f.hideNew && p.status === "new"));
    for (const v of w.villages) {
      const p = w.pById.get(v.uid);
      if (!p || !okStatus(p)) continue;
      if (p.status !== "natar") {
        if (p.streak < f.minDays || p.confidence < f.minConf) continue;
        if (!tribes.has(p.tid)) continue;
        if (f.noAlly && p.aid) continue;
        if (p.aid && ex.has((p.tag || "").toLowerCase())) continue;
        if (!f.attacked && p.flags.includes("attacked")) continue;
      }
      const pop = f.group === "player" ? p.pop : v.pop;
      if (pop < f.popMin || pop > f.popMax) continue;
      const d = A.dist(h.x, h.y, v.x, v.y, w.R);
      if (d > f.maxDist || d === 0) continue;
      out.push({ v, p, dist: d, time: A.travel(d, unitSpeed, { serverSpeed: A.troopSpeed(w.server.speed), ts: f.ts, artifact: f.art }), prio: A.priority(p.status === "natar" ? 60 : p.confidence, v.pop, d) });
    }
    if (f.group === "player") {
      const best = new Map();
      for (const r of out) { const b = best.get(r.p.uid); if (!b || r.dist < b.dist) best.set(r.p.uid, { ...r, n: (b?.n || 0) + 1 }); else b.n++; }
      return [...best.values()].sort((a, b) => b.prio - a.prio);
    }
    return out.sort((a, b) => b.prio - a.prio);
  };

  A.views.inactives = (root) => {
    const f = A.filters();
    const ts = { sort: "prio", dir: -1, limit: 150, sel: new Set() };
    let listed = A.fbListed(); // "x|y" -> en tus listas de vacas (datos del juego) o marcada en el asistente
    const w = A.state.world;
    const home = A.state.home;
    root.innerHTML = head(t("inact.title"), t("inact.sub"),
      `<button class="btn" id="in-home">${A.icon("home")}${home ? A.coord(home.x, home.y) + " · " + t("home.change") : t("home.set")}</button>`) +
      (home ? "" : `<div class="card card-b">${A.ui.empty(t("dash.noHome"), t("dash.noHomeSub"))}<div class="row" style="justify-content:center"><button class="btn primary" id="in-home2">${A.icon("home")}${t("home.set")}</button></div></div>`) +
      `<div class="finder" ${home ? "" : 'style="display:none"'}>
        <form class="card filters" id="in-f" autocomplete="off">
          <details id="f-det" open><summary><h3>${t("inact.filters")}</h3><span class="muted">${A.icon("menu").replace("<svg", '<svg width="16" height="16"')}</span></summary><div>
          ${range("maxDist", t("inact.maxDist"), 1, 120, f.maxDist, t("common.fields"))}
          <div class="field"><span class="lbl">${t("inact.popRange")}</span><div class="row"><input class="input num" type="number" id="f-popMin" value="${f.popMin}" min="0" aria-label="min"><span class="muted">–</span><input class="input num" type="number" id="f-popMax" value="${f.popMax}" min="0" aria-label="max"></div></div>
          ${range("minDays", t("inact.minDays"), 1, 14, f.minDays, t("common.daysShort"))}
          ${range("minConf", t("inact.minConf"), 0, 100, f.minConf, "%")}
          <div class="field"><span class="lbl">${t("common.tribes")}</span><div class="tribe-toggles" id="f-tribes">${A.PLAYABLE.map((tid) => `<button type="button" data-tid="${tid}" aria-pressed="${f.tribes.includes(tid)}"><i style="background:var(${A.TRIBES[tid].color})"></i>${A.esc(t("tribe." + A.TRIBES[tid].key))}</button>`).join("")}</div></div>
          <div class="field"><label for="f-exclude">${t("inact.exclude")}</label><input class="input" id="f-exclude" value="${A.esc(f.exclude)}" placeholder="${A.esc(t("inact.excludePh"))}" list="ally-list"><datalist id="ally-list">${w.alliances.slice(0, 60).map((a) => `<option value="${A.esc(a.tag)}">`).join("")}</datalist></div>
          <div class="field" style="gap:8px">
            <label class="check"><input type="checkbox" id="f-noAlly" ${f.noAlly ? "checked" : ""}>${t("inact.noAlly")}</label>
            <label class="check"><input type="checkbox" id="f-slowing" ${f.slowing ? "checked" : ""}>${t("inact.slowing")}</label>
            <label class="check"><input type="checkbox" id="f-hideNew" ${f.hideNew ? "checked" : ""}>${t("inact.hideNew")}</label>
            <label class="check"><input type="checkbox" id="f-attacked" ${f.attacked ? "checked" : ""}>${t("inact.attacked")}</label>
            <label class="check"><input type="checkbox" id="f-natars" ${f.natars ? "checked" : ""}>${t("inact.natars")}</label>
            <label class="check"><input type="checkbox" id="f-hideListed" ${f.hideListed ? "checked" : ""}>${t("inact.hideListed")}</label>
            <span class="muted fb-forget" id="f-marks"></span>
          </div>
          <div class="sep"></div>
          <h3>${t("inact.travel")}</h3>
          <div class="field"><label for="f-unit">${t("inact.unit", { tribe: t("tribe." + (A.TRIBES[home?.tid] || A.TRIBES[1]).key) })}</label><select class="input" id="f-unit">${(A.UNITS[home?.tid] || A.UNITS[1]).map((u, i) => `<option value="${i}" ${+f.unit === i ? "selected" : ""}>${A.esc(A.unitName(home?.tid || 1, i))} · ${u[2]}</option>`).join("")}</select></div>
          <div class="row"><div class="field" style="flex:1"><label for="f-ts">${t("inact.ts")}</label><input class="input num" type="number" id="f-ts" min="0" max="20" value="${f.ts}"></div>
            <div class="field" style="flex:1"><label for="f-art">${t("inact.art")}</label><select class="input" id="f-art">${[1, 1.5, 2, 3].map((x) => `<option value="${x}" ${+f.art === x ? "selected" : ""}>×${x}</option>`).join("")}</select></div></div>
          <button type="button" class="btn ghost sm" id="f-reset">${t("inact.reset")}</button>
        </div></details></form>
        <div class="card">
          <div class="result-bar"><span class="big" id="in-n">0</span><span class="muted" id="in-sub"></span>
            <div class="seg" id="in-group" style="margin-left:auto"><button aria-pressed="${f.group === "village"}" data-v="village">${t("inact.byVillage")}</button><button aria-pressed="${f.group === "player"}" data-v="player">${t("inact.byPlayer")}</button></div>
            <button class="btn sm" id="in-map">${A.icon("map")}${t("inact.onMap")}</button>
            <button class="btn sm" id="in-export">${A.icon("download")}${t("inact.export")}</button></div>
          <div class="fb-top" id="in-fb"></div>
          <div class="table-wrap" style="max-height:calc(100vh - 300px);overflow:auto"><table class="t" id="in-t"><thead></thead><tbody></tbody></table></div>
          <div class="row" style="justify-content:center;padding:12px" id="in-more"></div>
          <div class="selbar" id="in-selbar" hidden></div>
        </div>
      </div>`;
    const openHome = () => A.homeModal(() => A.route());
    A.$("#in-home", root).onclick = openHome;
    A.$("#in-home2", root) && (A.$("#in-home2", root).onclick = openHome);
    if (!home) return;
    if (matchMedia("(max-width: 1100px)").matches) A.$("#f-det", root).open = false;
    const form = A.$("#in-f", root), table = A.$("#in-t", root);
    let rows = [];
    let hiddenListed = 0;
    const render = () => {
      rows = A.findTargets(f);
      if (f.hideListed) { const n = rows.length; rows = rows.filter((r) => !listed.has(A.fbKey(r.v))); hiddenListed = n - rows.length; }
      else hiddenListed = 0;
      const cols = [
        { k: "sel", label: `<input type="checkbox" id="in-all" aria-label="${A.esc(t("inact.selectAll"))}">` },
        { k: "prio", label: t("inact.prio"), cls: "r", sort: (r) => r.prio },
        { k: "vil", label: f.group === "player" ? t("inact.nearest") : t("inact.village"), sort: (r) => r.v.name },
        { k: "player", label: t("common.player"), sort: (r) => r.p.name.toLowerCase() },
        { k: "ally", label: t("common.alliance"), sort: (r) => r.p.tag },
        { k: "pop", label: f.group === "player" ? t("inact.playerPop") : t("common.pop"), cls: "r", sort: (r) => (f.group === "player" ? r.p.pop : r.v.pop) },
        { k: "d3", label: t("inact.d3"), cls: "r", sort: (r) => r.v.d3 ?? 0 },
        { k: "days", label: t("inact.days"), cls: "r", sort: (r) => r.p.streak },
        { k: "conf", label: t("inact.conf"), sort: (r) => r.p.confidence },
        { k: "dist", label: t("inact.dist"), cls: "r", sort: (r) => r.dist },
        { k: "time", label: t("inact.time"), cls: "r", sort: (r) => r.time },
        { k: "act", label: "" },
      ];
      A.ui.sortable(table, rows, cols, ts, render);
      A.$("#in-n", root).textContent = A.fmt(rows.length);
      A.$("#in-sub", root).textContent = t(f.group === "player" ? "inact.foundPlayers" : "inact.foundVillages", { d: f.maxDist, c: A.coord(home.x, home.y) });
      const shown = rows.slice(0, ts.limit);
      table.querySelector("tbody").innerHTML = shown.map((r) => `<tr class="${ts.sel.has(r.v.vid) ? "sel" : ""}">
          <td><input type="checkbox" data-sel="${r.v.vid}" ${ts.sel.has(r.v.vid) ? "checked" : ""} aria-label="${A.esc(r.v.name)}"></td>
          <td class="r"><b class="num">${r.prio.toFixed(1)}</b></td>
          <td>${A.ui.coord(r.v.x, r.v.y)} <span class="muted">${A.esc(r.v.name)}</span>${f.group === "player" && r.n > 1 ? ` <span class="chip">+${r.n - 1}</span>` : ""}${listedChip(r.v)}</td>
          <td>${A.ui.tribe(r.p.tid, false)} ${A.ui.player(r.p)} ${r.p.flags.includes("attacked") ? `<span class="chip" title="${A.esc(t("why.attacked"))}">${A.icon("swords").replace("<svg", '<svg width="12" height="12"')}</span>` : ""}</td>
          <td>${A.ui.ally(r.p.aid)}</td>
          <td class="r">${A.fmt(f.group === "player" ? r.p.pop : r.v.pop)}</td>
          <td class="r">${A.ui.delta(r.v.d3)}</td>
          <td class="r">${r.p.status === "natar" ? "—" : (r.p.bounded ? "≥" : "") + r.p.streak}</td>
          <td>${r.p.status === "natar" ? A.ui.pill("natar") : A.ui.conf(r.p)}</td>
          <td class="r num">${A.fmt(r.dist, 1)}</td>
          <td class="r mono">${A.dur(r.time)}</td>
          <td>${A.ui.game("tile", r.v.x, r.v.y)}${A.ui.game("send", r.v.x, r.v.y)}${A.ui.star("player", r.p.uid)}</td></tr>`).join("") || `<tr><td colspan="12">${w.days.length < 2 ? A.ui.empty(t("inact.needHistory"), t("inact.needHistorySub")) : A.ui.empty(t("inact.none"), t("inact.noneSub"))}</td></tr>`;
      A.$("#in-more", root).innerHTML = rows.length > ts.limit ? `<button class="btn" id="in-more-b">${t("common.showMore", { n: rows.length - ts.limit })}</button>` : "";
      const all = A.$("#in-all", root);
      if (all) all.onchange = () => { shown.forEach((r) => (all.checked ? ts.sel.add(r.v.vid) : ts.sel.delete(r.v.vid))); render(); };
      fbBar(); selBar();
    };
    /* Ya en tus listas: chip en la fila (las marcas del asistente se quitan con un clic). */
    const listedChip = (v) => {
      const l = listed.get(A.fbKey(v)); if (!l) return "";
      if (l.src === "game") return ` <span class="chip fb-in" title="${A.esc(t("inact.inListGame", { l: l.list || "" }))}">${A.icon("farm")}${t("inact.inList")}</span>`;
      return ` <button class="chip fb-in ${l.src === "drop" ? "drop" : ""}" data-unmark="${A.fbKey(v)}" title="${A.esc(t("inact.unmark"))}">${l.src === "drop" ? A.icon("x") + t("inact.dropped") : A.icon("farm") + t("inact.inList")}</button>`;
    };
    /* Selección rápida, asistente y cuántos se ocultan por estar ya en tus listas. */
    const PICK = [10, 25, 50, 100];
    const fbBar = () => {
      const saved = A.fbSaved(), s = saved && A.fbStats(saved);
      const marks = Object.keys(A.fbMarks(A.state.sid)).length;
      const n = ts.sel.size || Math.min(25, rows.length);
      A.$("#in-fb", root).innerHTML = `
        <span class="lbl">${t("inact.pick")}</span><div class="seg sm" id="in-pick">${PICK.map((k) => `<button data-n="${k}" ${k > rows.length && k !== PICK[0] ? "disabled" : ""}>${k}</button>`).join("")}</div>
        ${hiddenListed ? `<button class="btn ghost sm" id="in-showListed" title="${A.esc(t("inact.hiddenTip"))}">${A.icon("farm")}${t("inact.hiddenListed", { n: hiddenListed })}</button>` : ""}
        <span style="flex:1"></span>
        ${saved ? `<button class="btn sm" id="in-fb-resume">${A.icon("clock")}${t("fb.resume", { d: s.n - s.pending, n: s.n })}</button>` : ""}
        <button class="btn sm primary" id="in-fb-go" ${rows.length ? "" : "disabled"}>${A.icon("farm")}${ts.sel.size ? t("fb.addSel", { n }) : t("fb.addTop", { n })}</button>`;
      A.$("#f-marks", root).innerHTML = marks ? `${t("inact.marks", { n: marks })} · <button type="button" class="linkish" id="f-forget">${t("inact.forget")}</button>` : "";
    };
    const selRows = () => rows.filter((r) => ts.sel.has(r.v.vid));
    const selBar = () => {
      const bar = A.$("#in-selbar", root), sel = selRows();
      bar.hidden = !sel.length;
      if (!sel.length) return;
      const pop = sel.reduce((a, r) => a + r.v.pop, 0), dist = sel.reduce((a, r) => a + r.dist, 0) / sel.length;
      const canOpen = !!A.gameUrl("tile", 0, 0);
      bar.innerHTML = `<b class="num">${t("inact.selN", { n: sel.length })}</b><span class="muted">${t("inact.selSum", { p: A.fmt(pop), d: A.fmt(dist, 1) })}</span>
        <span style="flex:1"></span>
        <button class="btn sm primary" data-sb="fb">${A.icon("farm")}${t("fb.addSel", { n: sel.length })}</button>
        ${canOpen ? `<button class="btn sm" data-sb="tabs" title="${A.esc(t("fb.tabsTip"))}">${A.icon("external")}${t("fb.tabs")}</button>` : ""}
        <button class="btn sm" data-sb="mark" title="${A.esc(t("inact.markTip"))}">${t("inact.mark")}</button>
        <button class="btn sm" data-sb="export">${A.icon("download")}${t("inact.export")}</button>
        <button class="btn sm ghost" data-sb="clear" aria-label="${A.esc(t("inact.clearSel"))}" title="${A.esc(t("inact.clearSel"))}">${A.icon("x")}</button>`;
    };
    const refreshListed = () => { listed = A.fbListed(); if (root.isConnected) render(); };
    const startFb = (list) => { if (list.length) A.farmBuilder(list, refreshListed); };
    const save = () => { A.saveFilters(f); render(); };
    const num = (id, k) => { const el = A.$("#f-" + id, root); el.oninput = A.debounce(() => { f[k] = +el.value || 0; const o = A.$(`#v-${id}`, root); if (o) o.textContent = el.value; save(); }, 80); };
    ["maxDist", "minDays", "minConf", "popMin", "popMax", "ts"].forEach((k) => num(k, k));
    ["noAlly", "slowing", "hideNew", "attacked", "natars", "hideListed"].forEach((k) => (A.$("#f-" + k, root).onchange = (e) => { f[k] = e.target.checked; save(); }));
    A.$("#f-exclude", root).oninput = A.debounce((e) => { f.exclude = e.target.value; save(); }, 200);
    A.$("#f-unit", root).onchange = (e) => { f.unit = +e.target.value; save(); };
    A.$("#f-art", root).onchange = (e) => { f.art = +e.target.value; save(); };
    A.$("#f-tribes", root).onclick = (e) => {
      const b = e.target.closest("button"); if (!b) return;
      const tid = +b.dataset.tid; const on = b.getAttribute("aria-pressed") !== "true";
      b.setAttribute("aria-pressed", on); f.tribes = on ? [...f.tribes, tid] : f.tribes.filter((x) => x !== tid); save();
    };
    A.$("#f-reset", root).onclick = () => { A.saveFilters({}); A.route(); };
    A.$("#in-group", root).onclick = (e) => { const b = e.target.closest("button"); if (!b) return; A.$$("#in-group button", root).forEach((x) => x.setAttribute("aria-pressed", x === b)); f.group = b.dataset.v; ts.sel.clear(); save(); };
    table.querySelector("tbody").onchange = (e) => { const c = e.target.closest("[data-sel]"); if (!c) return; const id = +c.dataset.sel; c.checked ? ts.sel.add(id) : ts.sel.delete(id); c.closest("tr").classList.toggle("sel", c.checked); fbBar(); selBar(); };
    A.$("#in-more", root).onclick = (e) => { if (e.target.closest("#in-more-b")) { ts.limit += 150; render(); } };
    A.$("#in-export", root).onclick = () => A.exportModal(ts.sel.size ? selRows() : rows);
    A.$("#in-fb", root).onclick = (e) => {
      const pk = e.target.closest("#in-pick button");
      if (pk) { ts.sel = new Set(rows.slice(0, +pk.dataset.n).map((r) => r.v.vid)); render(); return; }
      if (e.target.closest("#in-showListed")) { f.hideListed = false; A.$("#f-hideListed", root).checked = false; save(); return; }
      if (e.target.closest("#in-fb-resume")) { A.farmBuilder(null, refreshListed); return; }
      if (e.target.closest("#in-fb-go")) startFb(ts.sel.size ? selRows() : rows.slice(0, 25));
    };
    A.$("#in-selbar", root).onclick = (e) => {
      const b = e.target.closest("[data-sb]"); if (!b) return;
      const sel = selRows(), a = b.dataset.sb;
      if (a === "fb") startFb(sel);
      else if (a === "tabs") A.fbOpenTabs(sel.map((r) => r.v));
      else if (a === "export") A.exportModal(sel);
      else if (a === "mark") { A.fbSetMarks(A.state.sid, sel.map((r) => A.fbKey(r.v)), "a"); ts.sel.clear(); A.toast(t("inact.marked", { n: sel.length })); refreshListed(); }
      else if (a === "clear") { ts.sel.clear(); render(); }
    };
    root.addEventListener("click", (e) => {
      const um = e.target.closest("[data-unmark]");
      if (um) { A.fbSetMarks(A.state.sid, [um.dataset.unmark], null); A.toast(t("inact.unmarked", { c: um.dataset.unmark })); refreshListed(); return; }
      if (e.target.closest("#f-forget")) { A.store.set("fbMarks:" + A.state.sid, {}); refreshListed(); }
    });
    A.$("#in-map", root).onclick = () => { A.mapPreset = { mode: "inactive", ring: { ...home, r: f.maxDist }, targets: new Set(rows.map((r) => r.v.vid)) }; location.hash = "map"; };
    render();
    A.fbAutoResume(refreshListed);
  };
  const range = (id, label, min, max, val, unit) => `<div class="field"><label for="f-${id}">${A.esc(label)} <span class="range-val"><span id="v-${id}">${val}</span> ${A.esc(unit)}</span></label><input type="range" id="f-${id}" min="${min}" max="${max}" value="${val}"></div>`;

  /* Exportación de objetivos */
  A.exportModal = (rows) => {
    const fmts = {
      coords: () => rows.map((r) => `${r.v.x}|${r.v.y}`).join("\n"),
      csv: () => ["x,y,village,player,alliance,pop,days,confidence,distance,travel"].concat(rows.map((r) => [r.v.x, r.v.y, `"${r.v.name.replace(/"/g, '""')}"`, `"${r.p.name.replace(/"/g, '""')}"`, `"${(r.p.tag || "").replace(/"/g, '""')}"`, r.v.pop, r.p.streak, r.p.confidence, r.dist.toFixed(1), A.dur(r.time)].join(","))).join("\n"),
      discord: () => "```\n" + rows.slice(0, 40).map((r) => `${A.coord(r.v.x, r.v.y).padEnd(11)} ${String(r.v.pop).padStart(4)} pop  ${r.p.name.padEnd(16).slice(0, 16)} ${r.dist.toFixed(1).padStart(5)} · ${A.dur(r.time)}`).join("\n") + "\n```",
      bb: () => rows.map((r) => `[x|y]${r.v.x}|${r.v.y}[/x|y] ${r.v.pop} — ${r.p.name}`).join("\n"),
    };
    const m = A.modal(t("exp.title", { n: rows.length }), `
      <p class="muted" style="margin:0">${t("exp.hint")}</p>
      <div class="seg" id="exp-f">${Object.keys(fmts).map((k, i) => `<button aria-pressed="${i === 0}" data-v="${k}">${t("exp." + k)}</button>`).join("")}</div>
      <textarea class="input" id="exp-ta" readonly></textarea>`,
      `<button class="btn" data-close2>${t("common.close")}</button><button class="btn primary" id="exp-copy">${A.icon("copy")}${t("common.copy")}</button>`);
    const ta = m.querySelector("#exp-ta");
    let cur = "coords"; ta.value = fmts.coords();
    m.querySelector("#exp-f").onclick = (e) => { const b = e.target.closest("button"); if (!b) return; m.querySelectorAll("#exp-f button").forEach((x) => x.setAttribute("aria-pressed", x === b)); cur = b.dataset.v; ta.value = fmts[cur](); };
    m.querySelector("#exp-copy").onclick = () => A.copy(ta.value, t("toast.exported", { n: rows.length }));
    m.querySelector("[data-close2]").onclick = A.closeOverlays;
  };

  /* Definir aldea propia */
  A.homeModal = (done) => {
    const h = A.state.home || { x: 0, y: 0, tid: 1 };
    const m = A.modal(t("home.title"), `
      <p class="muted" style="margin:0">${t("home.hint")}</p>
      <div class="field"><label for="h-c">${t("home.coords")}</label><input class="input mono" id="h-c" value="${h.x}|${h.y}" placeholder="-12|45"></div>
      <div class="field"><label for="h-p">${t("home.orPlayer")}</label><input class="input" id="h-p" placeholder="${A.esc(t("home.playerPh"))}" list="h-pl"><datalist id="h-pl">${A.state.world.players.slice(0, 400).map((p) => `<option value="${A.esc(p.name)}">`).join("")}</datalist></div>
      <div class="field"><span class="lbl">${t("home.tribe")}</span><div class="tribe-toggles" id="h-t">${A.PLAYABLE.map((tid) => `<button type="button" data-tid="${tid}" aria-pressed="${h.tid === tid}"><i style="background:var(${A.TRIBES[tid].color})"></i>${A.esc(t("tribe." + A.TRIBES[tid].key))}</button>`).join("")}</div></div>`,
      `<button class="btn" data-close2>${t("common.cancel")}</button><button class="btn primary" id="h-save">${t("common.save")}</button>`);
    let tid = h.tid;
    m.querySelector("#h-t").onclick = (e) => { const b = e.target.closest("button"); if (!b) return; tid = +b.dataset.tid; m.querySelectorAll("#h-t button").forEach((x) => x.setAttribute("aria-pressed", x === b)); };
    m.querySelector("#h-p").oninput = (e) => {
      const p = A.state.world.players.find((p) => p.name.toLowerCase() === e.target.value.toLowerCase());
      if (p?.cap) { m.querySelector("#h-c").value = `${p.cap.x}|${p.cap.y}`; tid = p.tid; m.querySelectorAll("#h-t button").forEach((x) => x.setAttribute("aria-pressed", +x.dataset.tid === tid)); }
    };
    m.querySelector("[data-close2]").onclick = A.closeOverlays;
    m.querySelector("#h-save").onclick = () => {
      const c = A.parseCoord(m.querySelector("#h-c").value);
      if (!c) { A.toast(t("home.bad")); return; }
      A.state.home = { ...c, tid }; A.closeOverlays(); A.toast(t("home.saved", { c: A.coord(c.x, c.y) })); done?.();
    };
  };
})();
