/* ═══════════════════════════════════════════════════════════
   proyectos.js — /api/proyectos y todo lo que cuelga de ellos
   ═══════════════════════════════════════════════════════════ */

'use strict';

const express = require('express');
const multer = require('multer');
const config = require('../config');
const db = require('../db');
const repo = require('../repositorio');
const D = require('../definiciones');
const svc = require('../servicios/proyectos');
const trabajo = require('../servicios/trabajo');
const docs = require('../servicios/documentos');
const alcance = require('../servicios/alcance');
const catalogo = require('../catalogo');
const concurrencia = require('../concurrencia');
const { z, validar, limpiar, id: esquemaId } = require('../validacion');
const { exigirProyecto, requerirGestion } = require('../middleware/auth');
const { recursoDeProyecto, proyectoDeRegistro } = require('./recursos');
const { noEncontrado, peticionInvalida } = require('../errores');

const r = express.Router();
const P = '/:proyectoId';

/* ══════════════ Proyecto ══════════════ */

r.get('/', async (req, res) => {
  res.json(await svc.visibles(req.usuario));
});

r.post('/', requerirGestion, async (req, res) => {
  const datos = limpiar(validar(D.proyectos.esquemas.crear, req.body));
  const p = await svc.crear(req.usuario, datos);
  res.status(201).json({ ...p, nivel: D.NIVELES.dirigir, progreso: await svc.progreso(p.id) });
});

r.get(P, async (req, res) => {
  const pid = req.params.proyectoId;
  const nivel = await exigirProyecto(req.usuario, pid, 'ejecutar');
  const p = await repo.obtener(D.proyectos, pid);
  if (alcance.soloEjecuta(nivel)) {
    res.json({ ...alcance.recortarProyecto(p), nivel, progreso: await svc.progreso(pid) });
    return;
  }
  res.json({ ...p, nivel, progreso: await svc.progreso(pid), siguiente: await svc.siguiente(pid) });
});

r.patch(P, async (req, res) => {
  const pid = req.params.proyectoId;
  const antes = concurrencia.extraerAntes(req.body);
  const cambios = limpiar(validar(D.proyectos.esquemas.actualizar, req.body));
  const soloEdicion = Object.keys(cambios).every((k) => D.proyectos.camposDeEdicion.includes(k));
  const nivel = await exigirProyecto(req.usuario, pid, soloEdicion ? 'editar' : 'dirigir');
  const p = await svc.actualizar(pid, cambios, antes);
  res.json({ ...p, nivel, progreso: await svc.progreso(pid) });
});

r.delete(P, async (req, res) => {
  await exigirProyecto(req.usuario, req.params.proyectoId, 'dirigir');
  await repo.borrar(D.proyectos, req.params.proyectoId);
  res.status(204).end();
});

/* ══════════════ Procesos del ciclo de vida ══════════════ */

r.get(P + '/progreso', async (req, res) => {
  await exigirProyecto(req.usuario, req.params.proyectoId, 'ejecutar');
  res.json(await svc.progreso(req.params.proyectoId));
});

r.get(P + '/siguiente', async (req, res) => {
  await exigirProyecto(req.usuario, req.params.proyectoId, 'ver');
  res.json({ siguiente: await svc.siguiente(req.params.proyectoId) });
});

r.get(P + '/procesos', async (req, res) => {
  await exigirProyecto(req.usuario, req.params.proyectoId, 'ver');
  res.json(await svc.procesos(req.params.proyectoId));
});

r.get(P + '/procesos/:procesoId', async (req, res) => {
  const { proyectoId, procesoId } = req.params;
  await exigirProyecto(req.usuario, proyectoId, 'ver');
  svc.exigirProceso(procesoId);
  const todos = await svc.procesos(proyectoId);
  res.json({
    ...todos.find((x) => x.procesoId === procesoId),
    entradas: await docs.artefactosDeProceso(proyectoId, procesoId, 'entradas'),
    salidas: await docs.artefactosDeProceso(proyectoId, procesoId, 'salidas')
  });
});

const esquemaEstadoProceso = z.object({
  estado: z.enum(D.E.estadosProceso).optional(),
  notas: z.string().max(20000).optional()
}).refine((x) => x.estado !== undefined || x.notas !== undefined, 'Indica «estado» o «notas»');

r.put(P + '/procesos/:procesoId', async (req, res) => {
  const { proyectoId, procesoId } = req.params;
  const antes = concurrencia.extraerAntes(req.body);
  await exigirProyecto(req.usuario, proyectoId, 'editar');
  const d = validar(esquemaEstadoProceso, req.body);
  res.json(await svc.fijarEstadoProceso(proyectoId, procesoId, d, antes));
});

r.put(P + '/procesos/:procesoId/banda', async (req, res) => {
  const { proyectoId, procesoId } = req.params;
  await exigirProyecto(req.usuario, proyectoId, 'editar');
  const { banda } = validar(z.object({ banda: z.enum(D.E.bandas) }), req.body);
  res.json(await svc.moverProceso(proyectoId, procesoId, banda));
});

for (const tipo of ['entradas', 'salidas']) {
  r.get(P + '/procesos/:procesoId/' + tipo, async (req, res) => {
    await exigirProyecto(req.usuario, req.params.proyectoId, 'ver');
    res.json(await docs.artefactosDeProceso(req.params.proyectoId, req.params.procesoId, tipo));
  });
}

/* ══════════════ Indicadores ══════════════ */

/* [nivel mínimo, lectura]; el calendario de un ejecutor solo lleva sus tareas */
const lecturas = {
  evm: ['ver', (pid) => svc.evm(pid)],
  salud: ['ver', (pid) => svc.salud(pid)],
  'matriz-riesgos': ['ver', (pid) => svc.matrizRiesgos(pid)],
  calendario: ['ejecutar', (pid, req, nivel) => svc.calendario([{ id: pid, nivel }], req.usuario.id)],
  velocidad: ['ejecutar', (pid) => trabajo.velocidad(pid)],
  'sprint-activo': ['ejecutar', async (pid) => ({ sprint: await trabajo.sprintActivo(pid) })]
};
Object.entries(lecturas).forEach(([ruta, [nivelMinimo, fn]]) => {
  r.get(P + '/' + ruta, async (req, res) => {
    const nivel = await exigirProyecto(req.usuario, req.params.proyectoId, nivelMinimo);
    res.json(await fn(req.params.proyectoId, req, nivel));
  });
});

/* ══════════════ Documentos ══════════════ */

r.get(P + '/documentos', async (req, res) => {
  await exigirProyecto(req.usuario, req.params.proyectoId, 'ver');
  res.json(await docs.listar(req.params.proyectoId));
});

const esquemaGenerar = z.object({
  id: esquemaId.optional(),
  artefactoId: esquemaId,
  procesoId: esquemaId.nullable().optional()
});

r.post(P + '/documentos', async (req, res) => {
  const pid = req.params.proyectoId;
  await exigirProyecto(req.usuario, pid, 'editar');
  const d = validar(esquemaGenerar, req.body);
  const resultado = await docs.generar(pid, d.artefactoId, d.procesoId, req.usuario.id, d.id);
  res.status(resultado.yaExistia ? 200 : 201).json(resultado);
});

/* ══════════════ Archivos ══════════════ */

const subida = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.archivos.limiteBytes, files: 1, fields: 5 },
  defParamCharset: 'utf8'
});

r.get(P + '/archivos', async (req, res) => {
  await exigirProyecto(req.usuario, req.params.proyectoId, 'ver');
  res.json(await repo.listar(D.archivos, { proyecto_id: req.params.proyectoId }));
});

const TIPO_MIME = /^[a-z0-9][a-z0-9!#$&^_.+-]{0,126}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,126}$/i;

r.post(P + '/archivos',
  async (req, _res, next) => {
    /* Permiso antes de aceptar el cuerpo: nadie sube 10 MB para recibir un 403 */
    await exigirProyecto(req.usuario, req.params.proyectoId, 'editar');
    next();
  },
  subida.single('archivo'),
  async (req, res) => {
    if (!req.file) throw peticionInvalida('Falta el archivo (campo «archivo» del formulario).');
    const nombre = String((req.body && req.body.nombre) || req.file.originalname || '').trim().slice(0, 255);
    if (!nombre) throw peticionInvalida('El archivo necesita un nombre.');
    const categoria = String((req.body && req.body.categoria) || 'general').trim().slice(0, 80) || 'general';
    const tipo = TIPO_MIME.test(req.file.mimetype || '') ? req.file.mimetype.toLowerCase() : 'application/octet-stream';
    /* Al migrar desde el navegador el archivo conserva su identificador */
    const id = req.body && req.body.id ? validar(esquemaId, req.body.id) : undefined;

    const archivo = await db.transaccion(async (cx) => {
      const a = await repo.insertar(D.archivos, {
        id, proyectoId: req.params.proyectoId, nombre, tipo, tamano: req.file.size,
        categoria, autorId: req.usuario.id, almacen: 'bd'
      }, cx);
      await db.consulta('INSERT INTO archivo_contenidos (archivo_id, datos) VALUES ($1, $2)', [a.id, req.file.buffer], cx);
      return a;
    });
    res.status(201).json(archivo);
  });

/* ══════════════ Registros de dominio y trabajo ══════════════ */

const conSeveridad = (x) => ({ ...x, severidad: svc.severidad(x.p, x.i) });
const fotografiar = (pid, cx) => trabajo.fotografiarProyecto(pid, cx);
const soloLectura = (coleccion) => ({ coleccion });

/* A qué cuelga un comentario: debe existir en el mismo proyecto */
async function referenciaComentario(pid, datos, cx) {
  const tipo = datos.refTipo || '';
  if (tipo === '' || tipo === 'proyecto') {
    datos.refTipo = tipo;
    datos.refId = null;
    return null;
  }
  if (!datos.refId) throw peticionInvalida('Indica «refId»: el elemento que se comenta.');
  if (tipo === 'proceso') {
    if (!catalogo.cargar().flujoPorId[datos.refId]) throw peticionInvalida('El proceso comentado no existe.');
    return null;
  }
  const tabla = tipo === 'tarea' ? 'tareas' : 'documentos';
  const fila = await db.uno('SELECT * FROM ' + tabla + ' WHERE id = $1', [datos.refId], cx);
  if (!fila || fila.proyecto_id !== pid) throw peticionInvalida('El elemento comentado no existe en este proyecto.');
  return fila;
}

const recursos = {
  miembros: recursoDeProyecto(D.miembros, { ejecutor: soloLectura('miembros') }),
  riesgos: recursoDeProyecto(D.riesgos, { salida: conSeveridad }),
  interesados: recursoDeProyecto(D.interesados),
  cambios: recursoDeProyecto(D.cambios),
  lecciones: recursoDeProyecto(D.lecciones),
  mediciones: recursoDeProyecto(D.mediciones),
  comentarios: recursoDeProyecto(D.comentarios, {
    antesDeCrear: async (req, pid, datos, cx) => {
      await referenciaComentario(pid, datos, cx);
      datos.autorId = req.usuario.id;
    },
    /* Cada cual edita lo suyo; editores y directores, cualquiera */
    puedeModificar: (req, reg) => reg.fila.autor_id === req.usuario.id || reg.nivel >= D.NIVELES.editar,
    /* Un ejecutor conversa sobre el proyecto en general y sobre sus tareas */
    ejecutor: {
      coleccion: 'comentarios',
      crear: async (req, pid, datos, cx) => {
        const ref = await referenciaComentario(pid, datos, cx);
        return datos.refTipo === '' || datos.refTipo === 'proyecto' ||
          (datos.refTipo === 'tarea' && ref && ref.responsable_id === req.usuario.id);
      }
    }
  }),
  tareas: recursoDeProyecto(D.tareas, {
    /* Un ejecutor mueve sus tareas por el tablero y nada más */
    ejecutor: {
      coleccion: 'tareas',
      modificar: (req, reg, metodo) => metodo === 'PATCH' &&
        reg.fila.responsable_id === req.usuario.id &&
        Object.keys(req.body || {}).every((k) => k === 'estado' || k === '$antes')
    },
    antesDeCrear: async (_req, pid, datos, cx) => {
      if (datos.prioridad === undefined) {
        const n = await db.uno('SELECT count(*) AS n FROM tareas WHERE proyecto_id = $1', [pid], cx);
        datos.prioridad = n.n + 1;
      }
    },
    despues: fotografiar
  }),
  sprints: recursoDeProyecto(D.sprints, {
    ejecutor: soloLectura('sprints'),
    crear: async (_req, pid, datos) => {
      const { sprint, cerrado } = await trabajo.crearSprint(pid, datos);
      return { ...sprint, sprintCerrado: cerrado };
    },
    despues: fotografiar
  })
};

Object.entries(recursos).forEach(([nombre, rec]) => {
  r.use(P + '/' + nombre, rec.lista);
  r.use(P + '/' + nombre, rec.item);
});

/* ══════════════ Rutas planas por id ══════════════ */

const planas = express.Router();
Object.entries(recursos).forEach(([nombre, rec]) => planas.use('/' + nombre, rec.item));

/* Documentos */
planas.get('/documentos/:id', async (req, res) => {
  await proyectoDeRegistro('documentos', req.params.id, req.usuario, 'ver');
  res.json(docs.enriquecer(await repo.obtener(D.documentos, req.params.id), true));
});

const esquemaDoc = z.object({
  estado: z.enum(D.E.estadosDocumento),
  nombre: z.string().trim().min(1).max(300),
  contenido: z.record(z.string().regex(/^\d{1,3}$/), z.any())
}).partial();

planas.patch('/documentos/:id', async (req, res) => {
  const antes = concurrencia.extraerAntes(req.body);
  await proyectoDeRegistro('documentos', req.params.id, req.usuario, 'editar');
  const d = limpiar(validar(esquemaDoc, req.body));
  const doc = await db.transaccion(async (cx) => {
    await concurrencia.comprobar(D.documentos, req.params.id, d, antes, cx);
    if (d.contenido) await repo.actualizar(D.documentos, req.params.id, { contenido: d.contenido }, cx);
    if (d.nombre) await repo.actualizar(D.documentos, req.params.id, { nombre: d.nombre }, cx);
    return d.estado
      ? docs.cambiarEstado(req.params.id, d.estado, cx)
      : docs.enriquecer(await repo.obtener(D.documentos, req.params.id, cx), false);
  });
  res.json(doc);
});

planas.put('/documentos/:id/bloques/:indice', async (req, res) => {
  const antes = concurrencia.extraerAntes(req.body);
  await proyectoDeRegistro('documentos', req.params.id, req.usuario, 'editar');
  const cuerpo = validar(z.object({ valor: z.any() }), req.body);
  res.json(await docs.guardarBloque(req.params.id, req.params.indice, cuerpo.valor, antes));
});

/* Historial: abrir una versión guarda la copia de la que se cierra */
planas.get('/documentos/:id/versiones', async (req, res) => {
  await proyectoDeRegistro('documentos', req.params.id, req.usuario, 'ver');
  res.json(await docs.versiones(req.params.id));
});

planas.get('/documentos/:id/versiones/:version', async (req, res) => {
  await proyectoDeRegistro('documentos', req.params.id, req.usuario, 'ver');
  res.json(await docs.version(req.params.id, req.params.version));
});

planas.post('/documentos/:id/versiones', async (req, res) => {
  await proyectoDeRegistro('documentos', req.params.id, req.usuario, 'editar');
  const { id } = validar(z.object({ id: esquemaId.optional() }), req.body);
  res.json(await docs.nuevaVersion(req.params.id, req.usuario.id, id));
});

planas.post('/documentos/:id/versiones/:version/restaurar', async (req, res) => {
  await proyectoDeRegistro('documentos', req.params.id, req.usuario, 'editar');
  res.json(await docs.restaurarVersion(req.params.id, req.params.version));
});

planas.delete('/documentos/:id', async (req, res) => {
  await proyectoDeRegistro('documentos', req.params.id, req.usuario, 'editar');
  await repo.borrar(D.documentos, req.params.id);
  res.status(204).end();
});

/* Archivos */
planas.get('/archivos/:id', async (req, res) => {
  await proyectoDeRegistro('archivos', req.params.id, req.usuario, 'ver');
  res.json(await repo.obtener(D.archivos, req.params.id));
});

const INLINE_SEGURO = /^(image\/(png|jpeg|gif|webp)|application\/pdf|text\/plain)$/;

planas.get('/archivos/:id/contenido', async (req, res) => {
  await proyectoDeRegistro('archivos', req.params.id, req.usuario, 'ver');
  const f = await db.uno(
    `SELECT a.nombre, a.tipo, c.datos FROM archivos a
     JOIN archivo_contenidos c ON c.archivo_id = a.id WHERE a.id = $1`, [req.params.id]);
  if (!f) throw noEncontrado('El archivo no tiene contenido guardado.');
  const enLinea = req.query.enLinea === '1' && INLINE_SEGURO.test(f.tipo);
  const ascii = f.nombre.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  res.set({
    'Content-Type': f.tipo,
    'Content-Length': f.datos.length,
    'Content-Disposition': (enLinea ? 'inline' : 'attachment') +
      '; filename="' + ascii + '"; filename*=UTF-8\'\'' + encodeURIComponent(f.nombre),
    /* Un HTML subido no puede ejecutarse con el origen de la aplicación */
    'Content-Security-Policy': "sandbox; default-src 'none'",
    'Cache-Control': 'private, no-store'
  });
  res.end(f.datos);
});

planas.delete('/archivos/:id', async (req, res) => {
  await proyectoDeRegistro('archivos', req.params.id, req.usuario, 'editar');
  await repo.borrar(D.archivos, req.params.id);
  res.status(204).end();
});

/* Sprints: cierre y burndown */
planas.post('/sprints/:id/cerrar', async (req, res) => {
  await proyectoDeRegistro('sprints', req.params.id, req.usuario, 'editar');
  const resultado = await trabajo.cerrarSprint(req.params.id);
  res.json({ ...resultado, sprint: await repo.obtener(D.sprints, req.params.id) });
});

planas.post('/sprints/:id/burndown', async (req, res) => {
  await proyectoDeRegistro('sprints', req.params.id, req.usuario, 'editar');
  const foto = await trabajo.registrarBurndown(req.params.id);
  if (!foto) throw peticionInvalida('Solo se fotografía el burndown de un sprint activo.');
  res.json(await trabajo.burndown(req.params.id));
});

planas.get('/sprints/:id/burndown', async (req, res) => {
  await proyectoDeRegistro('sprints', req.params.id, req.usuario, 'ver');
  res.json(await trabajo.burndown(req.params.id));
});

module.exports = { proyectos: r, planas };
