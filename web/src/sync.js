/* Atalaya — cuentas opcionales y sincronización entre dispositivos (Supabase).

   Sin configuración (window.ATALAYA_SUPABASE, que pone web/build.py) este módulo no hace nada. Con ella, y solo si el
   jugador inicia sesión, se carga supabase-js desde el CDN y las claves de A.store que son datos del jugador se copian
   en la tabla user_data (una fila por clave). Gana la escritura más reciente de cada clave; lo que había en el navegador
   antes de tener cuenta se fusiona con lo de la nube sin perder nada. El esquema está en supabase/schema.sql. */
"use strict";
(() => {
  const A = window.A;
  const t = (...a) => A.t(...a);
  const CFG = !A.DEMO && window.ATALAYA_SUPABASE?.url && window.ATALAYA_SUPABASE?.key ? window.ATALAYA_SUPABASE : null;
  /* Versión fija y comprobada con SRI: si el CDN sirviera otra cosa, el navegador no la ejecuta. */
  const CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/dist/umd/supabase.js";
  const SRI = "sha384-TcHRA3zBbn+Lexh5n+Oil4guNPOS3rjNDpGRAN46u/s/mB2IZ50ceC6TYDU2yvgK";
  const AUTH_KEY = "atalaya-auth"; // dónde guarda supabase-js la sesión (localStorage)
  const TABLE = "user_data";
  const MAX_VALUE = 900000; // caracteres de JSON por clave (la tabla admite hasta 1 MB)

  const S = (A.sync = { enabled: !!CFG, providers: (CFG?.providers || []).filter((p) => p === "discord"), state: { phase: CFG ? "out" : "off", user: null, last: null, error: null, tooBig: [] } });

  /* Qué se sincroniza: lo que el jugador guarda o analiza, por mundo cuando lleva ":<mundo>".
     homes (aldea de cada mundo) · watch (vigilados) · rules (reglas de alerta) · webhook (Discord de las alertas) ·
     fbMarks (marcas del asistente de listas) · farmText / farmArmy (lista de vacas pegada y ejército) ·
     reportText (informe pegado) · culture (puntos de cultura) · incoming (ataques entrantes) · ops (operación) ·
     land (terreno) · army (tropas del planificador).
     Se quedan en este navegador las preferencias de interfaz (theme, lang, sid, filters, mapMode, nb, landView, opsUtc,
     srv:prefs, fbPrefs) y el estado pasajero del asistente de listas (fbq, fbResume), que va ligado a la pestaña del juego. */
  S.KEYS = ["homes", "watch", "rules", "webhook", "fbMarks", "farmText", "farmArmy", "reportText", "culture", "incoming", "ops", "land", "army"];
  S.syncable = (k) => S.KEYS.includes(String(k).split(":")[0]);

  const isObj = (x) => x != null && typeof x === "object" && !Array.isArray(x);
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  /* Fusión de un dato de antes de tener cuenta con el de la nube: los objetos se unen clave a clave y las listas de
     objetos se unen sin repetir (por type+id si lo tienen, si no por contenido). En lo demás manda la nube. */
  S.mergeLegacy = (l, r) => {
    if (l == null) return r;
    if (r == null) return l;
    if (Array.isArray(l) && Array.isArray(r) && l.concat(r).every(isObj)) {
      const id = (x) => (x.id != null ? `${x.type ?? ""}:${x.id}` : JSON.stringify(x));
      const seen = new Set(r.map(id));
      return r.concat(l.filter((x) => !seen.has(id(x))));
    }
    if (isObj(l) && isObj(r)) {
      const o = { ...l };
      for (const k of Object.keys(r)) o[k] = k in l ? S.mergeLegacy(l[k], r[k]) : r[k];
      return o;
    }
    return r;
  };

  /* Lo que sube a la nube. Un HAR pegado entero lleva las cabeceras de cada petición, cookies de sesión del juego
     incluidas: se sube solo el JSON de las respuestas, que es lo único que Atalaya lee de él. */
  S.outbound = (v) => {
    if (typeof v !== "string" || !/"log"\s*:/.test(v) || !/"entries"\s*:/.test(v)) return v;
    return A.jsonValues(v).filter((x) => !x?.log?.entries).map((x) => JSON.stringify(x)).join("\n");
  };

  /* Decide clave a clave qué hacer con lo local (loc: k -> {v, t, d}) y lo de la nube (rem: k -> {v, t}).
     t = ms de la última escritura (null: dato de antes de la sincronización), d = cambiado aquí y sin subir.
     Devuelve { apply: k -> {v, t} (escribir aquí), push: k -> {v, t} (subir), backup: k -> v (copia local de lo
     que se sustituye al fusionar por primera vez) }. */
  S.plan = (loc, rem, now = Date.now()) => {
    const apply = {}, push = {}, backup = {};
    for (const k of new Set([...Object.keys(loc), ...Object.keys(rem)])) {
      const l = loc[k], r = rem[k];
      if (!l) { apply[k] = r; continue; }
      if (!r) { if (l.d || l.t == null) push[k] = { v: l.v, t: l.t ?? now }; continue; }
      if (l.t == null) {
        if (same(l.v, r.v)) { apply[k] = r; continue; }
        const m = S.mergeLegacy(l.v, r.v);
        if (same(m, r.v)) apply[k] = r;
        else { apply[k] = { v: m, t: now }; push[k] = { v: m, t: now }; }
        if (!same(m, l.v)) backup[k] = l.v;
        continue;
      }
      if (l.d && l.t >= r.t) { push[k] = { v: l.v, t: l.t }; continue; }
      if (l.t !== r.t || !same(l.v, r.v)) apply[k] = r;
    }
    return { apply, push, backup };
  };

  /* ---------- almacenamiento local ---------- */
  const PREFIX = "atalaya:";
  const M = () => { const m = A.store.get("~sync", null); return isObj(m) && isObj(m.keys) ? m : { uid: null, cursor: null, keys: {} }; };
  const saveM = (m) => A.store.set("~sync", m);
  const readRaw = (k) => { try { const s = localStorage.getItem(PREFIX + k); return s == null ? undefined : JSON.parse(s); } catch { return undefined; } };
  const writeRaw = (k, v) => { try { localStorage.setItem(PREFIX + k, JSON.stringify(v)); } catch { /* sin espacio */ } };
  const localKeys = () => {
    const out = [];
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k?.startsWith(PREFIX) && S.syncable(k.slice(PREFIX.length))) out.push(k.slice(PREFIX.length)); } } catch { /* */ }
    return out;
  };
  const pending = () => Object.values(M().keys).filter((x) => x.d).length;

  /* Cada escritura de una clave sincronizable queda apuntada con su hora para la próxima sincronización. */
  if (CFG) {
    A.store.onSet = (k) => {
      if (!S.syncable(k)) return;
      const m = M(); m.keys[k] = { t: Math.max(Date.now(), (m.keys[k]?.t || 0) + 1), d: true }; saveM(m);
      if (uid) { S.paint(); schedule(2500); }
    };
  }

  /* ---------- cliente ---------- */
  let sb = null, loading = null, uid = null, timer = null, running = null, again = false, lastRun = 0;
  const load = () => (loading ||= new Promise((res, rej) => {
    if (window.supabase?.createClient) return res(window.supabase);
    const s = document.createElement("script");
    s.src = CDN; s.integrity = SRI; s.crossOrigin = "anonymous"; s.referrerPolicy = "no-referrer";
    s.onload = () => (window.supabase?.createClient ? res(window.supabase) : rej(new Error("supabase-js")));
    s.onerror = () => rej(new Error(t("acct.cdnError")));
    document.head.appendChild(s);
  }).then((lib) => {
    sb = lib.createClient(CFG.url, CFG.key, { auth: { flowType: "pkce", storageKey: AUTH_KEY, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    /* No se puede esperar a otras llamadas de supabase dentro de este aviso: se atiende en la siguiente vuelta. */
    sb.auth.onAuthStateChange((_ev, session) => setTimeout(() => onSession(session), 0));
    return sb;
  }).catch((err) => { loading = null; set({ phase: "error", error: err.message }); throw err; }));

  const set = (patch) => { Object.assign(S.state, patch); S.paint(); A.emit("sync", S.state); };

  const onSession = (session) => {
    const u = session?.user || null;
    if (!u) { uid = null; clearInterval(timer); timer = null; set({ phase: "out", user: null, error: null }); return; }
    S.state.user = { id: u.id, email: u.email || "", provider: u.app_metadata?.provider || "email", name: u.user_metadata?.full_name || u.user_metadata?.name || u.user_metadata?.user_name || "" };
    cleanUrl();
    if (uid === u.id) { S.paint(); return; }
    uid = u.id;
    A.closeOverlays?.();
    sync();
    clearInterval(timer);
    timer = setInterval(() => { if (document.visibilityState === "visible") sync(); }, 90e3);
  };

  const schedule = (ms) => { clearTimeout(schedule.t); schedule.t = setTimeout(() => sync(), ms); };
  const sync = () => {
    if (!sb || !uid) return Promise.resolve();
    if (running) { again = true; return running; }
    running = run().finally(() => { running = null; if (again) { again = false; schedule(500); } });
    return running;
  };

  const fetchRows = async (since) => {
    const rows = [];
    for (let from = 0; ; from += 1000) {
      let q = sb.from(TABLE).select("key,value,updated_at,synced_at").order("synced_at").order("key").range(from, from + 999);
      if (since != null) q = q.gte("synced_at", new Date(since).toISOString());
      const { data, error } = await q;
      if (error) throw error;
      rows.push(...data);
      if (data.length < 1000) return rows;
    }
  };

  const run = async () => {
    if (!navigator.onLine) { set({ phase: "offline" }); return; }
    set({ phase: "busy" });
    lastRun = Date.now();
    try {
      const before = M();
      const fresh = before.uid !== uid;
      /* El cursor se retrasa unos segundos: una fila de una transacción más lenta puede llevar una hora anterior. */
      const rows = await fetchRows(fresh || !before.cursor ? null : before.cursor - 5000);
      /* Lo que se haga a partir de aquí no espera a nada: lee el estado local actual, no el de antes de la descarga. */
      const m = M();
      if (m.uid && m.uid !== uid) {
        /* Otra cuenta entra en este navegador: lo que hay aquí es de la anterior (ya está en su nube). */
        for (const k of localKeys()) { try { localStorage.removeItem(PREFIX + k); } catch { /* */ } }
        m.keys = {}; m.cursor = null;
      }
      const firstHere = m.uid !== uid;
      const rem = {};
      let cursor = m.cursor || 0;
      for (const r of rows) { rem[r.key] = { v: r.value, t: Date.parse(r.updated_at) }; cursor = Math.max(cursor, Date.parse(r.synced_at)); }
      const loc = {};
      for (const k of localKeys()) {
        const mk = m.keys[k];
        /* Si este navegador nunca se ha sincronizado con esta cuenta, todo lo suyo es candidato a subir. */
        loc[k] = { v: readRaw(k), t: mk?.t ?? null, d: firstHere || !!mk?.d };
      }
      const { apply, push, backup } = S.plan(loc, rem);
      for (const [k, v] of Object.entries(backup)) writeRaw("~backup:" + k, v);
      const changed = [];
      for (const [k, r] of Object.entries(apply)) {
        const had = k in loc;
        if (had ? !same(loc[k].v, r.v) : r.v != null) { writeRaw(k, r.v); changed.push(k); }
        m.keys[k] = { t: r.t };
      }
      for (const [k, p] of Object.entries(push)) m.keys[k] = { t: p.t, d: true };
      for (const k of Object.keys(m.keys)) if (!(k in loc) && !(k in apply)) delete m.keys[k]; // claves borradas a mano
      m.uid = uid; m.cursor = cursor;
      saveM(m);
      if (changed.length) refresh(changed);
      await pushDirty();
      set({ phase: "idle", last: Date.now(), error: null });
    } catch (err) {
      set({ phase: navigator.onLine ? "error" : "offline", error: err?.message || String(err) });
    }
  };

  const pushDirty = async () => {
    const m = M();
    const rows = [], sent = {}, big = [];
    for (const [k, x] of Object.entries(m.keys)) {
      if (!x.d) continue;
      const v = S.outbound(readRaw(k)) ?? null;
      if (JSON.stringify(v).length > MAX_VALUE) { big.push(k); continue; }
      rows.push({ user_id: uid, key: k, value: v, updated_at: new Date(x.t).toISOString() });
      sent[k] = x.t;
    }
    S.state.tooBig = big;
    for (let i = 0; i < rows.length; i += 50) {
      const { error } = await sb.from(TABLE).upsert(rows.slice(i, i + 50), { onConflict: "user_id,key" });
      if (error) throw error;
    }
    if (!rows.length) return;
    const m2 = M();
    for (const [k, ts] of Object.entries(sent)) if (m2.keys[k]?.t === ts) m2.keys[k] = { t: ts };
    saveM(m2);
  };

  /* Datos nuevos de otro dispositivo: se recargan los que viven en memoria y se repinta la vista si no molesta. */
  const refresh = (keys) => {
    A.state.homes = A.store.get("homes", {});
    A.state.watch = A.store.get("watch", {});
    A.emit("watch");
    const busy = document.querySelector(".modal,.drawer,.fb-drawer") || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "");
    if (!busy && A.state.world && A.route) A.route();
    if (keys.some((k) => !k.startsWith("~"))) A.toast(t("acct.updated"));
  };

  const cleanUrl = () => {
    const u = new URL(location.href);
    let dirty = false;
    for (const p of ["code", "error", "error_code", "error_description", "state"]) if (u.searchParams.has(p)) { u.searchParams.delete(p); dirty = true; }
    if (dirty) history.replaceState(history.state, "", u.pathname + u.search + u.hash);
  };

  /* ---------- acciones ---------- */
  const redirect = () => location.origin + location.pathname;
  S.sendLink = async (email) => {
    await load();
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect(), shouldCreateUser: true } });
    if (error) throw error;
  };
  S.verifyCode = async (email, token) => {
    await load();
    const { error } = await sb.auth.verifyOtp({ email, token, type: "email" });
    if (error) throw error;
  };
  S.oauth = async (provider) => {
    await load();
    const { error } = await sb.auth.signInWithOAuth({ provider, options: { redirectTo: redirect() } });
    if (error) throw error;
  };
  S.now = () => sync();
  S.signOut = async () => {
    if (!sb) return;
    await sync();
    if (pending() && !confirm(t("acct.signOutPending"))) return;
    await sb.auth.signOut({ scope: "local" });
    onSession(null);
  };
  S.deleteAccount = async () => {
    if (!sb || !confirm(t("acct.deleteConfirm"))) return;
    const { error } = await sb.rpc("delete_my_account");
    if (error) { A.toast(t("acct.error", { e: error.message })); return; }
    const m = M(); m.uid = null; m.cursor = null; saveM(m); // lo de este navegador se queda; con otra cuenta se volvería a subir
    await sb.auth.signOut({ scope: "local" }).catch(() => {});
    onSession(null);
    A.closeOverlays();
    A.toast(t("acct.deleted"));
  };
  /* Portabilidad (RGPD, art. 20): todo lo que Atalaya sincroniza, tal como está en este navegador. */
  S.exportData = () => {
    const data = {};
    for (const k of localKeys().sort()) data[k] = readRaw(k);
    const blob = new Blob([JSON.stringify({ app: "atalaya", exported: new Date().toISOString(), data }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `atalaya-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  /* ---------- interfaz ---------- */
  const label = () => {
    const st = S.state;
    if (st.phase === "out" || st.phase === "off") return t("acct.signIn");
    if (st.phase === "loading" || st.phase === "busy") return t("acct.st.busy");
    if (st.phase === "offline") return t("acct.st.offline");
    if (st.phase === "error") return t("acct.st.error");
    return t("acct.st.ok");
  };
  S.paint = () => {
    const b = A.$?.("#acct");
    if (!b) return;
    const st = S.state.phase === "idle" && pending() ? "busy" : S.state.phase;
    b.dataset.st = st;
    const who = S.state.user ? (S.state.user.email || S.state.user.name) : "";
    b.title = who ? `${who} · ${label()}` : label();
    b.setAttribute("aria-label", t("acct.title") + " · " + b.title);
    b.innerHTML = `${A.icon("cloud")}<span class="acct-txt">${A.esc(S.state.user ? label() : t("acct.signIn"))}</span><i class="acct-dot"></i>`;
    const live = A.$("#acct-status");
    if (live) live.innerHTML = statusHtml();
  };
  const statusHtml = () => {
    const st = S.state;
    const ago = st.last ? A.ago(st.last) : null;
    const n = pending();
    let s = `<b>${A.esc(label())}</b>`;
    if (st.phase === "idle" && ago) s += ` · ${A.esc(t("acct.lastSync", { d: ago }))}`;
    if (n) s += ` · ${A.esc(t("acct.pending", { n }))}`;
    if (st.error && st.phase !== "idle") s += `<br><span class="down">${A.esc(st.error)}</span>`;
    if (st.tooBig?.length) s += `<br><span class="muted">${A.esc(t("acct.tooBig", { k: st.tooBig.join(", ") }))}</span>`;
    return s;
  };

  S.open = () => {
    const u = S.state.user;
    const privacy = `<a href="#privacy" data-close-link>${A.esc(t("acct.privacyLink"))}</a>`;
    const exportBtn = `<button class="btn ghost sm" id="acct-export">${A.icon("download")}${t("acct.export")}</button>`;
    if (!u) {
      const m = A.modal(t("acct.title"), `
        <p class="muted" style="margin:0">${t("acct.intro")}</p>
        <form id="acct-form" class="field"><label for="acct-email">${t("acct.email")}</label>
          <div class="row"><input class="input" id="acct-email" type="email" autocomplete="email" required placeholder="${A.esc(t("acct.emailPh"))}" style="flex:1"><button class="btn primary" id="acct-send">${t("acct.sendLink")}</button></div></form>
        <form id="acct-code" class="field" hidden><label for="acct-otp">${t("acct.code")}</label>
          <span class="muted" style="font-size:12.5px" id="acct-sent"></span>
          <div class="row"><input class="input mono" id="acct-otp" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6,10}" maxlength="10" style="flex:1"><button class="btn primary">${t("acct.enter")}</button></div></form>
        ${S.providers.includes("discord") ? `<div class="row" style="align-items:center;gap:10px"><span class="muted" style="font-size:12.5px">${t("acct.or")}</span><button class="btn" id="acct-discord">${t("acct.discord")}</button></div>` : ""}
        <p class="muted" style="margin:0;font-size:12.5px">${t("acct.what")} ${privacy}</p>`,
        exportBtn);
      const email = m.querySelector("#acct-email");
      m.querySelector("#acct-form").onsubmit = async (e) => {
        e.preventDefault();
        const btn = m.querySelector("#acct-send"); btn.disabled = true;
        try {
          await S.sendLink(email.value.trim());
          m.querySelector("#acct-code").hidden = false;
          m.querySelector("#acct-sent").textContent = t("acct.sent", { e: email.value.trim() });
          m.querySelector("#acct-otp").focus();
        } catch (err) { A.toast(t("acct.error", { e: err.message })); }
        finally { btn.disabled = false; }
      };
      m.querySelector("#acct-code").onsubmit = async (e) => {
        e.preventDefault();
        try { await S.verifyCode(email.value.trim(), m.querySelector("#acct-otp").value.trim()); }
        catch (err) { A.toast(t("acct.error", { e: err.message })); }
      };
      m.querySelector("#acct-discord")?.addEventListener("click", () => S.oauth("discord").catch((err) => A.toast(t("acct.error", { e: err.message }))));
      wire(m);
      return;
    }
    const via = u.provider === "email" ? "" : ` (${A.esc(u.provider)})`;
    const m = A.modal(t("acct.title"), `
      <p style="margin:0">${t("acct.signedAs", { u: `<b>${A.esc(u.email || u.name)}</b>${via}` })}</p>
      <div class="explain" id="acct-status" aria-live="polite">${statusHtml()}</div>
      <p class="muted" style="margin:0;font-size:12.5px">${t("acct.what")} ${privacy}</p>
      <details><summary class="muted" style="cursor:pointer;font-size:12.5px">${t("acct.danger")}</summary>
        <p class="muted" style="font-size:12.5px">${t("acct.deleteHint")}</p><button class="btn sm" id="acct-delete" style="color:var(--bad)">${A.icon("trash")}${t("acct.delete")}</button></details>`,
      `${exportBtn}<button class="btn" id="acct-out">${t("acct.signOut")}</button><button class="btn primary" id="acct-now">${t("acct.syncNow")}</button>`);
    m.querySelector("#acct-now").onclick = () => sync();
    m.querySelector("#acct-out").onclick = async () => { await S.signOut(); if (!S.state.user) { A.closeOverlays(); A.toast(t("acct.signedOut")); } };
    m.querySelector("#acct-delete").onclick = () => S.deleteAccount();
    wire(m);
  };
  const wire = (m) => {
    m.querySelector("#acct-export").onclick = S.exportData;
    m.querySelector("[data-close-link]").onclick = () => A.closeOverlays();
  };

  /* ---------- política de privacidad ---------- */
  A.views = A.views || {};
  A.views.privacy = (root) => {
    const contact = CFG?.contact || "https://github.com/juanfra-martinez/atalaya/issues";
    const link = /^https?:\/\//.test(contact) ? `<a href="${A.esc(contact)}" target="_blank" rel="noopener">${A.esc(contact)}</a>` : `<a href="mailto:${A.esc(contact)}">${A.esc(contact)}</a>`;
    root.innerHTML = A.head(t("priv.title"), t("priv.sub", { d: "28-11-2026" })) +
      `<div class="card card-b prose">${t("priv.body", { contact: link, region: A.esc(CFG?.region || t("priv.regionUnknown")) })}</div>`;
  };

  /* ---------- arranque ---------- */
  S.boot = () => {
    /* Un enlace caducado vuelve con el error en la dirección: se avisa y se limpia antes de enrutar. */
    const h = new URLSearchParams(location.hash.slice(1)), q = new URLSearchParams(location.search);
    const err = q.get("error_description") || (h.has("error_description") ? h.get("error_description") : null);
    if (err) {
      setTimeout(() => A.toast(t("acct.error", { e: err })), 600);
      if (h.has("error_description")) history.replaceState(history.state, "", location.pathname + location.search);
      cleanUrl();
    }
    if (!CFG) return;
    let hasSession = false;
    try { hasSession = !!localStorage.getItem(AUTH_KEY) || !!localStorage.getItem(AUTH_KEY + "-code-verifier"); } catch { /* */ }
    /* Sin sesión no se carga nada de fuera: la web funciona igual que sin cuentas. */
    if (hasSession || q.has("code")) { set({ phase: "loading" }); load().then(() => sb.auth.getSession()).then(({ data }) => onSession(data?.session), () => {}); }
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && uid && Date.now() - lastRun > 20e3) sync(); });
    window.addEventListener("online", () => { if (uid) sync(); });
    window.addEventListener("offline", () => { if (uid) set({ phase: "offline" }); });
    A.on("watch", () => S.paint());
  };
})();
