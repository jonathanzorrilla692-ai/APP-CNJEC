import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { mensajeError } from '@/lib/errores';
import type { EtiquetaComunicado } from '@/types';
export default function PublicarComunicado({ onPublicado }: { onPublicado: () => void }) {
  const [titulo, setTitulo] = useState('');
  const [contenido, setContenido] = useState('');
  const [etiqueta, setEtiqueta] = useState<EtiquetaComunicado>('GENERAL');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const publicar = async (event: React.FormEvent) => {
    event.preventDefault(); if (saving) return;
    setSaving(true); setError(''); setMensaje('');
    try {
      const { error } = await supabase.rpc('publicar_comunicado', {
        p_titulo: titulo.trim(), p_contenido: contenido.trim(), p_etiqueta: etiqueta,
      });
      if (error) throw error;
      setTitulo(''); setContenido(''); setMensaje('Comunicado publicado. Ya está disponible para la comunidad del colegio.');
      onPublicado();
    } catch (e) { setError(mensajeError(e)); } finally { setSaving(false); }
  };
  return <form className="panel space-y-4" onSubmit={publicar}>
    <h3 className="font-bold text-lg">Publicar un comunicado</h3>
    {error && <p role="alert" className="notice-error">{error}</p>}
    {mensaje && <p role="status" className="notice-success">{mensaje}</p>}
    <fieldset disabled={saving} className="space-y-4">
      <label className="block text-sm">Título<input className="input mt-1" required maxLength={160} value={titulo} onChange={e => setTitulo(e.target.value)} /></label>
      <label className="block text-sm">Categoría<select className="input mt-1" value={etiqueta} onChange={e => setEtiqueta(e.target.value as EtiquetaComunicado)}>
        <option value="GENERAL">General</option><option value="REUNION">Reunión</option><option value="EXAMENES">Evaluaciones</option><option value="SALIDAS">Salidas</option>
      </select></label>
      <label className="block text-sm">Mensaje<textarea className="input mt-1 min-h-32" required maxLength={10000} value={contenido} onChange={e => setContenido(e.target.value)} /></label>
      <p className="text-xs text-gray-500">Se mostrará a las cuentas del colegio. El autor y la fecha se registran automáticamente.</p>
      <button className="btn">{saving ? 'Publicando…' : 'Publicar comunicado'}</button>
    </fieldset>
  </form>;
}
