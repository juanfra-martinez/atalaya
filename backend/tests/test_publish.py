"""Versión sin servidor: poda, exportación estática y alertas desde ATALAYA_ALERT_RULES."""
import json
from datetime import date
from types import SimpleNamespace

import pytest

from atalaya import alerts, analytics, mapsql, publish
from atalaya.db import connect
from atalaya.ingest import ingest_snapshot, upsert_server

S = "ts1.x1.test.travian.com"
HOOK = "https://discord.com/api/webhooks/123/abc-DEF"


def _row(vid, x, y, uid, aid, pop):
    return mapsql.VillageRow(vid, x, y, 1, vid, f"v{vid}", uid, f"p{uid}", aid, f"A{aid}" if aid else "", pop)


def _settings(**kw):
    base = dict(village_retention_days=5, day_retention_days=0, ended_retention_days=0, history_days=21)
    return SimpleNamespace(**{**base, **kw})


@pytest.fixture
def con():
    c = connect(":memory:")
    upsert_server(c, S, name="Test", speed=1, status="active")
    for k in range(1, 11):
        ingest_snapshot(c, S, f"2026-10-{k:02d}", [_row(1, 0, 0, 10, 1, 100 + k), _row(2, 5, 5, 20, 1, 80)])
    return c


def test_prune_keeps_what_world_export_needs(con):
    before = analytics.world_export(con, S)
    res = publish.prune(con, _settings())
    days = [r[0] for r in con.execute("SELECT DISTINCT day FROM villages ORDER BY day")]
    assert days == ["2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10"]
    assert res["villages"] == 10
    # La exportación (incluidos d1 y d3 de cada aldea y el historial por jugador) no cambia.
    assert analytics.world_export(con, S) == before


def test_prune_day_retention_and_ended_worlds(con):
    upsert_server(con, "old.x1.test.travian.com")
    ingest_snapshot(con, "old.x1.test.travian.com", "2026-08-30", [_row(1, 0, 0, 10, 0, 5)])
    con.execute("UPDATE servers SET status='ended', last_seen='2026-09-01' WHERE id='old.x1.test.travian.com'")
    res = publish.prune(con, _settings(day_retention_days=3, ended_retention_days=14), today=date(2026, 10, 10))
    assert res["ended"] == ["old.x1.test.travian.com"]
    assert con.execute("SELECT COUNT(*) FROM servers WHERE id='old.x1.test.travian.com'").fetchone()[0] == 0
    assert con.execute("SELECT COUNT(*) FROM villages WHERE server_id='old.x1.test.travian.com'").fetchone()[0] == 0
    assert [r[0] for r in con.execute("SELECT DISTINCT day FROM player_days WHERE server_id=? ORDER BY day", (S,))] == \
        ["2026-10-08", "2026-10-09", "2026-10-10"]


def test_export_static_matches_api_shapes(con, tmp_path):
    out = tmp_path / "data"
    meta = publish.export_static(con, out, _settings())
    assert meta["worlds"] == 1
    servers = json.loads((out / "servers.json").read_text(encoding="utf-8"))
    assert servers[0]["id"] == S and servers[0]["day"] == "2026-10-10"
    world = json.loads((out / "worlds" / f"{S}.json").read_text(encoding="utf-8"))
    assert world == json.loads(json.dumps(analytics.world_export(con, S, 21)))
    assert isinstance(json.loads((out / "events" / f"{S}.json").read_text(encoding="utf-8")), list)


def test_fingerprint_changes_only_with_published_data(con):
    a = publish.fingerprint(con)
    con.execute("UPDATE servers SET last_fetch='2026-10-10T10:00:00' WHERE id=?", (S,))
    assert publish.fingerprint(con) == a  # comprobar sin cambios no obliga a desplegar
    ingest_snapshot(con, S, "2026-10-11", [_row(1, 0, 0, 10, 1, 300)])
    assert publish.fingerprint(con) != a


def test_env_rules_never_store_the_webhook(con):
    raw = json.dumps([{"server_id": S, "kind": "area_conquest", "params": {"x": 0, "y": 0, "radius": 10},
                       "webhook_url": HOOK, "label": "Zona"},
                      {"server_id": S, "kind": "nope", "params": {}, "webhook_url": HOOK},
                      {"server_id": S, "kind": "area_conquest", "params": {}, "webhook_url": "https://evil.test/x"}])
    assert alerts.sync_env_rules(con, raw) == {"rules": 1}
    rows = con.execute("SELECT * FROM alert_rules").fetchall()
    assert len(rows) == 1 and rows[0]["webhook_url"].startswith("env:") and HOOK not in rows[0]["webhook_url"]
    con.execute("UPDATE alert_rules SET last_fired='2026-10-10'")
    alerts.sync_env_rules(con, raw)  # misma regla: se conserva (y su last_fired)
    assert con.execute("SELECT id, last_fired FROM alert_rules").fetchall()[0]["last_fired"] == "2026-10-10"
    sent = []
    ingest_snapshot(con, S, "2026-10-11", [_row(1, 0, 0, 10, 1, 111), _row(2, 5, 5, 10, 1, 80)])  # conquista
    alerts.evaluate(con, S, "2026-10-11", sender=lambda url, p: sent.append(alerts.ENV_WEBHOOKS[url]) or True)
    assert sent == [HOOK]
    alerts.sync_env_rules(con, "[]")
    assert con.execute("SELECT COUNT(*) FROM alert_rules").fetchone()[0] == 0


def test_redact_webhooks(con):
    con.execute("INSERT INTO alert_rules(server_id, kind, params, webhook_url) VALUES (?,?,?,?)",
                (S, "area_conquest", "{}", HOOK))
    alerts.redact_webhooks(con)
    assert con.execute("SELECT webhook_url FROM alert_rules").fetchone()[0] == "redacted"
