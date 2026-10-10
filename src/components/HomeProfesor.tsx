import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useActualizacion } from '@/hooks/useActualizacion';
import { estados, fechaParaguay } from '@/lib/asistencia';
import { mensajeError } from '@/lib/errores';
import QRScanner from './QRScanner';
import type { Asistencia, Estudiante, EstadoAsistencia } from '@/types';

export default function HomeProfesor({ scanner = false }: { scanner?: boolean }) {
  const [registros, setRegistros] = useState<Asistencia[]>([]);
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [guardando, setGuardando] = useState('');
  const busy = useRef(false);
  const [loading, setLoading] = useState(true);
  const cargar = useCallback(async () => {
    const [a, e] = await Promise.all([
      supabase.from('asistencia_diaria').select('*, estudiante:estudiantes(*)').eq('fecha', fechaParaguay()).order('updated_at', { ascending: false }),
      supabase.from('estudiantes').select('*').order('nombre_completo'),
    ]);
    setError(a.error || e.error ? mensajeError(a.error || e.error) : '');
    setRegistros(a.data || []); setEstudiantes(e.data || []); setLoading(false);
  }, []);
  useEffect(() => { void cargar(); }, [cargar]);
  useActualizacion('asistencia_diaria', cargar);
  const registrar = async (id: string, estado: EstadoAsistencia) => {
    if (busy.current) return;
    busy.current = true; setGuardando(id); setError(''); setMensaje('');
    try {
      const { error } = await supabase.rpc('registrar_asistencia', { p_estudiante_id: id, p_estado: estado });
      if (error) throw error;
      await cargar(); setMensaje('Asistencia guardada correctamente.');
    } catch (e) { setError(mensajeError(e)); } finally { busy.current = false; setGuardando(''); }
  };
  return <div className="max-w-6xl mx-auto space-y-6">
    <header className="bg-navy-900 text-white p-6 rounded-2xl"><p className="text-brand-300 text-sm">{fechaParaguay()} · Hora de Paraguay</p><h2 className="text-2xl font-bold mt-1">Asistencia del colegio</h2></header>
    {error && <p role="alert" className="notice-error">{error}</p>}
    {mensaje && <p role="status" className="notice-success">{mensaje}</p>}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Object.entries(estados).map(([estado, label]) => <div key={estado} className="panel"><p className="text-sm text-gray-500">{label}</p><strong className="text-3xl">{error || loading ? '—' : registros.filter(r => r.estado === estado).length}</strong></div>)}
      <div className="panel"><p className="text-sm text-gray-500">Sin registrar</p><strong className="text-3xl">{error || loading ? '—' : Math.max(0, estudiantes.length - registros.length)}</strong></div>
    </div>
    {scanner && <QRScanner onScanComplete={cargar} />}
    <section className="panel space-y-4"><h3 className="font-bold text-lg">Lista de estudiantes</h3><p className="text-sm text-gray-500">Registrá ausencias o corregí el estado de hoy. La lista se actualiza en tiempo real.</p>
      <label className="block text-sm">Buscar por nombre, C.I. o curso<input className="input mt-1" value={busqueda} onChange={e => setBusqueda(e.target.value)} /></label>
      {loading ? <p>Cargando asistencia…</p> : error ? <button className="btn-secondary" onClick={cargar}>Volver a cargar</button> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-3">Estudiante</th><th className="p-3">Estado hoy</th><th className="p-3">Registrar / corregir</th></tr></thead><tbody>
        {estudiantes.filter(e => (e.nombre_completo + e.ci + e.curso).toLowerCase().includes(busqueda.toLowerCase())).map(e => {
          const r = registros.find(r => r.estudiante_id === e.id);
          return <tr key={e.id} className="border-t"><td className="p-3"><strong>{e.nombre_completo}</strong><p className="text-xs text-gray-500">{e.ci} · {e.curso}</p></td><td className="p-3">{r ? estados[r.estado] : 'Sin registrar'}{r && <p className="text-xs text-gray-500">{r.hora.slice(0, 5)}</p>}</td>
            <td className="p-3"><select aria-label={`Registrar asistencia de ${e.nombre_completo}`} className="input min-w-40" value="" disabled={!!guardando} onChange={event => { if (event.target.value) void registrar(e.id, event.target.value as EstadoAsistencia); }}>
              <option value="">{guardando === e.id ? 'Guardando…' : 'Seleccionar estado'}</option>{Object.entries(estados).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select></td></tr>;
        })}
      </tbody></table>{estudiantes.length === 0 && <p>No hay estudiantes registrados.</p>}</div>}
    </section>
  </div>;
}
