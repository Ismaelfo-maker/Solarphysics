/* =========================================================================
   spacecraft.js — Nave espacial: lanzamiento, estado, clasificación
   ========================================================================= */
window.SP = window.SP || {};
(function (SP) {
  'use strict';
  const C = SP.C;

  SP.Spacecraft = {

    /**
     * Crea una nave a partir de la Tierra.
     * @param {Object} earth    cuerpo Tierra
     * @param {Object} sun      cuerpo Sol
     * @param {Number} speedKmS velocidad respecto a la Tierra (km/s)
     * @param {Number} angleDeg 0° = prograde (dirección orbital terrestre),
     *                          90° = radial hacia fuera
     * @param {Number} massKg   masa de la nave
     * @param {Number} altKm    altitud sobre la superficie terrestre
     */
    create(earth, sun, speedKmS, angleDeg, massKg, altKm) {
      altKm = altKm == null ? 200 : altKm;
      massKg = massKg == null ? 1000 : massKg;

      const rEarth = (earth.radiusKm + altKm) / C.AU_KM;   // AU
      // Dirección radial (Tierra → Sol invertido = radial hacia fuera)
      let rx = earth.pos[0] - sun.pos[0];
      let ry = earth.pos[1] - sun.pos[1];
      let rz = earth.pos[2] - sun.pos[2];
      const rn = Math.hypot(rx, ry, rz); rx /= rn; ry /= rn; rz /= rn;

      // Dirección prograde = normalizada de la velocidad terrestre
      let px = earth.vel[0], py = earth.vel[1], pz = earth.vel[2];
      const pn = Math.hypot(px, py, pz); px /= pn; py /= pn; pz /= pn;

      // Punto de lanzamiento: posición de la Tierra + rEarth * radial
      const pos = [
        earth.pos[0] + rx * rEarth,
        earth.pos[1] + ry * rEarth,
        earth.pos[2] + rz * rEarth
      ];

      // Velocidad de lanzamiento (km/s → UA/día) en el plano eclíptico
      const a = angleDeg * Math.PI / 180;
      const vKmS_to_AUday = C.DAY_S / C.AU_KM;  // 1 km/s = 0.000577 UA/día
      const vx = (Math.cos(a) * px + Math.sin(a) * rx) * speedKmS * vKmS_to_AUday;
      const vy = (Math.cos(a) * py + Math.sin(a) * ry) * speedKmS * vKmS_to_AUday;
      const vz = (Math.cos(a) * pz + Math.sin(a) * rz) * speedKmS * vKmS_to_AUday;

      const ship = {
        id: 'ship', name: 'Nave', color: '#ff4d6d',
        m: massKg / C.M_SUN,
        massKg,
        radiusKm: 0.02,
        radiusAU: 0.02 / C.AU_KM,
        pos: pos,
        vel: [earth.vel[0] + vx, earth.vel[1] + vy, earth.vel[2] + vz],
        acc: [0,0,0], _a0: [0,0,0],
        isShip: true,
        launch: {
          speedKmS, angleDeg, altKm,
          relVel: [vx, vy, vz],
          jd: null,
          origin: earth.id
        },
        trail: [],
        alive: true,
        impacted: null,
        // Energía respecto a la Tierra en el momento del lanzamiento
        launchStats: {
          vEscEarth: Math.sqrt(2 * C.G * earth.m / rEarth) / vKmS_to_AUday,
          vOrbEarth: Math.sqrt(C.G * earth.m / rEarth) / vKmS_to_AUday
        }
      };
      SP.Physics.accelerations([ship]);
      return ship;
    },

    /** Añade un punto al rastro, evitando duplicados muy próximos */
    pushTrail(ship, maxPoints) {
      maxPoints = maxPoints || 1500;
      const t = ship.trail;
      const p = ship.pos;
      if (t.length) {
        const q = t[t.length-1];
        const d2 = (p[0]-q[0])**2 + (p[1]-q[1])**2 + (p[2]-q[2])**2;
        if (d2 < 1e-12) return;
      }
      t.push([p[0], p[1], p[2]]);
      if (t.length > maxPoints) t.shift();
    }
  };
})(window.SP);
