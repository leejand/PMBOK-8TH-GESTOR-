/* E2E-07 · Mi cuenta y recuperación de la contraseña con el código,
   en modo servidor y en modo local. */

'use strict';

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { test, expect } = require('@playwright/test');
const { entrar, tokenAdmin, tokenDe, llamar } = require('./ayuda-e2e');

test.describe.configure({ mode: 'serial' });

const INDICE = pathToFileURL(path.resolve(__dirname, '..', '..', '..', 'index.html')).href;
const LUZ = { nombre: 'Luz Lectora', correo: 'luz@e2e.local', temporal: 'temporal-luz', propia: 'luz-propia-1' };
let clave = LUZ.propia;

async function leerCodigo(page) {
  const caja = page.locator('.d-capa.abierto #g-codigo-recuperacion');
  await expect(caja).toBeVisible();
  const codigo = (await caja.textContent()).trim();
  expect(codigo).toMatch(/^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/);
  return codigo;
}

test('al elegir la contraseña se entrega un código con el que luego se recupera el acceso', async ({ page, request }) => {
  const admin = await tokenAdmin(request);
  await llamar(request, admin, 'POST', '/usuarios', { nombre: LUZ.nombre, correo: LUZ.correo, clave: LUZ.temporal, rol: 'miembro' });

  await entrar(page, LUZ.correo, LUZ.temporal, /#\/clave$/);
  await page.fill('#cc-actual', LUZ.temporal);
  await page.fill('#cc-nueva', LUZ.propia);
  await page.fill('#cc-repetir', LUZ.propia);
  await page.click('[data-g="cambiar-clave"]');
  await expect(page).toHaveURL(/#\/panel$/);
  const codigo = await leerCodigo(page);

  const [descarga] = await Promise.all([page.waitForEvent('download'), page.click('[data-cod="descargar"]')]);
  const txt = fs.readFileSync(await descarga.path(), 'utf8');
  expect(txt).toContain(codigo);
  expect(txt).toContain(LUZ.correo);
  await page.click('.d-capa.abierto [data-d="cerrar"]');
  await expect(page.locator('.d-capa.abierto')).toHaveCount(0);

  await page.click('#btn-salir');
  await page.click('[data-d="aceptar"]');
  await expect(page).toHaveURL(/#\/entrar$/);
  await page.click('text=¿Olvidaste tu contraseña?');
  await expect(page).toHaveURL(/#\/recuperar$/);

  await page.fill('#rc-correo', LUZ.correo);
  await page.fill('#rc-codigo', 'AAAA-BBBB-CCCC-DDDD');
  await page.fill('#rc-nueva', 'luz-recuperada-1');
  await page.fill('#rc-repetir', 'luz-recuperada-1');
  await page.click('[data-g="recuperar"]');
  await expect(page.locator('#g-error-recuperar')).toContainText('no son correctos');

  await page.fill('#rc-codigo', codigo.toLowerCase().replace(/-/g, ''));
  await page.click('[data-g="recuperar"]');
  await expect(page).toHaveURL(/#\/entrar$/);
  const nuevo = await leerCodigo(page);
  expect(nuevo).not.toBe(codigo);
  await page.click('.d-capa.abierto [data-d="cerrar"]');

  await expect(page.locator('#acc-correo')).toHaveValue(LUZ.correo);
  await page.fill('#acc-clave', 'luz-recuperada-1');
  await page.click('[data-g="entrar"]');
  await expect(page).toHaveURL(/#\/panel$/);
  clave = 'luz-recuperada-1';
});

test('desde «Mi cuenta» se cambia la contraseña y se genera otro código', async ({ page, request }) => {
  await entrar(page, LUZ.correo, clave);
  await page.click('.g-usuario-enlace');
  await expect(page).toHaveURL(/#\/cuenta$/);
  await expect(page.getByRole('heading', { name: 'Mi cuenta' })).toBeVisible();
  await expect(page.locator('.nota')).toContainText('Tienes un código vigente');

  await page.click('[data-g="cuenta-codigo"]');
  await page.fill('#d-clave', 'no-es-mi-clave');
  await page.click('[data-d="aceptar"]');
  await expect(page.locator('.d-aviso.error')).toContainText('no coincide');
  await page.click('[data-g="cuenta-codigo"]');
  await page.fill('#d-clave', clave);
  await page.click('[data-d="aceptar"]');
  const regenerado = await leerCodigo(page);
  await page.click('.d-capa.abierto [data-d="cerrar"]');

  await page.fill('#mc-actual', clave);
  await page.fill('#mc-nueva', 'luz-cuenta-2');
  await page.fill('#mc-repetir', 'otra');
  await page.click('[data-g="cuenta-clave"]');
  await expect(page.locator('#g-error-cuenta')).toContainText('no coinciden');
  await page.fill('#mc-repetir', 'luz-cuenta-2');
  await page.click('[data-g="cuenta-clave"]');
  const trasCambio = await leerCodigo(page);
  expect(trasCambio).not.toBe(regenerado);
  await page.click('.d-capa.abierto [data-d="cerrar"]');

  expect(await tokenDe(request, LUZ.correo, 'luz-cuenta-2')).toBeTruthy();
  const r = await request.post('/api/auth/recuperar', { data: { correo: LUZ.correo, codigo: regenerado, nueva: 'x-123456' } });
  expect(r.status(), 'el código anterior ya no sirve').toBe(401);
});

test('en modo local también se recupera la contraseña con el código', async ({ page }) => {
  const llamadas = [];
  page.on('request', (r) => { if (r.url().includes('/api/')) llamadas.push(r.url()); });
  await page.goto(INDICE);
  await page.click('[data-g="acceso-demo"]');
  await expect(page).toHaveURL(/#\/panel$/);
  await page.goto(INDICE + '#/cuenta');
  await expect(page.locator('.nota')).toContainText('Aún no tienes código');
  await page.click('[data-g="cuenta-codigo"]');
  await page.fill('#d-clave', 'admin123');
  await page.click('[data-d="aceptar"]');
  const codigo = await leerCodigo(page);
  await page.click('.d-capa.abierto [data-d="cerrar"]');
  await expect(page.locator('.nota')).toContainText('Tienes un código vigente');

  const guardado = await page.evaluate(() => JSON.parse(localStorage.getItem('pmbok8.bd')).usuarios[0]);
  expect(JSON.stringify(guardado)).not.toContain(codigo);

  await page.click('#btn-salir');
  await page.click('[data-d="aceptar"]');
  await page.goto(INDICE + '#/recuperar');
  await page.fill('#rc-correo', 'admin@pmbok.local');
  await page.fill('#rc-codigo', codigo);
  await page.fill('#rc-nueva', 'local-nueva-1');
  await page.fill('#rc-repetir', 'local-nueva-1');
  await page.click('[data-g="recuperar"]');
  await leerCodigo(page);
  await page.click('.d-capa.abierto [data-d="cerrar"]');
  await page.fill('#acc-clave', 'local-nueva-1');
  await page.click('[data-g="entrar"]');
  await expect(page).toHaveURL(/#\/panel$/);
  expect(llamadas).toEqual([]);
});
