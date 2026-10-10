import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularResultado, propuestaPolitica, puntajesVacios, validarPuntajes, validarPolitica } from '../src/lib/academico';
import { crearQR, leerQR, fechaParaguay } from '../src/lib/asistencia';
const politica = { ...propuestaPolitica(2026), confirmada: true };
test('la escala no confirmada y los puntajes pendientes no generan nota', () => {
  assert.equal(calcularResultado(puntajesVacios(), politica).nota_final, null);
  assert.equal(calcularResultado({ ...puntajesVacios(), etapa1_puntos: 90, etapa2_puntos: 90, proceso_puntos: 90 }, propuestaPolitica(2026)).nota_final, null);
});
test('límites 1–5, cero real, pesos y máximos distintos', () => {
  for (const [puntos, nota] of [[0,1],[59.99,1],[60,2],[69.99,2],[70,3],[80,4],[90,5],[100,5]]) {
    const p = { ...puntajesVacios(), etapa1_puntos: puntos, etapa2_puntos: puntos, proceso_puntos: puntos };
    assert.equal(calcularResultado(p, politica).nota_final, nota);
  }
  assert.deepEqual(calcularResultado({ etapa1_puntos: 30, etapa1_maximo: 50, etapa2_puntos: 80,
    etapa2_maximo: 100, proceso_puntos: 20, proceso_maximo: 20 }, politica), { promedio: 76, nota_final: 3 });
});
test('validación de puntajes y escala', () => {
  assert.equal(validarPuntajes({ ...puntajesVacios(), etapa1_puntos: -1 }), false);
  assert.equal(validarPuntajes({ ...puntajesVacios(), etapa1_puntos: 101 }), false);
  assert.equal(validarPuntajes({ ...puntajesVacios(), etapa1_maximo: 0 }), false);
  assert.equal(validarPolitica({ ...politica, peso_etapa1: 45 }), false);
  assert.equal(validarPolitica({ ...politica, minimo5: 75 }), false);
});
test('QR versionado, inválidos y fecha de Paraguay cerca de medianoche UTC', () => {
  const id = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
  assert.equal(leerQR(crearQR(id)), id);
  for (const qr of ['1234567', 'CI:1234567', 'CNJEC:2:' + id, 'https://otro.sitio', 'CNJEC:1:no-valido'])
    assert.throws(() => leerQR(qr));
  assert.equal(fechaParaguay(new Date('2026-10-07T01:30:00Z')), '2026-10-06');
});
