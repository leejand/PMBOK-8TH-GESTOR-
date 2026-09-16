/* ═══════════════════════════════════════════════════════════
   auth.js — Autenticación y autorización de las rutas
   ═══════════════════════════════════════════════════════════ */

'use strict';

const db = require('../db');
const sesiones = require('../servicios/sesiones');
const D = require('../definiciones');
const { noAutenticado, prohibido, noEncontrado } = require('../errores');

async function requerirSesion(req, _res, next) {
  const cabecera = req.get('authorization') || '';
  const m = /^Bearer\s+(.+)$/i.exec(cabecera);
  if (!m) return next(noAutenticado());
  const { usuario, sesionId } = await sesiones.verificar(m[1].trim());
  req.usuario = usuario;
  req.sesionId = sesionId;
  next();
}

function requerirRol(...roles) {
  return (req, _res, next) => {
    if (!req.usuario || !roles.includes(req.usuario.rol)) {
      return next(prohibido(roles.length === 1 && roles[0] === 'admin'
        ? 'Solo un administrador puede hacer esto.'
        : 'Tu rol no permite esta acción.'));
    }
    next();
  };
}

/* Quién gestiona la estructura (portafolios, programas, EOS) y crea proyectos */
const requerirGestion = requerirRol('admin', 'director');

const NOMBRE_NIVEL = { 1: 'ver', 2: 'editar', 3: 'dirigir' };

/* Carga el proyecto y comprueba el nivel del usuario.
   Si no puede ni verlo, responde 404: no revela que existe. */
async function exigirProyecto(usuario, proyectoId, nivel, cx) {
  const fila = await db.uno(
    'SELECT p.id, p.nombre, nivel_en(p.id, $2) AS nivel FROM proyectos p WHERE p.id = $1',
    [proyectoId, usuario.id], cx);
  if (!fila || fila.nivel < 1) throw noEncontrado('No existe el proyecto o no tienes acceso a él.');
  const requerido = D.NIVELES[nivel] || 1;
  if (fila.nivel < requerido) {
    throw prohibido('Necesitas permiso de «' + nivel + '» en este proyecto; tienes «' + NOMBRE_NIVEL[fila.nivel] + '».');
  }
  return fila.nivel;
}

module.exports = { requerirSesion, requerirRol, requerirGestion, exigirProyecto };
