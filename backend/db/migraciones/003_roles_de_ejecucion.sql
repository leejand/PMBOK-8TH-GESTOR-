-- ═══════════════════════════════════════════════════════════
-- 003_roles_de_ejecucion.sql — Nivel «ejecutar» y observadores
-- ───────────────────────────────────────────────────────────
-- Nueva escala del acceso efectivo a un proyecto:
--   0 sin acceso · 1 ejecutar · 2 ver · 3 editar · 4 dirigir
-- «Ejecutar» es lo que promete el rol de ejecutor: ve el proyecto,
-- sus propias tareas y la conversación, mueve sus tareas y comenta,
-- pero no ve ni edita los planes. Dentro del equipo:
--   líder → dirigir · PO, SM y equipo → editar
--   observador → ver · ejecutor → ejecutar
-- Una cuenta con el rol general «ejecutor» nunca pasa de ejecutar,
-- aunque tenga otros permisos o dirija el proyecto.
-- ═══════════════════════════════════════════════════════════

ALTER TABLE permisos DROP CONSTRAINT permisos_nivel_check;
ALTER TABLE permisos ADD CONSTRAINT permisos_nivel_check
  CHECK (nivel IN ('ejecutar','ver','editar','dirigir'));

CREATE OR REPLACE FUNCTION nivel_en(p_proyecto TEXT, p_usuario TEXT) RETURNS INTEGER
LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN u.id IS NULL OR NOT u.activo THEN 0
    WHEN u.rol = 'admin' THEN 4
    WHEN p.id IS NULL THEN 0
    ELSE (
      SELECT CASE WHEN u.rol = 'ejecutor' THEN LEAST(b.nivel, 1) ELSE b.nivel END
      FROM (SELECT GREATEST(
        CASE WHEN p.director_id = u.id THEN 4 ELSE 0 END,
        COALESCE((
          SELECT max(CASE pe.nivel WHEN 'ejecutar' THEN 1 WHEN 'ver' THEN 2
                                   WHEN 'editar' THEN 3 WHEN 'dirigir' THEN 4 END)
          FROM permisos pe
          WHERE pe.usuario_id = u.id AND (
               (pe.ambito = 'proyecto'   AND pe.ref_id = p.id)
            OR (pe.ambito = 'programa'   AND pe.ref_id = p.programa_id)
            OR (pe.ambito = 'portafolio' AND pe.ref_id = p.portafolio_id))
        ), 0),
        COALESCE((
          SELECT max(CASE m.rol WHEN 'lider' THEN 4 WHEN 'observador' THEN 2
                                WHEN 'ejecutor' THEN 1 ELSE 3 END)
          FROM miembros m
          WHERE m.proyecto_id = p.id AND m.usuario_id = u.id
        ), 0)
      ) AS nivel) b
    )
  END
  FROM (SELECT 1) AS uno
  LEFT JOIN usuarios u ON u.id = p_usuario
  LEFT JOIN proyectos p ON p.id = p_proyecto;
$$;

-- Lo que consulta un ejecutor: sus tareas y los hilos de comentarios
CREATE INDEX tareas_responsable_ix ON tareas (responsable_id);
CREATE INDEX comentarios_ref_ix ON comentarios (proyecto_id, ref_tipo, ref_id);
