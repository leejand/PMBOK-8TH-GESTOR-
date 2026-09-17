/* ═══════════════════════════════════════════════════════════
   alcance.js — Qué ve quien solo ejecuta en un proyecto
   ───────────────────────────────────────────────────────────
   Con el nivel «ejecutar» (el rol de ejecutor) una persona ve el
   proyecto, sus propias tareas, los sprints, el equipo y la
   conversación general o sobre sus tareas. Nada de los planes:
   documentos, archivos, riesgos, interesados, cambios, lecciones,
   valor ganado, notas de los procesos ni verificación de calidad.

   Cada condición es SQL sobre la tabla con alias «t»; $2 es siempre
   el id del usuario. Las condiciones salen del código, nunca de la
   petición.
   ═══════════════════════════════════════════════════════════ */

'use strict';

const D = require('../definiciones');

const TAREA_PROPIA = `EXISTS (SELECT 1 FROM tareas ta
  WHERE ta.id = t.ref_id AND ta.proyecto_id = t.proyecto_id AND ta.responsable_id = $2)`;

const CONDICIONES = {
  tareas: 't.responsable_id = $2',
  sprints: 'true',
  miembros: 'true',
  procesos: 'true',
  comentarios: "(t.ref_tipo IN ('', 'proyecto') OR (t.ref_tipo = 'tarea' AND " + TAREA_PROPIA + '))'
};

/* Condición completa para una colección; null si el ejecutor no la ve.
   El «$2::text IS NOT NULL» mantiene el parámetro en uso aunque la
   condición no lo necesite (PostgreSQL exige usar todos). */
function condicion(coleccion) {
  const c = CONDICIONES[coleccion];
  return c ? '(' + c + ') AND $2::text IS NOT NULL' : null;
}

function soloEjecuta(nivel) {
  return nivel === D.NIVELES.ejecutar;
}

/* Lo que un ejecutor no debe leer del propio proyecto */
function recortarProyecto(p) {
  return { ...p, calidad: null };
}

module.exports = { condicion, soloEjecuta, recortarProyecto };
