/* ═══════════════════════════════════════════════════════════
   concurrencia.js — Ediciones simultáneas
   ───────────────────────────────────────────────────────────
   Cada escritura puede traer «$antes»: el valor que la interfaz
   tenía de cada campo que cambia. Si en el servidor ese campo ya
   no vale eso, otra persona lo cambió entretanto y la escritura se
   rechaza con 409 EDICION_CONCURRENTE en lugar de pisar su trabajo.
   La comparación es por campo: dos personas que cambian campos
   distintos del mismo registro no chocan. Sin «$antes» se mantiene
   el comportamiento anterior (gana la última escritura).
   ═══════════════════════════════════════════════════════════ */

'use strict';

const db = require('./db');
const repo = require('./repositorio');
const { ErrorHttp, noEncontrado } = require('./errores');

/* Saca «$antes» del cuerpo antes de validarlo */
function extraerAntes(cuerpo) {
  if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) return null;
  const antes = cuerpo.$antes;
  delete cuerpo.$antes;
  return antes && typeof antes === 'object' && !Array.isArray(antes) ? antes : null;
}

/* Forma canónica: vacío ('' · null · [] · filas en blanco) es null
   y las claves de los objetos se ordenan */
function canonico(v) {
  if (v === undefined || v === null || v === '') return null;
  if (Array.isArray(v)) {
    const lista = v.map(canonico);
    return lista.every((x) => x === null) ? null : lista;
  }
  if (typeof v === 'object') {
    const o = {};
    Object.keys(v).sort().forEach((k) => {
      const x = canonico(v[k]);
      if (x !== null) o[k] = x;
    });
    return Object.keys(o).length ? o : null;
  }
  return v;
}

function iguales(a, b) {
  const x = canonico(a);
  const y = canonico(b);
  /* 50000 y «50000» son el mismo importe */
  if ((typeof x === 'number' || typeof y === 'number') && x !== null && y !== null) {
    const nx = Number(x);
    const ny = Number(y);
    if (Number.isFinite(nx) && Number.isFinite(ny)) return nx === ny;
  }
  return JSON.stringify(x) === JSON.stringify(y);
}

function edicionConcurrente(campos) {
  return new ErrorHttp(409,
    'Otra persona cambió este dato mientras lo editabas. Se muestra su versión: revísala y vuelve a aplicar tu cambio.',
    'EDICION_CONCURRENTE',
    campos.map((campo) => ({ campo, mensaje: 'cambió en el servidor' })));
}

/* Un valor suelto: el actual del servidor frente al que creía la interfaz.
   Si ya vale lo que se quiere escribir, no hay conflicto que resolver. */
function comprobarValor(actual, antes, nuevo, campo) {
  if (antes === undefined) return;
  if (iguales(actual, antes) || iguales(actual, nuevo)) return;
  throw edicionConcurrente([campo]);
}

/* Un registro: bloquea la fila y compara los campos que cambian */
async function comprobar(def, id, cambios, antes, cx) {
  if (!antes) return;
  const campos = Object.keys(cambios).filter((k) => Object.prototype.hasOwnProperty.call(antes, k));
  if (!campos.length) return;
  const fila = await db.uno('SELECT id FROM ' + def.tabla + ' WHERE id = $1 FOR UPDATE', [id], cx);
  if (!fila) throw noEncontrado('No se encontró el registro.');
  const actual = await repo.obtener(def, id, cx);
  const distintos = campos.filter((k) => !iguales(actual[k], antes[k]) && !iguales(actual[k], cambios[k]));
  if (distintos.length) throw edicionConcurrente(distintos);
}

module.exports = { extraerAntes, canonico, iguales, comprobar, comprobarValor, edicionConcurrente };
