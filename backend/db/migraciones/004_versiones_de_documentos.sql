-- ═══════════════════════════════════════════════════════════
-- 004_versiones_de_documentos.sql — Historial de cada documento
-- ───────────────────────────────────────────────────────────
-- Abrir una versión nueva guarda antes una copia completa de la
-- que se cierra: su contenido, nombre, estado y aprobación. Así una
-- versión aprobada se puede consultar, descargar o restaurar aunque
-- el documento siga cambiando.
-- ═══════════════════════════════════════════════════════════

CREATE TABLE documento_versiones (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  proyecto_id  TEXT NOT NULL REFERENCES proyectos (id) ON DELETE CASCADE,
  documento_id TEXT NOT NULL REFERENCES documentos (id) ON DELETE CASCADE,
  version      INTEGER NOT NULL CHECK (version >= 1),
  nombre       TEXT NOT NULL,
  estado       TEXT NOT NULL CHECK (estado IN ('borrador','revision','aprobado')),
  contenido    JSONB NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(contenido) = 'object'),
  aprobado     TIMESTAMPTZ,
  -- Quién cerró la versión (abrió la siguiente)
  autor_id     TEXT REFERENCES usuarios (id) ON DELETE SET NULL,
  creado       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT documento_versiones_uk UNIQUE (documento_id, version)
);
CREATE INDEX documento_versiones_proyecto_ix ON documento_versiones (proyecto_id);
