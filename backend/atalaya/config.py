"""Configuración por variables de entorno (todas opcionales)."""
from __future__ import annotations

import os
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path


def _list(name: str) -> list[str]:
    raw = os.environ.get(name, "")
    return [x.strip() for x in raw.split(",") if x.strip()]


def _ascii(s: str) -> str:
    """Quita acentos y cualquier carácter no ASCII (p. ej. 'público' -> 'publico')."""
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii")


@dataclass
class Settings:
    # Base de datos SQLite (fichero). Para producción grande ver README (Postgres).
    db_path: Path = field(default_factory=lambda: Path(os.environ.get("ATALAYA_DB", "data/atalaya.db")))
    # Fuentes de descubrimiento de mundos
    status_url: str = os.environ.get("ATALAYA_STATUS_URL", "https://status.travian.com/")
    lobby_calendar_url: str = os.environ.get(
        "ATALAYA_LOBBY_CALENDAR_URL", "https://lobby.legends.travian.com/api/calendar"
    )
    # Mundos añadidos a mano (hosts), por si el descubrimiento falla
    extra_servers: list[str] = field(default_factory=lambda: _list("ATALAYA_EXTRA_SERVERS"))
    # Mundos a ignorar
    ignore_servers: list[str] = field(default_factory=lambda: _list("ATALAYA_IGNORE_SERVERS"))
    # Comportamiento educado con los servidores de Travian.
    # Las cabeceras HTTP solo admiten ASCII: un acento aquí rompía todas las peticiones.
    user_agent: str = _ascii(os.environ.get(
        "ATALAYA_USER_AGENT", "AtalayaBot/1.0 (+https://github.com/; public map.sql, 1 download/day)"
    ))
    concurrency: int = int(os.environ.get("ATALAYA_CONCURRENCY", "3"))
    request_delay_s: float = float(os.environ.get("ATALAYA_REQUEST_DELAY", "1.5"))
    timeout_s: float = float(os.environ.get("ATALAYA_TIMEOUT", "60"))
    # Retención de instantáneas por aldea (los agregados por jugador se guardan siempre)
    village_retention_days: int = int(os.environ.get("ATALAYA_VILLAGE_RETENTION_DAYS", "45"))
    # Retención de agregados por jugador/alianza y eventos, en instantáneas (0 = siempre). Solo `prune`.
    day_retention_days: int = int(os.environ.get("ATALAYA_DAY_RETENTION_DAYS", "0"))
    # Días que se guarda un mundo terminado antes de borrarlo (0 = siempre). Solo `prune`.
    ended_retention_days: int = int(os.environ.get("ATALAYA_ENDED_RETENTION_DAYS", "0"))
    # Reglas de alerta en JSON (para la versión sin servidor, desde un secreto de GitHub)
    alert_rules_json: str = os.environ.get("ATALAYA_ALERT_RULES", "")
    # Bucle del recolector
    loop_interval_min: int = int(os.environ.get("ATALAYA_LOOP_MINUTES", "60"))
    # Días que se exportan como historial al frontend
    history_days: int = int(os.environ.get("ATALAYA_HISTORY_DAYS", "21"))
    # CORS para el frontend si se sirve aparte
    cors_origins: list[str] = field(default_factory=lambda: _list("ATALAYA_CORS_ORIGINS") or ["*"])


settings = Settings()
