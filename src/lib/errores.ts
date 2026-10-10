export function mensajeError(error: unknown): string {
  const e = error as { message?: string; code?: string };
  if (e?.code === '23505') return 'Ya existe un registro con esa C.I. o nombre. Revisá los datos antes de guardar.';
  if (e?.code === '42501') return 'Tu cuenta no tiene permiso para realizar esta acción.';
  if (['42P01', '42703', 'PGRST200', 'PGRST202', 'PGRST205'].includes(e?.code ?? ''))
    return 'Falta actualizar la base de datos. Aplicá la migración académica incluida en el proyecto.';
  return e?.message || 'No se pudo completar la operación. Revisá la conexión e intentá nuevamente.';
}
