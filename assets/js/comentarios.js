/* ═══════════════════════════════════════════════════════════
   comentarios.js — Conversación del equipo
   ───────────────────────────────────────────────────────────
   Hilos de comentarios sobre el proyecto, una tarea, un documento
   o un proceso. El hilo se pinta con hilo() y se conecta con
   conectar(); el de una tarea se abre en un diálogo.
   Publicar: botón o Ctrl + Enter. Borrar ofrece «Deshacer».
   ═══════════════════════════════════════════════════════════ */

window.Comentarios = (function () {
  'use strict';

  var R = window.Render;

  function nombreAutor(c) {
    var u = c.autorId ? Gestor.uno('usuarios', c.autorId) : null;
    return u ? u.nombre : 'Cuenta eliminada';
  }

  /* El texto se escapa y conserva sus saltos de línea */
  function parrafos(texto) {
    return R.escapar(texto).replace(/\n/g, '<br>');
  }

  function item(c) {
    var editado = c.actualizado && c.creado && c.actualizado - c.creado > 1000;
    var puede = Gestor.puedeModificarComentario(c);
    var yo = Gestor.usuarioActual();
    return '<li class="c-item' + (yo && c.autorId === yo.id ? ' propio' : '') + '" data-comentario="' + R.escapar(c.id) + '">' +
      UI.avatar(nombreAutor(c)) +
      '<div class="c-cuerpo">' +
        '<div class="c-cab"><b>' + R.escapar(nombreAutor(c)) + '</b>' +
          '<time>' + UI.fecha(c.creado, true) + '</time>' +
          (editado ? '<span class="c-editado">editado</span>' : '') + '</div>' +
        '<p class="c-texto">' + parrafos(c.texto) + '</p>' +
        (puede
          ? '<div class="c-acciones">' +
            '<button class="pa-mini" data-c="editar" data-id="' + R.escapar(c.id) + '">Editar</button>' +
            '<button class="pa-mini" data-c="borrar" data-id="' + R.escapar(c.id) + '">Borrar</button></div>'
          : '') +
      '</div></li>';
  }

  /* opc: { titulo, vacio, nivel ('h2' | 'h3') } */
  function hilo(proyectoId, refTipo, refId, opc) {
    opc = opc || {};
    var lista = Gestor.comentariosDe(proyectoId, refTipo, refId);
    var etiqueta = opc.nivel || 'h2';
    var puede = Gestor.puedeComentar(proyectoId, refTipo, refId);
    return '<section class="c-hilo" data-hilo data-proyecto="' + R.escapar(proyectoId) + '" ' +
      'data-ref-tipo="' + R.escapar(refTipo || 'proyecto') + '" data-ref-id="' + R.escapar(refId || '') + '">' +
      (opc.titulo === false ? ''
        : '<' + etiqueta + ' class="c-titulo">' + Iconos.svg('conversacion') + ' ' +
          R.escapar(opc.titulo || 'Conversación') + ' <span class="pa-conteo">' + lista.length + '</span></' + etiqueta + '>') +
      (lista.length
        ? '<ol class="c-lista">' + lista.map(item).join('') + '</ol>'
        : '<p class="c-vacio">' + R.escapar(opc.vacio || 'Nadie ha comentado todavía.') + '</p>') +
      (puede
        ? '<div class="c-nuevo">' +
          '<textarea class="pa-entrada c-entrada" rows="2" maxlength="10000" ' +
          'aria-label="Nuevo comentario" placeholder="Escribe un comentario… (Ctrl + Enter publica)"></textarea>' +
          '<div class="tarjeta-pie"><button class="btn primario" data-c="publicar">Comentar</button></div></div>'
        : '') +
      '</section>';
  }

  /* Conecta los hilos que haya dentro de raiz. alCambiar() repinta. */
  function conectar(raiz, alCambiar) {
    var hilos = (raiz || document).querySelectorAll('[data-hilo]');
    for (var i = 0; i < hilos.length; i++) conectarHilo(hilos[i], alCambiar || function () {});
  }

  function conectarHilo(caja, alCambiar) {
    var pid = caja.getAttribute('data-proyecto');
    var tipo = caja.getAttribute('data-ref-tipo');
    var ref = caja.getAttribute('data-ref-id') || null;
    var entrada = caja.querySelector('.c-entrada');

    function publicar() {
      if (!entrada) return;
      var r = Gestor.comentar(pid, entrada.value, tipo, ref);
      if (r.error) { Dialogo.avisar(r.error, 'aviso'); entrada.focus(); return; }
      entrada.value = '';
      alCambiar(true);
      /* El repintado sustituye el hilo: el foco vuelve a su campo
         (no al de un diálogo que se está cerrando) */
      var campos = document.querySelectorAll('[data-hilo][data-ref-tipo="' + tipo + '"][data-ref-id="' + (ref || '') + '"] .c-entrada');
      for (var i = 0; i < campos.length; i++) {
        if (campos[i] !== entrada && !campos[i].closest('.d-capa[aria-hidden]')) { campos[i].focus(); break; }
      }
    }

    if (entrada) {
      entrada.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); publicar(); }
      });
    }

    var botones = caja.querySelectorAll('[data-c]');
    for (var i = 0; i < botones.length; i++) {
      botones[i].addEventListener('click', function (e) {
        e.preventDefault();
        var accion = this.getAttribute('data-c');
        var id = this.getAttribute('data-id');
        if (accion === 'publicar') publicar();
        if (accion === 'editar') editar(id, alCambiar);
        if (accion === 'borrar') borrar(id, alCambiar);
      });
    }
  }

  function editar(id, alCambiar) {
    var c = Gestor.uno('comentarios', id);
    if (!c) return;
    Dialogo.pedir({
      titulo: 'Editar comentario',
      campos: [{ id: 'texto', etiqueta: 'Comentario', tipo: 'area', filas: 4, valor: c.texto }],
      confirmar: 'Guardar'
    }, function (v) {
      var r = Gestor.editarComentario(id, v.texto);
      if (r.error) Dialogo.avisar(r.error, 'aviso');
      alCambiar(false);
    });
  }

  function borrar(id, alCambiar) {
    var c = Gestor.uno('comentarios', id);
    if (!c) return;
    var copia = JSON.parse(JSON.stringify(c));
    Gestor.borrar('comentarios', id);
    alCambiar(false);
    Dialogo.avisar('Comentario eliminado', 'ok', {
      etiqueta: 'Deshacer',
      hacer: function () { Gestor.crear('comentarios', copia); alCambiar(false); }
    });
  }

  /* ══════════════ Hilo de una tarea, en un diálogo ══════════════ */

  function abrirTarea(proyectoId, tareaId, alCerrar) {
    var t = Gestor.uno('tareas', tareaId);
    if (!t) return;
    var responsable = t.responsableId ? Gestor.uno('usuarios', t.responsableId) : null;
    var estado = (Gestor.estadosTarea.filter(function (e) { return e.id === t.estado; })[0] || {}).nombre || t.estado;

    function pintar(enfocar) {
      Dialogo.mostrar({
        eyebrow: 'Tarea · ' + estado,
        titulo: t.titulo,
        texto: R.escapar((responsable ? 'Responsable: ' + responsable.nombre : 'Sin responsable') +
          (t.fechaLimite ? ' · límite ' + UI.fecha(t.fechaLimite) : '')) +
          (t.criterios ? '<br><span class="c-criterios">' + R.escapar(t.criterios) + '</span>' : ''),
        html: hilo(proyectoId, 'tarea', tareaId, { titulo: 'Comentarios de la tarea', nivel: 'h3',
          vacio: 'Sin comentarios. Anota aquí dudas, bloqueos o avances.' }),
        ancho: true,
        alCerrar: alCerrar
      }, function (capa) {
        conectar(capa, function (volverAEnfocar) {
          /* Tras publicar se repinta el diálogo; tras editar o borrar, también */
          pintar(volverAEnfocar);
        });
        if (enfocar) {
          var e = capa.querySelector('.c-entrada');
          if (e) e.focus();
        }
      });
    }
    pintar(true);
  }

  /* ══════════════ Actividad reciente del proyecto ══════════════ */

  function contexto(c, proyectoId) {
    var base = '#/proyectos/' + proyectoId;
    if (c.refTipo === 'tarea') {
      var t = Gestor.uno('tareas', c.refId);
      return t
        ? { texto: 'en la tarea «' + t.titulo + '»', ruta: base + '/trabajo', tarea: t.id }
        : { texto: 'en una tarea eliminada' };
    }
    if (c.refTipo === 'documento') {
      var d = Gestor.uno('documentos', c.refId);
      return d ? { texto: 'en el documento «' + d.nombre + '»', ruta: base + '/documento/' + d.id }
               : { texto: 'en un documento eliminado' };
    }
    if (c.refTipo === 'proceso') {
      var p = window.Indice ? Indice.proceso(c.refId) : null;
      return { texto: 'en el proceso ' + (p ? p.cod + ' ' + p.nombre : c.refId), ruta: base + '/proceso/' + c.refId };
    }
    return { texto: 'en la conversación general' };
  }

  function actividad(proyectoId, limite) {
    var todos = Gestor.comentariosDe(proyectoId).filter(function (c) {
      return c.refTipo && c.refTipo !== 'proyecto';
    }).slice().reverse().slice(0, limite || 15);
    if (!todos.length) return '<p class="c-vacio">Todavía no hay comentarios en tareas, documentos ni procesos.</p>';
    return '<ol class="c-lista c-actividad">' + todos.map(function (c) {
      var ctx = contexto(c, proyectoId);
      var enlace = ctx.tarea
        ? '<button class="pa-mini" data-o="hilo-tarea" data-id="' + R.escapar(ctx.tarea) + '">Abrir</button>'
        : ctx.ruta ? '<a class="pa-mini" href="' + ctx.ruta + '">Abrir</a>' : '';
      return '<li class="c-item">' + UI.avatar(nombreAutor(c)) +
        '<div class="c-cuerpo"><div class="c-cab"><b>' + R.escapar(nombreAutor(c)) + '</b>' +
        '<span class="c-donde">' + R.escapar(ctx.texto) + '</span>' +
        '<time>' + UI.fecha(c.creado, true) + '</time></div>' +
        '<p class="c-texto">' + parrafos(c.texto.length > 280 ? c.texto.slice(0, 280) + '…' : c.texto) + '</p>' +
        '<div class="c-acciones">' + enlace + '</div></div></li>';
    }).join('') + '</ol>';
  }

  function cuantos(proyectoId, refTipo, refId) {
    return Gestor.comentariosDe(proyectoId, refTipo, refId).length;
  }

  return { hilo: hilo, conectar: conectar, abrirTarea: abrirTarea, actividad: actividad, cuantos: cuantos };
})();
