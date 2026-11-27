"""API REST (FastAPI). Sirve también el frontend estático."""
from __future__ import annotations

import json
import threading
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import __version__, alerts, analytics
from .config import settings
from .db import connect

WEBHOOK_RE = alerts.WEBHOOK_RE

class RuleIn(BaseModel):
    server_id: str
    kind: str
    params: dict = Field(default_factory=dict)
    webhook_url: str
    label: str | None = None


WEB_DIR = Path(__file__).resolve().parents[2] / "web" / "dist"


def create_app(db_path=None) -> FastAPI:
    con = connect(db_path or settings.db_path)
    lock = threading.Lock()
    cache: dict[str, tuple[str | None, bytes]] = {}  # sid -> (día de la instantánea, JSON)

    app = FastAPI(title="Atalaya API", version=__version__,
                  description="Inteligencia pública para Travian Legends (datos de map.sql).")
    app.add_middleware(GZipMiddleware, minimum_size=1024)
    app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_methods=["*"], allow_headers=["*"])

    def _server_or_404(sid: str):
        with lock:  # la conexión es compartida: dos peticiones a la vez podían cruzarse y dar un 404 falso
            row = con.execute("SELECT * FROM servers WHERE id=?", (sid,)).fetchone()
        if row is None:
            raise HTTPException(404, "Mundo no encontrado")
        return row

    @app.get("/api/health")
    def health():
        n = con.execute("SELECT COUNT(*) FROM servers").fetchone()[0]
        return {"ok": True, "version": __version__, "servers": n}

    @app.get("/api/servers")
    def servers(status: str | None = None):
        with lock:
            q = "SELECT * FROM servers"
            args: tuple = ()
            if status:
                q += " WHERE status=?"
                args = (status,)
            rows = con.execute(q + " ORDER BY region, id", args).fetchall()
            return [analytics.server_overview(con, r, settings.history_days) for r in rows]

    @app.get("/api/servers/{sid}/world")
    def world(sid: str):
        row = _server_or_404(sid)
        day = row["last_day"]
        with lock:
            hit = cache.get(sid)
            if hit is None or hit[0] != day:
                body = json.dumps(analytics.world_export(con, sid, settings.history_days),
                                  separators=(",", ":"), ensure_ascii=False).encode()
                cache[sid] = hit = (day, body)
        # Sin datos todavía: que el navegador no lo guarde, llegarán en la próxima pasada.
        return _raw(hit[1], max_age=600 if day else 0)

    @app.get("/api/servers/{sid}/events")
    def events(sid: str, days: int = 14):
        _server_or_404(sid)
        with lock:
            return analytics.events_export(con, sid, max(1, min(days, 60)))

    @app.get("/api/servers/{sid}/players/{uid}/villages")
    def player_villages(sid: str, uid: int):
        _server_or_404(sid)
        with lock:
            return analytics.player_villages_history(con, sid, uid)

    # --- alertas -------------------------------------------------------------------
    @app.get("/api/alerts/kinds")
    def alert_kinds():
        return alerts.KINDS

    @app.get("/api/alerts")
    def list_alerts(server: str | None = None):
        q = "SELECT id, server_id, kind, params, label, active, created_at, last_fired FROM alert_rules"
        rows = con.execute(q + (" WHERE server_id=?" if server else ""), (server,) if server else ()).fetchall()
        return [{**dict(r), "params": json.loads(r["params"])} for r in rows]

    @app.post("/api/alerts", status_code=201)
    def create_alert(rule: RuleIn):
        if rule.kind not in alerts.KINDS:
            raise HTTPException(422, "Tipo de alerta desconocido")
        if not WEBHOOK_RE.match(rule.webhook_url):
            raise HTTPException(422, "Solo se aceptan webhooks de Discord (https://discord.com/api/webhooks/…)")
        _server_or_404(rule.server_id)
        with lock:
            cur = con.execute(
                "INSERT INTO alert_rules(server_id, kind, params, webhook_url, label) VALUES (?,?,?,?,?)",
                (rule.server_id, rule.kind, json.dumps(rule.params), rule.webhook_url, rule.label))
            con.commit()
        return {"id": cur.lastrowid}

    @app.delete("/api/alerts/{rid}", status_code=204)
    def delete_alert(rid: int):
        with lock:
            con.execute("DELETE FROM alert_rules WHERE id=?", (rid,))
            con.commit()

    @app.post("/api/alerts/test")
    def test_alert(body: dict):
        url = str(body.get("webhook_url", ""))
        if not WEBHOOK_RE.match(url):
            raise HTTPException(422, "Webhook de Discord no válido")
        ok = alerts.discord_sender(url, alerts._embed("Atalaya conectado ✅",
                                                      ["Las alertas de este canal funcionan."], "Atalaya"))
        return {"ok": ok}

    # --- frontend ------------------------------------------------------------------
    if WEB_DIR.exists():
        app.mount("/", StaticFiles(directory=WEB_DIR, html=True), name="web")

    return app


def _raw(body: bytes, max_age: int = 0):
    from fastapi import Response
    return Response(content=body, media_type="application/json",
                    headers={"Cache-Control": f"public, max-age={max_age}"})
# Arranque: uvicorn atalaya.api:create_app --factory
