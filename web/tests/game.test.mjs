// Pruebas de lo que Atalaya lee de las respuestas del propio juego: el mapa (POST /api/v1/map/position, también
// dentro de un HAR) y los datos incrustados en la página de la lista de vacas. Formatos comprobados en International 7
// (ts7.x1.international.travian.com) el 19 nov 2026; las claves de los informes de los ejemplos son inventadas.
// Ejecutar: node --test web/tests/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

globalThis.window = globalThis;
for (const f of ["core.js", "gamedata.js", "intel.js", "terrain.js"]) vm.runInThisContext(readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8"), { filename: f });
const A = globalThis.A;

const V = (vid, x, y, uid, name, pop) => ({ vid, x, y, uid, name, pop, capital: 1, d1: 0, d3: 0, tid: 1 });
const P = (uid, name, status = "inactive") => ({ uid, name, tid: 1, aid: 0, pop: 100, villages: 1, popHist: [100, 100], status, streak: status === "inactive" ? 5 : 0, bounded: false, confidence: 80, flags: [], growth: 0, firstSeen: "2026-11-01" });
function world(villages, players, server = { radius: 200, speed: 1 }) {
  const S = { players: Object.keys(players[0]), alliances: ["aid", "tag", "pop", "members", "villages", "popHist", "firstSeen"], villages: Object.keys(villages[0]) };
  return A.hydrate({ server, days: ["2026-11-18", "2026-11-19"], schema: S, players: players.map((p) => S.players.map((k) => p[k])), alliances: [], villages: villages.map((v) => S.villages.map((k) => v[k])) });
}

/* ---------- JSON pegado ---------- */

test("jsonValues encuentra varios JSON seguidos, ignora el texto y el código de alrededor y abre los HAR", () => {
  const vals = A.jsonValues('basura {"a":1} más [1,2] function(){ return {x:1} } {"b":"}{"}');
  assert.deepEqual(vals, [{ a: 1 }, [1, 2], { b: "}{" }]);
  const har = JSON.stringify({ log: { entries: [
    { request: { url: "https://x/api/v1/map/position" }, response: { content: { text: '{"tiles":[]}' } } },
    { request: { url: "https://x/api/v1/map/position" }, response: { content: { text: Buffer.from('{"n":2}').toString("base64"), encoding: "base64" } } },
    { request: { url: "https://x/img.png" }, response: { content: {} } },
  ] } });
  assert.deepEqual(A.jsonValues(har), [{ tiles: [] }, { n: 2 }]);
  assert.deepEqual(A.jsonValues("nada"), []);
});

/* ---------- mapa ---------- */

const C = (x, y) => `&#x202d;<span class="coordinates coordinatesWrapper"><span class="coordinateX">(&#x202d;${x}&#x202c;</span><span class="coordinatePipe">|</span><span class="coordinateY">&#x202d;${y}&#x202c;)</span></span>&#x202c;<span class="tileDistance">{k.distance} [[DISTANCE]]</span>`;
const RAIDED = [
  { did: -1, position: { x: 41, y: 39 }, title: "{k.fo}", text: C(41, 39) + "<br />{a:r2} {a.r2} 25%<br />{a:r4} {a.r4} 25%<br />{b:ri1} 17.11.26, 22:42 {b.ri1}<br />{b:bi2} &#x202d;&#x202d;90&#x202c;/&#x202d;90&#x202c;&#x202c;" },
  { did: -1, position: { x: 53, y: 39 }, title: "{k.fo}", text: C(53, 39) + "<br />{a:r1} {a.r1} 25%<br />{a:r4} {a.r4} 25%<br />{b:ri1} ayer, 00:45 {b.ri1}<br />{b:bi1} &#x202d;&#x202d;1760&#x202c;/&#x202d;0&#x202c;&#x202c;" },
  { did: -1, position: { x: 53, y: 37 }, title: "{k.fo}", text: C(53, 37) + "<br />{a:r3} {a.r3} 25%<br />{b:ri1} hoy, 17:16 {b.ri1}<br />{b:bi2} &#x202d;&#x202d;75&#x202c;/&#x202d;75&#x202c;&#x202c;" },
  { did: -1, position: { x: 50, y: 34 }, title: "{k.fo}", text: C(50, 34) + "<br />{a:r4} {a.r4} 25%<br />{b:ri2} hoy, 18:10 {b.ri2}<br />{b:bi1} &#x202d;&#x202d;82&#x202c;/&#x202d;150&#x202c;&#x202c;" },
];
const NOW = new Date(2026, 10, 19, 18, 30).getTime(); // 19 nov 2026, 18:30 hora local

test("parseMapTiles lee el último atraco de cada oasis: icono, fecha, botín y capacidad", () => {
  const r = A.parseMapTiles(JSON.stringify({ tiles: RAIDED }), NOW);
  const at = (x, y) => r.oases.find((o) => o[0] === x && o[1] === y)[5];
  assert.deepEqual(at(41, 39), [1, new Date(2026, 10, 17, 22, 42).getTime(), 90, 90, "17.11.26, 22:42"]);
  assert.deepEqual(at(53, 39), [1, new Date(2026, 10, 18, 0, 45).getTime(), 1760, 0, "ayer, 00:45"]);
  assert.deepEqual(at(53, 37).slice(0, 4), [1, new Date(2026, 10, 19, 17, 16).getTime(), 75, 75]);
  const i = A.raidInfo(at(50, 34));
  assert.equal(i.losses, true);
  assert.equal(i.lost, false);
  assert.equal(Math.round(i.fill), 55);
  assert.equal(A.raidInfo(at(53, 39)).fill, null); // capacidad 0: no se puede calcular
  assert.equal(A.raidInfo(at(41, 39)).fill, 100);
});

test("raidDate entiende hoy, ayer, today, yesterday y fechas con puntos o barras", () => {
  const d = (...a) => new Date(...a).getTime();
  assert.equal(A.raidDate("today, 08:05", NOW), d(2026, 10, 19, 8, 5));
  assert.equal(A.raidDate("yesterday, 23:59", NOW), d(2026, 10, 18, 23, 59));
  assert.equal(A.raidDate("11/17/26, 10:00", NOW), d(2026, 10, 17, 10, 0)); // mm/dd/yy
  assert.equal(A.raidDate("17/11/2026, 10:00", NOW), d(2026, 10, 17, 10, 0));
  assert.equal(A.raidDate("hoy, 23:50", NOW), d(2026, 10, 18, 23, 50)); // aún no han sido las 23:50: era ayer
  assert.equal(A.raidDate("sin hora", NOW), null);
});

test("parseMapTiles junta varias respuestas pegadas seguidas o un HAR, y la última manda", () => {
  const a = JSON.stringify({ tiles: [{ position: { x: 1, y: 1 }, title: "{k.vt} {k.f6}", text: "" }, { position: { x: 2, y: 1 }, title: "{k.vt} {k.f1}", text: "" }] });
  const b = JSON.stringify({ tiles: [{ position: { x: 2, y: 1 }, uid: 7, did: 9, title: "{k.dt} Nueva", text: "" }, { position: { x: 3, y: 1 }, title: "{k.vt} {k.f13}", text: "" }] });
  const r = A.parseMapTiles(a + "\n\n" + b);
  assert.equal(r.parts, 2);
  assert.deepEqual(r.covered.sort(), ["1,1", "2,1", "3,1"]);
  assert.deepEqual(r.free, [[1, 1, 6], [3, 1, 13]]); // en (2|1) ya han fundado
  const har = JSON.stringify({ log: { entries: [a, b].map((text) => ({ request: { url: "https://x/api/v1/map/position" }, response: { content: { text } } })) } });
  assert.deepEqual(A.parseMapTiles(har).free, r.free);
});

test("la casilla 0-0-0-18 de los mundos crop18 cuenta como cropper", () => {
  assert.deepEqual(A.FIELDS[13], [0, 0, 0, 18]);
  assert.equal(A.fieldLabel(13), "18c");
  const w = world([V(1, 50, 50, 1, "X", 10)], [P(1, "x")]);
  const s = A.settleSpots({ free: [[0, 0, 13]], oases: [[1, 1, [0, 0, 0, 50], [], 0, null]] }, w, null)[0];
  assert.equal(s.label, "18c");
  assert.equal(s.crop, 27);
});

test("oasisTargets lleva el último atraco y sigue apartando los ocupados", () => {
  const w = world([V(1, 52, 32, 1, "A-00", 156)], [P(1, "yo", "active")]);
  const land = A.landMerge(null, A.parseMapTiles(JSON.stringify({ tiles: RAIDED }), NOW));
  const list = A.oasisTargets(land, w, { x: 52, y: 32 });
  assert.equal(list.length, 4);
  assert.equal(list.find((o) => o.x === 50).raid.icon, 2);
});

/* ---------- vuelta al mapa ---------- */

test("la distancia solo da la vuelta al mapa si el mundo tiene travelOverTheWorldEdge", () => {
  const vs = [V(1, 200, 0, 1, "a", 10)], ps = [P(1, "a")];
  world(vs, ps, { radius: 200, speed: 1, info: { features: ["travelOverTheWorldEdge"] } });
  assert.equal(A.dist(200, 0, -200, 0, 200), 1);
  const w = world(vs, ps, { radius: 200, speed: 1, info: { features: ["vacation"] } });
  assert.equal(w.wrap, false);
  assert.equal(A.dist(200, 0, -200, 0, 200), 400);
  world(vs, ps, { radius: 200, speed: 1 }); // sin reglas conocidas: como en los mundos normales
  assert.equal(A.dist(200, 0, -200, 0, 200), 1);
});

/* ---------- lista de vacas ---------- */

const slot = (id, x, y, type, troop, lastRaid, totalBooty, extra = {}) => ({ id, target: { id: 7000 + id, mapId: 60000 + id, x, y, name: extra.name ?? "", population: extra.pop ?? 0, type },
  troop: { t1: 0, t2: 0, t3: 0, t4: 0, t5: 0, t6: 0, t7: 0, t8: 0, t9: 0, t10: 0, ...troop }, distance: extra.dist ?? 2, isActive: extra.active ?? true, isRunning: false, isSpying: false,
  runningAttacks: 0, nextAttackAt: null, lastRaid, totalBooty });
const raid = (time, res, bootyMax, icon) => ({ reportObjectId: "1", authKey: "|deadbeef", time, raidedResources: res, bootyMax, icon });
const VIEW = { bootstrapData: { timestamp: 1795109492 }, weekendWarrior: { isNightTruce: false }, ownPlayer: { village: { id: 24669, tribeId: 6 }, abandonedFarmLists: [],
  farmLists: [
    { id: 41, name: "Oasis-Ash", slotsAmount: 3, ownerVillage: { id: 24669 }, defaultTroop: { t2: 2 }, slots: [
      slot(229, 53, 31, 3, { t2: 2 }, raid(1795103234, { lumber: 18, clay: 5, iron: 5, crop: 5 }, 100, 1), { booty: 536, raids: 10 }, { dist: 1.41421 }),
      slot(3940, 50, 32, 3, { t2: 3 }, raid(1795107702, { lumber: 15, clay: 3, iron: 3, crop: 14 }, 150, 2), { booty: 662, raids: 10 }, { dist: 2 }),
      slot(1950, 55, 28, 2, { t2: 2 }, raid(1795079157, { lumber: 1, clay: 6, iron: 1, crop: 1 }, 100, 1), { booty: 9, raids: 1 }, { dist: 5 }),
    ] },
    { id: 182, name: "Aldeas", slotsAmount: 3, ownerVillage: { id: 24669 }, defaultTroop: { t1: 5 }, slots: [
      slot(10, 60, 30, 0, { t1: 5 }, raid(1795100000, { lumber: 25, clay: 25, iron: 25, crop: 0 }, 75, 1), { booty: 600, raids: 8 }, { name: "Granja", pop: 40, dist: 8.25 }),
      slot(11, 61, 30, 0, { t1: 5 }, raid(1795100000, { lumber: 10, clay: 0, iron: 0, crop: 0 }, 75, 3), { booty: 10, raids: 1 }, { name: "Trampa", pop: 90, dist: 9.22 }),
      slot(12, 70, 30, 1, { t1: 5 }, null, null, { name: "Sin atracar", pop: 10, dist: 18.11, active: false }),
    ] },
  ] } };
/* Así va en la página (ver código fuente): dentro de una llamada de JavaScript, entre más código y otros datos. */
const PAGE = `<html><script>var x = {a: 1}; Travian.Templates = {"b":2};</script><script>
    jQuery(function() {
        window.Travian.React.FarmList.render(
            {gql: "query($onlyExpanded: Boolean){bootstrapData{timestamp}}", viewData: ${JSON.stringify(VIEW)}},
            ["allgemein","a2b","raidList"]        );
    });
</script></html>`;

test("parseFarmData lee la lista de vacas incrustada en la página del juego", () => {
  const d = A.parseFarmData(PAGE);
  assert.deepEqual(d.lists, [{ id: 41, name: "Oasis-Ash", n: 3 }, { id: 182, name: "Aldeas", n: 3 }]);
  assert.equal(d.entries.length, 6);
  const e = d.entries[0];
  assert.deepEqual([e.x, e.y, e.oasis, e.dist, e.units, e.loot, e.cap, e.icon, e.raids, e.booty, e.list], [53, 31, "free", 1.41421, 2, 33, 100, 1, 10, 536, "Oasis-Ash"]);
  assert.equal(e.time, 1795103234000);
  assert.equal(e.avg, 53.6);
  assert.deepEqual(e.troops, [0, 2, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.equal(d.entries[2].oasis, "taken");
  assert.equal(d.entries[3].pop, 40);
  assert.equal(d.entries[5].active, false);
  assert.equal(d.entries[5].loot, null);
  // Lo que se guarda no lleva las claves que abren los informes y se vuelve a leer igual.
  const saved = JSON.stringify(d.compact);
  assert.doesNotMatch(saved, /authKey|reportObjectId|deadbeef/);
  assert.deepEqual(A.parseFarmData(saved).entries, d.entries);
  assert.deepEqual(A.parseFarmList(saved).map((x) => [x.x, x.y]), d.entries.map((x) => [x.x, x.y]));
  assert.equal(A.parseFarmData("<html>sin datos</html>"), null);
});

test("farmVerdict usa los datos del juego: oasis, icono del último informe, capacidad y tropas exactas", () => {
  const w = world([V(1, 60, 30, 1, "Granja", 40), V(2, 61, 30, 2, "Trampa", 90), V(3, 70, 30, 3, "Sin atracar", 10), V(4, 52, 32, 4, "A-00", 156)],
    [P(1, "inactivo"), P(2, "otro"), P(3, "nuevo"), P(4, "yo", "active")]);
  const home = { x: 52, y: 32, tid: 6 };
  const d = A.parseFarmData(PAGE);
  const res = A.matchFarm(d.entries, w, home).map((m) => ({ m, ...A.farmVerdict(m, w, 6, A.farmProfit(m.e, m.e.dist, 6, 0)) }));
  const keys = (r) => r.notes.map(([k]) => k);
  // Oasis libre con un botín normal (33 de 100) y media sobre 10 atracos: mantener.
  assert.equal(res[0].verdict, "keep");
  assert.deepEqual(keys(res[0]), ["farm.n.oasis", "farm.n.avg"]);
  // Último atraco con bajas.
  assert.equal(res[1].verdict, "check");
  assert.equal(keys(res[1])[0], "farm.n.lossesRaid");
  // Oasis de otro jugador, con botín bajo (9 de 100).
  assert.equal(res[2].verdict, "check");
  assert.deepEqual(keys(res[2]), ["farm.n.oasisTaken", "farm.n.low"]);
  // Aldea inactiva que vuelve llena (75/75): mantener.
  assert.equal(res[3].m.how, "coord");
  assert.equal(res[3].verdict, "keep");
  assert.ok(keys(res[3]).includes("farm.n.full"));
  // Último atraco perdido: quitar, aunque el dueño esté inactivo.
  assert.equal(res[4].verdict, "risk");
  assert.equal(keys(res[4])[0], "farm.n.lostRaid");
  assert.ok(keys(res[5]).includes("farm.n.disabled"));
  // Coste del viaje con las tropas exactas: 5 milicias egipcias (1 de cereal/h, 7 casillas/h), 8.25 casillas ida y vuelta.
  const p = A.farmProfit(d.entries[3], 8.25, 6, 3);
  assert.equal(p.exact, true);
  assert.equal(p.cost, Math.round(5 * 1 * (2 * 8.25 / 7)));
  assert.equal(p.net, 75 - p.cost);
});
