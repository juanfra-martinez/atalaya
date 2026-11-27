/* Datos del juego: estadísticas de tropas, tipos de casilla y animales de los oasis. Sin DOM.

   Tropas de romanos, germanos, galos, egipcios y hunos: copiadas del manual del propio juego
   (/api/v1/manual/troop/N, mundo International 7, 18 nov 2026). Los tiempos de formación son los del manual:
   edificio a nivel 1 en un mundo ×1. Espartanos y vikingos no existen en ese mundo: ver la nota junto a sus datos. */
"use strict";
(() => {
  const A = window.A;

  /* Por unidad: [ataque, defensa contra infantería, defensa contra caballería, madera, barro, hierro, cereal,
     consumo de cereal por hora, formación en segundos, 1 si es caballería]. Mismo orden que A.UNITS. */
  A.STATS = {
    1: [[40, 35, 50, 120, 100, 150, 30, 1, 1600, 0], [30, 65, 35, 100, 130, 160, 70, 1, 1760, 0], [70, 40, 25, 150, 160, 210, 80, 1, 1920, 0],
      [0, 20, 10, 140, 160, 20, 40, 2, 1360, 1], [120, 65, 50, 550, 440, 320, 100, 3, 2640, 1], [180, 80, 105, 550, 640, 800, 180, 4, 3520, 1],
      [60, 30, 75, 900, 360, 500, 70, 3, 4600, 0], [75, 60, 10, 950, 1350, 600, 90, 6, 9000, 0], [50, 40, 30, 30750, 27200, 45000, 37500, 5, 90700, 0],
      [0, 80, 80, 4600, 4200, 5800, 4400, 1, 26900, 0]],
    2: [[40, 20, 5, 95, 75, 40, 40, 1, 720, 0], [10, 35, 60, 145, 70, 85, 40, 1, 1120, 0], [60, 30, 30, 130, 120, 170, 70, 1, 1200, 0],
      [0, 10, 5, 160, 100, 50, 50, 1, 1120, 0], [55, 100, 40, 370, 270, 290, 75, 2, 2400, 1], [150, 50, 75, 450, 515, 480, 80, 3, 2960, 1],
      [65, 30, 80, 1000, 300, 350, 70, 3, 4200, 0], [50, 60, 10, 900, 1200, 600, 60, 6, 9000, 0], [40, 60, 40, 35500, 26600, 25000, 27200, 4, 70500, 0],
      [10, 80, 80, 5800, 4400, 4600, 5200, 1, 31000, 0]],
    3: [[15, 40, 50, 100, 130, 55, 30, 1, 1040, 0], [65, 35, 20, 140, 150, 185, 60, 1, 1440, 0], [0, 20, 10, 170, 150, 20, 40, 2, 1360, 1],
      [100, 25, 40, 350, 450, 230, 60, 2, 2480, 1], [45, 115, 55, 360, 330, 280, 120, 2, 2560, 1], [140, 60, 165, 500, 620, 675, 170, 3, 3120, 1],
      [50, 30, 105, 950, 555, 330, 75, 3, 5000, 0], [70, 45, 10, 960, 1450, 630, 90, 6, 9000, 0], [40, 50, 50, 30750, 45400, 31000, 37500, 4, 90700, 0],
      [0, 80, 80, 4400, 5600, 4200, 3900, 1, 22700, 0]],
    6: [[10, 30, 20, 45, 60, 30, 15, 1, 530, 0], [30, 55, 40, 115, 100, 145, 60, 1, 1380, 0], [65, 50, 20, 170, 180, 220, 80, 1, 1440, 0],
      [0, 20, 10, 170, 150, 20, 40, 2, 1360, 1], [50, 110, 50, 360, 330, 280, 120, 2, 2560, 1], [110, 120, 150, 450, 560, 610, 180, 3, 3240, 1],
      [55, 30, 95, 995, 575, 340, 80, 3, 4800, 0], [65, 55, 10, 980, 1510, 660, 100, 6, 9000, 0], [40, 50, 50, 34000, 50000, 34000, 42000, 4, 90700, 0],
      [0, 80, 80, 5040, 6510, 4830, 4620, 1, 24800, 0]],
    7: [[35, 40, 30, 130, 80, 40, 40, 1, 810, 0], [50, 30, 10, 140, 110, 60, 60, 1, 1120, 0], [0, 20, 10, 170, 150, 20, 40, 2, 1360, 1],
      [120, 30, 15, 290, 370, 190, 45, 2, 2400, 1], [110, 80, 70, 320, 350, 330, 50, 2, 2480, 1], [180, 60, 40, 450, 560, 610, 140, 3, 2990, 1],
      [65, 30, 90, 1060, 330, 360, 70, 3, 4400, 0], [45, 55, 10, 950, 1280, 620, 60, 6, 9000, 0], [50, 40, 30, 37200, 27600, 25200, 27600, 4, 90700, 0],
      [10, 80, 80, 6100, 4600, 4800, 5400, 1, 28950, 0]],
    /* Espartanos y vikingos: tablas públicas de Kirilloid (units.js, nov. 2026), que en las otras cinco tribus
       coinciden cifra a cifra con el manual. Dudas conocidas: el consumo del ariete vikingo (3 según el soporte de
       Travian, que es lo que va aquí; 2 según Kirilloid) y la formación del éforo (77550 s; otra tabla da 8 h). */
    8: [[50, 35, 30, 110, 185, 110, 35, 1, 1700, 0], [0, 40, 22, 185, 150, 35, 75, 1, 1232, 0], [40, 85, 45, 145, 95, 245, 45, 1, 1936, 0],
      [90, 55, 40, 130, 200, 400, 65, 1, 2112, 0], [55, 120, 90, 555, 445, 330, 110, 2, 2816, 1], [195, 80, 75, 660, 495, 995, 165, 3, 3432, 1],
      [65, 30, 80, 525, 260, 790, 130, 3, 4620, 0], [50, 60, 10, 550, 1240, 825, 135, 6, 9900, 0], [40, 60, 40, 33450, 30665, 36240, 13935, 4, 77550, 0],
      [10, 80, 80, 5115, 5580, 6045, 3255, 1, 34100, 0]],
    9: [[45, 22, 5, 95, 80, 50, 40, 1, 800, 0], [20, 50, 30, 125, 70, 85, 40, 1, 1080, 0], [70, 30, 25, 235, 220, 200, 70, 2, 1550, 0],
      [0, 10, 5, 155, 95, 50, 50, 1, 1120, 0], [45, 95, 100, 385, 295, 290, 85, 2, 2650, 1], [160, 50, 75, 475, 535, 515, 100, 2, 3060, 1],
      [65, 30, 80, 950, 325, 375, 70, 3, 4200, 0], [50, 60, 10, 850, 1225, 625, 60, 6, 9000, 0], [40, 40, 60, 35500, 26600, 25000, 27200, 4, 70500, 0],
      [10, 80, 80, 5800, 4600, 4800, 4800, 1, 31000, 0]],
  };

  /* Totales de un ejército: counts[i] es el número de unidades del tipo i de la tribu tid.
     El ataque se separa en infantería y caballería porque el defensor aplica una defensa distinta a cada una. */
  A.armyTotals = (tid, counts) => {
    const stats = A.STATS[tid], units = A.UNITS[tid];
    if (!stats || !units) return null;
    const o = { n: 0, attInf: 0, attCav: 0, defInf: 0, defCav: 0, cost: [0, 0, 0, 0], upkeep: 0, carry: 0, train: 0, slowest: null };
    stats.forEach((s, i) => {
      const n = Math.max(0, Math.floor(+counts[i] || 0));
      if (!n) return;
      o.n += n;
      if (s[9]) o.attCav += n * s[0]; else o.attInf += n * s[0];
      o.defInf += n * s[1]; o.defCav += n * s[2];
      for (let r = 0; r < 4; r++) o.cost[r] += n * s[3 + r];
      o.upkeep += n * s[7]; o.carry += n * (units[i][3] || 0); o.train += n * s[8];
      if (o.slowest == null || units[i][2] < units[o.slowest][2]) o.slowest = i;
    });
    o.att = o.attInf + o.attCav;
    o.total = o.cost.reduce((a, b) => a + b, 0);
    return o;
  };

  /* Cuántas unidades del tipo i salen con unos recursos. Sin cambio de mercado manda el recurso más escaso;
     con cambio de mercado (NPC) los cuatro recursos se reparten a medida y solo cuenta el total. */
  A.maxUnits = (tid, i, res, npc = false) => {
    const s = A.STATS[tid]?.[i];
    if (!s) return null;
    const have = res.map((x) => Math.max(0, +x || 0));
    const cost = s.slice(3, 7), total = cost.reduce((a, b) => a + b, 0);
    if (npc) return Math.floor(have.reduce((a, b) => a + b, 0) / total);
    return Math.min(...cost.map((c, r) => (c ? Math.floor(have[r] / c) : Infinity)));
  };

  /* Rendimiento por unidad, para comparar tropas de una tribu: puntos por cada 1000 recursos y por cereal/hora. */
  A.unitValue = (tid, i) => {
    const s = A.STATS[tid]?.[i], u = A.UNITS[tid]?.[i];
    if (!s || !u) return null;
    const total = s[3] + s[4] + s[5] + s[6], k = 1000 / total;
    return { att: s[0], defInf: s[1], defCav: s[2], total, upkeep: s[7], train: s[8], cav: !!s[9], speed: u[2], carry: u[3],
      attPerK: s[0] * k, defPerK: ((s[1] + s[2]) / 2) * k, attPerCrop: s[0] / s[7], defPerCrop: (s[1] + s[2]) / 2 / s[7], carryPerK: (u[3] || 0) * k };
  };

  /* Tipos de casilla libre: la clave del juego ({k.f1}…{k.f13}) → campos de madera, barro, hierro y cereal.
     Copiado de las traducciones del propio juego (karte.json, claves f1…f13, International 7, 19 nov 2026).
     El 13 (0-0-0-18) solo existe en los mundos con la regla crop18. */
  A.FIELDS = {
    1: [3, 3, 3, 9], 2: [3, 4, 5, 6], 3: [4, 4, 4, 6], 4: [4, 5, 3, 6], 5: [5, 3, 4, 6], 6: [1, 1, 1, 15],
    7: [4, 4, 3, 7], 8: [3, 4, 4, 7], 9: [4, 3, 4, 7], 10: [3, 5, 4, 6], 11: [4, 3, 5, 6], 12: [5, 4, 3, 6],
    13: [0, 0, 0, 18],
  };

  /* Animales de los oasis (unidades 31…40 del juego): [ES, EN, ataque, def. infantería, def. caballería, consumo].
     El manual del juego no da sus estadísticas: son los valores públicos de las tablas de la comunidad. */
  A.ANIMALS = {
    31: ["Rata", "Rat", 10, 25, 20, 1], 32: ["Araña", "Spider", 20, 35, 40, 1], 33: ["Serpiente", "Snake", 60, 40, 60, 1],
    34: ["Murciélago", "Bat", 80, 66, 50, 1], 35: ["Jabalí", "Wild boar", 50, 70, 33, 2], 36: ["Lobo", "Wolf", 100, 80, 70, 2],
    37: ["Oso", "Bear", 250, 140, 200, 3], 38: ["Cocodrilo", "Crocodile", 450, 380, 240, 3], 39: ["Tigre", "Tiger", 200, 170, 250, 3],
    40: ["Elefante", "Elephant", 600, 440, 520, 5],
  };
  A.animalName = (id) => A.ANIMALS[id]?.[A.lang === "en" ? 1 : 0] || "#" + id;
})();
