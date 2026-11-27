import gzip
import json

import pytest

from atalaya import alerts, analytics, geo, mapsql
from atalaya.db import connect
from atalaya.discovery import infer_from_host, parse_lobby_calendar, parse_status_page
from atalaya.ingest import ingest_snapshot, upsert_server

LINE16 = ("INSERT INTO `x_world` VALUES (40001,-1,100,3,21543,'O\\'Brien''s, (aldea)',805,'Pé;pe',12,"
          "'~SPQR~',345,NULL,TRUE,NULL,NULL,NULL);")
LINE11 = "INSERT INTO `x_world` VALUES (1,-200,200,1,9,'Old',5,'Ana',0,'',77);"


def test_parser_16_columns_and_escapes():
    (r,) = mapsql.parse(LINE16)
    assert (r.x, r.y, r.tid, r.vid, r.uid, r.aid, r.population) == (-1, 100, 3, 21543, 805, 12, 345)
    assert r.village == "O'Brien's, (aldea)"
    assert r.player == "Pé;pe" and r.alliance == "~SPQR~"
    assert r.is_capital is True and r.region is None


def test_parser_legacy_and_gzip_and_multi_tuple():
    data = gzip.compress((LINE11 + "\n" + LINE16).encode())
    rows = mapsql.parse(data)
    assert len(rows) == 2 and rows[0].is_capital is False
    multi = "INSERT INTO `x_world` VALUES (1,0,0,1,1,'a',2,'b',0,'',5),(2,1,1,2,2,'c',3,'d',0,'',6);"
    assert [r.vid for r in mapsql.parse(multi)] == [1, 2]


def test_dump_roundtrip():
    rows = mapsql.parse(LINE16)
    assert mapsql.parse(mapsql.dump(rows)) == rows


def test_torus_distance_and_travel():
    assert geo.distance(-200, 0, 200, 0, 200) == 1  # los bordes se tocan
    assert geo.distance(-200, 0, 200, 0, 200, wrap=False) == 400  # mundo sin travelOverTheWorldEdge
    assert geo.wraps({"features": ["vacation", "travelOverTheWorldEdge"]}) is True
    assert geo.wraps({"features": ["vacation"]}) is False
    assert geo.wraps(None) is True
    assert geo.distance(0, 0, 3, 4) == 5
    t_plain = geo.travel_seconds(40, 6)
    t_ts = geo.travel_seconds(40, 6, ts_level=10)
    assert t_plain == pytest.approx(40 / 6 * 3600)
    assert t_ts == pytest.approx((20 / 6 + 20 / (6 * 3)) * 3600)


def test_inactivity_model():
    hist = [("2026-10-01", 100, 1), ("2026-10-02", 150, 1), ("2026-10-03", 150, 1),
            ("2026-10-04", 150, 1), ("2026-10-05", 150, 1), ("2026-10-06", 140, 1)]
    m = analytics.player_inactivity(hist, "2026-09-20")
    assert m["status"] == "inactive" and m["streak"] == 4 and not m["bounded"]
    assert "attacked" in m["flags"] and m["confidence"] >= 80
    active = analytics.player_inactivity(hist[:2], "2026-09-20")
    assert active["status"] == "active" and active["confidence"] == 0
    new = analytics.player_inactivity([("2026-10-05", 5, 1), ("2026-10-06", 5, 1)], "2026-10-05")
    assert new["status"] == "new" and new["confidence"] <= 25


def _row(vid, x, y, uid, aid, pop, name="p"):
    return mapsql.VillageRow(vid, x, y, 1, vid, f"v{vid}", uid, f"{name}{uid}", aid, f"A{aid}" if aid else "", pop)


@pytest.fixture
def con():
    c = connect(":memory:")
    upsert_server(c, "ts1.x1.test.travian.com", name="Test", speed=1, status="active")
    return c


def test_ingest_events(con):
    s = "ts1.x1.test.travian.com"
    ingest_snapshot(con, s, "2026-10-01", [_row(1, 0, 0, 10, 1, 100), _row(2, 5, 5, 20, 2, 80), _row(3, 9, 9, 30, 0, 50)])
    res = ingest_snapshot(con, s, "2026-10-02", [
        _row(1, 0, 0, 10, 1, 120),          # crece
        _row(2, 5, 5, 10, 1, 70),           # conquistada por 10
        _row(4, 1, 1, 10, 1, 3),            # fundada por 10
        _row(5, 50, 50, 40, 2, 4),          # jugador nuevo
    ])
    ev = res["events"]
    assert ev["conquered"] == 1 and ev["founded"] == 1 and ev["player_new"] == 1
    assert ev["destroyed"] == 1  # aldea 3 desaparece
    assert ev["player_gone"] == 2  # 20 (sin aldeas) y 30
    # reingesta idempotente
    res2 = ingest_snapshot(con, s, "2026-10-02", [_row(1, 0, 0, 10, 1, 120)])
    assert con.execute("SELECT COUNT(*) FROM villages WHERE day='2026-10-02'").fetchone()[0] == 1
    assert res2["previous"] == "2026-10-01"


def test_world_export_shape(con):
    s = "ts1.x1.test.travian.com"
    for i, d in enumerate([f"2026-10-0{k}" for k in range(1, 8)]):
        ingest_snapshot(con, s, d, [_row(1, 0, 0, 10, 1, 100 + i * 10), _row(2, 5, 5, 20, 1, 80)])
    w = analytics.world_export(con, s)
    assert w["days"][-1] == "2026-10-07"
    players = {p[0]: dict(zip(w["schema"]["players"], p)) for p in w["players"]}
    assert players[10]["status"] == "active"
    assert players[20]["status"] == "inactive" and players[20]["bounded"] == 1
    v = {x[0]: dict(zip(w["schema"]["villages"], x)) for x in w["villages"]}
    assert v[1]["d1"] == 10 and v[1]["d3"] == 30


def test_alerts_area_conquest(con):
    s = "ts1.x1.test.travian.com"
    ingest_snapshot(con, s, "2026-10-01", [_row(1, 0, 0, 10, 1, 100), _row(2, 5, 5, 20, 2, 80)])
    con.execute("INSERT INTO alert_rules(server_id, kind, params, webhook_url) VALUES (?,?,?,?)",
                (s, "area_conquest", json.dumps({"x": 0, "y": 0, "radius": 10}), "https://discord.com/api/webhooks/1/x"))
    ingest_snapshot(con, s, "2026-10-02", [_row(1, 0, 0, 10, 1, 100), _row(2, 5, 5, 10, 1, 80)])
    sent = []
    fired = alerts.evaluate(con, s, "2026-10-02", sender=lambda url, payload: sent.append(payload) or True)
    assert len(fired) == 1 and "conquistada" in fired[0]["lines"][0]
    assert sent[0]["embeds"][0]["footer"]["text"] == s


def test_discovery_parsers():
    html = ('<html><script id="__GW_DATA__" type="application/json">{"items":{"a":{"id":1,"name":"Europe 3",'
            '"state":1,"url":"https://ts3.x2.europe.travian.com/"},"b":{"id":2,"name":"x","url":"https://evil.com"}}}'
            '</script></html>')
    ws = parse_status_page(html)
    assert [(w.host, w.speed, w.region) for w in ws] == [("ts3.x2.europe.travian.com", 2, "europe")]
    cal = parse_lobby_calendar([{"url": "https://ts3.x2.europe.travian.com", "start": 1700000000,
                                 "metadata": {"speed": 2, "type": "special"}, "flags": {"isActive": True}}])
    assert cal["ts3.x2.europe.travian.com"]["kind"] == "special"
    assert infer_from_host("rof.x3.international.travian.com") == (3, "international")


def test_api(tmp_path):
    from fastapi.testclient import TestClient
    from atalaya.api import create_app
    from atalaya.cli import seed_demo
    db = tmp_path / "t.db"
    c = connect(db)
    import atalaya.synthetic as syn
    syn.DEMO_WORLDS[:] = [syn.DEMO_WORLDS[-1]]
    seed_demo(c, history=6)
    client = TestClient(create_app(db))
    servers = client.get("/api/servers").json()
    assert servers and servers[0]["players"] > 50
    sid = servers[0]["id"]
    w = client.get(f"/api/servers/{sid}/world").json()
    assert len(w["villages"]) == servers[0]["villages"]
    assert client.get(f"/api/servers/{sid}/events").status_code == 200
    trend = servers[0]["trend"]
    assert len(trend["days"]) == 6 and trend["days"][-1] == servers[0]["day"]
    assert trend["players"][-1] == servers[0]["players"]
    assert trend["population"][-1] == servers[0]["population"]
    assert all(len(trend[k]) == 6 for k in ("villages", "alliances", "conquered", "destroyed", "founded"))
    bad = client.post("/api/alerts", json={"server_id": sid, "kind": "area_conquest", "params": {},
                                           "webhook_url": "http://127.0.0.1/hook"})
    assert bad.status_code == 422
    ok = client.post("/api/alerts", json={"server_id": sid, "kind": "area_conquest", "params": {"x": 0, "y": 0},
                                          "webhook_url": "https://discord.com/api/webhooks/123/abc-DEF"})
    assert ok.status_code == 201


# --- datos reales (formatos comprobados contra Travian en noviembre de 2026) ---------

def test_lobby_calendar_real_format():
    cal = parse_lobby_calendar([
        {"name": "international30", "domain": "international", "start": 1793203200,
         "metadata": {"name": "International 30", "type": "normal", "speed": 3,
                      "url": "https://ts30.x3.international.travian.com/"}},
        {"name": "europe0", "domain": "europe", "start": 1797865200,       # anunciado sin dominio
         "metadata": {"name": "", "type": "normal", "speed": 1}},
        {"name": "x", "metadata": {"url": "https://evil.example.com/"}},
    ])
    assert list(cal) == ["ts30.x3.international.travian.com"]  # 'domain' es la región, no el host
    info = cal["ts30.x3.international.travian.com"]
    assert info["name"] == "International 30" and info["speed"] == 3 and info["region"] == "international"


def test_status_page_names_and_regions():
    html = ('<script id="__GW_DATA__" type="application/json">{"items":{'
            '"europe3":{"id":"a","name":"europe3","state":1,"url":"https://ts3.x1.europe.travian.com/"},'
            '"europe39":{"id":"b","name":"europe39","state":1,"url":"https://alpha.travian.com/"},'
            '"de20":{"id":"c","name":"de20","state":1,"url":"https://wimpel.x2.germany.travian.com/"}}}</script>')
    ws = {w.host: w for w in parse_status_page(html)}
    assert ws["ts3.x1.europe.travian.com"].name == "Europe 3"
    assert (ws["alpha.travian.com"].region, ws["alpha.travian.com"].speed) == ("europe", None)
    assert (ws["wimpel.x2.germany.travian.com"].name, ws["wimpel.x2.germany.travian.com"].speed) == ("DE 20", 2)


def test_world_info():
    from atalaya.discovery import parse_world_info
    now = 1793553224  # 2026-11-01 15:53 UTC
    info = parse_world_info({"ageInDays": 4, "speed": 3, "mapSize": {"width": 401, "height": 401}}, now=now)
    assert info == {"start_ts": 1793145600, "speed": 3, "map_radius": 200}  # 2026-10-28 00:00 UTC
    assert parse_world_info("nope") == {}


def test_user_agent_is_ascii():
    from atalaya.config import Settings, _ascii
    assert _ascii("map.sql público, 1 descarga/día") == "map.sql publico, 1 descarga/dia"
    Settings().user_agent.encode("ascii")  # httpx rechaza cabeceras no ASCII


def _discovered(host, source="status", **kw):
    from atalaya.discovery import World
    return World(host=host, name=host, region="europe", speed=1, source=source, **kw)


def test_sync_only_ends_worlds_of_sources_that_answered(con):
    from atalaya.collector import sync_servers
    sync_servers(con, [_discovered("ts3.x1.europe.travian.com"), _discovered("ts1.x1.europe.travian.com", "lobby")],
                 {"status", "lobby"})
    # status.travian.com falla: solo responde el lobby y ya no anuncia ts1
    sync_servers(con, [], {"lobby"})
    st = dict(con.execute("SELECT id, status FROM servers").fetchall())
    assert st["ts3.x1.europe.travian.com"] == "active"
    assert st["ts1.x1.europe.travian.com"] == "ended"


def test_collector_store_real_responses(con):
    from atalaya.collector import _due, _store
    from atalaya.config import Settings
    s, settings = "ts1.x1.test.travian.com", Settings()
    body = (LINE16 + "\n").encode()
    # mundo anunciado: 200 con cuerpo vacío -> no es un fallo ni una instantánea
    assert _store(con, settings, s, 200, b"", {}) is None
    assert con.execute("SELECT fail_count FROM servers WHERE id=?", (s,)).fetchone()[0] == 0
    res = _store(con, settings, s, 200, body, {})
    assert res and res["villages"] == 1
    # mismo contenido otra vez (map.sql aún no regenerado) -> no crea un día nuevo
    con.execute("UPDATE servers SET last_day='2000-01-01' WHERE id=?", (s,))
    assert _store(con, settings, s, 200, body, {}) is None
    assert con.execute("SELECT COUNT(*) FROM snapshots WHERE server_id=?", (s,)).fetchone()[0] == 1
    # los mundos que aún no han empezado no se descargan
    upsert_server(con, "ts9.x1.test.travian.com", status="upcoming", start_ts=2_000_000_000)
    row = con.execute("SELECT * FROM servers WHERE id='ts9.x1.test.travian.com'").fetchone()
    assert not _due(row, "2026-11-01", 1_793_553_224)


def test_world_export_without_data_has_schema(con):
    w = analytics.world_export(con, "ts1.x1.test.travian.com")
    assert w["days"] == [] and w["schema"]["players"][0] == "uid"


def test_first_download_does_not_mark_everyone_new():
    # jugador que ya estaba en la primera descarga de un mundo de 31 días
    one = analytics.player_inactivity([("2026-11-01", 34893, 32)], "2026-11-01", speed=3,
                                      observed_since="2026-11-01", world_age=30)
    assert "new" not in one["flags"] and one["status"] == "unknown"
    # mundo recién abierto: sí puede estar en protección
    young = analytics.player_inactivity([("2026-11-01", 5, 1)], "2026-11-01", speed=1,
                                        observed_since="2026-11-01", world_age=1)
    assert young["status"] == "new"
    # cuenta que aparece después de empezar a observar
    later = analytics.player_inactivity([("2026-11-02", 5, 1), ("2026-11-03", 5, 1)], "2026-11-02", speed=1,
                                        observed_since="2026-11-01", world_age=40)
    assert "new" in later["flags"]


def test_world_calendar(tmp_path):
    """Calendario del mundo: fechas de artefactos y planos, tribus y reglas de /api/v1/info."""
    import json

    from atalaya import analytics
    from atalaya.db import connect
    from atalaya.discovery import parse_world_calendar
    from atalaya.ingest import upsert_server
    now = 1793491200  # 2026-11-01 00:00 UTC
    payload = {"ageInDays": 12, "playersCount": 13880, "artefactsDate": 1801666800, "constructionPlansDate": 1809442800,
               "wwLevel": 0, "tribeIds": [1, 2, 3, 6, 7, 4, 5],
               "serverSupportedFeatures": {"vacation": {"enabled": True}, "cities": False, "allianceBonus": True,
                                           "mergingTroops": {"enabled": False}, "contextHelp": True}}
    cal = parse_world_calendar(payload, now=now)
    assert cal == {"day": "2026-11-01", "players": 13880, "artefacts": 1801666800, "plans": 1809442800, "wwLevel": 0,
                   "tribes": [1, 2, 3, 6, 7, 4, 5], "features": ["vacation", "allianceBonus"]}
    assert parse_world_calendar({"speed": 1}) is None and parse_world_calendar("nope") is None
    # Una base creada sin la columna ``info`` se migra al abrirla, y el resumen la devuelve ya interpretada.
    import sqlite3
    path = tmp_path / "old.db"
    old = sqlite3.connect(path)
    old.execute("CREATE TABLE servers (id TEXT PRIMARY KEY, name TEXT, region TEXT, speed INTEGER, kind TEXT, start_ts INTEGER,"
                " end_ts INTEGER, status TEXT, map_radius INTEGER, source TEXT, first_seen TEXT, last_seen TEXT,"
                " last_fetch TEXT, last_day TEXT, etag TEXT, last_modified TEXT, fail_count INTEGER DEFAULT 0)")
    old.execute("INSERT INTO servers(id) VALUES ('ts1.x1.europe.travian.com')")
    old.commit()
    old.close()
    con = connect(path)
    row = con.execute("SELECT * FROM servers").fetchone()
    assert analytics.server_summary(con, row)["info"] is None
    upsert_server(con, "ts1.x1.europe.travian.com", info=json.dumps(cal))
    row = con.execute("SELECT * FROM servers").fetchone()
    assert analytics.server_summary(con, row)["info"]["artefacts"] == 1801666800


def test_collector_refreshes_calendar_daily():
    """El recolector pide /api/v1/info una vez al día aunque ya conozca la fecha de inicio."""
    import json

    import httpx

    from atalaya import collector
    from atalaya.db import connect
    from atalaya.ingest import upsert_server
    con = connect(":memory:")
    upsert_server(con, "ts1.x1.europe.travian.com", start_ts=1793145600, speed=1)
    calls = []

    def handler(req: httpx.Request) -> httpx.Response:
        calls.append(req.url.path)
        if req.url.path == "/api/v1/info":
            return httpx.Response(200, json={"ageInDays": 99, "artefactsDate": 1801666800, "tribeIds": [1, 2, 3]})
        return httpx.Response(200, content=b"")

    client = httpx.Client(transport=httpx.MockTransport(handler))
    row = con.execute("SELECT * FROM servers").fetchone()
    host, code, body, headers, info = collector._fetch(client, row, 0)
    assert "/api/v1/info" in calls and "start_ts" not in info  # la fecha de inicio conocida no se pisa
    upsert_server(con, host, **info)
    row = con.execute("SELECT * FROM servers").fetchone()
    assert json.loads(row["info"])["artefacts"] == 1801666800 and row["start_ts"] == 1793145600
    calls.clear()
    collector._fetch(client, row, 0)
    assert "/api/v1/info" not in calls  # ya se leyó hoy
