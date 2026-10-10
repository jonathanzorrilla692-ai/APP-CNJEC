import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { estados, fechaParaguay } from '@/lib/asistencia';
import { mensajeError } from '@/lib/errores';
import { crearCSV, descargarArchivo } from '@/lib/descargas';
import type { Asistencia, EstadoAsistencia } from '@/types';
const TAMANO = 50;
type Filtros = { desde: string; hasta: string; estado: '' | EstadoAsistencia };
export default function HistorialAsistencia() {
  const hoy = fechaParaguay();
  const [filtros, setFiltros] = useState<Filtros>({ desde: hoy.slice(0, 7) + '-01', hasta: hoy, estado: '' });
  const [aplicados, setAplicados] = useState(filtros);
  const [pagina, setPagina] = useState(0);
  const [registros, setRegistros] = useState<Asistencia[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [exportando, setExportando] = useState(false);
  const consultar = useCallback((desde: number, hasta: number) => {
    let q = supabase.from('asistencia_diaria').select('*, estudiante:estudiantes(*)', { count: 'exact' })
      .gte('fecha', aplicados.desde).lte('fecha', aplicados.hasta);
    if (aplicados.estado) q = q.eq('estado', aplicados.estado);
    return q.order('fecha', { ascending: false }).order('id').range(desde, hasta);
  }, [aplicados]);
  useEffect(() => {
    let vivo = true;
    setLoading(true); setError(''); setRegistros([]);
    Promise.resolve(consultar(pagina * TAMANO, (pagina + 1) * TAMANO - 1))
      .then(({ data, error, count }) => {
        if (!vivo) return;
        if (error) throw error;
        setRegistros(data || []); setTotal(count || 0);
      }).catch(e => { if (vivo) { setError(mensajeError(e)); setTotal(0); } })
      .finally(() => { if (vivo) setLoading(false); });
    return () => { vivo = false; };
  }, [consultar, pagina]);
  const aplicar = (e: React.FormEvent) => {
    e.preventDefault();
    if (filtros.desde > filtros.hasta) { setError('La fecha inicial debe ser anterior o igual a la final.'); return; }
    setPagina(0); setAplicados({ ...filtros }); setError('');
  };
  const exportar = async () => {
    setExportando(true); setError('');
    try {
      const filas: (string | number)[][] = [['Fecha', 'Hora', 'Estudiante', 'C.I.', 'Curso', 'Estado']];
      // Respeta el límite de filas de la API; no exporta solo la página visible.
      for (let desde = 0; ; desde += 1000) {
        const { data, error } = await consultar(desde, desde + 999);
        if (error) throw error;
        for (const a of (data || []) as Asistencia[]) filas.push([a.fecha, a.hora, a.estudiante?.nombre_completo || '', a.estudiante?.ci || '', a.estudiante?.curso || '', estados[a.estado]]);
        if (!data || data.length < 1000) break;
      }
      descargarArchivo(`asistencia-${aplicados.desde}-${aplicados.hasta}.csv`, new Blob([crearCSV(filas)], { type: 'text/csv;charset=utf-8' }));
    } catch (e) { setError(mensajeError(e)); } finally { setExportando(false); }
  };
  return <div className="max-w-6xl mx-auto space-y-6">
    <header className="bg-navy-900 text-white p-6 rounded-2xl"><p className="text-brand-300 text-sm">Seguimiento escolar</p><h2 className="text-2xl font-bold">Historial de asistencia</h2></header>
    {error && <p role="alert" className="notice-error">{error}</p>}
    <form onSubmit={aplicar} className="panel flex flex-wrap items-end gap-4">
      <fieldset disabled={loading || exportando} className="flex flex-wrap gap-4">
        <label className="text-sm">Desde<input className="input mt-1" type="date" required value={filtros.desde} onChange={e => setFiltros({ ...filtros, desde: e.target.value })} /></label>
        <label className="text-sm">Hasta<input className="input mt-1" type="date" required value={filtros.hasta} onChange={e => setFiltros({ ...filtros, hasta: e.target.value })} /></label>
        <label className="text-sm">Estado<select className="input mt-1" value={filtros.estado} onChange={e => setFiltros({ ...filtros, estado: e.target.value as Filtros['estado'] })}><option value="">Todos</option>{Object.entries(estados).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      </fieldset><button className="btn" disabled={loading || exportando}>Consultar</button>
      <button className="btn-secondary" type="button" disabled={loading || exportando || total === 0} onClick={exportar}>{exportando ? 'Preparando archivo…' : 'Descargar CSV'}</button>
    </form>
    <section className="panel space-y-4">
      <p className="text-sm text-gray-500">{total} registros · Un día sin registro no se considera ausencia.</p>
      {loading ? <p role="status">Cargando historial…</p> : registros.length === 0 ? <p>{error ? 'No se pudo cargar el historial.' : 'No hay registros para estos filtros.'}</p> : <div className="overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap"><thead className="bg-gray-50"><tr>{['Fecha', 'Estudiante', 'Curso', 'Hora', 'Estado'].map(t => <th className="p-3" key={t}>{t}</th>)}</tr></thead>
          <tbody>{registros.map(a => <tr className="border-t" key={a.id}><td className="p-3">{a.fecha}</td><td className="p-3">{a.estudiante?.nombre_completo}<p className="text-xs text-gray-500">{a.estudiante?.ci}</p></td><td className="p-3">{a.estudiante?.curso}</td><td className="p-3">{a.hora.slice(0, 5)}</td><td className="p-3 font-semibold">{estados[a.estado]}</td></tr>)}</tbody></table>
      </div>}
      <nav aria-label="Páginas del historial" className="flex justify-between items-center gap-3">
        <button className="btn-secondary" disabled={loading || pagina === 0 || exportando} onClick={() => setPagina(p => p - 1)}>Anterior</button>
        <span className="text-sm">Página {pagina + 1} de {Math.max(1, Math.ceil(total / TAMANO))}</span>
        <button className="btn-secondary" disabled={loading || (pagina + 1) * TAMANO >= total || exportando} onClick={() => setPagina(p => p + 1)}>Siguiente</button>
      </nav>
    </section>
  </div>;
}
