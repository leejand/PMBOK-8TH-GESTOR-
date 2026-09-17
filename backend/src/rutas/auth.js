/* ═══════════════════════════════════════════════════════════
   auth.js — /api/auth: entrar, salir, quién soy, mi contraseña
   ═══════════════════════════════════════════════════════════ */

'use strict';

const express = require('express');
const sesiones = require('../servicios/sesiones');
const D = require('../definiciones');
const { z, validar } = require('../validacion');
const { requerirSesionAunConClavePendiente: requerirSesion } = require('../middleware/auth');
const { ErrorHttp } = require('../errores');

const r = express.Router();

const esquemaEntrar = z.object({
  correo: z.string().max(200),
  clave: z.string().max(200)
});

r.post('/entrar', async (req, res) => {
  const { correo, clave } = validar(esquemaEntrar, req.body);
  const resultado = await sesiones.entrar(correo, clave, { ip: req.ip, agente: req.get('user-agent') });
  res.json(resultado);
});

r.post('/salir', requerirSesion, async (req, res) => {
  await sesiones.salir(req.sesionId);
  res.status(204).end();
});

r.get('/yo', requerirSesion, (req, res) => {
  res.json({ usuario: req.usuario });
});

const esquemaClave = z.object({ actual: z.string().max(200), nueva: D.clave });

/* Elegir la propia contraseña entrega un código de recuperación nuevo */
r.put('/clave', requerirSesion, async (req, res) => {
  const { actual, nueva } = validar(esquemaClave, req.body);
  const codigo = await sesiones.cambiarPropiaClave(req.usuario.id, req.sesionId, actual, nueva);
  res.json({
    ok: true,
    mensaje: 'Contraseña actualizada. Las demás sesiones se han cerrado.',
    codigoRecuperacion: codigo
  });
});

/* Sin sesión: contraseña nueva con el código de recuperación */
const esquemaRecuperar = z.object({
  correo: z.string().max(200),
  codigo: z.string().max(100),
  nueva: D.clave
});

r.post('/recuperar', async (req, res) => {
  const { correo, codigo, nueva } = validar(esquemaRecuperar, req.body);
  const nuevo = await sesiones.recuperar(correo, codigo, nueva, { ip: req.ip });
  res.json({
    ok: true,
    mensaje: 'Contraseña cambiada. Entra con ella; las sesiones abiertas se han cerrado.',
    codigoRecuperacion: nuevo
  });
});

/* Otro código, confirmando la contraseña actual */
r.post('/codigo-recuperacion', requerirSesion, async (req, res) => {
  if (req.usuario.debeCambiarClave) {
    throw new ErrorHttp(403, 'Antes de continuar debes cambiar tu contraseña.', 'CLAVE_PENDIENTE');
  }
  const { clave } = validar(z.object({ clave: z.string().max(200) }), req.body);
  res.json({ codigoRecuperacion: await sesiones.regenerarCodigo(req.usuario.id, clave) });
});

module.exports = r;
