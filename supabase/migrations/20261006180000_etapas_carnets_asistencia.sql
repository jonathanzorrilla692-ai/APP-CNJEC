-- Modelo de dos etapas. Ejecutar después de las dos migraciones originales.
-- No convierte notas históricas a una fórmula nueva ni elimina registros.
BEGIN;

ALTER TABLE public.usuarios DROP CONSTRAINT usuarios_rol_check;
ALTER TABLE public.usuarios ADD CONSTRAINT usuarios_rol_check
  CHECK (rol IN ('TUTOR','DOCENTE','DIRECTIVO','ESTUDIANTE','PRECEPTOR'));
ALTER TABLE public.estudiantes ADD COLUMN especialidad text;

-- Evita que un usuario eleve su propio rol desde el navegador.
REVOKE UPDATE ON public.usuarios FROM authenticated;
GRANT UPDATE (nombre_completo, telefono) ON public.usuarios TO authenticated;

CREATE FUNCTION public.rol_actual() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = '' AS $$
  SELECT rol FROM public.usuarios WHERE id = auth.uid()
$$;
REVOKE ALL ON FUNCTION public.rol_actual() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rol_actual() TO authenticated;

DROP POLICY select_estudiantes ON public.estudiantes;
CREATE POLICY select_estudiantes ON public.estudiantes FOR SELECT TO authenticated USING (
  tutor_id = auth.uid() OR id_link = auth.uid()
  OR public.rol_actual() IN ('DOCENTE','DIRECTIVO','PRECEPTOR')
);

CREATE TABLE public.materias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL UNIQUE CHECK (length(trim(nombre)) > 0)
);
INSERT INTO public.materias (nombre)
SELECT DISTINCT trim(materia) FROM public.calificaciones WHERE length(trim(materia)) > 0
ON CONFLICT DO NOTHING;
INSERT INTO public.materias (nombre) VALUES
 ('Matemática'),('Lengua Castellana'),('Guaraní'),('Ciencias Naturales'),
 ('Historia y Geografía'),('Inglés'),('Educación Física'),('Informática')
ON CONFLICT DO NOTHING;
ALTER TABLE public.materias ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.materias TO authenticated;
CREATE POLICY leer_materias ON public.materias FOR SELECT TO authenticated USING (true);

CREATE TABLE public.politicas_academicas (
  anio integer PRIMARY KEY CHECK (anio BETWEEN 2020 AND 2100),
  peso_etapa1 numeric NOT NULL CHECK (peso_etapa1 > 0),
  peso_etapa2 numeric NOT NULL CHECK (peso_etapa2 > 0),
  peso_proceso numeric NOT NULL CHECK (peso_proceso > 0),
  minimo2 numeric NOT NULL, minimo3 numeric NOT NULL,
  minimo4 numeric NOT NULL, minimo5 numeric NOT NULL,
  confirmada boolean NOT NULL DEFAULT false,
  CHECK (peso_etapa1 + peso_etapa2 + peso_proceso = 100),
  CHECK (0 < minimo2 AND minimo2 < minimo3 AND minimo3 < minimo4 AND minimo4 < minimo5 AND minimo5 <= 100)
);
ALTER TABLE public.politicas_academicas ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.politicas_academicas TO authenticated;
CREATE POLICY leer_politica ON public.politicas_academicas FOR SELECT TO authenticated USING (true);
CREATE POLICY crear_politica ON public.politicas_academicas FOR INSERT TO authenticated
  WITH CHECK (public.rol_actual() = 'DIRECTIVO');
CREATE POLICY editar_politica ON public.politicas_academicas FOR UPDATE TO authenticated
  USING (public.rol_actual() = 'DIRECTIVO') WITH CHECK (public.rol_actual() = 'DIRECTIVO');

CREATE TABLE public.calificaciones_etapas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estudiante_id uuid NOT NULL REFERENCES public.estudiantes(id),
  materia_id uuid NOT NULL REFERENCES public.materias(id),
  anio integer NOT NULL REFERENCES public.politicas_academicas(anio),
  etapa1_puntos numeric, etapa1_maximo numeric NOT NULL DEFAULT 100,
  etapa2_puntos numeric, etapa2_maximo numeric NOT NULL DEFAULT 100,
  proceso_puntos numeric, proceso_maximo numeric NOT NULL DEFAULT 100,
  promedio numeric, nota_final integer CHECK (nota_final BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (estudiante_id, materia_id, anio),
  CHECK (etapa1_maximo > 0 AND etapa1_maximo <= 100000 AND (etapa1_puntos IS NULL OR etapa1_puntos BETWEEN 0 AND etapa1_maximo)),
  CHECK (etapa2_maximo > 0 AND etapa2_maximo <= 100000 AND (etapa2_puntos IS NULL OR etapa2_puntos BETWEEN 0 AND etapa2_maximo)),
  CHECK (proceso_maximo > 0 AND proceso_maximo <= 100000 AND (proceso_puntos IS NULL OR proceso_puntos BETWEEN 0 AND proceso_maximo))
);
CREATE FUNCTION public.calcular_calificacion() RETURNS trigger LANGUAGE plpgsql
SET search_path = '' AS $$
DECLARE p public.politicas_academicas%ROWTYPE;
BEGIN
  SELECT * INTO p FROM public.politicas_academicas WHERE anio = NEW.anio;
  IF NOT FOUND OR NOT p.confirmada THEN RAISE EXCEPTION 'El directivo debe confirmar la escala del año lectivo.'; END IF;
  NEW.updated_at := now();
  IF NEW.etapa1_puntos IS NULL OR NEW.etapa2_puntos IS NULL OR NEW.proceso_puntos IS NULL THEN
    NEW.promedio := NULL; NEW.nota_final := NULL;
  ELSE
    NEW.promedio := round(
      NEW.etapa1_puntos / NULLIF(NEW.etapa1_maximo,0) * p.peso_etapa1 +
      NEW.etapa2_puntos / NULLIF(NEW.etapa2_maximo,0) * p.peso_etapa2 +
      NEW.proceso_puntos / NULLIF(NEW.proceso_maximo,0) * p.peso_proceso, 2);
    NEW.nota_final := CASE WHEN NEW.promedio >= p.minimo5 THEN 5
      WHEN NEW.promedio >= p.minimo4 THEN 4 WHEN NEW.promedio >= p.minimo3 THEN 3
      WHEN NEW.promedio >= p.minimo2 THEN 2 ELSE 1 END;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER calcular_calificacion BEFORE INSERT OR UPDATE ON public.calificaciones_etapas
FOR EACH ROW EXECUTE FUNCTION public.calcular_calificacion();

-- La escala confirmada queda fija para garantizar resultados estables.
-- Una corrección excepcional requiere intervención administrativa y recálculo.
CREATE FUNCTION public.bloquear_escala_confirmada() RETURNS trigger LANGUAGE plpgsql
SET search_path = '' AS $$
BEGIN
  IF OLD.confirmada AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'La escala ya fue confirmada. No se puede cambiar desde la aplicación.';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER bloquear_escala BEFORE UPDATE ON public.politicas_academicas
FOR EACH ROW EXECUTE FUNCTION public.bloquear_escala_confirmada();

ALTER TABLE public.calificaciones_etapas ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.calificaciones_etapas TO authenticated;
CREATE POLICY leer_notas ON public.calificaciones_etapas FOR SELECT TO authenticated USING (
  public.rol_actual() IN ('DOCENTE','DIRECTIVO') OR EXISTS (
    SELECT 1 FROM public.estudiantes e WHERE e.id = estudiante_id
      AND (e.tutor_id = auth.uid() OR e.id_link = auth.uid())
  )
);
CREATE POLICY crear_notas ON public.calificaciones_etapas FOR INSERT TO authenticated
  WITH CHECK (public.rol_actual() IN ('DOCENTE','DIRECTIVO'));
CREATE POLICY editar_notas ON public.calificaciones_etapas FOR UPDATE TO authenticated
  USING (public.rol_actual() IN ('DOCENTE','DIRECTIVO'))
  WITH CHECK (public.rol_actual() IN ('DOCENTE','DIRECTIVO'));

-- Las planillas previas quedan conservadas solo como historial.
REVOKE INSERT, UPDATE, DELETE ON public.calificaciones FROM authenticated;

CREATE TABLE public.asistencia_diaria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estudiante_id uuid NOT NULL REFERENCES public.estudiantes(id),
  fecha date NOT NULL,
  hora time NOT NULL,
  estado text NOT NULL CHECK (estado IN ('PRESENTE','AUSENTE','TARDANZA')),
  registrado_por uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (estudiante_id, fecha)
);
-- Si existían duplicados, usa el último registro; los originales se conservan.
INSERT INTO public.asistencia_diaria (estudiante_id, fecha, hora, estado, registrado_por, created_at, updated_at)
SELECT DISTINCT ON (estudiante_id, fecha) estudiante_id, fecha, hora, estado, registrado_por,
  COALESCE(created_at, now()), COALESCE(created_at, now())
FROM public.asistencia ORDER BY estudiante_id, fecha, created_at DESC NULLS LAST, id DESC;
ALTER TABLE public.asistencia_diaria ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.asistencia_diaria FROM anon, authenticated;
GRANT SELECT ON public.asistencia_diaria TO authenticated;
CREATE POLICY leer_asistencia_diaria ON public.asistencia_diaria FOR SELECT TO authenticated USING (
  public.rol_actual() IN ('DOCENTE','DIRECTIVO','PRECEPTOR') OR EXISTS (
    SELECT 1 FROM public.estudiantes e WHERE e.id = estudiante_id
      AND (e.tutor_id = auth.uid() OR e.id_link = auth.uid())
  )
);
REVOKE INSERT, UPDATE, DELETE ON public.asistencia FROM authenticated;

CREATE FUNCTION public.registrar_asistencia(p_estudiante_id uuid, p_estado text)
RETURNS public.asistencia_diaria LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  resultado public.asistencia_diaria%ROWTYPE;
  fecha_hora timestamp := clock_timestamp() AT TIME ZONE 'America/Asuncion';
BEGIN
  IF auth.uid() IS NULL OR COALESCE(public.rol_actual(), '') NOT IN ('DOCENTE','DIRECTIVO','PRECEPTOR') THEN
    RAISE EXCEPTION 'No tiene permiso para registrar asistencia.' USING ERRCODE = '42501';
  END IF;
  IF p_estado IS NULL OR p_estado NOT IN ('PRESENTE','AUSENTE','TARDANZA') THEN
    RAISE EXCEPTION 'Estado de asistencia inválido.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.estudiantes WHERE id = p_estudiante_id) THEN
    RAISE EXCEPTION 'Estudiante no encontrado.';
  END IF;
  INSERT INTO public.asistencia_diaria AS a (estudiante_id, fecha, hora, estado, registrado_por)
  VALUES (p_estudiante_id, fecha_hora::date, fecha_hora::time, p_estado, auth.uid())
  ON CONFLICT (estudiante_id, fecha) DO UPDATE SET
    hora = CASE WHEN a.estado = EXCLUDED.estado THEN a.hora ELSE EXCLUDED.hora END,
    estado = EXCLUDED.estado,
    registrado_por = CASE WHEN a.estado = EXCLUDED.estado THEN a.registrado_por ELSE EXCLUDED.registrado_por END,
    updated_at = CASE WHEN a.estado = EXCLUDED.estado THEN a.updated_at ELSE now() END
  RETURNING * INTO resultado;
  RETURN resultado;
END $$;
REVOKE ALL ON FUNCTION public.registrar_asistencia(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_asistencia(uuid,text) TO authenticated;

-- No habilitar Realtime para historiales o datos no utilizados.
DO $$
DECLARE tabla text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH tabla IN ARRAY ARRAY['asistencia_diaria','calificaciones_etapas'] LOOP
      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public' AND tablename = tabla) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tabla);
      END IF;
    END LOOP;
  END IF;
END $$;
NOTIFY pgrst, 'reload schema';
COMMIT;
