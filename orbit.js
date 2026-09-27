/* =========================================================================
   orbit.js — Conversión entre elementos orbitales y vectores de estado
   Algoritmo de Kepler: Newton-Raphson (convergencia cuadrática)
   Referencia: Vallado, "Fundamentals of Astrodynamics and Applications"
   ========================================================================= */
window.SP = window.SP || {};
(function (SP) {
  'use strict';
  const TAU = Math.PI * 2;

  SP.orbit = {

    /** Resuelve E - e·sin E = M  (M en radianes) */
    solveKepler(M, e) {
      M = ((M + Math.PI) % TAU + TAU) % TAU - Math.PI;
      let E = e < 0.8 ? M : Math.PI;
      for (let i = 0; i < 12; i++) {
        const f  = E - e * Math.sin(E) - M;
        const fp = 1 - e * Math.cos(E);
        const dE = f / fp;
        E -= dE;
        if (Math.abs(dE) < 1e-13) break;
      }
      return E;
    },

    /**
     * Elementos keplerianos → posición y velocidad heliocéntricas.
     * Devuelve { pos:[x,y,z], vel:[vx,vy,vz] }  (UA, UA/día)
     */
    stateFromElements(a, e, iDeg, OmDeg, wDeg, MDeg, mu) {
      const i  = iDeg  * Math.PI / 180;
      const Om = OmDeg * Math.PI / 180;
      const w  = wDeg  * Math.PI / 180;
      const M  = MDeg  * Math.PI / 180;

      const E = this.solveKepler(M, e);
      const cosE = Math.cos(E), sinE = Math.sin(E);
      const sq = Math.sqrt(1 - e * e);

      // Plano perifocal
      const xp = a * (cosE - e);
      const yp = a * sq * sinE;

      const n    = Math.sqrt(mu / (a * a * a));       // mov. medio [rad/día]
      const Edot = n / (1 - e * cosE);
      const vxp  = -a * sinE * Edot;
      const vyp  =  a * sq * cosE * Edot;

      // Rotación perifocal → eclíptica
      const cw = Math.cos(w),  sw = Math.sin(w);
      const cO = Math.cos(Om), sO = Math.sin(Om);
      const ci = Math.cos(i),  si = Math.sin(i);

      const m11 =  cw*cO - sw*sO*ci,  m12 = -sw*cO - cw*sO*ci;
      const m21 =  cw*sO + sw*cO*ci,  m22 = -sw*sO + cw*cO*ci;
      const m31 =  sw*si,             m32 =  cw*si;

      return {
        pos: [m11*xp + m12*yp, m21*xp + m22*yp, m31*xp + m32*yp],
        vel: [m11*vxp + m12*vyp, m21*vxp + m22*vyp, m31*vxp + m32*vyp]
      };
    },

    /** Vector de estado → elementos orbitales (respecto a un cuerpo central) */
    elementsFromState(r, v, mu) {
      const rMag = Math.hypot(r[0], r[1], r[2]);
      const vMag = Math.hypot(v[0], v[1], v[2]);

      const h = [
        r[1]*v[2] - r[2]*v[1],
        r[2]*v[0] - r[0]*v[2],
        r[0]*v[1] - r[1]*v[0]
      ];
      const hMag = Math.hypot(h[0], h[1], h[2]);

      const energy = vMag*vMag/2 - mu/rMag;
      const a = Math.abs(energy) > 1e-14 ? -mu / (2 * energy) : Infinity;

      // Vector excentricidad  e = (v × h)/μ − r̂
      const vxh = [
        v[1]*h[2] - v[2]*h[1],
        v[2]*h[0] - v[0]*h[2],
        v[0]*h[1] - v[1]*h[0]
      ];
      const eVec = [
        vxh[0]/mu - r[0]/rMag,
        vxh[1]/mu - r[1]/rMag,
        vxh[2]/mu - r[2]/rMag
      ];
      const e = Math.hypot(eVec[0], eVec[1], eVec[2]);

      const inc = Math.acos(Math.max(-1, Math.min(1, h[2]/hMag)));

      // Nodo ascendente
      const nVec = [-h[1], h[0], 0];
      const nMag = Math.hypot(nVec[0], nVec[1]);

      let Om = 0;
      if (nMag > 1e-12) Om = Math.acos(Math.max(-1, Math.min(1, nVec[0]/nMag)));
      if (nVec[1] < 0) Om = TAU - Om;

      // Argumento del perihelio
      let w = 0;
      if (nMag > 1e-12 && e > 1e-9) {
        const cosw = (nVec[0]*eVec[0] + nVec[1]*eVec[1] + nVec[2]*eVec[2]) / (nMag * e);
        w = Math.acos(Math.max(-1, Math.min(1, cosw)));
        if (eVec[2] < 0) w = TAU - w;
      }

      const deg = 180 / Math.PI;
      const period = (energy < 0 && a > 0) ? TAU * Math.sqrt(a*a*a/mu) : Infinity;
      const perihelio = a * (1 - e);
      const afelio    = energy < 0 ? a * (1 + e) : Infinity;
      const vEsc       = Math.sqrt(2 * mu / rMag);

      return {
        a, e, inc: inc*deg, Om: Om*deg, w: w*deg,
        energy, period, perihelio, afelio,
        rMag, vMag, hMag, vEsc,
        type: SP.orbit.classify(e, energy)
      };
    },

    classify(e, energy) {
      if (energy >= 0) {
        return e > 1.02 ? 'hiperbólica' : (e > 0.98 ? 'parabólica' : 'escape');
      }
      if (e < 0.02) return 'casi circular';
      if (e < 0.9)  return 'elíptica';
      return 'elíptica muy excéntrica';
    },

    /** Velocidad orbital circular a distancia r (UA, UA/día) */
    circularVelocity(r, mu) { return Math.sqrt(mu / r); },

    /** Velocidad de escape a distancia r */
    escapeVelocity(r, mu) { return Math.sqrt(2 * mu / r); },

    /** Transferencia de Hohmann entre dos órbitas circulares coplanares */
    hohmann(r1, r2, mu) {
      const aT = (r1 + r2) / 2;
      const v1 = Math.sqrt(mu / r1);
      const v2 = Math.sqrt(mu / r2);
      const vp = Math.sqrt(mu * (2/r1 - 1/aT));  // velocidad en periapsis de la transferencia
      const va = Math.sqrt(mu * (2/r2 - 1/aT));  // velocidad en apoapsis
      const dv1 = Math.abs(vp - v1);
      const dv2 = Math.abs(v2 - va);
      const tof = Math.PI * Math.sqrt(aT*aT*aT / mu); // tiempo de vuelo (días)
      return { aT, dv1, dv2, dvTotal: dv1 + dv2, tof, vp, va };
    }
  };
})(window.SP);
