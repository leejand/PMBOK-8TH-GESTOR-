-- ═══════════════════════════════════════════════════════════
-- 005_codigo_de_recuperacion.sql — Recuperar la propia contraseña
-- ───────────────────────────────────────────────────────────
-- El gestor no envía correos: cada persona recibe un código de
-- recuperación al elegir su contraseña y lo guarda donde quiera.
-- Con él puede elegir otra contraseña sin ayuda. Solo se guarda su
-- huella (bcrypt), sirve una vez y al usarlo se entrega uno nuevo.
-- ═══════════════════════════════════════════════════════════

ALTER TABLE usuarios
  ADD COLUMN recuperacion_hash    TEXT,
  ADD COLUMN recuperacion_creado  TIMESTAMPTZ;
