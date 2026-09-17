/* ═══════════════════════════════════════════════════════════
   cambios.js — Marca de cambios para el refresco automático
   ───────────────────────────────────────────────────────────
   Cada escritura que la API acepta avanza una marca. La interfaz
   pregunta cada pocos segundos por ella (GET /api/cambios) y, si no
   coincide con la que conoce, vuelve a cargar lo que puede ver. Así
   los cambios de otras personas aparecen sin recargar la página.
   Cada respuesta de escritura lleva X-Marca-Anterior y X-Marca: si
   la anterior es la que la interfaz conocía, el cambio fue solo el
   suyo y no hace falta recargar.
   La marca empieza en un valor aleatorio en cada arranque, así un
   reinicio del servidor también provoca una recarga.
   ═══════════════════════════════════════════════════════════ */

'use strict';

const crypto = require('crypto');

const instancia = crypto.randomBytes(4).toString('hex');
let contador = 0;

const ESCRITURAS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
/* Entrar, salir y las contraseñas no cambian datos compartidos */
const SIN_EFECTO = /^\/api\/auth\//;

function marca() {
  return instancia + '.' + contador;
}

/* Middleware: avanza la marca al enviar la respuesta de una escritura aceptada */
function registrar(req, res, next) {
  if (!ESCRITURAS.has(req.method) || SIN_EFECTO.test(req.originalUrl.split('?')[0])) return next();
  const original = res.writeHead;
  res.writeHead = function (estado, ...resto) {
    const codigo = typeof estado === 'number' ? estado : res.statusCode;
    if (codigo < 400 && !res.headersSent) {
      const anterior = marca();
      contador++;
      res.setHeader('X-Marca-Anterior', anterior);
      res.setHeader('X-Marca', marca());
    }
    return original.call(this, estado, ...resto);
  };
  next();
}

module.exports = { marca, registrar };
