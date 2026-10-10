-- Requiere 20261006180000_etapas_carnets_asistencia.sql.
-- Completa administración y publicación. No elimina registros.
BEGIN;

DROP POLICY insert_estudiantes ON public.estudiantes;
CREATE POLICY insert_estudiantes ON public.estudiantes FOR INSERT TO authenticated
WITH CHECK (public.rol_actual() = 'DIRECTIVO');
DROP POLICY update_estudiantes ON public.estudiantes;
CREATE POLICY update_estudiantes ON public.estudiantes FOR UPDATE TO authenticated
USING (public.rol_actual() = 'DIRECTIVO') WITH CHECK (public.rol_actual() = 'DIRECTIVO');

CREATE FUNCTION public.validar_ficha_estudiante() RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  NEW.ci := trim(NEW.ci); NEW.nombre_completo := trim(NEW.nombre_completo); NEW.curso := trim(NEW.curso);
  NEW.especialidad := nullif(trim(NEW.especialidad),''); NEW.foto_url := nullif(trim(NEW.foto_url),'');
  IF NEW.ci !~ '^[0-9]{3,15}$' OR length(NEW.nombre_completo) NOT BETWEEN 3 AND 150
    OR length(NEW.curso) NOT BETWEEN 1 AND 100 OR length(NEW.especialidad) > 150 THEN
    RAISE EXCEPTION 'Datos del estudiante inválidos.';
  END IF;
  IF NEW.foto_url IS NOT NULL AND NEW.foto_url !~ '^https://[^[:space:]]+$' THEN
    RAISE EXCEPTION 'La foto debe usar una dirección HTTPS.';
  END IF;
  IF NEW.tutor_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.usuarios WHERE id = NEW.tutor_id AND rol = 'TUTOR'
  ) THEN RAISE EXCEPTION 'La cuenta seleccionada no es un tutor.'; END IF;
  IF NEW.id_link IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.usuarios WHERE id = NEW.id_link AND rol = 'ESTUDIANTE'
  ) THEN RAISE EXCEPTION 'La cuenta seleccionada no es un estudiante.'; END IF;
  IF NEW.id_link IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(NEW.id_link::text,0));
    IF EXISTS (SELECT 1 FROM public.estudiantes e WHERE e.id_link=NEW.id_link AND e.id<>NEW.id) THEN
      RAISE EXCEPTION 'La cuenta del estudiante ya está vinculada a otra ficha.' USING ERRCODE='23505';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER validar_ficha BEFORE INSERT OR UPDATE ON public.estudiantes
FOR EACH ROW EXECUTE FUNCTION public.validar_ficha_estudiante();

CREATE FUNCTION public.perfiles_vinculables()
RETURNS TABLE(id uuid, ci text, nombre_completo text, rol text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF COALESCE(public.rol_actual(),'') <> 'DIRECTIVO' THEN
    RAISE EXCEPTION 'Solo el directivo puede consultar cuentas para vincular.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT u.id, u.ci, u.nombre_completo, u.rol
    FROM public.usuarios u WHERE u.rol IN ('TUTOR','ESTUDIANTE') ORDER BY u.nombre_completo;
END $$;
REVOKE ALL ON FUNCTION public.perfiles_vinculables() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.perfiles_vinculables() TO authenticated;

GRANT INSERT, UPDATE ON public.materias TO authenticated;
CREATE POLICY crear_materias ON public.materias FOR INSERT TO authenticated
  WITH CHECK (public.rol_actual() = 'DIRECTIVO');
CREATE POLICY editar_materias ON public.materias FOR UPDATE TO authenticated
  USING (public.rol_actual() = 'DIRECTIVO') WITH CHECK (public.rol_actual() = 'DIRECTIVO');
CREATE FUNCTION public.normalizar_materia() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.nombre := trim(NEW.nombre);
  IF length(NEW.nombre) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'El nombre de la materia debe tener entre 1 y 100 caracteres.';
  END IF;
  -- Serializa altas/renombres equivalentes sin borrar posibles materias históricas.
  PERFORM pg_advisory_xact_lock(hashtextextended(lower(NEW.nombre),0));
  IF EXISTS (SELECT 1 FROM public.materias m
    WHERE lower(trim(m.nombre)) = lower(NEW.nombre) AND m.id <> NEW.id) THEN
    RAISE EXCEPTION 'Ya existe una materia con ese nombre.' USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER normalizar_materia BEFORE INSERT OR UPDATE ON public.materias
FOR EACH ROW EXECUTE FUNCTION public.normalizar_materia();

-- El autor debe salir de la sesión, no de un campo libre enviado por el cliente.
REVOKE INSERT, UPDATE, DELETE ON public.comunicados FROM authenticated;
CREATE FUNCTION public.publicar_comunicado(p_titulo text, p_contenido text, p_etiqueta text)
RETURNS public.comunicados LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE autor_actual text; resultado public.comunicados%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR COALESCE(public.rol_actual(),'') NOT IN ('DOCENTE','DIRECTIVO') THEN
    RAISE EXCEPTION 'No tiene permiso para publicar comunicados.' USING ERRCODE = '42501';
  END IF;
  IF p_titulo IS NULL OR length(trim(p_titulo)) NOT BETWEEN 1 AND 160
    OR p_contenido IS NULL OR length(trim(p_contenido)) NOT BETWEEN 1 AND 10000
    OR p_etiqueta IS NULL OR p_etiqueta NOT IN ('GENERAL','REUNION','EXAMENES','SALIDAS') THEN
    RAISE EXCEPTION 'Revisá el título, contenido y categoría del comunicado.';
  END IF;
  SELECT nombre_completo INTO autor_actual FROM public.usuarios WHERE id = auth.uid();
  INSERT INTO public.comunicados(titulo,contenido,etiqueta,autor,fecha)
    VALUES (trim(p_titulo),trim(p_contenido),p_etiqueta,autor_actual,now()) RETURNING * INTO resultado;
  RETURN resultado;
END $$;
REVOKE ALL ON FUNCTION public.publicar_comunicado(text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publicar_comunicado(text,text,text) TO authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime')
    AND NOT EXISTS (SELECT 1 FROM pg_publication_tables
      WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='comunicados') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.comunicados;
  END IF;
END $$;
NOTIFY pgrst, 'reload schema';
COMMIT;
