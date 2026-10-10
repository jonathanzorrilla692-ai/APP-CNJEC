import type { EstadoAsistencia } from '../types/index';
export const estados: Record<EstadoAsistencia, string> = {
  PRESENTE: 'Presente', AUSENTE: 'Ausente', TARDANZA: 'Llegada tardía',
};
export function fechaParaguay(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'America/Asuncion',
    year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const get = (type: string) => parts.find(p => p.type === type)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function crearQR(id: string): string {
  if (!uuid.test(id)) throw new Error('Identificador de estudiante inválido');
  return `CNJEC:1:${id}`;
}
export function leerQR(value: string): string {
  const id = value.startsWith('CNJEC:1:') ? value.slice(8) : '';
  if (!uuid.test(id)) throw new Error('El QR no corresponde a un carnet CNJEC válido.');
  return id;
}
