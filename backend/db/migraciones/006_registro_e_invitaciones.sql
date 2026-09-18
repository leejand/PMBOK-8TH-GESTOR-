-- ═══════════════════════════════════════════════════════════
-- 006_registro_e_invitaciones.sql — Cuentas propias y equipos por código
-- ───────────────────────────────────────────────────────────
-- Pensado para un aula: cada alumno crea su cuenta, el líder de
-- cada grupo genera un código de invitación y sus compañeros
-- entran con él al proyecto.
--   · usuarios.origen: quién creó la cuenta (administrador,
--     registro propio o importación).
--   · invitaciones: códigos de un proyecto con el rol que dan.
-- ═══════════════════════════════════════════════════════════

ALTER TABLE usuarios ADD COLUMN origen TEXT NOT NULL DEFAULT 'admin'
  CHECK (origen IN ('admin', 'registro', 'importacion'));

CREATE TABLE invitaciones (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  proyecto_id TEXT NOT NULL REFERENCES proyectos (id) ON DELETE CASCADE,
  -- 8 caracteres sin los que se confunden (0/O, 1/I)
  codigo      TEXT NOT NULL CHECK (codigo ~ '^[A-HJ-NP-Z2-9]{8}$'),
  -- «lider» nunca se regala con un código: lo concede el líder a mano
  rol         TEXT NOT NULL DEFAULT 'equipo' CHECK (rol IN ('po','sm','equipo','ejecutor','observador')),
  expira      TIMESTAMPTZ,
  usos        INTEGER NOT NULL DEFAULT 0 CHECK (usos >= 0),
  creado_por  TEXT REFERENCES usuarios (id) ON DELETE SET NULL,
  creado      TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado TIMESTAMPTZ,
  CONSTRAINT invitaciones_codigo_uk UNIQUE (codigo)
);
CREATE INDEX invitaciones_proyecto_ix ON invitaciones (proyecto_id);

CREATE TRIGGER invitaciones_actualizado_tg BEFORE UPDATE ON invitaciones
  FOR EACH ROW EXECUTE FUNCTION fijar_actualizado();
