/* E2E-06 · Varias personas a la vez: los cambios de otra persona
   aparecen sin recargar, sin borrar lo que uno está escribiendo, y si
   dos cambian lo mismo la segunda recibe un aviso y ve la versión real. */

'use strict';

const { test, expect } = require('@playwright/test');
const { entrar, entrarComoAdmin, esperarGuardado, tokenAdmin, llamar, crearCuenta } = require('./ayuda-e2e');

test.describe.configure({ mode: 'serial' });

const RITA = { nombre: 'Rita Revisora', correo: 'rita@e2e.local', clave: 'rita-segura-1' };
let admin;
let pid;
let docId;

test.beforeAll(async ({ request }) => {
  admin = await tokenAdmin(request);
  pid = (await llamar(request, admin, 'POST', '/proyectos', { nombre: 'Tiempo real E2E' })).datos.id;
  const rita = await crearCuenta(request, admin, RITA);
  await llamar(request, admin, 'POST', '/permisos', { usuarioId: rita, ambito: 'proyecto', refId: pid, nivel: 'editar' });
  docId = (await llamar(request, admin, 'POST', '/proyectos/' + pid + '/documentos', { artefactoId: 'art-caso-negocio' }))
    .datos.documento.id;
  await llamar(request, admin, 'PUT', '/documentos/' + docId + '/bloques/0', { valor: 'Texto original' });
});

test('los cambios de otra persona aparecen sin recargar y sin borrar lo que se escribe', async ({ page, request, browser }) => {
  const otra = await browser.newContext();
  const rita = await otra.newPage();
  await entrar(rita, RITA.correo, RITA.clave);
  await rita.goto('/#/proyectos/' + pid + '/dominios');
  await rita.evaluate(() => Gestor.intervaloRefresco(700));

  await entrarComoAdmin(page, request);
  await page.goto('/#/proyectos/' + pid + '/dominios');
  await page.fill('#nr2-titulo', 'Riesgo que Rita ve llegar');
  await page.click('[data-o="crear-riesgo"]');
  await esperarGuardado(page);

  await expect(rita.getByText('Riesgo que Rita ve llegar').first()).toBeVisible({ timeout: 8000 });
  const cargas = await rita.evaluate(() => performance.getEntriesByType('navigation').length);
  expect(cargas).toBe(1);

  /* Rita empieza a escribir un riesgo: su formulario no se toca */
  await rita.fill('#nr2-titulo', 'Borrador de Rita');
  await rita.locator('h2').first().click();
  await page.fill('#nr2-titulo', 'Segundo riesgo del administrador');
  await page.click('[data-o="crear-riesgo"]');
  await esperarGuardado(page);
  await rita.waitForTimeout(2500);
  await expect(rita.locator('#nr2-titulo')).toHaveValue('Borrador de Rita');
  await expect(rita.getByText('Segundo riesgo del administrador')).toHaveCount(0);

  /* Al registrarlo, llega también lo que faltaba */
  await rita.click('[data-o="crear-riesgo"]');
  await expect(rita.getByText('Borrador de Rita').first()).toBeVisible();
  await expect(rita.getByText('Segundo riesgo del administrador').first()).toBeVisible({ timeout: 8000 });
  await esperarGuardado(rita);
  const titulos = (await llamar(request, admin, 'GET', '/proyectos/' + pid + '/riesgos')).datos.map((r) => r.titulo).sort();
  expect(titulos).toEqual(['Borrador de Rita', 'Riesgo que Rita ve llegar', 'Segundo riesgo del administrador']);
  await otra.close();
});

test('la verificación de calidad se guarda en el servidor y no pisa lo que otra persona guardó', async ({ page, request }) => {
  await entrarComoAdmin(page, request);
  await page.evaluate(() => Gestor.intervaloRefresco(600000));
  const nombre = '.pa-entrada[data-s="enc"][data-c="nombre"]';
  const problema = '.pa-entrada[data-s="enc"][data-c="problema"]';
  await page.goto('/#/proyectos/' + pid + '/calidad/seccion/enc');
  await page.fill(nombre, 'Hospital digital');
  await page.locator(nombre).blur();
  await esperarGuardado(page);

  await page.reload();
  await page.goto('/#/proyectos/' + pid + '/calidad/seccion/enc');
  await expect(page.locator(nombre)).toHaveValue('Hospital digital');
  await page.evaluate(() => Gestor.intervaloRefresco(600000));
  const p = (await llamar(request, admin, 'GET', '/proyectos/' + pid)).datos;
  expect(p.calidad.campos.enc.nombre).toBe('Hospital digital');

  /* Otra persona guarda la verificación mientras esta pantalla sigue abierta */
  const ajena = JSON.parse(JSON.stringify(p.calidad));
  ajena.campos.enc.problema = 'Las citas se pierden por llamadas no atendidas';
  const r = await llamar(request, admin, 'PATCH', '/proyectos/' + pid, { calidad: ajena, $antes: { calidad: p.calidad } });
  expect(r.estado).toBe(200);

  await page.fill(nombre, 'Hospital digital 2027');
  await page.locator(nombre).blur();
  await expect(page.locator('.d-aviso.aviso')).toContainText('otra persona lo cambió');
  await expect(page.locator(problema)).toHaveValue('Las citas se pierden por llamadas no atendidas');
  await expect(page.locator(nombre)).toHaveValue('Hospital digital');

  await page.fill(nombre, 'Hospital digital 2027');
  await page.locator(nombre).blur();
  await esperarGuardado(page);
  const final = (await llamar(request, admin, 'GET', '/proyectos/' + pid)).datos.calidad.campos.enc;
  expect([final.nombre, final.problema]).toEqual(['Hospital digital 2027', 'Las citas se pierden por llamadas no atendidas']);
});

test('si dos personas cambian el mismo bloque, la segunda recibe un aviso y ve la versión real', async ({ page, request, browser }) => {
  const otra = await browser.newContext();
  const rita = await otra.newPage();
  await entrar(rita, RITA.correo, RITA.clave);
  await rita.evaluate(() => Gestor.intervaloRefresco(600000));
  await rita.goto('/#/proyectos/' + pid + '/documento/' + docId);
  await expect(rita.locator('.g-bloque').first()).toHaveValue('Texto original');

  await entrarComoAdmin(page, request);
  await page.goto('/#/proyectos/' + pid + '/documento/' + docId);
  await page.locator('.g-bloque').first().fill('Versión del administrador');
  await page.locator('.g-bloque').first().blur();
  await esperarGuardado(page);

  await rita.locator('.g-bloque').first().fill('Versión de Rita');
  await rita.locator('.g-bloque').first().blur();
  await expect(rita.locator('.d-aviso.aviso')).toContainText('otra persona lo cambió mientras editabas');
  await expect(rita.locator('.g-bloque').first()).toHaveValue('Versión del administrador');
  await expect(rita.locator('.d-aviso.error')).toHaveCount(0);

  const doc = (await llamar(request, admin, 'GET', '/documentos/' + docId)).datos;
  expect(doc.contenido['0']).toBe('Versión del administrador');

  /* Ahora que ve la versión real, su cambio se guarda */
  await rita.locator('.g-bloque').first().fill('Versión del administrador, revisada por Rita');
  await rita.locator('.g-bloque').first().blur();
  await esperarGuardado(rita);
  expect((await llamar(request, admin, 'GET', '/documentos/' + docId)).datos.contenido['0'])
    .toBe('Versión del administrador, revisada por Rita');
  await otra.close();
});
