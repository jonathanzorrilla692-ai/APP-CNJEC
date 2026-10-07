/*
# Colegio Nacional Juan Eudoro Cáceres — Platform Schema

## Overview
Creates the complete database schema for the school attendance and grades platform.
Users authenticate with Supabase email/password but log in using their Cédula de Identidad (C.I.).
Roles: TUTOR (parent), DOCENTE (teacher), DIRECTIVO (school leadership).

## Tables

1. **usuarios** — Extended user profiles linked to auth.users
   - id (uuid, FK to auth.users, PK)
   - ci (text, unique) — Cédula de Identidad used for login
   - nombre_completo (text) — Full name
   - rol (text) — One of 'TUTOR', 'DOCENTE', 'DIRECTIVO'
   - telefono (text) — Phone number for WhatsApp notifications
   - created_at (timestamptz)

2. **estudiantes** — Student records
   - id (uuid, PK)
   - ci (text, unique) — Student's C.I. (used in QR code)
   - nombre_completo (text)
   - curso (text) — e.g. "1° Bachillerato A"
   - foto_url (text) — Student photo URL
   - tutor_id (uuid, FK to usuarios) — Parent/guardian
   - created_at (timestamptz)

3. **calificaciones** — Grades per subject
   - id (uuid, PK)
   - estudiante_id (uuid, FK to estudiantes)
   - materia (text) — Subject name
   - parcial1 (numeric) — First partial grade
   - parcial2 (numeric) — Second partial grade
   - parcial3 (numeric) — Third partial grade
   - examen_final (numeric) — Final exam grade
   - promedio (numeric) — Computed average
   - periodo (text) — e.g. "2026 Trimestre 1"
   - created_at (timestamptz)

4. **asistencia** — Attendance records per QR scan
   - id (uuid, PK)
   - estudiante_id (uuid, FK to estudiantes)
   - fecha (date) — Date of attendance
   - hora (time) — Time of scan
   - estado (text) — 'PRESENTE' or 'TARDANZA'
   - registrado_por (uuid, FK to usuarios) — Teacher who scanned
   - created_at (timestamptz)

5. **comunicados** — Institutional announcements
   - id (uuid, PK)
   - titulo (text)
   - contenido (text)
   - etiqueta (text) — 'REUNION', 'EXAMENES', 'SALIDAS', 'GENERAL'
   - autor (text) — Who published it
   - fecha (timestamptz)
   - created_at (timestamptz)

## Security
- RLS enabled on all tables.
- Users can read their own usuario profile.
- Tutors can read their own students and those students' grades/attendance.
- Teachers/directivos can read all students, grades, attendance.
- All authenticated users can read comunicados.
- Teachers/directivos can insert attendance records.
- All inserts use DEFAULT auth.uid() where applicable.
*/

-- ============================================
-- usuarios table
-- ============================================
CREATE TABLE IF NOT EXISTS usuarios (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  ci text UNIQUE NOT NULL,
  nombre_completo text NOT NULL,
  rol text NOT NULL CHECK (rol IN ('TUTOR', 'DOCENTE', 'DIRECTIVO')),
  telefono text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_usuario" ON usuarios;
CREATE POLICY "select_own_usuario" ON usuarios FOR SELECT
TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_usuario" ON usuarios;
CREATE POLICY "update_own_usuario" ON usuarios FOR UPDATE
TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ============================================
-- estudiantes table
-- ============================================
CREATE TABLE IF NOT EXISTS estudiantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ci text UNIQUE NOT NULL,
  nombre_completo text NOT NULL,
  curso text NOT NULL,
  foto_url text,
  tutor_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE estudiantes ENABLE ROW LEVEL SECURITY;

-- Tutors see their own children; teachers/directivos see all
DROP POLICY IF EXISTS "select_estudiantes" ON estudiantes;
CREATE POLICY "select_estudiantes" ON estudiantes FOR SELECT
TO authenticated USING (
  tutor_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.id = auth.uid() AND u.rol IN ('DOCENTE', 'DIRECTIVO')
  )
);

-- Teachers/directivos can insert/update students
DROP POLICY IF EXISTS "insert_estudiantes" ON estudiantes;
CREATE POLICY "insert_estudiantes" ON estudiantes FOR INSERT
TO authenticated WITH CHECK (
  EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.id = auth.uid() AND u.rol IN ('DOCENTE', 'DIRECTIVO')
  )
);

DROP POLICY IF EXISTS "update_estudiantes" ON estudiantes;
CREATE POLICY "update_estudiantes" ON estudiantes FOR UPDATE
TO authenticated USING (
  EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.id = auth.uid() AND u.rol IN ('DOCENTE', 'DIRECTIVO')
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.id = auth.uid() AND u.rol IN ('DOCENTE', 'DIRECTIVO')
  )
);

-- ============================================
-- calificaciones table
-- ============================================
CREATE TABLE IF NOT EXISTS calificaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estudiante_id uuid NOT NULL REFERENCES estudiantes(id) ON DELETE CASCADE,
  materia text NOT NULL,
  parcial1 numeric DEFAULT 0,
  parcial2 numeric DEFAULT 0,
  parcial3 numeric DEFAULT 0,
  examen_final numeric DEFAULT 0,
  promedio numeric DEFAULT 0,
  periodo text NOT NULL DEFAULT '2026 Trimestre 1',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE calificaciones ENABLE ROW LEVEL SECURITY;

-- Tutors see grades for their children; teachers/directivos see all
DROP POLICY IF EXISTS "select_calificaciones" ON calificaciones;
CREATE POLICY "select_calificaciones" ON calificaciones FOR SELECT
TO authenticated USING (
  EXISTS (
    SELECT 1 FROM estudiantes e
    WHERE e.id = calificaciones.estudiante_id
    AND e.tutor_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.id = auth.uid() AND u.rol IN ('DOCENTE', 'DIRECTIVO')
  )
);

-- Teachers/directivos can insert/update grades
DROP POLICY IF EXISTS "insert_calificaciones" ON calificaciones;
CREATE POLICY "insert_calificaciones" ON calificaciones FOR INSERT
TO authenticated WITH CHECK (
  EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.id = auth.uid() AND u.rol IN ('DOCENTE', 'DIRECTIVO')
  )
);

DROP POLICY IF EXISTS "update_calificaciones" ON calificaciones;
CREATE POLICY "update_calificaciones" ON calificaciones FOR UPDATE
TO authenticated USING (
  EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.id = auth.uid() AND u.rol IN ('DOCENTE', 'DIRECTIVO')
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.id = auth.uid() AND u.rol IN ('DOCENTE', 'DIRECTIVO')
  )
);

-- ============================================
-- asistencia table
-- ============================================
CREATE TABLE IF NOT EXISTS asistencia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estudiante_id uuid NOT NULL REFERENCES estudiantes(id) ON DELETE CASCADE,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  hora time NOT NULL DEFAULT CURRENT_TIME,
  estado text NOT NULL CHECK (estado IN ('PRESENTE', 'TARDANZA')),
  registrado_por uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE asistencia ENABLE ROW LEVEL SECURITY;

-- Tutors see attendance for their children; teachers/directivos see all
DROP POLICY IF EXISTS "select_asistencia" ON asistencia;
CREATE POLICY "select_asistencia" ON asistencia FOR SELECT
TO authenticated USING (
  EXISTS (
    SELECT 1 FROM estudiantes e
    WHERE e.id = asistencia.estudiante_id
    AND e.tutor_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.id = auth.uid() AND u.rol IN ('DOCENTE', 'DIRECTIVO')
  )
);

-- Teachers/directivos can insert attendance records
DROP POLICY IF EXISTS "insert_asistencia" ON asistencia;
CREATE POLICY "insert_asistencia" ON asistencia FOR INSERT
TO authenticated WITH CHECK (
  EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.id = auth.uid() AND u.rol IN ('DOCENTE', 'DIRECTIVO')
  )
);

-- ============================================
-- comunicados table
-- ============================================
CREATE TABLE IF NOT EXISTS comunicados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  contenido text NOT NULL,
  etiqueta text NOT NULL CHECK (etiqueta IN ('REUNION', 'EXAMENES', 'SALIDAS', 'GENERAL')),
  autor text NOT NULL,
  fecha timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE comunicados ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read comunicados
DROP POLICY IF EXISTS "select_comunicados" ON comunicados;
CREATE POLICY "select_comunicados" ON comunicados FOR SELECT
TO authenticated USING (true);

-- Teachers/directivos can insert comunicados
DROP POLICY IF EXISTS "insert_comunicados" ON comunicados;
CREATE POLICY "insert_comunicados" ON comunicados FOR INSERT
TO authenticated WITH CHECK (
  EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.id = auth.uid() AND u.rol IN ('DOCENTE', 'DIRECTIVO')
  )
);

-- ============================================
-- Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_estudiantes_tutor ON estudiantes(tutor_id);
CREATE INDEX IF NOT EXISTS idx_calificaciones_estudiante ON calificaciones(estudiante_id);
CREATE INDEX IF NOT EXISTS idx_asistencia_estudiante ON asistencia(estudiante_id);
CREATE INDEX IF NOT EXISTS idx_asistencia_fecha ON asistencia(fecha);
CREATE INDEX IF NOT EXISTS idx_comunicados_etiqueta ON comunicados(etiqueta);
CREATE INDEX IF NOT EXISTS idx_comunicados_fecha ON comunicados(fecha);
