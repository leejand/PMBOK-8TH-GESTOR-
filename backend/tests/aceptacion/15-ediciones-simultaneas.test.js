/* HU-15 · Como integrante del equipo quiero que, si otra persona cambió
   lo mismo que yo mientras lo editaba, no se pise su trabajo sin avisar,
   y ver sus cambios sin recargar la página. */

'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { iniciar } = require('../ayuda');

describe('HU-15 Ediciones simultáneas y refresco', () => {
  let e;
  let ana;
  let beto;
  let p;
  let base;

  const conflicto = (r, campo) => {
    assert.equal(r.estado, 409, JSON.stringify(r.datos));
    assert.equal(r.datos.codigo, 'EDICION_CONCURRENTE');
    if (campo) assert.deepEqual(r.datos.detalles.map((d) => d.campo), [campo]);
  };

  before(async () => {
    e = await iniciar();
    ana = await e.crearUsuario('director', 'Ana');
    beto = await e.crearUsuario('director', 'Beto');
    p = (await ana.post('/api/proyectos', { nombre: 'Hospital', presupuesto: 100000 })).datos;
    base = '/api/proyectos/' + p.id;
    await e.admin.post('/api/permisos', { usuarioId: beto.usuario.id, ambito: 'proyecto', refId: p.id, nivel: 'dirigir' });
  });
  after(async () => { await e.cerrar(); });

  it('CA-01 si otra persona cambió el mismo campo, la segunda escritura se rechaza', async () => {
    const r = (await ana.post(base + '/riesgos', { titulo: 'Retraso del proveedor' })).datos;
    const deAna = await ana.patch('/api/riesgos/' + r.id, { titulo: 'Retraso del proveedor de camas', $antes: { titulo: 'Retraso del proveedor' } });
    assert.equal(deAna.estado, 200);
    const deBeto = await beto.patch('/api/riesgos/' + r.id, { titulo: 'Retraso logístico', $antes: { titulo: 'Retraso del proveedor' } });
    conflicto(deBeto, 'titulo');
    assert.match(deBeto.datos.error, /Otra persona cambió/);
    assert.equal((await ana.get('/api/riesgos/' + r.id)).datos.titulo, 'Retraso del proveedor de camas', 'no se pisó');
  });

  it('CA-02 campos distintos o el mismo valor no chocan; sin «$antes» gana la última', async () => {
    const r = (await ana.post(base + '/riesgos', { titulo: 'Huelga', p: 3, i: 3 })).datos;
    assert.equal((await ana.patch('/api/riesgos/' + r.id, { titulo: 'Huelga de transporte', $antes: { titulo: 'Huelga' } })).estado, 200);
    assert.equal((await beto.patch('/api/riesgos/' + r.id, { p: 4, $antes: { p: 3 } })).estado, 200, 'otro campo');
    assert.equal((await beto.patch('/api/riesgos/' + r.id, { titulo: 'Huelga de transporte', $antes: { titulo: 'Huelga' } })).estado, 200,
      'ya vale lo que se quiere escribir');
    assert.equal((await beto.patch('/api/riesgos/' + r.id, { i: '5', $antes: { i: '3' } })).estado, 200, '3 y «3» son iguales');
    assert.equal((await beto.patch('/api/riesgos/' + r.id, { titulo: 'Sin control' })).estado, 200, 'compatibilidad');
    const final = (await ana.get('/api/riesgos/' + r.id)).datos;
    assert.deepEqual([final.titulo, final.p, final.i], ['Sin control', 4, 5]);
  });

  it('CA-03 los bloques de un documento se protegen uno a uno', async () => {
    const doc = (await ana.post(base + '/documentos', { artefactoId: 'art-acta-proyecto' })).datos.documento;
    const b0 = '/api/documentos/' + doc.id + '/bloques/0';
    assert.equal((await ana.put(b0, { valor: 'Versión de Ana', $antes: { valor: null } })).estado, 200);
    conflicto(await beto.put(b0, { valor: 'Versión de Beto', $antes: { valor: '' } }), 'bloque 0');
    assert.equal((await beto.put('/api/documentos/' + doc.id + '/bloques/1', { valor: 'Otro bloque', $antes: { valor: '' } })).estado, 200);
    assert.equal((await beto.put(b0, { valor: 'Versión de Beto', $antes: { valor: 'Versión de Ana' } })).estado, 200);

    const tabla = doc.plantilla.findIndex((b) => b.t === 'tabla');
    const bt = '/api/documentos/' + doc.id + '/bloques/' + tabla;
    assert.equal((await ana.put(bt, { valor: [['Hito', '2026-05-01']], $antes: { valor: [['', '']] } })).estado, 200,
      'una tabla con filas en blanco equivale a vacía');
    conflicto(await beto.put(bt, { valor: [['Otro', '2026-06-01']], $antes: { valor: [] } }));

    conflicto(await beto.patch('/api/documentos/' + doc.id, { estado: 'aprobado', $antes: { estado: 'revision' } }), 'estado');
    assert.equal((await beto.patch('/api/documentos/' + doc.id, { estado: 'revision', $antes: { estado: 'borrador' } })).estado, 200);
    assert.equal((await e.db.uno('SELECT contenido->>\'0\' AS v FROM documentos WHERE id = $1', [doc.id])).v, 'Versión de Beto');
  });

  it('CA-04 la configuración del proyecto y su verificación de calidad también', async () => {
    assert.equal((await ana.patch(base, { wip: 5, $antes: { wip: 3 } })).estado, 200);
    conflicto(await beto.patch(base, { wip: 4, $antes: { wip: 3 } }), 'wip');
    assert.equal((await beto.patch(base, { presupuesto: 120000, $antes: { presupuesto: '100000' } })).estado, 200);

    const calidad = { campos: { encuadre: { proposito: 'Atender más pacientes' } }, historial: [], version: 1 };
    assert.equal((await ana.patch(base, { calidad, $antes: { calidad: null } })).estado, 200);
    const mismoEnOtroOrden = { version: 1, historial: [], campos: { encuadre: { proposito: 'Atender más pacientes' } } };
    const siguiente = { ...calidad, campos: { encuadre: { proposito: 'Atender a 800 pacientes al día' } } };
    assert.equal((await beto.patch(base, { calidad: siguiente, $antes: { calidad: mismoEnOtroOrden } })).estado, 200,
      'el orden de las claves no importa');
    conflicto(await ana.patch(base, { calidad: { ...calidad, version: 2 }, $antes: { calidad } }), 'calidad');
  });

  it('CA-05 procesos, VTO, scorecard y cuentas', async () => {
    const proc = base + '/procesos/p-gob-01';
    assert.equal((await ana.put(proc, { estado: 'iniciado', $antes: { estado: 'pendiente' } })).estado, 200);
    conflicto(await beto.put(proc, { estado: 'omitido', $antes: { estado: 'pendiente' } }), 'estado');
    assert.equal((await beto.put(proc, { notas: 'Acta en firma', $antes: { notas: '' } })).estado, 200, 'las notas son otro campo');
    conflicto(await ana.put(proc, { notas: 'Otra nota', $antes: { notas: '' } }), 'notas');

    assert.equal((await ana.put('/api/vto/foco', { texto: 'Salud digital', $antes: { texto: '' } })).estado, 200);
    conflicto(await beto.put('/api/vto/foco', { texto: 'Logística', $antes: { texto: '' } }), 'texto');
    assert.equal((await beto.put('/api/vto/foco', { texto: '', $antes: { texto: 'Salud digital' } })).estado, 200);

    const m = (await ana.post('/api/metricas', { nombre: 'Pacientes atendidos' })).datos;
    const celda = '/api/metricas/' + m.id + '/valores/2026-09-14';
    assert.equal((await ana.put(celda, { valor: '120', $antes: { valor: null } })).estado, 200);
    conflicto(await beto.put(celda, { valor: '99', $antes: { valor: '' } }), 'semana 2026-09-14');
    assert.equal((await beto.put('/api/metricas/' + m.id + '/valores/2026-09-07', { valor: '80', $antes: { valor: '' } })).estado, 200,
      'otra semana de la misma métrica');

    const u = (await e.admin.post('/api/usuarios', { correo: 'cora@prueba.local', clave: 'secreta', rol: 'miembro' })).datos;
    assert.equal((await e.admin.patch('/api/usuarios/' + u.id, { activo: false, $antes: { activo: true } })).estado, 200);
    conflicto(await e.admin.patch('/api/usuarios/' + u.id, { activo: false, rol: 'director', $antes: { activo: true, rol: 'ejecutor' } }), 'rol');
  });

  it('CA-06 cada escritura aceptada avanza la marca de cambios; nada más la mueve', async () => {
    const m0 = (await beto.get('/api/cambios')).datos.marca;
    assert.match(m0, /^[0-9a-f]{8}\.\d+$/);
    assert.equal((await ana.get('/api/estado')).datos.marca, m0);
    assert.equal((await beto.get('/api/cambios')).datos.marca, m0, 'leer no cambia nada');

    const escrito = await ana.post(base + '/lecciones', { situacion: 'El proveedor se retrasó' });
    assert.equal(escrito.cabeceras.get('x-marca-anterior'), m0);
    const m1 = escrito.cabeceras.get('x-marca');
    assert.notEqual(m1, m0);
    assert.equal((await beto.get('/api/cambios')).datos.marca, m1, 'Beto ve que hubo cambios');

    assert.equal((await ana.post(base + '/lecciones', {})).estado, 400);
    const choque = await beto.put(base + '/procesos/p-gob-01', { estado: 'omitido', $antes: { estado: 'pendiente' } });
    assert.equal(choque.estado, 409);
    assert.equal(choque.cabeceras.get('x-marca'), null);
    await e.anonimo.post('/api/auth/entrar', { correo: 'nadie@x.co', clave: 'x' });
    await e.entrar('admin@pmbok.local', 'admin123');
    assert.equal((await beto.get('/api/cambios')).datos.marca, m1, 'errores y entradas no la mueven');

    assert.equal((await e.anonimo.get('/api/cambios')).estado, 401);
  });
});
