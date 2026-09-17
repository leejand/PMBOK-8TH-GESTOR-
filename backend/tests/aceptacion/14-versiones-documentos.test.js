/* HU-14 · Como director quiero que cada versión cerrada de un documento
   quede guardada con su contenido, para consultarla, compararla o
   recuperarla aunque el documento siga cambiando. */

'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { iniciar } = require('../ayuda');

describe('HU-14 Historial de versiones de los documentos', () => {
  let e;
  let dir;
  let p;
  let doc;
  let ruta;

  before(async () => {
    e = await iniciar();
    dir = await e.crearUsuario('director', 'Dora');
    p = (await dir.post('/api/proyectos', { nombre: 'Planta de reciclaje' })).datos;
    doc = (await dir.post('/api/proyectos/' + p.id + '/documentos', { artefactoId: 'art-acta-proyecto' })).datos.documento;
    ruta = '/api/documentos/' + doc.id;
    await dir.put(ruta + '/bloques/0', { valor: 'Reciclar 40 toneladas al mes' });
    await dir.patch(ruta, { estado: 'aprobado' });
  });
  after(async () => { await e.cerrar(); });

  it('CA-01 abrir una versión guarda la copia completa de la que se cierra', async () => {
    const r = await dir.post(ruta + '/versiones', { id: 'ver-cliente-1' });
    assert.equal(r.estado, 200);
    assert.equal(r.datos.version, 2);
    assert.equal(r.datos.estado, 'borrador');
    const copia = r.datos.versionGuardada;
    assert.equal(copia.id, 'ver-cliente-1', 'la interfaz puede fijar el id de la copia');
    assert.equal(copia.version, 1);
    assert.equal(copia.estado, 'aprobado');
    assert.equal(typeof copia.aprobado, 'number');
    assert.equal(copia.autorId, dir.usuario.id);
    assert.deepEqual(copia.contenido, { 0: 'Reciclar 40 toneladas al mes' });
    assert.ok(copia.completitud > 0);

    await dir.put(ruta + '/bloques/0', { valor: 'Reciclar 55 toneladas al mes' });
    const actual = (await dir.get(ruta)).datos;
    assert.equal(actual.contenido['0'], 'Reciclar 55 toneladas al mes');
    const v1 = (await dir.get(ruta + '/versiones/1')).datos;
    assert.equal(v1.contenido['0'], 'Reciclar 40 toneladas al mes', 'la copia no cambia con el documento');
    assert.ok(v1.plantilla.length > 0);
  });

  it('CA-02 el historial lista las versiones sin cargar su contenido', async () => {
    await dir.post(ruta + '/versiones');
    const lista = (await dir.get(ruta + '/versiones')).datos;
    assert.deepEqual(lista.map((v) => [v.version, v.estado]), [[1, 'aprobado'], [2, 'borrador']]);
    assert.ok(lista.every((v) => v.contenido === undefined && typeof v.completitud === 'number'));
    assert.equal((await dir.get(ruta)).datos.version, 3);
    assert.equal((await dir.get(ruta + '/versiones/9')).estado, 404);
    assert.equal((await dir.get(ruta + '/versiones/abc')).estado, 404);
  });

  it('CA-03 una versión guardada se restaura como borrador', async () => {
    await dir.patch(ruta, { estado: 'revision' });
    const r = await dir.post(ruta + '/versiones/1/restaurar');
    assert.equal(r.estado, 200);
    assert.equal(r.datos.contenido['0'], 'Reciclar 40 toneladas al mes');
    assert.equal(r.datos.estado, 'borrador');
    assert.equal(r.datos.version, 3, 'restaurar no cambia el número de versión');
    assert.equal((await dir.post(ruta + '/versiones/7/restaurar')).estado, 404);
  });

  it('CA-04 leer el historial es de quien ve el plan; cerrar o restaurar, de quien lo edita', async () => {
    const lector = await e.crearUsuario('miembro', 'Lía');
    await e.admin.post('/api/permisos', { usuarioId: lector.usuario.id, ambito: 'proyecto', refId: p.id, nivel: 'ver' });
    assert.equal((await lector.get(ruta + '/versiones')).estado, 200);
    assert.equal((await lector.get(ruta + '/versiones/1')).estado, 200);
    assert.equal((await lector.post(ruta + '/versiones')).estado, 403);
    assert.equal((await lector.post(ruta + '/versiones/1/restaurar')).estado, 403);

    const eje = await e.crearUsuario('miembro', 'Eli');
    await dir.post('/api/proyectos/' + p.id + '/miembros', { usuarioId: eje.usuario.id, rol: 'ejecutor' });
    assert.equal((await eje.get(ruta + '/versiones')).estado, 403);
    assert.deepEqual((await eje.get('/api/estado')).datos.versiones, []);

    const ajeno = await e.crearUsuario('director', 'Otro');
    assert.equal((await ajeno.get(ruta + '/versiones')).estado, 404);
  });

  it('CA-05 el historial viaja en la exportación y vuelve igual al importarla', async () => {
    const estado = (await dir.get('/api/estado')).datos;
    assert.equal(estado.versiones.length, 2);

    const antes = (await e.admin.get('/api/datos/exportar')).datos;
    assert.equal(antes.versiones.length, 2);
    antes.versiones.push({ ...antes.versiones[0], id: 'repetida' });
    antes.versiones.push({ id: 'huerfana', documentoId: 'no-existe', version: 1, contenido: {} });
    const imp = await e.admin.post('/api/datos/importar', antes);
    assert.equal(imp.estado, 200);
    assert.equal(imp.datos.importados.versiones, 2);
    assert.equal(imp.datos.omitidos.versiones, 2);

    const despues = (await e.admin.get('/api/datos/exportar')).datos;
    assert.deepEqual(despues.versiones, antes.versiones.slice(0, 2));
  });

  it('CA-06 borrar el documento borra su historial', async () => {
    /* La importación de CA-05 cerró las demás sesiones: borra el administrador */
    assert.equal((await e.admin.del(ruta)).estado, 204);
    const n = await e.db.uno('SELECT count(*) AS n FROM documento_versiones WHERE documento_id = $1', [doc.id]);
    assert.equal(n.n, 0);
  });
});
