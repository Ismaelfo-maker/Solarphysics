/* =========================================================================
   physics.js — Motor de gravedad N-cuerpos
   Integrador: Velocity Verlet (simpléctico, conserva energía)
   F = G·m1·m2 / r²
   Unidades internas: UA, masa solar, día
   ========================================================================= */
window.SP = window.SP || {};
(function (SP) {
  'use strict';
  const C = SP.C;

  SP.Physics = {

    /** Calcula aceleraciones sobre todos los cuerpos */
    accelerations(bodies) {
      const n = bodies.length;
      for (let i = 0; i < n; i++) {
        const b = bodies[i];
        b.acc[0] = 0; b.acc[1] = 0; b.acc[2] = 0;
      }
      const soft2 = C.SOFT * C.SOFT;

      for (let i = 0; i < n; i++) {
        const bi = bodies[i];
        for (let j = i + 1; j < n; j++) {
          const bj = bodies[j];
          const dx = bj.pos[0] - bi.pos[0];
          const dy = bj.pos[1] - bi.pos[1];
          const dz = bj.pos[2] - bi.pos[2];
          const r2 = dx*dx + dy*dy + dz*dz + soft2;
          const invR  = 1 / Math.sqrt(r2);
          const invR3 = invR * invR * invR;
          const f = C.G * invR3;

          const fi = f * bj.m;
          const fj = f * bi.m;

          bi.acc[0] += fi * dx; bi.acc[1] += fi * dy; bi.acc[2] += fi * dz;
          bj.acc[0] -= fj * dx; bj.acc[1] -= fj * dy; bj.acc[2] -= fj * dz;
        }
      }
    },

    /** Un paso de Velocity Verlet de tamaño dt (días) */
    step(bodies, dt) {
      const n = bodies.length;

      // 1) Drift + guardar aceleración actual
      for (let i = 0; i < n; i++) {
        const b = bodies[i];
        b._a0[0] = b.acc[0]; b._a0[1] = b.acc[1]; b._a0[2] = b.acc[2];
        b.pos[0] += b.vel[0]*dt + 0.5*b.acc[0]*dt*dt;
        b.pos[1] += b.vel[1]*dt + 0.5*b.acc[1]*dt*dt;
        b.pos[2] += b.vel[2]*dt + 0.5*b.acc[2]*dt*dt;
      }

      // 2) Recalcular aceleraciones
      this.accelerations(bodies);

      // 3) Kick final
      for (let i = 0; i < n; i++) {
        const b = bodies[i];
        b.vel[0] += 0.5*(b._a0[0] + b.acc[0])*dt;
        b.vel[1] += 0.5*(b._a0[1] + b.acc[1])*dt;
        b.vel[2] += 0.5*(b._a0[2] + b.acc[2])*dt;
      }
    },

    /** Energía cinética total (en unidades UA·M_sun/día² · M_sun) */
    kinetic(bodies) {
      let K = 0;
      for (const b of bodies) {
        const v2 = b.vel[0]*b.vel[0] + b.vel[1]*b.vel[1] + b.vel[2]*b.vel[2];
        K += 0.5 * b.m * v2;
      }
      return K;
    },

    /** Energía potencial gravitatoria total */
    potential(bodies) {
      let U = 0;
      const soft2 = C.SOFT * C.SOFT;
      for (let i = 0; i < bodies.length; i++) {
        for (let j = i + 1; j < bodies.length; j++) {
          const a = bodies[i], b = bodies[j];
          const dx = b.pos[0]-a.pos[0], dy = b.pos[1]-a.pos[1], dz = b.pos[2]-a.pos[2];
          const r = Math.sqrt(dx*dx + dy*dy + dz*dz + soft2);
          U -= C.G * a.m * b.m / r;
        }
      }
      return U;
    },

    totalEnergy(bodies) { return this.kinetic(bodies) + this.potential(bodies); },

    /** Resta el momento lineal total (evita deriva del baricentro) */
    removeDrift(bodies) {
      let px = 0, py = 0, pz = 0, mtot = 0;
      for (const b of bodies) {
        px += b.m * b.vel[0]; py += b.m * b.vel[1]; pz += b.m * b.vel[2];
        mtot += b.m;
      }
      const vx = px/mtot, vy = py/mtot, vz = pz/mtot;
      for (const b of bodies) { b.vel[0]-=vx; b.vel[1]-=vy; b.vel[2]-=vz; }
      return [vx, vy, vz];
    },

    /** Intersección segmento-esfera (para detectar impactos sin tunelado) */
    segmentHitsSphere(p0, p1, center, radius) {
      const dx = p1[0]-p0[0], dy = p1[1]-p0[1], dz = p1[2]-p0[2];
      const fx = p0[0]-center[0], fy = p0[1]-center[1], fz = p0[2]-center[2];
      const A = dx*dx+dy*dy+dz*dz;
      const B = 2*(fx*dx+fy*dy+fz*dz);
      const Cc = fx*fx+fy*fy+fz*fz - radius*radius;
      const disc = B*B - 4*A*Cc;
      if (disc < 0) return false;
      const sq = Math.sqrt(disc);
      const t1 = (-B - sq) / (2*A);
      const t2 = (-B + sq) / (2*A);
      return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1) || (t1 < 0 && t2 > 1);
    }
  };
})(window.SP);
