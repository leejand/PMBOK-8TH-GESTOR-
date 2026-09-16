/* ═══════════════════════════════════════════════════════════
   vistas-gestor.js — Pantallas de la capa de gestión
   Acceso, panel, portafolios, agenda, EOS y administración.
   ═══════════════════════════════════════════════════════════ */

window.VistasGestor = (function () {
  'use strict';

  var R = window.Render;
  var recargar = function () {};

  /* ══════════════ ACCESO ══════════════ */

  function entrar() {
    var servidor = Gestor.enServidor();
    var cuentaInicial = Gestor.mostrarCuentaInicial();

    function rasgo(icono, titulo, texto) {
      return '<li>' + Iconos.svg(icono) + '<span><b>' + titulo + '</b>' + texto + '</span></li>';
    }

    /* Muestra hecha con las mismas piezas del panel, no una captura */
    var muestra =
      '<div class="g-acceso-muestra" aria-hidden="true">' +
        '<div class="g-proyecto">' +
          '<div class="g-proyecto-cab"><div>' +
            '<div class="g-proyecto-nombre">Sistema de nómina para 14 sedes</div>' +
            '<div class="g-proyecto-meta"><span class="g-metodo">' + Iconos.svg('predictivo') + ' Predictivo</span>' +
            '<span>' + Iconos.svg('carpeta') + ' Transformación digital</span></div>' +
          '</div>' + UI.anillo(62) + '</div>' +
          '<div class="g-siguiente"><span>Siguiente</span><b><i>2.3.2</i> Desarrollar el Cronograma</b></div>' +
        '</div>' +
        '<div class="g-proyecto"><div class="g-proyecto-cab"><div>' +
          '<div class="g-proyecto-nombre">App de reservas para clínicas</div>' +
          '<div class="g-proyecto-meta"><span class="g-metodo">' + Iconos.svg('agil') + ' Ágil</span></div>' +
        '</div>' + UI.anillo(28) + '</div></div>' +
      '</div>';

    return '<div class="g-acceso">' +
      '<section class="g-acceso-escena">' +
        '<div class="g-acceso-marca"><span class="marca-glifo" aria-hidden="true">◆</span>' +
          '<span>Gestor PMBOK<sup>®</sup> 8</span></div>' +
        '<h1>Dirige proyectos con el <em>PMBOK 8</em></h1>' +
        '<p class="g-acceso-lema">Los 40 procesos guiados, del acta de constitución al informe final, mientras aprendes la guía.</p>' +
        '<ul class="g-acceso-rasgos">' +
          rasgo('flujo', '40 procesos guiados', 'Entradas, herramientas y salidas en cada paso') +
          rasgo('documentos', '42 documentos', 'Se generan en secuencia, del acta al cierre') +
          rasgo('dividir', 'Cuatro metodologías', 'Cascada, ágil, híbrido o kanban adaptan el flujo') +
          rasgo('equipo', 'Equipos y permisos', 'Por portafolio, programa o proyecto') +
        '</ul>' +
        muestra +
      '</section>' +

      '<section class="g-acceso-formulario">' +
        '<div class="g-acceso-tarjeta">' +
          '<h2>Iniciar sesión</h2>' +
          '<p class="g-acceso-bajada">Entra a tu espacio de gestión de proyectos.</p>' +
          '<div id="g-error-acceso"></div>' +
          UI.texto('acc-correo', 'Correo electrónico', '', { tipo: 'email', placeholder: 'tu@organizacion.com' }) +
          UI.texto('acc-clave', 'Contraseña', '', { tipo: 'password', placeholder: '••••••••' }) +
          '<button class="btn primario g-ancho" data-g="entrar">Entrar ' + Iconos.svg('flecha-der', 'ic-flecha') + '</button>' +
          (cuentaInicial
            ? '<div class="nota"><div class="nota-titulo">Cuenta inicial</div>' +
              '<code>admin@pmbok.local</code> · <code>admin123</code><br>' +
              '<span style="font-size:12.5px;color:var(--tinta-2)">' +
              (servidor
                ? 'Al entrar se te pedirá elegir una contraseña propia.'
                : 'Todo se guarda en este navegador. El control de acceso ' +
                  'separa espacios de trabajo entre compañeros; no protege secretos.') + '</span>' +
              '<div class="tarjeta-pie"><button class="btn" data-g="acceso-demo">' + Iconos.svg('rayo') + ' Rellenar y entrar</button></div></div>'
            : '') +
          '<p class="g-modo-datos">' + (servidor
            ? Iconos.svg('check-circulo') + ' Conectado al servidor: los datos se guardan en PostgreSQL.'
            : 'Modo local: los datos se guardan en este navegador.') + '</p>' +
        '</div>' +
      '</section>' +
      '</div>';
  }

  /* Contraseña que otra persona conoce (la inicial, la que puso un
     administrador o la provisional de una importación) */
  function cambiarClave() {
    var u = Gestor.usuarioActual() || {};
    return '<div class="g-acceso g-acceso-solo">' +
      '<section class="g-acceso-formulario">' +
        '<div class="g-acceso-tarjeta">' +
          '<div class="g-acceso-marca"><span class="marca-glifo" aria-hidden="true">◆</span>' +
            '<span>Gestor PMBOK<sup>®</sup> 8</span></div>' +
          '<h2>Elige tu contraseña</h2>' +
          '<p class="g-acceso-bajada">Hola, ' + R.escapar(u.nombre || '') + '. La contraseña con la que entraste ' +
            'la conoce otra persona, así que debes cambiarla antes de continuar.</p>' +
          '<div id="g-error-clave"></div>' +
          UI.texto('cc-actual', 'Contraseña actual', '', { tipo: 'password', placeholder: '••••••••' }) +
          UI.texto('cc-nueva', 'Nueva contraseña', '', { tipo: 'password', placeholder: 'mínimo 6 caracteres' }) +
          UI.texto('cc-repetir', 'Repite la nueva contraseña', '', { tipo: 'password', placeholder: '••••••••' }) +
          '<button class="btn primario g-ancho" data-g="cambiar-clave">Guardar y continuar ' +
            Iconos.svg('flecha-der', 'ic-flecha') + '</button>' +
          '<div class="tarjeta-pie"><button class="btn" data-g="salir">Salir</button></div>' +
        '</div>' +
      '</section>' +
      '</div>';
  }

  /* ══════════════ PANEL ══════════════ */

  function panel(abrirNuevo) {
    var u = Gestor.usuarioActual();
    var proyectos = Gestor.proyectosVisibles();
    var docs = 0, procesosOk = 0;
    proyectos.forEach(function (p) {
      docs += Gestor.documentosDe(p.id).length;
      procesosOk += Gestor.progreso(p.id).completados;
    });
    var activos = proyectos.filter(function (p) { return p.estado === 'activo'; }).length;

    var creaProyectos = Gestor.puedeGestionar();
    var tarjetas = proyectos.length
      ? '<div class="g-proyectos">' + proyectos.map(tarjetaProyecto).join('') + '</div>'
      : '';

    return '<div class="hoja-ancha prosa g-panel">' +
      '<div class="g-cabecera">' +
        '<div><div class="eyebrow">Panel de control</div>' +
        '<h1 class="titulo-pagina" style="margin:0">Hola, ' + R.escapar((u.nombre || '').split(' ')[0]) + '</h1></div>' +
        (creaProyectos
          ? '<button class="btn primario" data-g="abrir-nuevo-proyecto">' + Iconos.svg('mas') + ' Nuevo proyecto</button>'
          : '') +
      '</div>' +
      '<p class="bajada">Ruta sugerida: empieza por <b>Iniciar el proyecto o fase</b> y genera el acta de constitución. ' +
      'Desde ahí, cada proceso te dirá qué necesita y qué documento produce.</p>' +

      '<div class="cifras" style="margin:0 0 30px">' +
        UI.cifra(activos, 'Proyectos activos', null, 'activos') +
        UI.cifra(procesosOk, 'Procesos completados', null, 'check-circulo') +
        UI.cifra(docs, 'Documentos generados', null, 'documentos') +
        UI.cifra(Gestor.lista('portafolios').length, 'Portafolios', null, 'portafolios') +
      '</div>' +

      (creaProyectos
        ? '<div id="g-nuevo-proyecto"' + (abrirNuevo || !proyectos.length ? '' : ' hidden') + '>' +
          formularioProyecto() + '</div>'
        : (proyectos.length ? '' : UI.vacio('📁', 'Todavía no participas en ningún proyecto',
            'Crear proyectos es tarea de un director o un administrador. Pídeles que te añadan al equipo o te den acceso.'))) +

      (proyectos.length ? '<h2>Tus proyectos <span class="pa-conteo">' + proyectos.length + '</span></h2>' + tarjetas : '') +
      '</div>';
  }

  function tarjetaProyecto(p) {
    var met = Gestor.metodologia(p.metodologia);
    var pr = Gestor.progreso(p.id);
    var s = Gestor.salud(p.id);
    var port = p.portafolioId ? Gestor.uno('portafolios', p.portafolioId) : null;
    var director = p.directorId ? Gestor.uno('usuarios', p.directorId) : null;

    return '<a class="g-proyecto" href="#/proyectos/' + p.id + '">' +
      '<div class="g-proyecto-cab">' +
        '<div>' +
          '<div class="g-proyecto-nombre">' + R.escapar(p.nombre) + '</div>' +
          '<div class="g-proyecto-meta">' +
            '<span class="g-metodo">' + (Iconos.resolver(met.icono) || Iconos.resolver(met.id)) + ' ' + R.escapar(met.nombre) + '</span>' +
            '<span>' + (port ? Iconos.svg('carpeta') + ' ' + R.escapar(port.nombre) : Iconos.svg('carpeta-vacia') + ' Sin portafolio') + '</span>' +
            (p.estado !== 'activo' ? UI.pastilla(p.estado, p.estado === 'cerrado' ? 'ok' : 'aviso') : '') +
          '</div>' +
        '</div>' +
        /* El avance del flujo no es un veredicto de salud: se pinta con el acento */
        UI.anillo(pr.porcentaje) +
      '</div>' +
      (p.descripcion ? '<div class="g-proyecto-desc">' + R.escapar(p.descripcion.slice(0, 130)) + '</div>' : '') +
      siguientePaso(p) +
      bandasProyecto(p) +
      '<div class="g-proyecto-pie">' +
        '<span>' + Iconos.svg('flujo') + pr.completados + '/' + pr.aplicables + ' procesos</span>' +
        '<span>' + Iconos.svg('documento') + Gestor.documentosDe(p.id).length + '</span>' +
        (s.estado !== 'sin-datos' ? UI.pastilla(s.etiqueta, s.estado) : '') +
        '<span class="g-proyecto-director">' + UI.avatar(director ? director.nombre : '?') +
          R.escapar(director ? director.nombre : 'sin director') + '</span>' +
      '</div>' +
      '</a>';
  }

  /* El recorrido del proyecto por las cinco bandas, de un vistazo */
  function bandasProyecto(p) {
    var resumen = [];
    var segmentos = PMBOK.bandas.map(function (b) {
      var procesos = Gestor.procesosDeBanda(p.id, b.id);
      var hechos = procesos.filter(function (f) {
        var e = Gestor.estadoProceso(p.id, f.id).estado;
        return e === 'completado' || e === 'omitido';
      }).length;
      var fr = procesos.length ? hechos / procesos.length : 0;
      resumen.push(b.nombre + ' ' + hechos + ' de ' + procesos.length);
      return '<i style="--p:' + fr.toFixed(3) + '"' + (fr >= 1 ? ' class="llena"' : '') + '></i>';
    }).join('');
    return '<div class="g-proyecto-bandas" role="img" aria-label="' + R.escapar(resumen.join(', ')) + '" ' +
      'title="' + R.escapar(resumen.join(' · ')) + '">' + segmentos + '</div>';
  }

  function siguientePaso(p) {
    var sig = Gestor.siguienteProceso(p.id);
    if (!sig) return '<div class="g-siguiente hecho"><span>Todos los procesos cerrados</span></div>';
    var proc = Indice.proceso(sig.id);
    var enCurso = Gestor.estadoProceso(p.id, sig.id).estado === 'iniciado';
    return '<div class="g-siguiente"><span>' + (enCurso ? 'En curso' : 'Siguiente') + '</span>' +
      '<b><i>' + proc.cod + '</i> ' + R.escapar(proc.nombre) + '</b></div>';
  }

  function formularioProyecto() {
    var portafolios = [{ id: '', nombre: 'Sin portafolio' }].concat(
      Gestor.lista('portafolios').map(function (p) { return { id: p.id, nombre: p.nombre }; }));
    var rocas = [{ id: '', nombre: 'Sin roca asociada' }].concat(
      Gestor.lista('rocas').map(function (r) { return { id: r.id, nombre: r.trimestre + ' · ' + r.titulo }; }));

    return '<div class="pa-panel">' +
      '<div class="pa-panel-cab"><h2 style="margin:0">Nuevo proyecto</h2>' +
        '<button class="btn" data-g="cerrar-nuevo-proyecto">Cancelar</button></div>' +
      '<p style="color:var(--tinta-2);font-size:13.4px;margin:0 0 16px">' +
      'Se desplegará el mapa de los 40 procesos en el orden sugerido para la metodología que elijas.</p>' +
      '<div id="g-error-proyecto"></div>' +
      UI.texto('np-nombre', 'Nombre del proyecto', '', { placeholder: 'Ej.: Sistema de nómina para 14 sedes', requerido: true }) +
      UI.area('np-descripcion', 'Descripción', '', { filas: 2, placeholder: '¿Qué entregará el proyecto?' }) +
      '<div class="g-campo"><label class="g-etiqueta">Metodología<span>Determina el orden del flujo y la adaptación de los procesos</span></label>' +
      UI.opciones('metodologia', PMBOK.metodologias.map(function (m) {
        return { id: m.id, nombre: m.nombre, icono: m.icono, lema: m.lema };
      }), 'predictivo') + '</div>' +
      UI.fila([
        UI.selector('np-portafolio', 'Portafolio', portafolios, ''),
        UI.selector('np-roca', 'Roca de gerencia (EOS)', rocas, '')
      ]) +
      UI.fila([
        UI.texto('np-inicio', 'Fecha de inicio', UI.hoyISO(), { tipo: 'date' }),
        UI.texto('np-fin', 'Fin previsto', '', { tipo: 'date' }),
        UI.texto('np-presupuesto', 'Presupuesto (BAC)', '', { tipo: 'number', placeholder: '45000', min: 0 })
      ]) +
      '<div class="tarjeta-pie"><button class="btn primario" data-g="crear-proyecto">Crear proyecto ' + Iconos.svg('flecha-der', 'ic-flecha') + '</button></div>' +
      '</div>';
  }

  /* ══════════════ PORTAFOLIOS ══════════════ */

  function portafolios() {
    var lista = Gestor.lista('portafolios');
    var proyectos = Gestor.proyectosVisibles();
    var sinPortafolio = proyectos.filter(function (p) { return !p.portafolioId; });
    var gestiona = Gestor.puedeGestionar();

    function grupo(nombre, icono, id, proys, descripcion) {
      var programas = id ? Gestor.lista('programas', { portafolioId: id }) : [];
      return '<div class="g-portafolio">' +
        '<div class="g-portafolio-cab">' +
          '<h3>' + (Iconos.resolver(icono) || icono) + ' ' + R.escapar(nombre) + '</h3>' +
          '<span class="g-portafolio-conteo">' + proys.length + ' proyecto' + (proys.length === 1 ? '' : 's') + '</span>' +
          (id && gestiona ? '<button class="g-mini-x" data-g="borrar-portafolio" data-id="' + id + '" title="Eliminar portafolio">×</button>' : '') +
        '</div>' +
        (descripcion ? '<p class="g-portafolio-desc">' + R.escapar(descripcion) + '</p>' : '') +
        (programas.length
          ? '<div class="g-programas">' + programas.map(function (pg) {
              var suyos = proys.filter(function (x) { return x.programaId === pg.id; });
              return '<div class="g-programa"><b>▸ ' + R.escapar(pg.nombre) + '</b> ' +
                '<span>' + suyos.length + ' proyecto' + (suyos.length === 1 ? '' : 's') + '</span></div>';
            }).join('') + '</div>'
          : '') +
        (proys.length
          ? '<div class="g-portafolio-proyectos">' + proys.map(function (p) {
              var met = Gestor.metodologia(p.metodologia);
              var pr = Gestor.progreso(p.id);
              return '<div class="g-fila-proyecto">' +
                '<a href="#/proyectos/' + p.id + '">' + (Iconos.resolver(met.icono) || Iconos.resolver(met.id)) + ' ' + R.escapar(p.nombre) + '</a>' +
                '<span class="g-fila-progreso">' + UI.barra(pr.porcentaje) + '</span>' +
                '<span class="g-fila-pct">' + pr.porcentaje + ' %</span>' +
                selectorDestino(p) +
                '</div>';
            }).join('') + '</div>'
          : '<p class="g-portafolio-vacio">Sin proyectos asignados.</p>') +
        (id && gestiona ? '<div class="tarjeta-pie"><button class="btn" data-g="nuevo-programa" data-id="' + id + '">+ Programa</button></div>' : '') +
        '</div>';
    }

    /* Mover de portafolio es configuración del proyecto: la decide quien lo dirige */
    function selectorDestino(p) {
      if (!Gestor.puede(p.id, 'dirigir')) return '';
      var opciones = [{ id: '', nombre: 'Sin portafolio' }].concat(
        lista.map(function (x) { return { id: x.id, nombre: x.nombre }; }));
      return '<select class="g-mover" data-mover="' + p.id + '">' + opciones.map(function (o) {
        return '<option value="' + o.id + '"' + ((p.portafolioId || '') === o.id ? ' selected' : '') + '>' +
          R.escapar(o.nombre) + '</option>';
      }).join('') + '</select>';
    }

    return '<div class="hoja-ancha prosa">' +
      '<div class="eyebrow">Organización</div>' +
      '<div class="g-cabecera">' +
        '<h1 class="titulo-pagina" style="margin:0">Portafolios y programas</h1>' +
        (gestiona ? '<button class="btn primario" data-g="abrir-nuevo-portafolio">' + Iconos.svg('mas') + ' Nuevo portafolio</button>' : '') +
      '</div>' +
      '<p class="bajada">Un portafolio agrupa programas y proyectos que compiten por los mismos recursos. ' +
      'Cambia el portafolio de un proyecto desde el selector de su fila.</p>' +

      '<div id="g-nuevo-portafolio" hidden>' +
        '<div class="pa-panel">' +
          UI.texto('npf-nombre', 'Nombre del portafolio', '', { placeholder: 'Ej.: Transformación digital 2026' }) +
          UI.area('npf-descripcion', 'Descripción', '', { filas: 2 }) +
          '<div class="tarjeta-pie"><button class="btn primario" data-g="crear-portafolio">Crear</button>' +
          '<button class="btn" data-g="cerrar-nuevo-portafolio">Cancelar</button></div>' +
        '</div>' +
      '</div>' +

      '<div class="g-portafolios">' +
        lista.map(function (pf) {
          return grupo(pf.nombre, '🗂️', pf.id,
            proyectos.filter(function (p) { return p.portafolioId === pf.id; }), pf.descripcion);
        }).join('') +
        grupo('Sin portafolio', '📁', null, sinPortafolio,
          'Proyectos que todavía no se han asignado a una cartera.') +
      '</div>' +
      '</div>';
  }

  /* ══════════════ AGENDA (calendario global) ══════════════ */

  function agenda(arg) {
    var hoy = new Date();
    var partes = String(arg || '').split('-');
    var anio = parseInt(partes[0], 10) || hoy.getFullYear();
    var mes = (parseInt(partes[1], 10) || (hoy.getMonth() + 1)) - 1;

    var eventos = Gestor.eventosDe(null);
    return '<div class="hoja-ancha prosa">' +
      '<div class="eyebrow">Agenda</div>' +
      '<h1 class="titulo-pagina">Calendario global</h1>' +
      '<p class="bajada">Fechas de todos los proyectos visibles: inicios y fines, límites de tareas, ' +
      'sprints, hitos y cortes de valor ganado.</p>' +
      calendario(anio, mes, eventos, '#/agenda/') +
      listaEventos(eventos, anio, mes) +
      '</div>';
  }

  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
               'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  function calendario(anio, mes, eventos, rutaBase) {
    var primero = new Date(anio, mes, 1);
    var diaSemana = (primero.getDay() + 6) % 7;   // lunes = 0
    var dias = new Date(anio, mes + 1, 0).getDate();
    var hoyISO = UI.hoyISO();

    var porDia = {};
    eventos.forEach(function (e) {
      if (!porDia[e.fecha]) porDia[e.fecha] = [];
      porDia[e.fecha].push(e);
    });

    var celdas = '';
    for (var i = 0; i < diaSemana; i++) celdas += '<div class="g-dia vacio"></div>';
    for (var d = 1; d <= dias; d++) {
      var iso = anio + '-' + String(mes + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      var evs = porDia[iso] || [];
      celdas += '<div class="g-dia' + (iso === hoyISO ? ' hoy' : '') + (evs.length ? ' con-eventos' : '') + '">' +
        '<div class="g-dia-num">' + d + '</div>' +
        evs.slice(0, 3).map(function (e) {
          return '<a class="g-evento ' + e.tipo + (e.extra === 'critico' ? ' critico' : '') + '" ' +
            'href="#/proyectos/' + e.ref + '" title="' + R.escapar(e.titulo) + '">' +
            R.escapar(e.titulo.slice(0, 28)) + '</a>';
        }).join('') +
        (evs.length > 3 ? '<div class="g-mas">+' + (evs.length - 3) + '</div>' : '') +
        '</div>';
    }
    /* La última semana se completa para que la rejilla no quede abierta */
    var sobrantes = (7 - (diaSemana + dias) % 7) % 7;
    for (var k = 0; k < sobrantes; k++) celdas += '<div class="g-dia vacio"></div>';

    var prevMes = mes === 0 ? 11 : mes - 1, prevAnio = mes === 0 ? anio - 1 : anio;
    var sigMes = mes === 11 ? 0 : mes + 1, sigAnio = mes === 11 ? anio + 1 : anio;

    return '<div class="g-calendario">' +
      '<div class="g-cal-cab">' +
        '<a class="btn" href="' + rutaBase + prevAnio + '-' + (prevMes + 1) + '">←</a>' +
        '<h3>' + MESES[mes].charAt(0).toUpperCase() + MESES[mes].slice(1) + ' ' + anio + '</h3>' +
        '<a class="btn" href="' + rutaBase + sigAnio + '-' + (sigMes + 1) + '">→</a>' +
        '<a class="btn" href="' + rutaBase + '">Hoy</a>' +
      '</div>' +
      '<div class="g-cal-dias">' + ['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(function (x) {
        return '<div>' + x + '</div>'; }).join('') + '</div>' +
      '<div class="g-cal-rejilla">' + celdas + '</div>' +
      '<div class="g-leyenda">' +
        '<span class="g-evento proyecto">Proyecto</span>' +
        '<span class="g-evento hito">Hito</span>' +
        '<span class="g-evento tarea">Tarea</span>' +
        '<span class="g-evento sprint">Sprint</span>' +
        '<span class="g-evento evm">Corte EVM</span>' +
      '</div></div>';
  }

  function listaEventos(eventos, anio, mes) {
    var pref = anio + '-' + String(mes + 1).padStart(2, '0');
    var delMes = eventos.filter(function (e) { return e.fecha.indexOf(pref) === 0; });
    if (!delMes.length) return '<p style="color:var(--tinta-3);font-size:13.4px">Sin eventos este mes.</p>';
    return '<h2>Eventos del mes</h2>' + R.tabla(['Fecha', 'Tipo', 'Evento', 'Proyecto'],
      delMes.map(function (e) {
        var p = Gestor.uno('proyectos', e.ref);
        return [UI.fecha(e.fecha), e.tipo, e.titulo, p ? p.nombre : '—'];
      }));
  }

  /* ══════════════ EOS ══════════════ */

  function eos(seccion) {
    seccion = seccion || 'rocas';
    var pestanas = PMBOK.eos.secciones.map(function (s) {
      return '<a class="g-pestana' + (s.id === seccion ? ' activa' : '') + '" href="#/eos/' + s.id + '">' +
        '<span class="g-pestana-icono">' + (Iconos.resolver(s.id) || s.icono) + '</span>' +
        '<span><b>' + R.escapar(s.nombre) + '</b><em>' + R.escapar(s.lema) + '</em></span></a>';
    }).join('');

    var gestiona = Gestor.puedeGestionar();
    var cuerpo =
      seccion === 'scorecard' ? eosScorecard(gestiona) :
      seccion === 'vto' ? eosVto(gestiona) :
      seccion === 'organigrama' ? eosOrganigrama(gestiona) : eosRocas(gestiona);

    return '<div class="hoja-ancha prosa' + (gestiona ? '' : ' g-solo-lectura') + '">' +
      '<div class="eyebrow">Sistema operativo empresarial</div>' +
      '<h1 class="titulo-pagina">Gerencia general (EOS)</h1>' +
      '<p class="bajada">' + PMBOK.eos.intro + '</p>' +
      (gestiona ? '' : '<div class="nota"><div class="nota-titulo">Solo lectura</div>' +
        'La gerencia la editan directores y administradores.</div>') +
      '<div class="g-pestanas-eos">' + pestanas + '</div>' +
      cuerpo +
      '</div>';
  }

  function trimestreActual() {
    var d = new Date();
    return 'Q' + (Math.floor(d.getMonth() / 3) + 1) + '-' + d.getFullYear();
  }

  function eosRocas(gestiona) {
    var trimestre = VistasGestor.trimestreElegido || trimestreActual();
    var rocas = Gestor.rocasDe(trimestre);

    var selector = '<div class="g-trimestres">' + PMBOK.trimestres.map(function (t) {
      return '<button class="g-trimestre' + (t === trimestre ? ' activo' : '') + '" data-g="trimestre" data-valor="' + t + '">' +
        t + '</button>';
    }).join('') + (gestiona ? '<button class="btn primario" data-g="abrir-nueva-roca" style="margin-left:auto">' + Iconos.svg('mas') + ' Nueva roca</button>' : '') + '</div>';

    var formulario = '<div id="g-nueva-roca" hidden><div class="pa-panel">' +
      UI.texto('nr-titulo', 'Título de la roca', '', { placeholder: 'Ej.: Reducir el costo administrativo por empleado un 25 %' }) +
      UI.area('nr-descripcion', 'Por qué importa', '', { filas: 2 }) +
      UI.fila([
        UI.selector('nr-responsable', 'Responsable', Gestor.lista('usuarios').map(function (u) {
          return { id: u.id, nombre: u.nombre }; }), (Gestor.usuarioActual() || {}).id),
        UI.selector('nr-estado', 'Estado', PMBOK.eos.estadosRoca, 'encamino')
      ]) +
      UI.area('nr-metas', 'Metas medibles', '', { filas: 3, ayuda: 'Una por línea. De una a tres.' }) +
      '<div class="tarjeta-pie"><button class="btn primario" data-g="crear-roca">Crear roca</button>' +
      '<button class="btn" data-g="cerrar-nueva-roca">Cancelar</button></div></div></div>';

    var cuerpo = rocas.length
      ? '<div class="g-rocas">' + rocas.map(function (r) {
          var resp = r.responsableId ? Gestor.uno('usuarios', r.responsableId) : null;
          var est = PMBOK.eos.estadosRoca.filter(function (e) { return e.id === r.estado; })[0] || PMBOK.eos.estadosRoca[0];
          var metas = (r.metas || []);
          var hechas = metas.filter(function (m) { return m.hecho; }).length;
          var vinculados = Gestor.lista('proyectos').filter(function (p) { return p.rocaId === r.id; });
          return '<div class="g-roca">' +
            '<div class="g-roca-cab">' +
              '<h3>' + R.escapar(r.titulo) + '</h3>' +
              UI.pastilla(est.nombre, est.color) +
              (gestiona ? '<button class="g-mini-x" data-g="borrar-roca" data-id="' + r.id + '" title="Eliminar">×</button>' : '') +
            '</div>' +
            (r.descripcion ? '<p>' + R.escapar(r.descripcion) + '</p>' : '') +
            (metas.length
              ? '<ul class="g-metas">' + metas.map(function (m, i) {
                  return '<li><button class="pa-check' + (m.hecho ? ' activo' : '') + '" data-g="meta-roca" ' +
                    'data-id="' + r.id + '" data-i="' + i + '"' + (gestiona ? '' : ' disabled') + '>✓</button>' + R.escapar(m.texto) + '</li>';
                }).join('') + '</ul>'
              : '') +
            '<div class="g-roca-pie">' +
              '<span>' + UI.avatar(resp ? resp.nombre : '?') + R.escapar(resp ? resp.nombre : 'sin responsable') + '</span>' +
              '<span>' + hechas + '/' + metas.length + ' metas</span>' +
              '<span>' + vinculados.length + ' proyecto' + (vinculados.length === 1 ? '' : 's') + ' vinculado' +
                (vinculados.length === 1 ? '' : 's') + '</span>' +
              '<select class="g-mover" data-estado-roca="' + r.id + '"' + (gestiona ? '' : ' disabled') + '>' +
                PMBOK.eos.estadosRoca.map(function (e) {
                  return '<option value="' + e.id + '"' + (e.id === r.estado ? ' selected' : '') + '>' + e.nombre + '</option>';
                }).join('') + '</select>' +
            '</div></div>';
        }).join('') + '</div>'
      : UI.vacio('🪨', 'Sin rocas para ' + trimestre,
          'Define el objetivo trimestral más importante. De él se desprenden los portafolios y proyectos.');

    return selector + (gestiona ? formulario : '') +
      '<div class="nota"><div class="nota-titulo">Cómo se usa</div>' + PMBOK.eos.ayudaRocas + '</div>' + cuerpo;
  }

  function eosScorecard(gestiona) {
    var metricas = Gestor.lista('metricas');
    var semanas = ultimasSemanas(13);

    var formulario = '<div id="g-nueva-metrica" hidden><div class="pa-panel">' +
      UI.fila([
        UI.texto('nm-nombre', 'Métrica', '', { placeholder: 'Ej.: Quejas de clientes' }),
        UI.texto('nm-meta', 'Meta', '', { placeholder: 'Ej.: ≤ 3' }),
        UI.selector('nm-responsable', 'Responsable', Gestor.lista('usuarios').map(function (u) {
          return { id: u.id, nombre: u.nombre }; }), (Gestor.usuarioActual() || {}).id)
      ]) +
      UI.selector('nm-direccion', 'Dirección deseada',
        [{ id: 'menor', nombre: 'Cuanto menor, mejor' }, { id: 'mayor', nombre: 'Cuanto mayor, mejor' }], 'mayor') +
      '<div class="tarjeta-pie"><button class="btn primario" data-g="crear-metrica">Añadir métrica</button>' +
      '<button class="btn" data-g="cerrar-nueva-metrica">Cancelar</button></div></div></div>';

    var tabla = metricas.length
      ? '<div class="envoltura-tabla"><table class="pa-tabla g-scorecard"><thead><tr>' +
        '<th>Métrica</th><th>Meta</th><th>Responsable</th>' +
        semanas.map(function (s) { return '<th title="' + s.iso + '">' + s.etiqueta + '</th>'; }).join('') +
        '<th></th></tr></thead><tbody>' +
        metricas.map(function (m) {
          var resp = m.responsableId ? Gestor.uno('usuarios', m.responsableId) : null;
          return '<tr>' +
            '<td><b>' + R.escapar(m.nombre) + '</b></td>' +
            '<td>' + R.escapar(m.meta || '—') + '</td>' +
            '<td>' + R.escapar(resp ? resp.nombre.split(' ')[0] : '—') + '</td>' +
            semanas.map(function (s) {
              var v = (m.valores || {})[s.iso];
              var clase = estadoMetrica(m, v);
              return '<td class="g-celda-metrica ' + clase + '">' +
                '<input class="g-num" data-metrica="' + m.id + '" data-semana="' + s.iso + '" ' +
                'value="' + R.escapar(v == null ? '' : v) + '" inputmode="decimal"' + (gestiona ? '' : ' readonly') + '></td>';
            }).join('') +
            '<td>' + (gestiona ? '<button class="g-mini-x" data-g="borrar-metrica" data-id="' + m.id + '">×</button>' : '') + '</td>' +
            '</tr>';
        }).join('') + '</tbody></table></div>'
      : UI.vacio('📊', 'Sin métricas definidas',
          'Añade entre 5 y 15 números de la operación que se midan cada semana.');

    return (gestiona ? '<div class="g-trimestres"><button class="btn primario" data-g="abrir-nueva-metrica">' + Iconos.svg('mas') + ' Nueva métrica</button></div>' +
      formulario : '') +
      '<div class="nota"><div class="nota-titulo">Cómo se usa</div>' + PMBOK.eos.ayudaScorecard + '</div>' +
      tabla;
  }

  function estadoMetrica(m, valor) {
    if (valor === undefined || valor === null || valor === '') return '';
    var meta = parseFloat(String(m.meta || '').replace(/[^\d.,-]/g, '').replace(',', '.'));
    var v = parseFloat(String(valor).replace(',', '.'));
    if (isNaN(meta) || isNaN(v)) return '';
    var bien = m.direccion === 'menor' ? v <= meta : v >= meta;
    return bien ? 'verde' : 'rojo';
  }

  function ultimasSemanas(n) {
    var salida = [];
    var d = new Date();
    d.setDate(d.getDate() - (d.getDay() + 6) % 7);   // lunes de esta semana
    for (var i = n - 1; i >= 0; i--) {
      var x = new Date(d.getTime() - i * 7 * 86400000);
      var iso = x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
      salida.push({ iso: iso, etiqueta: String(x.getDate()) + '/' + (x.getMonth() + 1) });
    }
    return salida;
  }

  function eosVto(gestiona) {
    function bloque(b) {
      var valor = Gestor.vto(b.id);
      return '<div class="g-vto-bloque' + (valor ? ' lleno' : '') + '">' +
        '<div class="g-vto-cab"><b>' + R.escapar(b.nombre) + '</b>' +
          UI.pastilla(valor ? 'Definido' : 'Sin llenar', valor ? 'ok' : '') + '</div>' +
        '<p class="g-vto-ayuda">' + R.escapar(b.ayuda) + '</p>' +
        '<textarea class="g-vto-texto" data-vto="' + b.id + '" rows="3" ' + (gestiona ? '' : 'readonly ') +
        'placeholder="' + (gestiona ? 'Escribe aquí…' : 'Sin llenar') + '">' + R.escapar(valor) + '</textarea>' +
        '</div>';
    }
    var vision = PMBOK.eos.vto.filter(function (b) { return b.lado === 'vision'; });
    var traccion = PMBOK.eos.vto.filter(function (b) { return b.lado === 'traccion'; });

    return '<div class="nota"><div class="nota-titulo">Cómo se usa</div>' + PMBOK.eos.ayudaVto + '</div>' +
      '<h2>Visión</h2><div class="g-vto">' + vision.map(bloque).join('') + '</div>' +
      '<h2>Tracción</h2><div class="g-vto">' + traccion.map(bloque).join('') + '</div>';
  }

  function eosOrganigrama(gestiona) {
    function rama(padreId, nivel) {
      var hijos = Gestor.asientosHijos(padreId);
      if (!hijos.length) return '';
      return '<ul class="g-organigrama' + (nivel ? ' hijo' : '') + '">' + hijos.map(function (a) {
        var persona = a.personaId ? Gestor.uno('usuarios', a.personaId) : null;
        return '<li>' +
          '<div class="g-asiento">' +
            '<div class="g-asiento-cab"><b>' + R.escapar(a.nombre) + '</b>' +
              (gestiona ? '<button class="g-mini-x" data-g="borrar-asiento" data-id="' + a.id + '">×</button>' : '') + '</div>' +
            (a.gwt ? '<div class="g-asiento-gwt">' + R.escapar(a.gwt) + '</div>' : '') +
            '<div class="g-asiento-persona">' + UI.avatar(persona ? persona.nombre : '—') +
              R.escapar(persona ? persona.nombre : 'asiento vacante') + '</div>' +
            (gestiona ? '<button class="pa-mini" data-g="abrir-asiento" data-padre="' + a.id + '">+ asiento debajo</button>' : '') +
          '</div>' + rama(a.id, nivel + 1) + '</li>';
      }).join('') + '</ul>';
    }

    var raiz = Gestor.asientosHijos(null);
    return '<div class="nota"><div class="nota-titulo">Cómo se usa</div>' + PMBOK.eos.ayudaOrganigrama + '</div>' +
      (gestiona ? '<div class="g-trimestres"><button class="btn primario" data-g="abrir-asiento" data-padre="">' + Iconos.svg('mas') + ' Nuevo asiento raíz</button></div>' : '') +
      '<div id="g-nuevo-asiento" hidden><div class="pa-panel">' +
        UI.texto('na-nombre', 'Nombre del asiento', '', { placeholder: 'Ej.: Integrador / Director de operaciones' }) +
        UI.area('na-gwt', 'Qué hace (5-10 palabras)', '', { filas: 2, ayuda: 'Get it, Want it, Capacity to do it.' }) +
        UI.selector('na-persona', 'Persona', [{ id: '', nombre: '— Vacante —' }].concat(
          Gestor.lista('usuarios').map(function (u) { return { id: u.id, nombre: u.nombre }; })), '') +
        '<input type="hidden" id="na-padre" value="">' +
        '<div class="tarjeta-pie"><button class="btn primario" data-g="crear-asiento">Crear asiento</button>' +
        '<button class="btn" data-g="cerrar-asiento">Cancelar</button></div></div></div>' +
      (raiz.length ? rama(null, 0) : UI.vacio('🗂️', 'Organigrama vacío',
        'Empieza por el asiento de dirección y desciende. Primero la estructura, después las personas.'));
  }

  /* ══════════════ ADMINISTRACIÓN ══════════════ */

  function admin() {
    if (!Gestor.esAdmin()) {
      return '<div class="hoja">' + UI.vacio('🔒', 'Solo para administradores',
        'Tu cuenta no tiene permisos de administración.') + '</div>';
    }

    var usuarios = Gestor.lista('usuarios');
    var filas = usuarios.map(function (u) {
      var permisos = Gestor.permisosDe(u.id);
      var proyectos = Gestor.lista('proyectos').filter(function (p) { return p.directorId === u.id; }).length;
      var rol = Gestor.roles.filter(function (r) { return r.id === u.rol; })[0] || { nombre: u.rol };
      return '<tr>' +
        '<td><div class="g-usuario">' + UI.avatar(u.nombre) +
          '<div><b>' + R.escapar(u.nombre) + '</b><span>' + R.escapar(u.correo) + '</span></div></div></td>' +
        '<td>' + R.escapar(rol.nombre) + '</td>' +
        '<td>' + permisos.length + ' permiso' + (permisos.length === 1 ? '' : 's') + ' · ' + proyectos + ' dirigido' + (proyectos === 1 ? '' : 's') + '</td>' +
        '<td>' + UI.pastilla(u.activo ? 'activo' : 'inactivo', u.activo ? 'ok' : 'falla') + '</td>' +
        '<td class="g-acciones">' +
          '<button class="pa-mini" data-g="permisos" data-id="' + u.id + '">Permisos</button>' +
          '<button class="pa-mini" data-g="clave" data-id="' + u.id + '">Contraseña</button>' +
          (u.id !== 'u-admin'
            ? '<button class="pa-mini" data-g="alternar-usuario" data-id="' + u.id + '">' +
              (u.activo ? 'Desactivar' : 'Activar') + '</button>'
            : '') +
        '</td></tr>';
    }).join('');

    return '<div class="hoja-ancha prosa">' +
      '<div class="eyebrow">Solo administradores</div>' +
      '<div class="g-cabecera">' +
        '<h1 class="titulo-pagina" style="margin:0">Administración</h1>' +
        '<button class="btn primario" data-g="abrir-nuevo-usuario">' + Iconos.svg('mas') + ' Nuevo usuario</button>' +
      '</div>' +
      '<p class="bajada">Crea cuentas y concede permisos por portafolio, programa o proyecto. ' +
      'Los permisos se suman: siempre gana el nivel más alto.</p>' +

      '<div id="g-nuevo-usuario" hidden><div class="pa-panel">' +
        '<div id="g-error-usuario"></div>' +
        UI.fila([
          UI.texto('nu-nombre', 'Nombre', '', { placeholder: 'Nombre y apellido' }),
          UI.texto('nu-correo', 'Correo', '', { tipo: 'email', placeholder: 'persona@organizacion.com' })
        ]) +
        UI.fila([
          UI.texto('nu-clave', 'Contraseña inicial', '', { tipo: 'text', placeholder: 'mínimo 6 caracteres' }),
          UI.selector('nu-rol', 'Rol', Gestor.roles, 'miembro')
        ]) +
        '<div class="tarjeta-pie"><button class="btn primario" data-g="crear-usuario">Crear usuario</button>' +
        '<button class="btn" data-g="cerrar-nuevo-usuario">Cancelar</button></div>' +
      '</div></div>' +

      '<div class="envoltura-tabla"><table class="pa-tabla">' +
      '<thead><tr><th>Usuario</th><th>Rol</th><th>Accesos</th><th>Estado</th><th></th></tr></thead>' +
      '<tbody>' + filas + '</tbody></table></div>' +

      '<div id="g-panel-permisos"></div>' +

      '<h2>Qué puede hacer cada rol</h2>' +
      R.tabla(['Rol', 'Alcance'], Gestor.roles.map(function (r) { return [r.nombre, r.descripcion]; })) +

      '<h2>Datos</h2>' +
      (Gestor.enServidor()
        ? '<p>La información del gestor vive en el servidor (PostgreSQL). Expórtala para conservar una copia o ' +
          'llevarla a otro equipo. Las contraseñas no se incluyen en la exportación; al importar, las cuentas ' +
          'nuevas reciben la contraseña provisional <code>cambiar123</code> y deben cambiarla al entrar.</p>'
        : '<p>Toda la información del gestor vive en este navegador. Expórtala para conservarla o llevarla a otro equipo. ' +
          'Las contraseñas no se incluyen en la exportación.</p>') +
      '<div class="tarjeta-pie">' +
        '<button class="btn" data-g="exportar-bd">Exportar datos (.json)</button>' +
        '<label class="btn" for="g-importar">Importar datos</label>' +
        '<input type="file" id="g-importar" accept=".json" hidden>' +
        '<button class="btn" data-g="reiniciar-bd">Borrar todo</button>' +
      '</div>' +
      panelMigracion() +
      '</div>';
  }

  /* Lo que quedó guardado en este navegador antes de usar el servidor */
  function panelMigracion() {
    if (!Gestor.enServidor()) return '';
    var d = Gestor.datosDelNavegador();
    if (!d) return '';
    function n(v, uno, varios) { return v + ' ' + (v === 1 ? uno : varios); }
    return '<div class="pa-panel g-migracion" id="g-migracion">' +
      '<div class="pa-panel-cab"><h2 style="margin:0">Datos guardados en este navegador</h2></div>' +
      '<p>Este navegador conserva trabajo del modo local: ' +
        [n(d.proyectos, 'proyecto', 'proyectos'), n(d.documentos, 'documento', 'documentos'),
         n(d.archivos, 'archivo', 'archivos'), n(d.usuarios, 'cuenta', 'cuentas')].join(' · ') + '.</p>' +
      '<p>Puedes llevarlo al servidor. <b>Reemplaza todos los datos que haya ahora en el servidor</b>; ' +
        'los archivos se suben uno a uno y lo del navegador no se borra.</p>' +
      '<div id="g-migracion-estado"></div>' +
      '<div class="tarjeta-pie"><button class="btn primario" data-g="llevar-al-servidor">Llevar al servidor</button></div>' +
      '</div>';
  }

  function panelPermisos(usuarioId) {
    var u = Gestor.uno('usuarios', usuarioId);
    if (!u) return '';
    var permisos = Gestor.permisosDe(usuarioId);
    var portafolios = Gestor.lista('portafolios');
    var proyectos = Gestor.lista('proyectos');

    var ambitos = [];
    portafolios.forEach(function (p) { ambitos.push({ id: 'portafolio:' + p.id, nombre: 'Portafolio: ' + p.nombre }); });
    Gestor.lista('programas').forEach(function (p) { ambitos.push({ id: 'programa:' + p.id, nombre: 'Programa: ' + p.nombre }); });
    proyectos.forEach(function (p) { ambitos.push({ id: 'proyecto:' + p.id, nombre: 'Proyecto: ' + p.nombre }); });

    return '<div class="pa-panel" id="g-permisos-abierto">' +
      '<div class="pa-panel-cab"><h2 style="margin:0">Permisos de ' + R.escapar(u.nombre) + '</h2>' +
      '<button class="btn" data-g="cerrar-permisos">Cerrar</button></div>' +
      (permisos.length
        ? '<div class="envoltura-tabla"><table class="pa-tabla"><thead><tr><th>Ámbito</th><th>Nivel</th><th></th></tr></thead><tbody>' +
          permisos.map(function (p) {
            var ref = Gestor.uno(p.ambito === 'portafolio' ? 'portafolios' : p.ambito === 'programa' ? 'programas' : 'proyectos', p.refId);
            return '<tr><td>' + p.ambito + ' · ' + R.escapar(ref ? ref.nombre : '(eliminado)') + '</td>' +
              '<td>' + p.nivel + '</td>' +
              '<td><button class="g-mini-x" data-g="revocar" data-id="' + p.id + '">×</button></td></tr>';
          }).join('') + '</tbody></table></div>'
        : '<p style="color:var(--tinta-3);font-size:13.2px">Sin permisos específicos. Solo ve lo que dirige o donde es miembro.</p>') +
      (ambitos.length
        ? UI.fila([
            UI.selector('perm-ambito', 'Conceder acceso a', ambitos, ambitos[0].id),
            UI.selector('perm-nivel', 'Nivel', [
              { id: 'ver', nombre: 'Ver' }, { id: 'editar', nombre: 'Editar' }, { id: 'dirigir', nombre: 'Dirigir' }
            ], 'ver')
          ]) +
          '<input type="hidden" id="perm-usuario" value="' + usuarioId + '">' +
          '<div class="tarjeta-pie"><button class="btn primario" data-g="conceder">Conceder</button></div>'
        : '<p style="color:var(--tinta-3);font-size:13.2px">Crea antes un portafolio o un proyecto.</p>') +
      '</div>';
  }

  /* ══════════════ APRENDER ══════════════ */

  function aprender() {
    var accesos = [
      { r: '#/procesos', i: 'procesos', e: '40', t: 'Los procesos', d: 'Propósito, entradas, herramientas, salidas y errores frecuentes de cada uno.' },
      { r: '#/herramientas', i: 'herramientas', e: '155', t: 'Herramientas y técnicas', d: 'Catálogo filtrable por familia y por texto.' },
      { r: '#/artefactos', i: 'artefactos', e: '42', t: 'Artefactos', d: 'Los documentos que produce un proyecto, con la plantilla que se rellena.' },
      { r: '#/eos', i: 'eos', e: '4', t: 'EOS', d: 'Rocas, scorecard, VTO y organigrama: la capa directiva sobre los proyectos.' }
    ].map(function (a) {
      return '<a class="tarjeta tarjeta-acceso" href="' + a.r + '">' +
        '<span class="tarjeta-icono">' + Iconos.svg(a.i) + '</span>' +
        '<span class="tarjeta-cifra">' + a.e + '</span>' +
        '<div class="tarjeta-titulo">' + a.t + '</div>' +
        '<div class="tarjeta-texto">' + a.d + '</div></a>';
    }).join('');

    var bandas = PMBOK.bandas.map(function (b, i) {
      var n = PMBOK.flujo.filter(function (f) { return f.banda === b.id; }).length;
      return '<div class="g-banda-mini"><i>' + b.n + '</i><div><b>' + b.nombre + '</b><span>' + n + ' procesos</span></div></div>' +
        (i < PMBOK.bandas.length - 1 ? '<span class="g-flecha" aria-hidden="true"></span>' : '');
    }).join('');

    var dominios = PMBOK.dominiosMeta.map(function (d) {
      var dom = PMBOK.dominios.filter(function (x) { return x.clave === d.id; })[0];
      return '<a class="tarjeta tarjeta-dominio ' + d.clase + '" href="#/dominio/' + (dom ? dom.id : '') + '">' +
        '<span class="tarjeta-inicial" aria-hidden="true">' + d.nombre.charAt(0) + '</span>' +
        '<div class="tarjeta-eyebrow">' + d.procesos + ' procesos</div>' +
        '<div class="tarjeta-titulo">' + d.nombre + '</div>' +
        '<div class="tarjeta-texto">' + d.lema + '</div></a>';
    }).join('');

    return '<div class="hoja-ancha prosa">' +
      '<div class="eyebrow">Modo aprender</div>' +
      '<h1 class="titulo-pagina">Guía didáctica PMBOK® 8.ª edición</h1>' +
      '<p class="bajada">Los 7 dominios de desempeño, los 40 procesos, 155 herramientas y 42 artefactos. ' +
      'Todo lo que el gestor aplica a tus proyectos, explicado.</p>' +
      R.bandaSimulacion() +

      '<h2>El ciclo de vida en cinco bandas</h2>' +
      '<div class="g-bandas-mini">' + bandas + '</div>' +

      '<h2>Por dónde empezar</h2>' +
      '<div class="rejilla rejilla-2">' + accesos + '</div>' +

      '<h2>Los siete dominios de desempeño</h2>' +
      '<div class="rejilla rejilla-3">' + dominios + '</div>' +

      '<h2>Los seis principios</h2>' +
      '<p style="color:var(--tinta-2);font-size:13.6px;margin-bottom:14px">' +
      'Criterios de juicio, no procedimientos. La verificación de calidad de cada proyecto pide evidencia de los seis.</p>' +
      '<div class="rejilla rejilla-3 rejilla-seis">' + PMBOK.principios.map(function (pr) {
        return '<a class="tarjeta" href="#/principio/' + pr.id + '">' +
          '<div class="tarjeta-eyebrow">Principio ' + pr.n + '</div>' +
          '<div class="tarjeta-titulo">' + pr.titulo + '</div>' +
          '<div class="tarjeta-texto">' + pr.lema + '</div></a>';
      }).join('') + '</div>' +
      '</div>';
  }

  /* ══════════════ CATÁLOGOS ══════════════ */

  function herramientas() {
    var grupos = PMBOK.gruposHerramienta.map(function (g) {
      var suyas = PMBOK.herramientas.filter(function (h) { return h.grupo === g.id; });
      if (!suyas.length) return '';
      return '<h2 id="g-' + g.id + '">' + g.nombre + ' <span class="pa-conteo">' + suyas.length + '</span></h2>' +
        '<div class="g-catalogo">' + suyas.map(function (h) {
          return '<div class="g-ficha item-herramienta" data-texto="' +
            R.escapar(Indice.normalizar(h.nombre + ' ' + h.descripcion)) + '">' +
            '<div class="g-ficha-nombre">' + R.escapar(h.nombre) + '</div>' +
            '<div class="g-ficha-desc">' + R.escapar(h.descripcion) + '</div></div>';
        }).join('') + '</div>';
    }).join('');

    return '<div class="hoja-ancha prosa">' +
      R.migas([{ texto: 'Aprender', ruta: '#/aprender' }, { texto: 'Herramientas' }]) +
      '<h1 class="titulo-pagina">Herramientas y técnicas</h1>' +
      '<p class="bajada">Las ' + PMBOK.herramientas.length + ' herramientas de la 8.ª edición, agrupadas por familia. ' +
      'Cada proceso indica cuáles le corresponden.</p>' +
      '<div class="barra-filtros"><input type="search" id="filtro-herramientas" placeholder="Filtrar herramientas…" ' +
      'aria-label="Filtrar herramientas"><span id="conteo-herramientas" class="pa-contador"></span></div>' +
      grupos +
      '</div>';
  }

  function artefactos() {
    var filas = PMBOK.categoriasArtefacto.map(function (c) {
      var suyos = PMBOK.artefactos.filter(function (a) { return a.categoria === c.id; });
      if (!suyos.length) return '';
      return '<h2>' + c.nombre + ' <span class="pa-conteo">' + suyos.length + '</span></h2>' +
        '<div class="g-catalogo">' + suyos.map(function (a) {
          var produce = PMBOK.flujo.filter(function (f) { return (f.salidas || []).indexOf(a.id) !== -1; });
          return '<div class="g-ficha item-artefacto" data-texto="' +
            R.escapar(Indice.normalizar(a.nombre + ' ' + a.descripcion)) + '">' +
            '<div class="g-ficha-nombre">' + R.escapar(a.nombre) + '</div>' +
            '<div class="g-ficha-desc">' + R.escapar(a.descripcion) + '</div>' +
            '<div class="g-ficha-pie">' + a.plantilla.length + ' bloques · lo produce ' +
              produce.slice(0, 2).map(function (f) {
                var p = PMBOK.procesos.filter(function (x) { return x.id === f.id; })[0];
                return p ? '<a href="#/proceso/' + p.id + '">' + p.cod + '</a>' : '';
              }).filter(Boolean).join(', ') +
            '</div></div>';
        }).join('') + '</div>';
    }).join('');

    return '<div class="hoja-ancha prosa">' +
      R.migas([{ texto: 'Aprender', ruta: '#/aprender' }, { texto: 'Artefactos' }]) +
      '<h1 class="titulo-pagina">Artefactos</h1>' +
      '<p class="bajada">Los ' + PMBOK.artefactos.length + ' documentos que produce un proyecto. ' +
      'Cada uno trae la plantilla que se rellena al generarlo desde su proceso.</p>' +
      '<div class="barra-filtros"><input type="search" id="filtro-artefactos" placeholder="Filtrar artefactos…" ' +
      'aria-label="Filtrar artefactos"></div>' +
      filas +
      '</div>';
  }

  /* ══════════════ Interacción ══════════════ */

  function conectar(vista, arg, recargarVista) {
    recargar = recargarVista || function () {};

    var botones = document.querySelectorAll('[data-g]');
    for (var i = 0; i < botones.length; i++) botones[i].addEventListener('click', manejar);

    if (vista === 'entrar') {
      var clave = document.getElementById('acc-clave');
      if (clave) clave.addEventListener('keydown', function (e) { if (e.key === 'Enter') accionEntrar(); });
      var correo = document.getElementById('acc-correo');
      if (correo) correo.focus();
    }
    if (vista === 'clave') {
      var repetir = document.getElementById('cc-repetir');
      if (repetir) repetir.addEventListener('keydown', function (e) { if (e.key === 'Enter') accionCambiarClave(); });
      var actual = document.getElementById('cc-actual');
      if (actual) actual.focus();
    }

    conectarSelectores();
    conectarFiltros();
    conectarVto();
    conectarScorecard();
  }

  /* Un «change» puede llegar disparado por el propio blur que provoca el
     repintado. Volver a pintar dentro de ese evento rompe el innerHTML en
     curso, así que se aplaza un tick. */
  function recargarDiferido() { setTimeout(function () { recargar(); }, 0); }

  function conectarSelectores() {
    var mover = document.querySelectorAll('[data-mover]');
    for (var i = 0; i < mover.length; i++) {
      mover[i].addEventListener('change', function () {
        Gestor.actualizar('proyectos', this.getAttribute('data-mover'), { portafolioId: this.value || null });
        recargarDiferido();
      });
    }
    var estados = document.querySelectorAll('[data-estado-roca]');
    for (var j = 0; j < estados.length; j++) {
      estados[j].addEventListener('change', function () {
        Gestor.actualizar('rocas', this.getAttribute('data-estado-roca'), { estado: this.value });
        recargarDiferido();
      });
    }
    var opciones = document.querySelectorAll('[data-opcion]');
    for (var k = 0; k < opciones.length; k++) {
      opciones[k].addEventListener('click', function () {
        var grupo = this.getAttribute('data-opcion');
        var caja = document.querySelector('[data-opciones="' + grupo + '"]');
        var todos = caja.querySelectorAll('.g-opcion');
        for (var n = 0; n < todos.length; n++) todos[n].classList.remove('activa');
        this.classList.add('activa');
        document.getElementById('val-' + grupo).value = this.getAttribute('data-valor');
      });
    }
  }

  function conectarFiltros() {
    [['filtro-herramientas', '.item-herramienta', 'conteo-herramientas'],
     ['filtro-artefactos', '.item-artefacto', null]].forEach(function (par) {
      var campo = document.getElementById(par[0]);
      if (!campo) return;
      campo.addEventListener('input', function () {
        var q = Indice.normalizar(campo.value);
        var items = document.querySelectorAll(par[1]);
        var visibles = 0;
        for (var i = 0; i < items.length; i++) {
          var ok = !q || items[i].getAttribute('data-texto').indexOf(q) !== -1;
          items[i].hidden = !ok;
          if (ok) visibles++;
        }
        if (par[2]) {
          var c = document.getElementById(par[2]);
          if (c) c.textContent = visibles + ' de ' + items.length;
        }
        var titulos = document.querySelectorAll('.prosa h2');
        for (var j = 0; j < titulos.length; j++) {
          var sig = titulos[j].nextElementSibling;
          if (sig && sig.classList.contains('g-catalogo')) {
            var quedan = sig.querySelectorAll('.g-ficha:not([hidden])').length;
            titulos[j].hidden = quedan === 0;
            sig.hidden = quedan === 0;
          }
        }
      });
    });
  }

  function conectarVto() {
    var areas = document.querySelectorAll('[data-vto]');
    for (var i = 0; i < areas.length; i++) {
      areas[i].addEventListener('blur', function () {
        Gestor.fijarVto(this.getAttribute('data-vto'), this.value);
        this.parentNode.classList.toggle('lleno', !!this.value.trim());
      });
    }
  }

  function conectarScorecard() {
    var celdas = document.querySelectorAll('[data-metrica]');
    for (var i = 0; i < celdas.length; i++) {
      celdas[i].addEventListener('change', function () {
        var m = Gestor.uno('metricas', this.getAttribute('data-metrica'));
        if (!m) return;
        if (!m.valores) m.valores = {};
        var s = this.getAttribute('data-semana');
        if (String(this.value).trim()) m.valores[s] = this.value.trim();
        else delete m.valores[s];
        Gestor.actualizar('metricas', m.id, { valores: m.valores });
        recargarDiferido();
      });
    }
  }

  function error(id, mensaje) {
    var caja = document.getElementById(id);
    if (caja) caja.innerHTML = '<div class="nota alerta"><div class="nota-titulo">No se pudo continuar</div>' +
      R.escapar(mensaje) + '</div>';
  }

  /* Deshabilita el botón mientras una acción espera al servidor */
  function ocupado(selector, si) {
    var b = document.querySelector(selector);
    if (b) { b.disabled = si; b.setAttribute('aria-busy', si ? 'true' : 'false'); }
  }

  function accionEntrar() {
    ocupado('[data-g="entrar"]', true);
    /* En modo local el resultado llega al instante; en modo servidor, en una promesa */
    Promise.resolve(Gestor.entrar(UI.valorDe('acc-correo'), UI.valorDe('acc-clave'))).then(function (r) {
      ocupado('[data-g="entrar"]', false);
      if (r.error) { error('g-error-acceso', r.error); return; }
      location.hash = r.clavePendiente ? '#/clave' : '#/panel';
      recargar();
    });
  }

  function accionCambiarClave() {
    var actual = UI.valorDe('cc-actual');
    var nueva = UI.valorDe('cc-nueva');
    if (nueva !== UI.valorDe('cc-repetir')) { error('g-error-clave', 'Las dos contraseñas nuevas no coinciden.'); return; }
    ocupado('[data-g="cambiar-clave"]', true);
    Gestor.cambiarPropiaClave(actual, nueva).then(function (r) {
      ocupado('[data-g="cambiar-clave"]', false);
      if (r.error) { error('g-error-clave', r.error); return; }
      location.hash = '#/panel';
      recargar();
      Dialogo.avisar('Contraseña actualizada');
    });
  }

  function accionLlevarAlServidor() {
    var d = Gestor.datosDelNavegador();
    if (!d) return;
    Dialogo.confirmar({
      titulo: 'Llevar los datos del navegador al servidor',
      texto: 'Se <b>reemplazan todos los datos del servidor</b> por los ' + d.proyectos + ' proyecto(s) de este navegador, ' +
        'y se suben sus ' + d.archivos + ' archivo(s). Si alguien más usa el servidor, exporta antes una copia.',
      confirmar: 'Reemplazar y llevar', peligro: true
    }, function () {
      var caja = document.getElementById('g-migracion-estado');
      ocupado('[data-g="llevar-al-servidor"]', true);
      Gestor.llevarNavegadorAlServidor(function (texto) {
        if (caja) caja.innerHTML = '<p class="g-cargando">' + R.escapar(texto) + '</p>';
      }).then(function (r) {
        if (r.error) {
          ocupado('[data-g="llevar-al-servidor"]', false);
          if (caja) caja.innerHTML = '';
          Dialogo.avisar('No se pudo llevar al servidor: ' + r.error, 'error');
          return;
        }
        var importados = Object.keys(r.importados || {}).reduce(function (n, k) { return n + r.importados[k]; }, 0);
        var lineas = ['<b>' + importados + '</b> registros importados y <b>' + r.archivosSubidos + '</b> archivo(s) subidos.']
          .concat(r.avisos || [])
          .concat((r.archivosFallidos || []).map(function (f) { return 'No se subió ' + f; }));
        Dialogo.informar({
          titulo: 'Datos llevados al servidor',
          texto: lineas.map(function (l, i) { return i ? R.escapar(l) : l; }).join('<br>')
        });
        recargar();
      });
    });
  }

  function alternar(id, mostrar) {
    var e = document.getElementById(id);
    if (e) e.hidden = mostrar === undefined ? !e.hidden : !mostrar;
    return e;
  }

  function manejar(e) {
    var el = e.currentTarget;
    var accion = el.getAttribute('data-g');
    var id = el.getAttribute('data-id');
    e.preventDefault();

    switch (accion) {
      case 'entrar': accionEntrar(); break;
      case 'cambiar-clave': accionCambiarClave(); break;
      case 'llevar-al-servidor': accionLlevarAlServidor(); break;

      case 'acceso-demo':
        document.getElementById('acc-correo').value = 'admin@pmbok.local';
        document.getElementById('acc-clave').value = 'admin123';
        accionEntrar();
        break;

      case 'salir':
        Promise.resolve(Gestor.salir()).then(function () {
          location.hash = '#/entrar';
          recargar();
        });
        break;

      case 'abrir-nuevo-proyecto': {
        var form = alternar('g-nuevo-proyecto', true);
        var nombre = document.getElementById('np-nombre');
        if (form) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (nombre) setTimeout(function () { nombre.focus(); }, 60);
        break;
      }
      case 'cerrar-nuevo-proyecto': alternar('g-nuevo-proyecto', false); break;

      case 'crear-proyecto': {
        ocupado('[data-g="crear-proyecto"]', true);
        var pendiente = Gestor.crearProyecto({
          nombre: UI.valorDe('np-nombre'),
          descripcion: UI.valorDe('np-descripcion'),
          metodologia: UI.valorDe('val-metodologia'),
          portafolioId: UI.valorDe('np-portafolio') || null,
          rocaId: UI.valorDe('np-roca') || null,
          inicio: UI.valorDe('np-inicio'),
          fin: UI.valorDe('np-fin'),
          presupuesto: UI.valorDe('np-presupuesto')
        });
        Promise.resolve(pendiente).then(function (r) {
          ocupado('[data-g="crear-proyecto"]', false);
          if (r.error) { error('g-error-proyecto', r.error); return; }
          location.hash = '#/proyectos/' + r.proyecto.id;
          Dialogo.avisar('Proyecto creado. Empieza por 2.1.1 Iniciar el Proyecto o Fase', 'ok', {
            etiqueta: 'Abrir 2.1.1',
            hacer: function () { location.hash = '#/proyectos/' + r.proyecto.id + '/proceso/p-gob-01'; }
          });
        });
        break;
      }

      case 'abrir-nuevo-portafolio': alternar('g-nuevo-portafolio', true); break;
      case 'cerrar-nuevo-portafolio': alternar('g-nuevo-portafolio', false); break;

      case 'crear-portafolio': {
        var n = UI.valorDe('npf-nombre');
        if (!n.trim()) return;
        Gestor.crear('portafolios', { nombre: n.trim(), descripcion: UI.valorDe('npf-descripcion') });
        recargar();
        break;
      }

      case 'borrar-portafolio': {
        var pf = Gestor.uno('portafolios', id);
        var afectados = Gestor.lista('proyectos', { portafolioId: id }).length;
        Dialogo.confirmar({
          titulo: 'Eliminar «' + (pf ? pf.nombre : 'portafolio') + '»',
          texto: afectados
            ? 'Sus ' + afectados + ' proyecto' + (afectados === 1 ? '' : 's') + ' no se borran: quedan sin portafolio.'
            : 'El portafolio está vacío.',
          confirmar: 'Eliminar portafolio', peligro: true
        }, function () {
          Gestor.borrarPortafolio(id);
          Dialogo.avisar('Portafolio eliminado');
          recargar();
        });
        break;
      }

      case 'nuevo-programa':
        Dialogo.pedir({
          titulo: 'Nuevo programa',
          texto: 'Un programa agrupa proyectos relacionados cuyos beneficios se gestionan juntos.',
          campos: [{ id: 'nombre', etiqueta: 'Nombre del programa', placeholder: 'Ej.: Modernización de nómina' }],
          confirmar: 'Crear programa'
        }, function (v) {
          if (!v.nombre.trim()) return;
          Gestor.crear('programas', { portafolioId: id, nombre: v.nombre.trim() });
          Dialogo.avisar('Programa creado');
          recargar();
        });
        break;

      case 'trimestre':
        VistasGestor.trimestreElegido = el.getAttribute('data-valor');
        recargar();
        break;

      case 'abrir-nueva-roca': alternar('g-nueva-roca', true); break;
      case 'cerrar-nueva-roca': alternar('g-nueva-roca', false); break;

      case 'crear-roca': {
        var t = UI.valorDe('nr-titulo');
        if (!t.trim()) return;
        Gestor.crear('rocas', {
          trimestre: VistasGestor.trimestreElegido || trimestreActual(),
          titulo: t.trim(),
          descripcion: UI.valorDe('nr-descripcion'),
          responsableId: UI.valorDe('nr-responsable'),
          estado: UI.valorDe('nr-estado'),
          metas: UI.valorDe('nr-metas').split('\n').filter(function (x) { return x.trim(); })
            .map(function (x) { return { texto: x.trim(), hecho: false }; })
        });
        recargar();
        break;
      }

      case 'borrar-roca':
        Dialogo.confirmar({
          titulo: 'Eliminar esta roca',
          texto: 'Los proyectos vinculados no se borran, solo pierden el vínculo con ella.',
          confirmar: 'Eliminar roca', peligro: true
        }, function () { Gestor.borrar('rocas', id); Dialogo.avisar('Roca eliminada'); recargar(); });
        break;

      case 'meta-roca': {
        var roca = Gestor.uno('rocas', id);
        var i = parseInt(el.getAttribute('data-i'), 10);
        if (roca && roca.metas && roca.metas[i]) {
          roca.metas[i].hecho = !roca.metas[i].hecho;
          Gestor.actualizar('rocas', id, { metas: roca.metas });
          recargar();
        }
        break;
      }

      case 'abrir-nueva-metrica': alternar('g-nueva-metrica', true); break;
      case 'cerrar-nueva-metrica': alternar('g-nueva-metrica', false); break;

      case 'crear-metrica': {
        var nm = UI.valorDe('nm-nombre');
        if (!nm.trim()) return;
        Gestor.crear('metricas', {
          nombre: nm.trim(), meta: UI.valorDe('nm-meta'),
          responsableId: UI.valorDe('nm-responsable'),
          direccion: UI.valorDe('nm-direccion'), valores: {}
        });
        recargar();
        break;
      }

      case 'borrar-metrica':
        Dialogo.confirmar({
          titulo: 'Eliminar la métrica',
          texto: 'Se pierden también sus 13 semanas de historial.',
          confirmar: 'Eliminar métrica', peligro: true
        }, function () { Gestor.borrar('metricas', id); Dialogo.avisar('Métrica eliminada'); recargar(); });
        break;

      case 'abrir-asiento':
        alternar('g-nuevo-asiento', true);
        document.getElementById('na-padre').value = el.getAttribute('data-padre') || '';
        break;
      case 'cerrar-asiento': alternar('g-nuevo-asiento', false); break;

      case 'crear-asiento': {
        var na = UI.valorDe('na-nombre');
        if (!na.trim()) return;
        Gestor.crear('asientos', {
          nombre: na.trim(), gwt: UI.valorDe('na-gwt'),
          personaId: UI.valorDe('na-persona') || null,
          padreId: UI.valorDe('na-padre') || null
        });
        recargar();
        break;
      }

      case 'borrar-asiento':
        Dialogo.confirmar({
          titulo: 'Eliminar el asiento',
          texto: 'También se eliminan los asientos que dependen de él.',
          confirmar: 'Eliminar asiento', peligro: true
        }, function () {
          (function borrarRama(padre) {
            Gestor.asientosHijos(padre).forEach(function (a) { borrarRama(a.id); Gestor.borrar('asientos', a.id); });
          })(id);
          Gestor.borrar('asientos', id);
          Dialogo.avisar('Asiento eliminado');
          recargar();
        });
        break;

      case 'abrir-nuevo-usuario': alternar('g-nuevo-usuario', true); break;
      case 'cerrar-nuevo-usuario': alternar('g-nuevo-usuario', false); break;

      case 'crear-usuario': {
        var ru = Gestor.crearUsuario({
          nombre: UI.valorDe('nu-nombre'), correo: UI.valorDe('nu-correo'),
          clave: UI.valorDe('nu-clave'), rol: UI.valorDe('nu-rol')
        });
        if (ru.error) { error('g-error-usuario', ru.error); return; }
        recargar();
        break;
      }

      case 'alternar-usuario': {
        var us = Gestor.uno('usuarios', id);
        if (us) { Gestor.actualizar('usuarios', id, { activo: !us.activo }); recargar(); }
        break;
      }

      case 'clave': {
        var cuenta = Gestor.uno('usuarios', id);
        Dialogo.pedir({
          titulo: 'Cambiar contraseña',
          texto: cuenta ? 'Cuenta de ' + Render.escapar(cuenta.nombre) + '.' : '',
          campos: [{ id: 'clave', etiqueta: 'Nueva contraseña', tipo: 'password', ayuda: 'Mínimo 6 caracteres' }],
          confirmar: 'Cambiar contraseña'
        }, function (v) {
          var rc = Gestor.cambiarClave(id, v.clave);
          Dialogo.avisar(rc.error || 'Contraseña actualizada', rc.error ? 'error' : 'ok');
        });
        break;
      }

      case 'permisos':
        document.getElementById('g-panel-permisos').innerHTML = panelPermisos(id);
        conectar('admin', '', recargar);
        document.getElementById('g-permisos-abierto').scrollIntoView({ behavior: 'smooth', block: 'center' });
        break;

      case 'cerrar-permisos':
        document.getElementById('g-panel-permisos').innerHTML = '';
        break;

      case 'conceder': {
        var partes = UI.valorDe('perm-ambito').split(':');
        Gestor.conceder(UI.valorDe('perm-usuario'), partes[0], partes[1], UI.valorDe('perm-nivel'));
        var abierto = UI.valorDe('perm-usuario');
        recargar();
        setTimeout(function () {
          var caja = document.getElementById('g-panel-permisos');
          if (caja) { caja.innerHTML = panelPermisos(abierto); conectar('admin', '', recargar); }
        }, 30);
        break;
      }

      case 'revocar': {
        Gestor.revocar(id);
        recargar();
        break;
      }

      case 'exportar-bd':
        Promise.resolve(Gestor.exportarTodo()).then(function (datos) {
          descargar('pmbok8-gestor.json', JSON.stringify(datos, null, 2));
        }, function (err) { Dialogo.avisar('No se pudo exportar: ' + err.message, 'error'); });
        break;

      case 'reiniciar-bd':
        Dialogo.confirmar({
          titulo: 'Borrar todos los datos',
          texto: 'Se eliminan <b>todos</b> los proyectos, documentos, usuarios y datos de gerencia ' +
            (Gestor.enServidor() ? 'del servidor' : 'de este navegador') + '. ' +
            'No se puede deshacer: exporta antes si quieres conservarlos.',
          confirmar: 'Borrar todo', peligro: true
        }, function () {
          Promise.resolve(Gestor.reiniciarTodo()).then(function (r) {
            if (r && r.error) { Dialogo.avisar(r.error, 'error'); return; }
            location.hash = '#/entrar';
            recargar();
          });
        });
        break;
    }
  }

  function descargar(nombre, contenido) {
    try {
      var blob = new Blob([contenido], { type: 'application/json;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = nombre;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    } catch (err) { Dialogo.avisar('No se pudo descargar el archivo', 'error'); }
  }

  /* Importación desde el input de administración */
  function conectarImportacion(recargarVista) {
    var imp = document.getElementById('g-importar');
    if (!imp) return;
    imp.addEventListener('change', function () {
      var f = imp.files && imp.files[0];
      if (!f) return;
      var fr = new FileReader();
      fr.onload = function () {
        var datos;
        try { datos = JSON.parse(String(fr.result)); }
        catch (e) { Dialogo.avisar('El archivo no es un JSON válido', 'error'); return; }
        Promise.resolve(Gestor.importarTodo(datos)).then(function (r) {
          Dialogo.avisar(r.error || 'Datos importados', r.error ? 'error' : 'ok');
          if (r.avisos && r.avisos.length) {
            Dialogo.informar({ titulo: 'Importación terminada', texto: r.avisos.map(R.escapar).join('<br>') });
          }
          if (!r.error) recargarVista();
        });
        imp.value = '';
      };
      fr.readAsText(f, 'utf-8');
    });
  }

  return {
    entrar: entrar, cambiarClave: cambiarClave, panel: panel, portafolios: portafolios, agenda: agenda,
    eos: eos, admin: admin, aprender: aprender,
    herramientas: herramientas, artefactos: artefactos,
    calendario: calendario, tarjetaProyecto: tarjetaProyecto,
    conectar: conectar, conectarImportacion: conectarImportacion,
    trimestreElegido: null
  };
})();
