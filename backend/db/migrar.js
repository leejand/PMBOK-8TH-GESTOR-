/* ═══════════════════════════════════════════════════════════
   migrar.js — Crea la base de datos y aplica las migraciones
   ───────────────────────────────────────────────────────────
   Uso:
     node db/migrar.js              crea la BD si falta y aplica lo pendiente
     node db/migrar.js --reiniciar  borra la BD y la crea de cero

   Cada archivo de db/migraciones se aplica una sola vez, en orden
   alfabético y dentro de una transacción; queda anotado en la
   tabla schema_migraciones.
   ═══════════════════════════════════════════════════════════ */

'use strict';

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const config = require('../src/config');

const DIR = path.join(__dirname, 'migraciones');

async function asegurarBaseDatos({ reiniciar = false } = {}) {
  const nombre = config.bd.database;
  const admin = new Client({ ...config.bd, database: 'postgres' });
  await admin.connect();
  try {
    if (reiniciar) {
      await admin.query(`DROP DATABASE IF EXISTS "${nombre}" WITH (FORCE)`);
    }
    const existe = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [nombre]);
    if (!existe.rowCount) {
      await admin.query(`CREATE DATABASE "${nombre}" ENCODING 'UTF8' TEMPLATE template0`);
      return true;
    }
    return false;
  } finally {
    await admin.end();
  }
}

async function aplicarMigraciones() {
  const cliente = new Client(config.bd);
  await cliente.connect();
  const aplicadas = [];
  try {
    await cliente.query(`CREATE TABLE IF NOT EXISTS schema_migraciones (
      version  TEXT PRIMARY KEY,
      aplicada TIMESTAMPTZ NOT NULL DEFAULT now())`);

    const hechas = new Set((await cliente.query('SELECT version FROM schema_migraciones')).rows
      .map((r) => r.version));
    const archivos = fs.readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();

    for (const archivo of archivos) {
      if (hechas.has(archivo)) continue;
      const sql = fs.readFileSync(path.join(DIR, archivo), 'utf8');
      await cliente.query('BEGIN');
      try {
        await cliente.query(sql);
        await cliente.query('INSERT INTO schema_migraciones (version) VALUES ($1)', [archivo]);
        await cliente.query('COMMIT');
        aplicadas.push(archivo);
      } catch (err) {
        await cliente.query('ROLLBACK');
        err.message = 'Migración ' + archivo + ': ' + err.message;
        throw err;
      }
    }
  } finally {
    await cliente.end();
  }
  return aplicadas;
}

async function migrar(opciones) {
  const creada = await asegurarBaseDatos(opciones);
  const aplicadas = await aplicarMigraciones();
  return { creada, aplicadas };
}

module.exports = { migrar, asegurarBaseDatos, aplicarMigraciones };

if (require.main === module) {
  const reiniciar = process.argv.includes('--reiniciar');
  migrar({ reiniciar })
    .then((r) => {
      console.log('Base de datos «' + config.bd.database + '» ' +
        (reiniciar ? 'reiniciada' : r.creada ? 'creada' : 'ya existía') + '.');
      console.log(r.aplicadas.length
        ? 'Migraciones aplicadas: ' + r.aplicadas.join(', ')
        : 'Sin migraciones pendientes.');
    })
    .catch((err) => {
      console.error('Error al migrar:', err.message);
      process.exitCode = 1;
    });
}
