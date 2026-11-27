const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on("pageerror", e => errs.push(e.message)); p.on("console", m => m.type()==="error" && !/fonts/.test(m.text()) && errs.push(m.text()));
  await p.goto("http://localhost:8078/#inactives"); await p.waitForTimeout(1500);
  const txt = await p.evaluate(() => [document.title, A.DEMO, A.state.world?.players.length, document.querySelector(".demo-ribbon") ? "ribbon" : "no-ribbon"]);
  console.log(txt, errs.length ? errs : "SIN ERRORES"); await b.close();
})();
