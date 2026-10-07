/*
# Add ESTUDIANTE role to usuarios table

## Changes
1. Modified `usuarios` table: expand `rol` CHECK constraint to include 'ESTUDIANTE'
2. RLS policy changes: allow students to read their own calificaciones and asistencia
   by linking through the `estudiantes` table where `estudiantes.id_link` = `usuarios.id`
3. New column on `estudiantes`: `id_link uuid` — links student auth user to their student record
4. Allow students to read their own comunicados (already public to authenticated)

## Notes
- ESTUDIANTE users log in with their own C.I. and see their "Mi Carnet Digital" view
- The `id_link` column connects the auth user (with rol='ESTUDIANTE') to their student record
- Students can read their own grades and attendance via this link
*/

-- Drop old check constraint and add new one with ESTUDIANTE
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_rol_check CHECK (rol IN ('TUTOR', 'DOCENTE', 'DIRECTIVO', 'ESTUDIANTE'));

-- Add id_link column to estudiantes for student auth user linkage
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'estudiantes' AND column_name = 'id_link'
  ) THEN
    ALTER TABLE estudiantes ADD COLUMN id_link uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Update select policy for calificaciones: allow students linked via id_link
DROP POLICY IF EXISTS "select_calificaciones" ON calificaciones;
CREATE POLICY "select_calificaciones" ON calificaciones FOR SELECT
TO authenticated USING (
  EXISTS (
    SELECT 1 FROM estudiantes e
    WHERE e.id = calificaciones.estudiante_id
    AND (e.tutor_id = auth.uid() OR e.id_link = auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.id = auth.uid() AND u.rol IN ('DOCENTE', 'DIRECTIVO')
  )
);

-- Update select policy for asistencia: allow students linked via id_link
DROP POLICY IF EXISTS "select_asistencia" ON asistencia;
CREATE POLICY "select_asistencia" ON asistencia FOR SELECT
TO authenticated USING (
  EXISTS (
    SELECT 1 FROM estudiantes e
    WHERE e.id = asistencia.estudiante_id
    AND (e.tutor_id = auth.uid() OR e.id_link = auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.id = auth.uid() AND u.rol IN ('DOCENTE', 'DIRECTIVO')
  )
);

-- Update select policy for estudiantes: allow students to see their own record
DROP POLICY IF EXISTS "select_estudiantes" ON estudiantes;
CREATE POLICY "select_estudiantes" ON estudiantes FOR SELECT
TO authenticated USING (
  tutor_id = auth.uid()
  OR id_link = auth.uid()
  OR EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.id = auth.uid() AND u.rol IN ('DOCENTE', 'DIRECTIVO')
  )
);

-- Create index on id_link
CREATE INDEX IF NOT EXISTS idx_estudiantes_id_link ON estudiantes(id_link);
