/* Vistas de planificación: calendario del mundo, terreno (croppers y oasis) y calculadora de ejército. */
"use strict";
(() => {
  const A = window.A;
  const t = (...a) => A.t(...a);
  const small = (ic) => A.icon(ic).replace("<svg", '<svg width="14" height="14"');

  /* ================= CALENDARIO DEL MUNDO ================= */

  /* Hitos de un mundo según su /api/v1/info: inicio, artefactos y planos de construcción. Las fechas van en
     segundos UTC. Devuelve [] si el mundo aún no tiene esos datos. */
  A.worldMilestones = (s, now = Date.now()) => {
    const i = s?.info; if (!i) return [];
    const start = s.start ? Date.parse(s.start + "T00:00:00Z") / 1000 : null;
    return [["start", start], ["artefacts", i.artefacts], ["plans", i.plans]].filter(([, ts]) => ts).map(([k, ts]) => ({ k, ts, days: Math.ceil((ts * 1000 - now) / 864e5) }));
  };
  const relDays = (d) => (d > 0 ? t("cal.in", { n: d }) : d === 0 ? t("cal.today") : t("cal.ago", { n: -d }));
  const calDate = (ts) => new Date(ts * 1000).toLocaleDateString(A.locale(), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  A.calendarHtml = (s) => {
    const ms = A.worldMilestones(s), i = s?.info;
    if (!i) return "";
    const first = ms[0]?.ts, last = ms[ms.length - 1]?.ts, now = Date.now() / 1000;
    const pct = (ts) => (last > first ? Math.max(0, Math.min(100, ((ts - first) / (last - first)) * 100)) : 0);
    const next = ms.find((m) => m.k !== "start" && m.days >= 0);
    const tribes = (i.tribes || []).filter((tid) => A.PLAYABLE.includes(tid));
    return `<div class="cal">
        <div class="cal-ms">${ms.map((m) => `<div class="${m === next ? "next" : m.days < 0 ? "past" : ""}"><span>${A.esc(t("cal." + m.k))}</span><b>${A.esc(m.k === "start" ? t("srv.day", { n: s.age ?? "?" }) : relDays(m.days))}</b><i>${A.esc(calDate(m.ts))}</i></div>`).join("")}
          ${i.wwLevel ? `<div class="next"><span>${A.esc(t("cal.ww"))}</span><b>${A.esc(t("cal.wwLevel", { n: i.wwLevel }))}</b><i>&nbsp;</i></div>` : ""}</div>
        ${ms.length > 1 ? `<div class="cal-track" aria-hidden="true"><span style="width:${pct(now).toFixed(1)}%"></span>${ms.map((m) => `<i style="left:${pct(m.ts).toFixed(1)}%" class="${m.days < 0 ? "past" : ""}"></i>`).join("")}</div>` : ""}
        <div class="cal-rules">${tribes.map((tid) => A.ui.tribe(tid)).join("")}${(i.features || []).map((f) => `<span class="chip" title="${A.esc(t("cal.f." + f + ".tip", {}, ""))}">${A.esc(t("cal.f." + f, {}, f))}</span>`).join("")}</div>
      </div>`;
  };

  /* ================= TERRENO: CROPPERS Y OASIS ================= */

  const landKey = () => "land:" + A.state.sid;
  A.land = () => A.store.get(landKey(), null);
  /* En la demo no hay juego del que copiar el mapa: se inventa una zona de 31×31 con proporciones parecidas a las
     de un mundo real (lo comprobado en International 7: 2 % de 15c y de 9c, un 10 % de oasis). */
  const demoLand = (w, c) => {
    let seed = (c.x * 73856093) ^ (c.y * 19349663) ^ 0x9e3779b9;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) | 0; return ((seed >>> 0) % 100000) / 100000; };
    const tiles = [];
    const types = [1, 6, 2, 3, 3, 4, 5, 7, 8, 9, 10, 11, 12, 3, 4, 5, 10, 11, 12, 3, 4, 5, 2, 7, 8, 9, 10, 11, 12, 3, 4, 5, 2, 7, 8, 9, 10, 11, 12, 3];
    for (let dx = -15; dx <= 15; dx++) for (let dy = -15; dy <= 15; dy++) {
      const x = c.x + dx, y = c.y + dy, r = rnd();
      if (w.vAt.has(x + "," + y) || Math.abs(x) > w.R || Math.abs(y) > w.R) continue;
      if (r < 0.58) tiles.push({ position: { x, y }, title: `{k.vt} {k.f${types[Math.floor(rnd() * types.length)]}}`, text: "" });
      else if (r < 0.69) {
        const k = Math.floor(rnd() * 8), b = [[1], [2], [3], [4], [1, 4], [2, 4], [3, 4], [4, 4]][k];
        const bonus = k === 7 ? "<br />{a:r4} {a.r4} 50%" : b.map((n) => `<br />{a:r${n}} {a.r${n}} 25%`).join("");
        const animals = rnd() < 0.6 ? [31, 32, 35, 36, 37, 39].filter(() => rnd() < 0.4).map((id) => `<i class="unit u${id}"></i><span class="value ">${1 + Math.floor(rnd() * 9)}</span>`).join("") : "";
        const cap = 15 * (2 + Math.floor(rnd() * 6)), got = rnd() < 0.6 ? cap : Math.floor(cap * rnd());
        const ri = rnd() < 0.85 ? 1 : 2;
        const raid = !animals && rnd() < 0.5 ? `<br />{b:ri${ri}} ${rnd() < 0.5 ? "hoy" : "ayer"}, ${String(Math.floor(rnd() * 24)).padStart(2, "0")}:${String(Math.floor(rnd() * 60)).padStart(2, "0")} {b.ri${ri}}<br />{b:bi${got === cap ? 2 : 1}} &#x202d;${got}&#x202c;/&#x202d;${cap}&#x202c;` : "";
        tiles.push({ position: { x, y }, did: -1, title: "{k.fo}", text: bonus + animals + raid });
      } else tiles.push({ position: { x, y }, title: "Bosque", text: "" });
    }
    return { tiles };
  };

  A.views.land = (root) => {
    const w = A.state.world, home = A.state.home;
    const st = { tab: "spots", type: "crop", minBonus: 0, maxDist: 30, oasis: "all", sort: "crop", dir: -1, limit: 100, ...A.store.get("landView", {}) };
    let land = A.land();
    root.innerHTML = A.head(t("land.title"), t("land.sub"), `<button class="btn" id="ld-home">${A.icon("home")}${home ? A.coord(home.x, home.y) + " · " + t("home.change") : t("home.set")}</button>`) +
      `<div class="grid g-2">
        <div class="card"><div class="card-h"><h2>${t("land.import")}</h2><span class="sub" id="ld-state"></span></div><div class="card-b" style="display:flex;flex-direction:column;gap:12px">
          <ol class="steps">${t("land.how")}</ol>
          <textarea class="input" id="ld-ta" style="min-height:96px" placeholder='{"tiles":[{"position":{"x":38,"y":47},"title":"{k.vt} {k.f9}",…' aria-label="${A.esc(t("land.import"))}"></textarea>
          <div class="row" style="flex-wrap:wrap"><button class="btn primary" id="ld-go">${A.icon("download")}${t("land.add")}</button><button class="btn" id="ld-file" type="button">${A.icon("plus")}${t("land.file")}</button>${A.DEMO ? `<button class="btn" id="ld-demo">${t("land.demo")}</button>` : ""}<button class="btn ghost" id="ld-clear">${t("land.clear")}</button></div>
          <details class="muted" style="font-size:12.5px"><summary>${t("land.manyTitle")}</summary><ol class="steps" style="margin-top:8px">${t("land.many")}</ol></details>
          <div class="muted" style="font-size:12.5px">${t("land.rules")}</div>
        </div></div>
        <div class="card"><div class="card-h"><h2>${t("farm.summary")}</h2></div><div class="card-b" id="ld-sum"></div></div>
      </div>
      <div class="card" id="ld-res"><div class="card-h"><div class="seg" id="ld-tab"><button data-v="spots" aria-pressed="${st.tab === "spots"}">${t("land.spots")}</button><button data-v="oases" aria-pressed="${st.tab === "oases"}">${t("land.oases")}</button></div>
          <span class="sub" id="ld-n"></span><span class="right row" id="ld-filters" style="flex-wrap:wrap;gap:8px"></span></div>
        <div class="table-wrap card-b" style="max-height:calc(100vh - 220px);overflow:auto"><table class="t" id="ld-t"><thead></thead><tbody></tbody></table></div>
        <div class="row" style="justify-content:center;padding:0 0 14px" id="ld-more"></div></div>`;
    const $ = (s) => A.$(s, root);
    const table = $("#ld-t");
    const save = () => A.store.set("landView", { tab: st.tab, type: st.type, minBonus: st.minBonus, maxDist: st.maxDist, oasis: st.oasis });
    const TYPES = { all: () => true, crop: (s) => s.fields[3] >= 9, c18: (s) => s.fields[3] === 18, c15: (s) => s.fields[3] === 15, c9: (s) => s.fields[3] === 9, c7: (s) => s.fields[3] === 7, c6: (s) => s.fields[3] === 6 };
    const OASIS = { all: () => true, empty: (o) => !o.n, animals: (o) => o.n, crop: (o) => o.bonus[3], mine: (o) => o.raid, notMine: (o) => !o.raid, losses: (o) => o.raid?.losses };
    const nearHtml = (s) => { if (!s.nearest) return `<span class="muted">${t("land.alone")}</span>`; const p = w.pById.get(s.nearest.uid); return `${A.ui.player(p)} <span class="muted num">${A.fmt(s.nearestDist, 1)}</span>`; };
    const animalsHtml = (o) => (o.animals.length ? o.animals.map(([id, n]) => `<span class="chip" title="${A.esc(A.animalName(id))}">${n} ${A.esc(A.animalName(id))}</span>`).join(" ") : `<span class="pill active">${t("land.emptyOasis")}</span>`);
    /* Tu último atraco según el tooltip del mapa: cuándo, si hubo bajas y cuánto se llevaron tus tropas. */
    const raidHtml = (r) => {
      if (!r) return `<span class="muted">—</span>`;
      const cls = r.lost ? "inactive" : r.losses ? "slowing" : "active";
      const when = r.at ? A.ago(r.at) : r.text;
      const loot = r.carried != null ? `${A.fmt(r.carried)}${r.cap ? "/" + A.fmt(r.cap) : ""}` : "";
      const tip = t("land.raidTip", { i: t("land.ri" + Math.min(3, r.icon)), d: r.text, l: loot || "—" });
      return `<span class="pill ${cls}" title="${A.esc(tip)}">${A.esc(when || "?")}</span>${loot ? ` <span class="mono muted" title="${A.esc(tip)}">${loot}${r.fill === 100 ? " ✓" : ""}</span>` : ""}`;
    };

    const summary = () => {
      const has = land && (land.free.length || land.oases.length);
      $("#ld-state").textContent = has ? t("land.state", { d: new Date(land.at).toLocaleString(A.locale(), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) }) : "";
      $("#ld-res").style.display = has ? "" : "none";
      if (!has) { $("#ld-sum").innerHTML = A.ui.empty(t("land.empty"), t("land.emptySub")); return; }
      const n = (c) => land.free.filter((f) => A.FIELDS[f[2]][3] === c).length;
      const freeO = land.oases.filter((o) => !o[4]);
      const raided = freeO.filter((o) => o[5]);
      const fk = (cls, v, label) => `<div class="fk ${cls}"><b>${A.fmt(v)}</b><span>${A.esc(label)}</span></div>`;
      $("#ld-sum").innerHTML = `<div class="farm-kpis">${n(18) ? fk("inactive", n(18), "18c") : ""}${fk("inactive", n(15), "15c")}${fk("slowing", n(9), "9c")}${fk("natar", n(7), t("land.c7"))}${fk("active", freeO.length, t("land.freeOases"))}${fk("natar", freeO.filter((o) => !o[3].length).length, t("land.emptyOases"))}</div>
        <ul class="farm-notes"><li>${t("land.sum.tiles", { n: A.fmt(land.free.length), o: A.fmt(land.oases.length) })}</li><li>${t("land.sum.bonus")}</li>
          ${raided.length ? ((l) => `<li>${t(l ? "land.sum.raided" : "land.sum.raidedClean", { n: raided.length, l })}</li>`)(raided.filter((o) => o[5][0] !== 1).length) : ""}
          ${home ? "" : `<li>${t("land.sum.noHome")}</li>`}<li class="muted">${t("land.sum.fresh")}</li></ul>`;
    };

    const render = () => {
      summary();
      if (!land) return;
      A.$$("#ld-tab button", root).forEach((b) => b.setAttribute("aria-pressed", b.dataset.v === st.tab));
      const distF = home ? `<label class="muted" for="ld-d" style="font-size:12px">${t("inact.maxDist")} <b class="mono" id="ld-dv">${st.maxDist}</b></label><input type="range" id="ld-d" min="3" max="120" value="${st.maxDist}" style="width:130px">` : "";
      let rows, cols, body;
      if (st.tab === "spots") {
        $("#ld-filters").innerHTML = `<select class="input" id="ld-type" style="width:auto" aria-label="${A.esc(t("land.type"))}">${Object.keys(TYPES).map((k) => `<option value="${k}" ${st.type === k ? "selected" : ""}>${A.esc(t("land.type." + k))}</option>`).join("")}</select>
          <select class="input" id="ld-bonus" style="width:auto" aria-label="${A.esc(t("land.cropBonus"))}">${[0, 25, 50, 75, 100, 125, 150].map((b) => `<option value="${b}" ${+st.minBonus === b ? "selected" : ""}>${b ? "≥ " + b + " %" : A.esc(t("land.anyBonus"))}</option>`).join("")}</select>${distF}`;
        rows = A.settleSpots(land, w, home).filter((s) => TYPES[st.type](s) && s.cropBonus >= st.minBonus && (!home || s.dist <= st.maxDist));
        cols = [{ k: "type", label: t("land.type"), sort: (s) => s.fields[3] }, { k: "xy", label: t("land.tile") }, { k: "fields", label: t("land.fields") },
          { k: "bonus", label: t("land.cropBonus"), cls: "r", sort: (s) => s.cropBonus }, { k: "crop", label: t("land.crop"), cls: "r", sort: (s) => s.crop },
          { k: "oases", label: t("land.oasesNear"), cls: "r", sort: (s) => s.oases }, ...(home ? [{ k: "dist", label: t("inact.dist"), cls: "r", sort: (s) => s.dist }] : []),
          { k: "vil", label: t("land.crowd"), cls: "r", sort: (s) => s.villages }, { k: "near", label: t("land.nearest"), sort: (s) => s.nearestDist ?? 99 }, { k: "act", label: "" }];
        if (!cols.some((c) => c.k === st.sort)) { st.sort = "crop"; st.dir = -1; }
        A.ui.sortable(table, rows, cols, st, render);
        body = rows.slice(0, st.limit).map((s) => `<tr><td><span class="pill ${s.fields[3] >= 15 ? "inactive" : s.fields[3] === 9 ? "slowing" : "natar"}">${A.esc(s.label)}</span></td>
          <td>${A.ui.coord(s.x, s.y)}</td><td class="mono muted">${s.fields.join("-")}</td>
          <td class="r"><b class="num">${s.cropBonus ? "+" + s.cropBonus + " %" : "—"}</b></td><td class="r num" title="${A.esc(t("land.cropTip"))}">${A.fmt(s.crop, s.crop % 1 ? 2 : 0)}</td>
          <td class="r">${s.oases}${s.taken ? ` <span class="muted" title="${A.esc(t("land.takenTip"))}">(+${s.taken})</span>` : ""}</td>${home ? `<td class="r num">${A.fmt(s.dist, 1)}</td>` : ""}
          <td class="r">${s.villages}</td><td>${nearHtml(s)}</td>
          <td><button class="btn ghost sm" data-map="${s.x}|${s.y}" title="${A.esc(t("pl.onMap"))}" aria-label="${A.esc(t("pl.onMap"))}">${A.icon("map")}</button>${A.ui.game("tile", s.x, s.y)}</td></tr>`).join("");
      } else {
        if (!OASIS[st.oasis]) st.oasis = "all";
        $("#ld-filters").innerHTML = `<select class="input" id="ld-oasis" style="width:auto" aria-label="${A.esc(t("land.oases"))}">${Object.keys(OASIS).map((k) => `<option value="${k}" ${st.oasis === k ? "selected" : ""}>${A.esc(t("land.o." + k))}</option>`).join("")}</select>${distF}`;
        rows = A.oasisTargets(land, w, home).filter((o) => OASIS[st.oasis](o) && (!home || o.dist <= st.maxDist));
        cols = [{ k: "xy", label: t("land.tile") }, { k: "bonus", label: t("land.bonus"), sort: (o) => o.bonus.reduce((a, b) => a + b, 0) + o.bonus[3] / 100 }, { k: "animals", label: t("land.animals"), sort: (o) => o.n },
          { k: "def", label: t("land.def"), cls: "r", sort: (o) => o.defInf + o.defCav }, { k: "xp", label: `<span title="${A.esc(t("land.xpTip"))}">${t("land.xp")}</span>`, cls: "r", sort: (o) => o.xp },
          { k: "raid", label: `<span title="${A.esc(t("land.lastRaidTip"))}">${t("land.lastRaid")}</span>`, sort: (o) => o.raid?.at ?? (o.raid ? 1 : 0) },
          ...(home ? [{ k: "dist", label: t("inact.dist"), cls: "r", sort: (o) => o.dist }] : []), { k: "act", label: "" }];
        if (!cols.some((c) => c.k === st.sort)) { st.sort = home ? "dist" : "xp"; st.dir = home ? 1 : -1; }
        A.ui.sortable(table, rows, cols, st, render);
        body = rows.slice(0, st.limit).map((o) => `<tr><td>${A.ui.coord(o.x, o.y)}</td><td>${A.esc(A.bonusLabel(o.bonus))}</td><td class="wrap">${animalsHtml(o)}</td>
          <td class="r mono" title="${A.esc(t("land.defTip"))}">${o.n ? `${A.fmt(o.defInf)} / ${A.fmt(o.defCav)}` : "—"}</td><td class="r num" title="${A.esc(t("land.xpTip"))}">${o.xp ? `${o.xp} · ${A.fmt(o.xp * 40)}` : "—"}</td>
          <td>${raidHtml(o.raid)}</td>${home ? `<td class="r num">${A.fmt(o.dist, 1)}</td>` : ""}
          <td><button class="btn ghost sm" data-map="${o.x}|${o.y}" title="${A.esc(t("pl.onMap"))}" aria-label="${A.esc(t("pl.onMap"))}">${A.icon("map")}</button>${A.ui.game("tile", o.x, o.y)}${A.ui.game("send", o.x, o.y)}</td></tr>`).join("");
      }
      table.querySelector("tbody").innerHTML = body || `<tr><td colspan="${cols.length}">${A.ui.empty(t("common.noResults"), t("land.noneSub"))}</td></tr>`;
      $("#ld-n").textContent = t(st.tab === "spots" ? "land.nSpots" : "land.nOases", { n: A.fmt(rows.length) });
      $("#ld-more").innerHTML = rows.length > st.limit ? `<button class="btn" id="ld-mb">${t("common.showMore", { n: rows.length - st.limit })}</button>` : "";
    };

    const add = (parsed) => {
      if (!parsed) { A.toast(t("land.bad")); return; }
      land = A.landMerge(land, parsed);
      A.store.set(landKey(), land);
      if (!A.land()) { A.toast(t("land.full")); }
      A.toast(t(parsed.parts > 1 ? "land.addedMany" : "land.added", { f: parsed.free.length, o: parsed.oases.length, n: parsed.parts, c: parsed.covered.length }));
      $("#ld-ta").value = "";
      render();
    };
    $("#ld-go").onclick = () => { const v = $("#ld-ta").value; if (v.trim()) add(A.parseMapTiles(v)); };
    A.ui.fileInput($("#ld-ta"), $("#ld-file"), (txt) => add(A.parseMapTiles(txt)));
    $("#ld-ta").onpaste = () => setTimeout(() => $("#ld-go").click(), 0);
    $("#ld-demo") && ($("#ld-demo").onclick = () => add(A.parseMapTiles(demoLand(w, home || w.players[0]?.cap || { x: 0, y: 0 }))));
    $("#ld-clear").onclick = () => { land = null; A.store.set(landKey(), null); render(); };
    $("#ld-home").onclick = () => A.homeModal(() => A.route());
    $("#ld-tab").onclick = (e) => { const b = e.target.closest("button"); if (!b) return; st.tab = b.dataset.v; st.sort = ""; st.limit = 100; save(); render(); };
    $("#ld-filters").onchange = (e) => {
      if (e.target.id === "ld-type") st.type = e.target.value; else if (e.target.id === "ld-bonus") st.minBonus = +e.target.value; else if (e.target.id === "ld-oasis") st.oasis = e.target.value; else return;
      save(); render();
    };
    $("#ld-filters").oninput = A.debounce((e) => { if (e.target.id !== "ld-d") return; st.maxDist = +e.target.value; save(); render(); $("#ld-d")?.focus(); }, 120);
    $("#ld-more").onclick = (e) => { if (e.target.closest("#ld-mb")) { st.limit += 150; render(); } };
    table.onclick = (e) => { const b = e.target.closest("[data-map]"); if (!b) return; const c = A.parseCoord(b.dataset.map); A.mapPreset = { focus: c }; location.hash = "map"; };
    render();
  };

  /* ================= CALCULADORA DE EJÉRCITO (tarjeta de Herramientas) ================= */
  A.mountArmy = (card) => {
    const w = A.state.world, h = A.state.home;
    const key = "army:" + A.state.sid;
    const tribes = A.PLAYABLE.filter((tid) => A.STATS[tid]);
    const st = { tid: h && A.STATS[h.tid] ? h.tid : 1, counts: {}, res: ["", "", "", ""], unit: 0, npc: true, sort: "attPerK", dir: -1, ...A.store.get(key, {}) };
    if (!A.STATS[st.tid]) st.tid = 1;
    const resNames = ["r1", "r2", "r3", "r4"].map((k) => t("land." + k));
    card.innerHTML = `<div class="card-h"><h2>${t("army.title")}</h2><span class="sub">${t("army.sub")}</span></div>
      <div class="card-b">
        <div class="row" style="flex-wrap:wrap;gap:12px;align-items:flex-end">
          <div class="field" style="min-width:170px"><label for="ar-tid">${t("common.tribe")}</label><select class="input" id="ar-tid">${tribes.map((tid) => `<option value="${tid}" ${tid === st.tid ? "selected" : ""}>${A.esc(t("tribe." + A.TRIBES[tid].key))}</option>`).join("")}</select></div>
          <button class="btn ghost sm" id="ar-reset" type="button">${t("army.reset")}</button>
        </div>
        <div class="unit-grid army-in" id="ar-units"></div>
        <div id="ar-out"></div>
        <div class="sep"></div>
        <h3>${t("army.afford")}</h3>
        <div class="fgrid cols-4">${resNames.map((n, i) => `<div class="field"><label for="ar-r${i}">${A.esc(n)}</label><input class="input num" type="number" min="0" id="ar-r${i}" value="${A.esc(st.res[i])}" placeholder="0"></div>`).join("")}</div>
        <div class="row" style="flex-wrap:wrap;gap:12px;align-items:flex-end">
          <div class="field" style="flex:1;min-width:180px"><label for="ar-unit">${t("rp.unit")}</label><select class="input" id="ar-unit"></select></div>
          <label class="check"><input type="checkbox" id="ar-npc" ${st.npc ? "checked" : ""}>${t("army.npc")}</label>
        </div>
        <div id="ar-afford"></div>
        <div class="sep"></div>
        <h3>${t("army.compare")}</h3>
        <div class="table-wrap"><table class="t" id="ar-t"><thead></thead><tbody></tbody></table></div>
        <div class="muted" style="font-size:12.5px">${t("army.note", { speed: w.server.speed, troop: A.troopSpeed(w.server.speed) })}</div>
      </div>`;
    const $ = (s) => A.$(s, card);
    const save = () => A.store.set(key, { tid: st.tid, counts: st.counts, res: st.res, unit: st.unit, npc: st.npc });
    const counts = () => (st.counts[st.tid] ||= []);
    const speed = w.server.speed || 1, troop = A.troopSpeed(speed); // la formación escala con el mundo; el viaje, con su tabla
    const out = () => {
      const r = A.armyTotals(st.tid, counts());
      if (!r.n) { $("#ar-out").innerHTML = `<div class="muted">${t("army.enter")}</div>`; return; }
      const fk = (cls, v, label, tip = "") => `<div class="fk ${cls}" title="${A.esc(tip)}"><b>${v}</b><span>${A.esc(label)}</span></div>`;
      $("#ar-out").innerHTML = `<div class="farm-kpis">${fk("inactive", A.compact(r.att), t("army.att"), t("army.attTip", { i: A.fmt(r.attInf), c: A.fmt(r.attCav) }))}${fk("active", A.compact(r.defInf), t("army.defInf"))}${fk("active", A.compact(r.defCav), t("army.defCav"))}${fk("natar", A.compact(r.upkeep), t("army.upkeep"))}${fk("natar", A.compact(r.carry), t("army.carry"))}</div>
        <ul class="farm-notes">
          <li>${t("army.cost", { total: A.fmt(r.total), parts: r.cost.map((c, i) => `${A.fmt(c)} ${resNames[i].toLowerCase()}`).join(" · ") })}</li>
          <li>${t("army.attSplit", { i: A.fmt(r.attInf), c: A.fmt(r.attCav) })}</li>
          <li>${t("army.train", { d: A.dur(r.train / speed) })}</li>
          <li>${t("army.slowest", { u: A.esc(A.unitName(st.tid, r.slowest)), v: A.UNITS[st.tid][r.slowest][2] * troop })}</li>
        </ul>`;
    };
    const afford = () => {
      const n = A.maxUnits(st.tid, st.unit, st.res, st.npc);
      const any = st.res.some((x) => +x > 0);
      if (!any) { $("#ar-afford").innerHTML = `<div class="muted">${t("army.affordEnter")}</div>`; return; }
      const one = A.armyTotals(st.tid, Object.assign([], { [st.unit]: n }));
      $("#ar-afford").innerHTML = `<div class="explain"><b>${A.fmt(n)} × ${A.esc(A.unitName(st.tid, st.unit))}</b>${n ? `<br>${t("army.affordRes", { att: A.fmt(one.att), di: A.fmt(one.defInf), dc: A.fmt(one.defCav), up: A.fmt(one.upkeep), d: A.dur(one.train / speed) })}` : ""}${st.npc ? `<br><span class="muted">${t("army.npcNote")}</span>` : ""}</div>`;
    };
    const compare = () => {
      const rows = A.UNITS[st.tid].map((u, i) => ({ i, ...A.unitValue(st.tid, i) }));
      const cols = [{ k: "name", label: t("rp.unit") }, { k: "att", label: t("army.att"), cls: "r", sort: (r) => r.att }, { k: "defInf", label: t("army.defInf"), cls: "r", sort: (r) => r.defInf }, { k: "defCav", label: t("army.defCav"), cls: "r", sort: (r) => r.defCav },
        { k: "total", label: t("army.costCol"), cls: "r", sort: (r) => r.total }, { k: "upkeep", label: t("army.upkeepCol"), cls: "r", sort: (r) => r.upkeep }, { k: "speed", label: t("army.speed"), cls: "r", sort: (r) => r.speed }, { k: "carry", label: t("army.carry"), cls: "r", sort: (r) => r.carry || 0 },
        { k: "attPerK", label: t("army.attPerK"), cls: "r", sort: (r) => r.attPerK }, { k: "defPerK", label: t("army.defPerK"), cls: "r", sort: (r) => r.defPerK }, { k: "train", label: t("army.trainCol"), cls: "r", sort: (r) => r.train }];
      const table = $("#ar-t");
      A.ui.sortable(table, rows, cols, st, compare);
      const best = (k) => Math.max(...rows.slice(0, 6).map((r) => r[k]));
      const mark = (r, k, d = 0) => `<td class="r num">${r.i < 6 && r[k] === best(k) && r[k] > 0 ? `<b class="up">${A.fmt(r[k], d)}</b>` : A.fmt(r[k], d)}</td>`;
      table.querySelector("tbody").innerHTML = rows.map((r) => `<tr><td>${A.esc(A.unitName(st.tid, r.i))}${r.cav ? ` <span class="chip">${t("army.cav")}</span>` : ""}</td>
        <td class="r num">${r.att}</td><td class="r num">${r.defInf}</td><td class="r num">${r.defCav}</td><td class="r num">${A.fmt(r.total)}</td><td class="r num">${r.upkeep}</td><td class="r num">${r.speed * troop}</td><td class="r num">${r.carry ?? "—"}</td>
        ${mark(r, "attPerK")}${mark(r, "defPerK")}<td class="r mono">${A.dur(r.train / speed)}</td></tr>`).join("");
    };
    const mount = () => {
      $("#ar-units").innerHTML = A.UNITS[st.tid].map((u, i) => `<div class="unit"><label for="ar-u${i}"><b>${A.esc(A.unitName(st.tid, i))}</b></label><input class="input num" type="number" min="0" id="ar-u${i}" data-u="${i}" value="${counts()[i] || ""}" placeholder="0"></div>`).join("");
      $("#ar-unit").innerHTML = A.UNITS[st.tid].map((u, i) => `<option value="${i}" ${i === +st.unit ? "selected" : ""}>${A.esc(A.unitName(st.tid, i))}</option>`).join("");
      out(); afford(); compare();
    };
    $("#ar-units").oninput = (e) => { const el = e.target.closest("[data-u]"); if (!el) return; counts()[+el.dataset.u] = Math.max(0, Math.floor(+el.value || 0)); save(); out(); };
    $("#ar-tid").onchange = (e) => { st.tid = +e.target.value; save(); mount(); };
    $("#ar-reset").onclick = () => { st.counts[st.tid] = []; save(); mount(); };
    $("#ar-unit").onchange = (e) => { st.unit = +e.target.value; save(); afford(); };
    $("#ar-npc").onchange = (e) => { st.npc = e.target.checked; save(); afford(); };
    [0, 1, 2, 3].forEach((i) => ($("#ar-r" + i).oninput = (e) => { st.res[i] = e.target.value; save(); afford(); }));
    mount();
  };
})();
