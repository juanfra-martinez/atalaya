// Pruebas de gamedata.js, terrain.js y de los lectores nuevos de intel.js, con datos reales de International 7
// (ts7.x1.international.travian.com, 18 nov 2026). Ejecutar: node --test web/tests/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

globalThis.window = globalThis;
for (const f of ["core.js", "gamedata.js", "intel.js", "terrain.js", "ops.js"]) vm.runInThisContext(readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8"), { filename: f });
const A = globalThis.A;

const V = (vid, x, y, uid, name, pop) => ({ vid, x, y, uid, name, pop, capital: 1, d1: 0, d3: 0, tid: 1 });
const P = (uid, name) => ({ uid, name, tid: 1, aid: 0, pop: 100, villages: 1, popHist: [100, 100], status: "active", streak: 0, bounded: false, confidence: 0, flags: [], growth: 0, firstSeen: "2026-11-17" });
function world(villages) {
  const players = [...new Set(villages.map((v) => v.uid))].map((u) => P(u, "p" + u));
  const S = { players: Object.keys(players[0]), alliances: ["aid", "tag", "pop", "members", "villages", "popHist", "firstSeen"], villages: Object.keys(villages[0]) };
  return A.hydrate({ server: { radius: 200, speed: 1 }, days: ["2026-11-17", "2026-11-18"], schema: S, players: players.map((p) => S.players.map((k) => p[k])), alliances: [], villages: villages.map((v) => S.villages.map((k) => v[k])) });
}

/* ---------- tropas ---------- */

test("las estadísticas cubren las siete tribus jugables y cuadran con A.UNITS y A.CROP", () => {
  assert.deepEqual(Object.keys(A.STATS).map(Number), A.PLAYABLE.slice().sort((a, b) => a - b));
  for (const tid of A.PLAYABLE) {
    assert.equal(A.UNITS[tid].length, 10);
    assert.equal(A.STATS[tid].length, 10);
    A.STATS[tid].forEach((s, i) => {
      assert.equal(s.length, 10);
      if (i < 6) assert.equal(s[7], A.CROP[tid][i], `consumo ${tid}/${i}`);
    });
  }
  assert.deepEqual(A.STATS[1][0], [40, 35, 50, 120, 100, 150, 30, 1, 1600, 0]); // legionario
  assert.deepEqual(A.STATS[6][0].slice(0, 7), [10, 30, 20, 45, 60, 30, 15]); // infante esclavo
});

test("los nombres de las tropas son los del juego en español y en inglés", () => {
  // Copiados de /js/es-ES/truppen.json y /js/en-US/truppen.json (International 7, versión 718.7, 27 nov 2026).
  const es = (tid) => A.UNITS[tid].map((u) => u[0]), en = (tid) => A.UNITS[tid].map((u) => u[1]);
  assert.deepEqual(es(6), ["Infante esclavo", "Guardia Ash", "Guerreros de Khopes", "Explorador Sopdu", "Guarda Osiris", "Carro de Reshef", "Ariete", "Catapulta de piedra", "Visir", "Colono"]);
  assert.deepEqual(en(6), ["Slave Militia", "Ash Warden", "Khopesh Warrior", "Sopdu Explorer", "Anhur Guard", "Resheph Chariot", "Ram", "Stone Catapult", "Nomarch", "Settler"]);
  assert.deepEqual(es(1).slice(6, 8), ["Ariete", "Catapulta de fuego"]);
  assert.deepEqual(es(2).slice(5, 7), ["Jinete Teutón", "Ariete de madera"]);
  assert.deepEqual(es(3).slice(6, 8), ["Ariete de madera", "Catapulta de guerra"]);
  assert.equal(es(7)[4], "Jinete certero");
  assert.deepEqual(es(8).slice(3, 6), ["Terión de doble hoja", "Jinete elpida", "Hippei corintio"]);
  assert.equal(es(9)[0], "Esclavo");
  A.lang = "en"; assert.equal(A.unitName(3, 3), "Theutates Thunder");
  A.lang = "es"; assert.equal(A.unitName(3, 3), "Rayo de Teutates");
});

test("armyTotals separa infantería y caballería y suma coste, consumo, carga y formación", () => {
  const r = A.armyTotals(6, [10, 2, 0, 0, 5]); // 10 infantes esclavos, 2 guardias Ash, 5 guardas Osiris
  assert.equal(r.n, 17);
  assert.equal(r.attInf, 10 * 10 + 2 * 30);
  assert.equal(r.attCav, 5 * 50);
  assert.equal(r.att, 410);
  assert.equal(r.defInf, 10 * 30 + 2 * 55 + 5 * 110);
  assert.equal(r.defCav, 10 * 20 + 2 * 40 + 5 * 50);
  assert.deepEqual(r.cost, [450 + 230 + 1800, 600 + 200 + 1650, 300 + 290 + 1400, 150 + 120 + 600]);
  assert.equal(r.upkeep, 10 + 2 + 10);
  assert.equal(r.carry, 10 * 15 + 2 * 50 + 5 * 50);
  assert.equal(r.train, 10 * 530 + 2 * 1380 + 5 * 2560);
  assert.equal(r.slowest, 1); // la guardia Ash va a 6 casillas/hora
  assert.equal(A.armyTotals(4, [1]), null); // la naturaleza no es una tribu jugable
  assert.equal(A.armyTotals(1, []).n, 0);
});

test("maxUnits: sin cambio de mercado manda el recurso escaso; con él, el total", () => {
  // Legionario: 120 / 100 / 150 / 30 = 400
  assert.equal(A.maxUnits(1, 0, [1200, 1000, 300, 300]), 2);
  assert.equal(A.maxUnits(1, 0, [1200, 1000, 300, 300], true), 7);
  assert.equal(A.maxUnits(4, 0, [1, 1, 1, 1]), null);
});

test("unitValue da puntos por 1000 recursos y por cereal", () => {
  const v = A.unitValue(2, 0); // luchador de porra: 40 de ataque por 250 recursos
  assert.equal(v.total, 250);
  assert.equal(v.attPerK, 160);
  assert.equal(v.carryPerK, 240);
  assert.equal(v.cav, false);
  assert.equal(A.unitValue(4, 0), null);
});

/* ---------- plaza de reuniones ---------- */

const RALLY = [
  "Plaza de reuniones Nivel 1", "General", "Resumen", "Enviar tropas", "Simuladores", "Lista de vacas", " ", "Tropas saliendo (4)",
  "A-00\tExplorar valle abandonado ‭(‭57‬|‭32‬)‬", "‭(‭52‬|‭32‬)‬\t\t\t\t\t\t\t\t\t\t\t", "Tropas\t4\t2\t0\t0\t0\t0\t0\t0\t0\t0\t0", "Llegada\t", "en  0:10:03  h.", "a las  08:43:00",
  "A-00\tExplorar valle abandonado ‭(‭61‬|‭37‬)‬", "‭(‭52‬|‭32‬)‬\t\t\t\t\t\t\t\t\t\t\t", "Tropas\t0\t0\t0\t0\t0\t0\t0\t0\t0\t0\t1", "Llegada\t", "en  0:30:04  h.", "a las  09:03:01",
  "Tropas en esta aldea y sus oasis (1)",
  "A-00\tTropas propias", "‭(‭52‬|‭32‬)‬\t\t\t\t\t\t\t\t\t\t\t", "Tropas\t10\t2\t0\t0\t0\t0\t0\t0\t0\t0\t0", "Consumo\t", "12", " por hora",
].join("\n");

test("parseRallyPoint lee los movimientos con cuenta atrás y descarta las tropas en casa", () => {
  const r = A.parseRallyPoint(RALLY);
  assert.equal(r.length, 2);
  assert.deepEqual(r[0].from, { x: 52, y: 32 });
  assert.deepEqual(r[0].to, { x: 57, y: 32 });
  assert.equal(r[0].village, "A-00");
  assert.equal(r[0].eta, 603);
  assert.equal(r[0].at, "08:43:00");
  assert.deepEqual(r[0].troops, [4, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.equal(r[1].eta, 1804);
  assert.deepEqual(r[1].to, { x: 61, y: 37 });
  assert.deepEqual(A.parseRallyPoint("nada que leer\n12|3 suelto"), []);
});

test("parseRallyPoint acepta un ataque entrante sin coordenadas de destino en el título", () => {
  const txt = ["Tropas entrantes (1)", "Roma\tb0b ataca A-00", "(-12|45)\t\t\t\t\t\t\t\t\t\t", "Tropas\t?\t?\t?\t?\t?\t?\t?\t?\t?\t?", "Llegada\t", "en 1:02:03 h.", "a las 10:00:00"].join("\n");
  const [r] = A.parseRallyPoint(txt);
  assert.deepEqual(r.from, { x: -12, y: 45 });
  assert.equal(r.to, null);
  assert.equal(r.troops, null);
  assert.equal(r.eta, 3723);
});

/* ---------- guerras ---------- */

test("conflicts cuenta conquistas por pareja de alianzas y aparta las internas", () => {
  const ev = [
    { type: "conquered", aid: 1, aid_prev: 2, pop: 300, day: "2026-11-10" },
    { type: "conquered", aid: 1, aid_prev: 2, pop: 200, day: "2026-11-12" },
    { type: "conquered", aid: 2, aid_prev: 1, pop: 100, day: "2026-11-11" },
    { type: "conquered", aid: 3, aid_prev: 3, pop: 50, day: "2026-11-11" },
    { type: "conquered", aid: 3, aid_prev: 0, pop: 80, day: "2026-11-11" },
    { type: "conquered", aid: 0, aid_prev: 0, pop: 80, day: "2026-11-11" },
    { type: "founded", aid: 1, pop: 2, day: "2026-11-11" },
  ];
  const r = A.conflicts(ev);
  assert.equal(r.internal, 1);
  assert.equal(r.pairs.length, 3);
  assert.deepEqual({ ...r.pairs[0] }, { a: 1, b: 2, n: 2, pop: 500, last: "2026-11-12", back: 1 });
  assert.equal(r.pairs.find((p) => p.a === 2).back, 2);
  assert.equal(r.pairs.find((p) => p.a === 3).b, 0);
});

/* ---------- terreno ---------- */

const C = (x, y) => `&#x202d;<span class="coordinates coordinatesWrapper"><span class="coordinateX">(&#x202d;${x}&#x202c;</span><span class="coordinatePipe">|</span><span class="coordinateY">&#x202d;${y}&#x202c;)</span></span>&#x202c;<span class="tileDistance">{k.distance} [[DISTANCE]]</span>`;
const U = (id, n) => `<br /><div class="inlineIcon tooltipUnit" title=""><i class="unit u${id}"></i><span class="value ">${n}</span></div>`;
const MAP = JSON.stringify({ tiles: [
  { aid: 15, did: 24361, position: { x: 37, y: 47 }, text: C(37, 47) + "<br />{k.spieler} iM HERE<br />{k.einwohner} 168", title: "{k.dt} ATLANTIS", uid: 80 },
  { position: { x: 38, y: 47 }, text: C(38, 47), title: "{k.vt} {k.f9}" },
  { position: { x: 39, y: 47 }, text: C(39, 47), title: "Bosque" },
  { position: { x: 40, y: 47 }, text: C(40, 47), title: "{k.vt} {k.f6}" },
  { position: { x: 41, y: 47 }, text: C(41, 47), title: "{k.vt} {k.f1}" },
  { did: -1, position: { x: 43, y: 47 }, text: C(43, 47) + "<br />{a:r3} {a.r3} 25%", title: "{k.fo}" },
  { did: -1, position: { x: 42, y: 46 }, text: C(42, 46) + "<br />{a:r4} {a.r4} 50%", title: "{k.fo}" },
  { did: -1, position: { x: 44, y: 47 }, text: C(44, 47) + "<br />{a:r3} {a.r3} 25%<br />{a:r4} {a.r4} 25%", title: "{k.fo}" },
  { did: -1, position: { x: 39, y: 45 }, text: C(39, 45) + "<br />{a:r1} {a.r1} 25%<br />{a:r4} {a.r4} 25%<br />{k.animals}" + U(35, 4) + U(36, 4) + U(37, 2), title: "{k.fo}" },
  { did: 999, uid: 80, aid: 15, position: { x: 41, y: 45 }, text: C(41, 45) + "<br />{a:r4} {a.r4} 25%", title: "{k.bt}" },
] });

test("parseMapTiles separa casillas libres, oasis con su bono y animales, y oasis ocupados", () => {
  const r = A.parseMapTiles(MAP);
  assert.equal(r.covered.length, 10);
  assert.deepEqual(r.free, [[38, 47, 9], [40, 47, 6], [41, 47, 1]]);
  assert.equal(r.oases.length, 5);
  assert.deepEqual(r.oases[0], [43, 47, [0, 0, 25, 0], [], 0, null]);
  assert.deepEqual(r.oases[1], [42, 46, [0, 0, 0, 50], [], 0, null]);
  assert.deepEqual(r.oases[3], [39, 45, [25, 0, 0, 25], [[35, 4], [36, 4], [37, 2]], 0, null]);
  assert.equal(r.oases[4][4], 1); // tiene dueño
  assert.equal(A.parseMapTiles("no es json"), null);
  assert.equal(A.parseMapTiles('{"otra":"cosa"}'), null);
  assert.deepEqual(A.parseMapTiles("texto antes " + MAP + " y después").free.length, 3); // tolera texto alrededor
});

test("landMerge sustituye la zona importada y conserva el resto", () => {
  const first = A.landMerge(null, A.parseMapTiles(MAP), 1);
  assert.equal(first.free.length, 3);
  // Segunda importación: en (40|47) ya hay una aldea y aparece un cropper nuevo fuera de la zona anterior.
  const again = A.parseMapTiles(JSON.stringify({ tiles: [{ position: { x: 40, y: 47 }, uid: 5, did: 7, title: "{k.dt} Nueva", text: "" }, { position: { x: 90, y: 90 }, title: "{k.vt} {k.f6}", text: "" }] }));
  const land = A.landMerge(first, again, 2);
  assert.deepEqual(land.free.map((f) => f.join()), ["38,47,9", "41,47,1", "90,90,6"]);
  assert.equal(land.oases.length, 5);
  assert.equal(land.at, 2);
});

test("settleSpots calcula el bono de cereal con los tres mejores oasis libres del 7×7", () => {
  const w = world([V(1, 37, 47, 80, "ATLANTIS", 168), V(2, 52, 32, 9, "A-00", 156)]);
  const land = A.landMerge(null, A.parseMapTiles(MAP));
  const spots = A.settleSpots(land, w, { x: 52, y: 32 });
  const at = (x, y) => spots.find((s) => s.x === x && s.y === y);
  const c15 = at(40, 47);
  assert.equal(c15.label, "15c");
  assert.deepEqual(c15.fields, [1, 1, 1, 15]);
  // Oasis libres a 3 casillas o menos de (40|47): 43|47 (hierro), 42|46 (50 % cereal) y 39|45 (25 % cereal). 44|47 queda a 4.
  assert.equal(c15.oases, 3);
  assert.equal(c15.taken, 1); // 41|45 tiene dueño y no suma
  assert.equal(c15.cropBonus, 75);
  assert.equal(c15.crop, 26.25);
  assert.equal(c15.villages, 1);
  assert.equal(c15.nearest.name, "ATLANTIS");
  assert.equal(c15.nearestDist, 3);
  assert.equal(c15.dist.toFixed(1), "19.2");
  // (41|47) sí alcanza 44|47: sus tres mejores oasis de cereal son 50 + 25 + 25.
  assert.equal(at(41, 47).cropBonus, 100);
  assert.equal(at(41, 47).label, "9c");
  assert.equal(at(38, 47).label, "4-3-4-7");
  // Una casilla donde map.sql ya tiene una aldea no se ofrece.
  const w2 = world([V(1, 40, 47, 80, "X", 2)]);
  assert.equal(A.settleSpots(land, w2, null).some((s) => s.x === 40 && s.y === 47), false);
});

test("settleSpots cruza el borde del mapa", () => {
  const w = world([V(1, 0, 0, 1, "c", 10)]);
  const land = { free: [[200, 0, 6]], oases: [[-200, 1, [0, 0, 0, 50], [], 0]] };
  assert.equal(A.settleSpots(land, w, null)[0].cropBonus, 50);
});

test("oasisTargets suma fuerza de los animales y experiencia de héroe", () => {
  const w = world([V(1, 52, 32, 9, "A-00", 156)]);
  const land = A.landMerge(null, A.parseMapTiles(MAP));
  const list = A.oasisTargets(land, w, { x: 52, y: 32 });
  assert.equal(list.length, 4); // el ocupado no es objetivo
  const o = list.find((x) => x.x === 39 && x.y === 45);
  assert.equal(o.n, 10);
  assert.equal(o.defInf, 4 * 70 + 4 * 80 + 2 * 140);
  assert.equal(o.defCav, 4 * 33 + 4 * 70 + 2 * 200);
  assert.equal(o.xp, 4 * 2 + 4 * 2 + 2 * 3);
  assert.equal(list.find((x) => x.x === 42).n, 0);
});

/* ---------- operaciones ---------- */

test("planOps calcula la salida de cada oleada para una llegada común", () => {
  const w = world([V(1, 0, 0, 1, "Roma", 300), V(2, 30, 40, 2, "Diana", 500), V(3, 0, 10, 3, "Galia", 200)]);
  w.vById.get(3).tid = 3; // la aldea de (0|10) es gala
  const land = Date.UTC(2026, 10, 21, 20, 0, 0);
  const op = { name: "Sábado", land, speed: 1, rows: [
    { from: "0|0", to: "30|40", tid: 1, unit: 7, ts: 0, kind: "real", offset: 0, who: "ana" },   // catapulta romana, 50 casillas a 3/h
    { from: "0|10", to: "p2", tid: 1, unit: 3, ts: 0, kind: "fake", offset: -1, who: "" },        // rayo de Teutates: la tribu sale de la aldea
    { from: "0|0", to: "30|40", tid: 1, unit: 7, ts: 10, kind: "real", offset: 1, who: "" },      // con plaza de torneos 10
    { from: "0|0", to: "", tid: 1, unit: 0, ts: 0, kind: "real", offset: 0, who: "" },            // sin destino
    { from: "5|5", to: "0|0", tid: 7, unit: 99, ts: 0, kind: "real", offset: 0, who: "" },        // origen vacío: vale la tribu de la fila
  ] };
  const plan = A.planOps(op, w);
  assert.equal(plan[0].dist, 50);
  assert.equal(plan[0].sec, 60000);
  assert.equal(plan[0].send, land - 60000e3);
  assert.equal(plan[0].p.name, "p1");
  assert.equal(plan[1].tid, 3);
  assert.deepEqual(plan[1].to, { x: 30, y: 40 }); // nombre de jugador → su capital
  assert.equal(plan[1].land, land - 1000);
  assert.equal(plan[1].send, land - 1000 - Math.round(A.travel(Math.hypot(30, 30), 19)) * 1000);
  // Plaza de torneos 10: los primeros 20 campos a 3/h y los 30 restantes tres veces más rápido.
  assert.equal(Math.round(plan[2].sec), Math.round((20 / 3 + 30 / 9) * 3600));
  assert.equal(plan[3].ok, false);
  assert.equal(plan[4].tid, 7);
  assert.equal(plan[4].unit, 8); // índice fuera de rango, acotado a lo que ofrece el selector (sin colono)
  const s = A.opsSummary(plan, land - 61000e3);
  assert.deepEqual([s.n, s.ok, s.real, s.fake, s.targets, s.origins, s.late], [5, 4, 3, 1, 2, 3, 0]);
  assert.equal(s.first, plan[0].send);
  assert.equal(A.opsSummary(plan, land).late, 4);
  // En un mundo ×2 el viaje dura la mitad.
  assert.equal(A.planOps({ ...op, speed: 2 }, w)[0].sec, 30000);
});

test("el enlace del plan va y vuelve, también con nombres no latinos, y rechaza basura", () => {
  const op = { name: "Операция ñ 攻撃", land: 1795291200000, speed: 3, rows: [{ from: "-12|45", to: "قرية", tid: 6, unit: 4, ts: 7, kind: "fake", offset: -2, who: "b4ll4" }, { from: "1|1", to: "2|2", tid: 1, unit: 0, ts: 0, kind: "real", offset: 0, who: "" }] };
  const code = A.opsEncode(op);
  assert.match(code, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(A.opsDecode(code), op);
  assert.equal(A.opsDecode("%%%"), null);
  assert.equal(A.opsDecode(code.slice(0, 20)), null);
  assert.equal(A.opsDecode(Buffer.from('{"l":"x","r":[]}').toString("base64")), null);
});

test("opsRowNew continúa un tren y opsText ordena por hora de salida", () => {
  assert.equal(A.opsRowNew({ from: "1|1", to: "2|2", tid: 1, unit: 0, ts: 0, kind: "real", offset: 0, who: "x" }).offset, 1);
  assert.equal(A.opsRowNew(null, { x: 5, y: -6, tid: 3 }).from, "5|-6");
  const w = world([V(1, 0, 0, 1, "Roma", 300), V(2, 30, 40, 2, "Diana", 500)]);
  const op = { name: "", land: 1e12, speed: 1, rows: [{ from: "0|0", to: "30|40", tid: 1, unit: 4, ts: 0, kind: "fake", offset: 0, who: "" }, { from: "0|0", to: "30|40", tid: 1, unit: 7, ts: 5, kind: "real", offset: 0, who: "ana" }] };
  const txt = A.opsText(op, A.planOps(op, w), { fmt: "bb", clock: (ms) => "T" + (ms - 1e12) / 1000, labels: { title: "Operaciones", land: "llega", real: "Real", fake: "Fake", ts: "PT" } }).split("\n");
  assert.equal(txt.length, 3);
  assert.equal(txt[0], "[b]Operaciones[/b] · llega T0");
  assert.match(txt[1], /^\[b\]T-\d+\[\/b\] ana \[x\|y\]0\|0\[\/x\|y\] → \[x\|y\]30\|40\[\/x\|y\] · Real · Catapulta de fuego · PT 5 · llega T0$/);
  assert.match(txt[2], /Fake · Equites Imperatoris · llega T0$/);
});

test("troopSpeed aplica la tabla de velocidad de tropas y no la del mundo tal cual", () => {
  assert.deepEqual([1, 2, 3, 5, 10].map(A.troopSpeed), [1, 2, 2, 2, 4]);
  assert.deepEqual([4, 8, 20, 0, undefined].map(A.troopSpeed), [2, 2, 4, 1, 1]); // fuera de la tabla: el tramo que toca
  assert.equal(A.opsNew({ server: { speed: 3 } }).speed, 2);
  assert.equal(A.opsNew({ server: { speed: 1 } }).speed, 1);
});

test("la clasificación no cuenta a los Natares: el primer jugador real es el número 1", () => {
  const w = world([V(1, 0, 0, 1, "Natars", 900), V(2, 5, 5, 2, "Ana", 300), V(3, 9, 9, 3, "Bea", 200)]);
  w.players.forEach((p, i) => { p.status = i === 0 ? "natar" : "active"; }); // el orden de entrada es por población
  const again = A.hydrate({ server: { radius: 200 }, days: w.days, schema: { players: Object.keys(w.players[0]), alliances: ["aid", "tag", "pop", "members", "villages", "popHist", "firstSeen"], villages: Object.keys(w.villages[0]) },
    players: w.players.map((p) => Object.keys(w.players[0]).map((k) => p[k])), alliances: [], villages: w.villages.map((v) => Object.keys(w.villages[0]).map((k) => v[k])) });
  assert.deepEqual(again.players.map((p) => p.rank), [null, 1, 2]);
});
