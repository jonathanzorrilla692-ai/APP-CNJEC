-- Disciplinas de Educación Media con dos etapas. No convierte resultados históricos.
BEGIN;
CREATE FUNCTION public.nota_etapa_media(e jsonb) RETURNS integer
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE modo text; n numeric; puntos numeric; maximo numeric; c2 integer; c3 numeric; c4 numeric; c5 numeric;
BEGIN
  IF e IS NULL OR jsonb_typeof(e) <> 'object' OR
     COALESCE(jsonb_typeof(e->'proceso'),'') <> 'string' OR length(e->>'proceso') > 2000 THEN
    RAISE EXCEPTION 'Etapa inválida: faltan los datos del proceso.';
  END IF;
  modo := e->>'modo';
  IF modo = 'NOTA' THEN
    IF NOT (e ? 'nota') THEN RAISE EXCEPTION 'Falta la nota de etapa.'; END IF;
    IF e->'nota' = 'null'::jsonb THEN RETURN NULL; END IF;
    IF jsonb_typeof(e->'nota') <> 'number' THEN RAISE EXCEPTION 'Nota inválida.'; END IF;
    n := (e->>'nota')::numeric;
    IF n <> trunc(n) OR n < 1 OR n > 5 THEN RAISE EXCEPTION 'La nota debe ser un entero de 1 a 5.'; END IF;
    RETURN n::integer;
  ELSIF modo = 'PUNTAJE' THEN
    IF COALESCE(jsonb_typeof(e->'maximo'),'') <> 'number' OR
       COALESCE(jsonb_typeof(e->'minimo3'),'') <> 'number' OR
       COALESCE(jsonb_typeof(e->'minimo4'),'') <> 'number' OR
       COALESCE(jsonb_typeof(e->'minimo5'),'') <> 'number' OR NOT (e ? 'puntos') THEN
      RAISE EXCEPTION 'Completá el total y los cortes de la escala.';
    END IF;
    maximo := (e->>'maximo')::numeric;
    c3 := (e->>'minimo3')::numeric; c4 := (e->>'minimo4')::numeric; c5 := (e->>'minimo5')::numeric;
    IF maximo <> trunc(maximo) OR maximo < 10 OR maximo > 100000 THEN RAISE EXCEPTION 'Total inválido.'; END IF;
    c2 := ceil(maximo * 7 / 10)::integer;
    IF c3 <> trunc(c3) OR c4 <> trunc(c4) OR c5 <> trunc(c5) OR NOT (c2 < c3 AND c3 < c4 AND c4 < c5 AND c5 <= maximo) THEN
      RAISE EXCEPTION 'Los cortes deben ser enteros crecientes dentro del total.';
    END IF;
    IF e->'puntos' = 'null'::jsonb THEN RETURN NULL; END IF;
    IF jsonb_typeof(e->'puntos') <> 'number' THEN RAISE EXCEPTION 'Puntaje inválido.'; END IF;
    puntos := (e->>'puntos')::numeric;
    IF puntos <> trunc(puntos) OR puntos < 0 OR puntos > maximo THEN RAISE EXCEPTION 'Puntaje fuera del rango permitido.'; END IF;
    RETURN CASE WHEN puntos >= c5 THEN 5 WHEN puntos >= c4 THEN 4 WHEN puntos >= c3 THEN 3 WHEN puntos >= c2 THEN 2 ELSE 1 END;
  ELSE
    RAISE EXCEPTION 'Forma de carga inválida.';
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.nota_etapa_media(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nota_etapa_media(jsonb) TO authenticated;

CREATE TABLE public.calificaciones_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estudiante_id uuid NOT NULL REFERENCES public.estudiantes(id),
  materia_id uuid NOT NULL REFERENCES public.materias(id),
  anio integer NOT NULL CHECK (anio BETWEEN 2020 AND 2100),
  etapa1 jsonb NOT NULL, etapa2 jsonb NOT NULL,
  nota_etapa1 integer CHECK (nota_etapa1 BETWEEN 1 AND 5),
  nota_etapa2 integer CHECK (nota_etapa2 BETWEEN 1 AND 5),
  promedio numeric CHECK (promedio BETWEEN 1 AND 5),
  nota_final integer CHECK (nota_final BETWEEN 1 AND 5),
  estado text NOT NULL CHECK (estado IN ('PENDIENTE','APROBADO','RECUPERACION')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (estudiante_id, materia_id, anio)
);
CREATE INDEX calificaciones_media_materia_idx ON public.calificaciones_media(materia_id);
CREATE FUNCTION public.calcular_media() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  NEW.nota_etapa1 := public.nota_etapa_media(NEW.etapa1);
  NEW.nota_etapa2 := public.nota_etapa_media(NEW.etapa2);
  NEW.updated_at := now();
  IF TG_OP = 'UPDATE' THEN NEW.created_at := OLD.created_at; ELSE NEW.created_at := now(); END IF;
  NEW.promedio := NULL; NEW.nota_final := NULL; NEW.estado := 'PENDIENTE';
  IF NEW.nota_etapa1 IS NOT NULL AND NEW.nota_etapa2 IS NOT NULL THEN
    NEW.promedio := (NEW.nota_etapa1 + NEW.nota_etapa2)::numeric / 2;
    IF NEW.nota_etapa1 + NEW.nota_etapa2 >= 4 AND NEW.nota_etapa2 >= 2 THEN
      NEW.nota_final := round(NEW.promedio)::integer; NEW.estado := 'APROBADO';
    ELSE
      NEW.nota_final := 1; NEW.estado := 'RECUPERACION';
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.calcular_media() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calcular_media() TO authenticated;
CREATE TRIGGER calcular_media BEFORE INSERT OR UPDATE ON public.calificaciones_media
FOR EACH ROW EXECUTE FUNCTION public.calcular_media();
ALTER TABLE public.calificaciones_media ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.calificaciones_media FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.calificaciones_media TO authenticated;
CREATE POLICY leer_media ON public.calificaciones_media FOR SELECT TO authenticated USING (
  public.rol_actual() IN ('DOCENTE','DIRECTIVO') OR EXISTS (
    SELECT 1 FROM public.estudiantes e WHERE e.id = estudiante_id AND (e.tutor_id = auth.uid() OR e.id_link = auth.uid())
  )
);
CREATE POLICY crear_media ON public.calificaciones_media FOR INSERT TO authenticated
WITH CHECK (public.rol_actual() IN ('DOCENTE','DIRECTIVO'));
CREATE POLICY editar_media ON public.calificaciones_media FOR UPDATE TO authenticated
USING (public.rol_actual() IN ('DOCENTE','DIRECTIVO')) WITH CHECK (public.rol_actual() IN ('DOCENTE','DIRECTIVO'));
-- Se conservan valores y permisos de lectura del historial; ningún cliente puede seguir escribiendo el modelo anterior.
REVOKE INSERT, UPDATE, DELETE ON public.calificaciones_etapas, public.politicas_academicas FROM authenticated, anon, PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.calificaciones_media;
  END IF;
END $$;
NOTIFY pgrst, 'reload schema';
COMMIT;
