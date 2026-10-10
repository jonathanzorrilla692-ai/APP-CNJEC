import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useActualizacion } from '@/hooks/useActualizacion';
import { estados, fechaParaguay } from '@/lib/asistencia';
import { mensajeError } from '@/lib/errores';
import CarnetDigital from './CarnetDigital';
import type { Asistencia, Calificacion, Estudiante } from '@/types';

export default function PanelEstudiante({ modo = 'resumen', alumno = false }: { modo?: 'resumen' | 'notas' | 'carnet'; alumno?: boolean }) {
  const { usuario } = useAuth();
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [id, setId] = useState('');
  const [anio, setAnio] = useState(Number(fechaParaguay().slice(0, 4)));
  const [notas, setNotas] = useState<Calificacion[]>([]);
  const [asistencia, setAsistencia] = useState<Asistencia[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const secuencia = useRef(0);
  useEffect(() => {
    let vigente = true;
    if (!usuario) return;
    supabase.from('estudiantes').select('*').eq(alumno ? 'id_link' : 'tutor_id', usuario.id).order('nombre_completo')
      .then(({ data, error }) => {
        if (!vigente) return;
        if (error) setError(mensajeError(error));
        else { setEstudiantes(data || []); setId(data?.[0]?.id || ''); }
        setLoading(false);
      });
    return () => { vigente = false; };
  }, [usuario, alumno]);
  const cargar = useCallback(async () => {
    if (!id) return;
    const turno = ++secuencia.current;
    const [n, a] = await Promise.all([
      supabase.from('calificaciones_etapas').select('*, materia:materias(*)').eq('estudiante_id', id).eq('anio', anio),
      supabase.from('asistencia_diaria').select('*').eq('estudiante_id', id).order('fecha', { ascending: false }).limit(30),
    ]);
    if (turno !== secuencia.current) return;
    setError(n.error || a.error ? mensajeError(n.error || a.error) : '');
    setNotas(n.data || []); setAsistencia(a.data || []);
  }, [id, anio]);
  useEffect(() => {
    const contador = secuencia;
    setNotas([]); setAsistencia([]); void cargar();
    return () => { contador.current++; };
  }, [cargar]);
  useActualizacion('calificaciones_etapas', cargar);
  useActualizacion('asistencia_diaria', cargar);
  const estudiante = estudiantes.find(e => e.id === id);
  const finales = notas.filter(n => n.nota_final !== null);
  const promedio = finales.length ? (finales.reduce((sum, n) => sum + n.nota_final!, 0) / finales.length).toFixed(2) : 'Pendiente';
  if (loading) return <p role="status">Cargando estudiantes…</p>;
  return <div className="max-w-6xl mx-auto space-y-6">
    {error && <p role="alert" className="notice-error">{error}</p>}
    {!estudiante ? <section className="panel">No hay estudiantes vinculados a esta cuenta. Solicitá al colegio que revise la vinculación.</section> : <>
      <header className="rounded-2xl bg-navy-900 text-white p-6"><p className="text-brand-300 text-sm">{alumno ? 'Mi espacio académico' : 'Panel de familias'}</p><h2 className="text-2xl font-bold">{estudiante.nombre_completo}</h2><p className="mt-2">{estudiante.curso} · C.I. {estudiante.ci}</p></header>
      {estudiantes.length > 1 && <label className="block">Estudiante<select className="input mt-1" value={id} onChange={e => setId(e.target.value)}>{estudiantes.map(e => <option key={e.id} value={e.id}>{e.nombre_completo}</option>)}</select></label>}
      {(modo === 'carnet' || modo === 'resumen') && <CarnetDigital estudiante={estudiante} />}
      {modo !== 'carnet' && <section className="panel space-y-4">
        <div className="flex flex-wrap gap-4 justify-between"><h3 className="text-lg font-bold">Calificaciones por etapas</h3>
          <label>Año <input className="input inline-block w-28" type="number" min="2020" max="2100" value={anio} onChange={e => { const n = Number(e.target.value); if (n >= 2020 && n <= 2100) setAnio(n); }} /></label></div>
        <p className="text-gray-500 text-sm">Promedio de notas finales: <strong className="text-navy-900">{promedio}{finales.length > 0 && ' / 5'}</strong></p>
        {notas.length === 0 ? <p>No hay calificaciones para este año.</p> : <div className="overflow-x-auto"><table className="w-full text-sm text-left whitespace-nowrap"><thead className="bg-gray-50"><tr>{['Materia', '1.ª Etapa', '2.ª Etapa', 'Proceso acumulativo', 'Promedio (%)', 'Nota final'].map(t => <th className="p-3" key={t}>{t}</th>)}</tr></thead><tbody>
          {notas.map(n => <tr key={n.id} className="border-t border-gray-100"><td className="p-3 font-semibold">{n.materia?.nombre}</td>
            <td className="p-3">{n.etapa1_puntos === null ? 'Pendiente' : n.etapa1_puntos + ' / ' + n.etapa1_maximo}</td>
            <td className="p-3">{n.etapa2_puntos === null ? 'Pendiente' : n.etapa2_puntos + ' / ' + n.etapa2_maximo}</td>
            <td className="p-3">{n.proceso_puntos === null ? 'Pendiente' : n.proceso_puntos + ' / ' + n.proceso_maximo}</td>
            <td className="p-3">{n.promedio === null ? '—' : Number(n.promedio).toFixed(2)}</td><td className="p-3 font-bold">{n.nota_final ?? 'Pendiente'}</td></tr>)}
        </tbody></table></div>}
      </section>}
      {modo === 'resumen' && <section className="panel"><h3 className="font-bold text-lg mb-4">Asistencia reciente</h3><p className="text-sm text-gray-500 mb-3">Últimos 30 registros. Un día sin registro no se considera una ausencia.</p>
        {asistencia.length === 0 ? <p>Sin registros.</p> : <ul className="space-y-2">{asistencia.map(a => <li key={a.id} className="rounded-xl bg-gray-50 p-3 flex justify-between gap-3"><span>{a.fecha} · {a.hora.slice(0, 5)}</span><strong>{estados[a.estado]}</strong></li>)}</ul>}
      </section>}
    </>}
  </div>;
}
