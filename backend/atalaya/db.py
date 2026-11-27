"""Esquema y acceso a la base de datos (SQLite, modo WAL)."""
from __future__ import annotations

import sqlite3
from pathlib import Path

SCHEMA = """
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS servers (
    id            TEXT PRIMARY KEY,          -- host, p.ej. ts3.x1.europe.travian.com
    name          TEXT,
    region        TEXT,
    speed         INTEGER DEFAULT 1,
    kind          TEXT DEFAULT 'regular',    -- regular | special | tournament | annual
    start_ts      INTEGER,
    end_ts        INTEGER,
    status        TEXT DEFAULT 'active',     -- active | upcoming | ended
    map_radius    INTEGER DEFAULT 200,
    source        TEXT,                      -- status | lobby | manual | synthetic
    first_seen    TEXT,
    last_seen     TEXT,
    last_fetch    TEXT,
    last_day      TEXT,
    etag          TEXT,
    last_modified TEXT,
    fail_count    INTEGER DEFAULT 0,
    info          TEXT                       -- JSON: calendario y reglas del mundo (/api/v1/info)
);

CREATE TABLE IF NOT EXISTS snapshots (
    server_id  TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    day        TEXT NOT NULL,                -- YYYY-MM-DD
    fetched_at TEXT NOT NULL,
    villages   INTEGER, players INTEGER, alliances INTEGER, population INTEGER,
    sha256     TEXT,
    PRIMARY KEY (server_id, day)
);

CREATE TABLE IF NOT EXISTS villages (
    server_id TEXT NOT NULL, day TEXT NOT NULL, vid INTEGER NOT NULL,
    x INTEGER, y INTEGER, tid INTEGER, name TEXT, uid INTEGER, aid INTEGER,
    pop INTEGER, capital INTEGER, region TEXT, vp INTEGER,
    PRIMARY KEY (server_id, day, vid)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS ix_villages_uid ON villages(server_id, uid, day);

CREATE TABLE IF NOT EXISTS players (
    server_id TEXT NOT NULL, uid INTEGER NOT NULL,
    name TEXT, tid INTEGER, first_seen TEXT, last_seen TEXT,
    PRIMARY KEY (server_id, uid)
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS player_days (
    server_id TEXT NOT NULL, day TEXT NOT NULL, uid INTEGER NOT NULL,
    aid INTEGER, pop INTEGER, villages INTEGER,
    PRIMARY KEY (server_id, uid, day)
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS alliances (
    server_id TEXT NOT NULL, aid INTEGER NOT NULL,
    tag TEXT, first_seen TEXT, last_seen TEXT,
    PRIMARY KEY (server_id, aid)
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS alliance_days (
    server_id TEXT NOT NULL, day TEXT NOT NULL, aid INTEGER NOT NULL,
    pop INTEGER, members INTEGER, villages INTEGER,
    PRIMARY KEY (server_id, aid, day)
) WITHOUT ROWID;

-- Eventos derivados de comparar dos instantáneas consecutivas
CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id TEXT NOT NULL, day TEXT NOT NULL,
    type TEXT NOT NULL,     -- founded | conquered | destroyed | player_new | player_gone
                            -- | player_renamed | alliance_join | alliance_leave | alliance_switch
                            -- | alliance_new | alliance_gone
    vid INTEGER, x INTEGER, y INTEGER, pop INTEGER,
    uid INTEGER, uid_prev INTEGER, aid INTEGER, aid_prev INTEGER,
    detail TEXT
);
CREATE INDEX IF NOT EXISTS ix_events_server_day ON events(server_id, day);
CREATE INDEX IF NOT EXISTS ix_events_uid ON events(server_id, uid);

-- Reglas de alerta (Discord webhooks)
CREATE TABLE IF NOT EXISTS alert_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id TEXT NOT NULL,
    kind TEXT NOT NULL,     -- player_inactive | area_conquest | area_new_village
                            -- | player_alliance_change | alliance_village_lost
    params TEXT NOT NULL,   -- JSON
    webhook_url TEXT NOT NULL,
    label TEXT,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    last_fired TEXT
);
CREATE TABLE IF NOT EXISTS alert_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_id INTEGER NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
    day TEXT, message TEXT, ok INTEGER, sent_at TEXT DEFAULT (datetime('now'))
);
"""


def connect(path: Path | str) -> sqlite3.Connection:
    p = Path(path)
    if str(p) != ":memory:":
        p.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(str(p), check_same_thread=False, timeout=30)
    con.row_factory = sqlite3.Row
    con.executescript(SCHEMA)
    _migrate(con)
    return con


def _migrate(con: sqlite3.Connection) -> None:
    """Columnas añadidas después de la primera versión: las bases ya creadas no las tienen."""
    cols = {r[1] for r in con.execute("PRAGMA table_info(servers)")}
    if "info" not in cols:
        con.execute("ALTER TABLE servers ADD COLUMN info TEXT")
        con.commit()
