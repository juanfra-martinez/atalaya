"""Métricas derivadas: inactividad explicable, resúmenes de mundo y exportación compacta.

Modelo de inactividad
---------------------
En Travian la población solo sube cuando el jugador construye o amplía algo, así
que *cualquier* subida de población o de número de aldeas entre dos
instantáneas es una prueba de actividad. A partir del historial diario:

* ``streak``  días transcurridos desde la última subida observada.
* ``bounded`` True si nunca le vimos crecer en la ventana (la racha real puede ser mayor).
* ``flags``   ``new`` (cuenta reciente, quizá con protección de principiante),
  ``attacked`` (pierde población sin perder aldeas: le están catapulteando),
  ``lost_village`` (ha perdido aldeas), ``shrinking``.
* ``confidence`` 0-100: probabilidad heurística de que esté realmente inactivo.
  Se explica al usuario en la interfaz.
"""
from __future__ import annotations

import json
import math
import sqlite3
from collections import defaultdict
from datetime import date, datetime, timezone


def _d(s: str) -> date:
    return date.fromisoformat(s)


def _utc_day(ts: int) -> str:
    return datetime.fromtimestamp(ts, timezone.utc).date().isoformat()


def player_inactivity(hist: list[tuple[str, int, int]], first_seen: str, speed: int = 1,
                      observed_since: str | None = None, world_age: int | None = None) -> dict:
    """``hist``: [(day, pop, villages)] ordenado por día (puede tener huecos).

    ``observed_since`` es el primer día que Atalaya descargó el mundo y ``world_age`` los
    días que lleva abierto. Un jugador que ya estaba en la primera descarga no es "nuevo"
    por eso: su cuenta puede tener la edad del mundo, así que solo se marca como posible
    cuenta en protección si el propio mundo es reciente.
    """
    if not hist:
        return {"status": "unknown", "streak": 0, "bounded": False, "confidence": 0, "flags": []}
    last_day = _d(hist[-1][0])
    last_growth: date | None = None
    flags: set[str] = set()
    for i in range(1, len(hist)):
        d, pop, vil = hist[i]
        _, ppop, pvil = hist[i - 1]
        if pop > ppop or vil > pvil:
            last_growth = _d(d)
        if vil < pvil:
            flags.add("lost_village")
        elif pop < ppop and _d(d) > last_day.fromordinal(last_day.toordinal() - 4):
            flags.add("attacked")
    first_obs = _d(hist[0][0])
    if last_growth is None:
        streak = (last_day - first_obs).days
        bounded = True
    else:
        streak = (last_day - last_growth).days
        bounded = False
    age: int | None = (last_day - _d(first_seen)).days if first_seen else None
    if first_seen and observed_since and first_seen <= observed_since:
        age = world_age  # ya existía cuando empezamos a observar: solo sabemos que age <= edad del mundo
    protection_days = max(1, round(5 / max(1, speed)))
    if age is not None and age < protection_days:
        flags.add("new")
    if len(hist) >= 2 and hist[-1][1] < hist[0][1]:
        flags.add("shrinking")

    if streak == 0:
        status, conf = "active", 0
    else:
        conf = 100 * (1 - math.exp(-streak / 2.5))
        if bounded and len(hist) < 3:
            conf *= 0.6  # casi sin historial
        if "new" in flags:
            conf = min(conf, 25)
        if "attacked" in flags:
            conf = min(100, conf + 5)  # alguien ya le farmea: no defiende
        status = "inactive" if streak >= 3 and "new" not in flags else "slowing"
        if "new" in flags and streak >= 1:
            status = "new"
    if status == "active" and "new" in flags:
        status = "new"
    if len(hist) < 2 and status == "active":
        status = "unknown"  # una sola instantánea: aún no se puede saber si crece
    growth = 0.0
    if len(hist) >= 2:
        span = max(1, (last_day - first_obs).days)
        growth = (hist[-1][1] - hist[0][1]) / span
    return {
        "status": status,
        "streak": streak,
        "bounded": bounded,
        "confidence": int(round(conf)),
        "flags": sorted(flags),
        "growth": round(growth, 1),
        "age": age,
    }


def history_days(con: sqlite3.Connection, server: str, n: int) -> list[str]:
    return [r[0] for r in con.execute(
        "SELECT day FROM snapshots WHERE server_id=? ORDER BY day DESC LIMIT ?", (server, n))][::-1]


def server_summary(con: sqlite3.Connection, server_row: sqlite3.Row) -> dict:
    sid = server_row["id"]
    snap = con.execute(
        "SELECT * FROM snapshots WHERE server_id=? ORDER BY day DESC LIMIT 1", (sid,)).fetchone()
    first = con.execute("SELECT MIN(day) FROM snapshots WHERE server_id=?", (sid,)).fetchone()[0]
    ev = {}
    if snap:
        ev = {r[0]: r[1] for r in con.execute(
            "SELECT type, COUNT(*) FROM events WHERE server_id=? AND day=? GROUP BY type", (sid, snap["day"]))}
    start_day = None
    if server_row["start_ts"]:
        start_day = _utc_day(server_row["start_ts"])
    age = None
    ref = start_day or first
    if snap and ref:
        age = (_d(snap["day"]) - _d(ref)).days + 1
    elif start_day and (server_row["status"] or "active") == "active":
        age = (datetime.now(timezone.utc).date() - _d(start_day)).days + 1
    return {
        "id": sid,
        "name": server_row["name"] or sid,
        "region": server_row["region"] or "",
        "speed": server_row["speed"] or 1,
        "kind": server_row["kind"] or "regular",
        "status": server_row["status"] or "active",
        "radius": server_row["map_radius"] or 200,
        "start": start_day or first,
        "end": _utc_day(server_row["end_ts"]) if server_row["end_ts"] else None,
        "age": age,
        "day": snap["day"] if snap else None,
        "fetchedAt": snap["fetched_at"] if snap else None,
        "lastCheck": server_row["last_fetch"],
        "players": snap["players"] if snap else 0,
        "villages": snap["villages"] if snap else 0,
        "alliances": snap["alliances"] if snap else 0,
        "population": snap["population"] if snap else 0,
        "eventsToday": ev,
        "info": _info(server_row),
    }


def _info(server_row: sqlite3.Row) -> dict | None:
    """Calendario y reglas del mundo guardados por el recolector (None si aún no se han leído)."""
    try:
        raw = server_row["info"]
    except (IndexError, KeyError):
        return None
    if not raw:
        return None
    try:
        return json.loads(raw)
    except ValueError:
        return None


TREND_EVENTS = ("conquered", "destroyed", "founded")


def server_trend(con: sqlite3.Connection, server: str, n_days: int = 21) -> dict:
    """Evolución reciente de un mundo, una posición por instantánea (pueden faltar días)."""
    days = history_days(con, server, n_days)
    out: dict = {"days": days}
    if not days:
        return {**out, **{k: [] for k in ("players", "villages", "alliances", "population", *TREND_EVENTS)}}
    snaps = {r["day"]: r for r in con.execute(
        "SELECT day, players, villages, alliances, population FROM snapshots WHERE server_id=? AND day>=?",
        (server, days[0]))}
    for key in ("players", "villages", "alliances", "population"):
        out[key] = [snaps[d][key] for d in days]
    counts = {(r[0], r[1]): r[2] for r in con.execute(
        "SELECT day, type, COUNT(*) FROM events WHERE server_id=? AND day>=? AND type IN (?,?,?) GROUP BY day, type",
        (server, days[0], *TREND_EVENTS))}
    for key in TREND_EVENTS:
        out[key] = [counts.get((d, key), 0) for d in days]
    return out


def server_overview(con: sqlite3.Connection, server_row: sqlite3.Row, n_days: int = 21) -> dict:
    """Resumen del mundo con su evolución: lo que necesita la vista de mundos activos."""
    return {**server_summary(con, server_row), "trend": server_trend(con, server_row["id"], n_days)}


WORLD_SCHEMA = {
    "players": ["uid", "name", "tid", "aid", "pop", "villages", "popHist", "status", "streak",
                "bounded", "confidence", "flags", "growth", "firstSeen"],
    "alliances": ["aid", "tag", "pop", "members", "villages", "popHist", "firstSeen"],
    "villages": ["vid", "x", "y", "uid", "name", "pop", "capital", "d1", "d3", "tid"],
}


def world_export(con: sqlite3.Connection, server: str, n_days: int = 21) -> dict:
    """Exporta el estado actual del mundo en formato compacto (arrays) para el frontend.

    El frontend hace los filtros (inactivos, mapa, búsquedas) en local: un mundo
    grande ocupa ~1-3 MB comprimible y la experiencia es instantánea.
    """
    srow = con.execute("SELECT * FROM servers WHERE id=?", (server,)).fetchone()
    if srow is None:
        raise KeyError(server)
    days = history_days(con, server, n_days)
    if not days:
        return {"server": server_summary(con, srow), "days": [], "schema": WORLD_SCHEMA,
                "players": [], "alliances": [], "villages": []}
    last = days[-1]
    di = {d: i for i, d in enumerate(days)}
    nd = len(days)

    # historial por jugador
    ph_pop: dict[int, list] = defaultdict(lambda: [None] * nd)
    ph_vil: dict[int, list] = defaultdict(lambda: [None] * nd)
    for r in con.execute(
        "SELECT uid, day, pop, villages FROM player_days WHERE server_id=? AND day>=?", (server, days[0])
    ):
        i = di.get(r["day"])
        if i is not None:
            ph_pop[r["uid"]][i] = r["pop"]
            ph_vil[r["uid"]][i] = r["villages"]

    cur = {r["uid"]: r for r in con.execute(
        "SELECT pd.uid, pd.aid, pd.pop, pd.villages, p.name, p.tid, p.first_seen FROM player_days pd "
        "JOIN players p ON p.server_id=pd.server_id AND p.uid=pd.uid WHERE pd.server_id=? AND pd.day=?",
        (server, last))}
    speed = srow["speed"] or 1
    observed_since = con.execute("SELECT MIN(day) FROM snapshots WHERE server_id=?", (server,)).fetchone()[0]
    world_age = (_d(last) - _d(_utc_day(srow["start_ts"]))).days if srow["start_ts"] else None
    players = []
    for uid, r in cur.items():
        pops, vils = ph_pop[uid], ph_vil[uid]
        hist = [(days[i], pops[i], vils[i]) for i in range(nd) if pops[i] is not None]
        m = player_inactivity(hist, r["first_seen"], speed, observed_since, world_age)
        if r["tid"] == 5 or uid == 1:  # Natares: no son jugadores
            m = {**m, "status": "natar", "confidence": 0, "streak": 0}
        players.append([
            uid, r["name"], r["tid"], r["aid"] or 0, r["pop"], r["villages"],
            pops, m["status"], m["streak"], 1 if m["bounded"] else 0, m["confidence"],
            m["flags"], m["growth"], r["first_seen"],
        ])
    players.sort(key=lambda p: -p[4])

    ah: dict[int, list] = defaultdict(lambda: [None] * nd)
    for r in con.execute(
        "SELECT aid, day, pop FROM alliance_days WHERE server_id=? AND day>=?", (server, days[0])
    ):
        i = di.get(r["day"])
        if i is not None:
            ah[r["aid"]][i] = r["pop"]
    alliances = []
    for r in con.execute(
        "SELECT ad.aid, ad.pop, ad.members, ad.villages, a.tag, a.first_seen FROM alliance_days ad "
        "JOIN alliances a ON a.server_id=ad.server_id AND a.aid=ad.aid WHERE ad.server_id=? AND ad.day=?",
        (server, last),
    ):
        alliances.append([r["aid"], r["tag"], r["pop"], r["members"], r["villages"], ah[r["aid"]], r["first_seen"]])
    alliances.sort(key=lambda a: -a[2])

    # aldeas: delta de población a 1 y 3 días
    ref1 = days[-2] if nd >= 2 else None
    ref3 = days[-4] if nd >= 4 else (days[0] if nd >= 2 else None)
    prev1 = dict(con.execute("SELECT vid, pop FROM villages WHERE server_id=? AND day=?", (server, ref1)).fetchall()) if ref1 else {}
    prev3 = dict(con.execute("SELECT vid, pop FROM villages WHERE server_id=? AND day=?", (server, ref3)).fetchall()) if ref3 else {}
    villages = []
    for r in con.execute(
        "SELECT vid, x, y, tid, name, uid, aid, pop, capital, region, vp FROM villages WHERE server_id=? AND day=?",
        (server, last),
    ):
        p1 = prev1.get(r["vid"])
        p3 = prev3.get(r["vid"])
        villages.append([
            r["vid"], r["x"], r["y"], r["uid"], r["name"], r["pop"], r["capital"],
            None if p1 is None else r["pop"] - p1, None if p3 is None else r["pop"] - p3, r["tid"],
        ])

    return {
        "server": server_summary(con, srow),
        "days": days,
        "schema": WORLD_SCHEMA,
        "players": players,
        "alliances": alliances,
        "villages": villages,
    }


def events_export(con: sqlite3.Connection, server: str, days: int = 14, limit: int = 5000) -> list[dict]:
    last = con.execute("SELECT MAX(day) FROM snapshots WHERE server_id=?", (server,)).fetchone()[0]
    if not last:
        return []
    since = date.fromordinal(_d(last).toordinal() - days + 1).isoformat()
    names = {r[0]: r[1] for r in con.execute("SELECT uid, name FROM players WHERE server_id=?", (server,))}
    order = ("CASE type WHEN 'conquered' THEN 0 WHEN 'destroyed' THEN 1 WHEN 'founded' THEN 2 "
             "WHEN 'alliance_switch' THEN 3 WHEN 'alliance_join' THEN 4 WHEN 'alliance_leave' THEN 4 ELSE 5 END")
    out = []
    for r in con.execute(
        f"SELECT * FROM events WHERE server_id=? AND day>=? AND type NOT IN ('player_new') "
        f"ORDER BY day DESC, {order}, pop DESC, id DESC LIMIT ?", (server, since, limit)
    ):
        e = {k: r[k] for k in ("day", "type", "vid", "x", "y", "pop", "uid", "uid_prev", "aid", "aid_prev", "detail")}
        e["name"] = names.get(r["uid"])
        e["name_prev"] = names.get(r["uid_prev"])
        out.append(e)
    return out


def player_villages_history(con: sqlite3.Connection, server: str, uid: int) -> list[dict]:
    rows = con.execute(
        "SELECT day, vid, name, x, y, pop FROM villages WHERE server_id=? AND uid=? ORDER BY day", (server, uid))
    hist: dict[int, dict] = {}
    for r in rows:
        h = hist.setdefault(r["vid"], {"vid": r["vid"], "name": r["name"], "x": r["x"], "y": r["y"], "pop": []})
        h["pop"].append([r["day"], r["pop"]])
        h["name"] = r["name"]
    return list(hist.values())
