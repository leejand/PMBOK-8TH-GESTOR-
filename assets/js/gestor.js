/* ═══════════════════════════════════════════════════════════
   gestor.js — Base de datos local del gestor de proyectos
   ───────────────────────────────────────────────────────────
   Usuarios y sesión, portafolios y programas, proyectos con sus
   40 procesos, documentos, riesgos, interesados, cambios,
   lecciones, tareas, sprints, mediciones de valor ganado y la
   capa EOS de gerencia.

   Todo vive en el navegador (localStorage). El control de acceso
   es organizativo, no criptográfico: sirve para separar espacios
   de trabajo entre compañeros, no para proteger secretos.
   ═══════════════════════════════════════════════════════════ */

window.Gestor = (function () {
  'use strict';

  var CLAVE = 'pmbok8.bd';
  var bd = null;

  var COLECCIONES = [
    'usuarios', 'permisos', 'portafolios', 'programas', 'proyectos', 'miembros',
    'procesos', 'documentos', 'archivos', 'riesgos', 'interesados', 'cambios',
    'lecciones', 'tareas', 'sprints', 'mediciones', 'comentarios',
    'rocas', 'metricas', 'asientos'
  ];

  /* ══════════════ Persistencia ══════════════ */

  function vacia() {
    var b = { version: 1, creada: Date.now(), vto: {}, sesion: null };
    COLECCIONES.forEach(function (c) { b[c] = []; });
    return b;
  }

  function cargar() {
    if (bd) return bd;
    try {
      var crudo = localStorage.getItem(CLAVE);
      bd = crudo ? JSON.parse(crudo) : null;
    } catch (e) { bd = null; }
    if (!bd) { bd = vacia(); sembrar(); }
    COLECCIONES.forEach(function (c) { if (!bd[c]) bd[c] = []; });
    if (!bd.vto) bd.vto = {};
    return bd;
  }

  function guardar() {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(bd));
      return true;
    } catch (e) {
      return false;
    }
  }

  function reiniciarTodo() {
    bd = vacia();
    sembrar();
    guardar();
  }

  /* ══════════════ Utilidades ══════════════ */

  var contador = 0;
  function nuevoId(prefijo) {
    contador++;
    return (prefijo || 'x') + '-' + Date.now().toString(36) + '-' + contador.toString(36);
  }

  /* Huella de la contraseña. No es criptografía: evita guardarla
     en claro, nada más. El almacenamiento es local por diseño. */
  function huella(texto) {
    var h = 5381;
    var s = String(texto || '');
    for (var i = 0; i < s.length; i++) {
      h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    }
    return 'h' + h.toString(36);
  }

  function ahora() { return Date.now(); }

  /* ══════════════ CRUD genérico ══════════════ */

  function lista(coleccion, filtro) {
    var datos = cargar()[coleccion] || [];
    if (!filtro) return datos.slice();
    return datos.filter(function (x) {
      return Object.keys(filtro).every(function (k) { return x[k] === filtro[k]; });
    });
  }

  function uno(coleccion, id) {
    return lista(coleccion).filter(function (x) { return x.id === id; })[0] || null;
  }

  function crear(coleccion, datos) {
    var b = cargar();
    var obj = datos || {};
    obj.id = obj.id || nuevoId(coleccion.slice(0, 3));
    obj.creado = obj.creado || ahora();
    b[coleccion].push(obj);
    guardar();
    return obj;
  }

  function actualizar(coleccion, id, cambios) {
    var obj = uno(coleccion, id);
    if (!obj) return null;
    Object.keys(cambios || {}).forEach(function (k) { obj[k] = cambios[k]; });
    obj.actualizado = ahora();
    guardar();
    return obj;
  }

  function borrar(coleccion, id) {
    var b = cargar();
    var antes = b[coleccion].length;
    b[coleccion] = b[coleccion].filter(function (x) { return x.id !== id; });
    guardar();
    return b[coleccion].length < antes;
  }

  /* ══════════════ Semilla inicial ══════════════ */

  function sembrar() {
    bd.usuarios.push({
      id: 'u-admin',
      nombre: 'Administrador',
      correo: 'admin@pmbok.local',
      clave: huella('admin123'),
      rol: 'admin',
      activo: true,
      creado: ahora()
    });
  }

  /* ══════════════ Sesión y usuarios ══════════════ */

  function entrar(correo, clave) {
    var b = cargar();
    var u = b.usuarios.filter(function (x) {
      return x.correo.toLowerCase() === String(correo || '').trim().toLowerCase();
    })[0];
    if (!u) return { error: 'No existe ninguna cuenta con ese correo.' };
    if (!u.activo) return { error: 'La cuenta está desactivada. Pide a un administrador que la reactive.' };
    if (u.clave !== huella(clave)) return { error: 'La contraseña no coincide.' };
    b.sesion = { usuarioId: u.id, desde: ahora() };
    guardar();
    return { usuario: u };
  }

  function salir() {
    var b = cargar();
    b.sesion = null;
    guardar();
  }

  function usuarioActual() {
    var b = cargar();
    if (!b.sesion) return null;
    return uno('usuarios', b.sesion.usuarioId);
  }

  function haySesion() { return !!usuarioActual(); }

  function esAdmin() {
    var u = usuarioActual();
    return !!u && u.rol === 'admin';
  }

  function crearUsuario(datos) {
    var correo = String(datos.correo || '').trim().toLowerCase();
    if (!correo) return { error: 'Falta el correo.' };
    if (lista('usuarios').some(function (u) { return u.correo.toLowerCase() === correo; })) {
      return { error: 'Ya existe una cuenta con ese correo.' };
    }
    if (!datos.clave || datos.clave.length < 6) {
      return { error: 'La contraseña debe tener al menos 6 caracteres.' };
    }
    var u = crear('usuarios', {
      nombre: datos.nombre || correo,
      correo: correo,
      clave: huella(datos.clave),
      rol: datos.rol || 'miembro',
      activo: true
    });
    return { usuario: u };
  }

  function cambiarClave(usuarioId, nueva) {
    if (!nueva || nueva.length < 6) return { error: 'La contraseña debe tener al menos 6 caracteres.' };
    actualizar('usuarios', usuarioId, { clave: huella(nueva) });
    return { ok: true };
  }

  var ROLES = [
    { id: 'admin', nombre: 'Administrador', descripcion: 'Ve y edita todo; gestiona usuarios y permisos.' },
    { id: 'director', nombre: 'Director de proyecto', descripcion: 'Crea y dirige proyectos propios.' },
    { id: 'miembro', nombre: 'Miembro de equipo', descripcion: 'Trabaja en los proyectos donde se le asigna.' },
    { id: 'ejecutor', nombre: 'Ejecutor', descripcion: 'Ve sus tareas y comenta; no edita planes.' }
  ];

  /* ══════════════ Permisos ══════════════ */

  var NIVELES = { ver: 1, editar: 2, dirigir: 3 };

  function permisosDe(usuarioId) {
    return lista('permisos', { usuarioId: usuarioId });
  }

  function conceder(usuarioId, ambito, refId, nivel) {
    var existente = lista('permisos').filter(function (p) {
      return p.usuarioId === usuarioId && p.ambito === ambito && p.refId === refId;
    })[0];
    if (existente) return actualizar('permisos', existente.id, { nivel: nivel });
    return crear('permisos', { usuarioId: usuarioId, ambito: ambito, refId: refId, nivel: nivel });
  }

  function revocar(permisoId) { return borrar('permisos', permisoId); }

  /* Nivel efectivo del usuario sobre un proyecto */
  function nivelEn(proyectoId, usuarioId) {
    var u = usuarioId ? uno('usuarios', usuarioId) : usuarioActual();
    if (!u) return 0;
    if (u.rol === 'admin') return NIVELES.dirigir;

    var p = uno('proyectos', proyectoId);
    if (!p) return 0;
    if (p.directorId === u.id) return NIVELES.dirigir;

    var max = 0;
    permisosDe(u.id).forEach(function (perm) {
      var aplica =
        (perm.ambito === 'proyecto' && perm.refId === proyectoId) ||
        (perm.ambito === 'programa' && perm.refId === p.programaId) ||
        (perm.ambito === 'portafolio' && perm.refId === p.portafolioId);
      if (aplica) max = Math.max(max, NIVELES[perm.nivel] || 0);
    });

    var m = lista('miembros', { proyectoId: proyectoId }).filter(function (x) { return x.usuarioId === u.id; })[0];
    if (m) max = Math.max(max, m.rol === 'lider' ? NIVELES.dirigir : NIVELES.editar);

    return max;
  }

  function puede(proyectoId, nivel) {
    return nivelEn(proyectoId) >= (NIVELES[nivel] || 1);
  }

  /* Proyectos visibles para el usuario actual */
  function proyectosVisibles() {
    var u = usuarioActual();
    if (!u) return [];
    if (u.rol === 'admin') return lista('proyectos');
    return lista('proyectos').filter(function (p) { return nivelEn(p.id) > 0; });
  }

  /* ══════════════ Proyectos ══════════════ */

  function metodologia(id) {
    return (PMBOK.metodologias || []).filter(function (m) { return m.id === id; })[0] ||
           (PMBOK.metodologias || [])[0];
  }

  function crearProyecto(datos) {
    var u = usuarioActual();
    if (!u) return { error: 'No hay sesión iniciada.' };
    if (!datos.nombre || !datos.nombre.trim()) return { error: 'El proyecto necesita un nombre.' };

    var met = metodologia(datos.metodologia || 'predictivo');
    var p = crear('proyectos', {
      nombre: datos.nombre.trim(),
      descripcion: datos.descripcion || '',
      metodologia: met.id,
      portafolioId: datos.portafolioId || null,
      programaId: datos.programaId || null,
      rocaId: datos.rocaId || null,
      inicio: datos.inicio || null,
      fin: datos.fin || null,
      presupuesto: datos.presupuesto ? Number(datos.presupuesto) : null,
      moneda: datos.moneda || 'USD',
      estado: 'activo',
      directorId: u.id,
      fases: met.fases.map(function (f, i) { return { id: nuevoId('fase'), nombre: f, orden: i + 1 }; }),
      orden: {}
    });

    crear('miembros', { proyectoId: p.id, usuarioId: u.id, rol: 'lider' });

    if (met.id === 'agil' || met.id === 'hibrido') {
      crear('sprints', {
        proyectoId: p.id, nombre: 'Sprint 0 — Preparación',
        objetivo: 'Preparar el entorno, el backlog inicial y los acuerdos de trabajo.',
        dias: 14, estado: 'activo', comprometido: 0, entregado: 0
      });
    }
    return { proyecto: p };
  }

  function proyecto(id) { return uno('proyectos', id); }

  function borrarProyecto(id) {
    ['procesos', 'documentos', 'archivos', 'riesgos', 'interesados', 'cambios', 'lecciones',
     'tareas', 'sprints', 'mediciones', 'comentarios', 'miembros'].forEach(function (c) {
      var b = cargar();
      b[c] = b[c].filter(function (x) { return x.proyectoId !== id; });
    });
    borrar('proyectos', id);
    guardar();
  }

  /* ── Estado de los 40 procesos ─────────────────────────── */

  function estadoProceso(proyectoId, procesoId) {
    var e = lista('procesos', { proyectoId: proyectoId }).filter(function (x) {
      return x.procesoId === procesoId;
    })[0];
    return e || { proyectoId: proyectoId, procesoId: procesoId, estado: 'pendiente', notas: '' };
  }

  function fijarEstadoProceso(proyectoId, procesoId, cambios) {
    var e = lista('procesos', { proyectoId: proyectoId }).filter(function (x) {
      return x.procesoId === procesoId;
    })[0];
    if (e) return actualizar('procesos', e.id, cambios);
    var base = { proyectoId: proyectoId, procesoId: procesoId, estado: 'pendiente', notas: '' };
    Object.keys(cambios || {}).forEach(function (k) { base[k] = cambios[k]; });
    return crear('procesos', base);
  }

  /* Banda efectiva: la del flujo, salvo que el proyecto la haya movido */
  function bandaDe(proyectoId, procesoId) {
    var p = proyecto(proyectoId);
    var f = PMBOK.flujoPorId[procesoId];
    if (p && p.orden && p.orden[procesoId]) return p.orden[procesoId];
    return f ? f.banda : 'planificacion';
  }

  function moverProceso(proyectoId, procesoId, banda) {
    var p = proyecto(proyectoId);
    if (!p) return;
    if (!p.orden) p.orden = {};
    p.orden[procesoId] = banda;
    actualizar('proyectos', proyectoId, { orden: p.orden });
  }

  function procesosDeBanda(proyectoId, banda) {
    return (PMBOK.flujo || [])
      .filter(function (f) { return bandaDe(proyectoId, f.id) === banda; })
      .sort(function (a, b) { return a.orden - b.orden; });
  }

  function esIterativo(proyectoId, procesoId) {
    var p = proyecto(proyectoId);
    if (!p) return false;
    var met = metodologia(p.metodologia);
    return (met.iterativos || []).indexOf(procesoId) !== -1;
  }

  /* El primer proceso que falta, en el orden del ciclo de vida del proyecto.
     Es la respuesta a «¿y ahora qué hago?», que es lo que más se pregunta. */
  function siguienteProceso(proyectoId) {
    var ordenBanda = { inicio: 1, planificacion: 2, ejecucion: 3, monitoreo: 4, cierre: 5 };
    var pendientes = (PMBOK.flujo || []).filter(function (f) {
      var e = estadoProceso(proyectoId, f.id).estado;
      return e !== 'completado' && e !== 'omitido';
    }).sort(function (a, b) {
      var ba = ordenBanda[bandaDe(proyectoId, a.id)] || 9;
      var bb = ordenBanda[bandaDe(proyectoId, b.id)] || 9;
      /* Lo que ya está en curso va antes que lo que no se ha empezado */
      var ea = estadoProceso(proyectoId, a.id).estado === 'iniciado' ? 0 : 1;
      var eb = estadoProceso(proyectoId, b.id).estado === 'iniciado' ? 0 : 1;
      return (ea - eb) || (ba - bb) || (a.orden - b.orden);
    });
    return pendientes[0] || null;
  }

  function progreso(proyectoId) {
    var estados = lista('procesos', { proyectoId: proyectoId });
    var completados = estados.filter(function (e) { return e.estado === 'completado'; }).length;
    var omitidos = estados.filter(function (e) { return e.estado === 'omitido'; }).length;
    var total = (PMBOK.flujo || []).length;
    var aplicables = total - omitidos;
    return {
      completados: completados,
      omitidos: omitidos,
      total: total,
      aplicables: aplicables,
      porcentaje: aplicables ? Math.round((completados / aplicables) * 100) : 0
    };
  }

  /* ══════════════ Documentos ══════════════ */

  function artefacto(id) {
    return (PMBOK.artefactos || []).filter(function (a) { return a.id === id; })[0] || null;
  }

  function documentosDe(proyectoId) {
    return lista('documentos', { proyectoId: proyectoId }).sort(function (a, b) {
      return (b.actualizado || b.creado) - (a.actualizado || a.creado);
    });
  }

  function documentoDe(proyectoId, artefactoId) {
    return lista('documentos', { proyectoId: proyectoId }).filter(function (d) {
      return d.artefactoId === artefactoId;
    })[0] || null;
  }

  function generarDocumento(proyectoId, artefactoId, procesoId) {
    var art = artefacto(artefactoId);
    if (!art) return { error: 'Ese artefacto no existe.' };
    var existente = documentoDe(proyectoId, artefactoId);
    if (existente) return { documento: existente, yaExistia: true };

    var doc = crear('documentos', {
      proyectoId: proyectoId,
      artefactoId: artefactoId,
      nombre: art.nombre,
      categoria: art.categoria,
      version: 1,
      estado: 'borrador',
      procesoId: procesoId || null,
      contenido: {},
      autorId: (usuarioActual() || {}).id || null
    });
    return { documento: doc };
  }

  function guardarBloque(documentoId, indice, valor) {
    var d = uno('documentos', documentoId);
    if (!d) return false;
    if (!d.contenido) d.contenido = {};
    d.contenido[indice] = valor;
    actualizar('documentos', documentoId, { contenido: d.contenido });
    return true;
  }

  function cambiarEstadoDocumento(documentoId, estado) {
    var d = uno('documentos', documentoId);
    if (!d) return null;
    var cambios = { estado: estado };
    if (estado === 'aprobado') cambios.aprobado = ahora();
    return actualizar('documentos', documentoId, cambios);
  }

  function nuevaVersion(documentoId) {
    var d = uno('documentos', documentoId);
    if (!d) return null;
    return actualizar('documentos', documentoId, { version: (d.version || 1) + 1, estado: 'borrador' });
  }

  /* Cuántos bloques de la plantilla están rellenados */
  function completitudDocumento(doc) {
    var art = artefacto(doc.artefactoId);
    if (!art) return 0;
    var total = art.plantilla.length;
    var llenos = art.plantilla.filter(function (b, i) {
      var v = (doc.contenido || {})[i];
      if (b.t === 'tabla') return v && v.length && v.some(function (fila) {
        return fila.some(function (c) { return String(c || '').trim(); });
      });
      return v && String(v).trim();
    }).length;
    return total ? Math.round((llenos / total) * 100) : 0;
  }

  /* Estado de cada entrada de un proceso: ¿existe ya el documento? */
  function disponibilidadEntradas(proyectoId, procesoId) {
    var f = PMBOK.flujoPorId[procesoId];
    if (!f) return [];
    return (f.entradas || []).map(function (aid) {
      var art = artefacto(aid);
      var doc = documentoDe(proyectoId, aid);
      return {
        artefactoId: aid,
        nombre: art ? art.nombre : aid,
        categoria: art ? art.categoria : '',
        documento: doc,
        disponible: !!doc
      };
    });
  }

  function salidasDe(proyectoId, procesoId) {
    var f = PMBOK.flujoPorId[procesoId];
    if (!f) return [];
    return (f.salidas || []).map(function (aid) {
      var art = artefacto(aid);
      var doc = documentoDe(proyectoId, aid);
      return {
        artefactoId: aid,
        nombre: art ? art.nombre : aid,
        categoria: art ? art.categoria : '',
        documento: doc,
        generado: !!doc
      };
    });
  }

  /* ══════════════ Valor ganado ══════════════ */

  function evm(proyectoId) {
    var ms = lista('mediciones', { proyectoId: proyectoId }).sort(function (a, b) {
      return String(a.fecha).localeCompare(String(b.fecha));
    });
    if (!ms.length) return { mediciones: [], ultima: null };

    var p = proyecto(proyectoId);
    var bac = p && p.presupuesto ? Number(p.presupuesto) : null;

    var calculadas = ms.map(function (m) {
      var pv = Number(m.pv) || 0, ev = Number(m.ev) || 0, ac = Number(m.ac) || 0;
      var cpi = ac ? ev / ac : null;
      var spi = pv ? ev / pv : null;
      return {
        id: m.id, fecha: m.fecha, pv: pv, ev: ev, ac: ac, nota: m.nota || '',
        cv: ev - ac, sv: ev - pv, cpi: cpi, spi: spi,
        eac: (cpi && bac) ? bac / cpi : null,
        etc: (cpi && bac) ? (bac - ev) / cpi : null,
        vac: (cpi && bac) ? bac - (bac / cpi) : null,
        tcpi: (bac && bac - ac) ? (bac - ev) / (bac - ac) : null
      };
    });

    return { mediciones: calculadas, ultima: calculadas[calculadas.length - 1], bac: bac };
  }

  function salud(proyectoId) {
    var e = evm(proyectoId);
    if (!e.ultima) return { estado: 'sin-datos', etiqueta: 'Sin mediciones' };
    var cpi = e.ultima.cpi, spi = e.ultima.spi;
    if (cpi === null || spi === null) return { estado: 'sin-datos', etiqueta: 'Datos incompletos' };
    if (cpi >= 0.95 && spi >= 0.95) return { estado: 'ok', etiqueta: 'Saludable', cpi: cpi, spi: spi };
    if (cpi >= 0.9 && spi >= 0.9) return { estado: 'aviso', etiqueta: 'Bajo vigilancia', cpi: cpi, spi: spi };
    return { estado: 'falla', etiqueta: 'Requiere acción', cpi: cpi, spi: spi };
  }

  /* ══════════════ Trabajo: sprints y tareas ══════════════ */

  function sprintActivo(proyectoId) {
    return lista('sprints', { proyectoId: proyectoId }).filter(function (s) {
      return s.estado === 'activo';
    })[0] || null;
  }

  function tareasDe(proyectoId, filtro) {
    var t = lista('tareas', { proyectoId: proyectoId });
    if (filtro && filtro.sprintId !== undefined) {
      t = t.filter(function (x) { return (x.sprintId || null) === filtro.sprintId; });
    }
    if (filtro && filtro.estado) {
      t = t.filter(function (x) { return x.estado === filtro.estado; });
    }
    return t.sort(function (a, b) { return (a.prioridad || 99) - (b.prioridad || 99); });
  }

  var ESTADOS_TAREA = [
    { id: 'backlog', nombre: 'Backlog' },
    { id: 'pendiente', nombre: 'Por hacer' },
    { id: 'curso', nombre: 'En curso' },
    { id: 'revision', nombre: 'En revisión' },
    { id: 'hecho', nombre: 'Hecho' }
  ];

  function cerrarSprint(sprintId) {
    var s = uno('sprints', sprintId);
    if (!s) return null;
    var tareas = tareasDe(s.proyectoId, { sprintId: sprintId });
    var entregado = tareas.filter(function (t) { return t.estado === 'hecho'; })
      .reduce(function (n, t) { return n + (Number(t.puntos) || 0); }, 0);
    actualizar('sprints', sprintId, { estado: 'cerrado', entregado: entregado, cierre: ahora() });

    // Lo no terminado vuelve al backlog
    tareas.filter(function (t) { return t.estado !== 'hecho'; })
      .forEach(function (t) { actualizar('tareas', t.id, { sprintId: null, estado: 'backlog' }); });

    return { entregado: entregado, devueltas: tareas.filter(function (t) { return t.estado !== 'hecho'; }).length };
  }

  /* Fotografía diaria de los puntos pendientes del sprint. Es lo que permite
     dibujar un burndown real en lugar de una línea recta inventada. */
  function hoyISO() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function registrarBurndown(sprintId) {
    var s = uno('sprints', sprintId);
    if (!s || s.estado !== 'activo') return null;
    var tareas = lista('tareas', { proyectoId: s.proyectoId }).filter(function (t) { return t.sprintId === sprintId; });
    var comprometido = tareas.reduce(function (n, t) { return n + (Number(t.puntos) || 0); }, 0);
    var restante = tareas.filter(function (t) { return t.estado !== 'hecho'; })
      .reduce(function (n, t) { return n + (Number(t.puntos) || 0); }, 0);
    var historial = s.historial || {};
    historial[hoyISO()] = { restante: restante, comprometido: comprometido };
    if (!s.inicio) s.inicio = hoyISO();
    actualizar('sprints', sprintId, { historial: historial, inicio: s.inicio });
    return historial;
  }

  function burndown(sprintId) {
    var s = uno('sprints', sprintId);
    if (!s) return null;
    var dias = Number(s.dias) || 14;
    var inicio = new Date((s.inicio || hoyISO()) + 'T12:00:00');
    var historial = s.historial || {};
    var claves = Object.keys(historial).sort();
    var comprometido = claves.length ? historial[claves[claves.length - 1]].comprometido : 0;

    var puntos = [], ideal = [], real = [];
    for (var i = 0; i <= dias; i++) {
      var d = new Date(inicio.getTime() + i * 86400000);
      var iso = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      puntos.push(iso);
      ideal.push(Math.round((comprometido * (1 - i / dias)) * 10) / 10);
      real.push(historial[iso] ? historial[iso].restante : null);
    }
    return { puntos: puntos, ideal: ideal, real: real, comprometido: comprometido };
  }

  function velocidad(proyectoId) {
    return lista('sprints', { proyectoId: proyectoId })
      .filter(function (s) { return s.estado === 'cerrado'; })
      .map(function (s) { return { nombre: s.nombre, entregado: Number(s.entregado) || 0 }; });
  }

  /* ══════════════ Dominios: riesgos, interesados, cambios ══════════════ */

  function matrizRiesgos(proyectoId) {
    var celdas = {};
    lista('riesgos', { proyectoId: proyectoId }).forEach(function (r) {
      var p = Number(r.p) || 1, i = Number(r.i) || 1;
      var k = p + 'x' + i;
      if (!celdas[k]) celdas[k] = [];
      celdas[k].push(r);
    });
    return celdas;
  }

  function severidad(p, i) {
    var v = (Number(p) || 0) * (Number(i) || 0);
    if (v >= 15) return { nivel: 'critico', etiqueta: 'Crítico', color: 'falla' };
    if (v >= 8) return { nivel: 'alto', etiqueta: 'Alto', color: 'aviso' };
    return { nivel: 'bajo', etiqueta: 'Bajo', color: 'ok' };
  }

  /* ══════════════ Calendario ══════════════ */

  function eventosDe(proyectoId) {
    var ev = [];
    var p = proyectoId ? proyecto(proyectoId) : null;

    function agrega(fecha, tipo, titulo, ref, extra) {
      if (!fecha) return;
      ev.push({ fecha: String(fecha).slice(0, 10), tipo: tipo, titulo: titulo, ref: ref, extra: extra || '' });
    }

    var proyectos = proyectoId ? [p].filter(Boolean) : proyectosVisibles();
    proyectos.forEach(function (pr) {
      agrega(pr.inicio, 'proyecto', 'Inicio · ' + pr.nombre, pr.id);
      agrega(pr.fin, 'proyecto', 'Fin previsto · ' + pr.nombre, pr.id);

      lista('tareas', { proyectoId: pr.id }).forEach(function (t) {
        if (t.fechaLimite) agrega(t.fechaLimite, 'tarea', t.titulo, pr.id, t.estado);
      });
      lista('sprints', { proyectoId: pr.id }).forEach(function (s) {
        if (s.inicio) agrega(s.inicio, 'sprint', 'Inicio ' + s.nombre, pr.id);
        if (s.fin) agrega(s.fin, 'sprint', 'Fin ' + s.nombre, pr.id);
      });
      lista('mediciones', { proyectoId: pr.id }).forEach(function (m) {
        agrega(m.fecha, 'evm', 'Corte de valor ganado · ' + pr.nombre, pr.id);
      });
      (pr.hitos || []).forEach(function (h) {
        agrega(h.fecha, 'hito', h.nombre, pr.id, h.critico ? 'critico' : '');
      });
    });

    return ev.sort(function (a, b) { return a.fecha.localeCompare(b.fecha); });
  }

  /* ══════════════ EOS ══════════════ */

  function rocasDe(trimestre) {
    return lista('rocas').filter(function (r) { return r.trimestre === trimestre; });
  }

  function vto(bloqueId) {
    return (cargar().vto || {})[bloqueId] || '';
  }

  function fijarVto(bloqueId, texto) {
    var b = cargar();
    if (!b.vto) b.vto = {};
    if (texto && texto.trim()) b.vto[bloqueId] = texto;
    else delete b.vto[bloqueId];
    return guardar();
  }

  function asientosHijos(padreId) {
    return lista('asientos').filter(function (a) { return (a.padreId || null) === (padreId || null); });
  }

  /* ══════════════ Exportar / importar ══════════════ */

  function exportarTodo() {
    var b = cargar();
    var copia = JSON.parse(JSON.stringify(b));
    copia.sesion = null;
    copia.usuarios = copia.usuarios.map(function (u) {
      var c = JSON.parse(JSON.stringify(u));
      delete c.clave;
      return c;
    });
    copia.formato = 'pmbok8-gestor';
    copia.exportado = new Date().toISOString();
    return copia;
  }

  function importarTodo(datos) {
    if (!datos || datos.formato !== 'pmbok8-gestor') {
      return { error: 'El archivo no es una exportación del gestor.' };
    }
    var actuales = cargar();
    var mapa = {};
    actuales.usuarios.forEach(function (u) { mapa[u.id] = u.clave; });

    COLECCIONES.forEach(function (c) { actuales[c] = datos[c] || []; });
    actuales.vto = datos.vto || {};
    // Las contraseñas no viajan en la exportación: se conservan las locales
    actuales.usuarios.forEach(function (u) {
      if (!u.clave) u.clave = mapa[u.id] || huella('cambiar123');
    });
    if (!actuales.usuarios.length) sembrar();
    guardar();
    return { ok: true };
  }

  return {
    /* persistencia */
    cargar: cargar, guardar: guardar, reiniciarTodo: reiniciarTodo, nuevoId: nuevoId,
    lista: lista, uno: uno, crear: crear, actualizar: actualizar, borrar: borrar,
    /* sesión */
    entrar: entrar, salir: salir, usuarioActual: usuarioActual, haySesion: haySesion,
    esAdmin: esAdmin, crearUsuario: crearUsuario, cambiarClave: cambiarClave, roles: ROLES,
    /* permisos */
    permisosDe: permisosDe, conceder: conceder, revocar: revocar,
    nivelEn: nivelEn, puede: puede, proyectosVisibles: proyectosVisibles,
    /* proyectos */
    crearProyecto: crearProyecto, proyecto: proyecto, borrarProyecto: borrarProyecto,
    metodologia: metodologia, progreso: progreso, siguienteProceso: siguienteProceso,
    estadoProceso: estadoProceso, fijarEstadoProceso: fijarEstadoProceso,
    bandaDe: bandaDe, moverProceso: moverProceso, procesosDeBanda: procesosDeBanda,
    esIterativo: esIterativo,
    /* documentos */
    artefacto: artefacto, documentosDe: documentosDe, documentoDe: documentoDe,
    generarDocumento: generarDocumento, guardarBloque: guardarBloque,
    cambiarEstadoDocumento: cambiarEstadoDocumento, nuevaVersion: nuevaVersion,
    completitudDocumento: completitudDocumento,
    disponibilidadEntradas: disponibilidadEntradas, salidasDe: salidasDe,
    /* control */
    evm: evm, salud: salud,
    /* trabajo */
    sprintActivo: sprintActivo, tareasDe: tareasDe, cerrarSprint: cerrarSprint,
    velocidad: velocidad, estadosTarea: ESTADOS_TAREA,
    registrarBurndown: registrarBurndown, burndown: burndown,
    /* dominios */
    matrizRiesgos: matrizRiesgos, severidad: severidad,
    /* calendario */
    eventosDe: eventosDe,
    /* eos */
    rocasDe: rocasDe, vto: vto, fijarVto: fijarVto, asientosHijos: asientosHijos,
    /* datos */
    exportarTodo: exportarTodo, importarTodo: importarTodo
  };
})();
