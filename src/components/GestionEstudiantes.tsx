import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { mensajeError } from '@/lib/errores';
import { estudianteVacio, normalizarEstudiante, validarEstudiante } from '@/lib/gestion';
import type { DatosEstudiante, PerfilVinculable } from '@/lib/gestion';
import type { Estudiante } from '@/types';

export default function GestionEstudiantes() {
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [perfiles, setPerfiles] = useState<PerfilVinculable[]>([]);
  const [form, setForm] = useState<DatosEstudiante>(estudianteVacio());
  const [id, setId] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [listo, setListo] = useState(false);
  const ocupado = useRef(false);
  const cargar = useCallback(async () => {
    setLoading(true); setError(''); setListo(false);
    try {
      const [e, p] = await Promise.all([
        supabase.from('estudiantes').select('*').order('nombre_completo'),
        supabase.rpc('perfiles_vinculables'),
      ]);
      if (e.error || p.error) throw e.error || p.error;
      setEstudiantes(e.data || []); setPerfiles(p.data || []); setListo(true);
    } catch (e) { setError(mensajeError(e)); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void cargar(); }, [cargar]);
  const nuevo = () => { setId(''); setForm(estudianteVacio()); setMensaje(''); setError(''); };
  const editar = (e: Estudiante) => {
    setId(e.id); setForm(normalizarEstudiante({ ...e, especialidad: e.especialidad ?? null }));
    setMensaje(''); setError('');
  };
  const guardar = async (event: React.FormEvent) => {
    event.preventDefault();
    if (ocupado.current || !listo) return;
    const aviso = validarEstudiante(form);
    if (aviso) { setError(aviso); return; }
    ocupado.current = true; setSaving(true); setError(''); setMensaje('');
    try {
      const payload = normalizarEstudiante(form);
      // Envía solo los campos editables; no sobreescribe identificadores o fechas.
      const { ci, nombre_completo, curso, especialidad, foto_url, tutor_id, id_link } = payload;
      const datos = { ci, nombre_completo, curso, especialidad, foto_url, tutor_id, id_link };
      const consulta = id ? supabase.from('estudiantes').update(datos).eq('id', id) : supabase.from('estudiantes').insert(datos);
      const { data, error } = await consulta.select().single();
      if (error) throw error;
      await cargar(); setId(data.id); setForm(normalizarEstudiante(data));
      setMensaje('Ficha del estudiante guardada correctamente.');
    } catch (e) { setError(mensajeError(e)); } finally { ocupado.current = false; setSaving(false); }
  };
  return <div className="max-w-6xl mx-auto space-y-6">
    <header className="bg-navy-900 text-white rounded-2xl p-6"><p className="text-brand-300 text-sm">Administración del colegio</p><h2 className="text-2xl font-bold">Estudiantes</h2></header>
    {error && <p role="alert" className="notice-error">{error}</p>}
    {mensaje && <p role="status" className="notice-success">{mensaje}</p>}
    {loading ? <p role="status">Cargando estudiantes…</p> : !listo ? <button className="btn-secondary" onClick={cargar}>Reintentar carga</button> :
      <div className="grid lg:grid-cols-3 gap-6">
        <section className="panel space-y-3">
          <button className="btn w-full" onClick={nuevo} disabled={saving}>Nuevo estudiante</button>
          <label className="block text-sm">Buscar por nombre o C.I.<input className="input mt-1" value={busqueda} onChange={e => setBusqueda(e.target.value)} /></label>
          <ul className="space-y-2 max-h-[32rem] overflow-y-auto">
            {estudiantes.filter(e => (e.nombre_completo + e.ci).toLowerCase().includes(busqueda.toLowerCase())).map(e => <li key={e.id}>
              <button disabled={saving} className={`w-full text-left rounded-xl p-3 ${id === e.id ? 'bg-brand-50 ring-1 ring-brand-300' : 'bg-gray-50'}`} onClick={() => editar(e)}>
                <strong className="block">{e.nombre_completo}</strong><span className="text-xs text-gray-500">{e.ci} · {e.curso}</span>
              </button>
            </li>)}
          </ul>
          {estudiantes.length === 0 && <p className="text-sm text-gray-500">Sin estudiantes registrados.</p>}
        </section>
        <form className="panel lg:col-span-2 space-y-4" onSubmit={guardar}>
          <h3 className="font-bold text-lg">{id ? 'Editar ficha' : 'Nuevo estudiante'}</h3>
          <fieldset disabled={saving} className="grid sm:grid-cols-2 gap-4">
            <label className="block text-sm">Nombre completo<input className="input mt-1" required minLength={3} maxLength={150} value={form.nombre_completo} onChange={e => setForm({ ...form, nombre_completo: e.target.value })} /></label>
            <label className="block text-sm">Cédula de Identidad<input className="input mt-1" required inputMode="numeric" pattern="[0-9]{3,15}" value={form.ci} onChange={e => setForm({ ...form, ci: e.target.value })} /></label>
            <label className="block text-sm">Curso<input className="input mt-1" required maxLength={100} placeholder="1.º Bachillerato A" value={form.curso} onChange={e => setForm({ ...form, curso: e.target.value })} /></label>
            <label className="block text-sm">Especialidad<input className="input mt-1" maxLength={150} placeholder="Bachillerato científico" value={form.especialidad ?? ''} onChange={e => setForm({ ...form, especialidad: e.target.value })} /></label>
            <label className="block text-sm sm:col-span-2">Foto (dirección HTTPS, opcional)<input className="input mt-1" type="url" value={form.foto_url ?? ''} onChange={e => setForm({ ...form, foto_url: e.target.value })} /></label>
            <label className="block text-sm">Tutor / Padre<select className="input mt-1" value={form.tutor_id ?? ''} onChange={e => setForm({ ...form, tutor_id: e.target.value || null })}>
              <option value="">Sin vincular</option>{perfiles.filter(p => p.rol === 'TUTOR').map(p => <option key={p.id} value={p.id}>{p.nombre_completo} · {p.ci}</option>)}
            </select></label>
            <label className="block text-sm">Cuenta del estudiante<select className="input mt-1" value={form.id_link ?? ''} onChange={e => setForm({ ...form, id_link: e.target.value || null })}>
              <option value="">Sin vincular</option>{perfiles.filter(p => p.rol === 'ESTUDIANTE').map(p => <option key={p.id} value={p.id}>{p.nombre_completo} · {p.ci}</option>)}
            </select></label>
          </fieldset>
          <p className="text-xs text-gray-500">Las cuentas deben existir antes de vincularlas. La ficha conserva el ID utilizado por el carnet y sus registros.</p>
          <button className="btn" disabled={saving}>{saving ? 'Guardando…' : 'Guardar estudiante'}</button>
        </form>
      </div>}
  </div>;
}
