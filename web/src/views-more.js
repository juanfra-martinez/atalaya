/* Vistas: mapa, eventos, clasificación, herramientas y vigilancia. */
"use strict";
(() => {
  const A = window.A;
  const t = (...a) => A.t(...a);

  /* ---------- filas de eventos (compartido) ---------- */
  const EV_ICON = { conquered: ["swords", "conquered"], destroyed: ["skull", "destroyed"], founded: ["sprout", "founded"], alliance_join: ["flag", "alliance"], alliance_leave: ["flag", "alliance"], alliance_switch: ["flag", "alliance"], alliance_new: ["shield", "alliance"], alliance_gone: ["shield", "destroyed"], player_gone: ["user", "destroyed"], player_renamed: ["user", "player"], player_new: ["user", "player"] };
  A.EV_GROUPS = { conquered: ["conquered"], destroyed: ["destroyed"], founded: ["founded"], alliance: ["alliance_join", "alliance_leave", "alliance_switch", "alliance_new", "alliance_gone"], players: ["player_gone", "player_renamed"] };
  const pname = (uid, fallback) => { const p = A.state.world.pById.get(uid); return p ? A.ui.player(p) : `<span class="muted">${A.esc(fallback || "#" + uid)}</span>`; };
  A.eventText = (e) => {
    const c = e.x != null ? A.ui.coord(e.x, e.y) : "";
    switch (e.type) {
      case "conquered": return t("ev.conquered", { who: pname(e.uid, e.name), from: pname(e.uid_prev, e.name_prev), c, ally: e.aid_prev ? A.ui.ally(e.aid_prev) : "" });
      case "destroyed": return t("ev.destroyed", { c, who: pname(e.uid, e.name) });
      case "founded": return t("ev.founded", { who: pname(e.uid), c });
      case "alliance_join": return t("ev.join", { who: pname(e.uid), a: A.ui.ally(e.aid) });
      case "alliance_leave": return t("ev.leave", { who: pname(e.uid), a: A.ui.ally(e.aid_prev) });
      case "alliance_switch": return t("ev.switch", { who: pname(e.uid), a: A.ui.ally(e.aid_prev), b: A.ui.ally(e.aid) });
      case "alliance_new": return t("ev.allyNew", { a: A.ui.ally(e.aid) });
      case "alliance_gone": return t("ev.allyGone", { a: `#${e.aid}` });
      case "player_gone": return t("ev.gone", { who: `<b>${A.esc(e.detail || "#" + e.uid)}</b>` });
      case "player_renamed": return t("ev.renamed", { d: A.esc(e.detail || "") });
      default: return A.esc(e.type);
    }
  };
  A.eventRows = (list, { compact = false } = {}) => {
    if (!list.length) return A.ui.empty(t("ev.none"));
    let out = "", day = null;
    for (const e of list) {
      if (!compact && e.day !== day) { day = e.day; out += `<div class="feed-day">${A.esc(A.dayLabel(e.day, { weekday: "long", day: "numeric", month: "long" }))}</div>`; }
      const [ic, cl] = EV_ICON[e.type] || ["events", "player"];
      out += `<div class="ev"><span class="ev-ico ${cl}">${A.icon(ic)}</span><span class="ev-text">${A.eventText(e)}</span><span class="ev-meta">${e.pop ? A.fmt(e.pop) + " pop" : compact ? A.dayLabel(e.day) : ""}</span></div>`;
    }
    return out;
  };

  /* ================= MAPA ================= */
  A.views.map = (root) => {
    const w = A.state.world;
    const preset = A.mapPreset; A.mapPreset = null;
    const st = { mode: preset?.mode || A.store.get("mapMode", "alliance"), q: "" };
    root.innerHTML = A.head(t("map.title"), t("map.sub", { size: `${2 * w.R + 1}×${2 * w.R + 1}` })) +
      `<div class="card map-wrap"><canvas id="mp-c" aria-label="${A.esc(t("map.title"))}"></canvas>
        <div class="map-panel">
          <div class="field"><span class="lbl">${t("map.colorBy")}</span><select class="input" id="mp-mode">${["alliance", "tribe", "inactive", "pop"].map((m) => `<option value="${m}" ${st.mode === m ? "selected" : ""}>${t("map.mode." + m)}</option>`).join("")}</select></div>
          <div class="field"><label for="mp-q">${t("map.highlight")}</label><input class="input" id="mp-q" placeholder="${A.esc(t("map.highlightPh"))}"></div>
          <div class="map-legend" id="mp-leg"></div>
        </div>
        <div class="map-coords" id="mp-xy">(0|0)</div>
        <div class="map-tip" id="mp-tip"></div>
        <div class="map-zoom"><button class="icon-btn" id="mp-in" aria-label="zoom +">${A.icon("plus")}</button><button class="icon-btn" id="mp-out" aria-label="zoom −"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 12h14"/></svg></button><button class="icon-btn" id="mp-fit" aria-label="${A.esc(t("map.fit"))}">${A.icon("expand")}</button>${A.state.home ? `<button class="icon-btn" id="mp-home" aria-label="${A.esc(t("map.home"))}">${A.icon("home")}</button>` : ""}</div>
      </div>`;
    const tip = A.$("#mp-tip", root), xy = A.$("#mp-xy", root);
    const map = new A.WorldMap(A.$("#mp-c", root), {
      mode: st.mode,
      onHover: (v, x, y, px, py) => {
        if (x != null) xy.textContent = A.coord(x, y) + (A.state.home ? ` · ${A.fmt(A.dist(A.state.home.x, A.state.home.y, x, y, w.R), 1)} ${t("common.fields")}` : "");
        if (!v) { tip.style.display = "none"; return; }
        const p = w.pById.get(v.uid);
        tip.innerHTML = `<b>${A.esc(v.name)}</b> <span class="mono muted">${A.coord(v.x, v.y)}</span><br>${A.ui.tribe(v.tid, false)} ${A.esc(p?.name || "?")} ${p?.tag ? `· <b>${A.esc(p.tag)}</b>` : ""}<br>
          <span class="muted">${t("common.pop")}</span> ${A.fmt(v.pop)} ${v.d3 != null ? `<span class="${A.cls(v.d3)}">(${A.signed(v.d3)} 3d)</span>` : ""} ${p && p.status !== "active" ? A.ui.pill(p.status) : ""}`;
        tip.style.display = "block";
        const W = root.querySelector(".map-wrap").clientWidth;
        tip.style.left = Math.min(px + 16, W - 230) + "px"; tip.style.top = py + 16 + "px";
      },
      onClick: (v) => v && A.openPlayer(v.uid, v.vid),
    });
    map.setWorld(w);
    if (preset?.ring) { map.ring = preset.ring; map.centerOn(preset.ring.x, preset.ring.y, Math.min(14, 260 / preset.ring.r)); }
    if (preset?.targets) map.highlight = (v) => preset.targets.has(v.vid);
    if (preset?.focus) { map.focus = preset.focus; map.centerOn(preset.focus.x, preset.focus.y, 10); }
    if (preset?.aid) map.highlight = (v) => w.pById.get(v.uid)?.aid === preset.aid;
    const legend = () => {
      const L = A.$("#mp-leg", root);
      if (st.mode === "alliance") L.innerHTML = w.alliances.slice(0, A.PALETTE.length).map((a, i) => `<div><i style="background:${A.PALETTE[i]}"></i><span class="tag" data-ally="${a.aid}">${A.esc(a.tag)}</span><span>${A.compact(a.pop)}</span></div>`).join("") + `<div><i style="background:var(--muted)"></i><span>${t("map.otherAlly")}</span></div><div><i style="background:var(--line)"></i><span>${t("map.noAlly")}</span></div>`;
      else if (st.mode === "tribe") L.innerHTML = [...A.PLAYABLE, 5].map((tid) => `<div><i style="background:var(${A.TRIBES[tid].color})"></i><span>${A.esc(t("tribe." + A.TRIBES[tid].key))}</span><span>${w.players.filter((p) => p.tid === tid).length}</span></div>`).join("");
      else if (st.mode === "inactive") L.innerHTML = ["active", "slowing", "inactive", "new", "unknown"].filter((s) => s !== "unknown" || w.counts.unknown).map((s) => `<div><i style="background:var(${{ active: "--good", slowing: "--warn", inactive: "--bad", new: "--info", unknown: "--muted" }[s]})"></i><span>${t("status." + s)}</span><span>${w.counts[s]}</span></div>`).join("");
      else L.innerHTML = `<div><i style="background:hsl(42,55%,30%)"></i><span>${t("map.small")}</span></div><div><i style="background:hsl(4,85%,62%)"></i><span>${t("map.big")}</span></div>`;
    };
    legend();
    A.$("#mp-mode", root).onchange = (e) => { st.mode = map.mode = e.target.value; A.store.set("mapMode", st.mode); legend(); map.draw(); };
    A.$("#mp-q", root).oninput = A.debounce((e) => {
      const q = e.target.value.trim().toLowerCase();
      const c = A.parseCoord(q);
      if (!q) { map.highlight = preset?.targets ? (v) => preset.targets.has(v.vid) : null; map.focus = null; map.draw(); return; }
      if (c) { map.focus = c; map.highlight = null; map.centerOn(c.x, c.y, Math.max(map.s, 8)); return; }
      const a = w.alliances.find((a) => a.tag.toLowerCase() === q);
      map.highlight = a ? (v) => w.pById.get(v.uid)?.aid === a.aid : (v) => (w.pById.get(v.uid)?.name || "").toLowerCase().includes(q) || v.name.toLowerCase().includes(q);
      map.draw();
    }, 160);
    A.$("#mp-in", root).onclick = () => map.zoomAt(map.c.clientWidth / 2, map.c.clientHeight / 2, 1.5);
    A.$("#mp-out", root).onclick = () => map.zoomAt(map.c.clientWidth / 2, map.c.clientHeight / 2, 1 / 1.5);
    A.$("#mp-fit", root).onclick = () => { map._whole = !map._whole; map.fit(map._whole); };
    A.$("#mp-home", root) && (A.$("#mp-home", root).onclick = () => map.centerOn(A.state.home.x, A.state.home.y, 10));
    return () => map.destroy();
  };

  /* ================= EVENTOS ================= */
  A.views.events = (root) => {
    const w = A.state.world;
    const st = { g: new Set(["conquered", "destroyed", "founded", "alliance"]), q: "", limit: 120 };
    const days = w.days.slice(-14);
    root.innerHTML = A.head(t("ev.title"), t("ev.sub")) +
      `<div class="card"><div class="card-h"><h2>${t("ev.perDay")}</h2><span class="sub">${t("ev.perDaySub")}</span></div><div class="card-b"><div id="ev-chart"></div></div></div>
       <div class="card"><div class="card-h"><h2>${t("war.title")}</h2><span class="sub">${t("war.sub")}</span></div><div class="table-wrap card-b" id="ev-war"></div></div>
       <div class="card"><div class="card-h"><div class="filters-inline" id="ev-g">${Object.keys(A.EV_GROUPS).map((g) => `<button aria-pressed="${st.g.has(g)}" data-g="${g}">${t("ev.g." + g)}</button>`).join("")}</div>
         <span class="right"><input class="input" id="ev-q" placeholder="${A.esc(t("ev.search"))}" style="width:240px"></span></div>
         <div class="feed" id="ev-feed" style="margin-top:6px"></div><div class="row" style="justify-content:center;padding:12px" id="ev-more"></div></div>`;
    const colors = { conquered: "var(--bad)", destroyed: "var(--muted)", founded: "var(--good)", alliance: "var(--info)" };
    requestAnimationFrame(() => A.barChart(A.$("#ev-chart", root), {
      labels: days.map((d) => A.dayLabel(d)),
      stacks: ["conquered", "destroyed", "founded", "alliance"].map((g) => ({ name: t("ev.g." + g), color: colors[g], values: days.map((d) => A.state.events.filter((e) => e.day === d && A.EV_GROUPS[g].includes(e.type)).length) })),
    }));
    const war = A.conflicts(A.state.events);
    const side = (aid) => (aid ? A.ui.ally(aid) : `<span class="muted">${t("map.noAlly")}</span>`);
    A.$("#ev-war", root).innerHTML = war.pairs.length ? `<table class="t"><thead><tr><th>${t("war.winner")}</th><th></th><th>${t("war.loser")}</th><th class="r">${t("common.villages")}</th><th class="r">${t("common.pop")}</th><th class="r" title="${A.esc(t("war.backTip"))}">${t("war.back")}</th><th class="r">${t("war.last")}</th></tr></thead><tbody>
      ${war.pairs.slice(0, 12).map((p) => `<tr><td>${side(p.a)}</td><td class="muted">→</td><td>${side(p.b)}</td><td class="r"><b class="num">${p.n}</b></td><td class="r num">${A.fmt(p.pop)}</td><td class="r num">${p.back || "—"}</td><td class="r muted">${A.esc(A.dayLabel(p.last))}</td></tr>`).join("")}</tbody></table>
      ${war.internal ? `<div class="muted" style="font-size:12.5px;margin-top:8px">${t("war.internal", { n: war.internal })}</div>` : ""}` : A.ui.empty(t("war.none"), w.days.length < 2 ? t("nb.eventsWait") : "");
    const render = () => {
      const types = new Set([...st.g].flatMap((g) => A.EV_GROUPS[g]));
      const q = st.q;
      const list = A.state.events.filter((e) => types.has(e.type) && (!q || [e.uid, e.uid_prev].some((u) => (w.pById.get(u)?.name || "").toLowerCase().includes(q)) || [e.aid, e.aid_prev].some((a) => (w.aById.get(a)?.tag || "").toLowerCase() === q) || (e.x != null && `${e.x}|${e.y}` === q)));
      A.$("#ev-feed", root).innerHTML = A.eventRows(list.slice(0, st.limit));
      A.$("#ev-more", root).innerHTML = list.length > st.limit ? `<button class="btn" id="ev-mb">${t("common.showMore", { n: list.length - st.limit })}</button>` : "";
    };
    A.$("#ev-g", root).onclick = (e) => { const b = e.target.closest("button"); if (!b) return; const g = b.dataset.g; st.g.has(g) ? st.g.delete(g) : st.g.add(g); b.setAttribute("aria-pressed", st.g.has(g)); render(); };
    A.$("#ev-q", root).oninput = A.debounce((e) => { st.q = e.target.value.trim().toLowerCase(); render(); }, 150);
    A.$("#ev-more", root).onclick = (e) => { if (e.target.closest("#ev-mb")) { st.limit += 150; render(); } };
    render();
  };

  /* ================= CLASIFICACIÓN ================= */
  A.views.rankings = (root) => {
    const w = A.state.world;
    const st = { tab: "players", q: "", sort: "pop", dir: -1, limit: 100, tribe: 0 };
    root.innerHTML = A.head(t("rk.title"), t("rk.sub")) +
      `<div class="card"><div class="card-h"><div class="seg" id="rk-tab"><button aria-pressed="true" data-v="players">${t("common.players")}</button><button aria-pressed="false" data-v="alliances">${t("common.alliances")}</button><button aria-pressed="false" data-v="tribes">${t("common.tribes")}</button></div>
        <select class="input" id="rk-tribe" style="width:auto">${[0, ...A.PLAYABLE].map((tid) => `<option value="${tid}">${tid ? A.esc(t("tribe." + A.TRIBES[tid].key)) : t("common.allTribes")}</option>`).join("")}</select>
        <span class="right"><input class="input" id="rk-q" placeholder="${A.esc(t("rk.search"))}" style="width:240px"></span></div>
        <div class="table-wrap card-b" style="max-height:calc(100vh - 250px);overflow:auto"><table class="t" id="rk-t"><thead></thead><tbody></tbody></table></div>
        <div class="row" style="justify-content:center;padding:0 0 14px" id="rk-more"></div></div>`;
    const table = A.$("#rk-t", root);
    const render = () => {
      A.$("#rk-tribe", root).style.display = st.tab === "players" ? "" : "none";
      A.$("#rk-q", root).style.display = st.tab === "tribes" ? "none" : "";
      let rows, cols;
      if (st.tab === "tribes") {
        rows = A.tribeStats(w);
        cols = [{ k: "tribe", label: t("common.tribe"), sort: (r) => t("tribe." + A.TRIBES[r.tid].key) }, { k: "players", label: t("common.players"), cls: "r", sort: (r) => r.players }, { k: "share", label: t("rk.share"), cls: "r", sort: (r) => r.share },
          { k: "villages", label: t("common.villages"), cls: "r", sort: (r) => r.villages }, { k: "pop", label: t("common.pop"), cls: "r", sort: (r) => r.pop }, { k: "avgPop", label: t("rk.avg"), cls: "r", sort: (r) => r.avgPop },
          { k: "avgVillages", label: t("rk.avgVil"), cls: "r", sort: (r) => r.avgVillages }, { k: "d7", label: t("dash.d7"), cls: "r", sort: (r) => r.d7 ?? -1e9 }];
        A.ui.sortable(table, rows, cols, st, render);
        table.querySelector("tbody").innerHTML = rows.map((r) => `<tr><td>${A.ui.tribe(r.tid)}</td><td class="r">${A.fmt(r.players)}</td><td class="r">${A.fmt(r.share, 1)} %</td><td class="r">${A.fmt(r.villages)}</td><td class="r">${A.fmt(r.pop)}</td><td class="r">${A.fmt(r.avgPop)}</td><td class="r">${A.fmt(r.avgVillages, 1)}</td><td class="r">${A.ui.delta(r.d7)}</td></tr>`).join("");
      } else if (st.tab === "players") {
        rows = w.players.filter((p) => p.status !== "natar" && (!st.tribe || p.tid === st.tribe) && (!st.q || p.name.toLowerCase().includes(st.q) || (p.tag || "").toLowerCase().includes(st.q)));
        cols = [{ k: "rank", label: "#", sort: (p) => -p.pop }, { k: "name", label: t("common.player"), sort: (p) => p.name.toLowerCase() }, { k: "ally", label: t("common.alliance"), sort: (p) => p.tag }, { k: "tribe", label: t("common.tribe"), sort: (p) => p.tid },
          { k: "villages", label: t("common.villagesShort"), cls: "r", sort: (p) => p.villages }, { k: "pop", label: t("common.pop"), cls: "r", sort: (p) => p.pop }, { k: "d1", label: t("rk.d1"), cls: "r", sort: (p) => p.d1 ?? -1e9 }, { k: "d7", label: t("dash.d7"), cls: "r", sort: (p) => p.d7 ?? -1e9 },
          { k: "status", label: t("common.status"), sort: (p) => p.confidence }, { k: "hist", label: t("rk.trend") }, { k: "w", label: "" }];
        A.ui.sortable(table, rows, cols, st, render);
        table.querySelector("tbody").innerHTML = rows.slice(0, st.limit).map((p) => `<tr><td class="rank">${p.rank}</td><td>${A.ui.player(p)}</td><td>${A.ui.ally(p.aid)}</td><td>${A.ui.tribe(p.tid)}</td><td class="r">${p.villages}</td><td class="r">${A.fmt(p.pop)}</td><td class="r">${A.ui.delta(p.d1)}</td><td class="r">${A.ui.delta(p.d7)}</td><td>${A.ui.pill(p.status)}</td><td>${A.spark(p.popHist, { w: 90, h: 22 })}</td><td>${A.ui.star("player", p.uid)}</td></tr>`).join("");
      } else {
        rows = w.alliances.filter((a) => !st.q || a.tag.toLowerCase().includes(st.q));
        cols = [{ k: "rank", label: "#", sort: (a) => -a.pop }, { k: "tag", label: t("common.alliance"), sort: (a) => a.tag.toLowerCase() }, { k: "members", label: t("common.members"), cls: "r", sort: (a) => a.members }, { k: "villages", label: t("common.villagesShort"), cls: "r", sort: (a) => a.villages },
          { k: "pop", label: t("common.pop"), cls: "r", sort: (a) => a.pop }, { k: "avg", label: t("rk.avg"), cls: "r", sort: (a) => a.pop / a.members }, { k: "d1", label: t("rk.d1"), cls: "r", sort: (a) => a.d1 ?? -1e9 }, { k: "d7", label: t("dash.d7"), cls: "r", sort: (a) => a.d7 ?? -1e9 }, { k: "hist", label: t("rk.trend") }, { k: "w", label: "" }];
        A.ui.sortable(table, rows, cols, st, render);
        table.querySelector("tbody").innerHTML = rows.slice(0, st.limit).map((a) => `<tr><td class="rank">${a.rank}</td><td>${A.ui.ally(a.aid)}</td><td class="r">${a.members}</td><td class="r">${a.villages}</td><td class="r">${A.fmt(a.pop)}</td><td class="r">${A.fmt(a.pop / a.members)}</td><td class="r">${A.ui.delta(a.d1)}</td><td class="r">${A.ui.delta(a.d7)}</td><td>${A.spark(a.popHist, { w: 90, h: 22, color: "var(--info)" })}</td><td>${A.ui.star("alliance", a.aid)}</td></tr>`).join("");
      }
      if (!rows.length) table.querySelector("tbody").innerHTML = `<tr><td colspan="11">${A.ui.empty(t("common.noResults"))}</td></tr>`;
      A.$("#rk-more", root).innerHTML = rows.length > st.limit ? `<button class="btn" id="rk-mb">${t("common.showMore", { n: rows.length - st.limit })}</button>` : "";
    };
    A.$("#rk-tab", root).onclick = (e) => { const b = e.target.closest("button"); if (!b) return; A.$$("#rk-tab button", root).forEach((x) => x.setAttribute("aria-pressed", x === b)); st.tab = b.dataset.v; st.sort = "pop"; st.dir = -1; st.limit = 100; render(); };
    A.$("#rk-q", root).oninput = A.debounce((e) => { st.q = e.target.value.trim().toLowerCase(); render(); }, 150);
    A.$("#rk-tribe", root).onchange = (e) => { st.tribe = +e.target.value; render(); };
    A.$("#rk-more", root).onclick = (e) => { if (e.target.closest("#rk-mb")) { st.limit += 150; render(); } };
    render();
  };

  /* ================= HERRAMIENTAS ================= */
  A.views.tools = (root) => {
    const w = A.state.world, h = A.state.home || { x: 0, y: 0, tid: 1 };
    const st = { from: `${h.x}|${h.y}`, to: "", tid: h.tid || 1, ts: A.filters().ts || 0, art: 1, speed: A.troopSpeed(w.server.speed), mode: "send", at: "" };
    const now = new Date(); now.setMinutes(now.getMinutes() + 90, 0, 0);
    const pad = (n) => String(n).padStart(2, "0");
    st.at = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const sections = [["tool-travel", "clock", t("tools.travel")], ["tool-incoming", "swords", t("inc.title")], ["tool-army", "shield", t("army.title")], ["tool-culture", "flag", t("cp.title")], ["tool-notes", "events", t("tools.notes")]];
    root.innerHTML = A.head(t("tools.title"), t("tools.sub")) +
      `<nav class="tool-nav rise" id="tool-nav" aria-label="${A.esc(t("tools.title"))}">${sections.map(([id, ic, label], i) => `<button type="button" data-target="${id}" ${i === 0 ? 'aria-current="true"' : ""}>${A.icon(ic)}<span>${A.esc(label)}</span></button>`).join("")}</nav>
      <div class="tools-grid">
        <section class="card tool" id="tool-travel"><div class="card-h"><h2>${t("tools.travel")}</h2><span class="sub" id="tl-dist"></span></div>
          <div class="card-b">
            <div class="fgrid">
              <div class="field"><label for="tl-from">${t("tools.from")}</label><input class="input mono" id="tl-from" value="${st.from}"></div>
              <div class="field"><label for="tl-to">${t("tools.to")}</label><input class="input mono" id="tl-to" placeholder="(25|-40) · ${A.esc(t("tools.toPh"))}" list="tl-pl"><datalist id="tl-pl">${w.players.slice(0, 300).map((p) => `<option value="${A.esc(p.name)}">`).join("")}</datalist></div>
            </div>
            <div class="fgrid cols-4">
              <div class="field"><label for="tl-tid">${t("common.tribe")}</label><select class="input" id="tl-tid">${A.PLAYABLE.map((tid) => `<option value="${tid}" ${tid === st.tid ? "selected" : ""}>${A.esc(t("tribe." + A.TRIBES[tid].key))}</option>`).join("")}</select></div>
              <div class="field"><label for="tl-ts">${t("inact.ts")}</label><input class="input num" type="number" min="0" max="20" id="tl-ts" value="${st.ts}"></div>
              <div class="field"><label for="tl-art">${t("inact.art")}</label><select class="input" id="tl-art">${[1, 1.5, 2, 3].map((x) => `<option value="${x}">×${x}</option>`).join("")}</select></div>
              <div class="field"><label for="tl-speed">${t("tools.speed")}</label><input class="input num" type="number" min="1" max="10" id="tl-speed" value="${st.speed}"></div>
            </div>
            <div class="tool-mode">
              <div class="seg full" id="tl-mode"><button aria-pressed="true" data-v="send">${t("tools.sendNow")}</button><button aria-pressed="false" data-v="land">${t("tools.landAt")}</button></div>
              <div class="field" id="tl-at-f" hidden><label for="tl-at">${t("tools.arrival")}</label><input class="input mono" type="datetime-local" step="1" id="tl-at" value="${st.at}"></div>
            </div>
            <div class="unit-grid" id="tl-units"></div>
          </div></section>
        <section class="card tool" id="tool-incoming"></section>
        <section class="card tool wide" id="tool-army"></section>
        <section class="card tool wide" id="tool-culture"></section>
        <section class="card tool wide" id="tool-notes"><div class="card-h"><h2>${t("tools.notes")}</h2></div><div class="card-b notes-grid">
          <div class="explain">${t("tools.noteTs")}</div><div class="explain">${t("tools.noteTorus", { size: 2 * w.R + 1 })}</div><div class="explain">${t("tools.noteSpeed")}</div>
          <div class="explain">${t("inc.noteHow")}</div><div class="explain">${t("inc.noteTime")}</div><div class="explain">${t("inc.noteFake")}</div></div></section>
      </div>`;
    A.mountIncoming(A.$("#tool-incoming", root));
    A.mountArmy(A.$("#tool-army", root));
    A.mountCulture(A.$("#tool-culture", root));
    /* Barra de herramientas: salta a la sección y marca la que está a la vista. */
    const nav = A.$("#tool-nav", root), scroller = A.$("#view");
    const mark = (id) => A.$$("button", nav).forEach((b) => (b.dataset.target === id ? b.setAttribute("aria-current", "true") : b.removeAttribute("aria-current")));
    nav.onclick = (e) => {
      const b = e.target.closest("button"); if (!b) return;
      mark(b.dataset.target);
      A.$("#" + b.dataset.target, root).scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    };
    let spy = null;
    if ("IntersectionObserver" in window) {
      spy = new IntersectionObserver((es) => { const hit = es.filter((x) => x.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]; if (hit) mark(hit.target.id); }, { root: scroller, rootMargin: "-70px 0px -60% 0px" });
      A.$$(".tool", root).forEach((el) => spy.observe(el));
    }
    const resolve = (s) => { const c = A.parseCoord(s); if (c) return c; const p = w.players.find((p) => p.name.toLowerCase() === String(s).trim().toLowerCase()); return p?.cap ? { x: p.cap.x, y: p.cap.y } : null; };
    const render = () => {
      const a = resolve(A.$("#tl-from", root).value), b = resolve(A.$("#tl-to", root).value);
      const box = A.$("#tl-units", root);
      if (!a || !b) { A.$("#tl-dist", root).textContent = ""; box.innerHTML = `<div class="muted">${t("tools.enter")}</div>`; return; }
      const d = A.dist(a.x, a.y, b.x, b.y, w.R);
      A.$("#tl-dist", root).textContent = `${A.coord(a.x, a.y)} → ${A.coord(b.x, b.y)} · ${A.fmt(d, 2)} ${t("common.fields")}`;
      const land = st.mode === "land" ? new Date(A.$("#tl-at", root).value) : null;
      box.innerHTML = A.UNITS[st.tid].map((u, i) => {
        const sec = A.travel(d, u[2], { serverSpeed: st.speed, ts: st.ts, artifact: st.art });
        const when = land ? new Date(land - sec * 1000) : new Date(Date.now() + sec * 1000);
        const late = land && when < new Date();
        return `<div class="unit"><b>${A.esc(A.unitName(st.tid, i))}</b><span class="tt">${A.dur(sec)}</span><span class="arr ${late ? "down" : ""}">${land ? t("tools.sendAt") : t("tools.arrives")} ${when.toLocaleString(A.locale(), { weekday: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" })}${late ? " · " + t("tools.late") : ""}</span></div>`;
      }).join("");
    };
    ["tl-from", "tl-to", "tl-at"].forEach((id) => (A.$("#" + id, root).oninput = A.debounce(render, 120)));
    A.$("#tl-tid", root).onchange = (e) => { st.tid = +e.target.value; render(); };
    A.$("#tl-ts", root).oninput = (e) => { st.ts = +e.target.value || 0; render(); };
    A.$("#tl-art", root).onchange = (e) => { st.art = +e.target.value; render(); };
    A.$("#tl-speed", root).oninput = (e) => { st.speed = +e.target.value || 1; render(); };
    A.$("#tl-mode", root).onclick = (e) => { const b = e.target.closest("button"); if (!b) return; A.$$("#tl-mode button", root).forEach((x) => x.setAttribute("aria-pressed", x === b)); st.mode = b.dataset.v; A.$("#tl-at-f", root).hidden = st.mode !== "land"; render(); };
    const top = A.findTargets(A.filters())[0];
    if (top) A.$("#tl-to", root).value = `${top.v.x}|${top.v.y}`;
    render();
    const iv = setInterval(() => st.mode === "send" && render(), 1000);
    return () => { clearInterval(iv); spy?.disconnect(); };
  };

  /* ================= VIGILANCIA ================= */
  A.views.watch = (root) => {
    const w = A.state.world;
    const list = A.watchList();
    const ids = new Set(list.filter((x) => x.type === "player").map((x) => x.id));
    const aids = new Set(list.filter((x) => x.type === "alliance").map((x) => x.id));
    const rel = A.state.events.filter((e) => ids.has(e.uid) || ids.has(e.uid_prev) || aids.has(e.aid) || aids.has(e.aid_prev));
    const rules = A.store.get("rules:" + A.state.sid, []);
    root.innerHTML = A.head(t("watch.title"), t("watch.sub")) +
      `<div class="grid g-2">
        <div class="card"><div class="card-h"><h2>${t("watch.list")}</h2><span class="sub">${t("watch.count", { n: list.length })}</span></div>
          <div style="margin-top:10px">${list.length ? list.map((it) => watchRow(w, it)).join("") : `<div class="card-b">${A.ui.empty(t("watch.empty"), t("watch.emptySub"))}</div>`}</div></div>
        <div class="card"><div class="card-h"><h2>${t("watch.alerts")}</h2><span class="right"><button class="btn sm primary" id="wa-new">${A.icon("bell")}${t("watch.newAlert")}</button></span></div>
          <div class="card-b" style="display:flex;flex-direction:column;gap:10px">
            ${A.DEMO ? `<div class="demo-ribbon">${t("watch.demoNote")}</div>` : ""}
            ${A.STATIC ? `<div class="demo-ribbon">${t("watch.staticNote")}</div>${rules.length ? `<div><button class="btn sm" id="wa-copy">${A.icon("copy")}${t("watch.copyRules")}</button></div>` : ""}` : ""}
            ${rules.length ? rules.map((r, i) => `<div class="row" style="justify-content:space-between;border:1px solid var(--line);border-radius:9px;padding:9px 12px"><div><b>${A.esc(r.label || t("alert." + r.kind))}</b><div class="muted" style="font-size:12px">${A.esc(t("alert." + r.kind))} · ${A.esc(JSON.stringify(r.params))}</div></div><button class="btn ghost sm" data-del-rule="${i}" aria-label="${A.esc(t("common.delete"))}">${A.icon("trash")}</button></div>`).join("") : `<p class="muted" style="margin:0">${t("watch.noAlerts")}</p>`}
          </div></div>
      </div>
      <div class="card"><div class="card-h"><h2>${t("watch.activity")}</h2><span class="sub">${t("watch.activitySub")}</span></div><div class="feed" style="margin-top:6px">${A.eventRows(rel.slice(0, 80))}</div></div>`;
    root.onclick = (e) => {
      const d = e.target.closest("[data-del-rule]");
      if (d) { const r = A.store.get("rules:" + A.state.sid, []); const [gone] = r.splice(+d.dataset.delRule, 1); A.store.set("rules:" + A.state.sid, r); if (!A.LOCAL && gone?.id) A.api.send("DELETE", `/alerts/${gone.id}`).catch(() => {}); A.route(); }
      const un = e.target.closest("[data-unwatch]");
      if (un) { const [type, id] = un.dataset.unwatch.split(":"); A.toggleWatch(type, isNaN(+id) ? id : +id); A.route(); }
    };
    A.$("#wa-new", root).onclick = () => A.alertModal();
    const cp = A.$("#wa-copy", root);
    if (cp) cp.onclick = () => {
      // Todas las reglas guardadas en este navegador, de todos los mundos, en el formato de ATALAYA_ALERT_RULES.
      const all = [];
      for (const s of A.state.servers) for (const r of A.store.get("rules:" + s.id, [])) if (r.webhook_url) all.push({ server_id: s.id, kind: r.kind, params: r.params, webhook_url: r.webhook_url, label: r.label });
      A.copy(JSON.stringify(all, null, 1), t("watch.copied"));
    };
  };
  const watchRow = (w, it) => {
    if (it.type === "player") {
      const p = w.pById.get(it.id);
      if (!p) return `<div class="watch-item"><span class="muted">#${it.id} · ${t("watch.goneP")}</span><span></span><button class="btn ghost sm" data-unwatch="player:${it.id}">${A.icon("x")}</button></div>`;
      return `<div class="watch-item"><div style="min-width:0">${A.ui.tribe(p.tid, false)} ${A.ui.player(p)} <span class="muted">${p.tag ? "· " + A.esc(p.tag) : ""}</span><div class="muted" style="font-size:12px">${A.fmt(p.pop)} pop · ${p.villages} ${t("common.villagesShort").toLowerCase()} · 7d ${A.signed(p.d7)}</div></div><span>${A.ui.pill(p.status)}</span><button class="btn ghost sm" data-unwatch="player:${p.uid}" aria-label="${A.esc(t("common.delete"))}">${A.icon("x")}</button></div>`;
    }
    const a = w.aById.get(it.id);
    if (!a) return "";
    return `<div class="watch-item"><div>${A.icon("shield").replace("<svg", '<svg width="14" height="14"')} ${A.ui.ally(a.aid)}<div class="muted" style="font-size:12px">${a.members} ${t("common.members").toLowerCase()} · ${A.fmt(a.pop)} pop · 7d ${A.signed(a.d7)}</div></div><span>${A.spark(a.popHist, { w: 70, h: 20, color: "var(--info)" })}</span><button class="btn ghost sm" data-unwatch="alliance:${a.aid}">${A.icon("x")}</button></div>`;
  };

  A.alertModal = (preset = {}) => {
    const w = A.state.world;
    const kinds = ["player_inactive", "area_conquest", "area_new_village", "player_alliance_change", "alliance_village_lost"];
    const m = A.modal(t("watch.newAlert"), `
      <div class="field"><label for="al-k">${t("alert.kind")}</label><select class="input" id="al-k">${kinds.map((k) => `<option value="${k}" ${preset.kind === k ? "selected" : ""}>${A.esc(t("alert." + k))}</option>`).join("")}</select></div>
      <div id="al-p"></div>
      <div class="field"><label for="al-h">${t("alert.webhook")}</label><input class="input mono" id="al-h" placeholder="https://discord.com/api/webhooks/…" value="${A.esc(A.store.get("webhook", ""))}"><span class="muted" style="font-size:12px">${t("alert.webhookHint")}</span></div>
      <div class="field"><label for="al-l">${t("alert.label")}</label><input class="input" id="al-l" placeholder="${A.esc(t("alert.labelPh"))}"></div>`,
      `<button class="btn" data-close2>${t("common.cancel")}</button><button class="btn primary" id="al-save">${A.icon("bell")}${t("alert.create")}</button>`);
    const pbox = m.querySelector("#al-p");
    const h = A.state.home || { x: 0, y: 0 };
    const params = () => {
      const k = m.querySelector("#al-k").value;
      if (k.startsWith("player_")) pbox.innerHTML = `<div class="field"><label for="al-pl">${t("common.player")}</label><input class="input" id="al-pl" list="al-pls" value="${A.esc(preset.player || "")}"><datalist id="al-pls">${w.players.slice(0, 500).map((p) => `<option value="${A.esc(p.name)}">`).join("")}</datalist></div>` + (k === "player_inactive" ? `<div class="field"><label for="al-d">${t("inact.minDays")}</label><input class="input num" type="number" id="al-d" value="3" min="1" max="14"></div>` : "");
      else if (k.startsWith("area_")) pbox.innerHTML = `<div class="row"><div class="field" style="flex:1"><label for="al-c">${t("home.coords")}</label><input class="input mono" id="al-c" value="${h.x}|${h.y}"></div><div class="field" style="flex:1"><label for="al-r">${t("alert.radius")}</label><input class="input num" type="number" id="al-r" value="15" min="1" max="100"></div></div>`;
      else pbox.innerHTML = `<div class="field"><label for="al-a">${t("common.alliance")}</label><input class="input" id="al-a" list="al-as" value="${A.esc(preset.ally || "")}"><datalist id="al-as">${w.alliances.map((a) => `<option value="${A.esc(a.tag)}">`).join("")}</datalist></div>`;
    };
    params();
    m.querySelector("#al-k").onchange = params;
    m.querySelector("[data-close2]").onclick = A.closeOverlays;
    m.querySelector("#al-save").onclick = async () => {
      const k = m.querySelector("#al-k").value, p = {};
      if (k.startsWith("player_")) { const pl = w.players.find((x) => x.name.toLowerCase() === m.querySelector("#al-pl").value.trim().toLowerCase()); if (!pl) return A.toast(t("alert.badPlayer")); p.uid = pl.uid; p.name = pl.name; if (k === "player_inactive") p.min_days = +m.querySelector("#al-d").value || 3; }
      else if (k.startsWith("area_")) { const c = A.parseCoord(m.querySelector("#al-c").value); if (!c) return A.toast(t("home.bad")); Object.assign(p, c, { radius: +m.querySelector("#al-r").value || 15 }); }
      else { const a = w.alliances.find((x) => x.tag.toLowerCase() === m.querySelector("#al-a").value.trim().toLowerCase()); if (!a) return A.toast(t("alert.badAlly")); p.aid = a.aid; p.tag = a.tag; }
      const hook = m.querySelector("#al-h").value.trim();
      if (!/^https:\/\/(discord|discordapp)\.com\/api\/webhooks\/\d+\/[\w-]+$/.test(hook)) return A.toast(t("alert.badHook"));
      A.store.set("webhook", hook);
      const rule = { kind: k, params: p, label: m.querySelector("#al-l").value.trim() || null };
      if (A.STATIC) rule.webhook_url = hook; // para copiarla a ATALAYA_ALERT_RULES
      if (!A.LOCAL) {
        try { const r = await A.api.send("POST", "/alerts", { server_id: A.state.sid, webhook_url: hook, ...rule }); rule.id = r.id; }
        catch (err) { return A.toast(t("alert.error", { e: err.message })); }
      }
      const rules = A.store.get("rules:" + A.state.sid, []); rules.push(rule); A.store.set("rules:" + A.state.sid, rules);
      A.closeOverlays(); A.toast(t("alert.created")); if (location.hash === "#watch") A.route();
    };
  };
})();
