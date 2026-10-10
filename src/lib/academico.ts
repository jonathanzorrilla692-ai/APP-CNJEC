import type { Nota, PoliticaAcademica, Puntajes } from '../types/index';
import Decimal from 'decimal.js';
// Propuesta editable; se aplica únicamente tras confirmación del directivo.
export const propuestaPolitica = (anio: number): PoliticaAcademica => ({
  anio, peso_etapa1: 40, peso_etapa2: 40, peso_proceso: 20,
  minimo2: 60, minimo3: 70, minimo4: 80, minimo5: 90, confirmada: false,
});
export const puntajesVacios = (): Puntajes => ({
  etapa1_puntos: null, etapa1_maximo: 100, etapa2_puntos: null,
  etapa2_maximo: 100, proceso_puntos: null, proceso_maximo: 100,
});
export function validarPolitica(p: PoliticaAcademica): boolean {
  const pesos = [p.peso_etapa1, p.peso_etapa2, p.peso_proceso];
  const cortes = [p.minimo2, p.minimo3, p.minimo4, p.minimo5];
  return pesos.every(n => Number.isFinite(n) && n > 0) &&
    Math.abs(pesos.reduce((a, b) => a + b, 0) - 100) < 0.000001 &&
    cortes.every((n, i) => Number.isFinite(n) && n > 0 && n <= 100 && (i === 0 || n > cortes[i - 1]));
}
export function validarPuntajes(p: Puntajes): boolean {
  return [[p.etapa1_puntos, p.etapa1_maximo], [p.etapa2_puntos, p.etapa2_maximo],
    [p.proceso_puntos, p.proceso_maximo]].every(([n, max]) =>
    max !== null && Number.isFinite(max) && max > 0 && max <= 100000 &&
    (n === null || (Number.isFinite(n) && n >= 0 && n <= max)));
}
export function calcularResultado(p: Puntajes, regla: PoliticaAcademica) {
  if (!validarPuntajes(p) || !validarPolitica(regla)) throw new Error('Puntajes o escala inválidos');
  if (!regla.confirmada || p.etapa1_puntos === null || p.etapa2_puntos === null || p.proceso_puntos === null)
    return { promedio: null, nota_final: null };
  const valor = new Decimal(p.etapa1_puntos).div(p.etapa1_maximo).mul(regla.peso_etapa1)
    .plus(new Decimal(p.etapa2_puntos).div(p.etapa2_maximo).mul(regla.peso_etapa2))
    .plus(new Decimal(p.proceso_puntos).div(p.proceso_maximo).mul(regla.peso_proceso));
  const promedio = valor.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
  const nota_final: Nota = promedio >= regla.minimo5 ? 5 : promedio >= regla.minimo4 ? 4 :
    promedio >= regla.minimo3 ? 3 : promedio >= regla.minimo2 ? 2 : 1;
  return { promedio, nota_final };
}
