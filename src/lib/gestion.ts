import type { Estudiante } from '../types/index';
export type PerfilVinculable = { id: string; ci: string; nombre_completo: string; rol: 'TUTOR' | 'ESTUDIANTE' };
export type DatosEstudiante = Pick<Estudiante, 'ci' | 'nombre_completo' | 'curso' | 'especialidad' | 'foto_url' | 'tutor_id' | 'id_link'>;
export const estudianteVacio = (): DatosEstudiante => ({
  ci: '', nombre_completo: '', curso: '', especialidad: null, foto_url: null, tutor_id: null, id_link: null,
});
export function validarEstudiante(e: DatosEstudiante): string | null {
  if (!/^\d{3,15}$/.test(e.ci.trim())) return 'Ingresá una C.I. de 3 a 15 dígitos.';
  if (e.nombre_completo.trim().length < 3 || e.nombre_completo.trim().length > 150) return 'El nombre debe tener entre 3 y 150 caracteres.';
  if (!e.curso.trim() || e.curso.trim().length > 100) return 'Ingresá un curso de hasta 100 caracteres.';
  if ((e.especialidad?.trim().length || 0) > 150) return 'La especialidad admite hasta 150 caracteres.';
  if (e.foto_url?.trim()) {
    try { if (new URL(e.foto_url).protocol !== 'https:') return 'La foto debe usar una dirección HTTPS.'; }
    catch { return 'La dirección de la foto no es válida.'; }
  }
  return null;
}
export function normalizarEstudiante(e: DatosEstudiante): DatosEstudiante {
  return { ...e, ci: e.ci.trim(), nombre_completo: e.nombre_completo.trim(), curso: e.curso.trim(),
    especialidad: e.especialidad?.trim() || null, foto_url: e.foto_url?.trim() || null };
}
