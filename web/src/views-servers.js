/* Vista: mundos activos. Los filtros de arriba acotan a la vez indicadores, gráficos y lista. */
"use strict";
(() => {
  const A = window.A;
  const t = (...a) => A.t(...a);

  const SORTS = ["players", "growth", "growthPct", "population", "villages", "alliances", "popPerPlayer", "conquered7", "founded7", "age", "speed", "start", "name", "region"];
  const SPEED_COLOR = { a: "var(--sp-a)", b: "var(--sp-b)", c: "var(--sp-c)" };
  const small = (name) => A.icon(name).replace("<svg", '<svg width="13" height="13"');
  const pillOf = (s) => (s.status === "active" ? "active" : s.status === "upcoming" ? "new" : "gone");
  const statusPill = (s) => `<span class="pill ${pillOf(s)}">${t("srv.st." + s.status, {}, s.status)}</span>`;
  const regionName = (r) => A.esc(t("region." + r, {}, r));
  const worldsN = (n) => t(n === 1 ? "srv.count1" : "srv.count", { n: A.fmt(n) });
  /* Por qué un mundo no tiene datos: los próximos se descargan al abrir; los terminados, ya nunca. */
  const noData = (s) => t(s?.status === "ended" ? "srv.noDataEnded" : s?.status === "upcoming" ? "srv.noDataUpcoming" : "srv.noData");
  const openWorld = async (s) => {
    if (!A.hasData(s)) { A.toast(noData(s)); return; }
    A.closeOverlays();
    if (await A.selectWorld(s.id)) location.hash = "dashboard";
  };
  /* Texto de la fecha de apertura de un mundo próximo. */
  const startsIn = (s) => {
    const d = A.daysToStart(s);
    if (d == null) return t("srv.up.tbd");
    return d <= 0 ? t("srv.up.today") : d === 1 ? t("srv.up.tomorrow") : t("srv.up.in", { n: d });
  };
  const longDate = (iso) => A.dayLabel(iso, { day: "numeric", month: "short", year: "numeric" });

  /* ---------- panel lateral con las estadísticas de un mundo ---------- */
  A.openWorldStats = (s) => {
    const m = A.worldStats(s), data = A.hasData(s), tr = s.trend;
    const stat = (value, label, cls = "") => `<div><b class="${cls}">${value}</b><span>${A.esc(label)}</span></div>`;
    const site = !A.DEMO && /^[a-z0-9.-]+\.travian\.com$/i.test(s.id) ? `<a class="btn sm" href="https://${A.esc(s.id)}" target="_blank" rel="noopener noreferrer">${A.icon("external")}${t("srv.travian")}</a>` : "";
    const when = s.status === "upcoming" ? `${A.esc(startsIn(s))}${s.start ? ` (${A.esc(longDate(s.start))})` : ""}` : t("srv.day", { n: s.age ?? "?" });
    const hasTrend = data && tr?.days?.length > 1;
    const d = A.drawer(`<div class="drawer-h"><div style="min-width:0;flex:1"><h2>${A.esc(s.name)}</h2>
        <div class="meta"><span class="chip">×${s.speed}</span><span class="chip">${regionName(s.region)}</span>${statusPill(s)}<span class="muted" style="font-size:12.5px">${when}</span></div>
        <div class="muted mono" style="margin-top:6px;font-size:12px;word-break:break-all">${A.esc(s.id)}</div>${data ? `<div class="muted" style="font-size:12px">${t("srv.updated", { d: A.dayLabel(s.day) })}</div>` : ""}</div>
        <button class="icon-btn" data-close aria-label="${A.esc(t("common.close"))}">${A.icon("x")}</button></div>
      <div class="drawer-b">
        <div class="row" style="flex-wrap:wrap">${data ? `<button class="btn primary sm" id="ws-open">${A.icon("dashboard")}${t("srv.open")}</button>` : ""}${site}</div>
        ${data ? `<div class="stat-row">${stat(A.compact(s.players), t("common.players"))}${stat(A.compact(s.villages), t("common.villages"))}${stat(A.fmt(s.alliances), t("common.alliances"))}${stat(A.compact(s.population), t("srv.s.population"))}</div>
        <div class="stat-row">${stat(A.signed(m.d7.players), t("srv.t.d7"), A.cls(m.d7.players))}${stat(A.fmt(m.popPerPlayer), t("srv.t.popPer"))}${stat(A.fmt(m.villagesPerPlayer, 1), t("srv.t.vilPer"))}${stat(A.fmt(m.conquered7), t("srv.t.conq7"))}</div>` : `<div class="explain">${A.esc(s.status === "upcoming" ? t("srv.st.upcoming") + ": " + startsIn(s) : noData(s))}</div>`}
        ${data && !hasTrend ? `<div class="explain">${t("srv.noHistory")}</div>` : ""}
        ${s.info ? `<div><h3>${t("cal.title")}</h3>${A.calendarHtml(s)}</div>` : ""}
        ${hasTrend ? `<div><h3>${t("common.players")}</h3><div id="ws-players"></div></div><div><h3>${t("common.villages")}</h3><div id="ws-villages"></div></div><div><h3>${t("srv.s.population")}</h3><div id="ws-pop"></div></div>
          <div><h3>${t("srv.c.activity")}</h3><div id="ws-act"></div><div class="srv-legend" style="margin-top:8px">${[["conquered", "--bad"], ["destroyed", "--muted"], ["founded", "--good"]].map(([k, c]) => `<span><i style="background:var(${c})"></i>${t("ev.g." + k)}</span>`).join("")}</div></div>` : ""}
      </div>`);
    A.$("#ws-open", d)?.addEventListener("click", () => openWorld(s));
    if (!hasTrend) return;
    const labels = tr.days.map((x) => A.dayLabel(x));
    const line = (id, key, name, color) => A.lineChart(A.$(id, d), { labels, height: 150, series: [{ name, color, values: tr[key] }] });
    line("#ws-players", "players", t("common.players"), "var(--info)");
    line("#ws-villages", "villages", t("common.villages"), "var(--info)");
    line("#ws-pop", "population", t("common.pop"), "var(--info)");
    A.barChart(A.$("#ws-act", d), { labels, height: 150, stacks: [
      { name: t("ev.g.conquered"), color: "var(--bad)", values: tr.conquered },
      { name: t("ev.g.destroyed"), color: "var(--muted)", values: tr.destroyed },
      { name: t("ev.g.founded"), color: "var(--good)", values: tr.founded },
    ] });
  };

  /* ---------- vista ---------- */
  A.views.servers = (root) => {
    const prefs = A.store.get("srv:prefs", {});
    const st = {
      q: "", region: "", speed: "", status: "active",
      sort: SORTS.includes(prefs.sort) ? prefs.sort : "players",
      dir: prefs.dir === 1 ? 1 : -1,
      view: prefs.view || (window.innerWidth < 720 ? "cards" : "table"),
    };
    const save = () => A.store.set("srv:prefs", { sort: st.sort, dir: st.dir, view: st.view });
    const byId = (id) => A.state.servers.find((s) => s.id === id);
    /* `skip` deja fuera una dimensión: el gráfico que filtra por ella debe seguir mostrando las demás opciones. */
    const match = (s, skip) => (st.status === "all" || s.status === st.status)
      && (!st.q || (s.name + s.id).toLowerCase().includes(st.q))
      && (skip === "region" || !st.region || s.region === st.region)
      && (skip === "speed" || !st.speed || String(s.speed) === st.speed);

    let timer = null, drawn = null, lastWidth = 0;

    const paint = () => {
      const all = A.state.servers;
      const regions = [...new Set(all.map((s) => s.region).filter(Boolean))].sort();
      const speeds = [...new Set(all.map((s) => s.speed))].sort((a, b) => a - b);
      const nOf = (status) => all.filter((s) => s.status === status).length;
      const statuses = ["active", "upcoming", "ended"].filter((k) => k === "active" || nOf(k));
      if (st.status !== "all" && !statuses.includes(st.status)) st.status = "active";
      const seg = (id, label, items, cur) => `<div class="seg" id="${id}" role="group" aria-label="${A.esc(label)}">${items.map(([v, text]) => `<button aria-pressed="${cur === v}" data-v="${A.esc(v)}">${A.esc(text)}</button>`).join("")}</div>`;
      root.innerHTML = `<div class="srv-page">` + A.head(t("srv.title"), t("srv.sub", { n: nOf("active") }),
        `${seg("srv-view", t("srv.viewAs"), [["table", t("srv.v.table")], ["cards", t("srv.v.cards")]], st.view)}<button class="btn" id="srv-csv">${A.icon("download")}${t("srv.csv")}</button>`) +
        `<section class="srv-bar card" aria-label="${A.esc(t("srv.filters"))}">
          <input class="input srv-q" id="srv-q" type="search" placeholder="${A.esc(t("srv.search"))}" aria-label="${A.esc(t("srv.search"))}" value="${A.esc(st.q)}">
          <select class="input" id="srv-region" aria-label="${A.esc(t("srv.t.region"))}"><option value="">${t("srv.allRegions")}</option>${regions.map((r) => `<option value="${A.esc(r)}" ${st.region === r ? "selected" : ""}>${regionName(r)}</option>`).join("")}</select>
          ${seg("srv-status", t("common.status"), [...statuses.map((k) => [k, `${t("srv.st.plural." + k)} ${nOf(k)}`]), ["all", t("common.all")]], st.status)}
          ${seg("srv-speed", t("srv.speedFilter"), [["", t("common.all")], ...speeds.map((s) => [String(s), "×" + s])], st.speed)}
          <div class="srv-sort"><select class="input" id="srv-sort" aria-label="${A.esc(t("srv.sort"))}">${SORTS.map((k) => `<option value="${k}" ${st.sort === k ? "selected" : ""}>${t("srv.s." + k)}</option>`).join("")}</select>
            <button class="icon-btn" id="srv-dir"></button></div>
          <span class="muted srv-count" id="srv-count" role="status"></span>
        </section>
        <div class="muted" id="srv-progress" style="font-size:12.5px"></div>
        <section class="srv-kpis" id="srv-kpis" aria-label="${A.esc(t("srv.summary"))}"></section>
        <section class="srv-charts" id="srv-charts">
          <article class="card c-map"><div class="card-h"><h2>${t("srv.c.map")}</h2><span class="sub">${t("srv.c.mapSub")}</span><div class="right srv-legend">${["a", "b", "c"].map((c) => `<span><i class="round" style="background:${SPEED_COLOR[c]}"></i>${t("srv.sp." + c)}</span>`).join("")}</div></div><div class="card-b"><div id="srv-bubbles"></div></div></article>
          <article class="card c-high"><div class="card-h"><h2>${t("srv.c.high")}</h2></div><div class="srv-high" id="srv-high"></div></article>
          <article class="card c-act"><div class="card-h"><h2>${t("srv.c.activity")}</h2><span class="sub" id="srv-act-sub"></span></div><div class="card-b srv-act" id="srv-act">${["founded", "conquered", "destroyed"].map((k) => `<div><div class="srv-act-h"><span>${t("ev.g." + k)}</span><b id="srv-act-${k}"></b></div><div id="srv-col-${k}"></div></div>`).join("")}</div></article>
          <article class="card c-reg"><div class="card-h"><h2>${t("srv.c.region")}</h2><span class="sub">${t("srv.c.barsSub")}</span></div><div class="srv-bars" id="srv-reg"></div></article>
          <article class="card c-spd"><div class="card-h"><h2>${t("srv.c.speed")}</h2><span class="sub">${t("srv.c.barsSub")}</span></div><div class="srv-bars" id="srv-spd"></div></article>
          <article class="card c-age"><div class="card-h"><h2>${t("srv.c.age")}</h2><span class="sub">${t("srv.c.ageSub")}</span></div><div class="card-b"><div id="srv-age"></div></div></article>
        </section>
        <section class="card srv-up" id="srv-up" hidden></section>
        <section id="srv-list" aria-label="${A.esc(t("srv.list"))}"></section>
        <div class="card card-b muted" style="font-size:12.5px">${t("srv.how")}</div></div>`;
      bind();
      update();
      setSticky();
    };

    const kpi = (label, value, delta, spark = "") => `<div class="card skpi"><div class="label">${A.esc(label)}</div><div class="value">${A.esc(value)}</div><div class="foot"><span class="delta">${delta}</span>${spark}</div></div>`;
    const signedCompact = (n) => (n > 0 ? "+" : n < 0 ? "−" : "±") + A.compact(Math.abs(n));
    const inWeek = (n, title) => (n == null ? "&nbsp;" : `<span class="${A.cls(n)}">${signedCompact(n)}</span> <span class="muted">${A.esc(title)}</span>`);
    const paintKpis = (tot) => {
      const spark = (values, color) => (values.filter((v) => v != null).length > 1 ? A.spark(values, { color, w: 72, h: 26 }) : "");
      const prev = tot.conqueredPrev7 == null ? "&nbsp;" : `<span class="muted">${A.esc(t("srv.k.prev", { n: A.fmt(tot.conqueredPrev7) }))}</span>`;
      const ageNote = tot.avgAge == null ? "&nbsp;" : `<span class="muted">${A.esc(t("srv.k.avgAge", { n: A.fmt(tot.avgAge) }))}</span>`;
      const size = (n) => (tot.withData ? A.compact(n) : "—");
      A.$("#srv-kpis", root).innerHTML = [
        kpi(t("srv.k.worlds"), A.fmt(tot.worlds), ageNote),
        kpi(t("common.players"), size(tot.players), inWeek(tot.d7.players, t("srv.k.in7")), spark(tot.series.players, "var(--info)")),
        kpi(t("common.villages"), size(tot.villages), inWeek(tot.d7.villages, t("srv.k.in7")), spark(tot.series.villages, "var(--info)")),
        kpi(t("srv.s.population"), size(tot.population), inWeek(tot.d7.population, t("srv.k.in7")), spark(tot.series.population, "var(--info)")),
        kpi(t("srv.k.conq7"), A.fmt(tot.conquered7), prev, spark(tot.flows.conquered, "var(--bad)")),
        kpi(t("srv.k.found7"), A.fmt(tot.founded7), "&nbsp;", spark(tot.flows.founded, "var(--good)")),
      ].join("");
    };

    const bars = (host, groups, attr, cur, label) => {
      const max = Math.max(1, ...groups.map((g) => g.players));
      host.innerHTML = groups.map((g) => `<button class="srv-rb" ${attr}="${A.esc(g.key)}" aria-pressed="${String(g.key) === cur}"><span class="n" title="${A.esc(worldsN(g.worlds))}">${label(g.key)}<small>${A.fmt(g.worlds)}</small></span><span class="b"><i style="width:${(g.players / max) * 100}%"></i></span><span class="v">${A.esc(A.compact(g.players))}</span></button>`).join("");
    };

    const highlightValue = (h) => {
      const s = h.world, m = A.worldStats(s);
      return { players: A.compact(s.players), population: A.compact(s.population), growth: A.signed(m.d7.players), war: A.fmt(m.conquered7), young: t("srv.day", { n: s.age }) }[h.key];
    };

    /* Solo lo que depende del ancho: se repite al cambiar el tamaño sin tocar lo demás. */
    const drawCharts = () => {
      if (!drawn || A.$("#srv-charts", root).hidden) return;
      const { data, tot } = drawn;
      const box = A.$("#srv-bubbles", root), width = box.clientWidth;
      const top = new Set(data.slice().sort((a, b) => b.players - a.players).slice(0, width < 520 ? 1 : 3).map((s) => s.id));
      A.bubbles(box, {
        name: t("srv.c.mapAria", { n: data.length }), xLabel: t("srv.c.day"), yLabel: t("common.players"),
        height: width < 520 ? 280 : Math.round(Math.max(320, Math.min(380, width * 0.42))),
        points: data.filter((s) => s.age != null).map((s) => ({
          id: s.id, x: s.age, y: s.players, size: s.population, color: SPEED_COLOR[A.speedClass(s.speed)],
          current: s.id === A.state.sid, label: top.has(s.id) || s.id === A.state.sid ? s.name : "",
        })),
        describe: (p) => {
          const s = byId(p.id);
          return { title: s.name, rows: [[A.fmt(s.players), t("common.players")], [A.fmt(s.population), t("srv.s.population")], [A.fmt(s.age), t("srv.c.day")], ["×" + s.speed, t("srv.s.speed")]] };
        },
        onPick: (p) => A.openWorldStats(byId(p.id)),
      });
      const labels = tot.days.map((d) => A.dayLabel(d));
      const colors = { founded: "var(--good)", conquered: "var(--bad)", destroyed: "var(--muted)" };
      for (const k of Object.keys(colors)) A.columns(A.$(`#srv-col-${k}`, root), { labels, values: tot.flows[k], name: t("ev.g." + k), color: colors[k], height: 104 });
      A.columns(A.$("#srv-age", root), {
        labels: A.AGE_BANDS.map(([lo, hi]) => (hi === Infinity ? `>${A.fmt(lo - 1)}` : `${A.fmt(lo)}–${A.fmt(hi)}`)), values: A.ageHistogram(data),
        name: t("srv.c.age"), height: 128, showValues: true, showAllLabels: true,
      });
    };

    const paintCharts = (list, tot) => {
      const data = list.filter(A.hasData);
      drawn = { data, tot };
      const box = A.$("#srv-charts", root);
      box.hidden = !data.length;
      if (!data.length) return;
      const m = A.$("#srv-high", root), highs = A.worldHighlights(list);
      m.innerHTML = highs.map((h) => `<button class="srv-hl" data-stats="${A.esc(h.world.id)}"><span class="k">${t("srv.h." + h.key)}</span><span class="w">${A.esc(h.world.name)}</span><span class="v">${A.esc(highlightValue(h))}</span></button>`).join("");
      A.$("#srv-act-sub", root).textContent = tot.days.length > 1 ? t("srv.c.activitySub", { n: tot.days.length }) : "";
      for (const k of ["founded", "conquered", "destroyed"]) A.$(`#srv-act-${k}`, root).textContent = A.fmt(tot[k + "7"]) + " " + t("srv.c.in7");
      const scoped = (skip) => A.state.servers.filter((s) => match(s, skip) && A.hasData(s));
      bars(A.$("#srv-reg", root), A.worldGroups(scoped("region"), (s) => s.region), "data-region", st.region, regionName);
      bars(A.$("#srv-spd", root), A.worldGroups(scoped("speed"), (s) => s.speed), "data-speed", st.speed, (k) => "×" + A.esc(k));
      drawCharts();
    };

    const paintUpcoming = () => {
      const box = A.$("#srv-up", root);
      const list = A.sortWorlds(A.state.servers.filter((s) => s.status === "upcoming" && (!st.q || (s.name + s.id).toLowerCase().includes(st.q)) && (!st.region || s.region === st.region) && (!st.speed || String(s.speed) === st.speed)), "start", 1);
      box.hidden = !list.length || st.status === "upcoming";
      if (box.hidden) return;
      box.innerHTML = `<div class="card-h"><h2>${t("srv.c.up")}</h2><span class="sub">${A.esc(worldsN(list.length))}</span></div>
        <div class="srv-up-list">${list.map((s) => `<button class="srv-up-i" data-stats="${A.esc(s.id)}"><span class="srv-sp">×${s.speed}</span><span class="n"><b>${A.esc(s.name)}</b><span>${regionName(s.region)}</span></span><span class="when"><b>${A.esc(startsIn(s))}</b><span>${s.start ? A.esc(longDate(s.start)) : ""}</span></span></button>`).join("")}</div>`;
    };

    /* ---------- lista ---------- */
    const statsBtn = (s) => `<button class="btn ghost sm" data-stats="${A.esc(s.id)}" title="${A.esc(t("srv.stats", { n: s.name }))}" aria-label="${A.esc(t("srv.stats", { n: s.name }))}">${A.icon("dashboard")}</button>`;
    const card = (s) => {
      const ev = s.eventsToday || {}, data = A.hasData(s), m = A.worldStats(s);
      const num = (n) => (data ? A.compact(n) : "—");
      const ageLabel = s.status === "upcoming" ? t("srv.starts", { d: s.start ? longDate(s.start) : "?" }) : t("srv.day", { n: s.age ?? "?" });
      const trendRow = data && s.trend?.days?.length > 1 ? `<div class="srv-trend">${A.spark(s.trend.players, { color: "var(--info)", w: 120, h: 28 })}<span class="${A.cls(m.d7.players)}">${A.signed(m.d7.players)}</span><span class="muted">${t("srv.k.in7")}</span></div>` : "";
      return `<article class="card srv ${s.id === A.state.sid ? "current" : ""} ${data ? "" : "nodata"}" data-sid="${A.esc(s.id)}">
          <div class="srv-top"><div class="srv-speed">×${s.speed}<small>${t("srv.speed")}</small></div>
            <div style="min-width:0;flex:1"><h3><button class="srv-name" ${data ? "" : `title="${A.esc(noData(s))}"`}>${A.esc(s.name)}</button></h3><div class="host">${A.esc(s.id)}</div></div>
            <div class="srv-top-r">${statusPill(s)}${statsBtn(s)}</div></div>
          <div class="srv-stats"><div><b>${num(s.players)}</b><span>${t("common.players")}</span></div><div><b>${num(s.villages)}</b><span>${t("common.villages")}</span></div><div><b>${num(s.alliances)}</b><span>${t("common.alliances")}</span></div></div>
          ${trendRow}
          <div class="srv-age"><span>${ageLabel}</span><span class="track"><i style="width:${A.lifePct(s)}%"></i></span><span>${regionName(s.region)}</span></div>
          <div class="srv-foot">${data ? `<span>${small("swords")} ${A.fmt(ev.conquered || 0)} ${t("ev.short.conquered")}</span><span>${small("sprout")} ${A.fmt(ev.founded || 0)} ${t("ev.short.founded")}</span><span class="d">${t("srv.updated", { d: A.dayLabel(s.day) })}</span>` : `<span>${s.status === "active" ? t("srv.pending") : ""}</span>`}</div>
        </article>`;
    };

    /* `p` es la prioridad: cuanto más alta, antes desaparece la columna al estrecharse la tabla. Todo sigue en el panel del mundo. */
    const COLS = [
      { k: "name", label: "srv.t.world" }, { k: "region", label: "srv.t.region", p: 2 }, { k: "age", label: "srv.t.day", r: 1, p: 1 },
      { k: "players", label: "common.players", r: 1 }, { k: "growth", label: "srv.t.d7", r: 1 }, { label: "srv.t.trend", p: 2 },
      { k: "villages", label: "common.villages", r: 1, p: 2 }, { k: "alliances", label: "common.alliances", r: 1, p: 3 }, { k: "population", label: "common.pop", r: 1, p: 1 },
      { k: "popPerPlayer", label: "srv.t.popPer", r: 1, p: 4 }, { k: "conquered7", label: "srv.t.conq7", r: 1, p: 4 }, { k: "founded7", label: "srv.t.found7", r: 1, p: 4 },
      { label: "common.status", p: 3 }, { label: "" },
    ];
    const cellCls = (c) => `${c.r ? "r" : ""} ${c.p ? "p" + c.p : ""}`;
    const row = (s) => {
      const data = A.hasData(s), m = A.worldStats(s);
      const n = (v, d) => (data && v != null ? (d ? A.fmt(v, d) : A.fmt(v)) : "—");
      const cells = [
        `<div class="srv-cell"><span class="srv-sp sp-${A.speedClass(s.speed)}">×${s.speed}</span><span class="n"><button class="srv-name">${A.esc(s.name)}</button><span class="host">${A.esc(s.id)}</span></span></div>`,
        regionName(s.region), s.status === "upcoming" ? A.esc(startsIn(s)) : A.fmt(s.age), n(s.players),
        data ? A.ui.delta(m.d7.players) : "—",
        data && s.trend?.days?.length > 1 ? A.spark(s.trend.players, { color: "var(--info)", w: 84, h: 24 }) : "",
        n(s.villages), n(s.alliances), n(s.population), n(m.popPerPlayer), n(m.conquered7), n(m.founded7), statusPill(s), statsBtn(s),
      ];
      return `<tr class="${s.id === A.state.sid ? "sel" : ""} ${data ? "" : "nodata"}" data-sid="${A.esc(s.id)}">${cells.map((c, i) => `<td class="${cellCls(COLS[i])}">${c}</td>`).join("")}</tr>`;
    };
    const table = (list) => `<div class="card srv-tbl"><table class="t"><caption class="sr">${t("srv.list")}</caption><thead><tr>${COLS.map((c) => `<th class="${cellCls(c)}" scope="col" ${c.k && st.sort === c.k ? `aria-sort="${st.dir > 0 ? "ascending" : "descending"}"` : ""}>${c.k ? `<button class="srv-th" data-sort="${c.k}">${t(c.label)}</button>` : c.label ? t(c.label) : `<span class="sr">${t("srv.t.actions")}</span>`}</th>`).join("")}</tr></thead><tbody>${list.map(row).join("")}</tbody></table></div>`;

    const paintList = (list) => {
      const box = A.$("#srv-list", root), all = A.state.servers;
      if (!list.length) {
        box.innerHTML = all.length
          ? `<div class="card"><div class="empty"><b>${A.esc(t("srv.none"))}</b><button class="btn" id="srv-clear" style="margin-top:10px">${t("srv.clear")}</button></div></div>`
          : `<div class="card">${A.ui.empty(t("srv.waiting"), t("srv.waitingSub"))}</div>`;
        return;
      }
      box.innerHTML = st.view === "table" ? table(list) : `<div class="grid g-3">${list.map(card).join("")}</div>`;
    };
    const paintSort = () => {
      A.$("#srv-sort", root).value = st.sort;
      const b = A.$("#srv-dir", root), label = t(st.dir > 0 ? "srv.dir.asc" : "srv.dir.desc");
      b.innerHTML = A.icon(st.dir > 0 ? "arrowUp" : "arrowDown");
      b.title = label; b.setAttribute("aria-label", label);
    };

    const list = () => A.sortWorlds(A.state.servers.filter((s) => match(s)), st.sort, st.dir);
    const update = () => {
      const items = list();
      A.$("#srv-count", root).textContent = worldsN(items.length);
      const active = A.state.servers.filter((s) => s.status === "active"), ready = active.filter(A.hasData).length;
      A.$("#srv-progress", root).textContent = active.length && ready < active.length ? t("srv.progress", { n: ready, total: active.length }) : "";
      const tot = A.worldTotals(items);
      A.$("#srv-kpis", root).hidden = !A.state.servers.length;
      paintKpis(tot);
      paintCharts(items, tot);
      paintUpcoming();
      paintList(items);
      paintSort();
    };
    const setSort = (key) => {
      if (st.sort === key) st.dir *= -1;
      else { st.sort = key; st.dir = A.WORLD_SORTS[key].dir; }
      save(); paintList(list()); paintSort();
    };
    const pressed = (box, b) => A.$$("button", box).forEach((x) => x.setAttribute("aria-pressed", x === b));
    const clearFilters = () => { st.q = ""; st.region = ""; st.speed = ""; paint(); };

    const bind = () => {
      const page = A.$(".srv-page", root);
      A.$("#srv-q", root).oninput = (e) => { st.q = e.target.value.toLowerCase(); update(); };
      A.$("#srv-region", root).onchange = (e) => { st.region = e.target.value; update(); };
      A.$("#srv-sort", root).onchange = (e) => { st.sort = e.target.value; st.dir = A.WORLD_SORTS[st.sort].dir; save(); paintList(list()); paintSort(); };
      A.$("#srv-dir", root).onclick = () => { st.dir *= -1; save(); paintList(list()); paintSort(); };
      A.$("#srv-speed", root).onclick = (e) => { const b = e.target.closest("button"); if (!b) return; pressed(e.currentTarget, b); st.speed = b.dataset.v; update(); };
      A.$("#srv-status", root).onclick = (e) => { const b = e.target.closest("button"); if (!b) return; pressed(e.currentTarget, b); st.status = b.dataset.v; update(); };
      A.$("#srv-view", root).onclick = (e) => { const b = e.target.closest("button"); if (!b) return; pressed(e.currentTarget, b); st.view = b.dataset.v; save(); paintList(list()); };
      A.$("#srv-csv", root).onclick = () => {
        const url = URL.createObjectURL(new Blob(["﻿" + A.worldsCsv(list())], { type: "text/csv;charset=utf-8" }));
        const a = document.createElement("a"); a.href = url; a.download = "atalaya-mundos.csv"; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      };
      /* Un solo gestor para gráficos y lista: filtrar desde una barra, ver estadísticas, abrir el mundo. */
      page.onclick = (e) => {
        const reg = e.target.closest("[data-region]");
        if (reg) { st.region = st.region === reg.dataset.region ? "" : reg.dataset.region; A.$("#srv-region", root).value = st.region; update(); return; }
        const spd = e.target.closest("[data-speed]");
        if (spd) { st.speed = st.speed === spd.dataset.speed ? "" : spd.dataset.speed; A.$$("#srv-speed button", root).forEach((x) => x.setAttribute("aria-pressed", x.dataset.v === st.speed)); update(); return; }
        const sort = e.target.closest("[data-sort]");
        if (sort) { setSort(sort.dataset.sort); return; }
        if (e.target.closest("#srv-clear")) { clearFilters(); return; }
        const stats = e.target.closest("[data-stats]");
        if (stats) { A.openWorldStats(byId(stats.dataset.stats)); return; }
        const open = e.target.closest("[data-sid]");
        if (open) openWorld(byId(open.dataset.sid));
      };
    };

    /* La cabecera de la tabla se engancha justo debajo de la barra de filtros, si esta también va fija. */
    const setSticky = () => {
      const bar = A.$(".srv-bar", root); if (!bar) return;
      const cs = getComputedStyle(bar);
      root.style.setProperty("--srv-stick", cs.position === "sticky" ? parseFloat(cs.top) + bar.offsetHeight + "px" : "0px");
    };
    const onResize = A.debounce(() => {
      const w = root.clientWidth;
      if (w === lastWidth) return;
      lastWidth = w; setSticky(); drawCharts();
    }, 120);
    const observer = new ResizeObserver(onResize);

    /* Mientras el recolector trabaja (primer arranque o mundos sin descargar), refresca la lista sola. */
    const pending = () => !A.state.servers.length || A.state.servers.some((s) => s.status === "active" && !A.hasData(s));
    const signature = () => JSON.stringify(A.state.servers.map((s) => [s.id, s.day, s.status, s.players]));
    const refresh = async () => {
      const before = signature();
      try { await A.loadServers(); } catch { return; }
      A.updateServerCount?.();
      if (signature() !== before) {
        const focused = document.activeElement?.id;
        paint();
        if (focused === "srv-q") { const q = A.$("#srv-q", root); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
      }
      if (!pending()) { clearInterval(timer); timer = null; }
    };

    paint();
    lastWidth = root.clientWidth;
    observer.observe(root);
    refresh();
    timer = setInterval(refresh, A.STATIC ? 300000 : 20000); // la versión publicada cambia como mucho cada hora
    return () => { clearInterval(timer); observer.disconnect(); };
  };
})();
