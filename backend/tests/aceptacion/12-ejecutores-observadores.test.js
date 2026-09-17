/* HU-12 · Como director quiero sumar al equipo personas que solo ejecutan
   sus tareas u observan el proyecto, sin que puedan ver o cambiar lo que
   su rol no permite. */

'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { iniciar } = require('../ayuda');

describe('HU-12 Ejecutores y observadores', () => {
  let e;
  let dir;
  let p;
  let base;
  let eje;          /* miembro con rol «ejecutor» en el equipo */
  let suya;         /* tarea asignada al ejecutor */
  let ajena;        /* tarea de otra persona */
  let doc;

  before(async () => {
    e = await iniciar();
    dir = await e.crearUsuario('director', 'Dora Directora');
    p = (await dir.post('/api/proyectos', {
      nombre: 'Red de clínicas', metodologia: 'agil', presupuesto: 90000, inicio: '2026-02-01', fin: '2026-12-15'
    })).datos;
    base = '/api/proyectos/' + p.id;
    await dir.patch(base, {
      calidad: { secciones: { encuadre: 'Plan confidencial' } },
      hitos: [{ nombre: 'Piloto en la sede norte', fecha: '2026-05-04' }]
    });

    eje = await e.crearUsuario('miembro', 'Eli Ejecutora');
    await dir.post(base + '/miembros', { usuarioId: eje.usuario.id, rol: 'ejecutor' });

    suya = (await dir.post(base + '/tareas', {
      titulo: 'Configurar agenda', responsableId: eje.usuario.id, fechaLimite: '2026-03-02', puntos: 3
    })).datos;
    ajena = (await dir.post(base + '/tareas', {
      titulo: 'Negociar contrato', responsableId: dir.usuario.id, fechaLimite: '2026-03-09'
    })).datos;
    await dir.post(base + '/riesgos', { titulo: 'Debido al proveedor podría retrasarse' });
    await dir.post(base + '/mediciones', { fecha: '2026-02-28', pv: 10, ev: 9, ac: 11 });
    await dir.put(base + '/procesos/p-gob-01', { estado: 'completado', notas: 'Acuerdo reservado con el patrocinador' });
    doc = (await dir.post(base + '/documentos', { artefactoId: 'art-acta-proyecto' })).datos.documento;
  });
  after(async () => { await e.cerrar(); });

  it('CA-01 un observador del equipo ve todo el proyecto y no cambia nada', async () => {
    const obs = await e.crearUsuario('miembro', 'Omar Observador');
    const alta = await dir.post(base + '/miembros', { usuarioId: obs.usuario.id, rol: 'observador' });
    assert.equal(alta.estado, 201);

    assert.equal((await obs.get(base)).datos.nivel, 2);
    assert.equal((await obs.get(base + '/riesgos')).datos.length, 1);
    assert.equal((await obs.get(base + '/tareas')).datos.length, 2);
    assert.equal((await obs.get('/api/documentos/' + doc.id)).estado, 200);

    assert.equal((await obs.post(base + '/riesgos', { titulo: 'No puedo' })).estado, 403);
    assert.equal((await obs.patch('/api/tareas/' + ajena.id, { estado: 'curso' })).estado, 403);
    assert.equal((await obs.put(base + '/procesos/p-gob-02', { estado: 'iniciado' })).estado, 403);
    assert.equal((await obs.put('/api/documentos/' + doc.id + '/bloques/0', { valor: 'x' })).estado, 403);
  });

  it('CA-02 un ejecutor ve el proyecto sin su plan y solo sus tareas', async () => {
    const r = await eje.get(base);
    assert.equal(r.estado, 200);
    assert.equal(r.datos.nivel, 1);
    assert.equal(r.datos.calidad, null, 'la verificación de calidad es parte del plan');
    assert.equal(r.datos.siguiente, undefined);
    assert.equal(r.datos.hitos.length, 1, 'los hitos se ven para ubicar el trabajo');

    assert.deepEqual((await eje.get(base + '/tareas')).datos.map((t) => t.titulo), ['Configurar agenda']);
    assert.equal((await eje.get('/api/tareas/' + suya.id)).estado, 200);
    assert.equal((await eje.get('/api/tareas/' + ajena.id)).estado, 404, 'la tarea ajena ni existe para él');
    assert.equal((await eje.get(base + '/sprints')).datos.length, 1);
    assert.equal((await eje.get(base + '/miembros')).datos.length, 3, 've a todo el equipo');
    assert.equal((await eje.get(base + '/sprint-activo')).estado, 200);

    for (const ruta of ['/riesgos', '/interesados', '/cambios', '/lecciones', '/mediciones', '/documentos',
      '/archivos', '/procesos', '/procesos/p-gob-01', '/evm', '/salud', '/matriz-riesgos', '/siguiente']) {
      const b = await eje.get(base + ruta);
      assert.equal(b.estado, 403, ruta);
    }
    assert.equal((await eje.get('/api/documentos/' + doc.id)).estado, 403);
    assert.match((await eje.get(base + '/riesgos')).datos.error, /tus tareas/);
  });

  it('CA-03 un ejecutor mueve sus tareas por el tablero y nada más', async () => {
    const movida = await eje.patch('/api/tareas/' + suya.id, { estado: 'curso' });
    assert.equal(movida.estado, 200);
    assert.equal(movida.datos.estado, 'curso');

    assert.equal((await eje.patch('/api/tareas/' + suya.id, { titulo: 'Otra cosa' })).estado, 403);
    assert.equal((await eje.patch('/api/tareas/' + suya.id, { estado: 'hecho', puntos: 1 })).estado, 403);
    assert.equal((await eje.patch('/api/tareas/' + ajena.id, { estado: 'hecho' })).estado, 404);
    assert.equal((await eje.del('/api/tareas/' + suya.id)).estado, 403);
    assert.equal((await eje.post(base + '/tareas', { titulo: 'Nueva' })).estado, 403);
    assert.equal((await eje.post(base + '/riesgos', { titulo: 'Nuevo' })).estado, 403);
    assert.equal((await eje.patch(base, { hitos: [] })).estado, 403);
    assert.equal((await eje.put(base + '/procesos/p-gob-02', { estado: 'iniciado' })).estado, 403);
  });

  it('CA-04 la fotografía de un ejecutor solo trae lo que le corresponde', async () => {
    await dir.post(base + '/comentarios', { texto: 'Arrancamos el lunes' });
    await dir.post(base + '/comentarios', { texto: 'Revisa el acta', refTipo: 'documento', refId: doc.id });
    await dir.post(base + '/comentarios', { texto: 'Sobre tu agenda', refTipo: 'tarea', refId: suya.id });
    await dir.post(base + '/comentarios', { texto: 'Sobre el contrato', refTipo: 'tarea', refId: ajena.id });

    const s = (await eje.get('/api/estado')).datos;
    const pr = s.proyectos.find((x) => x.id === p.id);
    assert.equal(pr.nivel, 1);
    assert.equal(pr.calidad, null);
    assert.deepEqual(s.tareas.map((t) => t.titulo), ['Configurar agenda']);
    for (const c of ['documentos', 'archivos', 'riesgos', 'interesados', 'cambios', 'lecciones', 'mediciones']) {
      assert.deepEqual(s[c], [], c);
    }
    assert.equal(s.sprints.length, 1);
    assert.equal(s.miembros.length, 3);
    assert.deepEqual(s.procesos.map((x) => [x.procesoId, x.estado, x.notas]), [['p-gob-01', 'completado', '']]);
    assert.deepEqual(s.comentarios.map((c) => c.texto).sort(), ['Arrancamos el lunes', 'Sobre tu agenda']);
    assert.ok(!JSON.stringify(s).includes('Acuerdo reservado'));
    assert.ok(!JSON.stringify(s).includes('Plan confidencial'));
  });

  it('CA-05 el calendario y el panel de un ejecutor no muestran el plan', async () => {
    const cal = (await eje.get(base + '/calendario')).datos;
    assert.deepEqual(cal.filter((x) => x.tipo === 'tarea').map((x) => x.titulo), ['Configurar agenda']);
    assert.equal(cal.filter((x) => x.tipo === 'evm').length, 0);
    assert.equal(cal.filter((x) => x.tipo === 'hito').length, 1);

    const global = (await eje.get('/api/calendario')).datos;
    assert.deepEqual(global.filter((x) => x.tipo === 'tarea').map((x) => x.titulo), ['Configurar agenda']);

    const panel = (await eje.get('/api/panel')).datos;
    assert.equal(panel.cifras.proyectos, 1);
    assert.equal(panel.cifras.documentos, 0);
    assert.deepEqual(panel.siguientes, []);
    const delDirector = (await dir.get('/api/panel')).datos;
    assert.equal(delDirector.cifras.documentos, 1);
    assert.equal(delDirector.siguientes.length, 1);
  });

  it('CA-06 una cuenta con el rol de ejecutor nunca pasa de ejecutar', async () => {
    const x = await e.crearUsuario('ejecutor', 'Xavi Ejecutor');
    assert.equal((await x.get(base)).estado, 404, 'sin permiso no ve nada');

    await e.admin.post('/api/permisos', { usuarioId: x.usuario.id, ambito: 'proyecto', refId: p.id, nivel: 'dirigir' });
    assert.equal((await x.get(base)).datos.nivel, 1);
    await dir.post(base + '/miembros', { usuarioId: x.usuario.id, rol: 'lider' });
    assert.equal((await x.get(base)).datos.nivel, 1);
    await e.admin.patch(base, { directorId: x.usuario.id });
    assert.equal((await x.get(base)).datos.nivel, 1, 'ni siquiera como director');
    assert.equal((await x.patch(base, { nombre: 'Tomado' })).estado, 403);
    await e.admin.patch(base, { directorId: dir.usuario.id });

    await e.admin.patch('/api/usuarios/' + x.usuario.id, { rol: 'miembro' });
    assert.equal((await x.get(base)).datos.nivel, 4, 'al cambiar de rol valen sus permisos');
  });

  it('CA-07 el permiso «ejecutar» se concede por ámbito y se suma con los demás', async () => {
    const pf = (await e.admin.post('/api/portafolios', { nombre: 'Salud' })).datos;
    await dir.patch(base, { portafolioId: pf.id });
    const m = await e.crearUsuario('miembro', 'Mía');
    const r = await e.admin.post('/api/permisos', { usuarioId: m.usuario.id, ambito: 'portafolio', refId: pf.id, nivel: 'ejecutar' });
    assert.equal(r.estado, 201);
    assert.equal((await m.get(base)).datos.nivel, 1);
    assert.equal((await m.get(base + '/riesgos')).estado, 403);

    await e.admin.post('/api/permisos', { usuarioId: m.usuario.id, ambito: 'proyecto', refId: p.id, nivel: 'ver' });
    assert.equal((await m.get(base)).datos.nivel, 2, 'ejecutar + ver = ver');
    assert.equal((await m.get(base + '/riesgos')).estado, 200);
    assert.equal((await e.admin.post('/api/permisos', { usuarioId: m.usuario.id, ambito: 'proyecto', refId: p.id, nivel: 'mirar' })).estado, 400);
  });
});
