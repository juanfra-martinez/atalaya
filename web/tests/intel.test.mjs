// Pruebas de web/src/intel.js con datos reales de Asia 9 (ts9.x1.asia.travian.com, 1 nov 2026).
// Ejecutar: node --test web/tests/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

globalThis.window = globalThis;
for (const f of ["core.js", "intel.js", "farmbuild.js"]) vm.runInThisContext(readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8"), { filename: f });
const A = globalThis.A;

/* Texto tal cual lo devuelve el juego al copiar la lista de vacas "Inactivos 01" (recortado),
   con sus marcas de dirección U+202D/U+202C alrededor de los números. */
const FARM = [
  "Inactivos 01", "‭‭9‬/‭24‬‬ en atraco", "Comienzo (24)", "\t\t", "\t", "Último atraco", "\t", "",
  "\t\tthorkel`s village\t12\t3.2\t", "2", "\t", "19:36:17", "‭70‬", "‭420‬", "\t", "",
  "\t\tpsdfghjklzxc542`s village\t8\t8.2\t", "2", "\t", "20:19:52", "‭4‬", "‭291‬", "\t", "",
  "\t\tPOSEIDON\t103\t12.6\t", "5", "\t", "17:54:48", "‭225‬", "‭1.148‬", "\t", "",
  "\t\tNaselje - Barbarius\t166\t22\t", "5", "\t", "14:30:42", "‭140‬", "‭210‬", "\t", "",
  "\t\tقرية aseellazeez\t110\t26.9\t", "5", "\t", "15:12:50", "‭35‬", "‭35‬", "\t", "",
  "\t\tPaladinner faluja\t177\t26.9\t", "2", "\t\t", "",
  "\t\t1\t177\t34.1\t", "2", "\t\t", "",
  "\t\tVillage renamed since map.sql\t120\t15.7\t", "5", "\t\t", "",
  "\t\tSomething that no longer exists\t50\t40\t", "2", "\t\t", "",
  "Añadir objetivo ‭‭24‬/‭100‬‬", "Sin objetivo", "Listas de vacas: ‭‭3‬/‭100‬‬",
].join("\n");

const HOME = { x: -65, y: -23, tid: 3 };
const P = (uid, name, status, extra = {}) => ({ uid, name, tid: 1, aid: 0, pop: 100, villages: 1, popHist: [100, 100], status, streak: status === "inactive" ? 5 : 0, bounded: false, confidence: status === "inactive" ? 80 : 0, flags: [], growth: 0, firstSeen: "2026-10-21", ...extra });
const V = (vid, x, y, uid, name, pop) => ({ vid, x, y, uid, name, pop, capital: 1, d1: 0, d3: 0, tid: 1 });
function world() {
  const players = [P(2047, "thorkel", "inactive"), P(2052, "psdf", "inactive"), P(1223, "posei", "active", { popHist: [80, 103] }), P(1124, "barb", "inactive", { aid: 7 }),
    P(707, "aseel", "inactive"), P(547, "pala", "unknown"), P(402, "one-a", "inactive"), P(40, "one-b", "active"), P(1576, "ivk", "inactive"), P(2051, "b4ll4", "active")];
  const villages = [V(1, -64, -26, 2047, "thorkel`s village", 12), V(2, -67, -15, 2052, "psdfghjklzxc542`s village", 8), V(3, -53, -19, 1223, "POSEIDON", 103),
    V(4, -54, -4, 1124, "Naselje - Barbarius", 166), V(5, -46, -4, 707, "قرية aseellazeez", 110), V(6, -39, -16, 547, "Paladinner faluja", 170),
    V(7, -31, -25, 402, "1", 177), V(8, -32, -15, 40, "1", 336), V(9, -51, -16, 1576, "IvKJkB`s village", 120), V(10, -65, -23, 2051, "01", 232)];
  const S = { players: Object.keys(players[0]), alliances: ["aid", "tag", "pop", "members", "villages", "popHist", "firstSeen"], villages: Object.keys(villages[0]) };
  return A.hydrate({ server: { radius: 200, speed: 1 }, days: ["2026-10-31", "2026-11-01"], schema: S,
    players: players.map((p) => S.players.map((k) => p[k])), alliances: [[7, "BAR", 166, 1, 1, [166, 166], "2026-10-21"]], villages: villages.map((v) => S.villages.map((k) => v[k])) });
}

test("parsea la lista de vacas copiada del juego", () => {
  const e = A.parseFarmList(FARM);
  assert.equal(e.length, 9);
  assert.deepEqual(e[0], { name: "thorkel`s village", pop: 12, dist: 3.2, units: 2, time: "19:36:17", loot: 70, total: 420 });
  assert.equal(e[2].total, 1148, "los miles llevan punto en español");
  assert.equal(e[3].dist, 22, "distancia entera");
  assert.equal(e[4].name, "قرية aseellazeez");
  assert.deepEqual([e[5].units, e[5].time, e[5].loot], [2, null, null], "objetivo aún sin atracar");
  assert.equal(e[6].name, "1");
});

test("acepta una lista de coordenadas, incluidas las exportaciones de Atalaya", () => {
  const e = A.parseFarmList("(‭−‭64‬‬|‭−‭26‬‬)\n12|-3\n[x|y]-31|-25[/x|y] 177 — one-a\n");
  assert.deepEqual(e.map((x) => [x.x, x.y]), [[-64, -26], [12, -3], [-31, -25]]);
});

test("localiza cada objetivo por nombre y distancia, y detecta los renombrados", () => {
  const w = world();
  const m = A.matchFarm(A.parseFarmList(FARM), w, HOME);
  const at = (i) => (m[i].v ? [m[i].v.x, m[i].v.y, m[i].how] : null);
  assert.deepEqual(at(0), [-64, -26, "name"]);
  assert.deepEqual(at(6), [-31, -25, "name"], "hay varias aldeas llamadas «1»: gana la que está a 34,1");
  assert.deepEqual(at(7), [-51, -16, "guess"], "mismo sitio y población: renombrada");
  assert.equal(at(8), null);
});

test("veredictos: mantener, revisar, quitar y crecimiento en vivo", () => {
  const w = world();
  const m = A.matchFarm(A.parseFarmList(FARM), w, HOME);
  const v = m.map((x) => A.farmVerdict(x, w, 3));
  assert.equal(v[0].verdict, "keep");
  assert.ok(v[0].notes.some(([k]) => k === "farm.n.full"), "2 falanges × 35 = 70: volvieron llenas");
  assert.equal(v[1].verdict, "check", "4 de 70: casi vacía");
  assert.equal(v[2].verdict, "risk", "el dueño crece");
  assert.ok(v[3].notes.some(([k, x]) => k === "farm.n.ally" && x.tag === "BAR"));
  assert.equal(v[4].verdict, "check", "35 de 5 tropas: botín bajo");
  assert.equal(v[5].verdict, "risk", "177 en el juego frente a 170 en el map.sql: está construyendo");
  assert.equal(v[8].verdict, "gone");
});

test("estado del botín según la carga real de las tropas galas", () => {
  const s = (units, loot) => A.lootState({ units, loot }, 3);
  assert.equal(s(2, 70), "full");
  assert.equal(s(5, 225), "full");
  assert.equal(s(9, 675), "full");
  assert.equal(s(2, 4), "low");
  assert.equal(s(5, 140), "partial");
  assert.equal(s(2, null), null);
});

test("rentabilidad del atraco: botín menos cereal de ida y vuelta", () => {
  const e = { units: 5, loot: 35 };
  let r = A.farmProfit(e, 26.9, 3, 0); // 5 falanges a 26,9 casillas y velocidad 7
  assert.equal(r.cost, Math.round(5 * 1 * (2 * 26.9 / 7)));
  assert.equal(r.cost, 38);
  assert.equal(r.net, -3);
  assert.equal(A.farmProfit(e, 26.9, 3, 3).cost, Math.round(5 * 2 * (2 * 26.9 / 19)), "Rayo: más rápido, pero come el doble");
  assert.ok(A.farmProfit(e, 40, 3, 0, 10).cost < A.farmProfit(e, 40, 3, 0).cost, "la plaza de torneos acorta el viaje largo");
  assert.equal(A.farmProfit({ units: 5, loot: null }, 10, 3, 0), null, "sin atraco previo");
  assert.equal(A.farmProfit({ units: null, loot: 70 }, 10, 3, 0), null, "lista de coordenadas");
  assert.equal(A.farmProfit(e, null, 3, 0), null, "sin distancia");
  assert.notEqual(A.farmProfit({ units: 2, loot: 100 }, 10, 8, 0), null, "espartanos: carga desconocida, pero consumo conocido");
  assert.equal(A.farmProfit(e, 10, 1, 4).cost, Math.round(5 * 3 * (2 * 10 / 14)), "Equites Imperatoris sin abrevadero");
});

test("un atraco que no compensa pasa a revisar", () => {
  const w = world();
  const m = A.matchFarm(A.parseFarmList(FARM), w, HOME);
  const profit = A.farmProfit(m[0].e, m[0].e.dist, 3, 0);
  assert.equal(A.farmVerdict(m[0], w, 3, profit).verdict, "keep", "70 de botín frente a 1 de cereal");
  const v = A.farmVerdict(m[0], w, 3, { net: -5, cost: 75 });
  assert.equal(v.verdict, "check");
  assert.ok(v.notes.some(([k, x]) => k === "farm.n.loss" && x.c === 75));
  assert.equal(A.farmVerdict(m[2], w, 3, { net: -5, cost: 75 }).verdict, "risk", "no rebaja un objetivo ya peligroso");
});

test("todas las tribus jugables tienen consumo para sus seis primeras unidades", () => {
  for (const tid of A.PLAYABLE) {
    assert.equal(A.CROP[tid].length, 6);
    assert.ok(A.CROP[tid].every((c) => Number.isInteger(c) && c > 0));
  }
  assert.equal(A.UNITS[7][0][2], 6, "mercenario huno: velocidad 6 según la tabla oficial");
});

/* Informes reales copiados del juego, con la página entera y las marcas de dirección alrededor de los números. */
const B = (s) => `‭${s}‬`;
const CHROME = ["Privacy settings", "1", B("658"), B("3.280"), B("7.800"), B("459"), "Cambiar al avatar del representado", "Héroe", "Hora del servidor: 21:07:19 (UTC)", "Avengers", " ", "Lista de enlaces", "FarmList", "Informes", "Todos", "Alrededores"];
const FOOT = ["", "b4ll4", "01", `Habitantes:: ${B("338")}`, `Lealtad: ${B(B("100") + "%")}`, "", `Aldeas ${B(B("2") + "/" + B("2"))}`, " ", "Grupos de aldeas", `(${B(B("1") + "/" + B("20"))})`, "", "01", B(`(${B("−" + B("65"))}|${B("−" + B("23"))})`), "02", "Misiones", "© 2004-2026 Travian Games GmbH"];
const GAUL = "Falange\tEspadachín\tBatidor\tRayo de Teutates\tJinete Druida\tJinete Eduo\tAriete de madera\tCatapulta de guerra\tCacique\tColono\t Héroe";
const ROMAN = "Legionario\tPretoriano\tImperano\tEquites Legati\tEquites Imperatoris\tEquites Caesaris\tAriete\tCatapulta de fuego\tSenador\tColono\t Héroe";
const TEUTON = "Luchador de porra\tLancero\tLuchador de Hacha\tEmisario\tPaladín\tJinete Teutón\tAriete de madera\tCatapulta\tCabecilla\tColono\t Héroe";
const NATURE = "Rata\tAraña\tSerpiente\tMurciélago\tJabalí\tLobo\tOso\tCocodrilo\tTigre\tElefante";
const ZERO = Array(11).fill(0).join("\t");
const stats = (...v) => ["Estadísticas", "Agresor\tDefensor", "Fuerza de combate\t", B(v[0]), B(v[1]), "Consumo antes\t", B(v[2]), B(v[3]), "Consumo perdido\t", B(v[4]), B(v[5]), "Materias perdidas\t", B(v[6]), B(v[7])];
const loot = (r, a, b) => ["Botín\t", ...r.map(String), B(B(a) + "/" + B(b))];
const REPORT = {
  wiped: [...CHROME, "Torex atraca 01", "31.10.26, 12:52:56", "", "", "Agresor", "[WoW] torro desde Torex", TEUTON, "2\t0\t0\t0\t0\t0\t0\t0\t0\t0\t0", "2\t0\t0\t0\t0\t0\t0\t0\t0\t0\t0",
    "Info\t", "No ha vuelto ninguna de las tropas del atacante.", ...loot([0, 0, 0, 0], 0, 0), "Defensor", "[-A-] b4ll4 desde 01", GAUL, ZERO, ZERO, "Defensor", "Refuerzos", NATURE, "5\t1\t4\t1\t0\t2\t0\t4\t3\t0", "0\t0\t0\t0\t0\t0\t0\t0\t0\t0",
    ...stats(82, "2.990", 2, 0, 2, 0, 500, 0), ...FOOT].join("\n"),
  clean: [...CHROME, "02 atraca Zicova`s village", "06.11.26, 22:02:48", "", "", "Agresor", "[-A-] b4ll4 desde 02", "", GAUL, "0\t0\t0\t1\t0\t0\t0\t0\t0\t0\t0", ZERO,
    ...loot([22, 21, 20, 12], 75, 75), "Defensor", "[ ] Zicova desde Zicova`s village", ROMAN, ZERO, ZERO, ...stats(100, 23, 2, 0, 0, 0, 0, 0), ...FOOT].join("\n"),
  losses: [...CHROME, "01 atraca greennords`s village", "06.11.26, 05:29:10", "", "", "Agresor", "[-A-] b4ll4 desde 01", "", GAUL, "0\t2\t0\t0\t0\t0\t0\t0\t0\t0\t0", "0\t1\t0\t0\t0\t0\t0\t0\t0\t0\t0",
    ...loot([13, 12, 12, 8], 45, 45), "Defensor", "[ ] greennords desde greennords`s village", ROMAN, ZERO, ZERO, ...stats(130, 63, 2, 0, 1, 0, 535, 0), ...FOOT].join("\n"),
};

test("lee informes reales: dueños, tropas, botín y estadísticas", () => {
  let r = A.parseReport(REPORT.wiped);
  assert.equal(r.title, "Torex atraca 01");
  assert.equal(r.date, "31.10.26, 12:52:56");
  assert.equal(r.blocks.length, 3, "agresor, defensor y refuerzos de la naturaleza");
  assert.deepEqual(r.blocks[0].who, { raw: "[WoW] torro desde Torex", tag: "WoW", name: "torro", village: "Torex" });
  assert.equal(r.blocks[0].units[10], "Héroe");
  assert.deepEqual(r.blocks[0].rows[1].slice(0, 2), [2, 0]);
  assert.equal(r.blocks[2].who.name, "Refuerzos");
  assert.equal(r.blocks[2].units.length, 10, "los animales no tienen héroe");
  assert.equal(r.blocks[2].rows[0][8], 3);
  assert.deepEqual(r.loot, { res: [0, 0, 0, 0], carried: 0, capacity: 0 });
  assert.equal(r.info, "No ha vuelto ninguna de las tropas del atacante.");
  assert.deepEqual(r.stats.map((s) => [s.label, s.a, s.d]), [["Fuerza de combate", 82, 2990], ["Consumo antes", 2, 0], ["Consumo perdido", 2, 0], ["Materias perdidas", 500, 0]]);

  r = A.parseReport(REPORT.clean);
  assert.deepEqual(r.blocks[1].who, { raw: "[ ] Zicova desde Zicova`s village", tag: null, name: "Zicova", village: "Zicova`s village" }, "sin alianza");
  assert.equal(r.blocks[1].units[0], "Legionario", "la línea en blanco tras el agresor no rompe nada");
  assert.deepEqual(r.loot, { res: [22, 21, 20, 12], carried: 75, capacity: 75 });
  assert.equal(r.info, null);
});

test("resumen de informes: pérdidas, neto y consejos", () => {
  const sum = (k) => A.reportSummary(A.parseReport(REPORT[k]));
  let s = sum("wiped");
  assert.equal(s.outcome, "wiped");
  assert.deepEqual([s.atk.sent, s.atk.lost, s.atk.pct], [2, 2, 100]);
  assert.deepEqual([s.def.sent, s.def.lost, s.def.pct], [20, 0, 0], "los animales cuentan como defensa");
  assert.equal(s.net, -500);
  assert.equal(s.fill, null, "sin supervivientes no hay capacidad");
  assert.deepEqual(s.notes, ["rp.n.wiped"]);

  s = sum("clean");
  assert.equal(s.outcome, "clean");
  assert.deepEqual([s.lootTotal, s.fill, s.net], [75, 100, 75]);
  assert.equal(s.def.pct, null, "aldea sin tropas: no hay porcentaje");
  assert.deepEqual(s.notes, ["rp.n.full"]);

  s = sum("losses");
  assert.equal(s.outcome, "losses");
  assert.deepEqual([s.atk.lost, s.atk.pct, s.net], [1, 50, -490]);
  assert.deepEqual(s.notes, ["rp.n.negative"], "llenas, pero la baja cuesta más que el botín");
});

test("informes: casos límite", () => {
  assert.equal(A.parseReport("hola\n1\n2"), null, "sin tabla de tropas");
  assert.equal(A.parseReport(FARM), null, "una lista de vacas no es un informe");
  assert.equal(A.parseReport(REPORT.clean + "\n" + REPORT.losses).title, "02 atraca Zicova`s village", "dos pegados: solo el primero");
  assert.equal(A.parseReport(REPORT.clean + "\n" + REPORT.losses).blocks.length, 2);
  const noStats = A.parseReport([GAUL, "1\t0\t0\t0\t0\t0\t0\t0\t0\t0\t0", ZERO].join("\n"));
  assert.deepEqual([noStats.title, noStats.loot, noStats.stats.length], [null, null, 0]);
  assert.deepEqual(A.reportSummary(noStats).net, null, "sin estadísticas no se inventa el neto");
});

test("los informes reales confirman consumo y carga de las tablas", () => {
  assert.equal(A.CROP[3][3], 2, "Rayo de Teutates: consumo antes 2");
  assert.equal(A.CROP[3][1] * 2, 2, "2 espadachines: consumo antes 2");
  assert.equal(A.UNITS[3][3][3], 75, "1 Rayo: capacidad 75");
  assert.equal(A.UNITS[3][1][3], 45, "1 espadachín superviviente: capacidad 45");
  assert.equal(A.CROP[2][0] * 2, 2, "2 luchadores de porra: consumo antes 2");
});

test("estadísticas por tribu: solo jugadores y con reparto correcto", () => {
  const w = {
    players: [
      { tid: 1, pop: 300, villages: 3, status: "active", d7: 20 }, { tid: 1, pop: 100, villages: 1, status: "inactive", d7: null },
      { tid: 3, pop: 200, villages: 2, status: "active", d7: null }, { tid: 5, pop: 9000, villages: 50, status: "natar", d7: 0 },
    ],
  };
  const r = A.tribeStats(w);
  assert.deepEqual(r.map((x) => x.tid), [1, 3], "ni natares ni tribus sin jugadores");
  assert.deepEqual([r[0].players, r[0].villages, r[0].pop, r[0].avgPop, r[0].avgVillages, r[0].d7], [2, 4, 400, 200, 2, 20]);
  assert.equal(r[1].d7, null, "sin historial no se inventa un crecimiento de 0");
  assert.equal(Math.round(r[0].share * 100) / 100, 66.67);
  assert.ok(Math.abs(r.reduce((s, x) => s + x.share, 0) - 100) < 1e-9, "los porcentajes suman 100");
  assert.deepEqual(A.tribeStats({ players: [] }), []);
});

test("puntos de cultura: días y fecha de la siguiente aldea", () => {
  const now = Date.parse("2026-11-01T12:00:00Z");
  let r = A.cultureEta({ have: 1200, need: 2000, perDay: 200, now });
  assert.equal(r.missing, 800);
  assert.equal(r.days, 4);
  assert.equal(r.at.toISOString(), "2026-11-05T12:00:00.000Z");
  r = A.cultureEta({ have: 2500, need: 2000, perDay: 200, now });
  assert.deepEqual([r.missing, r.days], [0, 0], "ya alcanzado");
  r = A.cultureEta({ have: 100, need: 2000, perDay: 0, now });
  assert.deepEqual([r.missing, r.days, r.at], [1900, Infinity, null], "sin producción no hay fecha");
  assert.equal(A.cultureEta({ have: NaN, need: 2000, perDay: 10, now }), null, "falta lo que tienes");
  assert.equal(A.cultureEta({ have: 0, need: NaN, perDay: 10, now }), null, "falta lo que necesitas");
  assert.ok(A.cultureEta({ have: 0, need: 100, perDay: 10, now }), "cero puntos es un dato válido");
});

test("ataque entrante: identifica la unidad más lenta posible", () => {
  const arrival = Date.parse("2026-11-01T20:00:00Z");
  const base = { dist: 10, tid: 3, arrival };
  const tt = A.travel(10, 19) * 1000, ram = A.travel(10, 4) * 1000, chief = A.travel(10, 5) * 1000;
  let r = A.inferIncoming({ ...base, seen: arrival - tt });
  assert.equal(r.kind, "fast");
  assert.deepEqual(r.best.map((u) => u.i), [3]);
  assert.ok(r.units.every((u) => u.possible), "visto al salir: cualquier unidad igual o más lenta es posible");
  r = A.inferIncoming({ ...base, seen: arrival - ram + 5000 });
  assert.equal(r.kind, "siege");
  assert.ok(!r.units[3].possible, "un Rayo no tarda tanto");
  r = A.inferIncoming({ ...base, seen: arrival - chief + 1000 });
  assert.equal(r.kind, "chief", "el cacique (5) es la única unidad que encaja; los colonos no atacan");
  r = A.inferIncoming({ ...base, seen: arrival - A.travel(10, 3) * 1000 - 60000 });
  assert.equal(r.best.length, 0, "más lento que una catapulta: ninguna unidad encaja");
});

test("indicios de fake: origen, tren, varias aldeas, reparto y cacique", () => {
  const players = [P(1, "atacante", "active", { villages: 3 }), P(2, "pequeno", "active")];
  const villages = [V(1, 0, 0, 1, "grande", 900), V(2, 5, 0, 1, "mediana", 500), V(3, 9, 0, 1, "nueva", 40), V(4, 20, 0, 2, "unica", 40)];
  const S = { players: Object.keys(players[0]), alliances: ["aid", "tag", "pop", "members", "villages", "popHist", "firstSeen"], villages: Object.keys(villages[0]) };
  const w = A.hydrate({ server: { radius: 200, speed: 1 }, days: ["2026-10-31", "2026-11-01"], schema: S, players: players.map((p) => S.players.map((k) => p[k])), alliances: [], villages: villages.map((v) => S.villages.map((k) => v[k])) });
  const T = Date.parse("2026-11-01T20:00:00Z");
  const atk = (fx, tx, sec = 0, kind = "fast") => ({ from: { x: fx, y: 0 }, to: { x: tx, y: 50 }, arrival: T + sec * 1000, kind });
  const one = (...list) => A.assessAttacks(list, w);
  const ks = (r) => r.signals.map((s) => s.k);

  let r = one(atk(9, 100))[0];
  assert.deepEqual(r.signals, [{ k: "smallOrigin", pop: 40, max: 900 }]);
  assert.equal(r.level, "fake");
  r = one(atk(20, 100))[0];
  assert.equal(r.level, "unclear", "una sola aldea: no hay con qué comparar");
  assert.equal(ks(r).length, 0);
  r = one(atk(77, 100))[0];
  assert.equal(r.level, "unclear", "coordenadas sin aldea en el map.sql");

  r = one(atk(0, 100), atk(0, 100, 3));
  assert.deepEqual(ks(r[0]), ["train"]);
  assert.equal(r[0].level, "real");
  r = one(atk(0, 100), atk(0, 100, 11));
  assert.equal(r[0].level, "unclear", "más de 10 s: no es un tren");

  r = one(atk(0, 100), atk(5, 100, 40));
  assert.deepEqual(ks(r[0]), ["multiOrigin"]);
  assert.equal(r[0].level, "real");

  r = one(atk(0, 100), atk(0, 101, 100), atk(0, 102, 200));
  assert.deepEqual(ks(r[0]), ["spread"]);
  assert.equal(r[0].level, "unclear", "repartirse solo no basta");
  r = one(atk(9, 100), atk(0, 101, 100), atk(0, 102, 200))[0];
  assert.equal(r.level, "fake", "reparto y aldea pequeña");
  r = one(atk(0, 100), atk(0, 101, 100), atk(0, 102, 400))[0];
  assert.deepEqual(ks(r), [], "el tercer objetivo llega más de 5 minutos después");

  r = one(atk(9, 100, 0, "chief"), atk(0, 101, 100), atk(0, 102, 200))[0];
  assert.deepEqual(ks(r), ["smallOrigin", "spread", "chief"]);
  assert.equal(r.level, "unclear", "un cacique nunca se marca como fake");
  assert.equal(one(atk(0, 100, 0, "chief"))[0].level, "real");
});

test("unidad de atraco más rápida y vecindario", () => {
  assert.equal(A.fastestRaider(3), 3);
  assert.equal(A.fastestRaider(1), 4);
  assert.equal(A.fastestRaider(2), 4);
  assert.equal(A.fastestRaider(8), 4, "espartanos: carga desconocida, pero no es explorador");
  const w = world();
  const n = A.neighbourhood(w, HOME, 10);
  assert.deepEqual(n.players.map((e) => e.p.name).sort(), ["b4ll4", "psdf", "thorkel"]);
  assert.equal(n.alliances[0].aid, 0);
  assert.ok(A.threat(n.players.find((e) => e.p.name === "b4ll4")) > A.threat(n.players.find((e) => e.p.name === "thorkel")));
});

/* ---------- asistente de listas de vacas (farmbuild.js) ---------- */
const ROWS = [[1, -64, -26], [2, -67, -15], [9, -51, -16]].map(([vid, x, y]) => ({ v: { vid, x, y, name: "v" + vid, pop: 100 + vid }, p: { uid: vid, name: "p" + vid, tag: "", confidence: 80, status: "inactive" }, dist: 3.16, time: 1234.4 }));

test("cola del asistente: añadir, saltar, descartar, volver y saltar a uno", () => {
  const q = A.fbQueueNew(ROWS);
  assert.equal(q.items.length, 3);
  assert.deepEqual([q.items[0].x, q.items[0].y, q.items[0].dist, q.items[0].time], [-64, -26, 3.2, 1234]);
  A.fbStep(q, "a");
  assert.equal(q.i, 1);
  A.fbStep(q, "jump", 2); A.fbStep(q, "x");
  assert.equal(q.i, 1, "vuelve al único pendiente, que se había saltado al saltar a otro");
  assert.deepEqual(A.fbStats(q), { a: 1, s: 0, x: 1, pending: 1, n: 3, done: false });
  A.fbStep(q, "s");
  assert.equal(q.i, 3);
  assert.equal(A.fbStats(q).done, true);
  A.fbStep(q, "back");
  assert.equal(q.i, 2, "desde el final, atrás vuelve al último");
  A.fbStep(q, "a");
  assert.deepEqual(A.fbStats(q), { a: 2, s: 1, x: 0, pending: 0, n: 3, done: true }, "rehacer cambia el estado");
});

test("ya en tus listas: datos del juego por coordenadas, texto por nombre y distancia, y marcas", () => {
  const game = JSON.stringify({ atalayaFarm: 1, lists: [{ id: 5, name: "Inactivos 01", slots: [{ target: { x: -64, y: -26, name: "a", population: 12, type: 0 } }, { target: { x: 10, y: 10, name: "oasis", population: 0, type: 3 } }] }] });
  const marks = { "-51|-16": ["a", 1], "-67|-15": ["x", 2], "-64|-26": ["a", 3] };
  let m = A.fbListedFrom(game, marks, null, null);
  assert.deepEqual(m.get("-64|-26"), { src: "game", list: "Inactivos 01" }, "los datos del juego mandan sobre la marca");
  assert.equal(m.get("10|10").src, "game");
  assert.equal(m.get("-51|-16").src, "mark");
  assert.equal(m.get("-67|-15").src, "drop");
  m = A.fbListedFrom(FARM, {}, world(), HOME);
  assert.ok(m.has("-64|-26") && m.has("-53|-19"), "el texto copiado se localiza en map.sql");
  assert.ok(!m.has("-65|-23"), "la aldea propia no aparece");
  assert.equal(A.fbListedFrom("", null, null, null).size, 0);
});
