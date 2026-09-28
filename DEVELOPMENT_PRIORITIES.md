# Prioridades de Desarrollo - Solar Physics Simulator

## 🔴 CRÍTICAS (Bloquean UX)

### P1.1 - Barra de navegación superior (EN PROGRESO)
- [x] Crear NavBar con acceso a todos los menús
- [x] Resolver solapamiento de paneles
- [x] Selector de cuerpos sin bloquear vista
- [ ] Verificar responsive en móvil
- [ ] Pruebas de accesibilidad keyboard/screen-reader

### P1.2 - Visibilidad del menu inferior
- [ ] Botón "Menús" siempre visible (no se pierda al cerrar)
- [ ] Estado persistente del panel inferior
- [ ] Indicador visual de estado (abierto/cerrado)

### P1.3 - Detección de solapamientos dinámicos
- [ ] Reposicionar `#infoPanel` si sale de pantalla
- [ ] Detectar colisión con otros paneles
- [ ] Auto-ajuste de z-index según contexto

---

## 🟠 ALTAS (Impactan funcionalidad)

### P2.1 - Errores de runtime en navegador
- [ ] Revisar console.log de errores JS
- [ ] Validar que `SP.State`, `SP.Render` existen al cargar
- [ ] Fallback si `enhancements.js` falla
- [ ] Manejo de errores en `updateInfoPanel()`

### P2.2 - Compatibilidad de `enhancements.js`
- [ ] Verificar que `jdToDate()` existe
- [ ] Validar acceso a `S.bodies`, `S.camera`
- [ ] Testing de `drawGrid()` sin `overlay`
- [ ] Prueba de selector con 0 cuerpos

### P2.3 - Performance de grilla de meses
- [ ] Optimizar `drawGrid()` (reduce llamadas)
- [ ] Caché de proyecciones
- [ ] Reducir overhead si está desactivada

### P2.4 - Persistence de estado de UI
- [ ] Guardar estado de menús en localStorage
- [ ] Restaurar posición de paneles al recargar
- [ ] Recordar último panel abierto

---

## 🟡 MEDIAS (Mejoras de experiencia)

### P3.1 - Responsive design en móvil
- [ ] Ajustar tamaños de botones para touch
- [ ] Reducir altura de NavBar en móvil
- [ ] Stack vertical de menús en pantallas <600px

### P3.2 - Animaciones y transiciones
- [ ] Fade in/out suave de paneles
- [ ] Slide animations para NavBar
- [ ] Indicadores visuales de carga

### P3.3 - Iconografía mejorada
- [ ] Reemplazar emojis con SVG si es posible
- [ ] Agregar tooltips descriptivos
- [ ] Iconos consistentes en toda la UI

### P3.4 - Temas de color
- [ ] Selector de tema (oscuro/claro)
- [ ] Paleta de colores configurable
- [ ] High contrast mode para accesibilidad

---

## 🟢 BAJAS (Enhancements)

### P4.1 - Documentación interactiva
- [ ] Tutoriales integrados en la UI
- [ ] Hints contextuales por sección
- [ ] Glosario de términos científicos

### P4.2 - Exportación de datos
- [ ] Descargar trayectorias en CSV
- [ ] Exportar estados de simulación
- [ ] Captura de pantalla del canvas

### P4.3 - Colaboración
- [ ] Compartir configuraciones via URL
- [ ] Guardar escenarios personalizados
- [ ] Historial de simulaciones

### P4.4 - Gamificación avanzada
- [ ] Logros desbloqueables
- [ ] Leaderboard local
- [ ] Badges por hitos

---

## 📋 ROADMAP SUGERIDO

**Semana 1:**
- P1.1 (NavBar completa)
- P1.2 (Menu siempre visible)
- P2.1 (Debug console)

**Semana 2:**
- P2.2 (Compatibilidad enhancements.js)
- P2.3 (Performance)
- P3.1 (Responsive)

**Semana 3:**
- P1.3 (Solapamientos)
- P2.4 (Persistence)
- P3.2 (Animaciones)

**Semana 4+:**
- P3.3, P3.4 (Iconografía, temas)
- P4.x (Enhancements)

---

## ✅ CHECKLIST DE VALIDACIÓN

Antes de marcar como "completo":
- [ ] Sin errores en DevTools console
- [ ] Funciona en Chrome, Firefox, Safari, Edge
- [ ] Touch en móvil sin problemas
- [ ] Performance >30fps en simulación
- [ ] Accesibilidad WCAG AA (keyboard, screen reader)
- [ ] Paneles no se solapan nunca
- [ ] Todos los botones siempre accesibles
