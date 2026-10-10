import test from 'node:test';
import assert from 'node:assert/strict';
import { crearCSV } from '../src/lib/descargas';
import { estudianteVacio, normalizarEstudiante, validarEstudiante } from '../src/lib/gestion';
test('la ficha exige identidad válida y direcciones HTTPS', () => {
  assert.ok(validarEstudiante(estudianteVacio()));
  const valida = { ...estudianteVacio(), ci: '1234567', nombre_completo: ' Ana Pérez ', curso: '1.º A', especialidad: ' ' };
  assert.equal(validarEstudiante(valida),null);
  assert.equal(normalizarEstudiante(valida).nombre_completo,'Ana Pérez');
  assert.equal(normalizarEstudiante(valida).especialidad,null);
  assert.ok(validarEstudiante({ ...valida, foto_url:'javascript:alert(1)' }));
  assert.ok(validarEstudiante({ ...valida, foto_url:'http://sitio.test/foto.jpg' }));
  assert.equal(validarEstudiante({ ...valida, foto_url:'https://sitio.test/foto.jpg' }),null);
});
test('CSV conserva Unicode y escapa fórmulas, comillas y saltos de línea', () => {
  const csv = crearCSV([['C.I.','Nombre','Estado'],['0123456','Sofía "Pérez"','Presente'],['=1+1','+123','a\nb']]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('"0123456";"Sofía ""Pérez""";"Presente"'));
  assert.ok(csv.includes("\"'=1+1\";\"'+123\";\"a\nb\""));
});
