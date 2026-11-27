// Pruebas de web/src/worlds.js: estadísticas y ordenación de la vista de mundos.
// Ejecutar: node --test web/tests/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

globalThis.window = globalThis;
for (const f of ["core.js", "worlds.js"]) vm.runInThisContext(readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8"), { filename: f });
const A = globalThis.A;

const days = (n, last = "2026-11-06") => Array.from({ length: n }, (_, i) => new Date(Date.parse(last + "T00:00:00Z") - (n - 1 - i) * 864e5).toISOString().slice(0, 10));
const trend = (d, players, extra = {}) => ({
  days: d, players, villages: players.map((p) => p * 2), alliances: players.map(() => 5), population: players.map((p) => p * 100),
  conquered: d.map(() => 1), destroyed: d.map(() => 0), founded: d.map(() => 2), ...extra,
});
const world = (id, players, extra = {}) => ({
  id, name: id, region: "europe", speed: 1, status: "active", start: "2026-10-01", end: null, age: 37, day: "2026-11-06",
  players, villages: players * 2, alliances: 5, population: players * 100, ...extra,
});

test("el crecimiento compara con la instantánea de hace 7 días, no con la de hace 7 posiciones", () => {
  // Falta el 5 de noviembre: hay 8 instantáneas, pero la de hace 7 días es la del 30 de octubre.
  const d = days(9).filter((x) => x !== "2026-11-05");
  const s = world("a", 180, { trend: trend(d, [100, 110, 120, 130, 140, 150, 160, 180]) });
  const m = A.worldStats(s);
  assert.equal(d[1], "2026-10-30");
  assert.equal(m.d7.players, 70);
  assert.ok(Math.abs(m.d7Pct - 63.636) < 0.01);
  assert.equal(m.conquered7, 6); // 31 oct–6 nov menos el día que falta
  assert.equal(m.conqueredPrev7, null); // no hay dos semanas de historial
});

test("la semana anterior solo cuenta si está completa", () => {
  const short = world("p", 100, { trend: trend(days(13), Array(13).fill(100)) });
  const full = world("q", 100, { trend: trend(days(14), Array(14).fill(100)) });
  assert.equal(A.worldStats(short).conqueredPrev7, null);
  assert.equal(A.worldStats(full).conqueredPrev7, 7);
});

test("con menos de una semana de historial compara con la primera instantánea", () => {
  const m = A.worldStats(world("b", 150, { trend: trend(days(3), [100, 120, 150]) }));
  assert.equal(m.d7.players, 50);
});

test("con una sola instantánea o sin evolución no inventa crecimiento", () => {
  assert.equal(A.worldStats(world("c", 100, { trend: trend(days(1), [100]) })).d7.players, null);
  assert.equal(A.worldStats(world("d", 100)).d7.players, null);
});

test("los mundos sin dato van al final en ambos sentidos", () => {
  const list = [world("low", 10), world("none", 0, { day: null }), world("high", 90)];
  assert.deepEqual(A.sortWorlds(list, "players", -1).map((s) => s.id), ["high", "low", "none"]);
  assert.deepEqual(A.sortWorlds(list, "players", 1).map((s) => s.id), ["low", "high", "none"]);
});

test("ordena los nombres con números de forma natural", () => {
  const list = [world("Europe 10"), world("Europe 2"), world("Europe 1")];
  assert.deepEqual(A.sortWorlds(list, "name", 1).map((s) => s.id), ["Europe 1", "Europe 2", "Europe 10"]);
});

test("un fallo de descarga de un día no hunde el total de jugadores", () => {
  const d = days(3);
  const ok = world("ok", 120, { trend: trend(d, [100, 110, 120]) });
  const gap = world("gap", 220, { trend: trend([d[0], d[2]], [200, 220]) });
  const tot = A.worldTotals([ok, gap]);
  assert.deepEqual(tot.series.players, [300, 310, 340]);
  assert.equal(tot.players, 340);
  assert.equal(tot.d7.players, 40);
  assert.deepEqual(tot.flows.conquered, [2, 1, 2]);
});

test("la variación total coincide con la línea aunque abra un mundo nuevo", () => {
  const d = days(3);
  const old = world("old", 80, { trend: trend(d, [100, 90, 80]) });
  const fresh = world("new", 50, { trend: trend([d[2]], [50]) });
  const tot = A.worldTotals([old, fresh]);
  assert.deepEqual(tot.series.players, [100, 90, 130]);
  assert.equal(tot.d7.players, 30);
});

test("un mundo que aún no tiene datos cuenta como mundo, pero no suma ni rompe las medias", () => {
  const tot = A.worldTotals([world("a", 100, { age: 10 }), world("b", 0, { day: null, age: null })]);
  assert.equal(tot.worlds, 2);
  assert.equal(tot.withData, 1);
  assert.equal(tot.avgAge, 10);
  assert.equal(tot.d7.players, null);
});

test("agrupa por dimensión de mayor a menor número de jugadores", () => {
  const groups = A.worldGroups([world("a", 10), world("b", 30, { region: "asia" }), world("c", 15)], (s) => s.region);
  assert.deepEqual(groups.map((g) => [g.key, g.worlds, g.players]), [["asia", 1, 30], ["europe", 2, 25]]);
});

test("reparte los mundos por tramos de edad sin perder ninguno", () => {
  const list = [1, 7, 8, 30, 31, 90, 91, 180, 181, 400].map((age, i) => world("w" + i, 10, { age }));
  assert.deepEqual(A.ageHistogram(list), [2, 2, 2, 2, 2]);
});

test("los destacados omiten las categorías sin valor positivo", () => {
  const list = [world("a", 100, { age: 30, trend: trend(days(2), [120, 100], { conquered: [0, 0] }) }), world("b", 50, { age: 5, trend: trend(days(2), [40, 50], { conquered: [0, 0] }) })];
  const by = Object.fromEntries(A.worldHighlights(list).map((h) => [h.key, h.world.id]));
  assert.deepEqual(by, { players: "a", population: "a", growth: "b", young: "b" });
});

test("la velocidad se agrupa en tres clases", () => {
  assert.deepEqual([1, 2, 3, 5, 10].map(A.speedClass), ["a", "b", "b", "c", "c"]);
});

test("el CSV entrecomilla textos y neutraliza fórmulas", () => {
  const csv = A.worldsCsv([world('=HYPERLINK("x")', 100)]).split("\r\n");
  assert.ok(csv[0].startsWith("id,name,region,speed"));
  assert.ok(csv[1].startsWith(`"'=HYPERLINK(""x"")"`));
});
