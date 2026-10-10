export function descargarArchivo(nombre: string, contenido: Blob) {
  const url = URL.createObjectURL(contenido);
  const enlace = document.createElement('a');
  enlace.href = url; enlace.download = nombre;
  document.body.appendChild(enlace); enlace.click(); enlace.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function crearCSV(filas: (string | number | null | undefined)[][]): string {
  return '\uFEFF' + filas.map(fila => fila.map(valor => {
    let texto = String(valor ?? '');
    // Evita fórmulas al abrir nombres o campos externos en una planilla.
    if (/^[\s]*[=+@-]/.test(texto)) texto = "'" + texto;
    return '"' + texto.replace(/"/g, '""') + '"';
  }).join(';')).join('\r\n');
}
