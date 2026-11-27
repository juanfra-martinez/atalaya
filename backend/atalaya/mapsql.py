"""Parser tolerante del fichero público ``map.sql`` de Travian Legends.

Formato actual (16 columnas)::

    INSERT INTO `x_world` VALUES (id,x,y,tid,vid,'aldea',uid,'jugador',aid,'alianza',
                                  poblacion,region,isCapital,isCity,isHarbor,victoryPoints);

Versiones antiguas tenían 11 o 15 columnas. El parser acepta cualquier número de
columnas >= 11, valores NULL/TRUE/FALSE, comillas escapadas ('' o \\') y varias
tuplas por INSERT.
"""
from __future__ import annotations

import gzip
from dataclasses import dataclass
from typing import Iterable, Iterator

TRIBES = {
    1: "romans",
    2: "teutons",
    3: "gauls",
    4: "nature",
    5: "natars",
    6: "egyptians",
    7: "huns",
    8: "spartans",
    9: "vikings",
}


@dataclass(slots=True)
class VillageRow:
    field_id: int
    x: int
    y: int
    tid: int
    vid: int
    village: str
    uid: int
    player: str
    aid: int
    alliance: str
    population: int
    region: str | None = None
    is_capital: bool = False
    is_city: bool | None = None
    is_harbor: bool | None = None
    victory_points: int | None = None


class MapSqlError(ValueError):
    pass


def _tokenize_tuple(s: str, i: int) -> tuple[list, int]:
    """Lee una tupla SQL que empieza en s[i] == '('. Devuelve (valores, índice tras ')')."""
    assert s[i] == "("
    i += 1
    n = len(s)
    values: list = []
    while i < n:
        c = s[i]
        if c in " \t\r\n,":
            i += 1
            continue
        if c == ")":
            return values, i + 1
        if c == "'":
            i += 1
            buf = []
            while i < n:
                ch = s[i]
                if ch == "\\" and i + 1 < n:
                    nxt = s[i + 1]
                    buf.append({"n": "\n", "r": "\r", "t": "\t", "0": "\0"}.get(nxt, nxt))
                    i += 2
                    continue
                if ch == "'":
                    if i + 1 < n and s[i + 1] == "'":
                        buf.append("'")
                        i += 2
                        continue
                    i += 1
                    break
                buf.append(ch)
                i += 1
            values.append("".join(buf))
            continue
        # token sin comillas
        j = i
        while j < n and s[j] not in ",)":
            j += 1
        tok = s[i:j].strip()
        up = tok.upper()
        if up == "NULL":
            values.append(None)
        elif up == "TRUE":
            values.append(True)
        elif up == "FALSE":
            values.append(False)
        else:
            try:
                values.append(int(tok))
            except ValueError:
                try:
                    values.append(float(tok))
                except ValueError:
                    values.append(tok)
        i = j
    raise MapSqlError("tupla sin cerrar")


def _iter_tuples(text: str) -> Iterator[list]:
    i = 0
    n = len(text)
    while True:
        k = text.find("VALUES", i)
        if k < 0:
            return
        i = k + 6
        # una o más tuplas separadas por comas, hasta ';'
        while i < n:
            while i < n and text[i] in " \t\r\n,":
                i += 1
            if i >= n or text[i] != "(":
                break
            vals, i = _tokenize_tuple(text, i)
            yield vals


def _as_bool(v) -> bool | None:
    if v is None:
        return None
    if isinstance(v, bool):
        return v
    if isinstance(v, (int, float)):
        return bool(v)
    return str(v).strip().lower() in ("1", "true", "t", "yes")


def _row(vals: list) -> VillageRow:
    if len(vals) < 11:
        raise MapSqlError(f"se esperaban >=11 columnas, hay {len(vals)}")
    extra = vals[11:] + [None] * max(0, 16 - len(vals))
    return VillageRow(
        field_id=int(vals[0] or 0),
        x=int(vals[1]),
        y=int(vals[2]),
        tid=int(vals[3] or 0),
        vid=int(vals[4]),
        village=str(vals[5] or ""),
        uid=int(vals[6] or 0),
        player=str(vals[7] or ""),
        aid=int(vals[8] or 0),
        alliance=str(vals[9] or ""),
        population=int(vals[10] or 0),
        region=None if extra[0] in (None, "") else str(extra[0]),
        is_capital=bool(_as_bool(extra[1])),
        is_city=_as_bool(extra[2]),
        is_harbor=_as_bool(extra[3]),
        victory_points=None if extra[4] is None else int(extra[4]),
    )


def parse(data: bytes | str, *, strict: bool = False) -> list[VillageRow]:
    """Parsea un map.sql completo (acepta bytes gzip)."""
    if isinstance(data, bytes):
        if data[:2] == b"\x1f\x8b":
            data = gzip.decompress(data)
        text = data.decode("utf-8", errors="replace")
    else:
        text = data
    rows: list[VillageRow] = []
    for vals in _iter_tuples(text):
        try:
            rows.append(_row(vals))
        except (MapSqlError, ValueError, TypeError):
            if strict:
                raise
    return rows


def dump(rows: Iterable[VillageRow]) -> str:
    """Serializa filas al formato actual de 16 columnas (útil para tests y datos sintéticos)."""

    def q(s: str) -> str:
        return "'" + s.replace("\\", "\\\\").replace("'", "\\'") + "'"

    def b(v) -> str:
        return "NULL" if v is None else ("TRUE" if v else "FALSE")

    out = []
    for r in rows:
        out.append(
            "INSERT INTO `x_world` VALUES ("
            f"{r.field_id},{r.x},{r.y},{r.tid},{r.vid},{q(r.village)},{r.uid},{q(r.player)},"
            f"{r.aid},{q(r.alliance)},{r.population},"
            f"{'NULL' if r.region is None else q(r.region)},{b(r.is_capital)},{b(r.is_city)},"
            f"{b(r.is_harbor)},{'NULL' if r.victory_points is None else r.victory_points});"
        )
    return "\n".join(out) + "\n"


def detect_radius(rows: Iterable[VillageRow]) -> int:
    """Radio del mapa (200 → 401×401, 400 → 801×801)."""
    m = 0
    for r in rows:
        m = max(m, abs(r.x), abs(r.y))
    return 200 if m <= 200 else 400
