/* ═══════════════════════════════════════════════════════════
   sesiones.js — Acceso, tokens y contraseñas
   ───────────────────────────────────────────────────────────
   · Contraseñas con bcrypt (coste 10).
   · El token JWT solo lleva el usuario y el id de sesión; la sesión
     vive en la tabla «sesiones», así que salir, desactivar la cuenta
     o cambiar la contraseña invalida los tokens al instante.
   · Límite de intentos fallidos por IP y correo.
   · Código de recuperación: se entrega al elegir la propia contraseña,
     se guarda solo su huella, sirve una vez y al usarlo se renueva.
   ═══════════════════════════════════════════════════════════ */

'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../db');
const repo = require('../repositorio');
const D = require('../definiciones');
const { ErrorHttp, noAutenticado } = require('../errores');

const COSTE = 10;
/* Hash de relleno: comparar contra él cuando el correo no existe
   iguala el tiempo de respuesta y no delata qué cuentas hay */
const HASH_RELLENO = bcrypt.hashSync('relleno-sin-uso', COSTE);

const intentos = new Map();

function claveIntento(ip, correo) {
  return String(ip || '') + '|' + String(correo || '').toLowerCase();
}

function comprobarLimite(clave) {
  const ahora = Date.now();
  const ventana = config.acceso.ventanaMinutos * 60 * 1000;
  const r = intentos.get(clave);
  if (r && ahora - r.desde > ventana) intentos.delete(clave);
  const vigente = intentos.get(clave);
  if (vigente && vigente.fallos >= config.acceso.intentosMaximos) {
    throw new ErrorHttp(429, 'Demasiados intentos fallidos. Espera unos minutos antes de volver a intentarlo.', 'DEMASIADOS_INTENTOS');
  }
}

function anotarFallo(clave) {
  const r = intentos.get(clave) || { fallos: 0, desde: Date.now() };
  r.fallos++;
  intentos.set(clave, r);
}

function hashear(texto) {
  return bcrypt.hash(texto, COSTE);
}

async function entrar(correo, clave, { ip, agente } = {}) {
  const correoNorm = String(correo || '').trim().toLowerCase();
  const k = claveIntento(ip, correoNorm);
  comprobarLimite(k);

  const fila = await db.uno('SELECT * FROM usuarios WHERE correo = $1', [correoNorm]);
  const coincide = await bcrypt.compare(String(clave || ''), fila ? fila.clave_hash : HASH_RELLENO);

  if (!fila || !coincide) {
    anotarFallo(k);
    throw noAutenticado('Correo o contraseña incorrectos.');
  }
  if (!fila.activo) {
    throw new ErrorHttp(403, 'La cuenta está desactivada. Pide a un administrador que la reactive.', 'CUENTA_DESACTIVADA');
  }
  intentos.delete(k);

  const expira = new Date(Date.now() + config.jwt.expiraHoras * 3600 * 1000);
  const sesion = await db.uno(
    'INSERT INTO sesiones (usuario_id, expira, ip, agente) VALUES ($1, $2, $3, $4) RETURNING id',
    [fila.id, expira, ip || null, agente ? String(agente).slice(0, 300) : null]);

  const token = jwt.sign({ sid: sesion.id }, config.jwt.secreto, {
    algorithm: 'HS256', subject: fila.id, expiresIn: config.jwt.expiraHoras * 3600
  });

  return { token, expira: expira.getTime(), usuario: perfil(fila) };
}

/* Devuelve { usuario, sesionId } o lanza 401 */
async function verificar(token) {
  let datos;
  try {
    datos = jwt.verify(token, config.jwt.secreto, { algorithms: ['HS256'] });
  } catch (e) {
    throw noAutenticado(e.name === 'TokenExpiredError' ? 'La sesión caducó. Vuelve a entrar.' : 'El token no es válido.');
  }
  const fila = await db.uno(
    `SELECT u.* FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id
     WHERE s.id = $1 AND s.usuario_id = $2 AND s.revocada IS NULL AND s.expira > now() AND u.activo`,
    [datos.sid, datos.sub]);
  if (!fila) throw noAutenticado('La sesión ya no es válida. Vuelve a entrar.');
  return { usuario: perfil(fila), sesionId: datos.sid };
}

/* Lo que se devuelve de la propia cuenta: sin huellas, con la fecha del código */
function perfil(fila) {
  return {
    ...repo.aObjeto(D.usuarios, fila),
    recuperacionCreado: fila.recuperacion_creado ? fila.recuperacion_creado.getTime() : null
  };
}

function salir(sesionId) {
  return db.consulta('UPDATE sesiones SET revocada = now() WHERE id = $1 AND revocada IS NULL', [sesionId]);
}

/* Revoca todas las sesiones de un usuario salvo, si se indica, la actual */
function revocarDe(usuarioId, excepto, cx) {
  return db.consulta(
    'UPDATE sesiones SET revocada = now() WHERE usuario_id = $1 AND revocada IS NULL AND ($2::text IS NULL OR id <> $2)',
    [usuarioId, excepto || null], cx);
}

async function comprobarPropiaClave(usuarioId, clave) {
  const fila = await db.uno('SELECT clave_hash FROM usuarios WHERE id = $1', [usuarioId]);
  if (!fila || !(await bcrypt.compare(String(clave || ''), fila.clave_hash))) {
    throw new ErrorHttp(400, 'La contraseña actual no coincide.', 'CLAVE_INCORRECTA');
  }
}

/* Devuelve el código de recuperación nuevo, que solo se muestra esta vez */
async function cambiarPropiaClave(usuarioId, sesionId, actual, nueva) {
  await comprobarPropiaClave(usuarioId, actual);
  if (String(actual) === String(nueva)) {
    throw new ErrorHttp(400, 'La nueva contraseña debe ser distinta de la actual.', 'CLAVE_REPETIDA');
  }
  return db.transaccion(async (cx) => {
    await db.consulta('UPDATE usuarios SET clave_hash = $1, debe_cambiar_clave = false WHERE id = $2',
      [await hashear(nueva), usuarioId], cx);
    await revocarDe(usuarioId, sesionId, cx);
    return nuevoCodigo(usuarioId, cx);
  });
}

/* ══════════════ Código de recuperación ══════════════ */

/* 16 símbolos sin los que se confunden (0/O, 1/I): 80 bits de azar */
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generarCodigo() {
  let s = '';
  for (let i = 0; i < 16; i++) s += ALFABETO[crypto.randomInt(ALFABETO.length)];
  return s.match(/.{4}/g).join('-');
}

/* Se acepta con o sin guiones, en minúsculas o con espacios */
function normalizarCodigo(codigo) {
  return String(codigo || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

async function nuevoCodigo(usuarioId, cx) {
  const codigo = generarCodigo();
  await db.consulta('UPDATE usuarios SET recuperacion_hash = $2, recuperacion_creado = now() WHERE id = $1',
    [usuarioId, await hashear(normalizarCodigo(codigo))], cx);
  return codigo;
}

/* Con la contraseña actual se puede pedir otro código (el anterior deja de valer) */
async function regenerarCodigo(usuarioId, clave) {
  await comprobarPropiaClave(usuarioId, clave);
  return nuevoCodigo(usuarioId);
}

/* Elegir una contraseña nueva con el código. Mismo límite de intentos que
   la entrada y el mismo mensaje tanto si el correo existe como si no. */
async function recuperar(correo, codigo, nueva, { ip } = {}) {
  const correoNorm = String(correo || '').trim().toLowerCase();
  const k = 'recuperar|' + claveIntento(ip, correoNorm);
  comprobarLimite(k);

  const fila = await db.uno('SELECT * FROM usuarios WHERE correo = $1', [correoNorm]);
  const valido = await bcrypt.compare(normalizarCodigo(codigo), (fila && fila.recuperacion_hash) || HASH_RELLENO);
  if (!fila || !fila.recuperacion_hash || !valido) {
    anotarFallo(k);
    throw new ErrorHttp(401, 'El correo o el código de recuperación no son correctos.', 'RECUPERACION_INVALIDA');
  }
  if (!fila.activo) {
    throw new ErrorHttp(403, 'La cuenta está desactivada. Pide a un administrador que la reactive.', 'CUENTA_DESACTIVADA');
  }
  intentos.delete(k);
  return db.transaccion(async (cx) => {
    await db.consulta('UPDATE usuarios SET clave_hash = $1, debe_cambiar_clave = false WHERE id = $2',
      [await hashear(nueva), fila.id], cx);
    await revocarDe(fila.id, null, cx);
    return nuevoCodigo(fila.id, cx);
  });
}

/* Borra las sesiones caducadas y las cerradas hace más de un día */
async function purgar(cx) {
  const r = await db.consulta(
    "DELETE FROM sesiones WHERE expira < now() OR revocada < now() - interval '1 day'", [], cx);
  return r.rowCount;
}

function reiniciarLimites() {
  intentos.clear();
}

module.exports = {
  entrar, verificar, salir, revocarDe, cambiarPropiaClave, hashear, purgar, reiniciarLimites,
  regenerarCodigo, recuperar, normalizarCodigo
};
