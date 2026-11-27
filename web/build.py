#!/usr/bin/env python3
"""Empaqueta el frontend en un único HTML autocontenido.

    python web/build.py                       -> web/dist/index.html (usa la API /api)
    python web/build.py --demo demo.json      -> web/dist/demo.html  (datos incrustados)
    python web/build.py --static data --out web/dist/site/index.html
                                              -> lee los JSON de export-static (GitHub Pages)
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
ORDER = ["i18n.js", "core.js", "gamedata.js", "worlds.js", "intel.js", "terrain.js", "ops.js", "farmbuild.js", "ui.js", "charts.js", "map.js", "views-main.js", "views-servers.js", "views-more.js",
         "views-intel.js", "views-plan.js", "views-ops.js", "app.js"]
FONTS = ("https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@600;700;800"
         "&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap")

TEMPLATE = """<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Atalaya</title>
<meta name="description" content="Atalaya: inactivos, mapa, eventos y alertas para Travian Legends.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="{fonts}">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Crect width='40' height='40' rx='9' fill='%2313202a'/%3E%3Cpath d='M20 7 25 12H15z' fill='%23e8b04b'/%3E%3Cpath d='M16.5 16h7l2 17h-11z' fill='%23eaeef0'/%3E%3C/svg%3E">
<style>
{css}
</style>
</head>
<body>
<noscript>Atalaya necesita JavaScript.</noscript>
{data}
<script>
{js}
A.boot();
</script>
</body>
</html>
"""


def build(demo: Path | None, out: Path, static: str | None = None) -> Path:
    css = (SRC / "styles.css").read_text(encoding="utf-8")
    js = "\n;\n".join((SRC / f).read_text(encoding="utf-8") for f in ORDER)
    data = ""
    if demo:
        payload = json.loads(demo.read_text(encoding="utf-8"))
        raw = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).replace("</", "<\\/")
        data = f"<script>window.__ATALAYA_DEMO__={raw};</script>"
    elif static:
        data = f"<script>window.ATALAYA_STATIC={json.dumps(static)};</script>"
    html = TEMPLATE.format(fonts=FONTS, css=css, js=js, data=data)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8")
    print(f"{out} · {out.stat().st_size / 1e6:.2f} MB")
    return out


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--demo", type=Path)
    ap.add_argument("--static", help="carpeta (relativa a la página) con los JSON de export-static")
    ap.add_argument("--out", type=Path)
    a = ap.parse_args()
    build(a.demo, a.out or ROOT / "dist" / ("demo.html" if a.demo else "index.html"), a.static)
