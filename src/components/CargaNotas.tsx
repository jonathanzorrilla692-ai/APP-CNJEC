import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { calcularResultado, propuestaPolitica, puntajesVacios, validarPolitica, validarPuntajes } from '@/lib/academico';
import { fechaParaguay } from '@/lib/asistencia';
import { mensajeError } from '@/lib/errores';
import type { Calificacion, Estudiante, Materia, PoliticaAcademica, Puntajes } from '@/types';

const campos = [
  ['1.ª Etapa', 'etapa1_puntos', 'etapa1_maximo'],
  ['2.ª Etapa', 'etapa2_puntos', 'etapa2_maximo'],
  ['Proceso acumulativo', 'proceso_puntos', 'proceso_maximo'],
] as const;

export default function CargaNotas() {
  const { usuario } = useAuth();
  const [anio, setAnio] = useState(Number(fechaParaguay().slice(0, 4)));
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [estudiante, setEstudiante] = useState('');
  const [materia, setMateria] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [politica, setPolitica] = useState<PoliticaAcademica>(propuestaPolitica(anio));
  const [borrador, setBorrador] = useState<PoliticaAcademica>(propuestaPolitica(anio));
  const [puntajes, setPuntajes] = useState<Puntajes>(puntajesVacios());
  const [guardado, setGuardado] = useState<Calificacion | null>(null);
  const [loading, setLoading] = useState(true);
  const [cargandoNota, setCargandoNota] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [listo, setListo] = useState(false);

  useEffect(() => {
    let vigente = true;
    setLoading(true); setListo(false); setError(''); setGuardado(null);
    Promise.all([
      supabase.from('estudiantes').select('*').order('nombre_completo'),
      supabase.from('materias').select('*').order('nombre'),
      supabase.from('politicas_academicas').select('*').eq('anio', anio).maybeSingle(),
    ]).then(([e, m, p]) => {
      if (!vigente) return;
      const fallo = e.error || m.error || p.error;
      if (fallo) { setError(mensajeError(fallo)); return; }
      setEstudiantes(e.data || []); setMaterias(m.data || []);
      const regla = (p.data as PoliticaAcademica | null) || propuestaPolitica(anio);
      setPolitica(regla); setBorrador(regla); setListo(true);
    }).catch(e => { if (vigente) setError(mensajeError(e)); })
      .finally(() => { if (vigente) setLoading(false); });
    return () => { vigente = false; };
  }, [anio]);

  useEffect(() => {
    let vigente = true;
    setGuardado(null); setPuntajes(puntajesVacios()); setMensaje('');
    if (!listo || !estudiante || !materia) { setCargandoNota(false); return; }
    setCargandoNota(true); setError('');
    Promise.resolve(supabase.from('calificaciones_etapas').select('*')
      .eq('estudiante_id', estudiante).eq('materia_id', materia).eq('anio', anio).maybeSingle())
      .then(({ data, error }) => {
        if (!vigente) return;
        if (error) { setError(mensajeError(error)); setListo(false); return; }
        if (data) { setPuntajes(data); setGuardado(data); }
      }).catch(e => { if (vigente) { setError(mensajeError(e)); setListo(false); } })
      .finally(() => { if (vigente) setCargandoNota(false); });
    return () => { vigente = false; };
  }, [estudiante, materia, anio, listo]);

  const confirmarPolitica = async () => {
    if (!validarPolitica(borrador)) { setError('Los pesos positivos deben sumar 100; los límites deben ser crecientes entre 0 y 100.'); return; }
    setSaving(true); setError(''); setMensaje('');
    try {
      const { data, error } = await supabase.from('politicas_academicas')
        .upsert({ ...borrador, confirmada: true }, { onConflict: 'anio' }).select().single();
      if (error) throw error;
      setPolitica(data); setBorrador(data); setMensaje('Escala confirmada. Ya se pueden cargar puntajes.');
    } catch (e) { setError(mensajeError(e)); } finally { setSaving(false); }
  };

  const guardar = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!estudiante || !materia || !politica.confirmada || !validarPuntajes(puntajes)) {
      setError('Revisá la selección, los puntajes y la escala académica.'); return;
    }
    setSaving(true); setError(''); setMensaje('');
    const { etapa1_puntos, etapa1_maximo, etapa2_puntos, etapa2_maximo, proceso_puntos, proceso_maximo } = puntajes;
    try {
      const { data, error } = await supabase.from('calificaciones_etapas').upsert({
        estudiante_id: estudiante, materia_id: materia, anio, etapa1_puntos, etapa1_maximo,
        etapa2_puntos, etapa2_maximo, proceso_puntos, proceso_maximo,
      }, { onConflict: 'estudiante_id,materia_id,anio' }).select().single();
      if (error) throw error;
      setGuardado(data); setPuntajes(data); setMensaje('Puntajes guardados. Resultado calculado por la base de datos.');
    } catch (e) { setError(mensajeError(e)); } finally { setSaving(false); }
  };
  const resultado = validarPuntajes(puntajes) && validarPolitica(politica)
    ? calcularResultado(puntajes, politica) : { promedio: null, nota_final: null };
  return <div className="max-w-6xl mx-auto space-y-6">
    <header className="rounded-2xl bg-navy-900 p-6 text-white"><p className="text-brand-300 text-sm">Gestión académica</p>
      <h2 className="text-2xl font-bold">Planilla de calificaciones</h2><p className="mt-2 text-sm">Dos etapas · Proceso acumulativo · Nota final del 1 al 5</p></header>
    <label className="block font-semibold">Año lectivo<input aria-label="Año lectivo" type="number" min="2020" max="2100" value={anio} disabled={saving}
      onChange={e => { const n = Number(e.target.value); if (n >= 2020 && n <= 2100) setAnio(n); }} className="input mt-2 max-w-40" /></label>
    {error && <p role="alert" className="notice-error">{error}</p>}
    {mensaje && <p role="status" className="notice-success">{mensaje}</p>}
    {loading ? <p role="status">Cargando planilla…</p> : listo && <>
      <section className="panel">
        <h3 className="font-bold text-lg">Escala del colegio {politica.confirmada ? '· Confirmada' : '· Pendiente de confirmación'}</h3>
        <p className="text-sm text-gray-500 mt-2">Promedio porcentual = porcentaje obtenido en cada etapa y proceso, multiplicado por su peso. Se redondea a dos decimales antes de aplicar la escala.</p>
        {!politica.confirmada && <p className="mt-2 text-amber-800 text-sm">Los valores propuestos son editables. El directivo debe ajustarlos al reglamento del colegio y confirmarlos.</p>}
        {usuario?.rol === 'DIRECTIVO' && !politica.confirmada ? <>
          <div className="grid sm:grid-cols-3 gap-3 my-4">
            {([['peso_etapa1', 'Peso 1.ª Etapa (%)'], ['peso_etapa2', 'Peso 2.ª Etapa (%)'], ['peso_proceso', 'Peso proceso (%)'],
              ['minimo2', 'Mínimo para 2 (%)'], ['minimo3', 'Mínimo para 3 (%)'], ['minimo4', 'Mínimo para 4 (%)'], ['minimo5', 'Mínimo para 5 (%)']] as const).map(([key, label]) =>
              <label key={key} className="text-sm">{label}<input className="input mt-1" type="number" min="0.01" max="100" step="0.01"
                value={borrador[key]} disabled={saving} onChange={e => setBorrador({ ...borrador, [key]: Number(e.target.value) })} /></label>)}
          </div><button className="btn" disabled={saving} onClick={confirmarPolitica}>Confirmar escala del colegio</button>
        </> : <p className="mt-3 text-sm">Pesos: {politica.peso_etapa1}% / {politica.peso_etapa2}% / {politica.peso_proceso}%.
          Notas: 1 por debajo de {politica.minimo2}%; 2 desde {politica.minimo2}%; 3 desde {politica.minimo3}%; 4 desde {politica.minimo4}%; 5 desde {politica.minimo5}%.</p>}
      </section>
      <form onSubmit={guardar} className="panel space-y-5">
        <fieldset disabled={saving || cargandoNota} className="grid md:grid-cols-2 gap-4">
          <div><label className="block text-sm">Buscar estudiante<input className="input mt-1" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Nombre o C.I." /></label>
            <label className="block text-sm mt-3">Estudiante<select className="input mt-1" required value={estudiante} onChange={e => setEstudiante(e.target.value)}>
              <option value="">Seleccionar estudiante</option>{estudiantes.filter(e => e.id === estudiante || (e.nombre_completo + e.ci).toLowerCase().includes(busqueda.toLowerCase())).map(e => <option key={e.id} value={e.id}>{e.nombre_completo} · {e.curso}</option>)}
            </select></label></div>
          <label className="text-sm">Materia<select className="input mt-1" required value={materia} onChange={e => setMateria(e.target.value)}>
            <option value="">Seleccionar materia</option>{materias.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
          </select></label>
        </fieldset>
        {cargandoNota && <p role="status">Cargando puntajes…</p>}
        <fieldset disabled={!politica.confirmada || !estudiante || !materia || saving || cargandoNota} className="grid md:grid-cols-3 gap-4">
          {campos.map(([label, puntos, maximo]) => <div key={puntos} className="rounded-xl bg-gray-50 p-4">
            <h3 className="font-bold mb-3">{label}</h3>
            <label className="text-sm block">Puntaje obtenido<input className="input mt-1" type="number" step="0.01" min="0" max={puntajes[maximo]} value={puntajes[puntos] ?? ''}
              onChange={e => { setGuardado(null); setPuntajes({ ...puntajes, [puntos]: e.target.value === '' ? null : Number(e.target.value) }); }} placeholder="Pendiente" /></label>
            <label className="text-sm block mt-3">Puntaje máximo<input className="input mt-1" type="number" step="0.01" min="0.01" max="100000" required value={puntajes[maximo]}
              onChange={e => { setGuardado(null); setPuntajes({ ...puntajes, [maximo]: Number(e.target.value) }); }} /></label>
          </div>)}
        </fieldset>
        <div className="rounded-xl bg-navy-900 text-white p-5 flex flex-wrap gap-8">
          <div><p className="text-sm text-brand-300">Promedio porcentual</p><p className="text-3xl font-bold">{resultado.promedio === null ? 'Pendiente' : resultado.promedio.toFixed(2) + '%'}</p></div>
          <div><p className="text-sm text-brand-300">Nota final</p><p className="text-3xl font-bold">{resultado.nota_final ?? '—'} <small className="text-base">/ 5</small></p></div>
        </div>
        <p className="text-sm text-gray-500">{guardado ? 'Resultado guardado en Supabase.' : 'Vista de cálculo antes de guardar.'} Dejá en blanco los puntajes pendientes; cero significa una evaluación realizada sin puntos.</p>
        <button className="btn" disabled={saving || cargandoNota || !politica.confirmada || !estudiante || !materia}>{saving ? 'Guardando…' : 'Guardar puntajes'}</button>
      </form>
    </>}
  </div>;
}
