// Pruebas de sync.js: qué claves se sincronizan, la fusión clave a clave y dos "dispositivos" contra un servidor
// falso que se comporta como supabase/schema.sql (RLS por usuario, gana el updated_at más reciente, synced_at del
// servidor). Ejecutar: node --test web/tests/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

/* Los objetos de otro contexto de vm tienen otro prototipo: se comparan por su JSON. */
const eq = (a, b, msg) => assert.deepEqual(JSON.parse(JSON.stringify(a ?? null)), JSON.parse(JSON.stringify(b ?? null)), msg);
const SRC = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8");

/* ---------- servidor falso ---------- */
function fakeServer() {
  const rows = new Map(); // `${uid}\u0000${key}` -> fila
  let last = 0;
  const now = () => (last = Math.max(Date.now(), last + 1));
  return {
    rows,
    client(uid) {
      return {
        select() {
          const q = { since: null, from: 0, to: 999 };
          const b = {
            order: () => b,
            range: (a, z) => ((q.from = a), (q.to = z), b),
            gte: (_c, iso) => ((q.since = Date.parse(iso)), b),
            then: (res) => {
              const data = [...rows.values()].filter((r) => r.user_id === uid && (q.since == null || Date.parse(r.synced_at) >= q.since))
                .sort((x, y) => x.synced_at.localeCompare(y.synced_at) || x.key.localeCompare(y.key)).slice(q.from, q.to + 1)
                .map(({ key, value, updated_at, synced_at }) => ({ key, value: structuredClone(value), updated_at, synced_at }));
              res({ data, error: null });
            },
          };
          return b;
        },
        async upsert(list) {
          for (const r of list) {
            if (r.user_id !== uid) return { error: { message: "RLS" } };
            const id = r.user_id + "\u0000" + r.key, old = rows.get(id);
            if (old && Date.parse(r.updated_at) < Date.parse(old.updated_at)) continue; // el disparador devuelve null
            rows.set(id, { ...structuredClone(r), synced_at: new Date(now()).toISOString() });
          }
          return { error: null };
        },
      };
    },
  };
}

/* ---------- un navegador con i18n.js, core.js y sync.js ---------- */
function device(server, uid, initial = {}) {
  const ls = new Map(Object.entries(initial).map(([k, v]) => ["atalaya:" + k, JSON.stringify(v)]));
  const localStorage = {
    getItem: (k) => (ls.has(k) ? ls.get(k) : null), setItem: (k, v) => ls.set(k, String(v)), removeItem: (k) => ls.delete(k),
    key: (i) => [...ls.keys()][i] ?? null, get length() { return ls.size; },
  };
  if (uid) localStorage.setItem("atalaya-auth", "{}");
  const listeners = [];
  const ctx = {
    localStorage, URL, URLSearchParams, structuredClone, console,
    navigator: { onLine: true, language: "es-ES" },
    location: { href: "http://localhost:8766/", hash: "", search: "", pathname: "/", origin: "http://localhost:8766" },
    history: { state: null, replaceState() {} },
    document: { visibilityState: "visible", documentElement: { dataset: {} }, activeElement: null, head: { appendChild() {} }, addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] },
    addEventListener() {}, confirm: () => true,
    setTimeout: (fn, ms) => { const h = setTimeout(fn, ms); h.unref?.(); return h; }, clearTimeout,
    setInterval: () => 0, clearInterval: () => {},
    ATALAYA_SUPABASE: { url: "https://x.supabase.co", key: "k" },
    supabase: {
      createClient: () => ({
        auth: {
          onAuthStateChange: (fn) => listeners.push(fn),
          getSession: async () => ({ data: { session: uid ? { user: { id: uid, email: uid + "@example.com", app_metadata: { provider: "email" }, user_metadata: {} } } : null } }),
          signOut: async () => {},
        },
        from: () => server.client(uid),
      }),
    },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const f of ["i18n.js", "core.js", "sync.js"]) vm.runInContext(SRC(f), ctx, { filename: f });
  const A = ctx.A;
  A.toast = () => {};
  const get = (k) => { const s = ls.get("atalaya:" + k); return s == null ? undefined : JSON.parse(s); };
  const settle = async () => {
    for (let i = 0; i < 200; i++) {
      await new Promise((r) => setTimeout(r, 5));
      if (A.sync.state.phase === "idle" || A.sync.state.phase === "error") break;
    }
    assert.equal(A.sync.state.phase, "idle", A.sync.state.error || "");
  };
  return { A, get, ls, settle, meta: () => get("~sync") };
}

/* ---------- inventario ---------- */
test("se sincronizan los datos del jugador y no las preferencias de interfaz", () => {
  const { A } = device(fakeServer(), null);
  for (const k of ["homes", "watch", "rules:ts1.x1.europe.travian.com", "webhook", "fbMarks:s", "farmText:s", "farmArmy:s", "reportText:s", "culture:s", "incoming:s", "ops:s", "land:s", "army:s"])
    assert.ok(A.sync.syncable(k), k);
  for (const k of ["theme", "lang", "sid", "filters", "mapMode", "nb", "landView", "opsUtc", "srv:prefs", "fbPrefs", "fbq:s", "fbResume", "~sync", "~backup:homes"])
    assert.ok(!A.sync.syncable(k), k);
});

test("cada escritura de una clave sincronizable queda apuntada como pendiente; las preferencias no", () => {
  const d = device(fakeServer(), null);
  d.A.store.set("homes", { s: { x: 1, y: 2, tid: 1 } });
  d.A.store.set("theme", "dark");
  const m = d.meta();
  assert.ok(m.keys.homes.d && m.keys.homes.t > 0);
  assert.equal(m.keys.theme, undefined);
});

/* ---------- reglas de fusión ---------- */
test("plan: gana el más reciente; lo limpio acepta la nube; lo pendiente se sube", () => {
  const { A } = device(fakeServer(), null);
  const { apply, push } = A.sync.plan(
    { a: { v: 1, t: 10, d: true }, b: { v: 1, t: 10, d: true }, c: { v: 1, t: 10, d: false }, e: { v: 5, t: 3, d: true } },
    { a: { v: 2, t: 5 }, b: { v: 2, t: 20 }, c: { v: 2, t: 5 }, f: { v: 9, t: 7 } });
  eq(Object.keys(push).sort(), ["a", "e"]);
  eq(Object.keys(apply).sort(), ["b", "c", "f"]);
  assert.equal(apply.b.v, 2);
});

test("plan: lo de antes de tener cuenta se fusiona con la nube sin perder nada", () => {
  const { A } = device(fakeServer(), null);
  const local = { s1: [{ type: "player", id: 1, addedAt: "a" }, { type: "alliance", id: 7 }], s2: [{ type: "player", id: 3 }] };
  const cloud = { s1: [{ type: "player", id: 1, addedAt: "b" }, { type: "player", id: 2 }] };
  const { apply, push, backup } = A.sync.plan({ watch: { v: local, t: null, d: true } }, { watch: { v: cloud, t: 50 } }, 100);
  eq(apply.watch.v, { s1: [{ type: "player", id: 1, addedAt: "b" }, { type: "player", id: 2 }, { type: "alliance", id: 7 }], s2: [{ type: "player", id: 3 }] });
  assert.equal(push.watch.t, 100);
  eq(backup.watch, local);
  // Las tuplas (marcas del asistente) no se mezclan: manda la nube en las que coinciden.
  eq(A.sync.mergeLegacy({ "1|1": ["a", 1], "2|2": ["x", 2] }, { "1|1": ["s", 3] }), { "1|1": ["s", 3], "2|2": ["x", 2] });
  // Reglas sin id: sin repetir las iguales.
  eq(A.sync.mergeLegacy([{ kind: "k", params: { uid: 1 } }], [{ kind: "k", params: { uid: 1 } }, { kind: "z", params: {} }]), [{ kind: "k", params: { uid: 1 } }, { kind: "z", params: {} }]);
});

test("de un HAR solo sube el JSON de las respuestas, sin cabeceras ni cookies", () => {
  const { A } = device(fakeServer(), null);
  const body = JSON.stringify({ data: { ownPlayer: { farmLists: [{ id: 5, name: "L1", slots: [{ target: { x: 1, y: 2 } }] }] } } });
  const har = JSON.stringify({ log: { entries: [{ request: { headers: [{ name: "Cookie", value: "T3E=secreto" }] }, response: { content: { text: body } } }] } });
  const out = A.sync.outbound(har);
  assert.ok(!out.includes("secreto") && !out.includes("Cookie"));
  eq(A.jsonValues(out), A.jsonValues(har));
  assert.equal(A.sync.outbound("texto normal"), "texto normal");
  eq(A.sync.outbound({ a: 1 }), { a: 1 });
});

/* ---------- dos dispositivos ---------- */
/* ---------- errores ---------- */
test("los errores habituales de Supabase se explican en el idioma de la interfaz", () => {
  const { A } = device(fakeServer(), null);
  const S = A.sync;
  const es = (k) => A.t("acct.err." + k);
  assert.equal(S.explain({ name: "AuthApiError", status: 429, code: "over_email_send_rate_limit", message: "email rate limit exceeded" }), es("rateEmail"));
  assert.equal(S.explain({ message: "email rate limit exceeded" }), es("rateEmail"), "sin código, por el texto");
  assert.equal(S.explain({ status: 429, message: "Request rate limit reached" }), es("rateReq"));
  assert.equal(S.explain({ code: "otp_expired", message: "Token has expired or is invalid" }), es("expired"));
  assert.equal(S.explain({ code: "otp_expired", message: "Email link is invalid or has expired" }), es("expired"), "error_code que vuelve en la dirección");
  assert.equal(S.explain({ code: "email_address_not_authorized", message: "Email address not authorized" }), es("notAuthorized"));
  assert.equal(S.explain({ code: "refresh_token_not_found", message: "Invalid Refresh Token" }), es("session"));
  assert.equal(S.explain({ code: "P0001", message: "atalaya: se ha superado el espacio por usuario (25 MB)" }), es("quotaSize"));
  assert.equal(S.explain({ code: "P0001", message: "atalaya: demasiadas claves para este usuario" }), es("quotaKeys"));
  assert.equal(S.explain({ code: "23514", message: "new row violates check constraint" }), es("tooBig"));
  assert.equal(S.explain(new TypeError("Failed to fetch")), es("network"));
  assert.equal(S.explain({ name: "AuthRetryableFetchError", status: 0, message: "{}" }), es("network"));
  assert.equal(S.explain({ status: 503, message: "Service Unavailable" }), es("server"));
  assert.equal(S.explain({ message: "algo raro" }), A.t("acct.error", { e: "algo raro" }), "lo desconocido se muestra tal cual");
  assert.ok(!es("rateEmail").startsWith("acct."), "la traducción existe");
  A.setLang?.("en");
  if (A.lang === "en") assert.match(S.explain({ code: "over_email_send_rate_limit" }), /Too many emails/);
});

test("si la nube rechaza una subida por la cuota, el estado lo explica", async () => {
  const server = fakeServer();
  const client = server.client;
  server.client = (uid) => ({ ...client(uid), upsert: async () => ({ error: { code: "P0001", message: "atalaya: se ha superado el espacio por usuario (25 MB)" } }) });
  const d = device(server, "u1", { homes: { s: { x: 1, y: 2, tid: 1 } } });
  d.A.sync.boot();
  for (let i = 0; i < 200 && d.A.sync.state.phase !== "error"; i++) await new Promise((r) => setTimeout(r, 5));
  assert.equal(d.A.sync.state.phase, "error");
  assert.equal(d.A.sync.state.error, d.A.t("acct.err.quotaSize"));
});

test("dos dispositivos con la misma cuenta acaban con los mismos datos", async () => {
  const server = fakeServer();
  const pc = device(server, "u1", { homes: { s: { x: 1, y: 1, tid: 1 } }, theme: "dark" });
  pc.A.sync.boot();
  await pc.settle();
  eq(server.rows.get("u1\u0000homes").value, { s: { x: 1, y: 1, tid: 1 } });
  assert.ok(!server.rows.has("u1\u0000theme"));
  assert.equal(pc.meta().keys.homes.d, undefined);

  // El móvil tenía datos de antes (sin fecha): se fusionan y suben.
  const phone = device(server, "u1", { homes: { t: { x: 5, y: 5, tid: 3 } }, "rules:s": [{ kind: "area_conquest", params: { x: 0, y: 0, radius: 9 } }] });
  phone.A.sync.boot();
  await phone.settle();
  eq(phone.get("homes"), { t: { x: 5, y: 5, tid: 3 }, s: { x: 1, y: 1, tid: 1 } });
  eq(phone.A.state.homes, phone.get("homes"), "el estado en memoria se recarga");
  eq(phone.get("~backup:homes"), { t: { x: 5, y: 5, tid: 3 } });

  await pc.A.sync.now();
  eq(pc.get("homes"), phone.get("homes"));
  eq(pc.get("rules:s"), [{ kind: "area_conquest", params: { x: 0, y: 0, radius: 9 } }]);

  // Un cambio en el PC llega al móvil; uno más antiguo del móvil no lo pisa.
  phone.A.store.set("land:s", { old: true });
  await new Promise((r) => setTimeout(r, 5));
  pc.A.store.set("land:s", { fresh: true });
  await pc.A.sync.now();
  await phone.A.sync.now();
  eq(phone.get("land:s"), { fresh: true });
  await pc.A.sync.now();
  eq(pc.get("land:s"), { fresh: true });
  assert.equal(phone.meta().keys["land:s"].d, undefined);

  // Borrar (guardar null) también se sincroniza.
  pc.A.store.set("land:s", null);
  await pc.A.sync.now();
  await phone.A.sync.now();
  assert.equal(phone.get("land:s"), null);
});

test("otra cuenta en el mismo navegador no hereda los datos de la anterior", async () => {
  const server = fakeServer();
  const a = device(server, "ua", { watch: { s: [{ type: "player", id: 1 }] } });
  a.A.sync.boot();
  await a.settle();
  const b = device(server, "ub", Object.fromEntries([...a.ls].filter(([k]) => k.startsWith("atalaya:")).map(([k, v]) => [k.slice("atalaya:".length), JSON.parse(v)])));
  b.A.sync.boot();
  await b.settle();
  assert.equal(b.get("watch"), undefined);
  assert.ok(![...server.rows.keys()].some((k) => k.startsWith("ub")), "nada de la cuenta A sube a la B");
});
