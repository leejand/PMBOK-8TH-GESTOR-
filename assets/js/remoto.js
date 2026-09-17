/* ═══════════════════════════════════════════════════════════
   remoto.js — Cola de escrituras hacia el servidor
   ───────────────────────────────────────────────────────────
   En modo servidor, cada cambio se aplica al instante en la copia
   en memoria (la pantalla no espera) y se envía aquí a la API.
   · Las peticiones salen en orden, una detrás de otra: crear una
     tarea y moverla al sprint llegan en ese orden.
   · Ediciones seguidas del mismo campo (escribir en un documento)
     se agrupan en una sola petición mientras no haya salido. Su
     «$antes» (lo que había en el servidor) es el de la primera.
   · Si una falla, se avisa y el gestor recarga el estado real.
   ═══════════════════════════════════════════════════════════ */

window.Remoto = (function () {
  'use strict';

  var cola = Promise.resolve();
  var ultima = null;
  var pendientes = 0;
  var escrituras = 0;
  var alError = null;
  var observadores = [];

  function notificar() {
    observadores.slice().forEach(function (fn) {
      try { fn(pendientes); } catch (e) { /* un observador roto no frena la cola */ }
    });
  }

  function vacio() {}

  /* Serializa fn() tras lo ya encolado. La promesa devuelta falla si fn falla. */
  function enCola(fn) {
    pendientes++;
    escrituras++;
    notificar();
    ultima = null;
    var p = cola.then(fn);
    cola = p.then(vacio, vacio);
    return p.then(function (r) {
      pendientes--; notificar();
      return r;
    }, function (err) {
      pendientes--; notificar();
      throw err;
    });
  }

  /* opc: { metodo, ruta, cuerpo, clave?, fusion: 'mezclar'|'reemplazar', despues?, descripcion? }
     Nunca rechaza: los errores van a alError. */
  function enviar(opc) {
    if (opc.clave && ultima && ultima.clave === opc.clave && !ultima.iniciada) {
      escrituras++;
      var antesPrevio = ultima.cuerpo && ultima.cuerpo.$antes;
      if (opc.fusion === 'mezclar') {
        Object.keys(opc.cuerpo || {}).forEach(function (k) { if (k !== '$antes') ultima.cuerpo[k] = opc.cuerpo[k]; });
      } else {
        ultima.cuerpo = copiar(opc.cuerpo);
      }
      var antesNuevo = opc.cuerpo && opc.cuerpo.$antes;
      if (antesPrevio || antesNuevo) ultima.cuerpo.$antes = combinarAntes(antesPrevio, antesNuevo);
      if (opc.despues) ultima.despues = opc.despues;
      if (opc.descripcion) ultima.descripcion = opc.descripcion;
      return ultima.promesa;
    }

    var tarea = {
      clave: opc.clave || null,
      metodo: opc.metodo,
      ruta: opc.ruta,
      cuerpo: opc.fusion === 'mezclar' ? copiar(opc.cuerpo) : opc.cuerpo,
      despues: opc.despues || null,
      descripcion: opc.descripcion || '',
      iniciada: false
    };

    tarea.promesa = enCola(function () {
      tarea.iniciada = true;
      return Api.pedir(tarea.metodo, tarea.ruta, tarea.cuerpo).then(function (respuesta) {
        return Promise.resolve(tarea.despues ? tarea.despues(respuesta) : null)
          .then(function () { return respuesta; });
      });
    }).catch(function (err) {
      if (alError) alError(err, tarea.descripcion);
      return undefined;
    });

    ultima = tarea;
    return tarea.promesa;
  }

  function copiar(obj) {
    var r = {};
    Object.keys(obj || {}).forEach(function (k) { r[k] = obj[k]; });
    return r;
  }

  /* Del valor previo de cada campo manda el de la primera edición agrupada */
  function combinarAntes(previo, nuevo) {
    var r = {};
    Object.keys(nuevo || {}).forEach(function (k) { r[k] = nuevo[k]; });
    Object.keys(previo || {}).forEach(function (k) { r[k] = previo[k]; });
    return r;
  }

  /* Se resuelve cuando no queda nada por enviar */
  function esperar() {
    if (!pendientes) return Promise.resolve();
    return new Promise(function (resolver) {
      function vigilar(n) {
        if (n > 0) return;
        observadores.splice(observadores.indexOf(vigilar), 1);
        resolver();
      }
      observadores.push(vigilar);
    });
  }

  /* No cerrar la pestaña con cambios aún en camino */
  window.addEventListener('beforeunload', function (e) {
    if (pendientes > 0) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  return {
    enviar: enviar,
    enCola: enCola,
    esperar: esperar,
    pendientes: function () { return pendientes; },
    /* Cuántas escrituras se han pedido desde que cargó la página */
    escrituras: function () { return escrituras; },
    alError: function (fn) { alError = fn; },
    alCambiarEstado: function (fn) { observadores.push(fn); }
  };
})();
