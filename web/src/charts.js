/* Gráficos SVG ligeros: sparkline, líneas con área, barras apiladas, columnas y burbujas. */
"use strict";
(() => {
  const A = window.A;
  const clean = (v) => v.map((x) => (x == null ? null : +x));

  A.spark = (values, { w = 96, h = 30, color = "var(--accent)", fill = true } = {}) => {
    const vals = clean(values);
    const pts = vals.map((v, i) => [i, v]).filter((p) => p[1] != null);
    if (pts.length < 2) return `<svg class="spark" width="${w}" height="${h}" aria-hidden="true"></svg>`;
    const min = Math.min(...pts.map((p) => p[1])), max = Math.max(...pts.map((p) => p[1]));
    const sx = (i) => (i / (vals.length - 1)) * (w - 4) + 2;
    const sy = (v) => h - 3 - (max === min ? 0.5 : (v - min) / (max - min)) * (h - 6);
    const d = pts.map((p, k) => `${k ? "L" : "M"}${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`).join("");
    const last = pts[pts.length - 1];
    const area = fill ? `<path d="${d}L${sx(last[0]).toFixed(1)},${h}L${sx(pts[0][0]).toFixed(1)},${h}Z" fill="${color}" opacity=".13"/>` : "";
    return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">${area}<path d="${d}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round"/><circle cx="${sx(last[0]).toFixed(1)}" cy="${sy(last[1]).toFixed(1)}" r="2.4" fill="${color}"/></svg>`;
  };

  const niceTicks = (min, max, n = 4) => {
    if (min === max) { max = min + 1; }
    const span = max - min, step0 = span / n, mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) || step0;
    const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
    const out = []; for (let v = lo; v <= hi + step / 2; v += step) out.push(+v.toFixed(6));
    return out;
  };

  /* Gráfico de líneas con área, rejilla, punto final destacado y tooltip. */
  A.lineChart = (el, { labels, series, height = 220, fmt = A.compact, zero = false }) => {
    const W = Math.max(320, el.clientWidth || 640), H = height, L = 46, R = 14, T = 12, B = 26;
    const all = series.flatMap((s) => clean(s.values).filter((v) => v != null));
    if (!all.length) { el.innerHTML = `<div class="empty">${A.t("common.noData")}</div>`; return; }
    let min = Math.min(...all), max = Math.max(...all);
    if (zero) min = Math.min(0, min);
    const ticks = niceTicks(min, max);
    min = ticks[0]; max = ticks[ticks.length - 1];
    const n = labels.length;
    const sx = (i) => L + (n === 1 ? 0.5 : i / (n - 1)) * (W - L - R);
    const sy = (v) => T + (1 - (v - min) / (max - min || 1)) * (H - T - B);
    let g = "";
    ticks.forEach((t) => { g += `<line class="gridl" x1="${L}" x2="${W - R}" y1="${sy(t)}" y2="${sy(t)}"/><text x="${L - 8}" y="${sy(t) + 4}" text-anchor="end">${A.esc(fmt(t))}</text>`; });
    const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor((W - L - R) / 58))));
    labels.forEach((lb, i) => { if (i % every === 0 || i === n - 1) g += `<text x="${sx(i)}" y="${H - 6}" text-anchor="middle">${A.esc(lb)}</text>`; });
    series.forEach((s) => {
      const pts = clean(s.values).map((v, i) => [i, v]).filter((p) => p[1] != null);
      if (!pts.length) return;
      const d = pts.map((p, k) => `${k ? "L" : "M"}${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`).join("");
      if (s.area !== false) g += `<path d="${d}L${sx(pts[pts.length - 1][0])},${sy(min)}L${sx(pts[0][0])},${sy(min)}Z" fill="${s.color}" opacity=".12"/>`;
      g += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>`;
      const lp = pts[pts.length - 1];
      g += `<circle cx="${sx(lp[0])}" cy="${sy(lp[1])}" r="4" fill="var(--surface)" stroke="${s.color}" stroke-width="2.2"/>`;
    });
    el.classList.add("chart", "rel");
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${A.esc(series.map((s) => s.name).join(", "))}">${g}<line class="hover-l" x1="0" x2="0" y1="${T}" y2="${H - B}" stroke="var(--muted)" stroke-width="1" opacity="0"/></svg><div class="chart-tip"></div>`;
    const svg = el.querySelector("svg"), tip = el.querySelector(".chart-tip"), hl = el.querySelector(".hover-l");
    svg.addEventListener("pointermove", (e) => {
      const r = svg.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * W;
      const i = Math.max(0, Math.min(n - 1, Math.round(((x - L) / (W - L - R)) * (n - 1))));
      hl.setAttribute("x1", sx(i)); hl.setAttribute("x2", sx(i)); hl.setAttribute("opacity", ".4");
      tip.innerHTML = `<b>${A.esc(labels[i])}</b> · ` + series.map((s) => `${A.esc(s.name)}: ${A.esc(A.fmt(s.values[i]))}`).join(" · ");
      tip.style.display = "block";
      tip.style.left = (sx(i) / W) * r.width + "px";
      tip.style.top = (sy(series[0].values[i] ?? min) / H) * r.height + "px";
    });
    svg.addEventListener("pointerleave", () => { tip.style.display = "none"; hl.setAttribute("opacity", "0"); });
  };

  /* Barras apiladas por día. */
  A.barChart = (el, { labels, stacks, height = 180 }) => {
    const W = Math.max(320, el.clientWidth || 640), H = height, L = 36, R = 8, T = 10, B = 24;
    const n = labels.length;
    const totals = labels.map((_, i) => stacks.reduce((s, st) => s + (st.values[i] || 0), 0));
    const ticks = niceTicks(0, Math.max(1, ...totals), 3);
    const max = ticks[ticks.length - 1];
    const bw = ((W - L - R) / n) * 0.62;
    const sx = (i) => L + ((i + 0.5) / n) * (W - L - R);
    const sy = (v) => T + (1 - v / max) * (H - T - B);
    let g = "";
    ticks.forEach((t) => { g += `<line class="gridl" x1="${L}" x2="${W - R}" y1="${sy(t)}" y2="${sy(t)}"/><text x="${L - 6}" y="${sy(t) + 4}" text-anchor="end">${t}</text>`; });
    labels.forEach((lb, i) => {
      let acc = 0;
      stacks.forEach((st) => {
        const v = st.values[i] || 0; if (!v) return;
        g += `<rect x="${sx(i) - bw / 2}" y="${sy(acc + v)}" width="${bw}" height="${Math.max(0, sy(acc) - sy(acc + v))}" fill="${st.color}" rx="2"><title>${A.esc(lb)} · ${A.esc(st.name)}: ${v}</title></rect>`;
        acc += v;
      });
      const every = Math.max(1, Math.ceil(n / 8));
      if (i % every === 0 || i === n - 1) g += `<text x="${sx(i)}" y="${H - 6}" text-anchor="middle">${A.esc(lb)}</text>`;
    });
    el.classList.add("chart");
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img">${g}</svg>`;
  };

  /* Tooltip común de columnas y burbujas: se mantiene dentro del gráfico y escribe los datos como texto. */
  const tooltip = (el) => {
    const tip = document.createElement("div"); tip.className = "viz-tip"; tip.hidden = true; el.appendChild(tip);
    return {
      show(title, rows, x, y) {
        tip.textContent = "";
        const h = document.createElement("div"); h.className = "viz-tip-h"; h.textContent = title; tip.appendChild(h);
        rows.forEach(([value, label]) => {
          const row = document.createElement("div");
          const b = document.createElement("b"); b.textContent = value;
          const span = document.createElement("span"); span.textContent = label;
          row.append(b, span); tip.appendChild(row);
        });
        tip.hidden = false;
        const w = tip.offsetWidth, tipH = tip.offsetHeight;
        tip.style.left = Math.max(0, Math.min(el.clientWidth - w, x - w / 2)) + "px";
        tip.style.top = (y - tipH - 12 < 0 ? y + 16 : y - tipH - 12) + "px";
      },
      hide() { tip.hidden = true; },
    };
  };

  /* Una serie en columnas: una por día o por tramo. El rectángulo de cada banda es la zona activa, no la columna. */
  A.columns = (el, { labels, values, name, color = "var(--accent)", height = 112, showValues = false, showAllLabels = false, tick = A.fmt }) => {
    const W = Math.max(160, el.clientWidth || 320), H = height, T = showValues ? 18 : 8, B = 20;
    const n = labels.length, max = Math.max(1, ...values);
    if (!n) { el.innerHTML = `<div class="empty">${A.t("common.noData")}</div>`; return; }
    const band = W / n, bw = Math.max(2, Math.min(24, band - 2));
    const sy = (v) => T + (1 - v / max) * (H - T - B), base = H - B;
    let g = `<line class="axisl" x1="0" x2="${W}" y1="${base}" y2="${base}"/>`;
    const every = showAllLabels ? 1 : Math.max(1, Math.ceil(n / Math.max(2, Math.floor(W / 64))));
    labels.forEach((lb, i) => {
      const x = (i + 0.5) * band, v = values[i] || 0, top = sy(v), r = Math.min(4, bw / 2, base - top);
      if (v) g += `<path class="col" fill="${color}" d="M${(x - bw / 2).toFixed(1)},${base}V${(top + r).toFixed(1)}q0,${-r} ${r},${-r}h${(bw - 2 * r).toFixed(1)}q${r},0 ${r},${r}V${base}Z"/>`;
      if (showValues) g += `<text x="${x.toFixed(1)}" y="${(top - 5).toFixed(1)}" text-anchor="middle" class="val">${A.esc(tick(v))}</text>`;
      if (showAllLabels || i === n - 1 || (i % every === 0 && n - 1 - i >= every)) {
        const anchor = showAllLabels ? "middle" : i === 0 ? "start" : i === n - 1 ? "end" : "middle";
        g += `<text x="${anchor === "start" ? 0 : anchor === "end" ? W : x.toFixed(1)}" y="${H - 5}" text-anchor="${anchor}">${A.esc(lb)}</text>`;
      }
    });
    const hits = labels.map((_, i) => `<rect class="hit" data-i="${i}" x="${(i * band).toFixed(1)}" y="0" width="${band.toFixed(1)}" height="${H}"/>`).join("");
    el.classList.add("chart", "rel");
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${A.esc(name)}">${g}${hits}</svg><table class="sr"><caption>${A.esc(name)}</caption><tbody>${labels.map((lb, i) => `<tr><th>${A.esc(lb)}</th><td>${A.esc(tick(values[i] || 0))}</td></tr>`).join("")}</tbody></table>`;
    const tip = tooltip(el), svg = el.querySelector("svg");
    svg.addEventListener("pointermove", (e) => {
      const rect = e.target.closest?.(".hit"); if (!rect) return;
      const i = +rect.dataset.i;
      A.$$(".hit", svg).forEach((r) => r.classList.toggle("on", r === rect));
      tip.show(labels[i], [[tick(values[i] || 0), name]], (i + 0.5) * band, sy(values[i] || 0));
    });
    svg.addEventListener("pointerleave", () => { tip.hide(); A.$$(".hit.on", svg).forEach((r) => r.classList.remove("on")); });
  };

  /* Burbujas: x e y en un solo eje cada una, área proporcional a `size`. Basta con acercar el puntero: se activa
     el punto más cercano en un radio generoso, para que las burbujas pequeñas no exijan puntería. */
  A.bubbles = (el, { points, xLabel, yLabel, height = 340, describe, onPick, name = "" }) => {
    const W = Math.max(260, el.clientWidth || 640), H = height, L = 64, R = 18, T = 14, B = 42;
    if (!points.length) { el.innerHTML = `<div class="empty">${A.t("common.noData")}</div>`; return; }
    const xt = niceTicks(0, Math.max(5, ...points.map((p) => p.x)), W < 460 ? 3 : 5);
    const yt = niceTicks(0, Math.max(4, ...points.map((p) => p.y)), 4);
    const xMax = xt[xt.length - 1], yMax = yt[yt.length - 1];
    const sx = (v) => L + (v / xMax) * (W - L - R), sy = (v) => T + (1 - v / yMax) * (H - T - B);
    const maxSize = Math.max(1, ...points.map((p) => p.size)), rMax = Math.max(10, Math.min(22, W / 42));
    const marks = points.map((p) => ({ p, x: sx(p.x), y: sy(p.y), r: 4 + (rMax - 4) * Math.sqrt(p.size / maxSize) })).sort((a, b) => b.r - a.r);
    let g = "";
    yt.forEach((v) => { g += `<line class="gridl" x1="${L}" x2="${W - R}" y1="${sy(v)}" y2="${sy(v)}"/><text x="${L - 8}" y="${sy(v) + 4}" text-anchor="end">${A.esc(A.compact(v))}</text>`; });
    xt.forEach((v) => { g += `<text x="${sx(v)}" y="${H - 24}" text-anchor="middle">${A.esc(A.fmt(v))}</text>`; });
    g += `<text class="axt" x="${L + (W - L - R) / 2}" y="${H - 5}" text-anchor="middle">${A.esc(xLabel)}</text>`;
    g += `<text class="axt" x="${-(T + (H - T - B) / 2)}" y="11" transform="rotate(-90)" text-anchor="middle">${A.esc(yLabel)}</text>`;
    marks.forEach((m) => { g += `<circle class="bub${m.p.current ? " cur" : ""}" cx="${m.x.toFixed(1)}" cy="${m.y.toFixed(1)}" r="${m.r.toFixed(1)}" fill="${m.p.color}"/>`; });
    /* Etiquetas solo donde caben: el mundo actual primero y las que chocarían con otra se quedan en el tooltip. */
    const placed = [];
    marks.filter((m) => m.p.label).sort((a, b) => !!b.p.current - !!a.p.current || b.r - a.r).forEach((m) => {
      const left = m.x > L + (W - L - R) * 0.68, w = m.p.label.length * 6.8 + 6;
      const x0 = left ? m.x - m.r - 5 - w : m.x + m.r + 5, box = [x0, m.y - 9, x0 + w, m.y + 9];
      if (x0 < L || box[2] > W || placed.some((o) => box[0] < o[2] && box[2] > o[0] && box[1] < o[3] && box[3] > o[1])) return;
      placed.push(box);
      g += `<text class="lab" x="${(left ? box[2] - 3 : x0).toFixed(1)}" y="${(m.y + 4).toFixed(1)}" text-anchor="${left ? "end" : "start"}">${A.esc(m.p.label)}</text>`;
    });
    g += `<circle class="bub-hot" r="0" fill="none"/>`;
    el.classList.add("chart", "rel");
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${A.esc(name)}">${g}</svg>`;
    const svg = el.querySelector("svg"), hot = svg.querySelector(".bub-hot"), tip = tooltip(el);
    const nearest = (e) => {
      const r = svg.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      let best = null, bd = 44;
      for (const m of marks) { const d = Math.hypot(m.x - x, m.y - y) - m.r; if (d < bd) { bd = d; best = m; } }
      return best;
    };
    svg.addEventListener("pointermove", (e) => {
      const m = nearest(e);
      svg.classList.toggle("pick", !!m && !!onPick);
      if (!m) { tip.hide(); hot.setAttribute("r", 0); return; }
      hot.setAttribute("cx", m.x); hot.setAttribute("cy", m.y); hot.setAttribute("r", m.r + 3);
      const d = describe(m.p); tip.show(d.title, d.rows, m.x, m.y - m.r);
    });
    svg.addEventListener("pointerleave", () => { tip.hide(); hot.setAttribute("r", 0); });
    if (onPick) svg.addEventListener("click", (e) => { const m = nearest(e); if (m) onPick(m.p); });
  };
})();
