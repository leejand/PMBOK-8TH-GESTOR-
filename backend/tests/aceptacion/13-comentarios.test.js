/* HU-13 · Como integrante del equipo quiero conversar sobre el proyecto,
   una tarea, un documento o un proceso, sin que un comentario apunte a
   algo que no existe ni se vea donde no corresponde. */

'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { iniciar } = require('../ayuda');

describe('HU-13 Comentarios', () => {
  let e;
  let dir;
  let p;
  let base;
  let tarea;
  let doc;
  let otroProyecto;

  before(async () => {
    e = await iniciar();
    dir = await e.crearUsuario('director', 'Dora');
    p = (await dir.post('/api/proyectos', { nombre: 'Portal de citas' })).datos;
    base = '/api/proyectos/' + p.id;
    tarea = (await dir.post(base + '/tareas', { titulo: 'Diseñar el formulario' })).datos;
    doc = (await dir.post(base + '/documentos', { artefactoId: 'art-acta-proyecto' })).datos.documento;
    otroProyecto = (await dir.post('/api/proyectos', { nombre: 'Otro' })).datos;
  });
  after(async () => { await e.cerrar(); });

  it('CA-01 un comentario cuelga del proyecto o de un elemento que existe en él', async () => {
    const general = await dir.post(base + '/comentarios', { texto: 'Bienvenidos', refId: tarea.id });
    assert.equal(general.estado, 201);
    assert.equal(general.datos.refTipo, '');
    assert.equal(general.datos.refId, null, 'un comentario general no apunta a nada');

    for (const [refTipo, refId] of [['tarea', tarea.id], ['documento', doc.id], ['proceso', 'p-gob-01'], ['proyecto', null]]) {
      const r = await dir.post(base + '/comentarios', { texto: 'Sobre ' + refTipo, refTipo, refId });
      assert.equal(r.estado, 201, refTipo);
      assert.equal(r.datos.refTipo, refTipo);
      assert.equal(r.datos.refId, refId);
    }

    const ajena = (await dir.post('/api/proyectos/' + otroProyecto.id + '/tareas', { titulo: 'Ajena' })).datos;
    const invalidos = [
      { texto: 'x', refTipo: 'riesgo', refId: tarea.id },
      { texto: 'x', refTipo: 'tarea' },
      { texto: 'x', refTipo: 'tarea', refId: 'no-existe' },
      { texto: 'x', refTipo: 'tarea', refId: ajena.id },
      { texto: 'x', refTipo: 'documento', refId: tarea.id },
      { texto: 'x', refTipo: 'proceso', refId: 'p-inventado' },
      { texto: '   ' }
    ];
    for (const cuerpo of invalidos) {
      assert.equal((await dir.post(base + '/comentarios', cuerpo)).estado, 400, JSON.stringify(cuerpo));
    }
  });

  it('CA-02 un comentario no cambia de sitio: solo se corrige su texto', async () => {
    const c = (await dir.post(base + '/comentarios', { texto: 'Borrador', refTipo: 'tarea', refId: tarea.id })).datos;
    const r = await dir.patch('/api/comentarios/' + c.id, { texto: 'Corregido', refTipo: 'documento', refId: doc.id, autorId: 'otro' });
    assert.equal(r.estado, 200);
    assert.deepEqual([r.datos.texto, r.datos.refTipo, r.datos.refId, r.datos.autorId],
      ['Corregido', 'tarea', tarea.id, dir.usuario.id]);
    assert.ok(r.datos.actualizado >= r.datos.creado);
  });

  it('CA-03 un ejecutor conversa sobre el proyecto y sus tareas, no sobre el plan', async () => {
    const eje = await e.crearUsuario('miembro', 'Eli');
    await dir.post(base + '/miembros', { usuarioId: eje.usuario.id, rol: 'ejecutor' });
    const suya = (await dir.post(base + '/tareas', { titulo: 'Probar en móvil', responsableId: eje.usuario.id })).datos;

    assert.equal((await eje.post(base + '/comentarios', { texto: 'Listo para empezar' })).estado, 201);
    assert.equal((await eje.post(base + '/comentarios', { texto: 'Ya casi', refTipo: 'tarea', refId: suya.id })).estado, 201);
    assert.equal((await eje.post(base + '/comentarios', { texto: 'Opino', refTipo: 'tarea', refId: tarea.id })).estado, 403);
    assert.equal((await eje.post(base + '/comentarios', { texto: 'Opino', refTipo: 'documento', refId: doc.id })).estado, 403);
    assert.equal((await eje.post(base + '/comentarios', { texto: 'Opino', refTipo: 'proceso', refId: 'p-gob-01' })).estado, 403);

    const vistos = (await eje.get(base + '/comentarios')).datos;
    assert.ok(vistos.length >= 4);
    assert.ok(vistos.every((c) => ['', 'proyecto'].includes(c.refTipo) || c.refId === suya.id),
      'solo generales o de sus tareas');

    const deDocumento = (await dir.get(base + '/comentarios')).datos.find((c) => c.refTipo === 'documento');
    assert.equal((await eje.get('/api/comentarios/' + deDocumento.id)).estado, 404);
    assert.equal((await eje.patch('/api/comentarios/' + deDocumento.id, { texto: 'x' })).estado, 404);
  });

  it('CA-04 cada cual corrige y borra lo suyo; quien edita el proyecto modera', async () => {
    const eje = await e.crearUsuario('miembro', 'Eva');
    await dir.post(base + '/miembros', { usuarioId: eje.usuario.id, rol: 'ejecutor' });
    const mio = (await eje.post(base + '/comentarios', { texto: 'Mío' })).datos;
    const delDirector = (await dir.post(base + '/comentarios', { texto: 'Del director' })).datos;

    assert.equal((await eje.patch('/api/comentarios/' + mio.id, { texto: 'Mío, corregido' })).estado, 200);
    assert.equal((await eje.patch('/api/comentarios/' + delDirector.id, { texto: 'Cambiado' })).estado, 403);
    assert.equal((await eje.del('/api/comentarios/' + delDirector.id)).estado, 403);
    assert.equal((await dir.patch('/api/comentarios/' + mio.id, { texto: 'Moderado' })).estado, 200);
    assert.equal((await eje.del('/api/comentarios/' + mio.id)).estado, 204);

    /* «Deshacer»: se recrea con su id y su fecha */
    const vuelta = await eje.post(base + '/comentarios', { id: mio.id, creado: mio.creado, texto: 'Mío' });
    assert.equal(vuelta.estado, 201);
    assert.equal(vuelta.datos.creado, mio.creado);
  });
});
