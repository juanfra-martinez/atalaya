"""Ingesta de una instantánea diaria y detección de eventos por diferencia."""
from __future__ import annotations

import hashlib
import sqlite3
from collections import defaultdict
from datetime import datetime, timezone

from .mapsql import VillageRow, detect_radius


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def upsert_server(con: sqlite3.Connection, host: str, **fields) -> None:
    today = datetime.now(timezone.utc).date().isoformat()
    con.execute(
        "INSERT INTO servers(id, first_seen, last_seen) VALUES (?, ?, ?) "
        "ON CONFLICT(id) DO UPDATE SET last_seen=excluded.last_seen",
        (host, fields.pop("first_seen", today), fields.pop("last_seen", today)),
    )
    fields = {k: v for k, v in fields.items() if v is not None}
    if fields:
        sets = ", ".join(f"{k}=?" for k in fields)
        con.execute(f"UPDATE servers SET {sets} WHERE id=?", (*fields.values(), host))


def previous_day(con: sqlite3.Connection, server: str, day: str) -> str | None:
    r = con.execute(
        "SELECT MAX(day) FROM snapshots WHERE server_id=? AND day<?", (server, day)
    ).fetchone()
    return r[0] if r else None


def ingest_snapshot(
    con: sqlite3.Connection,
    server: str,
    day: str,
    rows: list[VillageRow],
    raw: bytes | None = None,
    retention_days: int | None = None,
) -> dict:
    """Guarda la instantánea ``day`` de ``server`` y genera eventos frente a la anterior.

    Es idempotente: reingestar el mismo día reemplaza los datos de ese día.
    """
    sha = hashlib.sha256(raw).hexdigest() if raw else None
    with con:
        for t in ("villages", "player_days", "alliance_days", "events", "snapshots"):
            con.execute(f"DELETE FROM {t} WHERE server_id=? AND day=?", (server, day))

        # --- aldeas ---------------------------------------------------------
        con.executemany(
            "INSERT OR REPLACE INTO villages(server_id, day, vid, x, y, tid, name, uid, aid, pop, capital, region, vp)"
            " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
            [
                (server, day, r.vid, r.x, r.y, r.tid, r.village, r.uid, r.aid, r.population,
                 1 if r.is_capital else 0, r.region, r.victory_points)
                for r in rows
            ],
        )

        # --- agregados por jugador y alianza --------------------------------
        p_pop: dict[int, int] = defaultdict(int)
        p_vil: dict[int, int] = defaultdict(int)
        p_info: dict[int, tuple[str, int, int]] = {}
        a_pop: dict[int, int] = defaultdict(int)
        a_vil: dict[int, int] = defaultdict(int)
        a_mem: dict[int, set] = defaultdict(set)
        a_tag: dict[int, str] = {}
        for r in rows:
            if r.uid <= 0:
                continue
            p_pop[r.uid] += r.population
            p_vil[r.uid] += 1
            p_info[r.uid] = (r.player, r.tid, r.aid)
            if r.aid > 0:
                a_pop[r.aid] += r.population
                a_vil[r.aid] += 1
                a_mem[r.aid].add(r.uid)
                a_tag[r.aid] = r.alliance
        con.executemany(
            "INSERT INTO player_days(server_id, day, uid, aid, pop, villages) VALUES (?,?,?,?,?,?)",
            [(server, day, uid, p_info[uid][2], p_pop[uid], p_vil[uid]) for uid in p_pop],
        )
        con.executemany(
            "INSERT INTO alliance_days(server_id, day, aid, pop, members, villages) VALUES (?,?,?,?,?,?)",
            [(server, day, aid, a_pop[aid], len(a_mem[aid]), a_vil[aid]) for aid in a_pop],
        )

        # --- eventos ---------------------------------------------------------
        prev = previous_day(con, server, day)
        events: list[tuple] = []
        prev_players: dict[int, sqlite3.Row] = {}
        if prev:
            prev_v = {
                r["vid"]: r
                for r in con.execute(
                    "SELECT vid, x, y, uid, aid, pop FROM villages WHERE server_id=? AND day=?", (server, prev)
                )
            }
            prev_players = {
                r["uid"]: r
                for r in con.execute(
                    "SELECT pd.uid, pd.aid, p.name FROM player_days pd LEFT JOIN players p "
                    "ON p.server_id=pd.server_id AND p.uid=pd.uid WHERE pd.server_id=? AND pd.day=?",
                    (server, prev),
                )
            }
            prev_alliances = {
                r[0] for r in con.execute(
                    "SELECT aid FROM alliance_days WHERE server_id=? AND day=?", (server, prev)
                )
            }
            cur_vids = set()
            for r in rows:
                cur_vids.add(r.vid)
                pv = prev_v.get(r.vid)
                if pv is None:
                    if r.uid > 0 and r.uid in prev_players:
                        events.append((server, day, "founded", r.vid, r.x, r.y, r.population, r.uid, None, r.aid, None, r.village))
                elif pv["uid"] != r.uid and r.uid > 0 and pv["uid"] > 0:
                    events.append((server, day, "conquered", r.vid, r.x, r.y, r.population, r.uid, pv["uid"], r.aid, pv["aid"], r.village))
            if prev_v:
                for vid, pv in prev_v.items():
                    if vid not in cur_vids and pv["uid"] > 0:
                        events.append((server, day, "destroyed", vid, pv["x"], pv["y"], pv["pop"], pv["uid"], None, pv["aid"], None, None))
            for uid, (name, _tid, aid) in p_info.items():
                pp = prev_players.get(uid)
                if pp is None:
                    events.append((server, day, "player_new", None, None, None, p_pop[uid], uid, None, aid, None, name))
                    continue
                if pp["name"] and pp["name"] != name:
                    events.append((server, day, "player_renamed", None, None, None, None, uid, None, aid, None, f"{pp['name']} → {name}"))
                if (pp["aid"] or 0) != aid:
                    kind = "alliance_join" if not pp["aid"] else ("alliance_leave" if not aid else "alliance_switch")
                    events.append((server, day, kind, None, None, None, p_pop[uid], uid, None, aid, pp["aid"], None))
            for uid, pp in prev_players.items():
                if uid not in p_info:
                    events.append((server, day, "player_gone", None, None, None, None, uid, None, pp["aid"], None, pp["name"]))
            for aid in a_pop:
                if aid not in prev_alliances:
                    events.append((server, day, "alliance_new", None, None, None, a_pop[aid], None, None, aid, None, a_tag.get(aid)))
            for aid in prev_alliances - set(a_pop):
                events.append((server, day, "alliance_gone", None, None, None, None, None, None, aid, None, None))
        con.executemany(
            "INSERT INTO events(server_id, day, type, vid, x, y, pop, uid, uid_prev, aid, aid_prev, detail)"
            " VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
            events,
        )

        # --- maestros (nombres actuales) -------------------------------------
        con.executemany(
            "INSERT INTO players(server_id, uid, name, tid, first_seen, last_seen) VALUES (?,?,?,?,?,?) "
            "ON CONFLICT(server_id, uid) DO UPDATE SET name=excluded.name, tid=excluded.tid, "
            "last_seen=MAX(players.last_seen, excluded.last_seen), first_seen=MIN(players.first_seen, excluded.first_seen)",
            [(server, uid, n, t, day, day) for uid, (n, t, _a) in p_info.items()],
        )
        con.executemany(
            "INSERT INTO alliances(server_id, aid, tag, first_seen, last_seen) VALUES (?,?,?,?,?) "
            "ON CONFLICT(server_id, aid) DO UPDATE SET tag=excluded.tag, "
            "last_seen=MAX(alliances.last_seen, excluded.last_seen), first_seen=MIN(alliances.first_seen, excluded.first_seen)",
            [(server, aid, tag, day, day) for aid, tag in a_tag.items()],
        )
        con.execute(
            "INSERT INTO snapshots(server_id, day, fetched_at, villages, players, alliances, population, sha256)"
            " VALUES (?,?,?,?,?,?,?,?)",
            (server, day, _now(), len(rows), len(p_pop), len(a_pop), sum(p_pop.values()), sha),
        )
        upsert_server(con, server, last_day=day, map_radius=detect_radius(rows) if rows else None)

        # --- retención --------------------------------------------------------
        if retention_days:
            days = [r[0] for r in con.execute(
                "SELECT day FROM snapshots WHERE server_id=? ORDER BY day DESC", (server,))]
            if len(days) > retention_days:
                cutoff = days[retention_days - 1]
                con.execute("DELETE FROM villages WHERE server_id=? AND day<?", (server, cutoff))

    counts: dict[str, int] = defaultdict(int)
    for e in events:
        counts[e[2]] += 1
    return {"server": server, "day": day, "villages": len(rows), "players": len(p_pop),
            "alliances": len(a_pop), "events": dict(counts), "previous": prev}
