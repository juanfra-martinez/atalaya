/* Componentes de interfaz compartidos e iconos. */
"use strict";
(() => {
  const A = window.A;
  const P = {
    servers: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>',
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',
    map: '<path d="M9 4 3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5L9 4z"/><path d="M9 4v13.5M15 6.5V20"/>',
    events: '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/>',
    rank: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
    tools: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5 5-2z"/>',
    watch: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
    star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9L12 3z"/>',
    bell: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    swords: '<path d="M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2"/><path d="M9.5 6.5 14 2h3v3l-4.5 4.5"/>',
    flag: '<path d="M4 22V4M4 4h13l-2 4 2 4H4"/>',
    home: '<path d="M3 11 12 3l9 8M5 9.5V21h14V9.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3z"/>',
    pin: '<path d="M12 21s-7-6.3-7-12a7 7 0 0 1 14 0c0 5.7-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>',
    sprout: '<path d="M12 21v-9M12 12c0-4-3-7-8-7 0 5 3 7 8 7zM12 14c0-4 3-7 8-7 0 5-3 7-8 7z"/>',
    skull: '<circle cx="12" cy="10" r="7"/><path d="M9 17v4h6v-4"/><circle cx="9.5" cy="10" r="1.3" fill="currentColor"/><circle cx="14.5" cy="10" r="1.3" fill="currentColor"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    farm: '<path d="M10 6h10M10 12h10M10 18h10M3.5 6l1.2 1.2L7 5M3.5 12l1.2 1.2L7 11M3.5 18l1.2 1.2L7 17"/>',
    arrowUp: '<path d="M12 20V5M6 11l6-6 6 6"/>',
    arrowDown: '<path d="M12 4v15M6 13l6 6 6-6"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.8"/><path d="M15.5 14.2A5.5 5.5 0 0 1 21.5 20"/>',
  };
  A.icon = (n, cls = "") => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ""}</svg>`;
  A.logo = (size = 34) => `<svg width="${size}" height="${size}" viewBox="0 0 40 40" aria-hidden="true">
      <rect x="1" y="1" width="38" height="38" rx="9" fill="var(--ink)"/>
      <path d="M20 7 25 12H15z" fill="var(--accent)"/>
      <rect x="15.5" y="12" width="9" height="4" fill="var(--accent)"/>
      <path d="M16.5 16h7l2 17h-11z" fill="var(--bg)"/>
      <rect x="18.6" y="20" width="2.8" height="4" rx="1.4" fill="var(--accent)"/>
      <path d="M6 33h28" stroke="var(--accent)" stroke-width="1.6"/>
      <path d="M25 13.5 34 9M25 15.5l9 2" stroke="var(--accent)" stroke-width="1.2" opacity=".6"/>
    </svg>`;

  A.ui = {
    tribe: (tid, label = true) => { const t = A.TRIBES[tid] || A.TRIBES[5]; return `<span class="tribe"><i style="background:var(${t.color})"></i>${label ? A.esc(A.t("tribe." + t.key)) : ""}</span>`; },
    pill: (st) => `<span class="pill ${st}">${A.esc(A.t("status." + st))}</span>`,
    player: (p) => p ? `<span class="plink" data-player="${p.uid}" tabindex="0" role="button">${A.esc(p.name)}</span>` : "—",
    ally: (aid) => {
      if (!aid) return `<span class="muted">—</span>`;
      const a = A.state.world?.aById.get(aid);
      return `<span class="tag" data-ally="${aid}" tabindex="0" role="button">${A.esc(a?.tag || "#" + aid)}</span>`;
    },
    coord: (x, y) => `<button class="btn ghost sm mono" data-copy="${x}|${y}" title="${A.esc(A.t("common.copyCoord"))}">${A.coord(x, y)}</button>`,
    conf: (p) => {
      const c = p.confidence;
      return `<span class="conf why" tabindex="0"><span class="bar"><i style="width:${c}%;background:${A.confColor(c)}"></i></span><b>${c}%</b>
        <span class="why-tip"><b>${A.esc(A.t("why.title"))}</b><ul>${A.reasons(p).map((r) => `<li>${A.esc(r)}</li>`).join("")}</ul></span></span>`;
    },
    delta: (n) => `<span class="mono ${A.cls(n)}">${A.signed(n)}</span>`,
    /* Enlace al juego en una pestaña nueva; vacío en la demo o en mundos que no son de travian.com. */
    game: (kind, a, b, label = "") => {
      const u = A.gameUrl(kind, a, b); if (!u) return "";
      const tip = A.esc(A.t("game." + kind));
      return `<a class="btn ghost sm" href="${A.esc(u)}" target="_blank" rel="noopener noreferrer" title="${tip}" aria-label="${tip}">${A.icon(kind === "send" ? "swords" : "external")}${label ? A.esc(label) : ""}</a>`;
    },
    star: (type, id, extra = "") => `<button class="btn ghost sm" data-watch="${type}:${id}" ${extra} aria-pressed="${A.isWatched(type, id)}" title="${A.esc(A.t("common.watch"))}" style="${A.isWatched(type, id) ? "color:var(--accent)" : ""}">${A.icon("star")}</button>`,
    empty: (title, body = "") => `<div class="empty"><b>${A.esc(title)}</b>${A.esc(body)}</div>`,
    sortable(table, rows, cols, state, render) {
      // cols: [{k, label, cls, sort:(row)=>value}]
      const head = cols.map((c) => `<th class="${c.sort ? "sortable" : ""} ${c.cls || ""}" data-k="${c.k}" ${state.sort === c.k ? `aria-sort="${state.dir > 0 ? "ascending" : "descending"}"` : ""}>${c.label}</th>`).join("");
      table.querySelector("thead").innerHTML = `<tr>${head}</tr>`;
      table.querySelector("thead").onclick = (e) => {
        const th = e.target.closest("th.sortable"); if (!th) return;
        const k = th.dataset.k;
        if (state.sort === k) state.dir *= -1; else { state.sort = k; state.dir = -1; }
        render();
      };
      const col = cols.find((c) => c.k === state.sort);
      if (col?.sort) rows.sort((a, b) => { const va = col.sort(a), vb = col.sort(b); return (va > vb ? 1 : va < vb ? -1 : 0) * state.dir; });
      return rows;
    },
  };

  /* Un cuadro de pegado que también acepta ficheros: soltarlos encima o elegirlos con el botón (un .har guardado
     desde la pestaña Red, un .json o un .txt). Se leen en el navegador y no se suben a ningún sitio. */
  A.ui.fileInput = (ta, button, onText) => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = ".har,.json,.txt,.html,.htm,application/json,text/plain,text/html"; input.multiple = true; input.hidden = true;
    button.after(input);
    const read = async (files) => {
      const texts = await Promise.all([...files].slice(0, 20).map((f) => f.text().catch(() => "")));
      const txt = texts.filter(Boolean).join("\n");
      if (txt) onText(txt);
    };
    button.onclick = () => input.click();
    input.onchange = () => { read(input.files); input.value = ""; };
    ta.addEventListener("dragover", (e) => { if (e.dataTransfer?.types?.includes("Files")) { e.preventDefault(); ta.classList.add("drop"); } });
    ta.addEventListener("dragleave", () => ta.classList.remove("drop"));
    ta.addEventListener("drop", (e) => { if (!e.dataTransfer?.files?.length) return; e.preventDefault(); ta.classList.remove("drop"); read(e.dataTransfer.files); });
  };

  /* Modal genérico */
  A.modal = (title, body, actions = "") => {
    A.closeOverlays();
    const scrim = document.createElement("div"); scrim.className = "scrim";
    const m = document.createElement("div"); m.className = "modal"; m.setAttribute("role", "dialog"); m.setAttribute("aria-modal", "true");
    m.innerHTML = `<div class="modal-h"><h2>${A.esc(title)}</h2><button class="icon-btn" data-close style="margin-left:auto" aria-label="${A.esc(A.t("common.close"))}">${A.icon("x")}</button></div><div class="modal-b">${body}</div>${actions ? `<div class="modal-f">${actions}</div>` : ""}`;
    document.body.append(scrim, m);
    scrim.onclick = A.closeOverlays; m.querySelector("[data-close]").onclick = A.closeOverlays;
    setTimeout(() => (m.querySelector("input,textarea,select,button.primary") || m.querySelector("[data-close]")).focus(), 30);
    return m;
  };
  A.closeOverlays = () => A.$$(".scrim,.modal,.drawer").forEach((e) => e.remove());
  A.showCopyModal = (text) => {
    const m = A.modal(A.t("common.copyManual"), `<p class="muted" style="margin:0">${A.esc(A.t("common.copyManualHint"))}</p><textarea class="input" id="copy-ta" readonly>${A.esc(text)}</textarea>`);
    const ta = m.querySelector("#copy-ta"); ta.focus(); ta.select();
  };
})();
