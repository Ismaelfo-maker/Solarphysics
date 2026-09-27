/* =========================================================================
   missions.js — Sistema de misiones educativas
   ========================================================================= */
window.SP = window.SP || {};
(function (SP) {
  'use strict';
  const C = SP.C;

  SP.MISSIONS = [
    {
      id: 1, title: 'Conocer el Sistema Solar',
      desc: 'Selecciona cada uno de los 8 planetas para conocer sus datos reales.',
      goal: 'Visita los 8 planetas',
      check(S, visited) {
        const need = ['mercury','venus','earth','mars','jupiter','saturn','uranus','neptune'];
        return need.every(id => visited.has(id));
      },
      lesson: 'Los planetas se dividen en interiores rocosos (Mercurio–Marte) y gigantes gaseosos/helados (Júpiter–Neptuno). Sus masas varían en más de 5 órdenes de magnitud.'
    },
    {
      id: 2, title: 'Medir distancias en UA',
      desc: 'Abre la ficha de 3 planetas y observa su distancia media al Sol en UA.',
      goal: 'Consulta 3 fichas planetarias',
      check(S, visited) { return visited.size >= 3; },
      lesson: 'La Unidad Astronómica (1 UA = 149 597 870 700 m) es la distancia media Tierra–Sol. Neptuno está a 30 UA: la luz tarda ~4,2 horas en llegar.'
    },
    {
      id: 3, title: 'Conseguir una órbita estable',
      desc: 'Lanza una nave desde la Tierra con excentricidad heliocéntrica < 0,15.',
      goal: 'Excentricidad heliocéntrica < 0,15',
      check(S) {
        if (!S.ship || !S.ship.alive) return false;
        const el = S.ship.lastElements;
        return el && el.energy < 0 && el.e < 0.15;
      },
      lesson: 'Una órbita elíptica cerrada requiere energía mecánica negativa. La excentricidad mide cuán "alargada" es: e=0 es circular, 0<e<1 es elíptica.'
    },
    {
      id: 4, title: 'Escapar de la gravedad terrestre',
      desc: 'Alcanza velocidad superior a la de escape de la Tierra en el punto de lanzamiento.',
      goal: 'v > v_escape(Tierra)',
      check(S) {
        if (!S.ship || !S.ship.alive || !S.ship.launch) return false;
        return S.ship.launch.speedKmS > S.ship.launchStats.vEscEarth;
      },
      lesson: 'La velocidad de escape v = √(2GM/r) es independiente de la masa del proyectil. En la superficie terrestre son 11,19 km/s.'
    },
    {
      id: 5, title: 'Conseguir escapar del Sol',
      desc: 'Alcanza energía heliocéntrica positiva (trayectoria hiperbólica respecto al Sol).',
      goal: 'Energía heliocéntrica > 0',
      check(S) {
        if (!S.ship || !S.ship.alive) return false;
        const el = S.ship.lastElements;
        return el && el.energy > 0;
      },
      lesson: 'A 1 UA del Sol la velocidad de escape es de 42,1 km/s. La Tierra se mueve a 29,8 km/s, así que necesitas ~12,3 km/s extra respecto al Sol.'
    },
    {
      id: 6, title: 'Llegar a Marte',
      desc: 'Coloca tu nave a menos de 0,02 UA del centro de Marte.',
      goal: 'Distancia a Marte < 0,02 UA',
      check(S) {
        if (!S.ship || !S.ship.alive) return false;
        const mars = S.bodies.find(b => b.id === 'mars');
        if (!mars) return false;
        const d = Math.hypot(S.ship.pos[0]-mars.pos[0], S.ship.pos[1]-mars.pos[1], S.ship.pos[2]-mars.pos[2]);
        return d < 0.02;
      },
      lesson: 'Una transferencia de Hohmann requiere Δv ≈ 2,94 km/s en la Tierra y 2,65 km/s en Marte, con un tiempo de vuelo de ~259 días.'
    },
    {
      id: 7, title: 'Realizar una transferencia orbital',
      desc: 'Usa la herramienta de transferencia Hohmann Tierra→Marte y observa los Δv.',
      goal: 'Calcula una transferencia Hohmann',
      check(S, visited, flags) { return flags.has('hohmann'); },
      lesson: 'La órbita de transferencia de Hohmann es una elipse tangente a ambas órbitas. Es la maniobra de mínimo Δv entre dos órbitas coplanares.'
    },
    {
      id: 8, title: 'Utilizar una asistencia gravitatoria',
      desc: 'Pasa cerca de Júpiter y experimenta un cambio de energía orbital.',
      goal: 'Encuentro cercano con Júpiter (<0,5 UA)',
      check(S, visited, flags) { return flags.has('jupiter_flyby'); },
      lesson: 'En el marco de referencia del planeta la velocidad de la nave se conserva; en el marco heliocéntrico, la nave puede ganar o perder energía. Es un "robo" de momento orbital.'
    },
    {
      id: 9, title: 'Experimentar con Júpiter',
      desc: 'En el laboratorio, cambia la masa de Júpiter y observa el efecto sobre los planetas interiores.',
      goal: 'Modifica la masa de Júpiter en el laboratorio',
      check(S, visited, flags) { return flags.has('jupiter_mass'); },
      lesson: 'Júpiter tiene 318 masas terrestres. Su influencia gravitatoria es tan grande que estabiliza el cinturón de asteroides y produce resonancias orbitales.'
    },
    {
      id: 10, title: 'Diseñar una misión propia',
      desc: 'Crea un planeta experimental en el laboratorio y observa su órbita.',
      goal: 'Crea un planeta personalizado y simúlalo',
      check(S, visited, flags) { return flags.has('custom_planet'); },
      lesson: 'En astrodinámica, la órbita resultante depende exclusivamente de la posición y velocidad iniciales. Es el "determinismo newtoniano" en acción.'
    }
  ];
})(window.SP);
