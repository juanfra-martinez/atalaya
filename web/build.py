#!/usr/bin/env python3
"""Empaqueta el frontend en un único HTML autocontenido.

    python web/build.py                       -> web/dist/index.html (usa la API /api)
    python web/build.py --demo demo.json      -> web/dist/demo.html  (datos incrustados)
    python web/build.py --static data --out web/dist/site/index.html
                                              -> lee los JSON de export-static (GitHub Pages)

Cuentas opcionales (Supabase): si hay URL y clave pública del proyecto, la web ofrece iniciar sesión y sincronizar.
Se leen de las opciones o de las variables de entorno ATALAYA_SUPABASE_URL, ATALAYA_SUPABASE_ANON_KEY,
ATALAYA_AUTH_PROVIDERS ("discord"), ATALAYA_SUPABASE_REGION y ATALAYA_PRIVACY_CONTACT. Sin ellas no cambia nada.
"""
from __future__ import annotations

import argparse
import base64
import binascii
import json
import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
ORDER = ["i18n.js", "core.js", "gamedata.js", "worlds.js", "intel.js", "terrain.js", "ops.js", "farmbuild.js", "ui.js", "charts.js", "map.js", "views-main.js", "views-servers.js", "views-more.js",
         "views-intel.js", "views-plan.js", "views-ops.js", "sync.js", "app.js"]
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


def supabase_config(url: str | None, key: str | None, providers: str | None = None,
                    region: str | None = None, contact: str | None = None) -> dict | None:
    """Configuración pública de las cuentas, o None si no hay proyecto. Se niega a publicar una clave secreta."""
    url, key = (url or "").strip().rstrip("/"), (key or "").strip()
    if not url and not key:
        return None
    if not url or not key:
        raise SystemExit("Cuentas: hacen falta la URL y la clave pública (anon) del proyecto de Supabase")
    if not re.fullmatch(r"https://[a-z0-9.-]+(:\d+)?", url):
        raise SystemExit(f"Cuentas: la URL de Supabase no es válida: {url!r}")
    if key.startswith("sb_secret_"):
        raise SystemExit("Cuentas: esa es la clave secreta de Supabase. Usa la pública (anon o sb_publishable_…)")
    if key.count(".") == 2:  # clave anon clásica (JWT): no puede ser la service_role
        try:
            part = key.split(".")[1]
            role = json.loads(base64.urlsafe_b64decode(part + "=" * (-len(part) % 4))).get("role")
        except (binascii.Error, ValueError, AttributeError):
            role = None
        if role != "anon":
            raise SystemExit(f"Cuentas: la clave no es la pública (anon): role={role!r}")
    elif not key.startswith("sb_publishable_"):
        raise SystemExit("Cuentas: la clave no parece una clave pública de Supabase (anon o sb_publishable_…)")
    cfg = {"url": url, "key": key,
           "providers": [p for p in (x.strip().lower() for x in (providers or "").split(",")) if p == "discord"]}
    if region and region.strip():
        cfg["region"] = region.strip()
    if contact and contact.strip():
        cfg["contact"] = contact.strip()
    return cfg


def build(demo: Path | None, out: Path, static: str | None = None, accounts: dict | None = None) -> Path:
    css = (SRC / "styles.css").read_text(encoding="utf-8")
    js = "\n;\n".join((SRC / f).read_text(encoding="utf-8") for f in ORDER)
    data = ""
    if demo:
        payload = json.loads(demo.read_text(encoding="utf-8"))
        raw = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).replace("</", "<\\/")
        data = f"<script>window.__ATALAYA_DEMO__={raw};</script>"
    elif static:
        data = f"<script>window.ATALAYA_STATIC={json.dumps(static)};</script>"
    if accounts and not demo:
        cfg = json.dumps(accounts, ensure_ascii=False).replace("</", "<\\/")
        data += f"\n<script>window.ATALAYA_SUPABASE={cfg};</script>"
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
    env = os.environ.get
    ap.add_argument("--supabase-url", default=env("ATALAYA_SUPABASE_URL"))
    ap.add_argument("--supabase-key", default=env("ATALAYA_SUPABASE_ANON_KEY"), help="clave pública (anon), nunca la secreta")
    ap.add_argument("--auth-providers", default=env("ATALAYA_AUTH_PROVIDERS"), help='además del correo: "discord"')
    ap.add_argument("--supabase-region", default=env("ATALAYA_SUPABASE_REGION"), help="para la política de privacidad")
    ap.add_argument("--privacy-contact", default=env("ATALAYA_PRIVACY_CONTACT"), help="correo o URL de contacto")
    a = ap.parse_args()
    accounts = supabase_config(a.supabase_url, a.supabase_key, a.auth_providers, a.supabase_region, a.privacy_contact)
    build(a.demo, a.out or ROOT / "dist" / ("demo.html" if a.demo else "index.html"), a.static, accounts)
