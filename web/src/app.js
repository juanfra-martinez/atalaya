/* Shell de la aplicación: navegación, enrutado por #hash, paleta de comandos, perfiles y arranque. */
"use strict";
(() => {
  const A = window.A;
  const t = (...a) => A.t(...a);
  const NAV = [
    ["dashboard", "dashboard"], ["inactives", "target"], ["farms", "farm"], ["reports", "swords"], ["neighbours", "users"], ["land", "sprout"], ["map", "map"], ["events", "events"], ["rankings", "rank"], ["tools", "tools"], ["ops", "flag"], ["watch", "watch"],
  ];
  const START = "dashboard";

  A.shell = () => {
    document.body.innerHTML = `<div class="app">
      <aside class="side" id="side">
        <div class="brand">${A.logo()}<div><b>Atalaya</b><small>Travian Legends</small></div></div>
        <div><div class="nav-label">${t("nav.world")}</div><nav class="nav" id="nav">${NAV.map(([k, ic]) => `<a href="#${k}" data-k="${k}">${A.icon(ic)}<span>${t("nav." + k)}</span>${k === "watch" ? `<span class="count" id="nav-watch"></span>` : k === "inactives" ? `<span class="count" id="nav-inact"></span>` : ""}</a>`).join("")}</nav></div>
        <div><div class="nav-label">${t("nav.global")}</div><nav class="nav"><a href="#servers" data-k="servers">${A.icon("servers")}<span>${t("nav.servers")}</span><span class="count" id="nav-servers"></span></a></nav></div>
        <div class="side-foot"><span class="dot"></span>${A.DEMO ? t("foot.demo") : t("foot.live")}<br><span id="foot-upd"></span><br><span style="font-size:11px">${t("foot.disclaimer")} <a href="#privacy">${t("foot.privacy")}</a></span></div>
      </aside>
      <div class="side-scrim" id="side-scrim"></div>
      <div class="main">
        <header class="top">
          <button class="icon-btn menu-btn" id="menu" aria-label="${A.esc(t("nav.menu"))}">${A.icon("menu")}</button>
          <button class="world-pick" id="wp" title="${A.esc(t("nav.switchWorld"))}"><span class="badge-speed" id="wp-s">×1</span><span style="min-width:0"><b id="wp-n">—</b><span id="wp-h"></span></span></button>
          <button class="search-btn" id="sb">${A.icon("search").replace("<svg", '<svg width="16" height="16"')}<span>${t("pal.ph")}</span><kbd>Ctrl K</kbd></button>
          <div class="top-actions">
            <div class="seg lang" id="lang"><button data-l="es" aria-pressed="${A.lang === "es"}">ES</button><button data-l="en" aria-pressed="${A.lang === "en"}">EN</button></div>
            ${A.sync?.enabled ? `<button class="icon-btn acct" id="acct"></button>` : ""}
            <button class="icon-btn" id="theme" aria-label="${A.esc(t("nav.theme"))}"></button>
          </div>
        </header>
        <main class="view" id="view"><div class="view-inner" id="vi"></div></main>
      </div></div>`;
    A.$("#menu").onclick = () => { const o = A.$("#side").classList.toggle("open"); A.$("#menu").setAttribute("aria-expanded", o); };
    A.$("#side-scrim").onclick = () => A.$("#side").classList.remove("open");
    A.$("#wp").onclick = () => (location.hash = "servers");
    A.$("#sb").onclick = () => A.palette();
    A.$("#lang").onclick = (e) => { const b = e.target.closest("button"); if (!b) return; A.setLang(b.dataset.l); A.shell(); A.updateTop(); A.route(); };
    A.$("#theme").onclick = () => { const cur = A.theme(); A.setTheme(cur === "dark" ? "light" : "dark"); };
    A.paintThemeBtn();
    A.updateServerCount();
    if (A.$("#acct")) { A.$("#acct").onclick = () => A.sync.open(); A.sync.paint(); }
  };
  A.updateServerCount = () => { const el = A.$("#nav-servers"); if (el) el.textContent = A.state.servers.filter((s) => s.status === "active").length || ""; };
  A.theme = () => document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  A.setTheme = (th) => { document.documentElement.dataset.theme = th; A.store.set("theme", th); A.paintThemeBtn(); A.route(); };
  A.paintThemeBtn = () => { const b = A.$("#theme"); if (b) b.innerHTML = A.icon(A.theme() === "dark" ? "sun" : "moon"); };

  A.updateTop = () => {
    const s = A.state.world?.server; if (!s) return;
    A.$("#wp-s").textContent = "×" + s.speed; A.$("#wp-n").textContent = s.name; A.$("#wp-h").textContent = t("srv.day", { n: s.age ?? "?" }) + " · " + s.id;
    A.$("#foot-upd").textContent = t("foot.updated", { d: s.day ? A.dayLabel(s.day, { day: "numeric", month: "short", year: "numeric" }) : "—" });
    A.$("#nav-inact").textContent = A.compact(A.state.world.counts.inactive);
    A.$("#nav-watch").textContent = A.watchList().length || "";
  };
  A.on("watch", () => A.updateTop());

  A.selectWorld = async (sid) => {
    A.$("#vi").innerHTML = `<div class="empty"><b>${t("common.loading")}</b></div>`;
    try {
      await A.loadWorld(sid);
    } catch (err) {
      A.toast(`${t("err.world")} (${err.message})`);
      A.route();
      return false;
    }
    A.updateTop();
    return true;
  };

  let cleanup = null;
  A.route = () => {
    const k = (location.hash || "#" + START).slice(1).split("?")[0]; // lo que sigue a ? son datos de la vista
    const view = A.views[k] ? k : START;
    A.$$("#side .nav a").forEach((a) => (a.dataset.k === view ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
    A.$("#side").classList.remove("open");
    cleanup?.(); cleanup = null;
    const vi = A.$("#vi");
    vi.onclick = null;
    if (view !== "servers" && view !== "privacy" && !A.state.world) { location.hash = "servers"; return; }
    vi.innerHTML = "";
    if (A.DEMO) vi.insertAdjacentHTML("beforeend", `<div class="demo-ribbon rise">${A.icon("clock").replace("<svg", '<svg width="16" height="16"')}<span>${t("demo.ribbon")}</span></div>`);
    const holder = document.createElement("div"); holder.style.cssText = "display:flex;flex-direction:column;gap:20px"; vi.appendChild(holder);
    cleanup = A.views[view](holder) || null;
    A.$("#view").scrollTop = 0;
    document.title = `${view === "privacy" ? t("priv.title") : t("nav." + view)} · Atalaya`;
  };

  /* ---------- perfiles (panel lateral) ---------- */
  const drawer = A.drawer = (html) => {
    A.closeOverlays();
    const s = document.createElement("div"); s.className = "scrim"; s.onclick = A.closeOverlays;
    const d = document.createElement("aside"); d.className = "drawer"; d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true"); d.innerHTML = html;
    document.body.append(s, d);
    d.querySelector("[data-close]").onclick = A.closeOverlays;
    d.querySelector("[data-close]").focus();
    return d;
  };
  A.openPlayer = (uid, vid) => {
    const w = A.state.world, p = w.pById.get(+uid); if (!p) return;
    const vs = w.villagesOf(p.uid).slice().sort((a, b) => b.pop - a.pop);
    const ev = A.state.events.filter((e) => e.uid === p.uid || e.uid_prev === p.uid).slice(0, 30);
    const h = A.state.home;
    const d = drawer(`<div class="drawer-h"><div style="min-width:0;flex:1"><div class="muted" style="font-size:12px;letter-spacing:.1em;text-transform:uppercase">${t("common.player")}${p.rank ? ` · #${p.rank}` : ""}</div><h2>${A.esc(p.name)}</h2>
        <div class="meta">${A.ui.tribe(p.tid)} ${A.ui.ally(p.aid)} ${A.ui.pill(p.status)} <span class="chip mono">uid ${p.uid}</span></div></div>
        <button class="icon-btn" data-close aria-label="${A.esc(t("common.close"))}">${A.icon("x")}</button></div>
      <div class="drawer-b">
        <div class="stat-row"><div><b>${A.fmt(p.pop)}</b><span>${t("common.pop")}</span></div><div><b>${p.villages}</b><span>${t("common.villages")}</span></div><div><b class="${A.cls(p.d7)}">${A.signed(p.d7)}</b><span>${t("dash.d7")}</span></div><div><b>${p.growth > 0 ? "+" : ""}${A.fmt(p.growth, 0)}</b><span>${t("pl.perDay")}</span></div></div>
        ${p.status !== "natar" ? `<div class="explain"><b>${t("pl.inactTitle", { c: p.confidence })}</b><ul>${A.reasons(p).map((r) => `<li>${A.esc(r)}</li>`).join("")}</ul></div>` : ""}
        <div class="row" style="flex-wrap:wrap"><button class="btn sm" id="pl-watch">${A.icon("star")}${A.isWatched("player", p.uid) ? t("common.unwatch") : t("common.watch")}</button>
          <button class="btn sm" id="pl-alert">${A.icon("bell")}${t("pl.alert")}</button><button class="btn sm" id="pl-map">${A.icon("map")}${t("pl.onMap")}</button>
          <button class="btn sm" id="pl-copy">${A.icon("copy")}${t("pl.copyAll")}</button>${A.ui.game("player", p.uid, null, t("game.profile")).replace("btn ghost sm", "btn sm")}</div>
        <div><h3>${t("pl.history")}</h3><div id="pl-chart"></div></div>
        <div><h3>${t("pl.villages", { n: vs.length })}</h3><div class="table-wrap"><table class="t"><thead><tr><th>${t("inact.village")}</th><th></th><th class="r">${t("common.pop")}</th><th class="r">1d</th><th class="r">3d</th>${h ? `<th class="r">${t("inact.dist")}</th>` : ""}</tr></thead><tbody>
          ${vs.map((v) => `<tr class="${v.vid === +vid ? "sel" : ""}"><td>${A.ui.coord(v.x, v.y)}${A.ui.game("tile", v.x, v.y)}</td><td>${v.capital ? `<span class="chip">${t("pl.capital")}</span> ` : ""}${A.esc(v.name)}</td><td class="r">${A.fmt(v.pop)}</td><td class="r">${A.ui.delta(v.d1)}</td><td class="r">${A.ui.delta(v.d3)}</td>${h ? `<td class="r">${A.fmt(A.dist(h.x, h.y, v.x, v.y, w.R), 1)}</td>` : ""}</tr>`).join("")}</tbody></table></div></div>
        <div><h3>${t("pl.events")}</h3><div class="feed card">${A.eventRows(ev, { compact: true })}</div></div>
      </div>`);
    requestAnimationFrame(() => A.lineChart(d.querySelector("#pl-chart"), { labels: w.days.map((x) => A.dayLabel(x)), series: [{ name: t("common.pop"), values: p.popHist, color: "var(--accent)" }], height: 180 }));
    d.querySelector("#pl-watch").onclick = () => { A.toggleWatch("player", p.uid); A.openPlayer(uid, vid); };
    d.querySelector("#pl-alert").onclick = () => A.alertModal({ kind: "player_inactive", player: p.name });
    d.querySelector("#pl-map").onclick = () => { A.closeOverlays(); A.mapPreset = { targets: new Set(vs.map((v) => v.vid)), focus: p.cap ? { x: p.cap.x, y: p.cap.y } : null }; location.hash === "#map" ? A.route() : (location.hash = "map"); };
    d.querySelector("#pl-copy").onclick = () => A.copy(vs.map((v) => `${v.x}|${v.y}`).join("\n"));
  };
  A.openAlliance = (aid) => {
    const w = A.state.world, a = w.aById.get(+aid); if (!a) return;
    const members = w.players.filter((p) => p.aid === a.aid);
    const ev = A.state.events.filter((e) => e.aid === a.aid || e.aid_prev === a.aid);
    const gains = ev.filter((e) => e.type === "conquered" && e.aid === a.aid).length, losses = ev.filter((e) => (e.type === "conquered" && e.aid_prev === a.aid) || (e.type === "destroyed" && e.aid === a.aid)).length;
    const inact = members.filter((p) => p.status === "inactive").length;
    const color = A.PALETTE[(a.rank - 1) % A.PALETTE.length];
    const d = drawer(`<div class="drawer-h"><div style="flex:1;min-width:0"><div class="muted" style="font-size:12px;letter-spacing:.1em;text-transform:uppercase">${t("common.alliance")} · #${a.rank}</div><h2>${A.esc(a.tag)}</h2>
        <div class="meta"><span class="chip">${a.members} ${t("common.members").toLowerCase()}</span><span class="chip">${a.villages} ${t("common.villages").toLowerCase()}</span><span class="chip mono">aid ${a.aid}</span></div></div>
        <button class="icon-btn" data-close aria-label="${A.esc(t("common.close"))}">${A.icon("x")}</button></div>
      <div class="drawer-b">
        <div class="stat-row"><div><b>${A.compact(a.pop)}</b><span>${t("common.pop")}</span></div><div><b class="${A.cls(a.d7)}">${A.signed(a.d7)}</b><span>${t("dash.d7")}</span></div><div><b><i class="up">${gains}</i> / <i class="down">${losses}</i></b><span>${t("al.gl")}</span></div><div><b>${inact}</b><span>${t("al.inactive")}</span></div></div>
        <div class="row" style="flex-wrap:wrap"><button class="btn sm" id="al-watch">${A.icon("star")}${A.isWatched("alliance", a.aid) ? t("common.unwatch") : t("common.watch")}</button><button class="btn sm" id="al-alert">${A.icon("bell")}${t("al.alert")}</button><button class="btn sm" id="al-map">${A.icon("map")}${t("pl.onMap")}</button>${A.ui.game("alliance", a.aid, null, t("game.profile")).replace("btn ghost sm", "btn sm")}</div>
        <div class="grid g-2e" style="gap:14px"><div><h3>${t("pl.history")}</h3><div id="al-chart"></div></div><div><h3>${t("al.territory")}</h3><canvas class="mini-map" id="al-mini"></canvas></div></div>
        <div><h3>${t("al.members")}</h3><div class="table-wrap"><table class="t"><thead><tr><th>${t("common.player")}</th><th class="r">${t("common.villagesShort")}</th><th class="r">${t("common.pop")}</th><th class="r">${t("dash.d7")}</th><th>${t("common.status")}</th></tr></thead><tbody>
          ${members.map((p) => `<tr><td>${A.ui.tribe(p.tid, false)} ${A.ui.player(p)}</td><td class="r">${p.villages}</td><td class="r">${A.fmt(p.pop)}</td><td class="r">${A.ui.delta(p.d7)}</td><td>${A.ui.pill(p.status)}</td></tr>`).join("")}</tbody></table></div></div>
        <div><h3>${t("pl.events")}</h3><div class="feed card">${A.eventRows(ev.slice(0, 40), { compact: true })}</div></div>
      </div>`);
    requestAnimationFrame(() => {
      A.lineChart(d.querySelector("#al-chart"), { labels: w.days.map((x) => A.dayLabel(x)), series: [{ name: t("common.pop"), values: a.popHist, color }], height: 200 });
      A.drawMini(d.querySelector("#al-mini"), w, (v) => w.pById.get(v.uid)?.aid === a.aid, color);
    });
    d.querySelector("#al-watch").onclick = () => { A.toggleWatch("alliance", a.aid); A.openAlliance(aid); };
    d.querySelector("#al-alert").onclick = () => A.alertModal({ kind: "alliance_village_lost", ally: a.tag });
    d.querySelector("#al-map").onclick = () => { A.closeOverlays(); A.mapPreset = { aid: a.aid, mode: "alliance" }; location.hash === "#map" ? A.route() : (location.hash = "map"); };
  };

  /* ---------- paleta de comandos ---------- */
  A.palette = () => {
    const w = A.state.world;
    const m = A.modal("", `<input id="pal-q" placeholder="${A.esc(t("pal.ph"))}" aria-label="${A.esc(t("pal.ph"))}" autocomplete="off"><div class="palette-list" id="pal-l" role="listbox"></div><div class="pal-foot"><span><kbd>↑</kbd><kbd>↓</kbd> ${t("pal.nav")}</span><span><kbd>Enter</kbd> ${t("pal.open")}</span><span><kbd>Esc</kbd> ${t("common.close")}</span></div>`);
    m.classList.add("palette"); m.querySelector(".modal-h").remove(); m.querySelector(".modal-b").style.cssText = "padding:0;gap:0";
    const q = m.querySelector("#pal-q"), L = m.querySelector("#pal-l");
    let items = [], sel = 0;
    const pages = NAV.concat([["servers", "servers"]]).map(([k, ic]) => ({ k: t("pal.page"), label: t("nav." + k), icon: ic, run: () => (location.hash = k) }));
    const build = () => {
      const s = q.value.trim().toLowerCase();
      items = [];
      const c = A.parseCoord(s);
      if (c && w) {
        const v = w.vAt.get(c.x + "," + c.y);
        items.push({ k: t("pal.coord"), label: v ? `${A.coord(c.x, c.y)} · ${v.name}` : `${A.coord(c.x, c.y)} · ${t("pal.empty")}`, icon: "pin", run: () => (v ? A.openPlayer(v.uid, v.vid) : (A.mapPreset = { focus: c }, location.hash === "#map" ? A.route() : (location.hash = "map"))) });
      }
      if (s && w) {
        w.players.filter((p) => p.name.toLowerCase().includes(s)).slice(0, 7).forEach((p) => items.push({ k: t("common.player"), label: p.name, right: `${A.fmt(p.pop)} · ${p.tag || "—"}`, icon: "user", run: () => A.openPlayer(p.uid) }));
        w.alliances.filter((a) => a.tag.toLowerCase().includes(s)).slice(0, 4).forEach((a) => items.push({ k: t("common.alliance"), label: a.tag, right: `${a.members} · ${A.compact(a.pop)}`, icon: "shield", run: () => A.openAlliance(a.aid) }));
        let vn = 0; for (const v of w.villages) { if (vn >= 4) break; if (v.name.toLowerCase().includes(s) && v.name.length > 3) { vn++; items.push({ k: t("inact.village"), label: v.name, right: A.coord(v.x, v.y), icon: "pin", run: () => A.openPlayer(v.uid, v.vid) }); } }
        A.state.servers.filter((x) => (x.name + x.id).toLowerCase().includes(s)).slice(0, 3).forEach((x) => items.push({ k: t("pal.world"), label: x.name, right: x.id, icon: "servers", run: async () => { await A.selectWorld(x.id); location.hash = "dashboard"; A.route(); } }));
      }
      items.push(...pages.filter((p) => !s || p.label.toLowerCase().includes(s)));
      sel = Math.min(sel, items.length - 1);
      L.innerHTML = items.map((it, i) => `<div class="pal-item" role="option" data-i="${i}" aria-selected="${i === sel}">${A.icon(it.icon).replace("<svg", '<svg width="16" height="16"')}<span class="k">${A.esc(it.k)}</span><span>${A.esc(it.label)}</span>${it.right ? `<span class="r">${A.esc(it.right)}</span>` : ""}</div>`).join("") || A.ui.empty(t("common.noResults"));
    };
    const go = (i) => { const it = items[i]; if (!it) return; A.closeOverlays(); it.run(); };
    q.oninput = () => { sel = 0; build(); };
    q.onkeydown = (e) => {
      if (e.key === "ArrowDown") { sel = Math.min(items.length - 1, sel + 1); build(); e.preventDefault(); L.children[sel]?.scrollIntoView({ block: "nearest" }); }
      else if (e.key === "ArrowUp") { sel = Math.max(0, sel - 1); build(); e.preventDefault(); L.children[sel]?.scrollIntoView({ block: "nearest" }); }
      else if (e.key === "Enter") go(sel);
    };
    L.onclick = (e) => { const it = e.target.closest("[data-i]"); if (it) go(+it.dataset.i); };
    build(); q.focus();
  };

  /* ---------- delegación global ---------- */
  document.addEventListener("click", (e) => {
    const pl = e.target.closest("[data-player]"); if (pl) { A.openPlayer(pl.dataset.player); return; }
    const al = e.target.closest("[data-ally]"); if (al) { A.openAlliance(al.dataset.ally); return; }
    const cp = e.target.closest("[data-copy]"); if (cp) { A.copy(cp.dataset.copy, A.t("toast.coord", { c: cp.dataset.copy })); return; }
    const wt = e.target.closest("[data-watch]");
    if (wt) { const [type, id] = wt.dataset.watch.split(":"); A.toggleWatch(type, +id); const on = A.isWatched(type, +id); A.$$(`[data-watch="${wt.dataset.watch}"]`).forEach((b) => { b.setAttribute("aria-pressed", on); b.style.color = on ? "var(--accent)" : ""; }); return; }
    const go = e.target.closest("[data-go]"); if (go) { location.hash = go.dataset.go; }
  });
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); A.palette(); }
    else if (e.key === "Escape") { A.closeOverlays(); A.$("#side")?.classList.remove("open"); }
    else if (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); A.palette(); }
    else if (e.key === "Enter" && document.activeElement?.matches("[data-player],[data-ally]")) document.activeElement.click();
  });
  window.addEventListener("hashchange", () => A.route());
  let rz; window.addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => { if (/dashboard|events/.test(location.hash || "#dashboard")) A.route(); }, 250); });

  /* ---------- arranque ---------- */
  A.boot = async () => {
    const th = A.store.get("theme", null); if (th) document.documentElement.dataset.theme = th;
    A.sync?.boot();
    try {
      await A.loadServers();
    } catch (err) {
      document.body.innerHTML = `<div class="empty" style="padding:80px"><b>${A.t("err.api")}</b>${A.esc(err.message)}</div>`; return;
    }
    A.shell();
    /* Solo se abre un mundo que ya tenga datos; si aún no hay ninguno se muestra la lista de mundos. */
    const ready = A.state.servers.filter(A.hasData);
    const sid = ready.find((s) => s.id === A.state.sid)?.id || ready.slice().sort((a, b) => b.players - a.players)[0]?.id;
    if (location.hash === "#servers" || location.hash === "#privacy") {
      /* La lista de mundos no necesita un mundo cargado: se muestra ya y el mundo se carga detrás. */
      A.route();
      if (sid) A.loadWorld(sid).then(A.updateTop, () => {});
      return;
    }
    if (sid) await A.selectWorld(sid);
    A.route();
  };
})();
