import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { fechaParaguay } from '@/lib/asistencia';
import { mensajeError } from '@/lib/errores';
import { entradaVacia, estadosMedia, minimoDos, notaEtapa, resultadoMedia, validarEtapa } from '@/lib/media';
import type { EntradaMedia, EtapaMedia } from '@/lib/media';
import type { Calificacion, Estudiante, Materia, Nota } from '@/types';

function EditorEtapa({ titulo, etapa, cambiar }: { titulo: string; etapa: EtapaMedia; cambiar: (e: EtapaMedia) => void }) {
  const valor = validarEtapa(etapa) ? notaEtapa(etapa) : null;
  return <section className="rounded-xl bg-gray-50 p-4 space-y-3">
    <h3 className="font-bold text-lg">{titulo}</h3>
    <label className="block text-sm">Forma de carga<select className="input mt-1" value={etapa.modo}
      onChange={e => cambiar({ ...etapa, modo: e.target.value as EtapaMedia['modo'], nota: null, puntos: null })}>
      <option value="NOTA">Nota de etapa (1 a 5)</option><option value="PUNTAJE">Puntajes / indicadores</option>
    </select></label>
    {etapa.modo === 'NOTA' ? <label className="block text-sm">Nota de {titulo}<select className="input mt-1" value={etapa.nota ?? ''}
      onChange={e => cambiar({ ...etapa, nota: e.target.value === '' ? null : Number(e.target.value) as Nota })}>
      <option value="">Pendiente</option>{[1, 2, 3, 4, 5].map(n => <option key={n}>{n}</option>)}
    </select></label> : <>
      <p className="text-sm text-gray-600">Indicadores enteros. El ejemplo inicial es sobre 60 puntos: 42 / 47 / 52 / 57. Verificá los cortes de la planilla antes de guardar.</p>
      <label className="block text-sm">Total de indicadores<input className="input mt-1" type="number" min="10" max="100000" step="1" required value={etapa.maximo}
        onChange={e => cambiar({ ...etapa, maximo: Number(e.target.value), minimo3: null, minimo4: null, minimo5: null })} /></label>
      <p className="text-sm">Nota 2 desde <strong>{minimoDos(etapa.maximo)}</strong> puntos (mínimo del 70%).</p>
      <div className="grid grid-cols-3 gap-2">{(['minimo3', 'minimo4', 'minimo5'] as const).map((campo, i) =>
        <label key={campo} className="text-sm">Mínimo para {i + 3}<input className="input mt-1" type="number" min={minimoDos(etapa.maximo) + 1} max={etapa.maximo} step="1" required
          value={etapa[campo] ?? ''} onChange={e => cambiar({ ...etapa, [campo]: e.target.value === '' ? null : Number(e.target.value) })} /></label>)}</div>
      <label className="block text-sm">Indicadores logrados<input className="input mt-1" type="number" min="0" max={etapa.maximo} step="1" placeholder="Pendiente"
        value={etapa.puntos ?? ''} onChange={e => cambiar({ ...etapa, puntos: e.target.value === '' ? null : Number(e.target.value) })} /></label>
      {!validarEtapa(etapa) && <p className="text-sm text-red-700">Los cortes deben ser enteros crecientes, superiores al mínimo de 2 y no superar el total.</p>}
      <p className="font-semibold">Nota de etapa: {valor ?? 'Pendiente'}</p>
    </>}
    <label className="block text-sm">Proceso acumulativo: observaciones<textarea className="input mt-1" maxLength={2000} rows={3}
      placeholder="Capacidades logradas, evidencias y aprendizajes por reforzar" value={etapa.proceso} onChange={e => cambiar({ ...etapa, proceso: e.target.value })} /></label>
  </section>;
}

export default function CargaNotas() {
  const [anio, setAnio] = useState(Number(fechaParaguay().slice(0, 4)));
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [estudiante, setEstudiante] = useState('');
  const [materia, setMateria] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [entrada, setEntrada] = useState<EntradaMedia>(entradaVacia());
  const [historico, setHistorico] = useState<Calificacion | null>(null);
  const [loading, setLoading] = useState(true);
  const [cargandoNota, setCargandoNota] = useState(false);
  const [listo, setListo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  useEffect(() => {
    let activo = true;
    Promise.all([supabase.from('estudiantes').select('*').order('nombre_completo'), supabase.from('materias').select('*').order('nombre')])
      .then(([e, m]) => { if (!activo) return; if (e.error || m.error) throw e.error || m.error;
        setEstudiantes(e.data || []); setMaterias(m.data || []); })
      .catch(e => { if (activo) setError(mensajeError(e)); }).finally(() => { if (activo) setLoading(false); });
    return () => { activo = false; };
  }, []);
  useEffect(() => {
    let activo = true;
    setListo(false); setEntrada(entradaVacia()); setHistorico(null); setMensaje(''); setError('');
    if (!estudiante || !materia) { setCargandoNota(false); return; }
    setCargandoNota(true);
    Promise.all([
      supabase.from('calificaciones_media').select('*').eq('estudiante_id', estudiante).eq('materia_id', materia).eq('anio', anio).maybeSingle(),
      supabase.from('calificaciones_etapas').select('*').eq('estudiante_id', estudiante).eq('materia_id', materia).eq('anio', anio).maybeSingle(),
    ]).then(([n, h]) => {
      if (!activo) return; if (n.error || h.error) throw n.error || h.error;
      if (n.data) setEntrada({ etapa1: n.data.etapa1, etapa2: n.data.etapa2 });
      setHistorico(h.data); setListo(true);
    }).catch(e => { if (activo) setError(mensajeError(e)); }).finally(() => { if (activo) setCargandoNota(false); });
    return () => { activo = false; };
  }, [estudiante, materia, anio]);
  const valido = validarEtapa(entrada.etapa1) && validarEtapa(entrada.etapa2);
  const resultado = valido ? resultadoMedia(entrada) : null;
  const guardar = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!listo || !valido || saving) return;
    setSaving(true); setError(''); setMensaje('');
    try {
      const { data, error } = await supabase.from('calificaciones_media').upsert({
        estudiante_id: estudiante, materia_id: materia, anio, etapa1: entrada.etapa1, etapa2: entrada.etapa2,
      }, { onConflict: 'estudiante_id,materia_id,anio' }).select().single();
      if (error) throw error;
      setEntrada({ etapa1: data.etapa1, etapa2: data.etapa2 }); setMensaje('Calificaciones guardadas y calculadas por la base de datos.');
    } catch (e) { setError(mensajeError(e)); } finally { setSaving(false); }
  };
  const cambiar = (campo: keyof EntradaMedia, e: EtapaMedia) => { setEntrada(prev => ({ ...prev, [campo]: e })); setMensaje(''); };
  return <div className="max-w-6xl mx-auto space-y-6">
    <header className="rounded-2xl bg-navy-900 p-6 text-white"><p className="text-brand-300 text-sm">Educación Media · Período ordinario</p>
      <h2 className="text-2xl font-bold">Planilla de calificaciones</h2><p className="mt-2 text-sm">1.ª etapa y 2.ª etapa · Nota final de 1 a 5</p></header>
    <section className="panel text-sm space-y-2"><p>Promedio = (nota de 1.ª etapa + nota de 2.ª etapa) / 2. Para aprobar: suma mínima de 4 y segunda etapa de al menos 2.</p>
      <p>Una vez cumplidas esas condiciones, 2,5 → 3; 3,5 → 4; 4,5 → 5. Si no se cumplen, la nota final es 1.</p>
      <p>El proceso integra cada etapa. Esta planilla corresponde a disciplinas de dos etapas; no determina la promoción completa del curso ni evalúa el proyecto educativo o módulos especiales.</p></section>
    {error && <p role="alert" className="notice-error">{error}</p>}{mensaje && <p role="status" className="notice-success">{mensaje}</p>}
    {loading ? <p role="status">Cargando planilla…</p> : <form onSubmit={guardar} className="panel space-y-5">
      <fieldset disabled={saving || cargandoNota} className="grid md:grid-cols-3 gap-4">
        <label className="text-sm">Año lectivo<input className="input mt-1" type="number" min="2020" max="2100" value={anio}
          onChange={e => { const n = Number(e.target.value); if (Number.isInteger(n) && n >= 2020 && n <= 2100) setAnio(n); }} /></label>
        <div><label className="text-sm">Buscar estudiante<input className="input mt-1" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Nombre o C.I." /></label>
          <label className="block text-sm mt-2">Estudiante<select className="input mt-1" required value={estudiante} onChange={e => setEstudiante(e.target.value)}><option value="">Seleccionar estudiante</option>
            {estudiantes.filter(e => e.id === estudiante || (e.nombre_completo + e.ci).toLowerCase().includes(busqueda.toLowerCase())).map(e => <option key={e.id} value={e.id}>{e.nombre_completo} · {e.curso}</option>)}</select></label></div>
        <label className="text-sm">Materia<select className="input mt-1" required value={materia} onChange={e => setMateria(e.target.value)}><option value="">Seleccionar materia</option>
          {materias.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}</select></label>
      </fieldset>
      {historico && <details className="rounded-xl bg-amber-50 p-4 text-sm"><summary>Planilla anterior conservada · revisar antes de cargar las nuevas etapas</summary>
        <p className="mt-2">Modelo anterior: 1.ª etapa {historico.etapa1_puntos ?? 'Pendiente'} / {historico.etapa1_maximo}; 2.ª etapa {historico.etapa2_puntos ?? 'Pendiente'} / {historico.etapa2_maximo}; proceso {historico.proceso_puntos ?? 'Pendiente'} / {historico.proceso_maximo}. Resultado anterior: {historico.nota_final ?? 'Pendiente'}.</p>
        <p>No se convirtió automáticamente a la nueva escala.</p></details>}
      {cargandoNota && <p role="status">Cargando calificaciones…</p>}
      <fieldset disabled={!listo || saving || cargandoNota} className="grid md:grid-cols-2 gap-4">
        <EditorEtapa titulo="1.ª etapa" etapa={entrada.etapa1} cambiar={e => cambiar('etapa1', e)} />
        <EditorEtapa titulo="2.ª etapa" etapa={entrada.etapa2} cambiar={e => cambiar('etapa2', e)} />
      </fieldset>
      <div className="rounded-xl bg-navy-900 text-white p-5 flex flex-wrap gap-8" aria-live="polite">
        <div><p>Promedio de etapas</p><strong className="text-2xl">{resultado?.promedio?.toLocaleString('es-PY') ?? 'Pendiente'}</strong></div>
        <div><p>Nota final</p><strong className="text-2xl">{resultado?.nota_final ?? '—'} / 5</strong></div>
        <div><p>Condición</p><strong>{resultado ? estadosMedia[resultado.estado] : 'Revisar escala'}</strong></div>
      </div>
      <p className="text-sm text-gray-500">Blanco significa pendiente. Cero puntos representa una evaluación sin indicadores logrados. Se pueden guardar etapas incompletas.</p>
      <button className="btn" disabled={!listo || !valido || saving || cargandoNota}>{saving ? 'Guardando…' : 'Guardar calificaciones'}</button>
    </form>}
  </div>;
}
