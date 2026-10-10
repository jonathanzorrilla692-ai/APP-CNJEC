import { QRCodeSVG } from 'qrcode.react';
import { GraduationCap } from 'lucide-react';
import type { Estudiante } from '@/types';
import { crearQR } from '@/lib/asistencia';
import { useRef, useState } from 'react';
import { descargarArchivo } from '@/lib/descargas';
export default function CarnetDigital({ estudiante: e }: { estudiante: Estudiante }) {
  const qr = useRef<SVGSVGElement>(null);
  const [descargando, setDescargando] = useState(false);
  const [error, setError] = useState('');
  const descargar = async () => {
    if (!qr.current || descargando) return;
    setDescargando(true); setError('');
    let url = '';
    try {
      const imagen = new Image();
      url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(qr.current)], { type: 'image/svg+xml' }));
      await new Promise<void>((resolve, reject) => { imagen.onload = () => resolve(); imagen.onerror = () => reject(new Error('No se pudo generar el QR.')); imagen.src = url; });
      const canvas = document.createElement('canvas'); canvas.width = 900; canvas.height = 1240;
      const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('El navegador no permite generar la imagen.');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 900, 1240);
      ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, 900, 180);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 35px sans-serif';
      ctx.fillText('Colegio Nacional', 50, 70); ctx.fillText('Juan Eudoro Cáceres', 50, 125);
      ctx.fillStyle = '#0f172a'; ctx.font = 'bold 31px sans-serif';
      const texto = (valor: string, y: number, max: number) => {
        let linea = ''; let fila = y;
        for (const palabra of valor.split(/\s+/)) {
          if (linea && ctx.measureText(linea + ' ' + palabra).width > max) { ctx.fillText(linea, 50, fila, max); fila += 40; linea = palabra; }
          else linea += (linea ? ' ' : '') + palabra;
        }
        ctx.fillText(linea, 50, fila, max); return fila + 50;
      };
      let y = texto(e.nombre_completo, 240, 800);
      ctx.font = '27px sans-serif';
      y = texto('C.I. ' + e.ci, y, 800);
      y = texto('Curso: ' + e.curso, y, 800);
      y = texto('Especialidad: ' + (e.especialidad || 'Sin especialidad registrada'), y, 800);
      // Amplía el lienzo si un nombre o una especialidad requieren muchas líneas.
      const alto = Math.max(1240, y + 600);
      if (alto > canvas.height) {
        const copia = document.createElement('canvas'); copia.width = canvas.width; copia.height = canvas.height;
        copia.getContext('2d')!.drawImage(canvas, 0, 0); canvas.height = alto;
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, alto); ctx.drawImage(copia, 0, 0);
      }
      ctx.drawImage(imagen, 210, y + 10, 480, 480);
      ctx.fillStyle = '#475569'; ctx.font = '24px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('Carnet digital · Presentar para registrar asistencia', 450, y + 550, 800);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('No se pudo descargar el carnet.')), 'image/png'));
      descargarArchivo('carnet-' + e.id + '.png', blob);
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo descargar el carnet.'); }
    finally { if (url) URL.revokeObjectURL(url); setDescargando(false); }
  };
  return <article className="max-w-md mx-auto overflow-hidden rounded-3xl bg-white border border-gray-200 shadow-lg">
    <header className="bg-navy-900 p-6 text-white flex gap-3 items-center">
      <GraduationCap className="w-9 h-9 text-brand-300 shrink-0" />
      <div><p className="text-xs uppercase tracking-widest text-brand-300">Carnet digital</p>
        <h2 className="font-bold">Colegio Nacional<br />Juan Eudoro Cáceres</h2></div>
    </header>
    <div className="p-6 space-y-5">
      <div className="flex gap-4 items-center">
        {e.foto_url && <img src={e.foto_url} alt="Foto del estudiante" className="w-20 h-20 rounded-xl object-cover" />}
        <div><h3 className="font-bold text-xl text-navy-900 break-words">{e.nombre_completo}</h3>
          <p className="text-gray-500">C.I. {e.ci}</p></div>
      </div>
      <dl className="grid grid-cols-2 gap-4 text-sm"><div><dt className="text-gray-500">Curso</dt><dd className="font-semibold">{e.curso}</dd></div>
        <div><dt className="text-gray-500">Especialidad</dt><dd className="font-semibold">{e.especialidad || 'Sin especialidad registrada'}</dd></div></dl>
      <div className="flex justify-center bg-white rounded-xl p-2">
        <QRCodeSVG ref={qr} value={crearQR(e.id)} size={224} level="M" marginSize={4} title={`Carnet de ${e.nombre_completo}`} className="max-w-full h-auto" />
      </div>
      <p className="text-center text-xs text-gray-500">Presentá este código al docente o preceptor para registrar tu asistencia.</p>
      {error && <p role="alert" className="notice-error">{error}</p>}
      <button className="btn w-full" disabled={descargando} onClick={descargar}>{descargando ? 'Preparando carnet…' : 'Descargar carnet PNG'}</button>
    </div>
  </article>;
}
