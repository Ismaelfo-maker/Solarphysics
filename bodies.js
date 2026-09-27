/* =========================================================================
   bodies.js — Construcción del Sistema Solar real en el instante JD
   ========================================================================= */
window.SP = window.SP || {};
(function (SP) {
  'use strict';
  const C = SP.C;

  function mkBody(id, name, color, massKg, radiusKm, pos, vel, opts) {
    return Object.assign({
      id, name, color,
      m: massKg / C.M_SUN,
      massKg,
      radiusKm,
      radiusAU: radiusKm / C.AU_KM,
      pos: pos.slice(),
      vel: vel.slice(),
      acc: [0,0,0],
      _a0: [0,0,0],
      isShip: false
    }, opts || {});
  }

  SP.buildSolarSystem = function (jd) {
    const bodies = [];
    const mu = C.G * 1.0; // μ Sol (M=1)

    // ---- Sol (pos. y vel. iniciales = 0; se corrigen tras el baricentro)
    const sun = mkBody('sun', 'Sol', SP.SUN.color, SP.SUN.massKg, SP.SUN.radiusKm,
                       [0,0,0], [0,0,0], { isSun: true, gravity: SP.SUN.gravity });
    bodies.push(sun);

    // ---- Planetas
    const T = (jd - C.J2000) / 36525; // siglos julianos desde J2000
    const planetRecords = {};

    for (const p of SP.PLANET_DATA) {
      const el = p.el, rt = p.rate;
      const a  = el.a  + rt.a  * T;
      const e  = el.e  + rt.e  * T;
      const I  = el.I  + rt.I  * T;
      const L  = el.L  + rt.L  * T;
      const Lp = el.Lp + rt.Lp * T;
      const N  = el.N  + rt.N  * T;

      const w  = Lp - N;
      const M  = L - Lp;

      const s = SP.orbit.stateFromElements(a, e, I, N, w, M, mu);

      const b = mkBody(p.id, p.name, p.color, p.massKg, p.radiusKm, s.pos, s.vel, {
        elements: { a, e, i: I, Om: N, w, M },
        moons: p.moons, gravity: p.gravity, rotPeriod: p.rotPeriod
      });
      bodies.push(b);
      planetRecords[p.id] = b;
    }

    // ---- Luna (órbita geocéntrica simplificada)
    const earth = planetRecords.earth;
    if (earth) {
      const M = SP.MOON;
      const muEarth = C.G * earth.m;
      // Fase lunar aproximada al J2000 (longitud media ≈ 218.316°)
      const moonEl = {
        a: M.aAU, e: M.e, i: M.i, Om: 125.08, w: 318.15,
        M0: 135.27 + 13.064992 * (jd - C.J2000)   // movimiento medio real (deg/día)
      };
      const ms = SP.orbit.stateFromElements(
        moonEl.a, moonEl.e, moonEl.i, moonEl.Om, moonEl.w, moonEl.M0, muEarth
      );
      const moon = mkBody('moon', 'Luna', M.color, M.massKg, M.radiusKm,
        [earth.pos[0]+ms.pos[0], earth.pos[1]+ms.pos[1], earth.pos[2]+ms.pos[2]],
        [earth.vel[0]+ms.vel[0], earth.vel[1]+ms.vel[1], earth.vel[2]+ms.vel[2]],
        { parent: 'earth', gravity: M.gravity, rotPeriod: M.rotPeriod });
      bodies.push(moon);
    }

    // Elimina la deriva del baricentro
    SP.Physics.removeDrift(bodies);
    SP.Physics.accelerations(bodies);

    return bodies;
  };

  /** Vector de posición del Sol en una lista de cuerpos */
  SP.findBody = (bodies, id) => bodies.find(b => b.id === id);
  SP.sunOf    = (bodies) => bodies.find(b => b.isSun);

})(window.SP);
