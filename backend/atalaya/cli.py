"""Línea de comandos de Atalaya.

    python -m atalaya.cli collect            # una pasada: descubrir + descargar + ingerir
    python -m atalaya.cli collect --loop     # cada ATALAYA_LOOP_MINUTES
    python -m atalaya.cli import FILE --server HOST --day YYYY-MM-DD   # ingerir un map.sql local
    python -m atalaya.cli seed-demo          # crea mundos sintéticos (sin red)
    python -m atalaya.cli export-demo OUT.json
    python -m atalaya.cli serve              # API + web en :8000
    python -m atalaya.cli prune [--vacuum]   # aplica las retenciones (versión sin servidor)
    python -m atalaya.cli export-static DIR  # JSON estáticos para GitHub Pages
"""
from __future__ import annotations

import argparse
import json
import logging
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from . import alerts, analytics, collector, mapsql, publish
from .config import settings
from .db import connect
from .ingest import ingest_snapshot, upsert_server
from .synthetic import DEMO_WORLDS, World


def seed_demo(con, history: int = 21, today: date | None = None) -> None:
    today = today or datetime.now(timezone.utc).date()
    for host, name, region, speed, age, seed, init, cap in DEMO_WORLDS:
        w = World(seed=seed, speed=speed, initial_players=init, max_players=cap)
        start = today - timedelta(days=age - 1)
        start_ts = int(datetime(start.year, start.month, start.day, tzinfo=timezone.utc).timestamp())
        # Calendario simulado con los plazos de un mundo ×1 real (artefactos hacia el día 90, planos hacia el 180).
        info = {"day": today.isoformat(), "players": None, "artefacts": start_ts + round(90 / speed) * 86400,
                "plans": start_ts + round(180 / speed) * 86400, "wwLevel": 0, "tribes": [1, 2, 3, 6, 7, 4, 5],
                "features": ["vacation", "allianceBonus", "travelOverTheWorldEdge"]}
        upsert_server(con, host, name=name, region=region, speed=speed, kind="regular", status="active",
                      source="synthetic", start_ts=start_ts, info=json.dumps(info, separators=(",", ":")))
        con.commit()
        for d in range(1, age + 1):
            w.step()
            day = start + timedelta(days=d - 1)
            if age - d < history:
                ingest_snapshot(con, host, day.isoformat(), w.rows())
        logging.info("demo %s: %d días", host, age)


def export_demo(con, out: Path) -> None:
    servers = [analytics.server_overview(con, r, settings.history_days)
               for r in con.execute("SELECT * FROM servers ORDER BY region, id")]
    bundle = {"generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"), "servers": servers,
              "worlds": {}, "events": {}}
    for s in servers:
        bundle["worlds"][s["id"]] = analytics.world_export(con, s["id"], settings.history_days)
        bundle["events"][s["id"]] = analytics.events_export(con, s["id"], 14)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(bundle, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
    print(f"{out} · {out.stat().st_size / 1e6:.2f} MB")


def main(argv=None) -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    logging.getLogger("httpx").setLevel(logging.WARNING)  # una línea por petición ahogaba el log
    ap = argparse.ArgumentParser(prog="atalaya")
    ap.add_argument("--db", default=str(settings.db_path))
    sub = ap.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("collect")
    c.add_argument("--loop", action="store_true")
    c.add_argument("--no-discover", action="store_true")
    i = sub.add_parser("import")
    i.add_argument("file")
    i.add_argument("--server", required=True)
    i.add_argument("--day", default=datetime.now(timezone.utc).date().isoformat())
    sd = sub.add_parser("seed-demo")
    sd.add_argument("--history", type=int, default=21)
    e = sub.add_parser("export-demo")
    e.add_argument("out")
    pr = sub.add_parser("prune")
    pr.add_argument("--vacuum", action="store_true")
    sub.add_parser("fingerprint")
    es = sub.add_parser("export-static")
    es.add_argument("out")
    s = sub.add_parser("serve")
    s.add_argument("--host", default="0.0.0.0")
    s.add_argument("--port", type=int, default=8000)
    a = ap.parse_args(argv)

    if a.cmd == "serve":
        import os
        import uvicorn
        os.environ["ATALAYA_DB"] = a.db
        settings.db_path = Path(a.db)
        uvicorn.run("atalaya.api:create_app", factory=True, host=a.host, port=a.port)
        return
    con = connect(a.db)
    if a.cmd == "collect":
        if settings.alert_rules_json:
            print(json.dumps(alerts.sync_env_rules(con, settings.alert_rules_json)))
        if a.loop:
            collector.loop(con, settings)
        else:
            res = collector.run_once(con, settings, discover_worlds=not a.no_discover)
            print(json.dumps(res, indent=1, ensure_ascii=False))
    elif a.cmd == "import":
        raw = Path(a.file).read_bytes()
        rows = mapsql.parse(raw)
        upsert_server(con, a.server, name=a.server, source="manual")
        print(ingest_snapshot(con, a.server, a.day, rows, raw=raw, retention_days=settings.village_retention_days))
    elif a.cmd == "seed-demo":
        seed_demo(con, a.history)
    elif a.cmd == "export-demo":
        export_demo(con, Path(a.out))
    elif a.cmd == "prune":
        print(json.dumps(publish.prune(con, settings)))
        alerts.redact_webhooks(con)
        if a.vacuum:
            publish.vacuum(con)
    elif a.cmd == "fingerprint":
        print(publish.fingerprint(con))
    elif a.cmd == "export-static":
        print(json.dumps(publish.export_static(con, Path(a.out), settings)))


if __name__ == "__main__":
    main()
