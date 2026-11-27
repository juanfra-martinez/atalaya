/* Asistente para llenar listas de vacas desde el buscador de inactivos.

   El juego no tiene importación masiva: cada objetivo se añade de uno en uno. Comprobado en International 7
   (23 nov 2026, versión 718.5):
   - Abrir la casilla (por defecto). karte.php?x=&y= redirige a /map?x=&y= y abre la ficha de la aldea. Su enlace
     «Agregar a la lista de vacas» llama a Travian.React.FarmList.openSlotDialog con las coordenadas, así que el
     formulario sale con el objetivo ya resuelto y Guardar activo: dos clics en el juego. Si ya está en una lista,
     la ficha muestra «Editar lista de vacas (nombre)». La pestaña del juego se reutiliza guardando la referencia
     que devuelve window.open y navegándola (w.location.href + w.focus(), permitido entre orígenes): en Chrome,
     buscarla por su nombre abría otra pestaña aunque el juego no envía Cross-Origin-Opener-Policy ni cambia
     window.name. Con la referencia, Chrome la reutiliza y además te lleva a ella (comprobado el 23 nov 2026).
   - Pegar. El campo X de «Añadir objetivo» acepta «x|y» y lo reparte en X e Y (quita lo que no sea dígito, «-»,
     «|» o «/»), pero el juego solo busca la aldea al salir del campo (GET village/target/x/y, ~1 s) y hasta
     entonces Guardar está desactivado: Añadir objetivo → clic en X → Ctrl+V → Tab → Guardar.
   El asistente lleva una cola: cada «Añadida» marca el objetivo y abre (o copia) el siguiente.

   Atalaya no toca el juego: solo copia texto o abre una URL del juego en una pestaña, y es el jugador quien
   añade y guarda cada objetivo.

   Recuerda por mundo lo que ya está en tus listas para no volver a proponerlo:
   - lo que dicen los datos de la lista de vacas pegados en «Listas de vacas» (farmText:<mundo>),
   - y las marcas del asistente (fbMarks:<mundo> = { "x|y": ["a" añadida | "x" descartada, ms] }). */
"use strict";
(() => {
  const A = window.A;
  const t = (...a) => A.t(...a);

  /* ---------------- lógica (sin DOM; probada en web/tests) ---------------- */
  A.fbKey = (o) => o.x + "|" + o.y;
  A.FB_LIMIT = 100; // objetivos por lista (Travian.Variables.FarmList.limit)

  /* Coordenadas que ya están en tus listas: Map "x|y" -> { src: "game"|"mark"|"drop", list? }.
     Con los datos del juego van por coordenadas; con el texto copiado se localizan por nombre y distancia. */
  A.fbListedFrom = (text, marks, w, home) => {
    const out = new Map();
    if (text && String(text).trim()) {
      let entries = [];
      const game = /"slots"\s*:/.test(text) ? A.parseFarmData(text) : null;
      if (game) entries = game.entries;
      else if (w && home) entries = A.matchFarm(A.parseFarmList(text), w, home).map((m) => (m.v ? { ...m.e, x: m.v.x, y: m.v.y } : m.e));
      for (const e of entries) if (e.x != null && e.y != null) out.set(A.fbKey(e), { src: "game", list: e.list || "" });
    }
    for (const [k, m] of Object.entries(marks || {})) if (!out.has(k)) out.set(k, { src: m[0] === "x" ? "drop" : "mark", at: m[1] });
    return out;
  };
  A.fbMarks = (sid) => A.store.get("fbMarks:" + sid, {});
  A.fbSetMarks = (sid, keys, state) => {
    const m = A.fbMarks(sid);
    for (const k of keys) { if (state) m[k] = [state, Date.now()]; else delete m[k]; }
    A.store.set("fbMarks:" + sid, m);
  };
  A.fbListed = (sid = A.state.sid) => A.fbListedFrom(A.store.get("farmText:" + sid, ""), A.fbMarks(sid), A.state.world, A.state.home);
  /* Huecos de cada lista según la última copia de los datos del juego (null si no hay datos con coordenadas). */
  A.fbLists = (sid = A.state.sid) => {
    const text = A.store.get("farmText:" + sid, "");
    const game = /"slots"\s*:/.test(text) ? A.parseFarmData(text) : null;
    return game ? game.lists.map((l) => ({ name: l.name, n: l.n, free: Math.max(0, A.FB_LIMIT - l.n) })) : null;
  };

  /* Cola: { items:[{vid,x,y,name,pop,uid,pname,tag,dist,time,conf}], i, st:{ "x|y": "a"|"s"|"x" } } */
  A.fbQueueNew = (rows) => ({
    v: 1, at: Date.now(), i: 0, st: {},
    items: rows.map((r) => ({ vid: r.v.vid, x: r.v.x, y: r.v.y, name: r.v.name, pop: r.v.pop, uid: r.p.uid, pname: r.p.name, tag: r.p.tag || "",
      dist: Math.round(r.dist * 10) / 10, time: Math.round(r.time), conf: r.p.status === "natar" ? null : r.p.confidence })),
  });
  /* Primer objetivo sin decidir a partir de "from", dando la vuelta; items.length si no queda ninguno. */
  A.fbNextPending = (q, from) => {
    const n = q.items.length;
    for (let k = 0; k < n; k++) { const i = (from + k) % n; if (!q.st[A.fbKey(q.items[i])]) return i; }
    return n;
  };
  /* act: "a" añadida, "s" saltar (sin recordar), "x" descartar (no volver a proponer), "back", "jump" (a j). */
  A.fbStep = (q, act, j) => {
    const n = q.items.length;
    if (act === "back") { q.i = Math.max(0, Math.min(q.i, n) - 1); return q; }
    if (act === "jump") { q.i = Math.max(0, Math.min(n - 1, j | 0)); return q; }
    const cur = q.items[q.i]; if (!cur) return q;
    q.st[A.fbKey(cur)] = act;
    q.i = A.fbNextPending(q, q.i + 1);
    return q;
  };
  A.fbStats = (q) => {
    const s = { a: 0, s: 0, x: 0, pending: 0, n: q.items.length };
    for (const it of q.items) { const v = q.st[A.fbKey(it)]; if (v) s[v]++; else s.pending++; }
    s.done = s.pending === 0;
    return s;
  };

  /* ---------------- interfaz ---------------- */
  if (typeof document === "undefined") return;
  const TAB = "atalaya-travian";
  /* Una sola pestaña del juego para todas las casillas. Se navega por la referencia (el nombre solo sirve para
     la primera apertura); si el jugador la cerró, o se perdió al recargar Atalaya, se abre otra. */
  let gameWin = null;
  const openGame = (win, url) => {
    if (gameWin && !gameWin.closed) {
      try { gameWin.location.href = url; gameWin.focus(); return gameWin; } catch { /* abrir una nueva */ }
    }
    gameWin = win.open(url, TAB);
    return gameWin;
  };
  const qKey = () => "fbq:" + A.state.sid;
  A.fbSaved = () => { const q = A.store.get(qKey(), null); return q && q.items?.length && !A.fbStats(q).done ? q : null; };

  /* Algunos navegadores (vistas web integradas, apps) abren window.open en la misma pestaña: Atalaya se va al
     juego y, al volver atrás, el asistente se había cerrado. Si la página se descarga con el panel abierto, se
     apunta y la vista lo reabre al volver (como mucho 30 min después). */
  let drawerOpen = false;
  window.addEventListener("pagehide", () => { if (drawerOpen && A.state?.sid) A.store.set("fbResume", { sid: A.state.sid, at: Date.now() }); });
  A.fbAutoResume = (onChange) => {
    const r = A.store.get("fbResume", null);
    if (!r) return;
    A.store.set("fbResume", null);
    if (r.sid === A.state.sid && Date.now() - r.at < 30 * 60e3 && A.fbSaved()) A.farmBuilder(null, onChange, { resumed: true });
  };

  /* Abre varias casillas en pestañas a la vez (como otras webs). El navegador solo deja abrir una por clic
     salvo que se permitan las ventanas emergentes para este sitio. */
  A.fbOpenTabs = (items) => {
    const go = () => {
      let blocked = 0;
      for (const it of items) {
        const u = A.gameUrl("tile", it.x, it.y); if (!u) continue;
        const w = window.open(u, "_blank");
        if (!w) blocked++; else try { w.opener = null; } catch { /* otro origen */ }
      }
      A.toast(blocked ? t("fb.tabsBlocked", { n: blocked }) : t("fb.tabsOpened", { n: items.length }));
    };
    if (items.length <= 10) return go();
    const m = A.modal(t("fb.tabsTitle", { n: items.length }), `<p style="margin:0">${t("fb.tabsWarn")}</p>`,
      `<button class="btn" data-close2>${t("common.cancel")}</button><button class="btn primary" id="fb-tabs-go">${A.icon("external")}${t("fb.tabsGo", { n: items.length })}</button>`);
    m.querySelector("[data-close2]").onclick = A.closeOverlays;
    m.querySelector("#fb-tabs-go").onclick = () => { A.closeOverlays(); go(); };
  };

  /* Copia en el documento de la ventana que recibió el clic (la flotante tiene su propio portapapeles y foco). */
  const copyIn = async (win, text) => {
    try { await win.navigator.clipboard.writeText(text); return true; } catch { /* sin permiso: método clásico */ }
    try {
      const d = win.document, ta = d.createElement("textarea");
      ta.value = text; ta.setAttribute("readonly", ""); ta.style.cssText = "position:fixed;opacity:0;top:0;left:0";
      d.body.appendChild(ta); ta.select(); const ok = d.execCommand("copy"); ta.remove(); return ok;
    } catch { return false; }
  };

  /* Abre el asistente con una cola nueva (rows del buscador) o la guardada (rows = null). */
  let closePrev = null; // una sola ventana flotante: la de un asistente anterior se cierra
  A.farmBuilder = (rows, onChange, opts = {}) => {
    let q = rows ? A.fbQueueNew(rows) : A.fbSaved();
    if (!q) return;
    closePrev?.();
    const canOpen = !!A.gameUrl("tile", 0, 0);
    const pref = A.store.get("fbPrefs", {});
    const st = { method: canOpen && pref.method !== "paste" ? "open" : "paste", help: pref.help !== false, flash: null, pip: null, drawer: null, started: !!opts.resumed }; // al volver del juego el objetivo actual ya se abrió
    const savePrefs = () => A.store.set("fbPrefs", { method: st.method, help: st.help });
    const save = () => { A.store.set(qKey(), q); onChange?.(); };
    save();

    /* La acción del método sobre el objetivo actual: copiar «x|y» o abrir su casilla en la pestaña del juego. */
    const act = async (win) => {
      const cur = q.items[q.i]; if (!cur) { st.flash = null; return; }
      const c = `${cur.x}|${cur.y}`;
      st.started = true;
      if (st.method === "open") {
        const u = A.gameUrl("tile", cur.x, cur.y);
        const tab = u && openGame(win, u);
        st.flash = tab ? { ok: true, msg: t("fb.opened", { c }) } : { ok: false, msg: t("fb.blocked") };
      } else {
        const ok = await copyIn(win, c);
        st.flash = ok ? { ok: true, msg: t("fb.copied", { c }) } : { ok: false, msg: t("fb.copyFail", { c }) };
      }
    };

    const step = async (win, a, j) => {
      const cur = q.items[q.i];
      if (a === "a" || a === "s" || a === "x") {
        if (!cur) return;
        A.fbSetMarks(A.state.sid, [A.fbKey(cur)], a === "s" ? null : a);
      }
      if (a !== "again") A.fbStep(q, a, j);
      save();
      if (a === "back" || q.i >= q.items.length) st.flash = null; // al volver atrás no se copia nada por sorpresa
      else await act(win);
      paint();
    };

    const conf = (c) => (c == null ? A.ui.pill("natar") : `<span class="chip"><i class="fb-dot" style="background:${A.confColor(c)}"></i>${c}%</span>`);
    const html = (compact) => {
      const s = A.fbStats(q), n = q.items.length, done = n - s.pending, cur = q.items[q.i];
      const lists = A.fbLists();
      const steps = st.method === "open" ? t("fb.stepsOpen") : t("fb.stepsPaste");
      const methodSeg = canOpen ? `<div class="seg fb-method" role="group" aria-label="${A.esc(t("fb.method"))}">
          <button data-fb="m:open" aria-pressed="${st.method === "open"}">${A.icon("external")}${t("fb.mOpen")}</button>
          <button data-fb="m:paste" aria-pressed="${st.method === "paste"}">${A.icon("copy")}${t("fb.mPaste")}</button></div>` : "";
      /* Hasta la primera acción, el botón principal empieza (abre o copia el actual) en vez de marcarlo. */
      const go = !cur ? "" : st.started
        ? `<button class="btn primary fb-go" data-fb="a">${A.icon("farm")}${t("fb.added")}<kbd>Enter</kbd></button>`
        : `<button class="btn primary fb-go" data-fb="again">${A.icon(st.method === "open" ? "external" : "copy")}${t(st.method === "open" ? "fb.startOpen" : "fb.startPaste", { c: `${cur.x}|${cur.y}` })}<kbd>Enter</kbd></button>`;
      const curCard = cur ? `<div class="fb-cur">
          <div class="fb-k"><span>${t("fb.target", { i: q.i + 1, n })}</span>${q.st[A.fbKey(cur)] ? `<span class="chip">${t("fb.st." + q.st[A.fbKey(cur)])}</span>` : ""}</div>
          <button class="fb-coord" data-fb="again" title="${A.esc(t(st.method === "open" ? "fb.again.open" : "fb.again.paste"))}">(${cur.x}|${cur.y})</button>
          <div class="fb-name"><b>${A.esc(cur.name)}</b><span class="muted"> · ${A.esc(cur.pname)}${cur.tag ? ` [${A.esc(cur.tag)}]` : ""}</span></div>
          <div class="fb-chips"><span class="chip">${A.fmt(cur.pop)} ${t("fb.inh")}</span><span class="chip">${A.fmt(cur.dist, 1)} ${t("common.fields")}</span><span class="chip mono">${A.icon("clock")}${A.dur(cur.time)}</span>${conf(cur.conf)}</div>
          <div class="fb-flash ${st.flash ? (st.flash.ok ? "ok" : "bad") : ""}" role="status" aria-live="polite">${st.flash ? A.esc(st.flash.msg) : t(st.method === "open" ? "fb.hintOpen" : "fb.hintPaste")}</div>
          ${go}
          <div class="fb-row">
            <button class="btn sm" data-fb="again">${A.icon(st.method === "open" ? "external" : "copy")}${t(st.method === "open" ? "fb.reopen" : "fb.recopy")}<kbd>C</kbd></button>
            <button class="btn sm" data-fb="s">${t("fb.skip")}<kbd>S</kbd></button>
            <button class="btn sm" data-fb="x" title="${A.esc(t("fb.dropTip"))}">${t("fb.drop")}<kbd>D</kbd></button>
            <button class="btn sm ghost" data-fb="back" ${q.i === 0 ? "disabled" : ""}>← ${t("fb.back")}</button>
          </div></div>`
        : `<div class="fb-cur fb-done"><div class="fb-k">${t("fb.doneK")}</div><h3>${t("fb.done", { a: s.a })}</h3>
          <p class="muted">${t("fb.doneSub", { s: s.s, x: s.x })}</p>
          <div class="fb-row">${s.s ? `<button class="btn sm" data-fb="copySkipped">${A.icon("copy")}${t("fb.copySkipped", { n: s.s })}</button>` : ""}
            <button class="btn sm" data-fb="back">${t("fb.review")}</button><button class="btn sm primary" data-fb="finish">${t("fb.finish")}</button></div></div>`;
      const queue = `<ol class="fb-q">${q.items.map((it, i) => {
        const v = q.st[A.fbKey(it)] || "";
        return `<li><button data-fb="j:${i}" class="${i === q.i ? "cur" : ""} ${v ? "st-" + v : ""}" aria-current="${i === q.i}">
          <i class="fb-ic" aria-hidden="true">${v === "a" ? "✓" : v === "s" ? "↷" : v === "x" ? "✕" : i + 1}</i><b class="mono">${it.x}|${it.y}</b><span class="fb-qn">${A.esc(it.name)}</span><span class="muted mono">${A.fmt(it.pop)} · ${A.fmt(it.dist, 1)}</span></button></li>`;
      }).join("")}</ol>`;
      return `<div class="fb ${compact ? "fb-compact" : ""}">
        <div class="fb-prog"><div class="fb-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${n}" aria-valuenow="${done}"><i style="width:${(done / n) * 100}%"></i></div>
          <div class="fb-counts"><b>${t("fb.progress", { d: done, n })}</b><span class="muted">${t("fb.counts", { a: s.a, s: s.s, x: s.x })}</span></div></div>
        ${methodSeg}
        <details class="fb-help" ${st.help && !compact ? "open" : ""}><summary>${t("fb.how")}</summary><ol class="steps">${steps}</ol>
          ${lists ? `<p class="muted fb-lists">${t("fb.lists")} ${lists.map((l) => `<span class="chip ${l.free ? "" : "full"}">${A.esc(l.name)} · ${l.n}/${A.FB_LIMIT}</span>`).join(" ")}</p>` : `<p class="muted fb-lists">${t("fb.limit", { n: A.FB_LIMIT })}</p>`}</details>
        ${curCard}
        ${compact ? "" : `<div><h3 class="fb-h">${t("fb.queue")}</h3>${queue}</div>`}
        ${compact ? `<details class="fb-help"><summary>${t("fb.queue")} · ${n}</summary>${queue}</details>` : ""}
      </div>`;
    };

    /* Una sola función de eventos para el panel lateral y la ventana flotante. */
    const bind = (host, win) => {
      host.onclick = (e) => {
        const b = e.target.closest("[data-fb]"); if (!b || b.disabled) return;
        const a = b.dataset.fb;
        if (a.startsWith("m:")) { st.method = a.slice(2); st.flash = null; st.started = false; savePrefs(); paint(); return; }
        if (a.startsWith("j:")) { step(win, "jump", +a.slice(2)); return; }
        if (a === "finish") { closeAll(); return; }
        if (a === "copySkipped") { copyIn(win, q.items.filter((it) => q.st[A.fbKey(it)] === "s").map((it) => `${it.x}|${it.y}`).join("\n")).then((ok) => { st.flash = ok ? { ok: true, msg: t("toast.copied") } : null; paint(); }); return; }
        if (a === "pip") { popOut(); return; }
        step(win, a);
      };
      // "toggle" no burbujea: se escucha en captura para recordar si la ayuda está abierta
      host.addEventListener("toggle", (e) => { if (e.target.matches?.(".fb-help") && e.target.querySelector(".steps") && !e.target.closest(".fb-compact")) { st.help = e.target.open; savePrefs(); } }, true);
    };
    const onKey = (win) => (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const tg = e.target, tag = tg?.tagName || "";
      if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
      const k = e.key.toLowerCase();
      if ((k === "enter" || k === " ") && /BUTTON|A|SUMMARY/.test(tag)) return; // el propio botón ya hace clic
      const map = { enter: "a", " ": "a", s: "s", d: "x", c: "again", o: "again", backspace: "back", arrowleft: "back" };
      if (!map[k]) return;
      if (!q.items[q.i] && map[k] !== "back") return;
      e.preventDefault(); step(win, map[k] === "a" && !st.started ? "again" : map[k]);
    };

    /* Panel lateral */
    const mainKey = onKey(window);
    const openDrawer = () => {
      const d = A.drawer(`<div class="drawer-h"><div style="flex:1;min-width:0"><div class="muted fb-kicker">${t("fb.kicker")}</div><h2>${t("fb.title")}</h2></div>
          <button class="btn sm" data-fbpip title="${A.esc(t("fb.pipTip"))}">${A.icon("expand")}${t("fb.pip")}</button>
          <button class="icon-btn" data-close aria-label="${A.esc(t("common.close"))}">${A.icon("x")}</button></div>
        <div class="drawer-b" id="fb-body"></div>`);
      d.classList.add("fb-drawer");
      st.drawer = d.querySelector("#fb-body"); drawerOpen = true;
      d.querySelector("[data-fbpip]").onclick = popOut;
      bind(st.drawer, window);
      document.addEventListener("keydown", mainKey);
      new MutationObserver((_, obs) => { if (!d.isConnected) { document.removeEventListener("keydown", mainKey); st.drawer = null; drawerOpen = !!st.pip; obs.disconnect(); } }).observe(document.body, { childList: true });
    };

    /* Ventana flotante: Document Picture-in-Picture (Chrome/Edge: siempre encima del juego) o, si no hay,
       una ventana emergente pequeña del mismo origen. Se copian los estilos y se pinta lo mismo en compacto. */
    const popOut = async () => {
      let win = null;
      try {
        if ("documentPictureInPicture" in window) win = await window.documentPictureInPicture.requestWindow({ width: 360, height: 560 });
      } catch { win = null; }
      if (!win) win = window.open("", "atalaya-fb", "popup,width=380,height=620");
      if (!win) { A.toast(t("fb.blocked")); return; }
      const d = win.document;
      if (!d.querySelector("style[data-atalaya]")) {
        d.head.innerHTML = `<meta charset="utf-8"><title>${A.esc(t("fb.title"))} · Atalaya</title>`;
        for (const n of document.querySelectorAll('style, link[rel="stylesheet"]')) { const c = n.cloneNode(true); c.setAttribute("data-atalaya", ""); d.head.appendChild(c); }
      }
      const th = document.documentElement.dataset.theme;
      if (th) d.documentElement.dataset.theme = th; else delete d.documentElement.dataset.theme;
      d.documentElement.lang = document.documentElement.lang;
      d.body.className = "fb-pip";
      d.body.innerHTML = `<div class="fb-pip-h">${A.logo(22)}<b>${t("fb.title")}</b><button class="icon-btn" data-fbclose aria-label="${A.esc(t("common.close"))}">${A.icon("x")}</button></div><div id="fb-body"></div>`;
      st.pip = { win, host: d.getElementById("fb-body") }; drawerOpen = true;
      bind(st.pip.host, win);
      const key = onKey(win);
      d.addEventListener("keydown", key);
      d.querySelector("[data-fbclose]").onclick = () => win.close();
      win.addEventListener("pagehide", () => { st.pip = null; drawerOpen = !!st.drawer?.isConnected; });
      A.closeOverlays(); // el panel lateral ya no hace falta: el jugador está en el juego
      paint(true);
      win.focus?.();
    };

    /* Al repintar, el foco vuelve al botón principal («Añadida» o «Cerrar») si estaba dentro del panel: así
       Enter y Espacio siempre lo pulsan, y nunca el botón de cerrar de la cabecera. */
    const repaint = (host, compact, force) => {
      const d = host.ownerDocument, a = d.activeElement;
      const had = force || !a || a === d.body || host.contains(a);
      host.innerHTML = html(compact);
      host.querySelector(".fb-q .cur")?.scrollIntoView({ block: "nearest" });
      if (had) host.querySelector(".fb-go, [data-fb=finish]")?.focus({ preventScroll: true });
    };
    const paint = (force = false) => {
      if (st.drawer?.isConnected) repaint(st.drawer, false, force);
      if (st.pip && !st.pip.win.closed) repaint(st.pip.host, true, force);
    };
    const closeAll = () => {
      if (A.fbStats(q).done) A.store.set(qKey(), null);
      onChange?.();
      if (st.pip && !st.pip.win.closed) st.pip.win.close();
      A.closeOverlays();
    };

    closePrev = () => { if (st.pip && !st.pip.win.closed) st.pip.win.close(); st.pip = null; };
    openDrawer();
    paint(true);
    // Copiar el primero es inocuo; abrir el juego sin que el jugador lo pida, no: en ese modo espera al botón.
    if (st.method === "paste") act(window).then(() => paint());
  };
})();
