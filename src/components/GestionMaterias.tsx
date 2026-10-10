import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { mensajeError } from '@/lib/errores';
import type { Materia } from '@/types';
export default function GestionMaterias() {
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [id, setId] = useState('');
  const [nombre, setNombre] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [loading, setLoading] = useState(true);
  const cargar = useCallback(async () => {
    setError(''); setLoading(true);
    try {
      const { data, error } = await supabase.from('materias').select('*').order('nombre');
      if (error) throw error;
      setMaterias(data || []);
    } catch (e) { setError(mensajeError(e)); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void cargar(); }, [cargar]);
  const guardar = async (event: React.FormEvent) => {
    event.preventDefault(); if (saving) return;
    setSaving(true); setError(''); setMensaje('');
    try {
      const datos = { nombre: nombre.trim() };
      if (!datos.nombre || datos.nombre.length > 100) throw new Error('El nombre debe tener entre 1 y 100 caracteres.');
      const consulta = id ? supabase.from('materias').update(datos).eq('id', id) : supabase.from('materias').insert(datos);
      const { error } = await consulta.select().single();
      if (error) throw error;
      await cargar(); setId(''); setNombre(''); setMensaje('Materia guardada correctamente.');
    } catch (e) { setError(mensajeError(e)); } finally { setSaving(false); }
  };
  return <div className="max-w-3xl mx-auto space-y-6">
    <header className="bg-navy-900 text-white p-6 rounded-2xl"><p className="text-brand-300 text-sm">Catálogo académico</p><h2 className="text-2xl font-bold">Materias</h2></header>
    {error && <p role="alert" className="notice-error">{error}</p>}{mensaje && <p role="status" className="notice-success">{mensaje}</p>}
    <form onSubmit={guardar} className="panel space-y-4"><h3 className="font-bold">{id ? 'Editar materia' : 'Nueva materia'}</h3>
      <label className="block text-sm">Nombre<input className="input mt-1" required maxLength={100} value={nombre} disabled={saving} onChange={e => setNombre(e.target.value)} /></label>
      <div className="flex gap-3"><button className="btn" disabled={saving || loading}>{saving ? 'Guardando…' : 'Guardar materia'}</button>
        {id && <button type="button" className="btn-secondary" disabled={saving} onClick={() => { setId(''); setNombre(''); }}>Cancelar edición</button>}</div>
    </form>
    <section className="panel">{loading ? <p>Cargando materias…</p> : <ul className="divide-y">{materias.map(m => <li key={m.id} className="flex gap-4 justify-between items-center py-3"><span>{m.nombre}</span><button disabled={saving} className="btn-secondary" onClick={() => { setId(m.id); setNombre(m.nombre); setMensaje(''); }}>Editar</button></li>)}</ul>}</section>
  </div>;
}
