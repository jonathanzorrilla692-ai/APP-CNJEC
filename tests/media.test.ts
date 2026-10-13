import test from 'node:test';
import assert from 'node:assert/strict';
import { etapaVacia, entradaVacia, minimoDos, notaEtapa, resultadoMedia, validarEtapa } from '../src/lib/media';
import type { Nota } from '../src/types';

export const finalesEsperados = [[1,1,2,3,3],[1,2,3,3,4],[1,3,3,4,4],[1,3,4,4,5],[1,4,4,5,5]];
test('Media: las 25 combinaciones, aprobación antes del redondeo y pendientes', () => {
  for (let a = 1; a <= 5; a++) for (let b = 1; b <= 5; b++) {
    const r = resultadoMedia({ etapa1: { ...etapaVacia(), nota: a as Nota }, etapa2: { ...etapaVacia(), nota: b as Nota } });
    assert.equal(r.promedio, (a+b)/2);
    assert.equal(r.nota_final, finalesEsperados[a-1][b-1]);
    assert.equal(r.estado, r.nota_final === 1 ? 'RECUPERACION' : 'APROBADO');
  }
  assert.equal(resultadoMedia(entradaVacia()).estado, 'PENDIENTE');
  assert.equal(resultadoMedia({ ...entradaVacia(), etapa1: { ...etapaVacia(), nota: 5 } }).nota_final, null);
});
test('Media: cortes enteros del 70%, fronteras, cero evaluado y datos inválidos', () => {
  for (const [p, n] of [[0,1],[41,1],[42,2],[46,2],[47,3],[51,3],[52,4],[56,4],[57,5],[60,5]])
    assert.equal(notaEtapa({ ...etapaVacia(), modo: 'PUNTAJE', puntos: p }), n);
  assert.equal(notaEtapa({ ...etapaVacia(), modo: 'PUNTAJE' }), null);
  assert.equal(minimoDos(61), 43);
  for (const patch of [{ puntos: -1 }, { puntos: 61 }, { puntos: 41.99 }, { maximo: 0 }, { minimo3: null }, { minimo3: 42 }, { minimo5: 61 }])
    assert.equal(validarEtapa({ ...etapaVacia(), modo: 'PUNTAJE', ...patch }), false);
  for (const n of [0, 6, 2.5, NaN, Infinity]) assert.equal(validarEtapa({ ...etapaVacia(), nota: n as Nota }), false);
  assert.equal(validarEtapa({ ...etapaVacia(), proceso: 'x'.repeat(2001) }), false);
});
