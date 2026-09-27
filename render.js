/* =========================================================================
   render.js — Renderizador 3D propio (Canvas 2D + proyección en perspectiva)
   No usa WebGL ni librerías externas: funciona 100% offline.
   ========================================================================= */
window.SP = window.SP || {};
(function (SP) {
  'use strict';

  const TAU = Math.PI * 2;

  // Radio en píxeles "exagerado" por cuerpo (modo visual)
  const BASE_PX = {
    sun: 14, mercury: 4, venus: 5.5, earth: 5.5, moon: 2.5,
    mars: 4.5, jupiter: 10, saturn: 9, uranus: 7, neptune: 7, ship: 3
  };

  SP.Render = function (canvas) {
    const ctx = canvas.getContext('2d', { alpha: false });
    let W = 0, H = 0, DPR = 1;

    // Estrellas de fondo (fijas en el cielo)
    const stars = [];
    for (let i = 0; i < 220; i++) {
      const u = Math.random() * TAU;
      const v = Math.acos(2 * Math.random() - 1);
      stars.push({ u, v, s: Math.random() * 1.3 + 0.3, a: Math.random() * 0.7 + 0.3 });
    }

    function resize() {
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      canvas.width  = Math.floor(W * DPR);
      canvas.height = Math.floor(H * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    window.addEventListener('resize', resize);
    resize();

    // ---- Compresión de distancias (escala visual) --------------------
    function distCompress(p, mode) {
      if (mode === 'real') return p;
      const r = Math.hypot(p[0], p[1], p[2]);
      if (r < 1e-9) return p;
      const fr = Math.pow(r, 0.55);
      const k = fr / r;
      return [p[0]*k, p[1]*k, p[2]*k];
    }

    // ---- Matriz de cámara --------------------------------------------
    function buildCamera(cam, aspect) {
      const az = cam.az, el = cam.el;
      const ce = Math.cos(el), se = Math.sin(el);
      const ca = Math.cos(az), sa = Math.sin(az);
      // Posición relativa al objetivo
      const cx = cam.dist * ce * ca;
      const cy = cam.dist * ce * sa;
      const cz = cam.dist * se;
      // Ejes de la cámara
      const fx = -cx, fy = -cy, fz = -cz;   // forward (hacia el objetivo)
      const fn = Math.hypot(fx, fy, fz) || 1;
      const wx = fx/fn, wy = fy/fn, wz = fz/fn;
      // right = normalize(cross(forward, worldUp))
      const upx = 0, upy = 0, upz = 1;
      let rx = wy*upz - wz*upy, ry = wz*upx - wx*upz, rz = wx*upy - wy*upx;
      const rn = Math.hypot(rx, ry, rz) || 1;
      rx /= rn; ry /= rn; rz /= rn;
      // up = cross(right, forward)
      const ux = ry*wz - rz*wy, uy = rz*wx - rx*wz, uz = rx*wy - ry*wx;

      const fov = 50 * Math.PI / 180;
      const focal = (H / 2) / Math.tan(fov / 2);

      return {
        cx, cy, cz, rx, ry, rz, ux, uy, uz, wx, wy, wz, focal,
        target: cam.target
      };
    }

    function project(p, camMat) {
      const dx = p[0] - camMat.target[0];
      const dy = p[1] - camMat.target[1];
      const dz = p[2] - camMat.target[2];

      const camX = dx*camMat.rx + dy*camMat.ry + dz*camMat.rz;
      const camY = dx*camMat.ux + dy*camMat.uy + dz*camMat.uz;
      const camZ = dx*camMat.wx + dy*camMat.wy + dz*camMat.wz;

      // camZ > 0 significa delante de la cámara (forward = -view)
      // Usamos profundidad = distancia proyectada a lo largo del forward.
      // Como forward apunta al objetivo, la profundidad del punto respecto
      // a la cámara es:  -((p - camPos)·forward)   (negada)
      const camPos = [camMat.target[0] + camMat.cx,
                      camMat.target[1] + camMat.cy,
                      camMat.target[2] + camMat.cz];
      const vx = p[0] - camPos[0], vy = p[1] - camPos[1], vz = p[2] - camPos[2];
      const depth = vx*camMat.wx + vy*camMat.wy + vz*camMat.wz;
      if (depth <= 0.001) return null;

      const sx = W/2 + camX * camMat.focal / depth;
      const sy = H/2 - camY * camMat.focal / depth;
      return { x: sx, y: sy, depth };
    }

    // ---- API pública --------------------------------------------------
    return {
      ctx, get W(){return W;}, get H(){return H;},
      resize,

      clear() {
        // Fondo degradado
        const g = ctx.createRadialGradient(W*0.5, H*0.5, 0, W*0.5, H*0.5, Math.max(W,H)*0.8);
        g.addColorStop(0, '#0a0a1f');
        g.addColorStop(1, '#02020a');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      },

      drawStars(cam) {
        // Proyecta las estrellas como puntos lejanos (r = 1e6)
        const camMat = buildCamera(cam, W/H);
        ctx.save();
        for (const s of stars) {
          const x = 1e6 * Math.sin(s.v) * Math.cos(s.u);
          const y = 1e6 * Math.sin(s.v) * Math.sin(s.u);
          const z = 1e6 * Math.cos(s.v);
          // Ignora la traslación del objetivo: usa directamente rotación
          const camX = x*camMat.rx + y*camMat.ry + z*camMat.rz;
          const camY = x*camMat.ux + y*camMat.uy + z*camMat.uz;
          const camZ = x*camMat.wx + y*camMat.wy + z*camMat.wz;
          if (camZ <= 0) continue;
          const sx = W/2 + camX * camMat.focal / camZ;
          const sy = H/2 - camY * camMat.focal / camZ;
          if (sx < 0 || sx > W || sy < 0 || sy > H) continue;
          ctx.globalAlpha = s.a;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(sx, sy, s.s, s.s);
        }
        ctx.globalAlpha = 1;
        ctx.restore();
      },

      /** Dibuja una polilínea 3D transformada */
      drawPolyline(points, cam, style) {
        if (!points || points.length < 2) return;
        const camMat = buildCamera(cam, W/H);
        ctx.save();
        ctx.strokeStyle = style.color || '#ffffff';
        ctx.lineWidth   = style.width || 1.5;
        ctx.globalAlpha = style.alpha != null ? style.alpha : 1;
        if (style.dashed) ctx.setLineDash(style.dashed);
        ctx.beginPath();
        let started = false;
        for (let i = 0; i < points.length; i++) {
          const pp = project(points[i], camMat);
          if (!pp) { started = false; continue; }
          if (!started) { ctx.moveTo(pp.x, pp.y); started = true; }
          else ctx.lineTo(pp.x, pp.y);
        }
        ctx.stroke();
        ctx.restore();
      },

      /**
       * Dibuja el marco completo.
       * data = {
       *   cam, bodies, ship, orbits (mapa id -> array de puntos),
       *   selection, showOrbits, distanceMode, sizeMode, viewport
       * }
       */
      draw(data) {
        const cam = data.cam;
        const camMat = buildCamera(cam, W/H);
        const dmode = data.distanceMode;

        // Reúne puntos a dibujar con su profundidad para ordenar
        const items = [];

        // --- Órbitas
        if (data.showOrbits && data.orbits) {
          for (const id in data.orbits) {
            const body = data.bodies.find(b => b.id === id);
            if (!body) continue;
            const pts = data.orbits[id].map(p => {
              const wp = [p[0] + (body.isSun ? 0 : 0), p[1], p[2]];
              return dmode === 'real' ? wp : distCompress(wp, dmode);
            });
            this.drawPolyline(pts, cam, {
              color: body.color, width: 1, alpha: 0.35
            });
          }
        }

        // --- Rastro de la nave
        if (data.ship && data.ship.trail && data.ship.trail.length > 1) {
          const pts = data.ship.trail.map(p => dmode === 'real' ? p : distCompress(p, dmode));
          this.drawPolyline(pts, cam, { color: '#ff4d6d', width: 2, alpha: 0.9 });
        }

        // --- Cuerpos
        const drawnBodies = [];
        for (const b of data.bodies) {
          const wp = dmode === 'real' ? b.pos : distCompress(b.pos, dmode);
          const pp = project(wp, camMat);
          if (!pp) continue;

          let r;
          if (data.sizeMode === 'real') {
            r = Math.max(1.2, b.radiusAU * camMat.focal / pp.depth);
          } else {
            const base = BASE_PX[b.id] || 3;
            // Escala suave con la distancia del objetivo
            const k = Math.max(0.55, Math.min(2.2, 2.2 / Math.pow(cam.dist, 0.28)));
            r = base * k * (data.sizeMul || 1);
          }
          drawnBodies.push({ b, x: pp.x, y: pp.y, depth: pp.depth, r });
        }

        // Nave
        if (data.ship && data.ship.alive) {
          const wp = dmode === 'real' ? data.ship.pos : distCompress(data.ship.pos, dmode);
          const pp = project(wp, camMat);
          if (pp) drawnBodies.push({
            b: data.ship, x: pp.x, y: pp.y, depth: pp.depth,
            r: (BASE_PX.ship || 3) * (data.sizeMul || 1) * 1.6, isShip: true
          });
        }

        // Ordena por profundidad (lejano → cercano)
        drawnBodies.sort((a, b) => b.depth - a.depth);

        for (const d of drawnBodies) {
          const b = d.b;
          // Halo
          const grad = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r * 2.8);
          grad.addColorStop(0, b.color);
          grad.addColorStop(0.45, b.color + '66');
          grad.addColorStop(1, 'transparent');
          ctx.fillStyle = grad;
          ctx.beginPath(); ctx.arc(d.x, d.y, d.r * 2.8, 0, TAU); ctx.fill();

          // Disco
          ctx.fillStyle = b.color;
          ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, TAU); ctx.fill();

          if (d.isShip) {
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2;
            ctx.beginPath(); ctx.arc(d.x, d.y, d.r + 3, 0, TAU); ctx.stroke();
          }

          // Etiqueta
          if (d.r >= 2.5 || b.isShip) {
            ctx.font = '11px system-ui, -apple-system, sans-serif';
            ctx.fillStyle = '#ffffffcc';
            ctx.textAlign = 'center';
            ctx.fillText(b.name, d.x, d.y - d.r - 5);
          }

          // Marca de selección
          if (data.selection && b.id === data.selection) {
            ctx.strokeStyle = '#00e5ff';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.beginPath(); ctx.arc(d.x, d.y, d.r + 8, 0, TAU); ctx.stroke();
            ctx.setLineDash([]);
          }
        }
      }
    };
  };
})(window.SP);
