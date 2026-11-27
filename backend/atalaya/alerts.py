"""Motor de alertas: evalúa reglas tras cada actualización y avisa por webhook de Discord."""
from __future__ import annotations

import hashlib
import json
import logging
import re
import sqlite3
from typing import Callable

import httpx

from .analytics import player_inactivity
from .geo import distance, wraps

log = logging.getLogger("atalaya.alerts")

KINDS = {
    "player_inactive": "Un jugador vigilado lleva N días sin crecer",
    "area_conquest": "Conquista o destrucción de aldeas en un radio",
    "area_new_village": "Nueva aldea fundada en un radio",
    "player_alliance_change": "Un jugador vigilado cambia de alianza",
    "alliance_village_lost": "Una alianza pierde aldeas",
}

Sender = Callable[[str, dict], bool]

WEBHOOK_RE = re.compile(r"^https://(?:discord(?:app)?\.com)/api/webhooks/\d+/[\w-]+$")

# Webhooks que llegan por variable de entorno (ATALAYA_ALERT_RULES). En la base solo se guarda
# una referencia "env:<hash>", porque en la versión sin servidor la base se publica.
ENV_WEBHOOKS: dict[str, str] = {}


def _ref(url: str) -> str:
    return "env:" + hashlib.sha256(url.encode()).hexdigest()[:20]


def sync_env_rules(con: sqlite3.Connection, raw: str) -> dict:
    """Sustituye las reglas de la base por las de ``raw`` (JSON: lista de
    ``{server_id, kind, params, webhook_url, label?}``), conservando ``last_fired`` de las que siguen."""
    rules = json.loads(raw) if raw.strip() else []
    if not isinstance(rules, list):
        raise ValueError("ATALAYA_ALERT_RULES debe ser una lista JSON")
    wanted: dict[tuple, dict] = {}
    for r in rules:
        url = str(r.get("webhook_url", ""))
        if r.get("kind") not in KINDS or not WEBHOOK_RE.match(url) or not r.get("server_id"):
            log.warning("regla de alerta ignorada: %s", {k: v for k, v in r.items() if k != "webhook_url"})
            continue
        ref = _ref(url)
        ENV_WEBHOOKS[ref] = url
        params = json.dumps(r.get("params") or {}, sort_keys=True)
        wanted[(r["server_id"], r["kind"], params, ref)] = r
    existing = {}
    for row in con.execute("SELECT id, server_id, kind, params, webhook_url FROM alert_rules").fetchall():
        key = (row["server_id"], row["kind"], json.dumps(json.loads(row["params"]), sort_keys=True), row["webhook_url"])
        existing[key] = row["id"]
    with con:
        for key, rid in existing.items():
            if key not in wanted:
                con.execute("DELETE FROM alert_rules WHERE id=?", (rid,))
        for key, r in wanted.items():
            if key in existing:
                con.execute("UPDATE alert_rules SET label=? WHERE id=?", (r.get("label"), existing[key]))
            else:
                con.execute("INSERT INTO alert_rules(server_id, kind, params, webhook_url, label) VALUES (?,?,?,?,?)",
                            (key[0], key[1], key[2], key[3], r.get("label")))
    return {"rules": len(wanted)}


def redact_webhooks(con: sqlite3.Connection) -> None:
    """Antes de publicar la base: ningún webhook real debe quedar en ella."""
    with con:
        con.execute("UPDATE alert_rules SET webhook_url='redacted' WHERE webhook_url NOT LIKE 'env:%'")


def discord_sender(url: str, payload: dict) -> bool:
    if url.startswith("env:"):
        url = ENV_WEBHOOKS.get(url, "")
    if not WEBHOOK_RE.match(url):
        return False
    try:
        r = httpx.post(url, json=payload, timeout=15)
        return r.status_code < 300
    except httpx.HTTPError:
        return False


def _embed(title: str, lines: list[str], server: str, color: int = 0xE8B04B) -> dict:
    return {
        "username": "Atalaya",
        "embeds": [{
            "title": title[:250],
            "description": "\n".join(lines)[:4000],
            "color": color,
            "footer": {"text": server},
        }],
    }


def evaluate(con: sqlite3.Connection, server: str, day: str, sender: Sender = discord_sender) -> list[dict]:
    rules = con.execute(
        "SELECT * FROM alert_rules WHERE server_id=? AND active=1", (server,)).fetchall()
    if not rules:
        return []
    srow = con.execute("SELECT map_radius, speed, info FROM servers WHERE id=?", (server,)).fetchone()
    radius = (srow["map_radius"] if srow else None) or 200
    try:
        wrap = wraps(json.loads(srow["info"])) if srow and srow["info"] else True
    except ValueError:
        wrap = True
    speed = (srow["speed"] if srow else None) or 1
    events = con.execute("SELECT * FROM events WHERE server_id=? AND day=?", (server, day)).fetchall()
    names = {r[0]: r[1] for r in con.execute("SELECT uid, name FROM players WHERE server_id=?", (server,))}
    tags = {r[0]: r[1] for r in con.execute("SELECT aid, tag FROM alliances WHERE server_id=?", (server,))}
    fired = []
    for rule in rules:
        p = json.loads(rule["params"])
        kind = rule["kind"]
        lines: list[str] = []
        title = rule["label"] or KINDS.get(kind, kind)
        if kind == "player_inactive":
            uid = int(p["uid"])
            hist = [(r[0], r[1], r[2]) for r in con.execute(
                "SELECT day, pop, villages FROM player_days WHERE server_id=? AND uid=? ORDER BY day DESC LIMIT 30",
                (server, uid))][::-1]
            fs = con.execute("SELECT first_seen FROM players WHERE server_id=? AND uid=?", (server, uid)).fetchone()
            m = player_inactivity(hist, fs[0] if fs else "", speed)
            if m["streak"] >= int(p.get("min_days", 3)):
                if not rule["last_fired"]:
                    lines.append(f"**{names.get(uid, uid)}** lleva {m['streak']} días sin crecer "
                                 f"(confianza {m['confidence']} %).")
            elif rule["last_fired"]:
                con.execute("UPDATE alert_rules SET last_fired=NULL WHERE id=?", (rule["id"],))
        elif kind in ("area_conquest", "area_new_village"):
            types = {"area_conquest": ("conquered", "destroyed"), "area_new_village": ("founded",)}[kind]
            for e in events:
                if e["type"] in types and e["x"] is not None:
                    d = distance(int(p["x"]), int(p["y"]), e["x"], e["y"], radius, wrap)
                    if d <= float(p.get("radius", 15)):
                        who = names.get(e["uid"], e["uid"])
                        verb = {"conquered": "conquistada por", "destroyed": "destruida (era de)",
                                "founded": "fundada por"}[e["type"]]
                        lines.append(f"({e['x']}|{e['y']}) {verb} **{who}** · {d:.1f} casillas")
        elif kind == "player_alliance_change":
            uid = int(p["uid"])
            for e in events:
                if e["uid"] == uid and e["type"].startswith("alliance_"):
                    lines.append(f"**{names.get(uid, uid)}**: {tags.get(e['aid_prev'], '—')} → {tags.get(e['aid'], '—')}")
        elif kind == "alliance_village_lost":
            aid = int(p["aid"])
            for e in events:
                if (e["type"] == "conquered" and e["aid_prev"] == aid) or (e["type"] == "destroyed" and e["aid"] == aid):
                    lines.append(f"({e['x']}|{e['y']}) {e['type']} · {names.get(e['uid'], e['uid'])}")
        if lines:
            ok = sender(rule["webhook_url"], _embed(title, lines, server))
            con.execute("UPDATE alert_rules SET last_fired=? WHERE id=?", (day, rule["id"]))
            con.execute("INSERT INTO alert_log(rule_id, day, message, ok) VALUES (?,?,?,?)",
                        (rule["id"], day, "\n".join(lines), 1 if ok else 0))
            fired.append({"rule": rule["id"], "kind": kind, "lines": lines, "ok": ok})
    con.commit()
    return fired
