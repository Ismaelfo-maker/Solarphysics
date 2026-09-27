/* =========================================================================
   enhancements.js — Mejoras de navegación y visualización
   ========================================================================= */
(function (SP) {
  'use strict';
  const S = SP.State;
  let overlay;

  function byId(id) { return document.getElementById(id); }

  function setupOverlay() {
    const scene = byId('scene');
    if (!scene) return;
    overlay = document.createElement('canvas');
    overlay.id = 'monthGridOverlay';
    overlay.setAttribute('aria-hidden', 'true');
    scene.parentNode.insertBefore(overlay, scene.nextSibling);
    resizeOverlay();
    window.addEventListener('resize', resizeOverlay);
  }

  function resizeOverlay() {
    const scene = byId('scene');
    if (!overlay || !scene) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    overlay.width = Math.floor(scene.clientWidth * dpr);
    overlay.height = Math.floor(scene.clientHeight * dpr);
    overlay.style.width = scene.clientWidth + 'px';
    overlay.style.height = scene.clientHeight + 'px';
    overlay.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function applyDistance(p) {
    if (S.distanceMode === 'real') return p;
    const r = Math.hypot(p[0], p[1], p[2]);
    if (r < 1e-9) return p;
    const k = Math.pow(r, 0.55) / r;
    return [p[0] * k, p[1] * k, p[2] * k];
  }

  function project(p) {
    const w = overlay.clientWidth, h = overlay.clientHeight;
    const az = S.camera.az, el = S.camera.el;
    const cx = S.camera.dist * Math.cos(el) * Math.cos(az);
    const cy = S.camera.dist * Math.cos(el) * Math.sin(az);
    const cz = S.camera.dist * Math.sin(el);
    const wx = -cx / S.camera.dist, wy = -cy / S.camera.dist, wz = -cz / S.camera.dist;
    let rx = wy, ry = -wx, rz = 0;
    const rn = Math.hypot(rx, ry, rz) || 1;
    rx /= rn; ry /= rn; rz /= rn;
    const ux = ry * wz - rz * wy, uy = rz * wx - rx * wz, uz = rx * wy - ry * wx;
    const target = S.camera.target;
    const camPos = [target[0] + cx, target[1] + cy, target[2] + cz];
    const vx = p[0] - camPos[0], vy = p[1] - camPos[1], vz = p[2] - camPos[2];
    const depth = vx * wx + vy * wy + vz * wz;
    if (depth <= 0.001) return null;
    const dx = p[0] - target[0], dy = p[1] - target[1], dz = p[2] - target[2];
    const focal = h / 2 / Math.tan(25 * Math.PI / 180);
    return { x: w / 2 + (dx * rx + dy * ry + dz * rz) * focal / depth,
      y: h / 2 - (dx * ux + dy * uy + dz * uz) * focal / depth };
  }

  function drawGrid() {
    if (!overlay) return;
    const ctx = overlay.getContext('2d');
    ctx.clearRect(0, 0, overlay.clientWidth, overlay.clientHeight);
    if (!S.showMonthGrid) return;
    const sun = S.bodies.find(b => b.isSun);
    if (!sun) return;
    const sunP = applyDistance(sun.pos);
    const radius = S.distanceMode === 'real' ? 35 : Math.pow(30, 0.55) * 1.08;
    const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    ctx.save();
    ctx.lineWidth = 1;
    for (let m = 0; m < 12; m++) {
      const angle = (m / 12) * Math.PI * 2;
      const end = applyDistance([sun.pos[0] + radius * Math.cos(angle), sun.pos[1] + radius * Math.sin(angle), sun.pos[2]]);
      const a = project(sunP), b = project(end);
      if (!a || !b) continue;
      ctx.strokeStyle = m === Math.floor((SP.jdToDate(S.jd).month - 1)) ? '#ffd166cc' : '#8ab4f855';
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.fillStyle = '#dce8ffcc'; ctx.font = '10px system-ui';
      ctx.fillText(months[m], b.x + 3, b.y + 3);
    }
    ctx.restore();
  }

  function selectBody(id) {
    const body = S.bodies.find(b => b.id === id) || (S.ship && S.ship.id === id ? S.ship : null);
    if (!body) return;
    S.selected = body.id;
    S.camera.follow = body.id;
    if (typeof SP._updateInfoPanel === 'function') SP._updateInfoPanel();
    SP.Store.markVisited(body.id);
    const dropdown = byId('planetDropdown');
    if (dropdown) dropdown.value = body.id;
  }

  function populateSelector() {
    const dropdown = byId('planetDropdown');
    if (!dropdown) return;
    dropdown.innerHTML = '<option value="">Selecciona un cuerpo...</option>';
    for (const body of S.bodies) {
      const option = document.createElement('option');
      option.value = body.id;
      option.textContent = body.name;
      dropdown.appendChild(option);
    }
    dropdown.onchange = () => { if (dropdown.value) selectBody(dropdown.value); };
  }

  function setupUI() {
    setupOverlay();
    populateSelector();
    const sheet = byId('bottomSheet');
    const handle = byId('bottomSheetHandle');
    if (sheet && handle) handle.onclick = () => sheet.classList.toggle('collapsed');
    const grid = byId('btnMonthGrid');
    if (grid) grid.onclick = () => {
      S.showMonthGrid = !S.showMonthGrid;
      grid.classList.toggle('active', S.showMonthGrid);
      grid.setAttribute('aria-pressed', String(S.showMonthGrid));
    };
    const selector = byId('planetSelector');
    if (selector) selector.classList.add('show');
    setInterval(drawGrid, 50);
  }

  document.addEventListener('DOMContentLoaded', () => setTimeout(setupUI, 0));
  SP.Enhancements = { selectBody, drawGrid, populateSelector };
})(window.SP);
