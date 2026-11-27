// Recorre todas las vistas de la demo, recoge errores de consola y hace capturas.
// Uso: node scripts/shots.js web/dist/demo.html out_dir [dark|light] [width]
const { chromium } = require("playwright");
const path = require("path");
(async () => {
  const [file, out = "/tmp/shots", theme = "dark", width = "1440"] = process.argv.slice(2);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: +width, height: 900 }, colorScheme: theme });
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => m.type() === "error" && !/fonts\.g|ERR_|net::/.test(m.text()) && errors.push("console: " + m.text()));
  const url = "file://" + path.resolve(file);
  await page.goto(url + "#dashboard");
  await page.waitForTimeout(600);
  // fijar aldea propia para que todo tenga contenido
  await page.evaluate(() => { const p = A.state.world.players.find((p) => p.status === "active" && p.pop > 400 && p.pop < 900) || A.state.world.players[50]; A.state.home = { x: p.cap.x, y: p.cap.y, tid: p.tid }; A.route(); });
  const views = ["dashboard", "inactives", "map", "events", "rankings", "tools", "watch", "servers"];
  for (const v of views) {
    await page.evaluate((v) => (location.hash = v), v);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${out}/${theme}-${width}-${v}.png`, fullPage: false });
  }
  await page.evaluate(() => (location.hash = "dashboard"));
  await page.waitForTimeout(300);
  await page.evaluate(() => A.openPlayer(A.state.world.players.find((p) => p.status === "inactive" && p.villages > 2).uid));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/${theme}-${width}-player.png` });
  await page.evaluate(() => A.openAlliance(A.state.world.alliances[0].aid));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/${theme}-${width}-alliance.png` });
  await page.evaluate(() => { A.closeOverlays(); A.palette(); });
  await page.keyboard.type("ka");
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${out}/${theme}-${width}-palette.png` });
  await page.keyboard.press("Escape");
  await page.evaluate(() => (location.hash = "inactives"));
  await page.waitForTimeout(300);
  await page.click("#in-export");
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${out}/${theme}-${width}-export.png` });
  console.log(errors.length ? errors.join("\n") : "SIN ERRORES");
  await browser.close();
})();
