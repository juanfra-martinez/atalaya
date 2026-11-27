"""Generador de mundos sintéticos realistas (map.sql diarios) para demo y tests.

Simula registros, crecimiento, abandono, fundación de aldeas, alianzas,
cambios de alianza, conquistas, catapultas y borrado de cuentas.
"""
from __future__ import annotations

import math
import random
from dataclasses import dataclass, field

from .mapsql import VillageRow

SYL = ["ka", "ri", "to", "mar", "el", "dra", "gon", "vi", "lo", "sa", "an", "tor", "ix", "ul", "be", "ra",
       "zen", "ko", "mi", "ta", "fer", "nus", "gal", "or", "the", "vin", "us", "al", "dor", "is", "ca", "ny"]
PREFIX = ["", "", "", "", "Lord", "Sir", "Dark", "El", "Don", "Iron", "Mad", "Big", "xX", "The"]
SUFFIX = ["", "", "", "", "", "", "88", "_ES", "77", "Xx", "92", "_pro", "01", "jr", "_tw"]
ALLIANCE_TAGS = ["~SPQR~", "NØRD", "Valhalla", "LEGIO", "KAOS", "Phoenix", "ATHENA", "-WOLF-", "Tormenta",
                 "Imperium", "B.A.N.D", "Eclipse", "ORDO", "Hydra", "Titans", "Ikarus", "SpartaX", "Nomads",
                 "Dragones", "RedLine", "ZEUS", "Ragnarök", "Kraken", "Vortex", "LOBO", "Aurora", "Exodo"]
VILLAGE_NAMES = ["Nueva aldea", "New village", "Aldea de {p}", "{p}'s village", "01 Capital", "Granero",
                 "Cropper", "Off", "Deff {n}", "Bastión", "Puerto Real", "Avalon", "Rocafuerte", "Minas",
                 "Wolfsburg", "Valle {n}", "Atalaya", "Frontera", "Castillo {n}", "Ciudadela"]
TRIBES = [1, 2, 3, 6, 7]
TRIBE_W = [0.24, 0.24, 0.24, 0.14, 0.14]


def _name(rng: random.Random) -> str:
    n = "".join(rng.choice(SYL) for _ in range(rng.choice([2, 2, 3])))
    n = n.capitalize()
    pre = rng.choice(PREFIX)
    suf = rng.choice(SUFFIX)
    return (pre + (" " if pre and not pre.endswith("X") else "") + n + suf).strip()


@dataclass
class Village:
    vid: int
    x: int
    y: int
    name: str
    pop: float
    capital: bool = False


@dataclass
class Player:
    uid: int
    name: str
    tid: int
    archetype: str
    rate: float
    quit_day: int | None
    joined: int
    aid: int = 0
    villages: list[Village] = field(default_factory=list)
    deleted: bool = False

    @property
    def pop(self) -> int:
        return int(sum(v.pop for v in self.villages))


class World:
    def __init__(self, seed: int, speed: int = 1, radius: int = 200, initial_players: int = 260,
                 daily_new: int = 30, max_players: int = 900):
        self.rng = random.Random(seed)
        self.speed = speed
        self.radius = radius
        self.players: dict[int, Player] = {}
        self.occupied: dict[tuple[int, int], Village] = {}
        self.owner: dict[int, int] = {}
        self.alliances: dict[int, str] = {}
        self.next_uid = 100
        self.next_vid = 1000
        self.day = 0
        self.initial_players = initial_players
        self.daily_new = daily_new
        self.max_players = max_players
        tags = ALLIANCE_TAGS[:]
        self.rng.shuffle(tags)
        for i, t in enumerate(tags[:22]):
            self.alliances[i + 1] = t
        self.alliance_quadrant = {aid: self.rng.randrange(4) for aid in self.alliances}
        self._natars()

    # -- utilidades -----------------------------------------------------------
    def _free_spot(self, cx: float, cy: float, spread: float) -> tuple[int, int]:
        for _ in range(200):
            x = int(round(cx + self.rng.gauss(0, spread)))
            y = int(round(cy + self.rng.gauss(0, spread)))
            if abs(x) <= self.radius and abs(y) <= self.radius and (x, y) not in self.occupied:
                return x, y
            spread *= 1.05
        while True:
            x, y = self.rng.randint(-self.radius, self.radius), self.rng.randint(-self.radius, self.radius)
            if (x, y) not in self.occupied:
                return x, y

    def _add_village(self, p: Player, x: int, y: int, pop: float, capital=False, name=None) -> Village:
        v = Village(self.next_vid, x, y, name or self._vname(p), pop, capital)
        self.next_vid += 1
        self.occupied[(x, y)] = v
        self.owner[v.vid] = p.uid
        p.villages.append(v)
        return v

    def _vname(self, p: Player) -> str:
        t = self.rng.choice(VILLAGE_NAMES)
        return t.format(p=p.name, n=len(p.villages) + 1)

    def _natars(self):
        nat = Player(1, "Natars", 5, "natar", 0, None, 0)
        self.players[1] = nat
        for _ in range(14):
            ang = self.rng.random() * math.tau
            r = self.rng.uniform(25, self.radius * 0.8)
            x, y = self._free_spot(r * math.cos(ang), r * math.sin(ang), 2)
            self._add_village(nat, x, y, self.rng.randint(120, 600), name="Natars")

    def _register(self, n: int):
        for _ in range(n):
            if len(self.players) >= self.max_players:
                return
            uid = self.next_uid
            self.next_uid += self.rng.randint(1, 4)
            arche = self.rng.choices(["hardcore", "regular", "casual", "quitter", "ghost"],
                                     [0.12, 0.30, 0.20, 0.23, 0.15])[0]
            rate = {"hardcore": 72, "regular": 42, "casual": 22, "quitter": 34, "ghost": 5}[arche]
            rate *= self.rng.uniform(0.7, 1.3) * (1 + 0.35 * (self.speed - 1))
            quit_day = None
            if arche == "quitter":
                quit_day = self.day + self.rng.randint(2, 70)
            elif arche == "ghost":
                quit_day = self.day + self.rng.randint(0, 2)
            elif arche == "casual" and self.rng.random() < 0.3:
                quit_day = self.day + self.rng.randint(8, 45)
            p = Player(uid, self._unique_name(), self.rng.choices(TRIBES, TRIBE_W)[0], arche, rate, quit_day, self.day)
            self.players[uid] = p
            q = self.rng.randrange(4)
            ring = 12 + self.day * 2.4 * (1 + 0.3 * (self.speed - 1))
            ring = min(ring, self.radius * 0.92)
            ang = (q + self.rng.random()) * math.pi / 2
            r = ring * self.rng.uniform(0.75, 1.05)
            x, y = self._free_spot(r * math.cos(ang), r * math.sin(ang), 4)
            self._add_village(p, x, y, self.rng.randint(2, 9), capital=True, name=f"Aldea de {p.name}")

    def _unique_name(self) -> str:
        names = {p.name for p in self.players.values()}
        while True:
            n = _name(self.rng)
            if n not in names and len(n) >= 3:
                return n

    def active(self, p: Player) -> bool:
        return not p.deleted and p.uid != 1 and (p.quit_day is None or self.day < p.quit_day)

    # -- simulación diaria -------------------------------------------------------
    def step(self):
        self.day += 1
        rng = self.rng
        if self.day == 1:
            self._register(self.initial_players)
        else:
            self._register(max(0, int(self.daily_new * math.exp(-self.day / 25) * rng.uniform(0.6, 1.4))))
        players = [p for p in self.players.values() if not p.deleted and p.uid != 1]
        for p in players:
            if not self.active(p):
                continue
            # crecimiento diario (más lento a medida que todo es más caro), algún día sin conectarse
            if rng.random() < (0.08 if p.archetype != "casual" else 0.25):
                continue
            g = p.rate * rng.uniform(0.5, 1.4) / (1 + p.pop / 2500)
            weights = [1 / (1 + v.pop / 150) for v in p.villages]
            tw = sum(weights)
            for v, w in zip(p.villages, weights):
                v.pop = min(v.pop + g * w / tw * len(p.villages) ** 0.6, 1100)
            # fundar aldea
            threshold = 230 + 400 * (len(p.villages) - 1) ** 1.2
            if p.pop > threshold and rng.random() < 0.55:
                cap = p.villages[0]
                x, y = self._free_spot(cap.x, cap.y, rng.uniform(3, 9))
                self._add_village(p, x, y, rng.randint(2, 4))
            # alianzas
            if p.aid == 0 and p.pop > 90 and rng.random() < 0.2:
                p.aid = rng.choice(list(self.alliances))
            elif p.aid and rng.random() < 0.006:
                p.aid = rng.choice([0] + list(self.alliances))
        # inactivos: catapultas ocasionales
        for p in players:
            if not self.active(p) and p.villages and rng.random() < 0.05:
                v = rng.choice(p.villages)
                v.pop = max(1, v.pop - rng.uniform(5, 40))
        # conquistas: jugadores fuertes conquistan aldeas de inactivos cercanos
        strong = [p for p in players if self.active(p) and p.pop > 600]
        inactive_v = [(v, p) for p in players if not self.active(p) and not p.deleted for v in p.villages]
        if strong and inactive_v and self.day > 6:
            for _ in range(min(len(strong), rng.randint(0, 4 + len(strong) // 25))):
                a = rng.choice(strong)
                cap = a.villages[0]
                cands = [(v, p) for v, p in inactive_v
                         if abs(v.x - cap.x) + abs(v.y - cap.y) < 28 and v in p.villages and not v.capital]
                if not cands:
                    continue
                v, d = rng.choice(cands)
                d.villages.remove(v)
                v.pop = max(1, v.pop * rng.uniform(0.6, 0.9))
                a.villages.append(v)
                self.owner[v.vid] = a.uid
        # conquista entre activos (guerra) muy ocasional
        if len(strong) > 4 and rng.random() < 0.5:
            a, b = rng.sample(strong, 2)
            if a.aid != b.aid and len(b.villages) > 1:
                v = rng.choice([v for v in b.villages if not v.capital] or [None])
                if v:
                    b.villages.remove(v)
                    a.villages.append(v)
                    self.owner[v.vid] = a.uid
        # borrado de cuentas abandonadas hace mucho
        for p in players:
            if p.quit_day is not None and self.day - p.quit_day > 18 and rng.random() < 0.04:
                p.deleted = True
                for v in p.villages:
                    self.occupied.pop((v.x, v.y), None)
                p.villages = []
        # algunos renombres
        if rng.random() < 0.3 and players:
            p = rng.choice(players)
            if p.villages:
                rng.choice(p.villages).name = self._vname(p)

    def rows(self) -> list[VillageRow]:
        out = []
        size = 2 * self.radius + 1
        for p in self.players.values():
            if p.deleted:
                continue
            tag = self.alliances.get(p.aid, "") if p.aid else ""
            for v in p.villages:
                fid = (self.radius - v.y) * size + (v.x + self.radius) + 1
                out.append(VillageRow(fid, v.x, v.y, p.tid, v.vid, v.name, p.uid, p.name,
                                      p.aid if p.uid != 1 else 0, tag if p.uid != 1 else "",
                                      max(1, int(v.pop)), None, v.capital, None, None, None))
        out.sort(key=lambda r: r.field_id)
        return out


DEMO_WORLDS = [
    # host, nombre, región, velocidad, días de vida, semilla, jugadores iniciales, tope
    ("ts1.x1.europe.travian.com", "Europe 1", "europe", 1, 58, 11, 300, 1100),
    ("ts8.x2.europe.travian.com", "Europe 8 ×2", "europe", 2, 27, 23, 260, 800),
    ("ts3.x3.international.travian.com", "International 3 ×3", "international", 3, 15, 37, 280, 750),
    ("ts5.x1.america.travian.com", "America 5", "america", 1, 41, 41, 220, 700),
    ("ts2.x5.asia.travian.com", "Asia 2 ×5", "asia", 5, 6, 53, 240, 520),
]
