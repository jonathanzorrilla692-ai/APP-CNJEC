import { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, CameraOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { leerQR, estados } from '@/lib/asistencia';
import { mensajeError } from '@/lib/errores';
import type { Asistencia, EstadoAsistencia, Estudiante } from '@/types';

export default function QRScanner({ onScanComplete }: { onScanComplete?: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const frame = useRef(0);
  const generacion = useRef(0);
  const busy = useRef(false);
  const [activo, setActivo] = useState(false);
  const [iniciando, setIniciando] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState('');
  const [estudiante, setEstudiante] = useState<Estudiante | null>(null);
  const [estado, setEstado] = useState<EstadoAsistencia>('PRESENTE');
  const [registro, setRegistro] = useState<Asistencia | null>(null);
  const [codigo, setCodigo] = useState('');

  const detener = useCallback(() => {
    generacion.current++;
    cancelAnimationFrame(frame.current);
    stream.current?.getTracks().forEach(t => t.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
    setActivo(false); setIniciando(false);
  }, []);
  useEffect(() => () => { generacion.current++; cancelAnimationFrame(frame.current); stream.current?.getTracks().forEach(t => t.stop()); }, []);

  const identificar = useCallback(async (valor: string) => {
    if (busy.current) return;
    busy.current = true; detener(); setProcesando(true); setError(''); setRegistro(null); setEstudiante(null);
    const intento = generacion.current;
    try {
      const id = leerQR(valor.trim());
      const { data, error } = await supabase.from('estudiantes').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Estudiante no encontrado o sin permiso de acceso.');
      if (intento === generacion.current) setEstudiante(data);
    } catch (e) { if (intento === generacion.current) setError(mensajeError(e)); }
    finally { busy.current = false; setProcesando(false); }
  }, [detener]);

  const iniciar = async () => {
    if (iniciando || busy.current) return;
    detener(); const intento = generacion.current;
    setIniciando(true); setError(''); setEstudiante(null); setRegistro(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('La cámara necesita HTTPS o localhost y un navegador compatible.');
      const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      if (intento !== generacion.current) { media.getTracks().forEach(t => t.stop()); return; }
      stream.current = media;
      if (!video.current) { detener(); return; }
      video.current.srcObject = media; await video.current.play();
      if (intento !== generacion.current) return;
      setActivo(true); setIniciando(false);
      const escanear = () => {
        if (intento !== generacion.current) return;
        const v = video.current; const c = canvas.current;
        if (v && c && v.readyState >= 2 && v.videoWidth > 0) {
          c.width = v.videoWidth; c.height = v.videoHeight;
          const context = c.getContext('2d', { willReadFrequently: true });
          if (context) {
            context.drawImage(v, 0, 0);
            const imagen = context.getImageData(0, 0, c.width, c.height);
            const qr = jsQR(imagen.data, imagen.width, imagen.height);
            if (qr?.data) { void identificar(qr.data); return; }
          }
        }
        frame.current = requestAnimationFrame(escanear);
      };
      frame.current = requestAnimationFrame(escanear);
    } catch (e) { if (intento === generacion.current) { detener(); setError(mensajeError(e)); } }
  };

  const guardar = async () => {
    if (!estudiante || busy.current) return;
    busy.current = true; setProcesando(true); setError('');
    try {
      const { data, error } = await supabase.rpc('registrar_asistencia', { p_estudiante_id: estudiante.id, p_estado: estado });
      if (error) throw error;
      setRegistro(data as Asistencia); onScanComplete?.();
    } catch (e) { setError(mensajeError(e)); }
    finally { busy.current = false; setProcesando(false); }
  };
  return <section className="panel space-y-4">
    <div><h3 className="text-lg font-bold">Escáner de asistencia</h3><p className="text-sm text-gray-500">Escaneá el carnet, verificá al estudiante y confirmá su estado.</p></div>
    <div className="aspect-video rounded-2xl bg-navy-900 overflow-hidden relative">
      <video ref={video} muted playsInline className="w-full h-full object-cover" aria-label="Vista de cámara" />
      {!activo && <div className="absolute inset-0 flex items-center justify-center text-white/70"><Camera className="w-12 h-12" /></div>}
    </div><canvas ref={canvas} className="hidden" />
    <div className="flex flex-wrap gap-3">
      <button className="btn" onClick={iniciar} disabled={procesando || iniciando || activo}><Camera className="w-4 h-4" />{iniciando ? 'Iniciando…' : 'Activar cámara'}</button>
      {(activo || iniciando) && <button className="btn-secondary" onClick={detener}><CameraOff className="w-4 h-4" />Detener</button>}
    </div>
    <form onSubmit={e => { e.preventDefault(); void identificar(codigo); }} className="space-y-2">
      <label className="text-sm block">Código leído por un lector externo<input className="input mt-1" value={codigo} onChange={e => setCodigo(e.target.value)} placeholder="CNJEC:1:…" disabled={procesando} /></label>
      <button className="btn-secondary" disabled={procesando || !codigo.trim()}>Buscar carnet</button>
    </form>
    {procesando && <p role="status">Procesando…</p>}
    {error && <p role="alert" className="notice-error">{error}</p>}
    {estudiante && <div className="bg-gray-50 rounded-xl p-4 space-y-3">
      <h4 className="font-bold">{estudiante.nombre_completo}</h4><p className="text-sm">C.I. {estudiante.ci} · {estudiante.curso}</p>
      {estudiante.foto_url && <img src={estudiante.foto_url} alt="Foto del estudiante" className="h-20 w-20 rounded-xl object-cover" />}
      <label className="block text-sm">Estado de asistencia<select className="input mt-1" value={estado} onChange={e => { setEstado(e.target.value as EstadoAsistencia); setRegistro(null); }} disabled={procesando}>
        {Object.entries(estados).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <button className="btn" disabled={procesando || !!registro} onClick={guardar}>Confirmar asistencia</button>
      <p className="text-xs text-gray-500">Un registro por estudiante y día. Confirmar otro estado corrige el registro de hoy.</p>
    </div>}
    {registro && <p role="status" className="notice-success">{estados[registro.estado]} · {registro.fecha} · {registro.hora.slice(0, 5)}. Guardado en Supabase.</p>}
  </section>;
}
