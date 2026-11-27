"""Publicación sin servidor: poda de la base y exportación a ficheros JSON estáticos.

Pensado para GitHub Actions + GitHub Pages (ver ``.github/workflows/collect.yml``):
cada pasada restaura la base, recolecta, la poda, la guarda y publica la web con los
datos ya calculados, de modo que no hace falta ninguna máquina encendida.

    python -m atalaya.cli prune [--vacuum]
    python -m atalaya.cli export-static web/dist/site/data
"""
from __future__ import annotations

import json
import logging
import shutil
import sqlite3
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from . import analytics

log = logging.getLogger("atalaya.publish")

# Tablas con datos por mundo, en orden seguro para borrar un mundo entero.
SERVER_TABLES = ("events", "villages", "player_days", "alliance_days", "players", "alliances", "snapshots")


def _cutoff(con: sqlite3.Connection, sid: str, keep: int) -> str | None:
    """Día de la instantánea número ``keep`` empezando por la más reciente (o None si hay menos)."""
    if keep <= 0:
        return None
    r = con.execute("SELECT day FROM snapshots WHERE server_id=? ORDER BY day DESC LIMIT 1 OFFSET ?",
                    (sid, keep - 1)).fetchone()
    return r[0] if r else None


def prune(con: sqlite3.Connection, settings, today: date | None = None) -> dict:
    """Aplica las retenciones configuradas a todos los mundos.

    - ``village_retention_days``: instantáneas por aldea que se guardan (``world_export`` usa 4).
    - ``day_retention_days``: instantáneas de agregados por jugador/alianza y de eventos (0 = siempre).
    - ``ended_retention_days``: días que se conserva un mundo terminado (0 = siempre).
    """
    today = today or datetime.now(timezone.utc).date()
    out = {"villages": 0, "days": 0, "ended": []}
    with con:
        if settings.ended_retention_days > 0:
            limit = (today - timedelta(days=settings.ended_retention_days)).isoformat()
            for r in con.execute("SELECT id FROM servers WHERE status='ended' AND COALESCE(last_seen,'')<?",
                                 (limit,)).fetchall():
                for t in SERVER_TABLES:
                    con.execute(f"DELETE FROM {t} WHERE server_id=?", (r["id"],))
                con.execute("DELETE FROM servers WHERE id=?", (r["id"],))
                out["ended"].append(r["id"])
        for (sid,) in con.execute("SELECT DISTINCT server_id FROM snapshots").fetchall():
            cut = _cutoff(con, sid, settings.village_retention_days)
            if cut:
                out["villages"] += con.execute("DELETE FROM villages WHERE server_id=? AND day<?",
                                               (sid, cut)).rowcount
            cut = _cutoff(con, sid, settings.day_retention_days)
            if cut:
                for t in ("player_days", "alliance_days", "events"):
                    out["days"] += con.execute(f"DELETE FROM {t} WHERE server_id=? AND day<?", (sid, cut)).rowcount
                # Jugadores y alianzas que no aparecen en ningún día guardado.
                con.execute("DELETE FROM players WHERE server_id=? AND last_seen<?", (sid, cut))
                con.execute("DELETE FROM alliances WHERE server_id=? AND last_seen<?", (sid, cut))
        con.execute("DELETE FROM alert_log WHERE sent_at < datetime('now', '-60 days')")
    return out


def vacuum(con: sqlite3.Connection) -> None:
    con.execute("PRAGMA wal_checkpoint(TRUNCATE)")
    con.execute("VACUUM")


def _dump(path: Path, payload) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    body = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    path.write_bytes(body)
    return len(body)


def export_static(con: sqlite3.Connection, out: Path, settings) -> dict:
    """Escribe lo que la web pide a la API como ficheros:

    ``servers.json`` (``/api/servers``), ``worlds/<mundo>.json`` (``/world``),
    ``events/<mundo>.json`` (``/events?days=14``) y ``meta.json``.
    """
    if out.exists():
        shutil.rmtree(out)
    rows = con.execute("SELECT * FROM servers ORDER BY region, id").fetchall()
    servers = [analytics.server_overview(con, r, settings.history_days) for r in rows]
    size = _dump(out / "servers.json", servers)
    n = 0
    for s in servers:
        if not s.get("day"):
            continue  # sin instantáneas: la web no ofrece abrirlo
        size += _dump(out / "worlds" / f"{s['id']}.json", analytics.world_export(con, s["id"], settings.history_days))
        size += _dump(out / "events" / f"{s['id']}.json", analytics.events_export(con, s["id"], 14))
        n += 1
    meta = {"generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"), "servers": len(servers), "worlds": n}
    _dump(out / "meta.json", meta)
    log.info("exportados %d mundos (%d con datos), %.1f MB", len(servers), n, size / 1e6)
    return {**meta, "bytes": size}


def fingerprint(con: sqlite3.Connection) -> str:
    """Huella de lo que se publica: si no cambia tras una pasada, no hace falta guardar ni desplegar."""
    import hashlib
    h = hashlib.sha256()
    for row in con.execute("SELECT id, status, last_day, map_radius, start_ts, end_ts, name, info FROM servers ORDER BY id"):
        h.update(repr(tuple(row)).encode())
    for row in con.execute("SELECT server_id, day, sha256 FROM snapshots ORDER BY server_id, day"):
        h.update(repr(tuple(row)).encode())
    for row in con.execute("SELECT id, last_fired FROM alert_rules ORDER BY id"):
        h.update(repr(tuple(row)).encode())
    return h.hexdigest()
