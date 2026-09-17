/* E2E-04 · Colaboración: un ejecutor trabaja solo con sus tareas y el
   equipo conversa sobre el proyecto, las tareas, los documentos y los
   procesos. */

'use strict';

const { test, expect } = require('@playwright/test');
const { entrar, entrarComoAdmin, esperarGuardado, tokenAdmin, llamar, crearCuenta } = require('./ayuda-e2e');

test.describe.configure({ mode: 'serial' });

const ELI = { nombre: 'Eli Ejecutora', correo: 'eli@e2e.local', clave: 'eli-segura-1' };
const OMAR = { nombre: 'Omar Observador', correo: 'omar@e2e.local', clave: 'omar-seguro-1' };
let admin;
let pid;
let suya;
let ajena;
let docId;

test.beforeAll(async ({ request }) => {
  admin = await tokenAdmin(request);
  const p = await llamar(request, admin, 'POST', '/proyectos', { nombre: 'Clínicas E2E', metodologia: 'agil' });
  pid = p.datos.id;
  const eliId = await crearCuenta(request, admin, ELI);
  const omarId = await crearCuenta(request, admin, OMAR);
  await llamar(request, admin, 'POST', '/proyectos/' + pid + '/miembros', { usuarioId: eliId, rol: 'ejecutor' });
  await llamar(request, admin, 'POST', '/proyectos/' + pid + '/miembros', { usuarioId: omarId, rol: 'observador' });
  const sprint = (await llamar(request, admin, 'GET', '/proyectos/' + pid + '/sprint-activo')).datos.sprint;
  suya = (await llamar(request, admin, 'POST', '/proyectos/' + pid + '/tareas', {
    titulo: 'Configurar la agenda de la sede norte', responsableId: eliId, sprintId: sprint.id, estado: 'pendiente', puntos: 3
  })).datos;
  ajena = (await llamar(request, admin, 'POST', '/proyectos/' + pid + '/tareas', {
    titulo: 'Negociar el contrato del proveedor', sprintId: sprint.id, estado: 'pendiente'
  })).datos;
  await llamar(request, admin, 'POST', '/proyectos/' + pid + '/riesgos', { titulo: 'Riesgo confidencial del plan' });
  docId = (await llamar(request, admin, 'POST', '/proyectos/' + pid + '/documentos', { artefactoId: 'art-acta-proyecto' }))
    .datos.documento.id;
  await llamar(request, admin, 'POST', '/proyectos/' + pid + '/comentarios', { texto: 'Arrancamos el lunes a las 8' });
});

test('un ejecutor ve solo sus tareas, las mueve y conversa sobre ellas', async ({ page, request }) => {
  await entrar(page, ELI.correo, ELI.clave);
  await expect(page.locator('.g-proyecto')).toContainText('Mis tareas');
  await expect(page.locator('.g-proyecto')).toContainText('1 abierta');
  await expect(page.locator('[data-g="abrir-nuevo-proyecto"]')).toHaveCount(0);

  await page.click('.g-proyecto');
  await expect(page.getByRole('heading', { name: /Mis tareas/ })).toBeVisible();
  await expect(page.locator('.g-pestanas-obra a')).toHaveText(['Mis tareas', 'Calendario', 'Conversación']);
  await expect(page.locator('#arbol .arbol-proyecto .arbol-enlace')).toHaveCount(3);
  await expect(page.locator('.g-tarea')).toHaveCount(1);
  await expect(page.getByText('Negociar el contrato del proveedor')).toHaveCount(0);
  await expect(page.locator('.g-paso')).toHaveCount(0);

  await page.click('.g-tarea [data-o="avanzar-tarea"]');
  await expect(page.locator('.g-columna[data-columna="curso"] .g-tarea')).toHaveCount(1);

  await page.click('.g-tarea [data-o="hilo-tarea"]');
  const dialogo = page.locator('.d-capa.abierto .d-panel');
  await expect(dialogo).toContainText('Configurar la agenda de la sede norte');
  await dialogo.locator('.c-entrada').fill('Me falta el horario del doctor Ruiz');
  await dialogo.locator('.c-entrada').press('Control+Enter');
  await expect(dialogo.locator('.c-item')).toHaveCount(1);
  await expect(dialogo.locator('.c-item')).toContainText('Me falta el horario');
  await dialogo.locator('[data-d="cerrar"]').click();
  await expect(page.locator('.g-tarea-com')).toContainText('1');

  await page.goto('/#/proyectos/' + pid + '/dominios');
  await expect(page.getByText('Esta sección es parte del plan del proyecto')).toBeVisible();
  await expect(page.getByText('Riesgo confidencial del plan')).toHaveCount(0);
  await page.goto('/#/proyectos/' + pid + '/documento/' + docId);
  await expect(page.getByText('Esta sección es parte del plan del proyecto')).toBeVisible();

  await page.goto('/#/proyectos/' + pid + '/conversacion');
  await expect(page.locator('#contenido [data-hilo] .c-item')).toContainText('Arrancamos el lunes a las 8');
  await page.fill('#contenido [data-hilo] .c-entrada', 'Entendido, allí estaré');
  await page.click('#contenido [data-hilo] [data-c="publicar"]');
  await expect(page.locator('#contenido [data-hilo] .c-item')).toHaveCount(2);
  await expect(page.locator('.c-actividad')).toContainText('en la tarea «Configurar la agenda de la sede norte»');
  await esperarGuardado(page);

  const tarea = await llamar(request, admin, 'GET', '/tareas/' + suya.id);
  expect(tarea.datos.estado).toBe('curso');
  const comentarios = (await llamar(request, admin, 'GET', '/proyectos/' + pid + '/comentarios')).datos;
  const deEli = comentarios.filter((c) => c.texto === 'Entendido, allí estaré' || c.refId === suya.id);
  expect(deEli).toHaveLength(2);
  expect(new Set(deEli.map((c) => c.autorId)).size).toBe(1);
  expect((await llamar(request, admin, 'GET', '/tareas/' + ajena.id)).datos.estado).toBe('pendiente');
});

test('un observador ve el proyecto sin controles para cambiarlo', async ({ page }) => {
  await entrar(page, OMAR.correo, OMAR.clave);
  await page.goto('/#/proyectos/' + pid + '/trabajo');
  await expect(page.locator('.g-tarea')).toHaveCount(2);
  await expect(page.locator('[data-o="avanzar-tarea"]')).toHaveCount(0);
  await expect(page.locator('#nt-titulo')).toHaveCount(0);
  await page.goto('/#/proyectos/' + pid + '/dominios');
  await expect(page.getByText('Riesgo confidencial del plan').first()).toBeVisible();
  await expect(page.locator('#nr2-titulo')).toHaveCount(0);
  await page.goto('/#/proyectos/' + pid + '/conversacion');
  await expect(page.locator('#contenido [data-hilo] .c-entrada')).toBeVisible();
});

test('los comentarios de documentos y procesos se publican, corrigen y borran con «Deshacer»', async ({ page, request }) => {
  await entrarComoAdmin(page, request);
  await page.goto('/#/proyectos/' + pid + '/documento/' + docId);
  const hilo = page.locator('#contenido [data-hilo][data-ref-tipo="documento"]');
  await hilo.locator('.c-entrada').fill('Falta el presupuesto aprobado');
  await hilo.locator('[data-c="publicar"]').click();
  await expect(hilo.locator('.c-item')).toContainText('Falta el presupuesto aprobado');
  await expect(hilo.locator('.c-entrada')).toBeFocused();

  await hilo.locator('[data-c="editar"]').click();
  await page.fill('#d-texto', 'Falta el presupuesto aprobado por el comité');
  await page.click('[data-d="aceptar"]');
  await expect(hilo.locator('.c-item')).toContainText('por el comité');

  await hilo.locator('[data-c="borrar"]').click();
  await expect(hilo.locator('.c-item')).toHaveCount(0);
  await page.locator('.d-aviso-accion').last().click();
  await expect(hilo.locator('.c-item')).toContainText('por el comité');

  await page.goto('/#/proyectos/' + pid + '/proceso/p-gob-01');
  const delProceso = page.locator('#contenido [data-hilo][data-ref-tipo="proceso"]');
  await delProceso.locator('.c-entrada').fill('¿Quién firma el acta?');
  await delProceso.locator('[data-c="publicar"]').click();
  await expect(delProceso.locator('.c-item')).toHaveCount(1);
  await esperarGuardado(page);

  await page.goto('/#/proyectos/' + pid + '/conversacion');
  await expect(page.locator('.c-actividad')).toContainText('en el proceso 2.1.1');
  await expect(page.locator('.c-actividad')).toContainText('en el documento «Acta de Constitución del Proyecto»');

  const docs = (await llamar(request, admin, 'GET', '/proyectos/' + pid + '/comentarios')).datos
    .filter((c) => c.refTipo === 'documento');
  expect(docs.map((c) => c.texto)).toEqual(['Falta el presupuesto aprobado por el comité']);
});
