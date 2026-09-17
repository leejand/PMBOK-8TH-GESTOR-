/* ═══════════════════════════════════════════════════════════
   recursos.js — Fábricas de rutas CRUD
   ───────────────────────────────────────────────────────────
   recursoDeProyecto(def): registros que cuelgan de un proyecto.
     lista → /api/proyectos/:proyectoId/<recurso>   GET, POST
     item  → /api/<recurso>/:id  (y anidado)        GET, PATCH, DELETE
   recursoGlobal(def): registros de la organización (EOS, cartera).
     Leer: cualquier sesión. Escribir: administrador o director.
   ═══════════════════════════════════════════════════════════ */

'use strict';

const express = require('express');
const db = require('../db');
const repo = require('../repositorio');
const D = require('../definiciones');
const alcance = require('../servicios/alcance');
const { validar, limpiar } = require('../validacion');
const { exigirProyecto, requerirGestion, faltaNivel } = require('../middleware/auth');
const { noEncontrado } = require('../errores');

/* Carga el proyecto dueño de un registro y comprueba el nivel pedido.
   Sin nivel pedido basta con cualquier acceso (también ejecutar). */
async function proyectoDeRegistro(tabla, id, usuario, nivel, proyectoEsperado) {
  const fila = await db.uno('SELECT * FROM ' + tabla + ' WHERE id = $1', [id]);
  if (!fila || (proyectoEsperado && fila.proyecto_id !== proyectoEsperado)) {
    throw noEncontrado('No se encontró el registro.');
  }
  const tiene = await exigirProyecto(usuario, fila.proyecto_id, 'ejecutar');
  if (nivel && tiene < D.NIVELES[nivel]) throw faltaNivel(nivel, tiene);
  return { fila, nivel: tiene, proyectoId: fila.proyecto_id };
}

/* ganchos.ejecutor — qué puede quien solo ejecuta:
     coleccion         nombre en alcance.js (qué filas ve)
     crear(req, pid, datos, cx)  → boolean (async)
     modificar(req, reg, metodo) → boolean
   Sin este gancho, el ejecutor no ve la colección. */
function recursoDeProyecto(def, ganchos = {}) {
  const nivelEscritura = def.nivelEscritura || 'editar';
  const requerido = D.NIVELES[nivelEscritura];
  const ejecutor = ganchos.ejecutor || null;
  const condicionEjecutor = ejecutor ? alcance.condicion(ejecutor.coleccion) : null;
  const salida = (o) => (ganchos.salida ? ganchos.salida(o) : o);
  const lista = express.Router({ mergeParams: true });
  const item = express.Router({ mergeParams: true });

  async function visibleParaEjecutor(req, id) {
    if (!condicionEjecutor) return false;
    return !!(await db.uno('SELECT 1 FROM ' + def.tabla + ' t WHERE t.id = $1 AND ' + condicionEjecutor,
      [id, req.usuario.id]));
  }

  /* Un ejecutor solo alcanza sus filas; el resto ni existe para él */
  async function exigirAlcance(req, reg) {
    if (!alcance.soloEjecuta(reg.nivel)) return;
    if (!(await visibleParaEjecutor(req, reg.fila.id))) throw noEncontrado('No se encontró el registro.');
  }

  lista.get('/', async (req, res) => {
    const pid = req.params.proyectoId;
    const nivel = await exigirProyecto(req.usuario, pid, 'ejecutar');
    let filas;
    if (alcance.soloEjecuta(nivel)) {
      if (!condicionEjecutor) throw faltaNivel('ver', nivel);
      filas = await repo.listarDonde(def, 't.proyecto_id = $1 AND ' + condicionEjecutor, [pid, req.usuario.id]);
    } else {
      filas = await repo.listar(def, { proyecto_id: pid });
    }
    res.json(filas.map(salida));
  });

  lista.post('/', async (req, res) => {
    const pid = req.params.proyectoId;
    const nivel = await exigirProyecto(req.usuario, pid, 'ejecutar');
    const comoEjecutor = nivel < requerido;
    if (comoEjecutor && !(alcance.soloEjecuta(nivel) && ejecutor && ejecutor.crear)) {
      throw faltaNivel(nivelEscritura, nivel);
    }
    const datos = limpiar(validar(def.esquemas.crear, req.body));
    const creado = ganchos.crear
      ? await ganchos.crear(req, pid, datos)
      : await db.transaccion(async (cx) => {
        if (comoEjecutor && !(await ejecutor.crear(req, pid, datos, cx))) throw faltaNivel(nivelEscritura, nivel);
        if (ganchos.antesDeCrear) await ganchos.antesDeCrear(req, pid, datos, cx);
        const o = await repo.insertar(def, { ...datos, proyectoId: pid }, cx);
        if (ganchos.despues) await ganchos.despues(pid, cx);
        return repo.obtener(def, o.id, cx);
      });
    res.status(201).json(salida(creado));
  });

  /* Quién puede modificar o borrar un registro existente */
  async function paraEscribir(req, metodo) {
    const r = await proyectoDeRegistro(def.tabla, req.params.id, req.usuario, null, req.params.proyectoId);
    await exigirAlcance(req, r);
    let permitido = ganchos.puedeModificar ? ganchos.puedeModificar(req, r) : r.nivel >= requerido;
    if (!permitido && alcance.soloEjecuta(r.nivel) && ejecutor && ejecutor.modificar) {
      permitido = ejecutor.modificar(req, r, metodo);
    }
    if (!permitido) throw faltaNivel(nivelEscritura, r.nivel);
    return r;
  }

  item.get('/:id', async (req, res) => {
    const r = await proyectoDeRegistro(def.tabla, req.params.id, req.usuario, null, req.params.proyectoId);
    if (alcance.soloEjecuta(r.nivel) && !condicionEjecutor) throw faltaNivel('ver', r.nivel);
    await exigirAlcance(req, r);
    res.json(salida(await repo.obtener(def, req.params.id)));
  });

  item.patch('/:id', async (req, res) => {
    const r = await paraEscribir(req, 'PATCH');
    const cambios = limpiar(validar(def.esquemas.actualizar, req.body));
    const actualizado = await db.transaccion(async (cx) => {
      if (ganchos.antesDeActualizar) await ganchos.antesDeActualizar(req, r, cambios, cx);
      await repo.actualizar(def, req.params.id, cambios, cx);
      if (ganchos.despues) await ganchos.despues(r.proyectoId, cx);
      return repo.obtener(def, req.params.id, cx);
    });
    res.json(salida(actualizado));
  });

  item.delete('/:id', async (req, res) => {
    const r = await paraEscribir(req, 'DELETE');
    await db.transaccion(async (cx) => {
      await repo.borrar(def, req.params.id, cx);
      if (ganchos.despues) await ganchos.despues(r.proyectoId, cx);
    });
    res.status(204).end();
  });

  return { lista, item };
}

/* filtros: { parametroQuery: columna } para GET /?parametro=valor */
function recursoGlobal(def, ganchos = {}) {
  const r = express.Router({ mergeParams: true });
  const salida = (o) => (ganchos.salida ? ganchos.salida(o) : o);

  r.get('/', async (req, res) => {
    const filtro = {};
    Object.entries(ganchos.filtros || {}).forEach(([param, col]) => {
      if (typeof req.query[param] === 'string') filtro[col] = req.query[param];
    });
    const filas = await repo.listar(def, filtro);
    res.json(filas.map(salida));
  });

  r.post('/', requerirGestion, async (req, res) => {
    const datos = limpiar(validar(def.esquemas.crear, req.body));
    const creado = await db.transaccion(async (cx) => {
      if (ganchos.antesDeGuardar) await ganchos.antesDeGuardar(req, datos, null, cx);
      const o = await repo.insertar(def, datos, cx);
      if (ganchos.despuesDeGuardar) await ganchos.despuesDeGuardar(req, o.id, datos, cx);
      return repo.obtener(def, o.id, cx);
    });
    res.status(201).json(salida(creado));
  });

  r.get('/:id', async (req, res) => {
    const o = await repo.obtener(def, req.params.id);
    if (!o) throw noEncontrado();
    res.json(salida(o));
  });

  r.patch('/:id', requerirGestion, async (req, res) => {
    const cambios = limpiar(validar(def.esquemas.actualizar, req.body));
    const o = await db.transaccion(async (cx) => {
      const existe = await db.uno('SELECT id FROM ' + def.tabla + ' WHERE id = $1 FOR UPDATE', [req.params.id], cx);
      if (!existe) throw noEncontrado();
      if (ganchos.antesDeGuardar) await ganchos.antesDeGuardar(req, cambios, req.params.id, cx);
      await repo.actualizar(def, req.params.id, cambios, cx);
      if (ganchos.despuesDeGuardar) await ganchos.despuesDeGuardar(req, req.params.id, cambios, cx);
      return repo.obtener(def, req.params.id, cx);
    });
    res.json(salida(o));
  });

  r.delete('/:id', requerirGestion, async (req, res) => {
    if (!(await repo.borrar(def, req.params.id))) throw noEncontrado();
    res.status(204).end();
  });

  return r;
}

module.exports = { recursoDeProyecto, recursoGlobal, proyectoDeRegistro };
