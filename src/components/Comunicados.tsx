import { useEffect, useState, useCallback } from 'react';
import {
  Megaphone,
  Calendar,
  Users,
  FileText,
  MapPin,
  Info,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useActualizacion } from '@/hooks/useActualizacion';
import { mensajeError } from '@/lib/errores';
import PublicarComunicado from './PublicarComunicado';
import type { Comunicado, EtiquetaComunicado } from '@/types';

const ETIQUETA_CONFIG: Record<
  EtiquetaComunicado,
  { label: string; color: string; bg: string; border: string; icon: typeof Megaphone }
> = {
  REUNION: {
    label: 'Reunión',
    color: 'text-brand-700',
    bg: 'bg-brand-50',
    border: 'border-brand-200',
    icon: Users,
  },
  EXAMENES: {
    label: 'Exámenes',
    color: 'text-warning-700',
    bg: 'bg-warning-50',
    border: 'border-warning-200',
    icon: FileText,
  },
  SALIDAS: {
    label: 'Salidas',
    color: 'text-success-700',
    bg: 'bg-success-50',
    border: 'border-success-200',
    icon: MapPin,
  },
  GENERAL: {
    label: 'General',
    color: 'text-navy-700',
    bg: 'bg-navy-50',
    border: 'border-navy-200',
    icon: Info,
  },
};

type Filtro = 'TODOS' | EtiquetaComunicado;

export default function Comunicados() {
  const { usuario } = useAuth();
  const [error, setError] = useState('');
  const [comunicados, setComunicados] = useState<Comunicado[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>('TODOS');
  const [selected, setSelected] = useState<Comunicado | null>(null);

  const loadComunicados = useCallback(async () => {
    try {
    const { data, error } = await supabase
      .from('comunicados')
      .select('*')
      .order('fecha', { ascending: false });
    if (error) throw error;
    setComunicados((data || []) as Comunicado[]); setError('');
    } catch (e) { setError(mensajeError(e)); } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    loadComunicados();
  }, [loadComunicados]);
  useActualizacion('comunicados', loadComunicados);

  const filtered =
    filtro === 'TODOS'
      ? comunicados
      : comunicados.filter((c) => c.etiqueta === filtro);

  const filtros: { value: Filtro; label: string }[] = [
    { value: 'TODOS', label: 'Todos' },
    { value: 'REUNION', label: 'Reuniones' },
    { value: 'EXAMENES', label: 'Exámenes' },
    { value: 'SALIDAS', label: 'Salidas' },
    { value: 'GENERAL', label: 'General' },
  ];

  const countByEtiqueta = (et: EtiquetaComunicado) =>
    comunicados.filter((c) => c.etiqueta === et).length;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-navy-900 to-navy-800 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-brand-600 rounded-xl flex items-center justify-center">
            <Megaphone className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Comunicados y Avisos</h2>
            <p className="text-brand-300 text-sm">
              Información institucional del Colegio Nacional Juan Eudoro Cáceres
            </p>
          </div>
        </div>
      </div>

      {error && <p role="alert" className="notice-error">{error}</p>}
      {(usuario?.rol === 'DOCENTE' || usuario?.rol === 'DIRECTIVO') && <PublicarComunicado onPublicado={loadComunicados} />}
      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {filtros.map((f) => {
          const active = filtro === f.value;
          const count =
            f.value === 'TODOS'
              ? comunicados.length
              : countByEtiqueta(f.value as EtiquetaComunicado);
          return (
            <button
              key={f.value}
              onClick={() => setFiltro(f.value)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all flex-shrink-0 ${
                active
                  ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/20'
                  : 'bg-white border border-gray-200 text-navy-700 hover:border-brand-300'
              }`}
            >
              {f.label}
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && filtered.length === 0 && (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Megaphone className="w-8 h-8 text-gray-300" />
          </div>
          <p className="text-gray-400">No hay comunicados en esta categoría</p>
        </div>
      )}

      {/* Communications list */}
      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((c) => {
            const config = ETIQUETA_CONFIG[c.etiqueta];
            const Icon = config.icon;
            return (
              <button
                key={c.id}
                onClick={() => setSelected(c)}
                className={`text-left p-5 bg-white rounded-2xl border ${config.border} shadow-sm card-hover`}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div
                    className={`w-10 h-10 ${config.bg} rounded-xl flex items-center justify-center flex-shrink-0`}
                  >
                    <Icon className={`w-5 h-5 ${config.color}`} />
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${config.bg} ${config.color}`}
                  >
                    {config.label}
                  </span>
                </div>
                <h3 className="font-bold text-navy-900 mb-2 leading-snug">{c.titulo}</h3>
                <p className="text-sm text-gray-500 leading-relaxed line-clamp-2">
                  {c.contenido}
                </p>
                <div className="flex items-center gap-2 mt-4 text-xs text-gray-400">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(c.fecha).toLocaleDateString('es-PY', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                  <span className="mx-1">·</span>
                  <span>{c.autor}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <div
          className="fixed inset-0 bg-navy-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full p-6 animate-scale-in max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const config = ETIQUETA_CONFIG[selected.etiqueta];
              const Icon = config.icon;
              return (
                <>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-11 h-11 ${config.bg} rounded-xl flex items-center justify-center`}
                      >
                        <Icon className={`w-6 h-6 ${config.color}`} />
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${config.bg} ${config.color}`}
                      >
                        {config.label}
                      </span>
                    </div>
                    <button
                      onClick={() => setSelected(null)}
                      className="p-2 rounded-lg hover:bg-gray-100"
                    >
                      <X className="w-5 h-5 text-gray-500" />
                    </button>
                  </div>
                  <h3 className="text-lg font-bold text-navy-900 mb-3 leading-snug">
                    {selected.titulo}
                  </h3>
                  <p className="text-gray-600 leading-relaxed whitespace-pre-line">
                    {selected.contenido}
                  </p>
                  <div className="mt-6 pt-4 border-t border-gray-100 flex items-center gap-2 text-sm text-gray-400">
                    <Calendar className="w-4 h-4" />
                    {new Date(selected.fecha).toLocaleDateString('es-PY', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                    <span className="mx-1">·</span>
                    <span>{selected.autor}</span>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
