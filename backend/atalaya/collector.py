"""Recolector: descubre mundos, descarga map.sql e ingesta una instantánea al día."""
from __future__ import annotations

import hashlib
import json
import logging
import sqlite3
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

import httpx

from . import alerts, mapsql
from .discovery import World, discover_sources, parse_world_calendar, parse_world_info
from .ingest import ingest_snapshot, upsert_server

log = logging.getLogger("atalaya.collector")
MAX_FAILS = 3


def sync_servers(con: sqlite3.Connection, worlds: list[World], responded: set[str] | None = None) -> None:
    """Guarda los mundos descubiertos y marca como terminados los que han desaparecido.

    Solo se da por terminado un mundo si *su* fuente respondió: si status.travian.com
    falla pero el calendario del lobby no, no hay que terminar los mundos de la página
    de estado.
    """
    if responded is None:
        responded = {w.source for w in worlds}
    seen = set()
    for w in worlds:
        seen.add(w.host)
        upsert_server(con, w.host, name=w.name or w.host, region=w.region, speed=w.speed, kind=w.kind,
                      start_ts=w.start_ts, end_ts=w.end_ts, source=w.source, status=w.status)
    for r in con.execute("SELECT id, source FROM servers WHERE status IN ('active','upcoming')").fetchall():
        if r["id"] not in seen and r["source"] in responded & {"status", "lobby"}:
            con.execute("UPDATE servers SET status='ended' WHERE id=?", (r["id"],))
    con.commit()


def _fetch_info(client: httpx.Client, host: str, known: bool = False) -> dict:
    """Datos de /api/v1/info: fecha de inicio, velocidad y tamaño del mapa (solo si aún no se conocen,
    ``known=False``) y el calendario del mundo (artefactos, planos, Maravilla, tribus y reglas)."""
    try:
        r = client.get(f"https://{host}/api/v1/info", headers={"Accept": "application/json"})
        if r.status_code == 200:
            payload = r.json()
            out = {} if known else parse_world_info(payload)
            cal = parse_world_calendar(payload)
            if cal:
                out["info"] = json.dumps(cal, separators=(",", ":"))
            return out
    except (httpx.HTTPError, ValueError, TypeError, AttributeError) as e:  # respuesta rara: el mundo sigue sin calendario
        log.info("%s: sin /api/v1/info (%s)", host, e)
    return {}


def _info_stale(row: sqlite3.Row, today: str) -> bool:
    """El calendario se refresca como mucho una vez al día."""
    try:
        return json.loads(row["info"] or "{}").get("day") != today
    except ValueError:
        return True


def _fetch(client: httpx.Client, row: sqlite3.Row, delay: float) -> tuple[str, int, bytes | None, dict, dict]:
    host = row["id"]
    time.sleep(delay)
    today = datetime.now(timezone.utc).date().isoformat()
    info = _fetch_info(client, host, known=bool(row["start_ts"])) if not row["start_ts"] or _info_stale(row, today) else {}
    return (*_fetch_map(client, row), info)


def _fetch_map(client: httpx.Client, row: sqlite3.Row) -> tuple[str, int, bytes | None, dict]:
    host = row["id"]
    headers = {}
    if row["etag"]:
        headers["If-None-Match"] = row["etag"]
    if row["last_modified"]:
        headers["If-Modified-Since"] = row["last_modified"]
    # Los mundos actuales sirven map.sql sin comprimir (map.sql.gz da 404): se prueba primero.
    for path in ("/map.sql", "/map.sql.gz"):
        try:
            r = client.get(f"https://{host}{path}", headers=headers)
        except httpx.HTTPError as e:
            log.warning("%s: %s", host, e)
            return host, -1, None, {}
        if r.status_code == 404 and path == "/map.sql":
            continue
        return host, r.status_code, (r.content if r.status_code == 200 else None), dict(r.headers)
    return host, 404, None, {}


def snapshot_day(headers: dict) -> str:
    lm = headers.get("last-modified")
    if lm:
        try:
            return parsedate_to_datetime(lm).astimezone(timezone.utc).date().isoformat()
        except (TypeError, ValueError):
            pass
    return datetime.now(timezone.utc).date().isoformat()


def _due(row: sqlite3.Row, today: str, now_ts: float) -> bool:
    """¿Toca descargar este mundo? Una vez al día, y nunca antes de que empiece."""
    if row["last_day"] == today:
        return False
    if row["status"] == "upcoming" and row["start_ts"] and row["start_ts"] > now_ts:
        return False
    return True


def _same_as_last(con: sqlite3.Connection, host: str, sha: str) -> bool:
    """map.sql no trae Last-Modified ni ETag: si el contenido es idéntico a la última
    instantánea, el fichero aún no se ha regenerado y no es un día nuevo."""
    r = con.execute("SELECT sha256 FROM snapshots WHERE server_id=? ORDER BY day DESC LIMIT 1", (host,)).fetchone()
    return bool(r and r["sha256"] == sha)


def run_once(con: sqlite3.Connection, settings, *, discover_worlds: bool = True,
             client: httpx.Client | None = None) -> list[dict]:
    own = client is None
    client = client or httpx.Client(timeout=settings.timeout_s, follow_redirects=True,
                                    headers={"User-Agent": settings.user_agent, "Accept-Encoding": "gzip"})
    results = []
    try:
        if discover_worlds:
            worlds, responded = discover_sources(settings, client)
            log.info("descubiertos %d mundos (fuentes: %s)", len(worlds), ", ".join(sorted(responded)) or "ninguna")
            sync_servers(con, worlds, responded)
        rows = con.execute("SELECT * FROM servers WHERE status IN ('active','upcoming') AND source!='synthetic'").fetchall()
        today = datetime.now(timezone.utc).date().isoformat()
        todo = [r for r in rows if _due(r, today, time.time())]
        log.info("%d mundos por descargar", len(todo))
        with ThreadPoolExecutor(max_workers=max(1, settings.concurrency)) as pool:
            futs = [pool.submit(_fetch, client, r, settings.request_delay_s) for r in todo]
            for fut in as_completed(futs):
                try:
                    host, code, body, headers, info = fut.result()
                except Exception:  # noqa: BLE001 — un fallo inesperado en la descarga no debe parar la pasada
                    log.exception("error al descargar un mundo")
                    continue
                try:
                    if info:
                        upsert_server(con, host, **info)
                        con.commit()
                    res = _store(con, settings, host, code, body, headers)
                except Exception:  # noqa: BLE001 — un mundo roto no debe parar a los demás
                    con.rollback()
                    log.exception("%s: error al procesar map.sql", host)
                    continue
                if res:
                    results.append(res)
    finally:
        if own:
            client.close()
    return results


def _store(con: sqlite3.Connection, settings, host: str, code: int, body: bytes | None, headers: dict) -> dict | None:
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    if code == 200 and body:
        sha = hashlib.sha256(body).hexdigest()
        if _same_as_last(con, host, sha):
            con.execute("UPDATE servers SET last_fetch=? WHERE id=?", (now, host))
            con.commit()
            log.info("%s: map.sql sin cambios desde la última instantánea", host)
            return None
        rows_ = mapsql.parse(body)
        if not rows_:
            log.warning("%s: map.sql sin aldeas (%d bytes)", host, len(body))
            return None
        day = snapshot_day(headers)
        res = ingest_snapshot(con, host, day, rows_, raw=body, retention_days=settings.village_retention_days)
        con.execute("UPDATE servers SET last_fetch=?, etag=?, last_modified=?, fail_count=0, "
                    "status='active' WHERE id=?",
                    (now, headers.get("etag"), headers.get("last-modified"), host))
        con.commit()
        res["alerts"] = alerts.evaluate(con, host, day)
        log.info("%s %s: %d aldeas, %d jugadores, eventos %s", host, day, res["villages"], res["players"], res["events"])
        return res
    if code == 200:
        # Los mundos anunciados que aún no tienen datos responden 200 con el cuerpo vacío.
        con.execute("UPDATE servers SET last_fetch=? WHERE id=?", (now, host))
        log.info("%s: map.sql vacío (el mundo aún no tiene datos)", host)
    elif code == 304:
        con.execute("UPDATE servers SET last_fetch=? WHERE id=?", (now, host))
    elif code == 404:
        con.execute("UPDATE servers SET fail_count=fail_count+1, status=CASE WHEN fail_count+1>=? "
                    "THEN 'ended' ELSE status END WHERE id=?", (MAX_FAILS, host))
        log.warning("%s: map.sql no encontrado (404)", host)
    elif code != -1:
        log.warning("%s: respuesta HTTP %s", host, code)
    con.commit()
    return None


def loop(con: sqlite3.Connection, settings) -> None:
    while True:
        try:
            run_once(con, settings)
        except Exception:  # noqa: BLE001 — el bucle no debe morir
            log.exception("fallo en la recolección")
        time.sleep(settings.loop_interval_min * 60)
