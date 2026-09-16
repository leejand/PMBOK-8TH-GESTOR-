# Backend del Gestor PMBOK® 8

API REST en **Node.js + Express 5** con base de datos **PostgreSQL 17**. Guarda en el servidor
todo lo que hoy la interfaz guarda en `localStorage`: usuarios, permisos, portafolios, proyectos
con sus 40 procesos, documentos, archivos, riesgos, trabajo ágil, valor ganado y la capa EOS.

> **Estado:** el backend y la base de datos están completos y probados (91 pruebas de aceptación).
> La interfaz (`assets/js/gestor.js`) **todavía lee y escribe en el navegador**; conectarla a esta
> API es la siguiente fase. Mientras tanto, el servidor ya sirve la interfaz en
> `http://localhost:3000` y permite importar lo guardado en el navegador.

---

## Puesta en marcha

### Lo que ya está instalado en este equipo

| Pieza | Dónde | Detalle |
|---|---|---|
| PostgreSQL 17.6 | `C:\Users\lucio\pgsql` | Binarios oficiales (sin instalador: no hacían falta permisos de administrador) |
| Datos del clúster | `C:\Users\lucio\pgsql\data` | Fuera de OneDrive a propósito: la sincronización corrompe una base viva |
| Superusuario | `postgres` / `Lucio 12345` | Solo escucha en `localhost:5432` |
| Arranque automático | `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\PostgreSQL-PMBOK8.vbs` | Inicia PostgreSQL al iniciar sesión. Borra el archivo para desactivarlo |
| Bases | `pmbok8` (trabajo) y `pmbok8_test` (pruebas) | UTF-8, ordenación ICU `es-CO`, zona `America/Bogota` |

### Arrancar

Doble clic en **`backend\iniciar.cmd`**: arranca PostgreSQL si hace falta, instala dependencias
la primera vez y levanta la API. Después abre **http://localhost:3000** y entra con
`admin@pmbok.local` · `admin123`.

Desde una consola en `backend\`:

```bat
npm run bd:iniciar      :: arranca PostgreSQL        (bd:detener, bd:estado)
npm start               :: levanta la API en el puerto 3000
npm run dev             :: igual, reiniciando al cambiar el código
npm test                :: batería de aceptación (usa pmbok8_test, nunca pmbok8)
npm run db:migrar       :: aplica migraciones pendientes
npm run db:reiniciar    :: BORRA pmbok8 y la crea de cero con el administrador
```

Al arrancar, el servidor crea la base si falta, aplica las migraciones pendientes, sincroniza el
catálogo y garantiza que exista un administrador. Solo escucha en el propio equipo
(`127.0.0.1` y `::1`).

### En otro equipo

1. Instala Node.js 20 o superior y PostgreSQL 15 o superior.
2. Copia `.env.example` a `.env` y rellena `PGPASSWORD` y `JWT_SECRETO`.
3. `npm install` y `npm start`.

### Configuración (`backend/.env`)

| Variable | Por defecto | Uso |
|---|---|---|
| `PORT` | `3000` | Puerto HTTP |
| `HOST` | `127.0.0.1` y `::1` | Dirección de escucha; ponla solo si necesitas otra |
| `PGHOST` `PGPORT` `PGUSER` `PGPASSWORD` `PGDATABASE` | `localhost` `5432` `postgres` — `pmbok8` | Conexión. La contraseña con espacios va entre comillas |
| `JWT_SECRETO` | aleatorio en cada arranque | Firma de los tokens. Sin él, las sesiones caducan al reiniciar |
| `JWT_EXPIRA_HORAS` | `12` | Duración de una sesión |
| `ADMIN_CORREO` `ADMIN_CLAVE` | `admin@pmbok.local` `admin123` | Cuenta inicial, solo si no hay ningún administrador |
| `CORS_ORIGENES` | `localhost:3000`, `localhost:8000`, `null` | Orígenes admitidos (`null` = `index.html` abierto desde el disco) |
| `ARCHIVO_LIMITE_MB` | `10` | Tamaño máximo de un archivo subido |

---

## Estructura

```
backend/
  iniciar.cmd                 Arranque con doble clic
  scripts/postgres.cmd        iniciar | detener | estado de PostgreSQL
  db/
    migraciones/001_esquema.sql   Tablas, restricciones, disparadores, nivel_en() y vista de avance
    migrar.js                 Crea la base y aplica migraciones (tabla schema_migraciones)
    semilla.js                Catálogo + administrador inicial (idempotente)
  src/
    servidor.js               Arranque: migrar, sembrar y escuchar
    app.js                    Express: API en /api, interfaz en / y /assets
    config.js · db.js         Entorno y pool de conexiones
    catalogo.js               Lee assets/js/datos/*.js (una sola fuente de verdad)
    definiciones.js           Tablas, campos y validación (zod) de cada recurso
    repositorio.js            CRUD genérico camelCase ⇄ snake_case
    errores.js · validacion.js
    middleware/auth.js        Sesión, roles y nivel por proyecto
    servicios/                sesiones · proyectos · trabajo · documentos · datos
    rutas/                    auth · usuarios · proyectos · organizacion · recursos
  tests/
    ayuda.js                  Base aislada + servidor real en puerto libre
    aceptacion/*.test.js      10 historias de usuario, 91 criterios
```

El backend **no duplica el contenido de la guía**: metodologías, flujo de los 40 procesos y
plantillas de los 42 artefactos se leen de `assets/js/datos/` al arrancar y se vuelcan a las
tablas `catalogo_procesos` y `catalogo_artefactos`, que sirven de claves foráneas.

## Modelo de datos

28 tablas y una vista (`v_progreso_proyecto`). Entidades y series temporales van en tablas propias; las listas pequeñas que la
interfaz edita enteras (fases, hitos, DoD, metas de una roca, orden del flujo y estado de la
verificación de calidad) van en `JSONB` con su tipo comprobado.

| Área | Tablas |
|---|---|
| Acceso | `usuarios` (hash bcrypt), `sesiones`, `permisos` |
| Cartera | `portafolios`, `programas`, `proyectos`, `miembros` |
| Ciclo de vida | `proyecto_procesos`, `documentos`, `archivos`, `archivo_contenidos` (binario aparte) |
| Dominios | `riesgos`, `interesados`, `cambios`, `lecciones`, `comentarios` |
| Trabajo y control | `sprints`, `sprint_burndown` (una fila por día), `tareas`, `mediciones` |
| EOS | `rocas`, `metricas`, `metrica_valores` (una fila por semana), `asientos`, `vto` |
| Catálogo | `catalogo_procesos`, `catalogo_artefactos`, `schema_migraciones` |

Reglas que garantiza la propia base, no solo la API:

- Valores permitidos (`CHECK`) para estados, roles, metodologías, estrategias, escalas 1-5 y fechas coherentes.
- Un solo sprint activo por proyecto (índice único parcial).
- Una tarea solo puede apuntar a un sprint **de su mismo proyecto** (clave foránea compuesta).
- Un documento por artefacto y proyecto; un miembro por usuario y proyecto.
- Borrar un proyecto borra en cascada todo lo suyo; borrar un portafolio deja sus proyectos sin portafolio.
- Los permisos apuntan a un portafolio, programa o proyecto existente, y desaparecen con él (disparadores).
- `nivel_en(proyecto, usuario)` calcula el acceso efectivo en SQL.
- Los identificadores son `TEXT`: se conservan los que genera el navegador al importar.

## Permisos

Nivel efectivo por proyecto: **0** sin acceso · **1** ver · **2** editar · **3** dirigir.
Administrador y director del proyecto dirigen; el líder del equipo dirige; el resto de miembros
edita; los permisos por portafolio, programa o proyecto se suman y **gana el más alto**.

| Acción | Quién |
|---|---|
| Ver un proyecto y todo lo suyo | nivel ≥ 1 (si es 0, la API responde **404**, no revela que existe) |
| Comentar | nivel ≥ 1; editar o borrar un comentario: su autor o nivel ≥ 2 |
| Procesos, documentos, archivos, riesgos, tareas, sprints, mediciones, hitos, DoD, calidad, orden del flujo | nivel ≥ 2 |
| Configuración del proyecto, metodología, fases, equipo, borrar el proyecto | nivel 3 |
| Crear proyectos; crear o cambiar portafolios, programas, rocas, métricas, asientos y VTO | rol `admin` o `director` |
| Leer portafolios, EOS, usuarios y catálogo | cualquier sesión (el catálogo es público) |
| Usuarios, permisos, exportar, importar y reiniciar | rol `admin` |

Las reglas de crear proyectos y de editar la estructura siguen la descripción de los roles de la
aplicación («el director crea y dirige proyectos», «el ejecutor no edita planes»). La interfaz
actual todavía no las aplica: lo hará al conectarse a la API.

---

## API

Todas las rutas empiezan por `/api`, hablan JSON y, salvo las públicas, exigen la cabecera
`Authorization: Bearer <token>`. Las fechas-hora van en **milisegundos** y las fechas en
`AAAA-MM-DD`, igual que en la base local del navegador. Los campos van en camelCase.

**Errores:** `{ "error": "mensaje legible", "codigo": "CLAVE", "detalles": [{ "campo", "mensaje" }] }`
con 400 (datos no válidos), 401 (sin sesión), 403 (sin permiso), 404, 409 (conflicto),
413 (demasiado grande) o 429 (demasiados intentos de acceso).

### Públicas

| Método y ruta | Descripción |
|---|---|
| `GET /api/salud` | Estado de la base y del catálogo |
| `GET /api/catalogo/metodologias` · `bandas` · `procesos` · `artefactos` · `artefactos/:id` | Contenido de la guía |
| `POST /api/auth/entrar` | `{ correo, clave }` → `{ token, expira, usuario }` |

### Sesión y administración

| Método y ruta | Descripción |
|---|---|
| `POST /api/auth/salir` · `GET /api/auth/yo` · `PUT /api/auth/clave` | Cerrar sesión, perfil, cambiar la propia contraseña (`{ actual, nueva }`) |
| `GET /api/usuarios` · `GET /api/usuarios/roles` · `GET /api/usuarios/:id` | Listar (sin contraseñas) |
| `POST /api/usuarios` · `PATCH /api/usuarios/:id` · `PUT /api/usuarios/:id/clave` · `DELETE /api/usuarios/:id` | Solo admin. Siempre queda un admin activo |
| `GET /api/permisos?usuarioId=` · `POST /api/permisos` · `DELETE /api/permisos/:id` | Conceder (`{ usuarioId, ambito, refId, nivel }`, cambia el nivel si ya existía) y revocar |
| `GET /api/datos/exportar` · `POST /api/datos/importar` · `POST /api/datos/reiniciar` | Formato `pmbok8-gestor`; reiniciar exige `{ "confirmacion": "ELIMINAR" }` |

### Proyectos

| Método y ruta | Descripción |
|---|---|
| `GET /api/panel` · `GET /api/calendario` | Cifras y siguiente paso; agenda de todos los proyectos visibles |
| `GET /api/proyectos` · `POST /api/proyectos` | Visibles con nivel y avance; crear (con fases, líder y Sprint 0 si es ágil o híbrido) |
| `GET` · `PATCH` · `DELETE /api/proyectos/:id` | Detalle con avance y siguiente paso; editar; borrar en cascada |
| `GET /api/proyectos/:id/progreso` · `siguiente` · `evm` · `salud` · `matriz-riesgos` · `calendario` · `velocidad` · `sprint-activo` | Indicadores calculados |
| `GET /api/proyectos/:id/procesos` · `GET …/procesos/:procesoId` | Los 40 procesos con banda efectiva, estado, notas e iterativo; ficha con entradas y salidas |
| `PUT …/procesos/:procesoId` | `{ estado?, notas? }` |
| `PUT …/procesos/:procesoId/banda` | `{ banda }` — mover en el flujo; volver a la original borra el ajuste |
| `GET …/procesos/:procesoId/entradas` · `salidas` | ¿Existe ya cada documento? |
| `GET` · `POST /api/proyectos/:id/documentos` | Listar con completitud; generar `{ artefactoId, procesoId? }` (idempotente) |
| `GET` · `PATCH` · `DELETE /api/documentos/:id` | Con plantilla; `{ estado?, nombre?, contenido? }` |
| `PUT /api/documentos/:id/bloques/:indice` | `{ valor }` — texto o tabla (`[[...], ...]`); vacío borra el bloque |
| `POST /api/documentos/:id/versiones` | Versión + 1 y vuelta a borrador |
| `GET` · `POST /api/proyectos/:id/archivos` | Listar; subir `multipart/form-data` (`archivo`, `categoria?`, `nombre?`) |
| `GET /api/archivos/:id` · `GET /api/archivos/:id/contenido[?enLinea=1]` · `DELETE /api/archivos/:id` | Metadatos, descarga (en línea solo imágenes, PDF y texto), borrar |

### Registros de un proyecto

Para **`miembros`, `riesgos`, `interesados`, `cambios`, `lecciones`, `tareas`, `sprints`,
`mediciones` y `comentarios`**:

```
GET    /api/proyectos/:id/<recurso>         listar
POST   /api/proyectos/:id/<recurso>         crear (acepta id y creado para «Deshacer»)
GET    /api/<recurso>/:rid                  leer      (también /api/proyectos/:id/<recurso>/:rid)
PATCH  /api/<recurso>/:rid                  editar
DELETE /api/<recurso>/:rid                  borrar
```

Además: `POST /api/sprints/:id/cerrar` (suma lo entregado y devuelve lo pendiente al backlog),
`GET|POST /api/sprints/:id/burndown`. Crear un sprint activo cierra el anterior, y cualquier
cambio en las tareas fotografía el burndown del día automáticamente.

### Organización

| Método y ruta | Descripción |
|---|---|
| `/api/portafolios` · `/api/programas?portafolioId=` · `/api/rocas?trimestre=Q3-2026` · `/api/metricas` · `/api/asientos` | `GET`, `POST`, `GET /:id`, `PATCH /:id`, `DELETE /:id` |
| `GET` · `POST /api/portafolios/:id/programas` | Programas de un portafolio |
| `PUT /api/metricas/:id/valores/:semana` | `{ valor }` — una celda del scorecard; vacío la borra |
| `GET /api/vto` · `PUT /api/vto/:bloqueId` | Las respuestas del VTO; texto vacío borra el bloque |

Ejemplo:

```bash
curl -s -X POST http://localhost:3000/api/auth/entrar -H "Content-Type: application/json" \
     -d "{\"correo\":\"admin@pmbok.local\",\"clave\":\"admin123\"}"
curl -s http://localhost:3000/api/proyectos -H "Authorization: Bearer <token>"
```

---

## Llevar al servidor lo guardado en el navegador

1. En la aplicación abierta como hasta ahora: **Administración → Exportar datos** (`pmbok8-gestor.json`).
2. Obtén un token de administrador (`POST /api/auth/entrar`) y envía el archivo a la API
   (hasta que la interfaz lo haga sola):

   ```bash
   curl -X POST http://localhost:3000/api/datos/importar -H "Authorization: Bearer <token>" \
        -H "Content-Type: application/json" --data-binary @pmbok8-gestor.json
   ```

La importación **reemplaza** los datos del servidor dentro de una transacción y sanea cada registro:
las referencias rotas se anulan o el registro se omite, y la respuesta dice cuántos se importaron
y cuántos se omitieron. La exportación del navegador no lleva contraseñas: las cuentas que ya
existían conservan la suya y las nuevas reciben **`cambiar123`**. El contenido de los archivos
subidos vive en el IndexedDB del navegador y no viaja: hay que volver a subirlos.

## Copias de seguridad

```bat
set PGPASSWORD=Lucio 12345
C:\Users\lucio\pgsql\bin\pg_dump.exe -h localhost -U postgres -Fc -f pmbok8.dump pmbok8
C:\Users\lucio\pgsql\bin\pg_restore.exe -h localhost -U postgres -d pmbok8 --clean pmbok8.dump
```

---

## Pruebas de aceptación

`npm test` recrea `pmbok8_test` en cada archivo, levanta la API real en un puerto libre y la usa
por HTTP como lo haría la interfaz. Cada archivo es una historia de usuario y cada prueba un
criterio de aceptación:

| Historia | Criterios | Qué comprueba |
|---|---|---|
| HU-01 Acceso y sesiones | 11 | Entrada, 401 uniformes, token manipulado, salida inmediata, cambio de contraseña, cuenta desactivada, bloqueo tras 10 fallos |
| HU-02 Usuarios y permisos | 8 | Roles, validaciones, último administrador, permisos que se suman, limpieza al borrar |
| HU-03 Proyectos | 10 | Creación por metodología, validaciones, coherencia portafolio-programa, editar frente a dirigir, 404 a ajenos, cascada, panel |
| HU-04 Procesos y documentos | 11 | 40 procesos (2·19·8·10·1), siguiente paso, avance con omitidos, mover bandas, documentos idempotentes, bloques, completitud, aprobación y versiones |
| HU-05 Trabajo ágil | 10 | Backlog, burndown diario real, cierre de sprint, velocidad, un solo sprint activo, sprint de otro proyecto |
| HU-06 Dominios y valor ganado | 12 | Severidad P×I, matriz, «Deshacer», interesados, cambios, lecciones, CV·SV·CPI·SPI·EAC·ETC·VAC·TCPI, calendario, comentarios, equipo |
| HU-07 Archivos | 7 | Subida con tildes, bytes íntegros, HTML nunca en línea, límite de 10 MB, permisos, borrado del contenido |
| HU-08 Cartera y EOS | 7 | Portafolios y programas, rocas y metas, scorecard, organigrama sin ciclos, VTO, responsables eliminados |
| HU-09 Datos | 7 | Exportación sin contraseñas, importación saneada de una exportación del navegador, ida y vuelta idéntica, reinicio |
| HU-10 Interfaz y seguridad | 8 | Sirve la interfaz, no expone `.env` ni el código, cabeceras, CORS, catálogo, inyección SQL, cuerpos enormes |

Última ejecución: **91 de 91 superadas** en unos 23 s.
