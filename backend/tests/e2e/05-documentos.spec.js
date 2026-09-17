/* E2E-05 · Documentos: el historial conserva cada versión cerrada y
   permite recuperarla; y lo que escribe cualquier usuario se muestra
   siempre como texto. */

'use strict';

const fs = require('fs');
const { test, expect } = require('@playwright/test');
const { entrarComoAdmin, esperarGuardado, tokenAdmin, llamar } = require('./ayuda-e2e');

test.describe.configure({ mode: 'serial' });

let admin;
let pid;

test.beforeAll(async ({ request }) => {
  admin = await tokenAdmin(request);
  pid = (await llamar(request, admin, 'POST', '/proyectos', { nombre: 'Documentos E2E' })).datos.id;
});

test('el historial guarda cada versión cerrada y permite descargarla y restaurarla', async ({ page, request }) => {
  const docId = (await llamar(request, admin, 'POST', '/proyectos/' + pid + '/documentos', { artefactoId: 'art-acta-proyecto' }))
    .datos.documento.id;
  await entrarComoAdmin(page, request);
  await page.goto('/#/proyectos/' + pid + '/documento/' + docId);

  const bloque = page.locator('.g-bloque').first();
  await bloque.fill('Atender 500 pacientes al día');
  await bloque.blur();
  await page.click('[data-o="doc-estado"][data-valor="revision"]');
  await page.click('[data-o="doc-estado"][data-valor="aprobado"]');
  await expect(page.locator('.g-historial')).toHaveCount(0);

  await page.click('[data-o="doc-nueva-version"]');
  await expect(page.locator('.d-capa.abierto')).toContainText('Se guarda en el historial una copia de la v1');
  await page.click('[data-d="aceptar"]');
  await expect(page.locator('.g-historial summary')).toContainText('1 versión guardada');
  await expect(page.locator('.eyebrow').first()).toContainText('v2');

  await page.locator('.g-bloque').first().fill('Atender 800 pacientes al día');
  await page.locator('.g-bloque').first().blur();
  await esperarGuardado(page);

  await page.click('.g-historial summary');
  await page.click('.g-versiones a:has-text("Ver")');
  await expect(page).toHaveURL(/\/version\/1$/);
  await expect(page.getByText('Atender 500 pacientes al día')).toBeVisible();
  await expect(page.locator('.g-cambiado')).toHaveCount(1);
  await expect(page.locator('.g-cambiado')).toContainText('Cambió después');
  await expect(page.locator('.g-doc-estado-grande')).toHaveText('Aprobado');

  const [descarga] = await Promise.all([page.waitForEvent('download'), page.click('[data-o="version-exportar"]')]);
  expect(descarga.suggestedFilename()).toMatch(/-v1\.md$/);
  const md = fs.readFileSync(await descarga.path(), 'utf8');
  expect(md).toContain('Atender 500 pacientes al día');
  expect(md).not.toContain('800');

  await page.click('[data-o="version-restaurar"]');
  await page.click('[data-d="aceptar"]');
  await expect(page).toHaveURL(new RegExp('/documento/' + docId + '$'));
  await expect(page.locator('.g-bloque').first()).toHaveValue('Atender 500 pacientes al día');
  await esperarGuardado(page);

  await page.reload();
  await page.goto('/#/proyectos/' + pid + '/documento/' + docId);
  await expect(page.locator('.g-bloque').first()).toHaveValue('Atender 500 pacientes al día');
  const doc = (await llamar(request, admin, 'GET', '/documentos/' + docId)).datos;
  expect([doc.version, doc.estado, doc.contenido['0']]).toEqual([2, 'borrador', 'Atender 500 pacientes al día']);
  const historial = (await llamar(request, admin, 'GET', '/documentos/' + docId + '/versiones')).datos;
  expect(historial.map((v) => [v.version, v.estado])).toEqual([[1, 'aprobado']]);
});

test('lo que escriben los usuarios se muestra como texto, nunca como HTML', async ({ page, request }) => {
  const trampa = '<img src=x onerror="window.__inyectado=1">Hito <b id="negrita-inyectada">x</b>';
  const d = new Date();
  const hoy = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  await llamar(request, admin, 'PATCH', '/proyectos/' + pid, { hitos: [{ nombre: trampa, fecha: hoy }] });
  await llamar(request, admin, 'POST', '/proyectos/' + pid + '/comentarios', { texto: '<script>window.__inyectado=2</script>hola' });
  const subida = await request.post('/api/proyectos/' + pid + '/archivos', {
    headers: { Authorization: 'Bearer ' + admin },
    multipart: {
      categoria: '<i id="categoria-inyectada">c</i>',
      archivo: { name: 'nota.txt', mimeType: 'text/plain', buffer: Buffer.from('hola') }
    }
  });
  expect(subida.status()).toBe(201);

  await entrarComoAdmin(page, request);
  for (const pestana of ['calendario', 'archivos', 'conversacion']) {
    await page.goto('/#/proyectos/' + pid + '/' + pestana);
    await expect(page.locator('.g-obra-cab')).toBeVisible();
  }
  await page.goto('/#/proyectos/' + pid + '/calendario');
  await expect(page.getByText('Hito <b id="negrita-inyectada">x</b>').first()).toBeVisible();
  await page.goto('/#/agenda');
  await expect(page.locator('.envoltura-tabla')).toContainText('<img src=x');
  await page.goto('/#/proyectos/' + pid + '/archivos');
  await expect(page.locator('.g-archivo-meta')).toContainText('<i id="categoria-inyectada">c</i>');
  await page.goto('/#/proyectos/' + pid + '/conversacion');
  await expect(page.locator('#contenido [data-hilo] .c-texto')).toContainText('<script>');

  expect(await page.evaluate(() => window.__inyectado)).toBeUndefined();
  await expect(page.locator('#negrita-inyectada, #categoria-inyectada')).toHaveCount(0);
});
