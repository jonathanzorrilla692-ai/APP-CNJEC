import type { Nota } from '../types/index';

export interface EtapaMedia {
  modo: 'NOTA' | 'PUNTAJE';
  nota: Nota | null;
  puntos: number | null;
  maximo: number;
  minimo3: number | null;
  minimo4: number | null;
  minimo5: number | null;
  proceso: string;
}
export interface EntradaMedia { etapa1: EtapaMedia; etapa2: EtapaMedia }
export type EstadoMedia = 'PENDIENTE' | 'APROBADO' | 'RECUPERACION';
export interface ResultadoMedia {
  nota_etapa1: Nota | null; nota_etapa2: Nota | null;
  promedio: number | null; nota_final: Nota | null; estado: EstadoMedia;
}
export interface CalificacionMedia extends EntradaMedia, ResultadoMedia {
  id: string; estudiante_id: string; materia_id: string; anio: number;
  created_at: string; updated_at: string; materia?: { id: string; nombre: string };
}
export const estadosMedia: Record<EstadoMedia, string> = {
  PENDIENTE: 'Pendiente', APROBADO: 'Aprueba en ordinario', RECUPERACION: 'Requiere recuperación',
};
export const etapaVacia = (): EtapaMedia => ({
  modo: 'NOTA', nota: null, puntos: null, maximo: 60,
  minimo3: 47, minimo4: 52, minimo5: 57, proceso: '',
});
export const entradaVacia = (): EntradaMedia => ({ etapa1: etapaVacia(), etapa2: etapaVacia() });
// Indicadores enteros: nunca redondear hacia abajo el mínimo del 70%.
export const minimoDos = (maximo: number) => Math.ceil(maximo * 7 / 10);
export function validarEtapa(e: EtapaMedia): boolean {
  if (typeof e.proceso !== 'string' || e.proceso.length > 2000) return false;
  if (e.modo === 'NOTA') return e.nota === null || (Number.isInteger(e.nota) && e.nota >= 1 && e.nota <= 5);
  if (e.modo !== 'PUNTAJE' || !Number.isInteger(e.maximo) || e.maximo < 10 || e.maximo > 100000) return false;
  const cortes = [minimoDos(e.maximo), e.minimo3, e.minimo4, e.minimo5];
  return cortes.every((n, i) => n !== null && Number.isInteger(n) && n <= e.maximo &&
    (i === 0 || n > cortes[i - 1]!)) &&
    (e.puntos === null || (Number.isInteger(e.puntos) && e.puntos >= 0 && e.puntos <= e.maximo));
}
export function notaEtapa(e: EtapaMedia): Nota | null {
  if (!validarEtapa(e)) throw new Error('Revisá la nota o los puntajes y cortes de la etapa.');
  if (e.modo === 'NOTA') return e.nota;
  if (e.puntos === null) return null;
  return e.puntos >= e.minimo5! ? 5 : e.puntos >= e.minimo4! ? 4 :
    e.puntos >= e.minimo3! ? 3 : e.puntos >= minimoDos(e.maximo) ? 2 : 1;
}
export function resultadoMedia(entrada: EntradaMedia): ResultadoMedia {
  const nota_etapa1 = notaEtapa(entrada.etapa1), nota_etapa2 = notaEtapa(entrada.etapa2);
  if (nota_etapa1 === null || nota_etapa2 === null)
    return { nota_etapa1, nota_etapa2, promedio: null, nota_final: null, estado: 'PENDIENTE' };
  const suma = nota_etapa1 + nota_etapa2;
  const aprobado = suma >= 4 && nota_etapa2 >= 2;
  return { nota_etapa1, nota_etapa2, promedio: suma / 2,
    nota_final: aprobado ? Math.round(suma / 2) as Nota : 1,
    estado: aprobado ? 'APROBADO' : 'RECUPERACION' };
}
