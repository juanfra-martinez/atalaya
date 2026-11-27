/* Mapa del mundo en canvas: desplazamiento, zoom (rueda y pellizco), modos de color y resaltados. */
"use strict";
(() => {
  const A = window.A;
  A.PALETTE = ["#e8b04b", "#5ea3ee", "#ef6a52", "#45c08a", "#a983ea", "#e57db4", "#4fd1d9", "#f08a3c", "#9fc25a", "#d6d0a5", "#7c8cff", "#c97a5a"];
  /* Las variables CSS se leen una vez por dibujo: getComputedStyle por aldea hacía ir a tirones el arrastre. */
  let cssCache = {};
  const css = (v) => (cssCache[v] ??= getComputedStyle(document.documentElement).getPropertyValue(v).trim());

  class WorldMap {
    constructor(canvas, opts = {}) {
      this.c = canvas; this.ctx = canvas.getContext("2d");
      this.opts = opts; this.mode = opts.mode || "alliance";
      this.highlight = null; this.ring = null; this.focus = null;
      this.s = 1.6; this.cx = 0; this.cy = 0;
      this.pointers = new Map();
      this._bind();
      this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(canvas);
    }
    setWorld(w) {
      this.w = w; this.R = w.R;
      const top = w.alliances.slice(0, A.PALETTE.length);
      this.aColor = new Map(top.map((a, i) => [a.aid, A.PALETTE[i]]));
      this.resize(true);
    }
    fit(whole = false) {
      const W = this.c.clientWidth, H = this.c.clientHeight;
      let x0 = -this.R, x1 = this.R, y0 = -this.R, y1 = this.R;
      if (!whole && this.w.villages.length) {
        const xs = this.w.villages.map((v) => v.x).sort((a, b) => a - b), ys = this.w.villages.map((v) => v.y).sort((a, b) => a - b);
        const q = (arr, f) => arr[Math.floor(f * (arr.length - 1))];
        x0 = q(xs, 0.01) - 8; x1 = q(xs, 0.99) + 8; y0 = q(ys, 0.01) - 8; y1 = q(ys, 0.99) + 8;
      }
      this.s = Math.min(W / (x1 - x0 + 1), H / (y1 - y0 + 1)) * 0.94;
      this.cx = (x0 + x1) / 2; this.cy = (y0 + y1) / 2; this.draw();
    }
    centerOn(x, y, s) { this.cx = x; this.cy = y; if (s) this.s = s; this.draw(); }
    resize(fit) {
      const dpr = window.devicePixelRatio || 1;
      const W = this.c.clientWidth, H = this.c.clientHeight;
      if (!W || !H) return;
      this.c.width = W * dpr; this.c.height = H * dpr; this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (fit || !this._fitted) { this._fitted = true; this.fit(); } else this.draw();
    }
    toScreen(x, y) { return [(x - this.cx) * this.s + this.c.clientWidth / 2, (this.cy - y) * this.s + this.c.clientHeight / 2]; }
    toWorld(px, py) { return [Math.round((px - this.c.clientWidth / 2) / this.s + this.cx), Math.round(this.cy - (py - this.c.clientHeight / 2) / this.s)]; }
    colorOf(v) {
      const p = this.w.pById.get(v.uid);
      if (v.uid === 1 || v.tid === 5) return css("--t-natars");
      switch (this.mode) {
        case "tribe": return css((A.TRIBES[v.tid] || A.TRIBES[5]).color) || "#888";
        case "inactive": {
          const st = p?.status;
          return st === "inactive" ? css("--bad") : st === "slowing" ? css("--warn") : st === "new" ? css("--info") : st === "active" ? css("--good") : css("--muted");
        }
        case "pop": {
          const t = Math.min(1, Math.sqrt(v.pop / 900));
          return `hsl(${42 - t * 38}, ${55 + t * 30}%, ${30 + t * 32}%)`;
        }
        default:
          return this.aColor.get(p?.aid) || (p?.aid ? css("--muted") : css("--line"));
      }
    }
    draw() {
      if (!this.w) return;
      cssCache = {};
      const ctx = this.ctx, W = this.c.clientWidth, H = this.c.clientHeight, s = this.s, R = this.R;
      ctx.fillStyle = css("--surface-2"); ctx.fillRect(0, 0, W, H);
      // borde del mundo y rejilla
      const [x0, y0] = this.toScreen(-R - 0.5, R + 0.5), [x1, y1] = this.toScreen(R + 0.5, -R - 0.5);
      ctx.fillStyle = css("--surface"); ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      ctx.strokeStyle = css("--line"); ctx.lineWidth = 1;
      const step = s > 9 ? 10 : s > 3 ? 25 : 50;
      ctx.beginPath();
      for (let g = -R - (-R % step); g <= R; g += step) {
        let [gx] = this.toScreen(g, 0); ctx.moveTo(gx, y0); ctx.lineTo(gx, y1);
        let [, gy] = this.toScreen(0, g); ctx.moveTo(x0, gy); ctx.lineTo(x1, gy);
      }
      ctx.globalAlpha = 0.55; ctx.stroke(); ctx.globalAlpha = 1;
      ctx.strokeStyle = css("--muted"); ctx.globalAlpha = 0.35; ctx.beginPath();
      let [ax] = this.toScreen(0, 0); ctx.moveTo(ax, y0); ctx.lineTo(ax, y1);
      let [, ay] = this.toScreen(0, 0); ctx.moveTo(x0, ay); ctx.lineTo(x1, ay); ctx.stroke(); ctx.globalAlpha = 1;
      ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
      // anillo de búsqueda
      if (this.ring) {
        const [rx, ry] = this.toScreen(this.ring.x, this.ring.y);
        ctx.beginPath(); ctx.arc(rx, ry, this.ring.r * s, 0, Math.PI * 2);
        ctx.fillStyle = css("--accent-soft"); ctx.fill();
        ctx.setLineDash([5, 5]); ctx.strokeStyle = css("--accent"); ctx.lineWidth = 1.4; ctx.stroke(); ctx.setLineDash([]);
      }
      // aldeas
      const size = Math.max(1.6, s * 0.86), half = size / 2;
      const hl = this.highlight;
      for (const v of this.w.villages) {
        const sxp = (v.x - this.cx) * s + W / 2, syp = (this.cy - v.y) * s + H / 2;
        if (sxp < -size || syp < -size || sxp > W + size || syp > H + size) continue;
        const on = !hl || hl(v);
        ctx.globalAlpha = on ? 1 : 0.13;
        ctx.fillStyle = this.colorOf(v);
        const z = v.capital && s > 3 ? size * 1.15 : size;
        ctx.fillRect(sxp - z / 2, syp - z / 2, z, z);
        if (on && hl && s < 4) { ctx.fillRect(sxp - half - 0.6, syp - half - 0.6, size + 1.2, size + 1.2); }
      }
      ctx.globalAlpha = 1;
      if (s >= 16) {
        ctx.font = `600 ${Math.min(12, s * 0.42)}px ${css("--font-mono")}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        for (const v of this.w.villages) {
          const [px, py] = this.toScreen(v.x, v.y);
          if (px < 0 || py < 0 || px > W || py > H) continue;
          ctx.fillStyle = "rgba(0,0,0,.65)"; ctx.fillText(v.pop, px, py + 0.5);
        }
      }
      // casa y foco
      const mark = (pt, color, label) => {
        const [hx, hy] = this.toScreen(pt.x, pt.y);
        ctx.beginPath(); ctx.arc(hx, hy, Math.max(7, s * 0.9), 0, Math.PI * 2);
        ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.stroke();
        ctx.beginPath(); ctx.arc(hx, hy, Math.max(12, s * 1.5), 0, Math.PI * 2); ctx.globalAlpha = .35; ctx.stroke(); ctx.globalAlpha = 1;
        if (label) { ctx.font = `700 12px ${css("--font-body")}`; ctx.fillStyle = color; ctx.textAlign = "left"; ctx.fillText(label, hx + Math.max(14, s * 1.6), hy - 6); }
      };
      if (A.state.home) mark(A.state.home, css("--accent"), A.t("map.home"));
      if (this.focus) mark(this.focus, css("--ink"));
      this.opts.onDraw?.();
    }
    _bind() {
      const c = this.c;
      let last = null, moved = false, pinch = null;
      c.addEventListener("wheel", (e) => {
        e.preventDefault();
        const r = c.getBoundingClientRect();
        this.zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015));
      }, { passive: false });
      c.addEventListener("pointerdown", (e) => {
        c.setPointerCapture(e.pointerId); this.pointers.set(e.pointerId, [e.clientX, e.clientY]);
        last = [e.clientX, e.clientY]; moved = false; c.classList.add("drag");
        if (this.pointers.size === 2) { const p = [...this.pointers.values()]; pinch = Math.hypot(p[0][0] - p[1][0], p[0][1] - p[1][1]); }
      });
      c.addEventListener("pointermove", (e) => {
        const r = c.getBoundingClientRect();
        if (this.pointers.has(e.pointerId)) {
          this.pointers.set(e.pointerId, [e.clientX, e.clientY]);
          if (this.pointers.size === 2 && pinch) {
            const p = [...this.pointers.values()]; const d = Math.hypot(p[0][0] - p[1][0], p[0][1] - p[1][1]);
            this.zoomAt((p[0][0] + p[1][0]) / 2 - r.left, (p[0][1] + p[1][1]) / 2 - r.top, d / pinch); pinch = d; moved = true; return;
          }
          const dx = e.clientX - last[0], dy = e.clientY - last[1];
          if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
          this.cx -= dx / this.s; this.cy += dy / this.s; last = [e.clientX, e.clientY]; this.draw();
        }
        const [wx, wy] = this.toWorld(e.clientX - r.left, e.clientY - r.top);
        this.opts.onHover?.(this.w?.vAt.get(wx + "," + wy) || null, wx, wy, e.clientX - r.left, e.clientY - r.top);
      });
      const up = (e) => {
        this.pointers.delete(e.pointerId); c.classList.remove("drag"); if (this.pointers.size < 2) pinch = null; if (this.pointers.size === 1) last = [...this.pointers.values()][0];
        if (!moved && e.type === "pointerup") {
          const r = c.getBoundingClientRect(); const [wx, wy] = this.toWorld(e.clientX - r.left, e.clientY - r.top);
          this.opts.onClick?.(this.w?.vAt.get(wx + "," + wy) || null, wx, wy);
        }
      };
      c.addEventListener("pointerup", up); c.addEventListener("pointercancel", up);
      c.addEventListener("pointerleave", () => this.opts.onHover?.(null));
    }
    zoomAt(px, py, f) {
      const [wx, wy] = [(px - this.c.clientWidth / 2) / this.s + this.cx, this.cy - (py - this.c.clientHeight / 2) / this.s];
      this.s = Math.max(0.6, Math.min(40, this.s * f));
      this.cx = wx - (px - this.c.clientWidth / 2) / this.s; this.cy = wy + (py - this.c.clientHeight / 2) / this.s; this.draw();
    }
    destroy() { this.ro.disconnect(); }
  }
  A.WorldMap = WorldMap;

  /* Minimapa estático para perfiles de alianza/jugador. */
  A.drawMini = (canvas, w, isOn, color) => {
    const dpr = window.devicePixelRatio || 1, W = canvas.clientWidth, H = canvas.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    const ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const R = w.R, s = W / (2 * R + 1);
    ctx.fillStyle = css("--surface-2"); ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = css("--line"); ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();
    for (const v of w.villages) {
      const on = isOn(v);
      ctx.fillStyle = on ? color : css("--line");
      const z = on ? Math.max(2.5, s * 1.4) : Math.max(1, s);
      ctx.fillRect((v.x + R) * s - z / 2, (R - v.y) * s - z / 2, z, z);
    }
  };
})();
