/* Vistas: auditor de listas de vacas, vecindario y analizador de ataques entrantes (en Herramientas). */
"use strict";
(() => {
  const A = window.A;
  const t = (...a) => A.t(...a);
  const VPILL = { keep: "active", check: "slowing", risk: "inactive", gone: "gone", nohist: "natar" };
  const verdictPill = (v) => `<span class="pill ${VPILL[v]}">${A.esc(t("farm.v." + v))}</span>`;
  const notesHtml = (notes) => notes.map(([k, vars]) => A.esc(t(k, vars))).join(" · ");
  const homeBtn = (id) => `<button class="btn" id="${id}">${A.icon("home")}${A.state.home ? A.coord(A.state.home.x, A.state.home.y) + " · " + t("home.change") : t("home.set")}</button>`;
  const resolve = (w, s) => {
    const c = A.parseCoord(s); if (c) return c;
    const p = w.players.find((p) => p.name.toLowerCase() === String(s).trim().toLowerCase());
    return p?.cap ? { x: p.cap.x, y: p.cap.y } : null;
  };

  /* ================= LISTAS DE VACAS ================= */
  A.views.farms = (root) => {
    const w = A.state.world, home = A.state.home;
    const key = "farmText:" + A.state.sid;
    const st = { maxDist: null, res: [] };
    const tid = home && A.CROP[home.tid] ? home.tid : 1;
    const armyKey = "farmArmy:" + A.state.sid;
    const army = { unit: A.fastestRaider(tid), ts: 0, ...A.store.get(armyKey, {}) };
    if (A.UNITS[tid][army.unit]?.[3] === 0) army.unit = A.fastestRaider(tid); // guardada con otra tribu
    root.innerHTML = A.head(t("farm.title"), t("farm.sub"), homeBtn("fm-home")) +
      (home ? "" : `<div class="card card-b">${A.ui.empty(t("dash.noHome"), t("farm.noHome"))}<div class="row" style="justify-content:center"><button class="btn primary" id="fm-home2">${A.icon("home")}${t("home.set")}</button></div></div>`) +
      `<div class="grid g-2" ${home ? "" : 'style="display:none"'}>
        <div class="card"><div class="card-h"><h2>${t("farm.paste")}</h2></div><div class="card-b" style="display:flex;flex-direction:column;gap:12px">
          <ol class="steps">${t("farm.how")}</ol>
          <textarea class="input" id="fm-ta" placeholder="${A.esc(t("farm.ph"))}" aria-label="${A.esc(t("farm.paste"))}">${A.esc(A.store.get(key, ""))}</textarea>
          <div class="row" style="flex-wrap:wrap"><button class="btn primary" id="fm-go">${A.icon("farm")}${t("farm.analyse")}</button><button class="btn" id="fm-file" type="button">${A.icon("plus")}${t("farm.file")}</button><button class="btn ghost" id="fm-clear">${t("farm.clear")}</button><span class="muted" id="fm-parsed" style="margin-left:auto;font-size:12.5px"></span></div>
          <div class="row" style="flex-wrap:wrap;gap:12px">
            <div class="field" style="flex:2;min-width:170px"><label for="fm-unit">${t("farm.unit")}</label><select class="input" id="fm-unit">${A.UNITS[tid].slice(0, 6).map((u, i) => (u[3] === 0 ? "" : `<option value="${i}" ${i === army.unit ? "selected" : ""}>${A.esc(A.unitName(tid, i))}</option>`)).join("")}</select></div>
            <div class="field" style="flex:1;min-width:110px"><label for="fm-ts">${t("inact.ts")}</label><input class="input num" type="number" min="0" max="20" id="fm-ts" value="${army.ts}"></div>
          </div>
        </div></div>
        <div class="card"><div class="card-h"><h2>${t("farm.summary")}</h2></div><div class="card-b" id="fm-sum">${A.ui.empty(t("farm.empty"), t("farm.emptySub"))}</div></div>
      </div>
      <div class="card" id="fm-res" style="display:none"><div class="card-h"><h2>${t("farm.targets")}</h2><span class="sub" id="fm-res-sub"></span><span class="right"><button class="btn sm" id="fm-copy-bad">${A.icon("copy")}${t("farm.copyBad")}</button></span></div>
        <div class="table-wrap card-b"><table class="t" id="fm-t"><thead></thead><tbody></tbody></table></div></div>
      <div class="card" id="fm-sug" style="display:none"><div class="card-h"><h2>${t("farm.add")}</h2><span class="sub" id="fm-sug-sub"></span>
        <span class="right"><label class="muted" for="fm-d" style="font-size:12px">${t("inact.maxDist")} <b id="fm-dv" class="mono"></b></label><input type="range" id="fm-d" min="3" max="80" style="width:140px"><button class="btn sm" id="fm-sug-copy">${A.icon("copy")}${t("pl.copyAll")}</button><button class="btn sm primary" id="fm-sug-fb">${A.icon("farm")}${t("fb.addAll")}</button></span></div>
        <div class="table-wrap card-b" id="fm-sug-b"></div></div>`;
    const openHome = () => A.homeModal(() => A.route());
    A.$("#fm-home", root).onclick = openHome;
    A.$("#fm-home2", root) && (A.$("#fm-home2", root).onclick = openHome);
    if (!home) return;
    const ta = A.$("#fm-ta", root);

    const analyse = () => {
      let text = ta.value;
      /* Con el código de la página (o un JSON) del juego se guarda solo lo necesario, sin las claves que abren
         los informes y sin los cientos de KB de HTML. */
      const game = /"slots"\s*:/.test(text) ? A.parseFarmData(text) : null;
      if (game && !/"atalayaFarm"/.test(text)) { text = JSON.stringify(game.compact); ta.value = text; }
      A.store.set(key, text);
      const entries = (game ? game.entries : A.parseFarmList(text)).filter((e) => !(e.x === home.x && e.y === home.y));
      A.$("#fm-parsed", root).textContent = text.trim() ? t("farm.parsed", { n: entries.length }) : "";
      if (!entries.length) {
        A.$("#fm-sum", root).innerHTML = A.ui.empty(text.trim() ? t("farm.noneParsed") : t("farm.empty"), text.trim() ? t("farm.noneParsedSub") : t("farm.emptySub"));
        A.$("#fm-res", root).style.display = A.$("#fm-sug", root).style.display = "none";
        return;
      }
      const distOf = (m) => (m.e.dist != null ? m.e.dist : m.v ? A.dist(home.x, home.y, m.v.x, m.v.y, w.R) : null);
      st.res = A.matchFarm(entries, w, home).map((m) => {
        const profit = A.farmProfit(m.e, distOf(m), tid, army.unit, army.ts);
        return { ...m, profit, ...A.farmVerdict(m, w, home.tid, profit) };
      });
      st.res.sort((a, b) => A.FARM_SEV[a.verdict] - A.FARM_SEV[b.verdict] || (a.e.dist ?? 0) - (b.e.dist ?? 0));
      const n = (v) => st.res.filter((r) => r.verdict === v).length;
      const full = st.res.filter((r) => r.notes.some(([k]) => k === "farm.n.full")).length;
      const withLoot = st.res.filter((r) => r.e.loot != null).length;
      const named = entries.some((e) => e.name != null && e.x == null);
      const costed = st.res.filter((r) => r.profit);
      const sum = (f) => costed.reduce((s, r) => s + f(r), 0);
      const losing = costed.filter((r) => r.profit.net <= 0).length;
      const hist = st.res.filter((r) => r.e.raids);
      const raids = hist.reduce((s, r) => s + r.e.raids, 0), booty = hist.reduce((s, r) => s + r.e.booty, 0);
      const hurt = st.res.filter((r) => r.e.icon === 2 || r.e.icon === 3).length;
      A.$("#fm-sum", root).innerHTML = `<div class="farm-kpis">
          ${["keep", "check", "risk", "gone", "nohist"].map((v) => `<div class="fk ${VPILL[v]}"><b>${n(v)}</b><span>${t("farm.v." + v)}</span></div>`).join("")}</div>
        <ul class="farm-notes">
          ${game ? `<li>${t("farm.sum.game", { n: entries.length, l: game.lists.length, o: entries.filter((e) => e.oasis).length })}</li>` : ""}
          ${raids ? `<li>${t("farm.sum.booty", { b: A.fmt(booty), r: A.fmt(raids), a: A.fmt(booty / raids) })}</li>` : ""}
          ${hurt ? `<li>${t("farm.sum.hurt", { n: hurt })}</li>` : ""}
          ${n("risk") ? `<li>${t("farm.sum.risk", { n: n("risk") })}</li>` : ""}
          ${n("gone") ? `<li>${t("farm.sum.gone", { n: n("gone") })}</li>` : ""}
          ${withLoot ? `<li>${t("farm.sum.loot", { full, n: withLoot })}</li>` : ""}
          ${costed.length ? `<li>${t("farm.sum.net", { net: A.signed(sum((r) => r.profit.net)), loot: A.fmt(sum((r) => r.e.loot)), cost: A.fmt(sum((r) => r.profit.cost)) })}</li>` : ""}
          ${losing ? `<li>${t("farm.sum.losing", { n: losing })}</li>` : ""}
          ${costed.length ? `<li class="muted">${t(costed.every((r) => r.profit.exact) ? "farm.sum.netNoteExact" : "farm.sum.netNote")}${w.server.speed > 1 ? " " + t("farm.sum.netSpeed") : ""}</li>` : ""}
          ${n("nohist") ? `<li>${t("farm.sum.nohist", { n: n("nohist") })}</li>` : ""}
          ${named && entries.length <= 100 ? `<li>${t("farm.sum.slots", { n: 100 - entries.length })}</li>` : ""}
        </ul>`;
      A.$("#fm-res", root).style.display = "";
      A.$("#fm-res-sub", root).textContent = t("farm.resSub", { n: st.res.length, c: A.coord(home.x, home.y) });
      const showAvg = st.res.some((r) => r.e.avg != null);
      const multiList = new Set(st.res.map((r) => r.e.list).filter(Boolean)).size > 1;
      A.$("#fm-t thead", root).innerHTML = `<tr><th>${t("farm.verdict")}</th><th>${t("inact.village")}</th><th>${t("common.player")}</th><th>${t("common.alliance")}</th><th class="r" title="${A.esc(t("farm.popTip"))}">${t("farm.popCol")}</th><th class="r">${t("inact.dist")}</th><th class="r">${t("farm.loot")}</th>${showAvg ? `<th class="r" title="${A.esc(t("farm.avgTip"))}">${t("farm.avg")}</th>` : ""}<th class="r" title="${A.esc(t("farm.netTip"))}">${t("farm.net")}</th><th>${t("farm.why")}</th><th></th></tr>`;
      A.$("#fm-t tbody", root).innerHTML = st.res.map((r) => {
        const v = r.v, e = r.e;
        const x = v ? v.x : e.x, y = v ? v.y : e.y;
        const pop = e.pop != null && v ? `${A.fmt(e.pop)} <span class="muted">/ ${A.fmt(v.pop)}</span>` : e.pop != null ? A.fmt(e.pop) : v ? A.fmt(v.pop) : "—";
        const dist = distOf(r);
        const name = e.oasis ? t(e.oasis === "taken" ? "farm.oasisTaken" : "farm.oasis") : e.name || v?.name || "";
        const when = typeof e.time === "number" ? A.ago(e.time) : e.time;
        const loot = e.loot != null ? `${A.fmt(e.loot)}${e.cap ? `<span class="muted">/${A.fmt(e.cap)}</span>` : ""}${when ? ` <span class="muted">${A.esc(when)}</span>` : ""}` : "—";
        return `<tr><td>${verdictPill(r.verdict)}</td>
          <td>${x != null ? A.ui.coord(x, y) + " " : ""}<span class="${x != null ? "muted" : ""}">${A.esc(name)}</span>${multiList && e.list ? ` <span class="chip" title="${A.esc(t("farm.listTip"))}">${A.esc(e.list)}</span>` : ""}</td>
          <td>${r.p ? A.ui.player(r.p) : "—"}</td><td>${r.p ? A.ui.ally(r.p.aid) : "—"}</td>
          <td class="r">${pop}</td><td class="r num">${dist != null ? A.fmt(dist, 1) : "—"}</td>
          <td class="r mono">${loot}</td>
          ${showAvg ? `<td class="r mono">${e.avg != null ? `${A.fmt(e.avg)} <span class="muted">×${e.raids}</span>` : "—"}</td>` : ""}
          <td class="r mono">${r.profit ? `<span class="delta ${A.cls(r.profit.net)}" title="${A.esc(t(r.profit.exact ? "farm.netRowExact" : "farm.netRow", { c: A.fmt(r.profit.cost), h: A.dur(r.profit.hours * 3600) }))}">${A.signed(r.profit.net)}</span>` : "—"}</td>
          <td class="wrap">${notesHtml(r.notes)}</td>
          <td>${x != null ? A.ui.game("tile", x, y) : ""}</td></tr>`;
      }).join("");
      suggestions();
    };

    const suggestions = () => {
      const box = A.$("#fm-sug", root); box.style.display = "";
      const far = Math.max(...st.res.map((r) => r.e.dist ?? 0), 10);
      if (st.maxDist == null) st.maxDist = Math.min(80, Math.ceil(far));
      A.$("#fm-d", root).value = st.maxDist; A.$("#fm-dv", root).textContent = st.maxDist;
      const have = new Set(st.res.filter((r) => r.v).map((r) => r.v.vid));
      const listed = A.fbListed(); // también lo marcado en el asistente del buscador
      const rows = A.findTargets({ ...A.filters(), maxDist: st.maxDist }).filter((r) => !have.has(r.v.vid) && !listed.has(A.fbKey(r.v))).slice(0, 30);
      st.sug = rows;
      A.$("#fm-sug-sub", root).textContent = t("farm.addSub", { d: st.maxDist });
      A.$("#fm-sug-b", root).innerHTML = rows.length ? `<table class="t"><thead><tr><th>${t("inact.village")}</th><th>${t("common.player")}</th><th class="r">${t("common.pop")}</th><th class="r">${t("inact.days")}</th><th>${t("inact.conf")}</th><th class="r">${t("inact.dist")}</th><th class="r">${t("inact.time")}</th><th></th></tr></thead><tbody>
        ${rows.map((r) => `<tr><td>${A.ui.coord(r.v.x, r.v.y)} <span class="muted">${A.esc(r.v.name)}</span></td><td>${A.ui.player(r.p)}</td><td class="r">${A.fmt(r.v.pop)}</td><td class="r">${r.p.status === "natar" ? "—" : r.p.streak}</td><td>${r.p.status === "natar" ? A.ui.pill("natar") : A.ui.conf(r.p)}</td><td class="r num">${A.fmt(r.dist, 1)}</td><td class="r mono">${A.dur(r.time)}</td><td>${A.ui.game("tile", r.v.x, r.v.y)}</td></tr>`).join("")}</tbody></table>`
        : w.days.length < 2 ? A.ui.empty(t("inact.needHistory"), t("inact.needHistorySub")) : A.ui.empty(t("inact.none"), t("inact.noneSub"));
    };

    const setArmy = () => { A.store.set(armyKey, army); if (ta.value.trim()) analyse(); };
    A.$("#fm-unit", root).onchange = (e) => { army.unit = +e.target.value; setArmy(); };
    A.$("#fm-ts", root).oninput = A.debounce((e) => { army.ts = Math.max(0, Math.min(20, +e.target.value || 0)); setArmy(); }, 150);
    A.$("#fm-go", root).onclick = analyse;
    A.$("#fm-clear", root).onclick = () => { ta.value = ""; analyse(); ta.focus(); };
    ta.onpaste = () => setTimeout(analyse, 0);
    A.ui.fileInput(ta, A.$("#fm-file", root), (txt) => { ta.value = txt; analyse(); });
    A.$("#fm-d", root).oninput = A.debounce((e) => { st.maxDist = +e.target.value; suggestions(); }, 80);
    A.$("#fm-sug-fb", root).onclick = () => { if (st.sug?.length) A.farmBuilder(st.sug, () => root.isConnected && suggestions()); };
    A.$("#fm-sug-copy", root).onclick = () => st.sug?.length && A.copy(st.sug.map((r) => `${r.v.x}|${r.v.y}`).join("\n"), t("toast.exported", { n: st.sug.length }));
    A.$("#fm-copy-bad", root).onclick = () => {
      const bad = st.res.filter((r) => r.verdict === "risk" || r.verdict === "gone");
      if (!bad.length) { A.toast(t("farm.nothingBad")); return; }
      A.copy(bad.map((r) => { const c = r.v || (r.e.x != null ? r.e : null); return `${t("farm.v." + r.verdict)}: ${r.e.name || r.v?.name || (r.e.oasis ? t("farm.oasis") : "")}${c ? ` (${c.x}|${c.y})` : ""}`; }).join("\n"));
    };
    if (ta.value.trim()) analyse();
    A.fbAutoResume(() => root.isConnected && st.res.length && suggestions());
  };

  /* ================= INFORMES DE BATALLA ================= */
  A.views.reports = (root) => {
    const w = A.state.world;
    const key = "reportText:" + A.state.sid;
    const OUT = { wiped: "inactive", losses: "slowing", clean: "active" };
    root.innerHTML = A.head(t("rp.title"), t("rp.sub")) +
      `<div class="grid g-2">
        <div class="card"><div class="card-h"><h2>${t("rp.paste")}</h2></div><div class="card-b" style="display:flex;flex-direction:column;gap:12px">
          <ol class="steps">${t("rp.how")}</ol>
          <textarea class="input" id="rp-ta" placeholder="${A.esc(t("rp.ph"))}" aria-label="${A.esc(t("rp.paste"))}">${A.esc(A.store.get(key, ""))}</textarea>
          <div class="row"><button class="btn primary" id="rp-go">${A.icon("swords")}${t("rp.analyse")}</button><button class="btn ghost" id="rp-clear">${t("farm.clear")}</button></div>
        </div></div>
        <div class="card"><div class="card-h"><h2>${t("farm.summary")}</h2></div><div class="card-b" id="rp-sum">${A.ui.empty(t("rp.empty"), t("rp.emptySub"))}</div></div>
      </div>
      <div class="grid g-2e" id="rp-res" style="display:none">
        <div class="card"><div class="card-h"><h2>${t("rp.troops")}</h2></div><div class="table-wrap card-b" id="rp-troops"></div></div>
        <div class="card"><div class="card-h"><h2>${t("rp.stats")}</h2></div><div class="table-wrap card-b" id="rp-stats"></div></div>
      </div>`;
    const ta = A.$("#rp-ta", root);
    const st = { r: null, s: null };
    const pct = (n) => (n == null ? "—" : `${A.fmt(n, n % 1 ? 1 : 0)} %`);
    const whoHtml = (who) => {
      const p = w.players.find((x) => x.name.toLowerCase() === who.name.toLowerCase());
      return `${who.tag ? `<span class="muted">[${A.esc(who.tag)}]</span> ` : ""}${p ? A.ui.player(p) : A.esc(who.name)}${who.village ? ` <span class="muted">· ${A.esc(who.village)}</span>` : ""}`;
    };
    const shareText = (fmt, anon) => {
      const { r, s } = st;
      const b = (x) => (fmt === "bb" ? `[b]${x}[/b]` : `**${x}**`);
      const name = (blk, i) => (anon ? t(i ? "rp.def" : "rp.atk") : `${blk.who.tag ? `[${blk.who.tag}] ` : ""}${blk.who.name}${blk.who.village ? ` (${blk.who.village})` : ""}`);
      const line = (blk, i) => {
        const sent = blk.rows[0].reduce((x, n) => x + n, 0), lost = (blk.rows[1] || []).reduce((x, n) => x + n, 0);
        return `${b(name(blk, i))}: ${t("rp.share.troops", { s: A.fmt(sent), l: A.fmt(lost) })}`;
      };
      const out = anon ? [b(t("rp.title"))] : [b(r.title || t("rp.title")) + (r.date ? ` · ${r.date}` : "")];
      out.push(...r.blocks.map(line));
      if (r.loot) out.push(`${t("rp.loot")}: ${A.fmt(s.lootTotal)} (${r.loot.res.map((n) => A.fmt(n)).join(" / ")})`);
      if (s.lostRes) out.push(`${t("rp.lostRes")}: ${A.fmt(s.lostRes.a)} / ${A.fmt(s.lostRes.d)}`);
      return out.join("\n");
    };
    const analyse = () => {
      const text = ta.value;
      A.store.set(key, text);
      const r = text.trim() ? A.parseReport(text) : null;
      A.$("#rp-res", root).style.display = r ? "" : "none";
      if (!r) { st.r = null; A.$("#rp-sum", root).innerHTML = text.trim() ? A.ui.empty(t("rp.none"), t("rp.noneSub")) : A.ui.empty(t("rp.empty"), t("rp.emptySub")); return; }
      const s = A.reportSummary(r);
      st.r = r; st.s = s;
      const fk = (cls, value, label) => `<div class="fk ${cls}"><b>${value}</b><span>${A.esc(label)}</span></div>`;
      A.$("#rp-sum", root).innerHTML = `<div class="row" style="flex-wrap:wrap;margin-bottom:10px"><span class="pill ${OUT[s.outcome]}">${A.esc(t("rp.o." + s.outcome))}</span> <b>${A.esc(r.title || "")}</b> <span class="muted mono">${A.esc(r.date || "")}</span></div>
        <div class="farm-kpis">
          ${fk(s.net != null && s.net < 0 ? "inactive" : "active", s.net != null ? A.signed(s.net) : "—", t("rp.net"))}
          ${fk("natar", s.lootTotal != null ? A.fmt(s.lootTotal) : "—", t("rp.loot"))}
          ${fk("natar", s.fill != null ? pct(Math.round(s.fill)) : "—", t("rp.fill"))}
          ${fk(s.atk.lost ? "slowing" : "active", pct(s.atk.pct == null ? null : Math.round(s.atk.pct)), t("rp.atkLost"))}
          ${fk("natar", pct(s.def.pct == null ? null : Math.round(s.def.pct)), t("rp.defLost"))}
        </div>
        <ul class="farm-notes">
          ${s.notes.map((k) => `<li>${t(k, { n: A.fmt(s.lootTotal), l: A.fmt(s.lostRes?.a) })}</li>`).join("")}
          ${r.info ? `<li>${A.esc(r.info)}</li>` : ""}
        </ul>
        <div class="row" style="flex-wrap:wrap;margin-top:12px"><label class="check"><input type="checkbox" id="rp-anon">${t("rp.anon")}</label><span style="margin-left:auto"></span><button class="btn sm" id="rp-bb">${A.icon("copy")}BBCode</button><button class="btn sm" id="rp-dc">${A.icon("copy")}Discord</button></div>`;
      const copy = (fmt) => A.copy(shareText(fmt, A.$("#rp-anon", root).checked), t("rp.copied"));
      A.$("#rp-bb", root).onclick = () => copy("bb");
      A.$("#rp-dc", root).onclick = () => copy("dc");
      const rows = r.blocks.flatMap((b, i) => {
        const units = b.units.map((u, x) => ({ u, sent: b.rows[0][x], lost: b.rows[1]?.[x] ?? 0 })).filter((x) => x.sent);
        const head = `<tr><td colspan="4"><b>${t(i ? "rp.def" : "rp.atk")}</b> · ${whoHtml(b.who)}</td></tr>`;
        return [head, ...(units.length ? units.map((x) => `<tr><td>${A.esc(x.u)}</td><td class="r">${A.fmt(x.sent)}</td><td class="r">${A.fmt(x.lost)}</td><td class="r">${pct(Math.round((x.lost / x.sent) * 100))}</td></tr>`) : [`<tr><td colspan="4" class="muted">${t("rp.noTroops")}</td></tr>`])];
      });
      A.$("#rp-troops", root).innerHTML = `<table class="t"><thead><tr><th>${t("rp.unit")}</th><th class="r">${t("rp.sent")}</th><th class="r">${t("rp.lost")}</th><th class="r">%</th></tr></thead><tbody>${rows.join("")}</tbody></table>`;
      A.$("#rp-stats", root).innerHTML = r.stats.length ? `<table class="t"><thead><tr><th></th><th class="r">${t("rp.atk")}</th><th class="r">${t("rp.def")}</th></tr></thead><tbody>${r.stats.map((x) => `<tr><td>${A.esc(x.label)}</td><td class="r">${A.fmt(x.a)}</td><td class="r">${A.fmt(x.d)}</td></tr>`).join("")}</tbody></table>` : A.ui.empty(t("rp.noStats"));
    };
    A.$("#rp-go", root).onclick = analyse;
    A.$("#rp-clear", root).onclick = () => { ta.value = ""; analyse(); ta.focus(); };
    ta.onpaste = () => setTimeout(analyse, 0);
    if (ta.value.trim()) analyse();
  };

  /* ================= VECINDARIO ================= */
  A.views.neighbours = (root) => {
    const w = A.state.world, h = A.state.home;
    const saved = A.store.get("nb", {});
    const st = { c: saved.c || (h ? `${h.x}|${h.y}` : ""), r: saved.r || 15, recruit: false, sort: "threat", dir: -1, limit: 100 };
    root.innerHTML = A.head(t("nb.title"), t("nb.sub"), `<button class="btn" id="nb-map">${A.icon("map")}${t("inact.onMap")}</button>`) +
      `<div class="card card-b"><div class="row" style="flex-wrap:wrap;gap:16px;align-items:flex-end">
          <div class="field" style="flex:1;min-width:180px"><label for="nb-c">${t("nb.centre")}</label><input class="input mono" id="nb-c" value="${A.esc(st.c)}" placeholder="-65|-23 · ${A.esc(t("tools.toPh"))}" list="nb-pl"><datalist id="nb-pl">${w.players.slice(0, 300).map((p) => `<option value="${A.esc(p.name)}">`).join("")}</datalist></div>
          <div class="field" style="flex:2;min-width:200px"><label for="nb-r">${t("nb.radius")} <span class="range-val"><span id="nb-rv">${st.r}</span> ${t("common.fields")}</span></label><input type="range" id="nb-r" min="3" max="60" value="${st.r}"></div>
          <label class="check"><input type="checkbox" id="nb-rec">${t("nb.recruit")}</label>
        </div></div>
      <div class="grid g-kpi" id="nb-kpi"></div>
      <div class="grid g-2e">
        <div class="card"><div class="card-h"><h2>${t("nb.alliances")}</h2><span class="sub">${t("nb.alliancesSub")}</span></div><div class="table-wrap card-b" id="nb-al"></div></div>
        <div class="card"><div class="card-h"><h2>${t("nb.events")}</h2><span class="sub">${t("nb.eventsSub")}</span></div><div class="feed" id="nb-ev" style="max-height:340px;overflow:auto;margin-top:6px"></div></div>
      </div>
      <div class="card"><div class="card-h"><h2 id="nb-pl-h">${t("nb.players")}</h2><span class="sub" id="nb-pl-sub"></span></div>
        <div class="table-wrap card-b" style="max-height:calc(100vh - 220px);overflow:auto"><table class="t" id="nb-t"><thead></thead><tbody></tbody></table></div>
        <div class="row" style="justify-content:center;padding:0 0 14px" id="nb-more"></div></div>`;
    const table = A.$("#nb-t", root);
    let zone = null, c = null;
    const render = () => {
      c = resolve(w, st.c);
      A.store.set("nb", { c: st.c, r: st.r });
      if (!c) {
        A.$("#nb-kpi", root).innerHTML = `<div class="card card-b" style="grid-column:1/-1">${A.ui.empty(t("nb.noCentre"), t("nb.noCentreSub"))}</div>`;
        ["#nb-al", "#nb-ev"].forEach((s) => (A.$(s, root).innerHTML = ""));
        table.querySelector("thead").innerHTML = table.querySelector("tbody").innerHTML = "";
        return;
      }
      zone = A.neighbourhood(w, c, st.r);
      const P = zone.players;
      const cnt = (s) => P.filter((e) => e.p.status === s).length;
      const k = (label, value, note = "") => `<div class="card kpi"><span class="label">${A.esc(label)}</span><span class="value">${value}</span><span class="delta muted">${A.esc(note)}</span></div>`;
      A.$("#nb-kpi", root).innerHTML = k(t("common.players"), A.fmt(P.length), t("nb.within", { r: st.r, c: A.coord(c.x, c.y) })) + k(t("common.villages"), A.fmt(zone.vids.size)) +
        k(t("dash.population"), A.compact(zone.pop)) + k(t("status.active"), A.fmt(cnt("active") + cnt("new")), t("nb.activeNote")) + k(t("status.inactive"), A.fmt(cnt("inactive")), cnt("unknown") ? t("nb.unknownNote", { n: cnt("unknown") }) : "");
      const al = zone.alliances.slice(0, 12);
      A.$("#nb-al", root).innerHTML = al.length ? `<table class="t"><thead><tr><th>${t("common.alliance")}</th><th class="r">${t("common.players")}</th><th class="r">${t("common.villagesShort")}</th><th class="r">${t("common.pop")}</th><th>${t("nb.share")}</th><th class="r">${t("dash.d7")}</th></tr></thead><tbody>
        ${al.map((a) => { const share = zone.pop ? (a.pop / zone.pop) * 100 : 0; const g = w.aById.get(a.aid);
          return `<tr><td>${a.aid > 0 ? A.ui.ally(a.aid) : `<span class="muted">${t(a.aid < 0 ? "tribe.natars" : "map.noAlly")}</span>`}</td><td class="r">${a.players}${w.days.length > 1 ? ` <span class="muted">(${a.active} ${t("nb.act")})</span>` : ""}</td><td class="r">${a.villages}</td><td class="r">${A.fmt(a.pop)}</td><td><span class="share"><i style="width:${share.toFixed(1)}%"></i></span> <span class="mono muted">${A.fmt(share, 0)} %</span></td><td class="r">${g ? A.ui.delta(g.d7) : "—"}</td></tr>`; }).join("")}</tbody></table>` : A.ui.empty(t("common.noResults"));
      const ev = A.state.events.filter((e) => e.x != null && A.dist(c.x, c.y, e.x, e.y, w.R) <= st.r);
      A.$("#nb-ev", root).innerHTML = ev.length ? A.eventRows(ev.slice(0, 60), { compact: true }) : `<div class="card-b">${A.ui.empty(t("ev.none"), w.days.length < 2 ? t("nb.eventsWait") : "")}</div>`;
      players();
    };
    const players = () => {
      const me = h && w.vAt.get(h.x + "," + h.y)?.uid;
      let rows = zone.players.filter((e) => e.p.status !== "natar" && e.p.uid !== me);
      if (st.recruit) rows = rows.filter((e) => !e.p.aid && e.p.status !== "inactive");
      rows.forEach((e) => { e.threat = A.threat(e); const i = A.fastestRaider(e.p.tid); e.eta = A.travel(e.dist, (A.UNITS[e.p.tid] || A.UNITS[1])[i][2], { serverSpeed: A.troopSpeed(w.server.speed) }); e.raider = i; });
      A.$("#nb-pl-h", root).textContent = st.recruit ? t("nb.recruitTitle") : t("nb.players");
      A.$("#nb-pl-sub", root).textContent = st.recruit ? t("nb.recruitSub", { n: rows.length }) : t("nb.playersSub", { n: rows.length });
      const cols = [
        { k: "threat", label: t("nb.threat"), cls: "r", sort: (e) => e.threat },
        { k: "player", label: t("common.player"), sort: (e) => e.p.name.toLowerCase() },
        { k: "ally", label: t("common.alliance"), sort: (e) => e.p.tag },
        { k: "pop", label: t("nb.popZone"), cls: "r", sort: (e) => e.pop },
        { k: "n", label: t("nb.villZone"), cls: "r", sort: (e) => e.n },
        { k: "dist", label: t("nb.nearest"), cls: "r", sort: (e) => e.dist },
        { k: "eta", label: t("nb.eta"), cls: "r", sort: (e) => e.eta },
        { k: "d7", label: t("dash.d7"), cls: "r", sort: (e) => e.p.d7 ?? -1e9 },
        { k: "status", label: t("common.status"), sort: (e) => e.p.status },
        { k: "act", label: "" },
      ];
      A.ui.sortable(table, rows, cols, st, players);
      table.querySelector("tbody").innerHTML = rows.slice(0, st.limit).map((e) => `<tr>
          <td class="r"><b class="num">${e.threat.toFixed(1)}</b></td>
          <td>${A.ui.tribe(e.p.tid, false)} ${A.ui.player(e.p)}</td><td>${A.ui.ally(e.p.aid)}</td>
          <td class="r">${A.fmt(e.pop)}${e.pop !== e.p.pop ? ` <span class="muted">/ ${A.compact(e.p.pop)}</span>` : ""}</td><td class="r">${e.n}${e.n !== e.p.villages ? ` <span class="muted">/ ${e.p.villages}</span>` : ""}</td>
          <td class="r">${A.ui.coord(e.near.x, e.near.y)} <span class="num">${A.fmt(e.dist, 1)}</span></td>
          <td class="r mono" title="${A.esc(A.unitName(e.p.tid, e.raider))}">${A.dur(e.eta)}</td>
          <td class="r">${A.ui.delta(e.p.d7)}</td><td>${A.ui.pill(e.p.status)}</td>
          <td>${A.ui.game("player", e.p.uid)}${A.ui.star("player", e.p.uid)}</td></tr>`).join("") || `<tr><td colspan="10">${A.ui.empty(t("common.noResults"))}</td></tr>`;
      A.$("#nb-more", root).innerHTML = rows.length > st.limit ? `<button class="btn" id="nb-mb">${t("common.showMore", { n: rows.length - st.limit })}</button>` : "";
    };
    A.$("#nb-c", root).oninput = A.debounce((e) => { st.c = e.target.value; render(); }, 200);
    A.$("#nb-r", root).oninput = A.debounce((e) => { st.r = +e.target.value; A.$("#nb-rv", root).textContent = st.r; render(); }, 60);
    A.$("#nb-rec", root).onchange = (e) => { st.recruit = e.target.checked; if (st.recruit) { st.sort = "dist"; st.dir = 1; } players(); };
    A.$("#nb-more", root).onclick = (e) => { if (e.target.closest("#nb-mb")) { st.limit += 150; players(); } };
    A.$("#nb-map", root).onclick = () => { if (!c) return; A.mapPreset = { ring: { x: c.x, y: c.y, r: st.r }, targets: zone.vids }; location.hash = "map"; };
    render();
  };

  /* ================= PUNTOS DE CULTURA (tarjeta de Herramientas) ================= */
  A.mountCulture = (card) => {
    const key = "culture:" + A.state.sid;
    const st = { have: "", need: "", perDay: "", ...A.store.get(key, {}) };
    const field = (k, ph) => `<div class="field"><label for="cp-${k}">${t("cp." + k)}</label><input class="input num" type="number" min="0" id="cp-${k}" value="${A.esc(st[k])}" placeholder="${ph}"></div>`;
    card.innerHTML = `<div class="card-h"><h2>${t("cp.title")}</h2><span class="sub">${t("cp.sub")}</span></div>
      <div class="card-b">
        <div class="fgrid cols-3">${field("have", "1200")}${field("need", "2000")}${field("perDay", "150")}</div>
        <div id="cp-out"></div>
      </div>`;
    const $ = (s) => A.$(s, card);
    const render = () => {
      const r = A.cultureEta({ have: st.have === "" ? NaN : +st.have, need: st.need === "" ? NaN : +st.need, perDay: +st.perDay, now: Date.now() });
      if (!r) { $("#cp-out").innerHTML = `<div class="muted">${t("cp.enter")}</div>`; return; }
      if (!r.missing) { $("#cp-out").innerHTML = `<div class="explain">${t("cp.ready")}</div>`; return; }
      if (!r.at) { $("#cp-out").innerHTML = `<div class="explain">${t("cp.noProd", { n: A.fmt(r.missing) })}</div>`; return; }
      $("#cp-out").innerHTML = `<div class="explain"><b>${t("cp.days", { d: A.fmt(r.days, 1) })}</b><br>${t("cp.result", { n: A.fmt(r.missing), at: A.esc(r.at.toLocaleString(A.locale(), { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })) })}</div>`;
    };
    ["have", "need", "perDay"].forEach((k) => ($("#cp-" + k).oninput = (e) => { st[k] = e.target.value; A.store.set(key, st); render(); }));
    render();
  };

  /* ================= ATAQUE ENTRANTE (tarjeta de Herramientas) ================= */
  const pad = (n) => String(n).padStart(2, "0");
  const localInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  const clock = (d) => d.toLocaleTimeString(A.locale(), { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  A.mountIncoming = (card) => {
    const w = A.state.world, h = A.state.home;
    const now = new Date();
    const st = { tid: 1, ts: 0, art: 1, auto: true };
    card.innerHTML = `<div class="card-h"><h2>${t("inc.title")}</h2><span class="sub">${t("inc.sub")}</span></div>
      <div class="card-b">
        <div class="fgrid">
          <div class="field"><label for="inc-from">${t("inc.from")}</label><input class="input mono" id="inc-from" placeholder="(-53|-19) · ${A.esc(t("tools.toPh"))}" list="tl-pl"></div>
          <div class="field"><label for="inc-to">${t("inc.to")}</label><input class="input mono" id="inc-to" value="${h ? `${h.x}|${h.y}` : ""}"></div>
        </div>
        <div class="fgrid cols-3 roomy">
          <div class="field"><label for="inc-eta">${t("inc.eta")}</label><input class="input mono" id="inc-eta" placeholder="0:41:11"></div>
          <div class="field"><label for="inc-at">${t("inc.arrival")}</label><input class="input mono" type="datetime-local" step="1" id="inc-at" value="${localInput(new Date(now.getTime() + 3600e3))}"></div>
          <div class="field full-sm"><label for="inc-seen">${t("inc.seen")}</label><div class="input-group"><input class="input mono" type="datetime-local" step="1" id="inc-seen" value="${localInput(now)}"><button class="btn" id="inc-now" type="button">${t("inc.now")}</button></div></div>
        </div>
        <div class="fgrid cols-3">
          <div class="field full-sm"><label for="inc-tid">${t("inc.tribe")}</label><select class="input" id="inc-tid">${A.PLAYABLE.map((tid) => `<option value="${tid}">${A.esc(t("tribe." + A.TRIBES[tid].key))}</option>`).join("")}</select></div>
          <div class="field"><label for="inc-ts">${t("inc.ts")}</label><input class="input num" type="number" min="0" max="20" id="inc-ts" value="0"></div>
          <div class="field"><label for="inc-art">${t("inact.art")}</label><select class="input" id="inc-art">${[1, 1.5, 2, 3].map((x) => `<option value="${x}">×${x}</option>`).join("")}</select></div>
        </div>
        <div id="inc-who"></div>
        <div id="inc-verdict"></div>
        <div id="inc-fake"></div>
        <div class="unit-grid" id="inc-units"></div>
        <div class="row"><button class="btn" id="inc-add" type="button" disabled>${A.icon("plus")}${t("inc.add")}</button></div>
        <details class="paste-box" id="inc-rally"><summary>${A.icon("download")}<b>${t("inc.rally")}</b><span class="muted">${t("inc.rallySub")}</span></summary>
          <ol class="steps">${t("inc.rallyHow")}</ol>
          <textarea class="input" id="inc-rally-ta" style="min-height:90px" aria-label="${A.esc(t("inc.rally"))}" placeholder="Roma	b0b ataca A-00
(-12|45)
Tropas	?	?	?…
Llegada
en 1:02:03 h."></textarea>
          <div class="row"><button class="btn" id="inc-rally-go" type="button">${A.icon("plus")}${t("inc.rallyGo")}</button></div>
          <div class="muted" style="font-size:12.5px">${t("inc.rallyNote")}</div>
        </details>
        <div id="inc-list"></div>
      </div>`;
    const $ = (s) => A.$(s, card);
    const LEVEL = { fake: "slowing", unclear: "natar", real: "inactive" };
    const levelPill = (l) => `<span class="pill ${LEVEL[l]}">${A.esc(t("inc.lv." + l))}</span>`;
    const when = (ms) => new Date(ms).toLocaleString(A.locale(), { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const sameAttack = (x, y) => x.arrival === y.arrival && x.from.x === y.from.x && x.from.y === y.from.y && x.to.x === y.to.x && x.to.y === y.to.y;
    const key = "incoming:" + A.state.sid;
    const list = A.store.get(key, []).filter((x) => x.arrival > Date.now() - 3600e3); // los ya llegados no aportan
    let cur = null;
    const renderList = () => {
      $("#inc-add").disabled = !cur;
      if (!list.length) { $("#inc-list").innerHTML = `<div class="muted">${t("inc.listEmpty")}</div>`; return; }
      const rows = A.assessAttacks(list, w).map((r, i) => ({ ...r, i })).sort((x, y) => x.arrival - y.arrival);
      $("#inc-list").innerHTML = `<div class="row" style="justify-content:space-between;margin-bottom:6px"><b>${t("inc.listTitle", { n: list.length })}</b><button class="btn ghost sm" id="inc-clear">${t("inc.clear")}</button></div>
        <div class="table-wrap"><table class="t"><thead><tr><th>${t("inc.c.arrival")}</th><th>${t("inc.c.from")}</th><th>${t("inc.c.to")}</th><th>${t("inc.c.unit")}</th><th>${t("inc.c.signals")}</th><th></th></tr></thead><tbody>
        ${rows.map((r) => `<tr><td class="mono">${when(r.arrival)}</td>
          <td>${A.ui.coord(r.from.x, r.from.y)} ${r.v ? `<span class="muted">${A.esc(r.v.name)}</span> ` : ""}${A.ui.player(r.p)}</td>
          <td>${A.ui.coord(r.to.x, r.to.y)}</td>
          <td>${A.esc(r.best.map((i) => A.unitName(r.tid, i)).join(" / ")) || "—"}</td>
          <td>${levelPill(r.level)} ${r.signals.map((s) => `<span class="chip" title="${A.esc(t("inc.s." + s.k, s))}">${A.esc(t("inc.sh." + s.k, s))}</span>`).join(" ")}</td>
          <td class="r"><button class="btn ghost sm" data-del-inc="${r.i}" aria-label="${A.esc(t("inc.del"))}">×</button></td></tr>`).join("")}
        </tbody></table></div>`;
    };
    const renderFake = () => {
      if (!cur) { $("#inc-fake").innerHTML = ""; return; }
      const r = list.some((x) => sameAttack(x, cur)) ? A.assessAttacks(list, w).find((x) => sameAttack(x, cur)) : A.assessAttacks([...list, cur], w).pop();
      const body = r.signals.length ? `<ul>${r.signals.map((s) => `<li>${A.esc(t("inc.s." + s.k, s))}</li>`).join("")}</ul>` : `<div>${t("inc.noSignals")}</div>`;
      $("#inc-fake").innerHTML = `<div class="explain ${r.level === "real" ? "bad" : ""}"><b>${t("inc.fakeTitle")}</b> ${levelPill(r.level)}${body}<div class="muted" style="margin-top:6px">${t("inc.caveat")}</div></div>`;
    };
    const render = () => {
      const a = resolve(w, $("#inc-from").value), b = resolve(w, $("#inc-to").value);
      const v = a && w.vAt.get(a.x + "," + a.y);
      if (v && st.auto && A.UNITS[v.tid]) { st.tid = v.tid; $("#inc-tid").value = v.tid; }
      const p = v && w.pById.get(v.uid);
      $("#inc-who").innerHTML = p ? `<div class="who">${A.ui.tribe(p.tid, false)} <b>${A.esc(v.name)}</b> ${A.ui.coord(v.x, v.y)} · ${A.ui.player(p)} ${A.ui.ally(p.aid)} <span class="muted">· ${A.fmt(v.pop)} ${t("common.pop").toLowerCase()} · ${p.villages} ${t("common.villagesShort").toLowerCase()}</span> ${A.ui.pill(p.status)} ${A.ui.game("player", p.uid)}</div>` : "";
      const arrival = new Date($("#inc-at").value), seen = new Date($("#inc-seen").value);
      if (!a || !b || isNaN(arrival) || isNaN(seen)) { cur = null; $("#inc-verdict").innerHTML = ""; $("#inc-units").innerHTML = `<div class="muted">${t("inc.enter")}</div>`; renderFake(); renderList(); return; }
      const dist = A.dist(a.x, a.y, b.x, b.y, w.R);
      const r = A.inferIncoming({ dist, arrival: arrival.getTime(), seen: seen.getTime(), tid: st.tid, serverSpeed: A.troopSpeed(w.server.speed), ts: st.ts, art: st.art });
      cur = { from: { x: a.x, y: a.y }, to: { x: b.x, y: b.y }, arrival: arrival.getTime(), kind: r.kind, tid: st.tid, best: r.best.map((u) => u.i) };
      const names = r.best.map((u) => A.unitName(st.tid, u.i)).join(" / ");
      $("#inc-verdict").innerHTML = `<div class="explain ${r.kind === "chief" || r.kind === "siege" ? "bad" : ""}"><b>${A.fmt(dist, 2)} ${t("common.fields")} · ${t("inc.min", { d: A.dur(Math.max(0, r.need)) })}</b><br>${r.kind ? t("inc.v." + r.kind, { u: A.esc(names) }) : t("inc.v.none")}</div>`;
      $("#inc-units").innerHTML = r.units.map((u) => `<div class="unit ${u.best ? "best" : ""} ${u.possible ? "" : "off"}"><b>${A.esc(A.unitName(st.tid, u.i))}</b><span class="tt">${A.dur(u.sec)}</span>
        <span class="arr">${u.possible ? `${t("inc.left")} ${clock(u.launch)}` : t("inc.impossible")}${u.best ? " · " + t("inc.likely") : ""}</span></div>`).join("");
      renderFake();
      renderList();
    };
    const save = () => { A.store.set(key, list); renderFake(); renderList(); };
    $("#inc-add").onclick = () => { if (cur) { list.push(cur); save(); } };
    /* Importa los movimientos pegados de la plaza de reuniones. Los que salen de la aldea de destino o de cualquier
       aldea tuya son tropas propias y se descartan; del resto se deduce la unidad igual que al escribirlos a mano. */
    const importRally = () => {
      const moves = A.parseRallyPoint($("#inc-rally-ta").value);
      const fallback = resolve(w, $("#inc-to").value);
      const seen = Date.now();
      const me = h ? w.vAt.get(h.x + "," + h.y)?.uid : null; // las aldeas del propio jugador no atacan
      let added = 0, skipped = 0;
      for (const m of moves) {
        const to = m.to || fallback;
        const v = w.vAt.get(m.from.x + "," + m.from.y);
        const own = (to && m.from.x === to.x && m.from.y === to.y) || (h && m.from.x === h.x && m.from.y === h.y) || (me != null && v?.uid === me);
        if (!to || own) { skipped++; continue; }
        const tid = v && A.UNITS[v.tid] ? v.tid : st.tid;
        const arrival = seen + m.eta * 1000;
        const r = A.inferIncoming({ dist: A.dist(m.from.x, m.from.y, to.x, to.y, w.R), arrival, seen, tid, serverSpeed: A.troopSpeed(w.server.speed), ts: st.ts, art: st.art });
        const att = { from: m.from, to: { x: to.x, y: to.y }, arrival, kind: r.kind, tid, best: r.best.map((u) => u.i) };
        if (list.some((x) => x.from.x === att.from.x && x.from.y === att.from.y && x.to.x === att.to.x && x.to.y === att.to.y && Math.abs(x.arrival - att.arrival) < 3000)) { skipped++; continue; }
        list.push(att); added++;
      }
      A.toast(moves.length ? t("inc.rallyDone", { n: added, s: skipped }) : t("inc.rallyNone"));
      if (added) { $("#inc-rally-ta").value = ""; save(); }
    };
    $("#inc-rally-go").onclick = importRally;
    $("#inc-list").onclick = (e) => {
      if (e.target.closest("#inc-clear")) { list.length = 0; save(); return; }
      const d = e.target.closest("[data-del-inc]");
      if (d) { list.splice(+d.dataset.delInc, 1); save(); }
    };
    $("#inc-eta").oninput = A.debounce((e) => {
      const m = e.target.value.match(/(\d+):(\d{2}):(\d{2})/); if (!m) return;
      const n = new Date();
      $("#inc-at").value = localInput(new Date(n.getTime() + ((+m[1] * 60 + +m[2]) * 60 + +m[3]) * 1000));
      $("#inc-seen").value = localInput(n);
      render();
    }, 150);
    ["#inc-from", "#inc-to", "#inc-at", "#inc-seen"].forEach((s) => ($(s).oninput = A.debounce(render, 150)));
    $("#inc-now").onclick = () => { $("#inc-seen").value = localInput(new Date()); render(); };
    $("#inc-tid").onchange = (e) => { st.tid = +e.target.value; st.auto = false; render(); };
    $("#inc-ts").oninput = (e) => { st.ts = Math.max(0, Math.min(20, +e.target.value || 0)); render(); };
    $("#inc-art").onchange = (e) => { st.art = +e.target.value; render(); };
    render();
  };
})();
