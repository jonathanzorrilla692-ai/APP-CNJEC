import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { calcularResultado, propuestaPolitica, puntajesVacios } from '../src/lib/academico';
import { etapaVacia, resultadoMedia } from '../src/lib/media';
import type { Nota } from '../src/types';

test('migraciones, cálculos autoritativos, RLS y asistencia idempotente', async () => {
 const db = new PGlite();
 try {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
    GRANT USAGE ON SCHEMA public, auth TO authenticated, anon;
    GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated, anon;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated;`);
  for (const name of ['20261003135219_create_school_platform_schema.sql','20261003145959_add_estudiante_role.sql'])
    await db.exec(await readFile(new URL('../supabase/migrations/' + name, import.meta.url), 'utf8'));
  const docente = '00000000-0000-4000-8000-000000000001';
  const tutor = '00000000-0000-4000-8000-000000000002';
  const alumno = '00000000-0000-4000-8000-000000000003';
  const ajeno = '00000000-0000-4000-8000-000000000004';
  const directivo = '00000000-0000-4000-8000-000000000005';
  const preceptor = '00000000-0000-4000-8000-000000000006';
  const estudiante = '10000000-0000-4000-8000-000000000001';
  await db.exec(`INSERT INTO auth.users VALUES ('${docente}'),('${tutor}'),('${alumno}'),('${ajeno}'),('${directivo}'),('${preceptor}');
    INSERT INTO public.usuarios(id,ci,nombre_completo,rol) VALUES
    ('${docente}','1','Docente','DOCENTE'),('${tutor}','2','Tutor','TUTOR'),('${alumno}','3','Alumno','ESTUDIANTE'),
    ('${ajeno}','4','Ajeno','TUTOR'),('${directivo}','5','Directivo','DIRECTIVO'),('${preceptor}','6','Preceptor','DOCENTE');
    INSERT INTO public.estudiantes(id,ci,nombre_completo,curso,tutor_id,id_link)
      VALUES ('${estudiante}','33','Alumno','1.º','${tutor}','${alumno}');
    INSERT INTO public.asistencia(estudiante_id,fecha,hora,estado) VALUES
      ('${estudiante}','2025-01-01','07:00','PRESENTE'),('${estudiante}','2025-01-01','08:00','TARDANZA');`);
  await db.exec(await readFile(new URL('../supabase/migrations/20261006180000_etapas_carnets_asistencia.sql', import.meta.url), 'utf8'));
  assert.equal((await db.query('SELECT * FROM asistencia')).rows.length, 2);
  assert.equal((await db.query('SELECT * FROM asistencia_diaria')).rows.length, 1);
  await db.exec(`UPDATE usuarios SET rol='PRECEPTOR' WHERE id='${preceptor}'`);
  const asUser = async (id: string) => {
    await db.exec('RESET ROLE');
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id]);
    await db.exec('SET ROLE authenticated');
  };
  await asUser(docente);
  await assert.rejects(() => db.exec(`UPDATE usuarios SET rol='DIRECTIVO' WHERE id='${docente}'`));
  await assert.rejects(() => db.exec(`INSERT INTO politicas_academicas VALUES (2026,40,40,20,60,70,80,90,true)`));
  await asUser(directivo);
  await db.exec('INSERT INTO politicas_academicas VALUES (2026,40,40,20,60,70,80,90,true)');
  await assert.rejects(() => db.exec('UPDATE politicas_academicas SET minimo2=50 WHERE anio=2026'));
  const materia = (await db.query<{id:string}>('SELECT id FROM materias LIMIT 1')).rows[0].id;
  await asUser(docente);
  const result = await db.query<{id:string}>(`INSERT INTO calificaciones_etapas(estudiante_id,materia_id,anio,etapa1_puntos,etapa2_puntos,proceso_puntos,promedio,nota_final)
    VALUES ($1,$2,2026,60,60,60,100,5) RETURNING *`, [estudiante,materia]);
  const notaId = result.rows[0].id;
  for (const puntos of [0, 59.99, 59.995, 60, 69.99, 70, 79.99, 80, 89.99, 90, 100]) {
    const { rows } = await db.query<{promedio:string;nota_final:number}>('UPDATE calificaciones_etapas SET etapa1_puntos=$1, etapa2_puntos=$1, proceso_puntos=$1, nota_final=5 WHERE id=$2 RETURNING *', [puntos,notaId]);
    const expected = calcularResultado({ ...puntajesVacios(), etapa1_puntos:puntos,etapa2_puntos:puntos,proceso_puntos:puntos },{...propuestaPolitica(2026),confirmada:true});
    assert.equal(Number(rows[0].promedio),expected.promedio);
    assert.equal(rows[0].nota_final,expected.nota_final);
  }
  await assert.rejects(() => db.query('UPDATE calificaciones_etapas SET etapa1_puntos=-1 WHERE id=$1',[notaId]));
  await assert.rejects(() => db.query('UPDATE calificaciones_etapas SET etapa1_maximo=0 WHERE id=$1',[notaId]));
  const pending = await db.query<{nota_final:null}>('UPDATE calificaciones_etapas SET etapa2_puntos=NULL WHERE id=$1 RETURNING nota_final',[notaId]);
  assert.equal(pending.rows[0].nota_final,null);
  await assert.rejects(() => db.query('INSERT INTO calificaciones_etapas(estudiante_id,materia_id,anio) VALUES ($1,$2,2026)',[estudiante,materia]));
  for (const id of [tutor,alumno]) {
    await asUser(id);
    assert.equal((await db.query('SELECT * FROM calificaciones_etapas')).rows.length,1);
    await assert.rejects(() => db.query("SELECT registrar_asistencia($1,'PRESENTE')",[estudiante]));
    assert.equal((await db.query('UPDATE calificaciones_etapas SET etapa1_puntos=100 RETURNING *')).rows.length,0);
  }
  await asUser(ajeno);
  assert.equal((await db.query('SELECT * FROM estudiantes')).rows.length,0);
  assert.equal((await db.query('SELECT * FROM calificaciones_etapas')).rows.length,0);
  assert.equal((await db.query('SELECT * FROM asistencia_diaria')).rows.length,0);
  await asUser(preceptor);
  assert.equal((await db.query('SELECT * FROM estudiantes')).rows.length,1);
  assert.equal((await db.query('SELECT * FROM calificaciones_etapas')).rows.length,0);
  await assert.rejects(() => db.query("INSERT INTO asistencia_diaria(estudiante_id,fecha,hora,estado) VALUES ($1,CURRENT_DATE,CURRENT_TIME,'PRESENTE')",[estudiante]));
  await assert.rejects(() => db.query("SELECT registrar_asistencia($1,'INVALIDO')",[estudiante]));
  for (const estado of ['PRESENTE','PRESENTE','TARDANZA','AUSENTE']) {
    const {rows} = await db.query<{id:string;estado:string;registrado_por:string}>("SELECT (registrar_asistencia($1,$2)).*",[estudiante,estado]);
    assert.equal(rows[0].estado,estado);
    assert.equal(rows[0].registrado_por,preceptor);
  }
  assert.equal((await db.query('SELECT * FROM asistencia_diaria')).rows.length,2);
  await db.exec('RESET ROLE; SET ROLE anon');
  await assert.rejects(() => db.query("SELECT registrar_asistencia($1,'PRESENTE')",[estudiante]));
  await assert.rejects(() => db.query('SELECT * FROM asistencia_diaria'));
  // Segunda entrega: administración y comunicados, sobre la misma base histórica.
  await db.exec('RESET ROLE');
  await db.exec(await readFile(new URL('../supabase/migrations/20261010120000_gestion_escolar.sql', import.meta.url), 'utf8'));
  await asUser(directivo);
  assert.equal((await db.query('SELECT * FROM perfiles_vinculables()')).rows.length,3);
  await db.query('UPDATE estudiantes SET ci=$1,especialidad=$2 WHERE id=$3',['333','Bachillerato científico',estudiante]);
  const ficha = (await db.query<{id:string}>("INSERT INTO estudiantes(ci,nombre_completo,curso,tutor_id) VALUES ('444','Nuevo alumno','2.º',$1) RETURNING id",[tutor])).rows[0];
  await assert.rejects(() => db.query('UPDATE estudiantes SET tutor_id=$1 WHERE id=$2',[docente,ficha.id]));
  await assert.rejects(() => db.query('UPDATE estudiantes SET id_link=$1 WHERE id=$2',[alumno,ficha.id]));
  await assert.rejects(() => db.query("UPDATE estudiantes SET ci='letras' WHERE id=$1",[ficha.id]));
  await assert.rejects(() => db.query("UPDATE estudiantes SET foto_url='javascript:alert(1)' WHERE id=$1",[ficha.id]));
  const nuevaMateria = (await db.query<{id:string}>("INSERT INTO materias(nombre) VALUES ('  Robótica  ') RETURNING id")).rows[0];
  await assert.rejects(() => db.exec("INSERT INTO materias(nombre) VALUES ('robótica')"));
  await db.query("UPDATE materias SET nombre='Tecnología' WHERE id=$1",[nuevaMateria.id]);
  const aviso = (await db.query<{autor:string}>("SELECT (publicar_comunicado('Reunión','Contenido de prueba local','REUNION')).*")).rows[0];
  assert.equal(aviso.autor,'Directivo');
  await assert.rejects(() => db.exec("INSERT INTO comunicados(titulo,contenido,etiqueta,autor) VALUES ('Spoof','Mensaje','GENERAL','Otro')"));
  await assert.rejects(() => db.exec("SELECT publicar_comunicado(' ','Mensaje','GENERAL')"));
  await asUser(docente);
  await assert.rejects(() => db.exec("INSERT INTO estudiantes(ci,nombre_completo,curso) VALUES ('555','Otro alumno','1.º')"));
  assert.equal((await db.exec("UPDATE estudiantes SET nombre_completo='Alterado' WHERE ci='444' RETURNING *"))[0].rows.length,0);
  await assert.rejects(() => db.exec("INSERT INTO materias(nombre) VALUES ('No autorizado')"));
  await assert.rejects(() => db.exec('SELECT * FROM perfiles_vinculables()'));
  assert.equal((await db.query<{autor:string}>("SELECT (publicar_comunicado('Aviso docente','Contenido','GENERAL')).*")).rows[0].autor,'Docente');
  for (const id of [tutor,alumno,preceptor]) {
    await asUser(id);
    await assert.rejects(() => db.exec("SELECT publicar_comunicado('Aviso','Contenido','GENERAL')"));
    assert.ok((await db.query('SELECT * FROM comunicados')).rows.length >= 2);
  }
  // Media: conservar historia y calcular en servidor, incluso ante resultados manipulados.
  await db.exec('RESET ROLE');
  const historia = (await db.query('SELECT * FROM calificaciones_etapas ORDER BY id')).rows;
  await db.exec(await readFile(new URL('../supabase/migrations/20261013013539_educacion_media_dos_etapas.sql', import.meta.url), 'utf8'));
  assert.deepEqual((await db.query('SELECT * FROM calificaciones_etapas ORDER BY id')).rows, historia);
  await asUser(docente);
  await assert.rejects(() => db.exec('UPDATE calificaciones_etapas SET nota_final=5'));
  const etapa = { ...etapaVacia(), nota: 1 };
  const nueva = (await db.query<{id:string}>(`INSERT INTO calificaciones_media(estudiante_id,materia_id,anio,etapa1,etapa2,nota_final,estado)
    VALUES ($1,$2,2026,$3,$3,5,'APROBADO') RETURNING id`, [estudiante,materia,JSON.stringify(etapa)])).rows[0];
  for (let a=1; a<=5; a++) for (let b=1; b<=5; b++) {
    const entrada = { etapa1:{...etapaVacia(),nota:a as Nota}, etapa2:{...etapaVacia(),nota:b as Nota} };
    const actual = (await db.query<{nota_final:number;promedio:string;estado:string}>(`UPDATE calificaciones_media
      SET etapa1=$1,etapa2=$2,nota_final=5,promedio=5,estado='APROBADO' WHERE id=$3 RETURNING *`,
      [JSON.stringify(entrada.etapa1),JSON.stringify(entrada.etapa2),nueva.id])).rows[0];
    const expected = resultadoMedia(entrada);
    assert.equal(actual.nota_final,expected.nota_final); assert.equal(Number(actual.promedio),expected.promedio); assert.equal(actual.estado,expected.estado);
  }
  for (const puntos of [0,41,42,46,47,51,52,56,57,60,null]) {
    const e = {...etapaVacia(),modo:'PUNTAJE' as const,puntos};
    const actual = (await db.query<{nota_etapa1:number|null;nota_final:number|null;estado:string}>(
      'UPDATE calificaciones_media SET etapa1=$1,etapa2=$1 WHERE id=$2 RETURNING *',[JSON.stringify(e),nueva.id])).rows[0];
    const expected = resultadoMedia({etapa1:e,etapa2:e});
    assert.equal(actual.nota_etapa1,expected.nota_etapa1); assert.equal(actual.nota_final,expected.nota_final); assert.equal(actual.estado,expected.estado);
  }
  for (const e of [{...etapa,nota:2.5},{...etapa,nota:0},{...etapa,nota:'5'},{...etapa,modo:'OTRO'},
    {...etapaVacia(),modo:'PUNTAJE',puntos:-1},{...etapaVacia(),modo:'PUNTAJE',puntos:61},
    {...etapaVacia(),modo:'PUNTAJE',puntos:42.5},{...etapaVacia(),modo:'PUNTAJE',minimo3:null},
    {...etapaVacia(),modo:'PUNTAJE',minimo3:42},{...etapa,proceso:'x'.repeat(2001)}])
    await assert.rejects(() => db.query('UPDATE calificaciones_media SET etapa1=$1 WHERE id=$2',[JSON.stringify(e),nueva.id]));
  for (const id of [tutor,alumno,ajeno,preceptor]) {
    await asUser(id);
    assert.equal((await db.query('SELECT * FROM calificaciones_media')).rows.length,[tutor,alumno].includes(id)?1:0);
    assert.equal((await db.query('UPDATE calificaciones_media SET nota_final=5 RETURNING *')).rows.length,0);
    await assert.rejects(() => db.query(`INSERT INTO calificaciones_media(estudiante_id,materia_id,anio,etapa1,etapa2)
      VALUES ($1,$2,2027,$3,$3)`,[estudiante,materia,JSON.stringify(etapa)]));
  }
  await asUser(directivo);
  assert.equal((await db.query('UPDATE calificaciones_media SET etapa1=$1 WHERE id=$2 RETURNING *',[JSON.stringify(etapa),nueva.id])).rows.length,1);
  await db.exec('RESET ROLE; SET ROLE anon');
  await assert.rejects(() => db.query('SELECT * FROM calificaciones_media'));
 } finally { await db.close(); }
});
