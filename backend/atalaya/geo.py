"""Geometría del mapa de Travian (toroide: los bordes se tocan si el mundo tiene ``travelOverTheWorldEdge``)."""
from __future__ import annotations

import math


def wrap_delta(a: int, b: int, radius: int) -> int:
    size = 2 * radius + 1
    d = abs(a - b) % size
    return min(d, size - d)


def distance(x1: int, y1: int, x2: int, y2: int, radius: int = 200, wrap: bool = True) -> float:
    """Distancia en casillas. Sin ``wrap`` el mapa no da la vuelta, como en los mundos sin travelOverTheWorldEdge."""
    if not wrap:
        return math.hypot(x1 - x2, y1 - y2)
    dx = wrap_delta(x1, x2, radius)
    dy = wrap_delta(y1, y2, radius)
    return math.hypot(dx, dy)


def wraps(info: dict | None) -> bool:
    """Si el mapa de un mundo da la vuelta, según sus reglas guardadas (``servers.info``). Sin reglas, sí."""
    feats = (info or {}).get("features")
    return "travelOverTheWorldEdge" in feats if isinstance(feats, list) else True


def travel_seconds(dist: float, unit_speed: float, server_speed: float = 1, ts_level: int = 0,
                   ts_bonus_per_level: float = 0.20, artifact: float = 1.0) -> float:
    """Tiempo de viaje. La plaza de torneos solo acelera la distancia que supera 20 casillas."""
    v = unit_speed * server_speed * artifact
    if v <= 0:
        return math.inf
    if dist <= 20 or ts_level <= 0:
        return dist / v * 3600
    fast = v * (1 + ts_bonus_per_level * ts_level)
    return (20 / v + (dist - 20) / fast) * 3600
