/* =========================================================================
   data.js — Constantes físicas y datos astronómicos reales
   Fuentes:
   - CODATA 2018 (G, masas atómicas)
   - IAU 2012 (AU = 149 597 870 700 m exactos)
   - JPL Solar System Dynamics: "Approximate Positions of the Planets"
     (https://ssd.jpl.nasa.gov/planets/approx_pos.html)
   - NASA Planetary Fact Sheet (masas, radios, gravedad, lunas)
   ========================================================================= */
window.SP = window.SP || {};
(function (SP) {
  'use strict';

  SP.C = {
    G_SI: 6.67430e-11,          // m^3 kg^-1 s^-2
    AU_M: 1.495978707e11,       // m  (IAU 2012, exacto)
    AU_KM: 1.495978707e8,       // km
    DAY_S: 86400,               // s
    M_SUN: 1.98892e30,          // kg
    M_EARTH: 5.97237e24,        // kg
    R_EARTH_KM: 6371.0,
    K_GAUSS: 0.01720209895,     // constante gravitacional gaussiana (UA^1.5/día)
    G: 2.959122082855911e-4,    // UA^3 / (M_sun · día^2)  = k^2
    J2000: 2451545.0,
    SOFT: 1e-6                  // suavizado gravitatorio (UA) ≈ 150 km
  };

  // ---------------------------------------------------------------------
  // Elementos orbitales medios + tasas por siglo juliano (JPL)
  //   a  [UA]      semieje mayor
  //   e            excentricidad
  //   I  [°]       inclinación
  //   L  [°]       longitud media
  //   Lp [°]       longitud del perihelio  (ϖ)
  //   N  [°]       longitud del nodo ascendente (Ω)
  // ---------------------------------------------------------------------
  SP.PLANET_DATA = [
    {
      id: 'mercury', name: 'Mercurio', color: '#a89880',
      massKg: 3.3011e23, radiusKm: 2439.7, moons: 0, gravity: 3.70,
      rotPeriod: '58,646 d',
      el:  { a: 0.38709927, e: 0.20563593, I: 7.00497902, L: 252.25032350, Lp: 77.45779628, N: 48.33076593 },
      rate:{ a: 0.00000037, e: 0.00001906, I:-0.00594749, L:149472.67411175, Lp: 0.16047689, N:-0.12534081 }
    },
    {
      id: 'venus', name: 'Venus', color: '#e6cfa0',
      massKg: 4.8675e24, radiusKm: 6051.8, moons: 0, gravity: 8.87,
      rotPeriod: '−243,025 d',
      el:  { a: 0.72333566, e: 0.00677672, I: 3.39467605, L: 181.97909950, Lp: 131.60246718, N: 76.67984255 },
      rate:{ a: 0.00000390, e:-0.00004107, I:-0.00078890, L: 58517.81538729, Lp: 0.00268329, N:-0.27769418 }
    },
    {
      id: 'earth', name: 'Tierra', color: '#4a90e2',
      massKg: 5.97237e24, radiusKm: 6371.0, moons: 1, gravity: 9.807,
      rotPeriod: '0,99727 d',
      el:  { a: 1.00000261, e: 0.01671123, I:-0.00001531, L: 100.46457166, Lp: 102.93768193, N: 0.0 },
      rate:{ a: 0.00000562, e:-0.00004392, I:-0.01294668, L: 35999.37244981, Lp: 0.32327364, N: 0.0 }
    },
    {
      id: 'mars', name: 'Marte', color: '#c1440e',
      massKg: 6.4171e23, radiusKm: 3389.5, moons: 2, gravity: 3.721,
      rotPeriod: '1,02595 d',
      el:  { a: 1.52371034, e: 0.09339410, I: 1.84969142, L:  -4.55343205, Lp: -23.94362959, N: 49.55953891 },
      rate:{ a: 0.00001847, e: 0.00007882, I:-0.00813131, L: 19140.30268499, Lp: 0.44441088, N:-0.29257343 }
    },
    {
      id: 'jupiter', name: 'Júpiter', color: '#d8ca9d',
      massKg: 1.8982e27, radiusKm: 69911, moons: 95, gravity: 24.79,
      rotPeriod: '0,41354 d',
      el:  { a: 5.20288700, e: 0.04838624, I: 1.30439695, L:  34.39644051, Lp:  14.72847983, N: 100.47390909 },
      rate:{ a:-0.00011607, e:-0.00013253, I:-0.00183714, L: 3034.74612775, Lp: 0.21252668, N: 0.20469106 }
    },
    {
      id: 'saturn', name: 'Saturno', color: '#e0c080',
      massKg: 5.6834e26, radiusKm: 58232, moons: 146, gravity: 10.44,
      rotPeriod: '0,44401 d',
      el:  { a: 9.53667594, e: 0.05386179, I: 2.48599187, L:  49.95424423, Lp:  92.59887831, N: 113.66242448 },
      rate:{ a:-0.00125060, e:-0.00050991, I: 0.00193609, L: 1222.49362201, Lp:-0.41897216, N:-0.28867794 }
    },
    {
      id: 'uranus', name: 'Urano', color: '#9fd6e6',
      massKg: 8.6810e25, radiusKm: 25362, moons: 28, gravity: 8.69,
      rotPeriod: '−0,71833 d',
      el:  { a: 19.18916464, e: 0.04725744, I: 0.77263783, L: 313.23810451, Lp: 170.95427630, N: 74.01692503 },
      rate:{ a:-0.00196176, e:-0.00004397, I:-0.00242939, L:  428.48202785, Lp: 0.40805281, N: 0.04240589 }
    },
    {
      id: 'neptune', name: 'Neptuno', color: '#3f5efb',
      massKg: 1.02413e26, radiusKm: 24622, moons: 16, gravity: 11.15,
      rotPeriod: '0,67125 d',
      el:  { a: 30.06992276, e: 0.00859048, I: 1.77004347, L: -55.12002969, Lp:  44.96476227, N: 131.78422574 },
      rate:{ a: 0.00026291, e: 0.00005105, I: 0.00035372, L: 218.45945325, Lp:-0.32241464, N:-0.00508664 }
    }
  ];

  // La Luna (órbita geocéntrica — se inicializa relativa a la Tierra)
  SP.MOON = {
    id: 'moon', name: 'Luna', color: '#c8c8c8',
    massKg: 7.342e22, radiusKm: 1737.4, gravity: 1.62, moons: 0,
    rotPeriod: '27,32 d',
    aAU: 384400 / SP.C.AU_KM,  // ≈ 0,00256955 UA
    e: 0.0549,
    i: 5.145,
    period: 27.321661           // días
  };

  SP.SUN = {
    id: 'sun', name: 'Sol', color: '#ffd24a',
    massKg: SP.C.M_SUN, radiusKm: 696340, gravity: 274.0,
    rotPeriod: '25,38 d'
  };

  // ---------------------------------------------------------------------
  // Utilidades de fecha
  // ---------------------------------------------------------------------
  SP.dateToJD = function (y, m, d) {
    if (m <= 2) { y -= 1; m += 12; }
    const A = Math.floor(y / 100);
    const B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
  };

  SP.jdToDate = function (jd) {
    const z = Math.floor(jd + 0.5);
    const f = jd + 0.5 - z;
    let a = z;
    if (z >= 2299161) {
      const al = Math.floor((z - 1867216.25) / 36524.25);
      a = z + 1 + al - Math.floor(al / 4);
    }
    const b = a + 1524;
    const c = Math.floor((b - 122.1) / 365.25);
    const d = Math.floor(365.25 * c);
    const e = Math.floor((b - d) / 30.6001);
    const day = b - d - Math.floor(30.6001 * e) + f;
    const month = e < 14 ? e - 1 : e - 13;
    const year = month > 2 ? c - 4716 : c - 4715;
    return { year, month, day: Math.floor(day), frac: day - Math.floor(day) };
  };

  SP.jdToISO = function (jd) {
    const d = SP.jdToDate(jd);
    return `${d.year}-${String(d.month).padStart(2,'0')}-${String(d.day).padStart(2,'0')}`;
  };

})(window.SP);
