import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { mensajeError } from '@/lib/errores';
import type { Estudiante } from '@/types';
import CarnetDigital from './CarnetDigital';
export default function Carnets() {
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [id, setId] = useState('');
  const [buscar, setBuscar] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let vivo = true;
    Promise.resolve(supabase.from('estudiantes').select('*').order('nombre_completo')).then(({ data, error }) => {
      if (!vivo) return;
      if (error) throw error;
      setEstudiantes(data || []); setId(data?.[0]?.id || '');
    }).catch(e => { if (vivo) setError(mensajeError(e)); })
      .finally(() => { if (vivo) setLoading(false); });
    return () => { vivo = false; };
  }, []);
  const estudiante = estudiantes.find(e => e.id === id);
  return <div className="max-w-4xl mx-auto space-y-6">
    <header className="bg-navy-900 text-white p-6 rounded-2xl"><p className="text-brand-300 text-sm">Identificación escolar</p><h2 className="text-2xl font-bold">Carnets digitales</h2></header>
    {error && <p role="alert" className="notice-error">{error}</p>}
    {loading ? <p role="status">Cargando carnets…</p> : <>
      <div className="panel grid sm:grid-cols-2 gap-4">
        <label className="text-sm">Buscar por nombre o C.I.<input className="input mt-1" value={buscar} onChange={e => setBuscar(e.target.value)} /></label>
        <label className="text-sm">Estudiante<select className="input mt-1" value={id} onChange={e => setId(e.target.value)}><option value="">Seleccionar</option>
          {estudiantes.filter(e => e.id === id || (e.nombre_completo + e.ci).toLowerCase().includes(buscar.toLowerCase())).map(e => <option key={e.id} value={e.id}>{e.nombre_completo}</option>)}
        </select></label>
      </div>
      {estudiante ? <CarnetDigital estudiante={estudiante} /> : <p>Seleccioná un estudiante para ver su carnet.</p>}
    </>}
  </div>;
}
