/* HU-16 · Como usuario quiero recuperar el acceso si olvido mi contraseña,
   sin depender de un administrador ni de un correo electrónico. */

'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { iniciar } = require('../ayuda');

const FORMATO = /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;

describe('HU-16 Recuperar la contraseña con un código', () => {
  let e;
  before(async () => { e = await iniciar(); });
  after(async () => { await e.cerrar(); });

  /* Cuenta que ya eligió su contraseña y guardó su código */
  async function cuentaConCodigo(nombre) {
    const c = await e.crearUsuario('miembro', nombre, { pendiente: true });
    const r = await c.put('/api/auth/clave', { actual: c.clave, nueva: c.clave + '-propia' });
    assert.equal(r.estado, 200);
    c.clave = c.clave + '-propia';
    c.codigo = r.datos.codigoRecuperacion;
    return c;
  }

  it('CA-01 elegir la propia contraseña entrega un código que solo se guarda como huella', async () => {
    const c = await cuentaConCodigo('Carla');
    assert.match(c.codigo, FORMATO);
    const yo = (await c.get('/api/auth/yo')).datos.usuario;
    assert.equal(typeof yo.recuperacionCreado, 'number');
    assert.equal(yo.debeCambiarClave, false);

    const fila = await e.db.uno('SELECT recuperacion_hash FROM usuarios WHERE id = $1', [c.usuario.id]);
    assert.match(fila.recuperacion_hash, /^\$2[aby]\$/);
    assert.ok(!fila.recuperacion_hash.includes(c.codigo.replace(/-/g, '')));
    const todo = JSON.stringify((await e.admin.get('/api/usuarios')).datos) + JSON.stringify((await e.admin.get('/api/datos/exportar')).datos);
    assert.ok(!/recuperacion_hash|recuperacionHash|\$2[aby]\$/.test(todo), 'la huella no sale por la API');
  });

  it('CA-02 con el código se elige otra contraseña, se cierran las sesiones y el código se renueva', async () => {
    const c = await cuentaConCodigo('Dario');
    const r = await e.anonimo.post('/api/auth/recuperar', {
      correo: c.usuario.correo.toUpperCase(), codigo: c.codigo.toLowerCase().replace(/-/g, ' '), nueva: 'recuperada-1'
    });
    assert.equal(r.estado, 200, JSON.stringify(r.datos));
    assert.match(r.datos.codigoRecuperacion, FORMATO);
    assert.notEqual(r.datos.codigoRecuperacion, c.codigo);

    assert.equal((await c.get('/api/auth/yo')).estado, 401, 'la sesión abierta se cierra');
    assert.equal((await e.anonimo.post('/api/auth/entrar', { correo: c.usuario.correo, clave: c.clave })).estado, 401);
    const nueva = await e.entrar(c.usuario.correo, 'recuperada-1');
    assert.equal(nueva.usuario.debeCambiarClave, false);

    const otraVez = await e.anonimo.post('/api/auth/recuperar', { correo: c.usuario.correo, codigo: c.codigo, nueva: 'otra-1234' });
    assert.equal(otraVez.estado, 401, 'el código usado ya no vale');
    const conNuevo = await e.anonimo.post('/api/auth/recuperar', {
      correo: c.usuario.correo, codigo: r.datos.codigoRecuperacion, nueva: 'otra-1234'
    });
    assert.equal(conNuevo.estado, 200, 'el código renovado sí');
  });

  it('CA-03 los errores no revelan qué cuentas existen ni qué falló', async () => {
    const c = await cuentaConCodigo('Elena');
    const sinCodigo = await e.crearUsuario('miembro', 'Fermín');
    const casos = [
      { correo: c.usuario.correo, codigo: 'AAAA-BBBB-CCCC-DDDD', nueva: 'nueva-1234' },
      { correo: 'nadie@prueba.local', codigo: c.codigo, nueva: 'nueva-1234' },
      { correo: sinCodigo.usuario.correo, codigo: c.codigo, nueva: 'nueva-1234' }
    ];
    const mensajes = new Set();
    for (const cuerpo of casos) {
      const r = await e.anonimo.post('/api/auth/recuperar', cuerpo);
      assert.equal(r.estado, 401, JSON.stringify(cuerpo));
      assert.equal(r.datos.codigo, 'RECUPERACION_INVALIDA');
      mensajes.add(r.datos.error);
    }
    assert.equal(mensajes.size, 1);
    assert.equal((await e.anonimo.post('/api/auth/recuperar', { correo: c.usuario.correo, codigo: c.codigo, nueva: '123' })).estado, 400);
    assert.equal((await e.anonimo.post('/api/auth/recuperar', { correo: c.usuario.correo })).estado, 400);
  });

  it('CA-04 tras diez intentos fallidos se bloquea aunque luego llegue el código bueno', async () => {
    const c = await cuentaConCodigo('Gael');
    for (let i = 0; i < 10; i++) {
      const r = await e.anonimo.post('/api/auth/recuperar', { correo: c.usuario.correo, codigo: 'ZZZZ-ZZZZ-ZZZZ-ZZZ' + (i % 8 + 2), nueva: 'nueva-1234' });
      assert.equal(r.estado, 401);
    }
    const bloqueado = await e.anonimo.post('/api/auth/recuperar', { correo: c.usuario.correo, codigo: c.codigo, nueva: 'nueva-1234' });
    assert.equal(bloqueado.estado, 429);
    assert.equal(bloqueado.datos.codigo, 'DEMASIADOS_INTENTOS');
    assert.equal((await e.anonimo.post('/api/auth/entrar', { correo: c.usuario.correo, clave: c.clave })).estado, 200,
      'el bloqueo de la recuperación no impide entrar con la contraseña');
    require('../../src/servicios/sesiones').reiniciarLimites();
  });

  it('CA-05 pedir otro código exige la contraseña actual e invalida el anterior', async () => {
    const c = await cuentaConCodigo('Hugo');
    const mal = await c.post('/api/auth/codigo-recuperacion', { clave: 'no-es' });
    assert.equal(mal.estado, 400);
    assert.equal(mal.datos.codigo, 'CLAVE_INCORRECTA');
    const bien = await c.post('/api/auth/codigo-recuperacion', { clave: c.clave });
    assert.equal(bien.estado, 200);
    assert.match(bien.datos.codigoRecuperacion, FORMATO);
    assert.equal((await e.anonimo.post('/api/auth/recuperar', { correo: c.usuario.correo, codigo: c.codigo, nueva: 'nueva-1234' })).estado, 401);
    assert.equal((await e.anonimo.post('/api/auth/recuperar', {
      correo: c.usuario.correo, codigo: bien.datos.codigoRecuperacion, nueva: 'nueva-1234'
    })).estado, 200);

    const pendiente = await e.crearUsuario('miembro', 'Iris', { pendiente: true });
    const r = await pendiente.post('/api/auth/codigo-recuperacion', { clave: pendiente.clave });
    assert.equal(r.estado, 403);
    assert.equal(r.datos.codigo, 'CLAVE_PENDIENTE');
    assert.equal((await e.anonimo.post('/api/auth/codigo-recuperacion', { clave: 'x' })).estado, 401);
  });

  it('CA-06 una cuenta desactivada no se recupera y el código sobrevive a una importación', async () => {
    const c = await cuentaConCodigo('Julia');
    await e.admin.patch('/api/usuarios/' + c.usuario.id, { activo: false });
    const r = await e.anonimo.post('/api/auth/recuperar', { correo: c.usuario.correo, codigo: c.codigo, nueva: 'nueva-1234' });
    assert.equal(r.estado, 403);
    assert.equal(r.datos.codigo, 'CUENTA_DESACTIVADA');
    await e.admin.patch('/api/usuarios/' + c.usuario.id, { activo: true });

    const exportado = (await e.admin.get('/api/datos/exportar')).datos;
    assert.equal((await e.admin.post('/api/datos/importar', exportado)).estado, 200);
    const tras = await e.anonimo.post('/api/auth/recuperar', { correo: c.usuario.correo, codigo: c.codigo, nueva: 'nueva-1234' });
    assert.equal(tras.estado, 200, 'la cuenta existente conserva su código');
  });
});
