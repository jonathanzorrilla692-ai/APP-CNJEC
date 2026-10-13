# Colegio Nacional Juan Eudoro Cáceres

React + TypeScript + Tailwind CSS + Supabase. Modelo anual de dos etapas, proceso acumulativo, carnet QR y asistencia diaria.

## Ejecutar

Requiere Node.js 20 o posterior.
1. `npm ci`.
2. Copiar `.env.example` a `.env.local` y completar URL y clave pública anon de Supabase.
3. `npm run dev -- --host 127.0.0.1`.
4. Abrir la URL indicada. Para cámaras en dispositivos remotos usar HTTPS.

## Activar la base de datos

En un proyecto nuevo, aplicar únicamente esta secuencia de archivos de supabase/migrations/:
1. 20261003135219_create_school_platform_schema.sql
2. 20261003145959_add_estudiante_role.sql
3. 20261006180000_etapas_carnets_asistencia.sql
4. 20261010120000_gestion_escolar.sql
5. 20261013013539_educacion_media_dos_etapas.sql

El repositorio también contiene dos copias importadas por Bolt con prefijo 202610101756.
No ejecutarlas junto con sus equivalentes originales: vuelven a crear los mismos objetos.
Si esas copias ya fueron aplicadas en Bolt, ejecutar solo la nueva migración de Educación Media.
No usar db push indiscriminadamente hasta conciliar ese historial duplicado con la base real.
En la base existente que ya tiene las dos migraciones originales, ejecutar únicamente
`supabase/migrations/20261006180000_etapas_carnets_asistencia.sql` y después
`supabase/migrations/20261010120000_gestion_escolar.sql`, seguidas de
`supabase/migrations/20261013013539_educacion_media_dos_etapas.sql` desde Supabase SQL Editor con la cuenta administradora, o mediante Supabase CLI con acceso al proyecto.

La clave anon no autoriza a ejecutar migraciones. La aplicación muestra un aviso cuando faltan tablas.
La migración se ejecuta en una transacción. No ejecutar repetidamente una migración ya aplicada.

La migración:
- Añade `especialidad` a estudiantes y el rol PRECEPTOR.
- Crea materias, políticas académicas, calificaciones_etapas y asistencia_diaria.
- Conserva `calificaciones` y `asistencia` históricas; retira sus escrituras desde el cliente.
- Copia un registro por estudiante y fecha desde la asistencia anterior, usando el más reciente.
- No inventa una equivalencia entre notas históricas y las nuevas etapas.
- Habilita las nuevas tablas en `supabase_realtime` si existe esa publicación.
- Evita que un usuario cambie su propio rol.

Los usuarios de Auth deben tener su perfil en `usuarios`. El estudiante debe estar vinculado mediante
`estudiantes.id_link = usuarios.id`; el tutor mediante `estudiantes.tutor_id`.
El C.I. de acceso corresponde al correo `CI@colegio.edu.py` usado por el sistema original.
El directivo puede completar fichas, especialidades, vínculos y catálogo de materias desde la aplicación.

## Gestión escolar

- El directivo crea y edita alumnos y materias. Los vínculos se seleccionan entre cuentas existentes de tutor o estudiante; esta pantalla no crea cuentas de Auth.
- Las fichas validan C.I., nombre, curso y fotografía HTTPS tanto en la aplicación como en PostgreSQL. Una cuenta de estudiante no puede vincularse a dos fichas nuevas.
- Docentes y directivos publican comunicados. El servidor asigna autor y fecha; otros roles solo los consultan.
- El personal consulta asistencia por fechas y estado, con páginas de 50 registros. El CSV descarga todos los resultados del filtro y protege las celdas de texto contra fórmulas de planilla.
- El carnet se descarga en PNG con datos y QR. La fotografía remota se muestra en pantalla y no se incluye en la imagen descargada.
- Las credenciales de demostración solo se muestran en desarrollo con `VITE_DEMO_LOGIN=true`; no se habilitan en producción.

## Evaluación de Educación Media

La pantalla activa corresponde al período ordinario de disciplinas evaluadas en dos etapas.
Admite carga directa de notas 1–5 o indicadores enteros, independientemente para cada etapa.
El proceso acumulativo se registra como observaciones de cada etapa, sin un tercer peso anual.

- Promedio matemático = (nota de etapa 1 + nota de etapa 2) / 2.
- Aprueba la disciplina cuando la suma es al menos 4 y la segunda etapa es al menos 2.
- Primero se verifica la aprobación; luego se redondean mitades hacia arriba. Si no aprueba, final 1.
- 1 + 2: promedio 1,5, final 1, recuperación. 3 + 1: promedio 2, final 1, recuperación.
- Blanco: pendiente, final NULL. Cero indicadores logrados: nota de etapa 1.
- Puntajes: mínimo de 2 = techo(total × 70%). No se redondea hacia abajo la exigencia.
- Ejemplo inicial verificado sobre 60 indicadores: mínimos 42/47/52/57 para 2/3/4/5.
- Los cortes 3/4/5 son explícitos y deben corresponder a la planilla del colegio. Al cambiar el total se limpian para evitar aplicar cortes de otra escala. No se inventa una regla universal de intervalos para otros totales.
- No admite puntajes fraccionarios en el modo indicadores; para otra rúbrica se carga la nota de etapa ya obtenida.

La nueva tabla calificaciones_media recalcula notas, promedio y estado mediante un trigger invocador.
Las tablas calificaciones_etapas y politicas_academicas permanecen como historial de solo lectura.
No se transforman automáticamente los puntajes o resultados antiguos: el docente debe revisarlos.
El historial se muestra separado en carga de notas y panel de familias y no integra el promedio nuevo.
El cálculo legado en src/lib/academico.ts se conserva únicamente para verificar las migraciones históricas; ninguna pantalla activa lo utiliza.

La condición mostrada es por disciplina en ordinario. No equivale a promoción del curso completo.
Los proyectos educativos, planes modulares y resultados del período complementario o regularización
requieren sus propias planillas; esta entrega los identifica como fuera del cálculo de dos etapas.
No se afirma compatibilidad con todos los planes del tercer curso técnico.

Referencias revisadas (copias de documentos MEC; continuidad localizada hasta Circular 14/2024):
- [Resolución 101/2014, Científico](https://es.scribd.com/doc/260966997/Criterios-de-Promocion-de-Educacion-Media-2014).
- [Resolución 257/2023, mínimo 70% en Media](https://es.scribd.com/document/647697415/2023-05-17-257-RESOLUCION-MODIFICACION-PARCIAL-EVALUACION-NM-3er-EEB).
- [Valoración MEC 2009, anexos pp. 102–103: ejemplos de redondeo](https://es.scribd.com/document/436203285/Sistema-de-Promocion-en-La-Media-2009-Version-Final).
- [Orientaciones mayo 2023: escala sobre 60 indicadores](https://es.scribd.com/presentation/649453002/Orientaciones-Evaluacion-23-1-1).

### Activación de esta entrega

Aplicar la quinta migración en la base del colegio antes de desplegar el frontend nuevo.
Con las cuatro primeras ya aplicadas, ejecutar solo 20261013013539_educacion_media_dos_etapas.sql.
Es una transacción y conserva los registros anteriores. No se debe volver a ejecutar después del éxito.
La conexión administradora disponible no incluye el proyecto apsvydogpiupkkhzuofo;
esta entrega está comprobada localmente con PGlite, no aplicada a la base remota.
No requiere un plan de pago para estas funciones de PostgreSQL.

## Carnets y asistencia

- `qrcode.react` genera un SVG con margen de cuatro módulos.
- Datos visibles: nombre, C.I., curso, especialidad (o aviso si falta).
- Contenido: `CNJEC:1:<uuid-estudiante>`. No contiene la cédula ni una credencial de acceso.
- El ID identifica al estudiante: no es un token secreto ni impide compartir una foto del carnet.
- Docentes y preceptores verifican identidad y eligen Presente, Ausente o Llegada tardía.
- La RPC `registrar_asistencia` usa la identidad autenticada y fecha/hora del servidor en America/Asuncion.
- Restricción única por estudiante y día; repetir el mismo estado conserva hora y registrador;
  cambiar el estado corrige el registro del día.
- Las ausencias se registran explícitamente desde la lista, sin necesitar que el estudiante presente su QR.
- Un día sin registro permanece “Sin registrar”. No existe umbral horario arbitrario de tardanza.
- La lista usa Realtime; también refresca al recuperar foco y cada 30 segundos.
- Los registros recientes de tutores/estudiantes se limitan a los últimos 30.

## Permisos

| Rol | Carnets | Notas | Asistencia |
| --- | --- | --- | --- |
| Estudiante | Su carnet | Sus notas | Sus registros |
| Tutor | Estudiantes vinculados | Estudiantes vinculados | Estudiantes vinculados |
| Preceptor | Todos | Sin acceso | Registrar/corregir hoy |
| Docente | Todos | Leer/cargar | Registrar/corregir hoy |
| Directivo | Todos | Cargar y consultar | Registrar/corregir hoy |

## Verificación

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`

Las pruebas ejecutan las migraciones en PostgreSQL local con PGlite (Auth simulado), verifican RLS para los cinco roles,
límites de notas, puntajes pendientes, entradas inválidas, promedios manipulados, duplicados, fecha de Paraguay,
gestión de alumnos y materias, autoría de comunicados y exportación CSV. Actualmente hay nueve pruebas, incluidas las 25 combinaciones de Media, cortes de puntaje, entradas manipuladas y conservación del historial.
No escriben datos de prueba en el colegio. PGlite no reemplaza la prueba de transporte Realtime de Supabase.
La prueba de cámara física y la integración de escrituras remotas se completan después de aplicar la migración.

Documentación de referencia:
- [qrcode.react](https://github.com/zpao/qrcode.react)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes)
