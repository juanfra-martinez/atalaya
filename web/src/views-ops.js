/* Vista: planificador de operaciones (oleadas con llegada común, enlace compartible y exportación). */
"use strict";
(() => {
  const A = window.A;
  const t = (...a) => A.t(...a);
  const pad = (n) => String(n).padStart(2, "0");
  /* datetime-local trabaja sin zona: en modo UTC se escribe y se lee como hora UTC. */
  const toInput = (ms, utc) => { const d = new Date(ms); return utc
    ? `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
    : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };
  const fromInput = (s, utc) => { const ms = Date.parse(utc ? s + (s.length === 16 ? ":00" : "") + "Z" : s); return isNaN(ms) ? null : ms; };

  A.views.ops = (root) => {
    const w = A.state.world, h = A.state.home;
    const key = "ops:" + A.state.sid;
    const q = new URLSearchParams(location.hash.split("?")[1] || "");
    const shared = q.get("o") ? A.opsDecode(q.get("o")) : null;
    const sw = q.get("w");
    /* Un enlace de otro mundo: se cambia a ese mundo (si Atalaya lo tiene) y se vuelve a pintar. */
    if (shared && sw && sw !== A.state.sid && A.state.servers.some((s) => s.id === sw && A.hasData(s))) { A.selectWorld(sw).then((ok) => ok && A.route()); return; }
    if (q.get("o") && !shared) A.toast(t("ops.badLink"));
    let op = shared || A.store.get(key, null) || A.opsNew(w);
    if (!Array.isArray(op.rows)) op = A.opsNew(w);
    const st = { utc: A.store.get("opsUtc", false), guest: !!shared };
    const save = () => { if (!st.guest) A.store.set(key, op); };
    const clock = (ms) => new Date(ms).toLocaleString(A.locale(), { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", ...(st.utc ? { timeZone: "UTC" } : {}) }) + (st.utc ? " UTC" : "");
    const worldMismatch = shared && sw && sw !== A.state.sid;

    root.innerHTML = A.head(t("ops.title"), t("ops.sub"), `<button class="btn" id="op-link">${A.icon("external")}${t("ops.link")}</button><button class="btn" id="op-dc">${A.icon("copy")}Discord</button><button class="btn" id="op-bb">${A.icon("copy")}BBCode</button>`) +
      `${st.guest ? `<div class="demo-ribbon" id="op-guest">${A.icon("flag").replace("<svg", '<svg width="16" height="16"')}<span>${t(worldMismatch ? "ops.guestOther" : "ops.guest")}</span><span style="margin-left:auto" class="row"><button class="btn sm primary" id="op-adopt">${t("ops.adopt")}</button><button class="btn sm" id="op-mine">${t("ops.mine")}</button></span></div>` : ""}
      <div class="card tool"><div class="card-b">
        <div class="fgrid cols-4">
          <div class="field"><label for="op-name">${t("ops.name")}</label><input class="input" id="op-name" maxlength="60" value="${A.esc(op.name)}" placeholder="${A.esc(t("ops.namePh"))}"></div>
          <div class="field"><label for="op-land">${t("ops.land")}</label><input class="input mono" type="datetime-local" step="1" id="op-land"></div>
          <div class="field"><label for="op-speed">${t("ops.speed")}</label><input class="input num" type="number" min="1" max="10" step="1" id="op-speed" value="${op.speed}"></div>
          <div class="field"><span class="lbl">${t("ops.clock")}</span><div class="seg full" id="op-utc"><button data-v="0" aria-pressed="${!st.utc}">${t("ops.local")}</button><button data-v="1" aria-pressed="${st.utc}">UTC</button></div></div>
        </div>
        <div class="farm-kpis" id="op-kpi"></div>
      </div></div>
      <div class="card"><div class="card-h"><h2>${t("ops.waves")}</h2><span class="sub">${t("ops.wavesSub")}</span><span class="right row"><button class="btn sm primary" id="op-add">${A.icon("plus")}${t("ops.add")}</button><button class="btn sm ghost" id="op-clear">${t("ops.clear")}</button></span></div>
        <div class="table-wrap card-b"><table class="t ops-t" id="op-t"><thead><tr><th>${t("ops.c.kind")}</th><th>${t("ops.c.who")}</th><th>${t("tools.from")}</th><th>${t("tools.to")}</th><th>${t("ops.c.unit")}</th><th title="${A.esc(t("inact.ts"))}">${t("ops.c.ts")}</th><th title="${A.esc(t("ops.offsetTip"))}">${t("ops.c.offset")}</th><th class="r">${t("inact.dist")}</th><th class="r">${t("inact.time")}</th><th class="r">${t("ops.c.send")}</th><th class="r">${t("ops.c.in")}</th><th></th></tr></thead><tbody></tbody></table></div>
        <datalist id="op-pl">${w.players.slice(0, 400).map((p) => `<option value="${A.esc(p.name)}">`).join("")}</datalist>
        <div class="card-b" id="op-empty"></div></div>
      <div class="card"><div class="card-h"><h2>${t("tools.notes")}</h2></div><div class="card-b notes-grid"><div class="explain">${t("ops.noteLink")}</div><div class="explain">${t("ops.noteTime")}</div><div class="explain">${t("ops.noteSpeed")}</div><div class="explain">${t("ops.noteOffset")}</div></div></div>`;
    const $ = (s) => A.$(s, root);
    const body = $("#op-t tbody");
    $("#op-land").value = toInput(op.land, st.utc);

    const placeInfo = (c, v, p) => (!c ? `<span class="down">${t("ops.unknown")}</span>` : v ? `${A.ui.tribe(v.tid, false)} <span class="muted">${A.esc(v.name)}</span> ${p ? A.ui.player(p) : ""}` : `<span class="muted">${A.coord(c.x, c.y)} · ${t("pal.empty")}</span>`);
    const count = (x, now) => {
      if (!x.ok) return "";
      const d = (x.send - now) / 1000;
      return d <= 0 ? `<span class="down">${t("tools.late")}</span>` : `<span class="${d < 600 ? "up" : ""}">${A.dur(d)}</span>`;
    };
    const kpis = (plan) => {
      const s = A.opsSummary(plan);
      const fk = (cls, v, label) => `<div class="fk ${cls}"><b>${v}</b><span>${A.esc(label)}</span></div>`;
      $("#op-kpi").innerHTML = fk("natar", s.ok, t("ops.k.waves")) + fk("inactive", s.real, t("ops.k.real")) + fk("slowing", s.fake, t("ops.k.fake")) + fk("natar", s.targets, t("ops.k.targets")) +
        fk(s.late ? "inactive" : "active", s.first == null ? "—" : s.first <= Date.now() ? t("tools.late") : A.dur((s.first - Date.now()) / 1000), t("ops.k.first"));
    };
    /* Solo las celdas calculadas: no se tocan los campos mientras el usuario escribe en ellos. */
    const refresh = () => {
      const plan = A.planOps(op, w), now = Date.now();
      for (const x of plan) {
        const tr = body.children[x.i]; if (!tr) continue;
        const set = (c, html) => { const el = tr.querySelector(`[data-c="${c}"]`); if (el && el.innerHTML !== html) el.innerHTML = html; };
        set("fi", placeInfo(x.from, x.v, x.p)); set("ti", placeInfo(x.to, x.tv, x.tp));
        set("dist", x.ok ? A.fmt(x.dist, 1) : "—"); set("sec", x.ok ? A.dur(x.sec) : "—");
        set("send", x.ok ? `<b>${A.esc(clock(x.send))}</b><br><span class="muted">${t("ops.lands")} ${A.esc(clock(x.land))}</span>` : `<span class="muted">${t("ops.fill")}</span>`);
        set("count", count(x, now));
      }
      kpis(plan);
    };
    const render = () => {
      const plan = A.planOps(op, w);
      body.innerHTML = plan.map((x) => { const r = x.r; return `<tr data-i="${x.i}" data-tid="${x.tid}">
        <td><select class="input" data-f="kind" aria-label="${A.esc(t("ops.c.kind"))}"><option value="real" ${r.kind !== "fake" ? "selected" : ""}>${t("ops.real")}</option><option value="fake" ${r.kind === "fake" ? "selected" : ""}>${t("ops.fake")}</option></select></td>
        <td><input class="input" data-f="who" value="${A.esc(r.who)}" maxlength="40" placeholder="${A.esc(t("common.player"))}" list="op-pl" aria-label="${A.esc(t("ops.c.who"))}"></td>
        <td><input class="input mono" data-f="from" value="${A.esc(r.from)}" placeholder="x|y" aria-label="${A.esc(t("tools.from"))}"><div class="ops-info" data-c="fi"></div></td>
        <td><input class="input mono" data-f="to" value="${A.esc(r.to)}" placeholder="x|y" list="op-pl" aria-label="${A.esc(t("tools.to"))}"><div class="ops-info" data-c="ti"></div></td>
        <td>${x.v ? "" : `<select class="input" data-f="tid" aria-label="${A.esc(t("common.tribe"))}">${A.PLAYABLE.map((tid) => `<option value="${tid}" ${tid === x.tid ? "selected" : ""}>${A.esc(t("tribe." + A.TRIBES[tid].key))}</option>`).join("")}</select>`}
          <select class="input" data-f="unit" aria-label="${A.esc(t("ops.c.unit"))}">${A.UNITS[x.tid].slice(0, 9).map((u, i) => `<option value="${i}" ${i === x.unit ? "selected" : ""}>${A.esc(A.unitName(x.tid, i))} · ${u[2]}</option>`).join("")}</select></td>
        <td><input class="input num" type="number" min="0" max="20" data-f="ts" value="${+r.ts || 0}" aria-label="${A.esc(t("inact.ts"))}"></td>
        <td><input class="input num" type="number" step="1" data-f="offset" value="${+r.offset || 0}" aria-label="${A.esc(t("ops.c.offset"))}"></td>
        <td class="r num" data-c="dist"></td><td class="r mono" data-c="sec"></td><td class="r mono" data-c="send"></td><td class="r mono" data-c="count"></td>
        <td class="ops-act"><button class="btn ghost sm" data-dup title="${A.esc(t("ops.dup"))}" aria-label="${A.esc(t("ops.dup"))}">${A.icon("copy")}</button><button class="btn ghost sm" data-del title="${A.esc(t("common.delete"))}" aria-label="${A.esc(t("common.delete"))}">${A.icon("trash")}</button>${x.to ? A.ui.game("send", x.to.x, x.to.y) : ""}</td></tr>`; }).join("");
      $("#op-empty").innerHTML = op.rows.length ? "" : A.ui.empty(t("ops.empty"), t("ops.emptySub"));
      $("#op-empty").style.display = op.rows.length ? "none" : "";
      refresh();
    };

    body.addEventListener("input", (e) => {
      const el = e.target.closest("[data-f]"); if (!el) return;
      const r = op.rows[+el.closest("tr").dataset.i], f = el.dataset.f;
      r[f] = ["unit", "tid", "ts", "offset"].includes(f) ? +el.value || 0 : el.value;
      save();
      if (f === "tid") render(); else refresh();
    });
    /* Al salir del campo se repinta la fila: la tribu sale de la aldea de origen y el enlace de envío, del destino. */
    body.addEventListener("change", (e) => { if (e.target.closest('[data-f="to"],[data-f="from"]')) render(); });
    body.addEventListener("click", (e) => {
      const tr = e.target.closest("tr"); if (!tr) return;
      const i = +tr.dataset.i;
      if (e.target.closest("[data-dup]")) { op.rows.splice(i + 1, 0, A.opsRowNew(op.rows[i])); save(); render(); }
      else if (e.target.closest("[data-del]")) { op.rows.splice(i, 1); save(); render(); }
    });
    $("#op-add").onclick = () => { op.rows.push(A.opsRowNew(op.rows[op.rows.length - 1] ? { ...op.rows[op.rows.length - 1], offset: (op.rows[op.rows.length - 1].offset || 0) - 1 } : null, h)); save(); render(); body.lastElementChild?.querySelector('[data-f="to"]')?.focus(); };
    $("#op-clear").onclick = () => { const keep = { name: op.name, land: op.land, speed: op.speed }; op = { ...A.opsNew(w), ...keep }; save(); render(); };
    $("#op-name").oninput = (e) => { op.name = e.target.value; save(); };
    $("#op-land").oninput = (e) => { const ms = fromInput(e.target.value, st.utc); if (ms != null) { op.land = ms; save(); refresh(); } };
    $("#op-speed").oninput = (e) => { op.speed = Math.max(1, Math.min(10, +e.target.value || 1)); save(); refresh(); };
    $("#op-utc").onclick = (e) => { const b = e.target.closest("button"); if (!b) return; st.utc = b.dataset.v === "1"; A.store.set("opsUtc", st.utc); A.$$("#op-utc button", root).forEach((x) => x.setAttribute("aria-pressed", x === b)); $("#op-land").value = toInput(op.land, st.utc); refresh(); };
    const text = (fmt) => A.opsText(op, A.planOps(op, w), { fmt, clock, labels: { title: t("ops.title"), land: t("ops.lands"), real: t("ops.real"), fake: t("ops.fake"), ts: t("ops.c.ts") } });
    const need = () => { if (A.planOps(op, w).some((x) => x.ok)) return true; A.toast(t("ops.nothing")); return false; };
    $("#op-dc").onclick = () => need() && A.copy(text("dc"), t("ops.copied"));
    $("#op-bb").onclick = () => need() && A.copy(text("bb"), t("ops.copied"));
    $("#op-link").onclick = () => need() && A.copy(`${location.origin}${location.pathname}#ops?w=${encodeURIComponent(A.state.sid)}&o=${A.opsEncode(op)}`, t("ops.linkCopied"));
    if (st.guest) {
      $("#op-adopt").onclick = () => { st.guest = false; save(); history.replaceState(null, "", "#ops"); $("#op-guest").remove(); A.toast(t("ops.adopted")); };
      $("#op-mine").onclick = () => { history.replaceState(null, "", "#ops"); A.route(); };
    }
    render();
    const iv = setInterval(refresh, 1000);
    return () => clearInterval(iv);
  };
})();
