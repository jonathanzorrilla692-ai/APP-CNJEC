# Colegio Nacional Juan Eudoro Cáceres

React + TypeScript + Tailwind CSS + Supabase. Modelo anual de dos etapas, proceso acumulativo, carnet QR y asistencia diaria.

## Ejecutar

Requiere Node.js 20 o posterior.
1. `npm ci`.
2. Copiar `.env.example` a `.env.local` y completar URL y clave pública anon de Supabase.
3. `npm run dev -- --host 127.0.0.1`.
4. Abrir la URL indicada. Para cámaras en dispositivos remotos usar HTTPS.

## Activar la base de datos

En un proyecto nuevo, aplicar en orden las cuatro migraciones de `supabase/migrations/`.
En la base existente que ya tiene las dos migraciones originales, ejecutar únicamente
`supabase/migrations/20261006180000_etapas_carnets_asistencia.sql` y después
`supabase/migrations/20261010120000_gestion_escolar.sql` desde Supabase SQL Editor con la cuenta administradora, o mediante Supabase CLI con acceso al proyecto.

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

## Política de evaluación

El pedido no especifica porcentajes, cortes ni regla institucional de redondeo.
Por eso **no se afirma que la propuesta sea una normativa oficial del MEC**.

En “Carga de notas”, el directivo selecciona el año, ajusta pesos y límites y confirma la escala.
La propuesta inicial (sin confirmar) es 40% primera etapa, 40% segunda etapa y 20% proceso;
cortes 60/70/80/90 para las notas 2/3/4/5. No se puede guardar ninguna calificación hasta confirmar.

Cada componente tiene puntaje obtenido y máximo. El promedio porcentual es:
`etapa1 / máximo1 × peso1 + etapa2 / máximo2 × peso2 + proceso / máximoProceso × pesoProceso`.
Se redondea a dos decimales (mitades hacia arriba) antes de comparar con los cortes.
La nota es 1 por debajo del mínimo de 2; 2, 3, 4 o 5 según el límite alcanzado.

Blanco = pendiente. Cero = puntaje real evaluado. Mientras falte un componente, promedio y final son NULL.
Supabase recalcula ambos campos en cada escritura, incluso si un cliente intenta enviar otra nota.
Decimal.js mantiene el cálculo de vista previa consistente con los decimales de PostgreSQL.
Una escala confirmada queda fija para el año; una corrección excepcional exige intervención administrativa y recálculo controlado.
No se calcula una nota oficial hasta que el colegio confirme su reglamento.

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
| Directivo | Todos | Confirmar escala y cargar | Registrar/corregir hoy |

## Verificación

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`

Las pruebas ejecutan las migraciones en PostgreSQL local con PGlite (Auth simulado), verifican RLS para los cinco roles,
límites de notas, puntajes pendientes, entradas inválidas, promedios manipulados, duplicados, fecha de Paraguay,
gestión de alumnos y materias, autoría de comunicados y exportación CSV. Actualmente hay siete pruebas.
No escriben datos de prueba en el colegio. PGlite no reemplaza la prueba de transporte Realtime de Supabase.
La prueba de cámara física y la integración de escrituras remotas se completan después de aplicar la migración.

Documentación de referencia:
- [qrcode.react](https://github.com/zpao/qrcode.react)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes)
