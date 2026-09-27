/* =========================================================================
   app.js — Aplicación principal: estado, bucle, UI, modos
   ========================================================================= */
(function (SP) {
  'use strict';
  const C = SP.C;
  const V = SP.Vec = {
    add:(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],
    sub:(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],
    mag:(a)=>Math.hypot(a[0],a[1],a[2]),
    dist:(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2])
  };

  // -----------------------------------------------------------------------
  // Estado global
  // -----------------------------------------------------------------------
  const S = SP.State = {
    mode: 'solar',
    running: false,
    timeScale: 1e6,          // segundos de simulación por segundo real
    jd: C.J2000,
    baseTimeStep: 0.02,      // días
    bodies: [],
    ship: null,
    selected: 'earth',
    camera: { az: 0.9, el: 0.65, dist: 3.0, target: [0, 0, 0], follow: 'sun' },
    distanceMode: 'compressed',
    sizeMode: 'visual',
    sizeMul: 1,
    showOrbits: true,
    showLabels: true,
    E0: 0, Ecurrent: 0, energyErr: 0,
    lastFrameMs: 0, cappedWarning: false
  };

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  let R, canvas;
  function initCanvas() {
    canvas = document.getElementById('scene');
    R = SP.Render(canvas);
    attachCameraControls(canvas);
  }

  // -----------------------------------------------------------------------
  // Construcción del sistema
  // -----------------------------------------------------------------------
  function buildSystem(jd) {
    S.jd = jd;
    S.bodies = SP.buildSolarSystem(jd);
    S.ship = null;
    S.orbits = null;
    S.E0 = SP.Physics.totalEnergy(S.bodies);
    S.Ecurrent = S.E0;
    computeOrbits();
    updateUI();
  }

  /** Precalcula las elipses orbitales (128 puntos por órbita) */
  function computeOrbits() {
    const orbits = {};
    const mu = C.G;
    const sun = S.bodies.find(b => b.isSun);

    for (const b of S.bodies) {
      if (b.isSun || b.isShip) continue;
      if (b.id === 'moon') continue; // la luna se dibuja como cuerpo suelto
      const el = b.elements;
      if (!el) continue;
      const pts = [];
      const N = 128;
      for (let k = 0; k <= N; k++) {
        const M = (k / N) * 360;
        const s = SP.orbit.stateFromElements(el.a, el.e, el.i, el.Om, el.w, M, mu);
        pts.push([s.pos[0] + sun.pos[0], s.pos[1] + sun.pos[1], s.pos[2] + sun.pos[2]]);
      }
      orbits[b.id] = pts;
    }
    S.orbits = orbits;
  }

  // -----------------------------------------------------------------------
  // Bucle de simulación
  // -----------------------------------------------------------------------
  let acc = 0;

  function advanceSim(days) {
    const MAXSTEPS = 80;
    let remaining = days;
    let steps = 0;
    let minDtApplied = Infinity;

    while (remaining > 1e-12 && steps < MAXSTEPS) {
      let dt = Math.min(S.baseTimeStep, remaining);

      // Paso adaptativo cerca de cuerpos masivos (solo si hay nave)
      if (S.ship && S.ship.alive) {
        dt = Math.min(dt, adaptiveDt(S.ship));
      }
      if (dt < S.baseTimeStep / 200) dt = S.baseTimeStep / 200;
      minDtApplied = Math.min(minDtApplied, dt);

      // Guarda posición previa de la nave para detección de impacto
      const prev = S.ship && S.ship.alive ? S.ship.pos.slice() : null;

      SP.Physics.step(S.bodies, dt);

      if (S.ship && S.ship.alive && prev) {
        checkImpacts(prev);
      }
      if (S.ship && S.ship.alive) SP.Spacecraft.pushTrail(S.ship, 1500);

      remaining -= dt;
      steps++;
    }

    S.jd += days;
    S.cappedWarning = steps >= MAXSTEPS && remaining > 1e-9;

    // Diagnósticos
    const allBodies = S.ship ? S.bodies.concat([S.ship]) : S.bodies;
    S.Ecurrent = SP.Physics.totalEnergy(allBodies);
    S.energyErr = Math.abs((S.Ecurrent - S.E0) / (Math.abs(S.E0) || 1));
  }

  function adaptiveDt(ship) {
    let dt = S.baseTimeStep;
    for (const b of S.bodies) {
      if (b === ship) continue;
      const r = V.dist(ship.pos, b.pos);
      const v = V.dist(ship.vel, b.vel);
      const lim = Math.max(b.radiusAU * 25, 1e-5);
      if (r < lim) {
        const tEnc = r / Math.max(v, 1e-9);
        dt = Math.min(dt, Math.max(tEnc * 0.03, S.baseTimeStep / 200));
      }
    }
    return dt;
  }

  function checkImpacts(prevPos) {
    const ship = S.ship;
    for (const b of S.bodies) {
      if (b.isShip) continue;
      const rHit = b.radiusAU * 1.02;
      if (SP.Physics.segmentHitsSphere(prevPos, ship.pos, b.pos, rHit)) {
        ship.alive = false;
        ship.impacted = b.id;
        toast(`💥 Impacto con ${b.name}`);
        return;
      }
    }
    // Encuentro cercano con Júpiter (misión 8)
    const jup = S.bodies.find(b => b.id === 'jupiter');
    if (jup) {
      const d = V.dist(ship.pos, jup.pos);
      if (d < 0.5) SP.Store.setFlag('jupiter_flyby');
    }
  }

  // -----------------------------------------------------------------------
  // Bucle de render
  // -----------------------------------------------------------------------
  function frame(now) {
    const dtReal = Math.min((now - S.lastFrameMs) / 1000, 0.1);
    S.lastFrameMs = now;

    if (S.running) {
      const simSeconds = dtReal * S.timeScale;
      const simDays = simSeconds / C.DAY_S;
      advanceSim(simDays);
    }

    // Cámara: seguir objetivo
    if (S.camera.follow) {
      const t = S.camera.follow === 'ship'
        ? S.ship
        : S.bodies.find(b => b.id === S.camera.follow);
      if (t && t.alive !== false) {
        const p = applyDistance(t.pos);
        S.camera.target[0] = p[0];
        S.camera.target[1] = p[1];
        S.camera.target[2] = p[2];
      }
    }

    render();
    requestAnimationFrame(frame);
  }

  function applyDistance(p) {
    if (S.distanceMode === 'real') return p;
    const r = Math.hypot(p[0], p[1], p[2]);
    if (r < 1e-9) return p;
    const fr = Math.pow(r, 0.55);
    const k = fr / r;
    return [p[0]*k, p[1]*k, p[2]*k];
  }

  function render() {
    R.clear();
    R.drawStars(S.camera);

    // Órbitas transformadas según escala
    let orbits = null;
    if (S.orbits && S.showOrbits) {
      orbits = {};
      for (const k in S.orbits) {
        orbits[k] = S.orbits[k].map(applyDistance);
      }
    }

    R.draw({
      cam: S.camera,
      bodies: S.bodies,
      ship: S.ship,
      orbits,
      selection: S.selected,
      distanceMode: S.distanceMode,
      sizeMode: S.sizeMode,
      sizeMul: S.sizeMul,
      showOrbits: S.showOrbits
    });

    // Actualiza panel de telemetría si hay nave
    if (S.ship && S.ship.alive) updateTelemetry();
    updateTopBar();
  }

  // -----------------------------------------------------------------------
  // Controles de cámara (táctil + ratón)
  // -----------------------------------------------------------------------
  function attachCameraControls(el) {
    let dragging = false, lastX = 0, lastY = 0;
    let pinchDist = 0;

    const pointers = new Map();

    el.addEventListener('pointerdown', e => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) {
        dragging = true; lastX = e.clientX; lastY = e.clientY;
      }
      el.setPointerCapture(e.pointerId);
    });

    el.addEventListener('pointermove', e => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinchDist > 0) {
          const k = pinchDist / d;
          S.camera.dist = Math.max(0.05, Math.min(200, S.camera.dist * k));
        }
        pinchDist = d;
        return;
      }

      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      S.camera.az -= dx * 0.007;
      S.camera.el = Math.max(-1.5, Math.min(1.5, S.camera.el + dy * 0.005));
    });

    function endPointer(e) {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinchDist = 0;
      if (pointers.size === 0) dragging = false;
    }
    el.addEventListener('pointerup', endPointer);
    el.addEventListener('pointercancel', endPointer);
    el.addEventListener('pointerleave', endPointer);

    // Zoom con rueda (escritorio)
    el.addEventListener('wheel', e => {
      e.preventDefault();
      const k = Math.exp(e.deltaY * 0.0012);
      S.camera.dist = Math.max(0.05, Math.min(200, S.camera.dist * k));
    }, { passive: false });

    // Toque simple → seleccionar cuerpo
    let downTime = 0, downX = 0, downY = 0;
    el.addEventListener('pointerdown', e => { downTime = performance.now(); downX = e.clientX; downY = e.clientY; });
    el.addEventListener('pointerup', e => {
      if (performance.now() - downTime > 250) return;
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 8) return;
      pickBody(e.clientX, e.clientY);
    });
  }

  function pickBody(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left, y = clientY - rect.top;
    const camMat = buildPickCam();
    let best = null, bestD = 40 * 40;

    const all = S.bodies.slice();
    if (S.ship && S.ship.alive) all.push(S.ship);

    for (const b of all) {
      const p = applyDistance(b.pos);
      const pp = projectPick(p, camMat);
      if (!pp) continue;
      const d2 = (pp.x - x) ** 2 + (pp.y - y) ** 2;
      if (d2 < bestD) { bestD = d2; best = b; }
    }
    if (best) {
      S.selected = best.id;
      SP.Store.markVisited(best.id);
      updateInfoPanel();
      checkMissions();
    }
  }

  function buildPickCam() {
    const az = S.camera.az, el = S.camera.el;
    const ce = Math.cos(el), se = Math.sin(el);
    const ca = Math.cos(az), sa = Math.sin(az);
    const cx = S.camera.dist * ce * ca;
    const cy = S.camera.dist * ce * sa;
    const cz = S.camera.dist * se;
    const fx = -cx, fy = -cy, fz = -cz;
    const fn = Math.hypot(fx, fy, fz) || 1;
    const wx = fx / fn, wy = fy / fn, wz = fz / fn;

    // Right vector: cross(worldUp, forward) -> evita degeneración en la cámara.
    const up = [0, 0, 1];
    let rx = up[1] * wz - up[2] * wy;
    let ry = up[2] * wx - up[0] * wz;
    let rz = up[0] * wy - up[1] * wx;
    const rn = Math.hypot(rx, ry, rz) || 1;
    rx /= rn; ry /= rn; rz /= rn;

    const ux = ry * wz - rz * wy;
    const uy = rz * wx - rx * wz;
    const uz = rx * wy - ry * wx;
    const focal = (R.H / 2) / Math.tan(50 * Math.PI / 180 / 2);
    return { cx, cy, cz, rx, ry, rz, ux, uy, uz, wx, wy, wz, focal, target: S.camera.target };
  }

  function projectPick(p, m) {
    const camPos = [m.target[0]+m.cx, m.target[1]+m.cy, m.target[2]+m.cz];
    const vx = p[0]-camPos[0], vy = p[1]-camPos[1], vz = p[2]-camPos[2];
    const depth = vx*m.wx + vy*m.wy + vz*m.wz;
    if (depth <= 0.001) return null;
    const dx = p[0]-m.target[0], dy = p[1]-m.target[1], dz = p[2]-m.target[2];
    const camX = dx*m.rx + dy*m.ry + dz*m.rz;
    const camY = dx*m.ux + dy*m.uy + dz*m.uz;
    return {
      x: R.W/2 + camX * m.focal / depth,
      y: R.H/2 - camY * m.focal / depth
    };
  }

  // -----------------------------------------------------------------------
  // UI
  // -----------------------------------------------------------------------
  let ui = {};

  function cacheUI() {
    ui = {
      topDate: document.getElementById('topDate'),
      topTime: document.getElementById('topTime'),
      btnPlay: document.getElementById('btnPlay'),
      btnReset: document.getElementById('btnReset'),
      selTimeScale: document.getElementById('selTimeScale'),
      selDistMode: document.getElementById('selDistMode'),
      selSizeMode: document.getElementById('selSizeMode'),
      infoPanel: document.getElementById('infoPanel'),
      telemetry: document.getElementById('telemetry'),
      tabButtons: document.querySelectorAll('.tab-btn'),
      panels: document.querySelectorAll('.tab-panel'),
      dateInput: document.getElementById('dateInput'),
      btnSetDate: document.getElementById('btnSetDate'),
      toast: document.getElementById('toast'),
      energyBar: document.getElementById('energyBar'),
      // Launch
      lnchSpeed: document.getElementById('lnchSpeed'),
      lnchSpeedVal: document.getElementById('lnchSpeedVal'),
      lnchAngle: document.getElementById('lnchAngle'),
      lnchAngleVal: document.getElementById('lnchAngleVal'),
      lnchAlt: document.getElementById('lnchAlt'),
      lnchAltVal: document.getElementById('lnchAltVal'),
      lnchMass: document.getElementById('lnchMass'),
      lnchMassVal: document.getElementById('lnchMassVal'),
      btnLaunch: document.getElementById('btnLaunch'),
      launchInfo: document.getElementById('launchInfo'),
      // Experiment
      expSpeed: document.getElementById('expSpeed'),
      expSpeedVal: document.getElementById('expSpeedVal'),
      expAngle: document.getElementById('expAngle'),
      expAngleVal: document.getElementById('expAngleVal'),
      btnExpLaunch: document.getElementById('btnExpLaunch'),
      expTable: document.getElementById('expTable'),
      expPrediction: document.getElementById('expPrediction'),
      // Lab
      labSunMass: document.getElementById('labSunMass'),
      labSunMassVal: document.getElementById('labSunMassVal'),
      labNewMass: document.getElementById('labNewMass'),
      labNewMassVal: document.getElementById('labNewMassVal'),
      labNewDist: document.getElementById('labNewDist'),
      labNewDistVal: document.getElementById('labNewDistVal'),
      labNewVel: document.getElementById('labNewVel'),
      labNewVelVal: document.getElementById('labNewVelVal'),
      btnLabAdd: document.getElementById('btnLabAdd'),
      btnLabReset: document.getElementById('btnLabReset'),
      labList: document.getElementById('labList'),
      // Missions
      missionList: document.getElementById('missionList'),
      // Hohmann
      btnHohmann: document.getElementById('btnHohmann'),
      hohmannOut: document.getElementById('hohmannOut'),
      // Experiments educativos
      eduGravityOut: document.getElementById('eduGravityOut'),
      btnEduGravity: document.getElementById('btnEduGravity'),
      eduOrbitOut: document.getElementById('eduOrbitOut'),
      btnEduOrbit: document.getElementById('btnEduOrbit'),
      eduEscapeOut: document.getElementById('eduEscapeOut'),
      btnEduEscape: document.getElementById('btnEduEscape')
    };
  }

  function updateTopBar() {
    const d = SP.jdToDate(S.jd);
    const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    ui.topDate.textContent = `${d.day} ${months[d.month-1]} ${d.year}`;
    ui.topTime.textContent = `JD ${S.jd.toFixed(2)}`;

    // Energía
    const err = S.energyErr;
    ui.energyBar.style.width = Math.min(100, err * 2000) + '%';
    ui.energyBar.style.background = err < 1e-4 ? '#22c55e' : err < 1e-2 ? '#f59e0b' : '#ef4444';
    ui.energyBar.title = `ΔE/E = ${err.toExponential(2)}`;
  }

  function updateTelemetry() {
    const ship = S.ship;
    const sun = S.bodies.find(b => b.isSun);
    const earth = S.bodies.find(b => b.id === 'earth');

    const rSun = V.dist(ship.pos, sun.pos);
    const rEarth = V.dist(ship.pos, earth.pos);
    const v = V.mag(ship.vel);
    const a = V.mag(ship.acc);

    // Elementos orbitales heliocéntricos
    const rHelio = V.sub(ship.pos, sun.pos);
    const vHelio = V.sub(ship.vel, sun.vel);
    const el = SP.orbit.elementsFromState(rHelio, vHelio, C.G);
    ship.lastElements = el;

    const rEarthVec = V.sub(ship.pos, earth.pos);
    const vEarthVec = V.sub(ship.vel, earth.vel);
    const elEarth = SP.orbit.elementsFromState(rEarthVec, vEarthVec, C.G * earth.m);

    const AU_KM = C.AU_KM;
    const kmS = C.AU_KM / C.DAY_S;

    const lines = [
      ['Velocidad heliocéntrica', (v * kmS).toFixed(2) + ' km/s'],
      ['Distancia al Sol',     (rSun).toFixed(4) + ' UA  (' + (rSun*AU_KM).toLocaleString('es-ES', {maximumFractionDigits:0}) + ' km)'],
      ['Distancia a la Tierra',(rEarth).toFixed(5) + ' UA  (' + (rEarth*AU_KM).toLocaleString('es-ES', {maximumFractionDigits:0}) + ' km)'],
      ['Distancia a la Tierra (geo)', (rEarthVec[0]*0+Math.hypot(...rEarthVec)*AU_KM).toLocaleString('es-ES',{maximumFractionDigits:0})+' km'],
      ['Aceleración',           (a * C.AU_M / (C.DAY_S**2)).toFixed(4) + ' m/s²'],
      ['Energía específica',    el.energy.toExponential(3) + ' UA²/día²'],
      ['Tipo de órbita',        el.type],
      ['Perihelio',             el.perihelio.toFixed(4) + ' UA'],
      ['Afelio',                isFinite(el.afelio) ? el.afelio.toFixed(4) + ' UA' : '∞'],
      ['Periodo heliocéntrico', isFinite(el.period) ? el.period.toFixed(2) + ' días' : '—'],
      ['Excentricidad',         el.e.toFixed(4)],
      ['v_escape (local)',      (el.vEsc * kmS).toFixed(2) + ' km/s'],
      ['Órbita terrestre relativa', elEarth.type + '  e=' + elEarth.e.toFixed(3)],
    ];

    ui.telemetry.innerHTML = lines.map(([k, vv]) =>
      `<div class="tele-row"><span>${k}</span><b>${vv}</b></div>`
    ).join('');
  }

  function updateInfoPanel() {
    const id = S.selected;
    const body = S.bodies.find(b => b.id === id) || (S.ship && S.ship.id === id ? S.ship : null);
    if (!body) { ui.infoPanel.classList.remove('show'); return; }

    const isSun = !!body.isSun;
    const el = body.elements || null;

    const lines = [];
    lines.push(['Masa', (body.massKg.toExponential(4)) + ' kg']);
    lines.push(['Radio', body.radiusKm.toLocaleString('es-ES') + ' km']);
    lines.push(['Diámetro', (body.radiusKm*2).toLocaleString('es-ES') + ' km']);
    if (body.gravity) lines.push(['Gravedad superficial', body.gravity + ' m/s²']);
    if (body.moons != null) lines.push(['Número de lunas', body.moons]);
    if (body.rotPeriod) lines.push(['Periodo de rotación', body.rotPeriod]);

    if (el) {
      const AU = C.AU_KM;
      lines.push(['Distancia media al Sol (a)', el.a.toFixed(6) + ' UA']);
      lines.push(['', (el.a * AU).toLocaleString('es-ES', {maximumFractionDigits:0}) + ' km']);
      lines.push(['Excentricidad', el.e.toFixed(5)]);
      lines.push(['Inclinación orbital', el.i.toFixed(3) + '°']);
      lines.push(['Semieje menor b', (el.a*Math.sqrt(1-el.e*el.e)).toFixed(6) + ' UA']);
      lines.push(['Perihelio', (el.a*(1-el.e)).toFixed(6) + ' UA']);
      lines.push(['Afelio',   (el.a*(1+el.e)).toFixed(6) + ' UA']);
      const mu = C.G;
      const Td = 2*Math.PI*Math.sqrt(el.a**3/mu);
      lines.push(['Periodo orbital', Td.toFixed(3) + ' días  (' + (Td/365.25).toFixed(3) + ' años)']);
      const vOrb = Math.sqrt(mu/el.a);
      lines.push(['Velocidad orbital media', (vOrb * AU/C.DAY_S).toFixed(3) + ' km/s']);
      const vEsc = Math.sqrt(2*mu/el.a);
      lines.push(['Velocidad de escape (a)', (vEsc * AU/C.DAY_S).toFixed(3) + ' km/s']);
    }

    ui.infoPanel.innerHTML =
      `<div class="info-header" style="border-color:${body.color}">
         <span class="dot" style="background:${body.color}"></span>
         <h3>${body.name}</h3>
         <button class="close-btn" id="closeInfo">✕</button>
       </div>
       ${lines.map(([k,vv]) => vv === '' ? `<div class="info-row sub"><span>${k}</span><b>${''}</b></div>`
         : `<div class="info-row"><span>${k}</span><b>${vv}</b></div>`).join('')}
       <div class="info-actions">
         <button class="mini-btn" data-follow="${body.id}">🎯 Seguir</button>
       </div>`;
    ui.infoPanel.classList.add('show');

    document.getElementById('closeInfo').onclick = () => ui.infoPanel.classList.remove('show');
    ui.infoPanel.querySelectorAll('[data-follow]').forEach(b => {
      b.onclick = () => { S.camera.follow = b.dataset.follow; toast('Cámara siguiendo a ' + body.name); };
    });
  }

  function updateUI() {
    ui.selTimeScale.value = String(S.timeScale);
    ui.selDistMode.value = S.distanceMode;
    ui.selSizeMode.value = S.sizeMode;
    ui.btnPlay.textContent = S.running ? '⏸' : '▶';
    updateInfoPanel();
    renderMissionList();
    renderLabList();
    renderExperiments();
  }

  // -----------------------------------------------------------------------
  // Toasts
  // -----------------------------------------------------------------------
  let toastTimer = null;
  function toast(msg) {
    ui.toast.textContent = msg;
    ui.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ui.toast.classList.remove('show'), 2400);
  }

  // -----------------------------------------------------------------------
  // LAUNCH
  // -----------------------------------------------------------------------
  function doLaunch(speedKmS, angleDeg, altKm, massKg) {
    const earth = S.bodies.find(b => b.id === 'earth');
    const sun = S.bodies.find(b => b.isSun);
    if (!earth) return;
    S.ship = SP.Spacecraft.create(earth, sun, speedKmS, angleDeg, massKg, altKm);
    S.ship.launch.jd = S.jd;
    S.camera.follow = 'ship';
    S.selected = 'ship';
    toast(`🚀 Lanzamiento: ${speedKmS.toFixed(1)} km/s, ${angleDeg}°`);
    updateInfoPanel();
    if (!S.running) { S.running = true; ui.btnPlay.textContent = '⏸'; }
  }

  function updateLaunchInfo() {
    const earth = S.bodies.find(b => b.id === 'earth');
    if (!earth) return;
    const altKm = parseFloat(ui.lnchAlt.value);
    const r = (earth.radiusKm + altKm) / C.AU_KM;
    const vEsc = Math.sqrt(2 * C.G * earth.m / r) * C.AU_KM / C.DAY_S;
    const vOrb = Math.sqrt(C.G * earth.m / r) * C.AU_KM / C.DAY_S;
    const spd = parseFloat(ui.lnchSpeed.value);
    const ratio = spd / vEsc;
    let cls = 'Órbita / caída hacia la Tierra';
    if (ratio >= 1) cls = '✅ Escape de la Tierra';
    ui.launchInfo.innerHTML =
      `<div class="info-row"><span>Altitud de partida</span><b>${altKm.toFixed(0)} km</b></div>
       <div class="info-row"><span>v_escape en ese punto</span><b>${vEsc.toFixed(2)} km/s</b></div>
       <div class="info-row"><span>v_órbita circular</span><b>${vOrb.toFixed(2)} km/s</b></div>
       <div class="info-row"><span>Relación v/v_esc</span><b>${ratio.toFixed(3)}</b></div>
       <div class="info-row"><span>Predicción</span><b>${cls}</b></div>`;
  }

  // -----------------------------------------------------------------------
  // EXPERIMENTOS
  // -----------------------------------------------------------------------
  function doExperiment() {
    const spd = parseFloat(ui.expSpeed.value);
    const ang = parseFloat(ui.expAngle.value);
    const earth = S.bodies.find(b => b.id === 'earth');
    const r = (earth.radiusKm + 200) / C.AU_KM;
    const vEsc = Math.sqrt(2 * C.G * earth.m / r) * C.AU_KM / C.DAY_S;

    // Predicción aproximada
    let pred = '';
    if (spd < vEsc * 0.05) pred = 'Caída hacia la Tierra';
    else if (spd < vEsc) pred = 'Órbita elíptica terrestre o impacto';
    else if (spd < vEsc * 1.3) pred = 'Escapa de la Tierra — órbita solar elíptica';
    else if (spd < 16) pred = 'Escapa de la Tierra — órbita solar más amplia';
    else pred = 'Posible escape del Sistema Solar';

    ui.expPrediction.innerHTML = `<b>Predicción:</b> ${pred}`;

    doLaunch(spd, ang, 200, 1000);

    // Registrar en tabla y storage
    setTimeout(() => {
      const el = S.ship.lastElements;
      const result = el ? el.type : '—';
      SP.Store.addExperiment({ speed: spd, angle: ang, result, jd: S.jd });
      renderExperiments();
      checkMissions();
    }, 60);
  }

  function renderExperiments() {
    const rows = SP.Store._data.experiments.slice(0, 20);
    ui.expTable.innerHTML = rows.length
      ? rows.map(r => `<tr><td>${r.speed.toFixed(1)}</td><td>${r.angle}°</td><td>${r.result}</td></tr>`).join('')
      : '<tr><td colspan="3" style="opacity:.5">Sin experimentos todavía</td></tr>';
  }

  // -----------------------------------------------------------------------
  // LABORATORIO
  // -----------------------------------------------------------------------
  function renderLabList() {
    const mods = S.bodies.filter(b => b._lab);
    ui.labList.innerHTML = mods.length
      ? mods.map(b => `<div class="lab-item">🧪 <b>${b.name}</b> — m=${b.massKg.toExponential(2)} kg, r=${b.radiusKm.toFixed(0)} km</div>`).join('')
      : '<div style="opacity:.5;font-size:12px">Sin planetas personalizados</div>';
  }

  function applySunMass(newMass) {
    const sun = S.bodies.find(b => b.isSun);
    if (!sun) return;
    // Reajusta velocidades para mantener órbitas estables (escala de Kepler)
    const ratio = sun.m / (newMass / C.M_SUN);
    sun.massKg = newMass;
    sun.m = newMass / C.M_SUN;
    // v ∝ √M, así que multiplicamos las velocidades por √(Mnew/Mold)
    const k = Math.sqrt(1/ratio);
    // (Si el usuario quiere, puede lanzar de nuevo para ver el efecto)
    toast('Masa del Sol actualizada (relanza una nave para ver el efecto)');
  }

  function addCustomPlanet() {
    const massE = parseFloat(ui.labNewMass.value);     // masas terrestres
    const aAU   = parseFloat(ui.labNewDist.value);     // UA
    const vKmS  = parseFloat(ui.labNewVel.value);      // km/s tangencial

    const sun = S.bodies.find(b => b.isSun);
    const mu = C.G;

    // Posición: sobre el eje +X heliocéntrico
    const pos = [sun.pos[0] + aAU, sun.pos[1], sun.pos[2]];
    // Velocidad tangencial (sobre +Y)
    const vAU = vKmS * C.DAY_S / C.AU_KM;
    const vel = [sun.vel[0], sun.vel[1] + vAU, sun.vel[2]];

    const body = {
      id: 'custom_' + Date.now(),
      name: 'Planeta-X' + (S.bodies.filter(b => b._lab).length + 1),
      color: '#a78bfa',
      m: massE * C.M_EARTH / C.M_SUN,
      massKg: massE * C.M_EARTH,
      radiusKm: 6371 * Math.pow(massE, 0.3),
      radiusAU: (6371 * Math.pow(massE, 0.3)) / C.AU_KM,
      pos, vel, acc: [0,0,0], _a0: [0,0,0],
      isShip: false, _lab: true,
      gravity: 9.807 * Math.pow(massE, 0.1),
      elements: { a: aAU, e: 0, i: 0, Om: 0, w: 0, M: 0 }
    };
    S.bodies.push(body);
    SP.Physics.accelerations(S.bodies);
    SP.Store.setFlag('custom_planet');
    renderLabList();
    toast('Planeta experimental creado');
    checkMissions();
  }

  function resetLab() {
    S.bodies = S.bodies.filter(b => !b._lab);
    SP.Physics.accelerations(S.bodies);
    renderLabList();
    toast('Laboratorio reiniciado');
  }

  // -----------------------------------------------------------------------
  // TRANSFERENCIA HOHMANN
  // -----------------------------------------------------------------------
  function runHohmann() {
    const earth = S.bodies.find(b => b.id === 'earth');
    const mars  = S.bodies.find(b => b.id === 'mars');
    if (!earth || !mars) return;
    const r1 = Math.hypot(earth.pos[0], earth.pos[1], earth.pos[2]);
    const r2 = Math.hypot(mars.pos[0],  mars.pos[1],  mars.pos[2]);
    const h = SP.orbit.hohmann(r1, r2, C.G);
    const kmS = C.AU_KM / C.DAY_S;
    ui.hohmannOut.innerHTML = `
      <div class="info-row"><span>Órbita inicial (Tierra)</span><b>${r1.toFixed(4)} UA</b></div>
      <div class="info-row"><span>Órbita final (Marte)</span><b>${r2.toFixed(4)} UA</b></div>
      <div class="info-row"><span>Semieje de la transferencia</span><b>${h.aT.toFixed(4)} UA</b></div>
      <div class="info-row"><span>Δv₁ (inyección)</span><b>${(h.dv1*kmS).toFixed(3)} km/s</b></div>
      <div class="info-row"><span>Δv₂ (captura)</span><b>${(h.dv2*kmS).toFixed(3)} km/s</b></div>
      <div class="info-row"><span>Δv total</span><b>${(h.dvTotal*kmS).toFixed(3)} km/s</b></div>
      <div class="info-row"><span>Tiempo de vuelo</span><b>${h.tof.toFixed(2)} días (${(h.tof/365.25).toFixed(2)} años)</b></div>
      <div class="hint">Inclina el Δv₁ sobre la velocidad de la Tierra y usa el ángulo correcto (0° = prograde) para intentarlo tú mismo.</div>`;
    SP.Store.setFlag('hohmann');
    checkMissions();
  }

  // -----------------------------------------------------------------------
  // EXPERIMENTOS EDUCATIVOS
  // -----------------------------------------------------------------------
  function runEduGravity() {
    const sun = S.bodies.find(b => b.isSun);
    const r = [1, 2, 3, 4];
    const rows = r.map(d => {
      const F = C.G * 1 * (C.M_EARTH/C.M_SUN) / (d*d);   // fuerza sobre una masa terrestre
      const F_SI = 6.67430e-11 * C.M_SUN * C.M_EARTH / Math.pow(d * C.AU_M, 2);
      return `<div class="info-row"><span>r = ${d} UA</span><b>F = ${F_SI.toExponential(3)} N</b></div>`;
    }).join('');
    ui.eduGravityOut.innerHTML = rows +
      `<div class="hint">Al duplicar la distancia, la fuerza cae a la cuarta parte.</div>
       <div class="formula">F ∝ 1/r²</div>
       <div class="hint">Ley de gravitación universal: F = G·m₁·m₂ / r²</div>`;
  }

  function runEduOrbit() {
    const sun = S.bodies.find(b => b.isSun);
    const rows = [0.39, 0.72, 1, 1.52, 5.2].map(a => {
      const v = Math.sqrt(C.G / a) * C.AU_KM / C.DAY_S;
      const T = 2 * Math.PI * Math.sqrt(a**3 / C.G);
      return `<div class="info-row"><span>a = ${a} UA</span><b>v = ${v.toFixed(2)} km/s — T = ${T.toFixed(1)} d</b></div>`;
    }).join('');
    ui.eduOrbitOut.innerHTML = rows +
      `<div class="formula">v = √(GM/r)   ·   T² ∝ a³  (3ª ley de Kepler)</div>`;
  }

  function runEduEscape() {
    const bodies = [
      { n: 'Tierra', M: C.M_EARTH, r: 6371e3 },
      { n: 'Luna',   M: 7.342e22,  r: 1737.4e3 },
      { n: 'Marte',  M: 6.4171e23, r: 3389.5e3 },
      { n: 'Júpiter',M: 1.8982e27, r: 69911e3 },
      { n: 'Sol',    M: C.M_SUN,   r: 696340e3 }
    ];
    const rows = bodies.map(b => {
      const v = Math.sqrt(2 * 6.67430e-11 * b.M / b.r) / 1000;
      return `<div class="info-row"><span>${b.n}</span><b>v_esc = ${v.toFixed(2)} km/s</b></div>`;
    }).join('');
    ui.eduEscapeOut.innerHTML = rows +
      `<div class="formula">v_esc = √(2GM/r)</div>
       <div class="hint">Independiente de la masa del proyectil. Solo depende de la masa y el radio del cuerpo.</div>`;
  }

  // -----------------------------------------------------------------------
  // MISIONES
  // -----------------------------------------------------------------------
  function checkMissions() {
    const visited = new Set(SP.Store._data.visited);
    const flags = new Set(SP.Store._data.flags);
    for (const m of SP.MISSIONS) {
      if (SP.Store.isMissionComplete(m.id)) continue;
      try {
        if (m.check(S, visited, flags)) {
          SP.Store.completeMission(m.id);
          toast('🏆 Misión ' + m.id + ' completada: ' + m.title);
          renderMissionList();
        }
      } catch (e) {}
    }
  }

  function renderMissionList() {
    ui.missionList.innerHTML = SP.MISSIONS.map(m => {
      const done = SP.Store.isMissionComplete(m.id);
      return `<div class="mission ${done ? 'done' : ''}">
        <div class="m-head"><span class="m-num">${m.id}</span><b>${m.title}</b>${done ? '<span class="m-check">✔</span>' : ''}</div>
        <div class="m-desc">${m.desc}</div>
        <div class="m-goal">🎯 ${m.goal}</div>
        ${done ? `<div class="m-lesson">📘 ${m.lesson}</div>` : ''}
      </div>`;
    }).join('');
  }

  // -----------------------------------------------------------------------
  // Wiring
  // -----------------------------------------------------------------------
  function wireUI() {

    // Tabs
    ui.tabButtons.forEach(b => {
      b.onclick = () => {
        ui.tabButtons.forEach(x => x.classList.remove('active'));
        ui.panels.forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        const target = document.querySelector(`.tab-panel[data-panel="${b.dataset.tab}"]`);
        if (target) target.classList.add('active');
        S.mode = b.dataset.tab;
      };
    });

    // Play/Pause
    ui.btnPlay.onclick = () => {
      S.running = !S.running;
      ui.btnPlay.textContent = S.running ? '⏸' : '▶';
    };

    // Reset
    ui.btnReset.onclick = () => {
      buildSystem(S.jd);
      S.camera.follow = 'sun';
      toast('Sistema reiniciado');
    };

    // Time scale
    ui.selTimeScale.onchange = () => {
      S.timeScale = parseFloat(ui.selTimeScale.value);
      toast('Velocidad ×' + S.timeScale.toExponential(0).replace('e+','·10^'));
    };

    ui.selDistMode.onchange = () => { S.distanceMode = ui.selDistMode.value; };
    ui.selSizeMode.onchange = () => {
      S.sizeMode = ui.selSizeMode.value;
      S.sizeMul = S.sizeMode === 'visual' ? 1 : 2;
    };

    // Fecha
    ui.btnSetDate.onclick = () => {
      const parts = ui.dateInput.value.split('-').map(Number);
      if (parts.length !== 3 || parts.some(isNaN)) return toast('Fecha inválida');
      const jd = SP.dateToJD(parts[0], parts[1], parts[2]);
      buildSystem(jd);
      toast('Sistema recalculado para ' + ui.dateInput.value);
    };

    // Launch
    const syncLbl = (el, lbl, fmt) => { lbl.textContent = fmt(el.value); };
    ui.lnchSpeed.oninput = () => { syncLbl(ui.lnchSpeed, ui.lnchSpeedVal, v => v + ' km/s'); updateLaunchInfo(); };
    ui.lnchAngle.oninput = () => { syncLbl(ui.lnchAngle, ui.lnchAngleVal, v => v + '°'); };
    ui.lnchAlt.oninput   = () => { syncLbl(ui.lnchAlt,   ui.lnchAltVal,   v => v + ' km'); updateLaunchInfo(); };
    ui.lnchMass.oninput  = () => { syncLbl(ui.lnchMass,  ui.lnchMassVal,  v => v + ' kg'); };

    ui.btnLaunch.onclick = () => {
      doLaunch(
        parseFloat(ui.lnchSpeed.value),
        parseFloat(ui.lnchAngle.value),
        parseFloat(ui.lnchAlt.value),
        parseFloat(ui.lnchMass.value)
      );
    };

    // Experiment
    ui.expSpeed.oninput = () => { ui.expSpeedVal.textContent = ui.expSpeed.value + ' km/s'; updateExpPrediction(); };
    ui.expAngle.oninput = () => { ui.expAngleVal.textContent = ui.expAngle.value + '°'; updateExpPrediction(); };
    ui.btnExpLaunch.onclick = () => doExperiment();

    // Lab
    ui.labSunMass.oninput = () => {
      ui.labSunMassVal.textContent = ui.labSunMass.value + ' M☉';
    };
    ui.labSunMass.onchange = () => applySunMass(parseFloat(ui.labSunMass.value) * C.M_SUN);

    ui.labNewMass.oninput = () => ui.labNewMassVal.textContent = ui.labNewMass.value + ' M⊕';
    ui.labNewDist.oninput = () => ui.labNewDistVal.textContent = ui.labNewDist.value + ' UA';
    ui.labNewVel.oninput  = () => ui.labNewVelVal.textContent  = ui.labNewVel.value  + ' km/s';

    ui.btnLabAdd.onclick = addCustomPlanet;
    ui.btnLabReset.onclick = resetLab;

    // Hohmann
    ui.btnHohmann.onclick = runHohmann;

    // Educativos
    ui.btnEduGravity.onclick = runEduGravity;
    ui.btnEduOrbit.onclick   = runEduOrbit;
    ui.btnEduEscape.onclick  = runEduEscape;

    // Atajos de teclado
    window.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT') return;
      if (e.code === 'Space') { e.preventDefault(); ui.btnPlay.click(); }
      if (e.code === 'KeyR')  ui.btnReset.click();
    });

    // Guardar fecha inicial
    const d0 = SP.jdToDate(S.jd);
    ui.dateInput.value = `${d0.year}-${String(d0.month).padStart(2,'0')}-${String(d0.day).padStart(2,'0')}`;
  }

  function updateExpPrediction() {
    const spd = parseFloat(ui.expSpeed.value);
    const r = (6371 + 200) / C.AU_KM;
    const vEsc = Math.sqrt(2 * C.G * (C.M_EARTH/C.M_SUN) / r) * C.AU_KM / C.DAY_S;
    let pred;
    if (spd < 1) pred = 'Caída balística hacia la Tierra';
    else if (spd < 7.8) pred = 'Órbita elíptica terrestre baja';
    else if (spd < vEsc) pred = 'Órbita elíptica terrestre amplia';
    else if (spd < 16) pred = 'Escape terrestre → órbita solar elíptica';
    else if (spd < 42) pred = 'Escape terrestre → órbita solar muy amplia';
    else pred = 'Posible escape del Sistema Solar';
    ui.expPrediction.innerHTML = `<b>Predicción:</b> ${pred}  (v_esc Tierra ≈ ${vEsc.toFixed(2)} km/s)`;
  }

  // -----------------------------------------------------------------------
  // Registro del Service Worker y arranque
  // -----------------------------------------------------------------------
  function registerSW() {
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('service-worker.js').catch(() => {});
    }
  }

  function start() {
    cacheUI();
    initCanvas();
    SP.Store.load();
    // Fecha de inicio: hoy
    const now = new Date();
    const jd = SP.dateToJD(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate() + now.getUTCHours()/24);
    buildSystem(jd);
    wireUI();
    updateLaunchInfo();
    updateExpPrediction();
    S.lastFrameMs = performance.now();
    requestAnimationFrame(frame);

    // Panel inicial activo
    document.querySelector('.tab-btn.active') ||
      document.querySelector('.tab-btn')?.classList.add('active');

    registerSW();
  }

  document.addEventListener('DOMContentLoaded', start);
})(window.SP);
