"""Descubrimiento de mundos activos de Travian Legends.

Estrategia en cascada (cada fuente enriquece a la anterior):

1. ``status.travian.com``: el HTML incrusta ``<script id="__GW_DATA__">`` con
   ``{"items": {clave: {id, name, state, url}}}``. Es la lista más completa.
2. ``lobby.legends.travian.com/api/calendar``: lista de lanzamientos
   ``[{name, domain, start, metadata: {name, type, speed, url}}]``. Da la fecha
   de inicio, la velocidad y el tipo, y anuncia mundos que aún no han empezado
   (``start`` en el futuro → ``upcoming``). Las entradas sin ``metadata.url``
   son lanzamientos aún sin dominio asignado y se ignoran. Si falla se ignora.
3. Servidores añadidos a mano (``ATALAYA_EXTRA_SERVERS``).

Un mundo se considera terminado cuando desaparece de las fuentes o su
``map.sql`` responde 404 varias veces seguidas (ver ``collector``).
"""
from __future__ import annotations

import json
import re
import time
from dataclasses import dataclass, field
from urllib.parse import urlparse

import httpx

HOST_RE = re.compile(r"^(?:ts\d+|[a-z0-9-]+)\.x(\d+)\.([a-z0-9-]+)\.travian\.com$")
NAME_REGION_RE = re.compile(r"^([a-z]+)\d*$")
GW_DATA_RE = re.compile(r'<script[^>]*id="__GW_DATA__"[^>]*>(.*?)</script>', re.S)


@dataclass
class World:
    host: str
    name: str = ""
    region: str = ""
    speed: int | None = None  # None = desconocida (se completa con /api/v1/info)
    kind: str = "regular"
    start_ts: int | None = None
    end_ts: int | None = None
    status: str = "active"
    source: str = "manual"
    meta: dict = field(default_factory=dict)


def host_from_url(url: str) -> str:
    url = url.strip()
    if "://" not in url:
        url = "https://" + url
    return (urlparse(url).hostname or "").lower()


def infer_from_host(host: str) -> tuple[int | None, str]:
    """ts3.x2.europe.travian.com -> (2, 'europe'); alpha.travian.com -> (None, '')."""
    m = HOST_RE.match(host)
    if not m:
        return None, ""
    return int(m.group(1)), m.group(2)


def region_from_name(name: str) -> str:
    """'europe39' -> 'europe' (para hosts sin región en el dominio, p. ej. alpha.travian.com)."""
    m = NAME_REGION_RE.match((name or "").strip().lower())
    return m.group(1) if m else ""


def pretty_name(name: str) -> str:
    """'europe3' -> 'Europe 3', 'de20' -> 'DE 20' (la página de estado usa claves técnicas)."""
    m = re.match(r"^([a-z]+)(\d+)$", (name or "").strip())
    if not m:
        return name
    word = m.group(1).upper() if len(m.group(1)) <= 2 else m.group(1).capitalize()
    return f"{word} {m.group(2)}"


def is_travian_host(host: str) -> bool:
    return host == "travian.com" or host.endswith(".travian.com")


def parse_status_page(html: str) -> list[World]:
    m = GW_DATA_RE.search(html)
    if not m:
        return []
    try:
        data = json.loads(m.group(1))
    except json.JSONDecodeError:
        return []
    items = data.get("items", data)
    worlds: list[World] = []
    for item in (items.values() if isinstance(items, dict) else items):
        if not isinstance(item, dict) or not item.get("url"):
            continue
        host = host_from_url(item["url"])
        if not is_travian_host(host):
            continue
        speed, region = infer_from_host(host)
        region = region or region_from_name(str(item.get("name") or ""))
        worlds.append(
            World(host=host, name=pretty_name(str(item.get("name") or "")) or host, region=region, speed=speed,
                  source="status", meta={"state": item.get("state"), "id": item.get("id")})
        )
    return worlds


def parse_lobby_calendar(payload) -> dict[str, dict]:
    """Devuelve {host: {name, start_ts, end_ts, speed, kind, region}} a partir del calendario del lobby.

    Formato real (2026)::

        [{"name": "international30", "domain": "international", "start": 1793203200,
          "metadata": {"name": "International 30", "type": "normal", "speed": 3,
                       "url": "https://ts30.x3.international.travian.com/"}}, ...]

    ``domain`` es la región, no el host: el host sale de ``metadata.url``.
    """
    out: dict[str, dict] = {}
    if isinstance(payload, dict):
        entries = payload.get("data") or payload.get("items") or []
    else:
        entries = payload or []
    if isinstance(entries, dict):
        entries = list(entries.values())
    for e in entries:
        if not isinstance(e, dict):
            continue
        md = e.get("metadata") or {}
        url = md.get("url") or e.get("url")
        if not url:
            continue  # lanzamiento anunciado sin dominio todavía
        host = host_from_url(url)
        if not is_travian_host(host):
            continue
        speed = md.get("speed")
        try:
            speed = int(speed) if speed is not None else None
        except (TypeError, ValueError):
            speed = None
        domain = e.get("domain")
        out[host] = {
            "name": md.get("name") or e.get("name"),
            "start_ts": _int_or_none(e.get("start")),
            "end_ts": _int_or_none(e.get("end")),
            "speed": speed,
            "kind": str(md.get("type") or "regular").lower(),
            "region": domain if isinstance(domain, str) and "." not in domain else "",
        }
    return out


def _int_or_none(v) -> int | None:
    try:
        return int(v) if v is not None else None
    except (TypeError, ValueError):
        return None


def discover_sources(settings, client: httpx.Client | None = None,
                     now: float | None = None) -> tuple[list[World], set[str]]:
    """Devuelve (mundos, fuentes que respondieron). Ver ``discover``."""
    now = time.time() if now is None else now
    own = client is None
    client = client or httpx.Client(timeout=settings.timeout_s, headers={"User-Agent": settings.user_agent},
                                    follow_redirects=True)
    worlds: dict[str, World] = {}
    responded: set[str] = set()
    try:
        try:
            r = client.get(settings.status_url)
            if r.status_code == 200:
                found = parse_status_page(r.text)
                if found:
                    responded.add("status")
                for w in found:
                    worlds[w.host] = w
        except httpx.HTTPError:
            pass
        try:
            r = client.get(settings.lobby_calendar_url, headers={"Accept": "application/json"})
            if r.status_code == 200:
                calendar = parse_lobby_calendar(r.json())
                if calendar:
                    responded.add("lobby")
                for host, info in calendar.items():
                    w = worlds.get(host)
                    if w is None:
                        speed, region = infer_from_host(host)
                        w = worlds[host] = World(host=host, name=host, region=region, speed=speed, source="lobby")
                    w.name = info.get("name") or w.name
                    w.region = w.region or info.get("region") or ""
                    w.start_ts = info.get("start_ts") or w.start_ts
                    w.end_ts = info.get("end_ts") or w.end_ts
                    w.speed = info.get("speed") or w.speed
                    w.kind = info.get("kind") or w.kind
        except (httpx.HTTPError, ValueError):
            pass
    finally:
        if own:
            client.close()
    for w in worlds.values():
        if w.start_ts and w.start_ts > now:
            w.status = "upcoming"
    for h in settings.extra_servers:
        host = host_from_url(h)
        if host and host not in worlds:
            speed, region = infer_from_host(host)
            worlds[host] = World(host=host, name=host, region=region, speed=speed, source="manual")
    for h in settings.ignore_servers:
        worlds.pop(host_from_url(h), None)
    return sorted(worlds.values(), key=lambda w: (w.region, w.host)), responded


def parse_world_info(payload, now: float | None = None) -> dict:
    """Interpreta ``https://<mundo>/api/v1/info`` (público, sin sesión)::

        {"ageInDays": 192, "speed": 1, "mapSize": {"width": 401, "height": 401}, "tribeIds": [1, 2, 3, 4, 5], ...}

    Devuelve {start_ts, speed, map_radius} con lo que se haya podido leer. ``start_ts`` es la
    medianoche UTC del día de inicio (``ageInDays`` cuenta días completos desde el inicio).
    """
    if not isinstance(payload, dict):
        return {}
    out: dict = {}
    now = time.time() if now is None else now
    age = _int_or_none(payload.get("ageInDays"))
    if age is not None and age >= 0:
        today = int(now // 86400) * 86400
        out["start_ts"] = today - age * 86400
    speed = _int_or_none(payload.get("speed") or (payload.get("serverConfiguration") or {}).get("speed"))
    if speed and speed > 0:
        out["speed"] = speed
    size = payload.get("mapSize") or (payload.get("serverConfiguration") or {}).get("map") or {}
    width = _int_or_none(size.get("width")) if isinstance(size, dict) else None
    if width and width > 1:
        out["map_radius"] = (width - 1) // 2
    return out


# Reglas del mundo que cambian cómo se juega; el resto de ``serverSupportedFeatures`` son ajustes de interfaz.
CALENDAR_FEATURES = ("vacation", "allianceBonus", "boostedStart", "territory", "cities", "harbours", "crop18",
                     "mergingTroops", "forwardingTroops", "shards", "governors", "craftingItems", "legendaryItems",
                     "isEuropeMap", "keepVidOnConquer", "travelOverTheWorldEdge", "settlersCanChangeTribe")


def parse_world_calendar(payload, now: float | None = None) -> dict | None:
    """Calendario y reglas de un mundo a partir de ``/api/v1/info`` (comprobado en mundos reales, nov. 2026)::

        {"playersCount": 13880, "artefactsDate": 1801666800, "constructionPlansDate": 1809442800,
         "wwLevel": 0, "tribeIds": [1, 2, 3, 4, 5], "serverSupportedFeatures": {"vacation": {"enabled": true}, ...}}

    Devuelve None si la respuesta no trae ninguna de esas fechas ni la lista de tribus.
    """
    if not isinstance(payload, dict):
        return None
    now = time.time() if now is None else now
    feats = payload.get("serverSupportedFeatures")
    feats = feats if isinstance(feats, dict) else {}

    def on(v) -> bool:
        return v is True or (isinstance(v, dict) and v.get("enabled") is True)

    tribes = [t for t in (_int_or_none(x) for x in (payload.get("tribeIds") or [])) if t]
    out = {
        "day": time.strftime("%Y-%m-%d", time.gmtime(now)),
        "players": _int_or_none(payload.get("playersCount")),
        "artefacts": _int_or_none(payload.get("artefactsDate")) or None,
        "plans": _int_or_none(payload.get("constructionPlansDate")) or None,
        "wwLevel": _int_or_none(payload.get("wwLevel")),
        "tribes": tribes,
        "features": [k for k in CALENDAR_FEATURES if on(feats.get(k))],
    }
    if not (out["artefacts"] or out["plans"] or tribes):
        return None
    return out


def discover(settings, client: httpx.Client | None = None) -> list[World]:
    return discover_sources(settings, client)[0]
