import { useEffect, useState, useCallback } from 'react';
import {
  GraduationCap,
  Calendar,
  Clock,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  X,
  Award,
  CheckCircle2,
  AlertTriangle,
  Megaphone,
  BookOpen,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { Estudiante, Calificacion, Asistencia, Comunicado } from '@/types';

type SelectedMateria = { nombre: string; calificaciones: Calificacion[] } | null;

export default function HomeTutor() {
  const { usuario } = useAuth();
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [selectedEstudiante, setSelectedEstudiante] = useState<Estudiante | null>(null);
  const [calificaciones, setCalificaciones] = useState<Calificacion[]>([]);
  const [asistencia, setAsistencia] = useState<Asistencia[]>([]);
  const [comunicados, setComunicados] = useState<Comunicado[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalMateria, setModalMateria] = useState<SelectedMateria>(null);

  const loadData = useCallback(async () => {
    if (!usuario) return;
    setLoading(true);

    const { data: estudiantesData } = await supabase
      .from('estudiantes')
      .select('*')
      .eq('tutor_id', usuario.id);

    const ests = (estudiantesData || []) as Estudiante[];
    setEstudiantes(ests);

    if (ests.length > 0) {
      const est = ests[0];
      setSelectedEstudiante(est);

      const [calRes, asisRes, comRes] = await Promise.all([
        supabase.from('calificaciones').select('*').eq('estudiante_id', est.id),
        supabase
          .from('asistencia')
          .select('*')
          .eq('estudiante_id', est.id)
          .order('fecha', { ascending: false })
          .limit(10),
        supabase
          .from('comunicados')
          .select('*')
          .order('fecha', { ascending: false })
          .limit(5),
      ]);

      setCalificaciones((calRes.data || []) as Calificacion[]);
      setAsistencia((asisRes.data || []) as Asistencia[]);
      setComunicados((comRes.data || []) as Comunicado[]);
    }
    setLoading(false);
  }, [usuario]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const switchEstudiante = async (est: Estudiante) => {
    setSelectedEstudiante(est);
    const [calRes, asisRes] = await Promise.all([
      supabase.from('calificaciones').select('*').eq('estudiante_id', est.id),
      supabase
        .from('asistencia')
        .select('*')
        .eq('estudiante_id', est.id)
        .order('fecha', { ascending: false })
        .limit(10),
    ]);
    setCalificaciones((calRes.data || []) as Calificacion[]);
    setAsistencia((asisRes.data || []) as Asistencia[]);
  };

  const promedioGeneral =
    calificaciones.length > 0
      ? calificaciones.reduce((sum, c) => sum + Number(c.promedio), 0) / calificaciones.length
      : 0;

  const presentes = asistencia.filter((a) => a.estado === 'PRESENTE').length;
  const tardanzas = asistencia.filter((a) => a.estado === 'TARDANZA').length;

  const etiquetaConfig: Record<string, { label: string; color: string; bg: string }> = {
    REUNION: { label: 'Reunión', color: 'text-brand-700', bg: 'bg-brand-100' },
    EXAMENES: { label: 'Exámenes', color: 'text-warning-700', bg: 'bg-warning-100' },
    SALIDAS: { label: 'Salidas', color: 'text-success-700', bg: 'bg-success-100' },
    GENERAL: { label: 'General', color: 'text-navy-700', bg: 'bg-navy-100' },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Cargando información académica...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Student selector */}
      {estudiantes.length > 1 && (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {estudiantes.map((est) => (
            <button
              key={est.id}
              onClick={() => switchEstudiante(est)}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-all flex-shrink-0 ${
                selectedEstudiante?.id === est.id
                  ? 'border-brand-500 bg-brand-50 shadow-sm'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              {est.foto_url ? (
                <img
                  src={est.foto_url}
                  alt={est.nombre_completo}
                  className="w-10 h-10 rounded-lg object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-brand-100 flex items-center justify-center">
                  <GraduationCap className="w-5 h-5 text-brand-600" />
                </div>
              )}
              <div className="text-left">
                <p className="text-sm font-semibold text-navy-900 whitespace-nowrap">
                  {est.nombre_completo}
                </p>
                <p className="text-xs text-gray-400">{est.curso}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Student header card */}
      {selectedEstudiante && (
        <div className="bg-gradient-to-r from-navy-900 to-navy-800 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center gap-5">
            {selectedEstudiante.foto_url ? (
              <img
                src={selectedEstudiante.foto_url}
                alt={selectedEstudiante.nombre_completo}
                className="w-16 h-16 rounded-2xl object-cover border-2 border-white/20"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center">
                <GraduationCap className="w-8 h-8 text-white" />
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold">{selectedEstudiante.nombre_completo}</h2>
              <p className="text-brand-300 text-sm">
                {selectedEstudiante.curso} · C.I. {selectedEstudiante.ci}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Promedio General Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 card-hover">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-brand-100 rounded-xl flex items-center justify-center">
              <Award className="w-6 h-6 text-brand-600" />
            </div>
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Promedio General
            </span>
          </div>
          <div className="text-center my-6">
            <p className="text-5xl font-bold text-navy-900">
              {promedioGeneral.toFixed(1)}
            </p>
            <p className="text-sm text-gray-400 mt-1">sobre 5.0</p>
          </div>
          <div className="flex items-center justify-center gap-2">
            {promedioGeneral >= 4.0 ? (
              <span className="flex items-center gap-1.5 text-success-600 text-sm font-semibold">
                <TrendingUp className="w-4 h-4" />
                Rendimiento satisfactorio
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-warning-600 text-sm font-semibold">
                <TrendingDown className="w-4 h-4" />
                Requiere atención
              </span>
            )}
          </div>
        </div>

        {/* Attendance summary card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 card-hover">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-success-100 rounded-xl flex items-center justify-center">
              <Calendar className="w-6 h-6 text-success-600" />
            </div>
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Asistencia
            </span>
          </div>
          <div className="space-y-3 mt-4">
            <div className="flex items-center justify-between p-3 bg-success-50 rounded-xl">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-success-600" />
                <span className="text-sm font-medium text-navy-800">Presentes</span>
              </div>
              <span className="text-xl font-bold text-success-700">{presentes}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-warning-50 rounded-xl">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-warning-600" />
                <span className="text-sm font-medium text-navy-800">Llegadas Tardías</span>
              </div>
              <span className="text-xl font-bold text-warning-700">{tardanzas}</span>
            </div>
          </div>
        </div>

        {/* Quick stats card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 card-hover">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-navy-100 rounded-xl flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-navy-700" />
            </div>
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Resumen
            </span>
          </div>
          <div className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Materias cursadas</span>
              <span className="text-lg font-bold text-navy-900">{calificaciones.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Período</span>
              <span className="text-sm font-semibold text-navy-700">
                {calificaciones[0]?.periodo || '2026 Trimestre 1'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Mejor materia</span>
              <span className="text-sm font-semibold text-success-600">
                {calificaciones.length > 0
                  ? calificaciones.reduce((best, c) =>
                      Number(c.promedio) > Number(best.promedio) ? c : best
                    ).materia
                  : '-'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Grades by subject */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-bold text-navy-900 mb-1">Calificaciones por Materia</h3>
        <p className="text-sm text-gray-400 mb-5">
          Toque una materia para ver el detalle de notas
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {calificaciones.map((cal) => {
            const prom = Number(cal.promedio);
            const colorClass =
              prom >= 4.0
                ? 'text-success-600 bg-success-50'
                : prom >= 3.0
                ? 'text-warning-600 bg-warning-50'
                : 'text-error-600 bg-error-50';

            return (
              <button
                key={cal.id}
                onClick={() =>
                  setModalMateria({ nombre: cal.materia, calificaciones: [cal] })
                }
                className="flex items-center justify-between p-4 bg-gray-50 hover:bg-brand-50 rounded-xl transition-all text-left group"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-navy-900 truncate">{cal.materia}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          prom >= 4.0 ? 'bg-success-500' : prom >= 3.0 ? 'bg-warning-500' : 'bg-error-500'
                        }`}
                        style={{ width: `${(prom / 5) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-400">{prom.toFixed(1)}/5.0</span>
                  </div>
                </div>
                <div className={`px-3 py-1.5 rounded-lg font-bold ${colorClass} ml-3`}>
                  {prom.toFixed(1)}
                </div>
                <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-brand-400 ml-2 transition-colors" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Attendance history */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-bold text-navy-900 mb-1">Historial de Asistencia</h3>
        <p className="text-sm text-gray-400 mb-5">Últimos 10 registros</p>
        <div className="space-y-2">
          {asistencia.length === 0 ? (
            <p className="text-center text-gray-400 py-8">No hay registros de asistencia</p>
          ) : (
            asistencia.map((a) => {
              const dateObj = new Date(a.fecha + 'T' + a.hora);
              return (
                <div
                  key={a.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        a.estado === 'PRESENTE'
                          ? 'bg-success-100'
                          : 'bg-warning-100'
                      }`}
                    >
                      {a.estado === 'PRESENTE' ? (
                        <CheckCircle2 className="w-5 h-5 text-success-600" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-warning-600" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-navy-900">
                        {dateObj.toLocaleDateString('es-PY', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'short',
                        })}
                      </p>
                      <p className="text-xs text-gray-400">
                        {a.hora.substring(0, 5)} hs
                      </p>
                    </div>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold ${
                      a.estado === 'PRESENTE'
                        ? 'bg-success-100 text-success-700'
                        : 'bg-warning-100 text-warning-700'
                    }`}
                  >
                    {a.estado === 'PRESENTE' ? 'Presente' : 'Tardanza'}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Institutional communications */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-1">
          <Megaphone className="w-5 h-5 text-brand-600" />
          <h3 className="text-lg font-bold text-navy-900">Comunicados Institucionales</h3>
        </div>
        <p className="text-sm text-gray-400 mb-5">Avisos recientes del colegio</p>
        <div className="space-y-3">
          {comunicados.map((c) => {
            const et = etiquetaConfig[c.etiqueta] || etiquetaConfig.GENERAL;
            return (
              <div
                key={c.id}
                className="p-4 border border-gray-100 rounded-xl hover:border-brand-200 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h4 className="font-semibold text-navy-900">{c.titulo}</h4>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex-shrink-0 ${et.bg} ${et.color}`}>
                    {et.label}
                  </span>
                </div>
                <p className="text-sm text-gray-500 leading-relaxed line-clamp-2">
                  {c.contenido}
                </p>
                <div className="flex items-center gap-2 mt-3 text-xs text-gray-400">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(c.fecha).toLocaleDateString('es-PY', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                  <span className="mx-1">·</span>
                  <span>{c.autor}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Grade detail modal */}
      {modalMateria && (
        <div
          className="fixed inset-0 bg-navy-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setModalMateria(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-navy-900">{modalMateria.nombre}</h3>
              <button
                onClick={() => setModalMateria(null)}
                className="p-2 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="space-y-3">
              {(() => {
                const cal = modalMateria.calificaciones[0];
                const items = [
                  { label: 'Parcial 1', value: Number(cal.parcial1) },
                  { label: 'Parcial 2', value: Number(cal.parcial2) },
                  { label: 'Parcial 3', value: Number(cal.parcial3) },
                  { label: 'Examen Final', value: Number(cal.examen_final) },
                ];
                return items.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"
                  >
                    <span className="text-sm font-medium text-navy-700">{item.label}</span>
                    <span
                      className={`px-3 py-1 rounded-lg font-bold ${
                        item.value >= 4.0
                          ? 'bg-success-100 text-success-700'
                          : item.value >= 3.0
                          ? 'bg-warning-100 text-warning-700'
                          : 'bg-error-100 text-error-700'
                      }`}
                    >
                      {item.value.toFixed(1)}
                    </span>
                  </div>
                ));
              })()}
              <div className="flex items-center justify-between p-4 bg-navy-900 rounded-xl mt-4">
                <span className="text-sm font-semibold text-white">Promedio Final</span>
                <span className="text-2xl font-bold text-brand-300">
                  {Number(modalMateria.calificaciones[0].promedio).toFixed(1)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
