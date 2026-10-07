import { useEffect, useState, useRef, useCallback } from 'react';
import QRCode from 'qrcode';
import {
  GraduationCap,
  IdCard,
  Download,
  Share2,
  Calendar,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Award,
  QrCode,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { Estudiante, Calificacion, Asistencia } from '@/types';

export default function HomeEstudiante() {
  const { usuario } = useAuth();
  const [estudiante, setEstudiante] = useState<Estudiante | null>(null);
  const [calificaciones, setCalificaciones] = useState<Calificacion[]>([]);
  const [asistencia, setAsistencia] = useState<Asistencia[]>([]);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const loadData = useCallback(async () => {
    if (!usuario) return;
    setLoading(true);

    const { data: estData } = await supabase
      .from('estudiantes')
      .select('*')
      .eq('id_link', usuario.id)
      .maybeSingle();

    const est = estData as Estudiante | null;
    setEstudiante(est);

    if (est) {
      const [calRes, asisRes] = await Promise.all([
        supabase.from('calificaciones').select('*').eq('estudiante_id', est.id),
        supabase
          .from('asistencia')
          .select('*')
          .eq('estudiante_id', est.id)
          .order('fecha', { ascending: false })
          .limit(5),
      ]);
      setCalificaciones((calRes.data || []) as Calificacion[]);
      setAsistencia((asisRes.data || []) as Asistencia[]);
    }
    setLoading(false);
  }, [usuario]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!estudiante) return;
    const qrPayload = `CI:${estudiante.ci}`;
    QRCode.toDataURL(qrPayload, {
      width: 320,
      margin: 2,
      color: { dark: '#0F172A', light: '#FFFFFF' },
      errorCorrectionLevel: 'M',
    })
      .then(setQrDataUrl)
      .catch(console.error);
  }, [estudiante]);

  const handleDownload = () => {
    if (!qrDataUrl || !estudiante) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `carnet-${estudiante.ci}.png`;
    link.click();
  };

  const handleShare = async () => {
    if (!qrDataUrl || !estudiante) return;
    try {
      const response = await fetch(qrDataUrl);
      const blob = await response.blob();
      const file = new File([blob], `carnet-${estudiante.ci}.png`, { type: 'image/png' });
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'Mi Carnet Digital',
          text: `Carnet de ${estudiante.nombre_completo}`,
          files: [file],
        });
      } else {
        handleDownload();
      }
    } catch {
      handleDownload();
    }
  };

  const promedioGeneral =
    calificaciones.length > 0
      ? calificaciones.reduce((sum, c) => sum + Number(c.promedio), 0) / calificaciones.length
      : 0;

  const presentes = asistencia.filter((a) => a.estado === 'PRESENTE').length;
  const tardanzas = asistencia.filter((a) => a.estado === 'TARDANZA').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Cargando carnet digital...</p>
        </div>
      </div>
    );
  }

  if (!estudiante) {
    return (
      <div className="text-center py-20">
        <IdCard className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-400">No se encontró su registro de estudiante</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Carnet Digital Card */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* QR + Student info as a digital ID card */}
        <div className="bg-gradient-to-br from-navy-900 to-navy-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-white font-bold text-sm">Colegio Nacional</p>
                <p className="text-brand-300 text-xs">Juan Eudoro Cáceres</p>
              </div>
            </div>
            <span className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-bold text-brand-300 uppercase tracking-wide">
              Carnet Digital
            </span>
          </div>

          {/* Student info */}
          <div className="flex items-center gap-4 mb-6">
            {estudiante.foto_url ? (
              <img
                src={estudiante.foto_url}
                alt={estudiante.nombre_completo}
                className="w-20 h-20 rounded-2xl object-cover border-2 border-white/20"
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-white/10 flex items-center justify-center">
                <GraduationCap className="w-10 h-10 text-white/40" />
              </div>
            )}
            <div>
              <h2 className="text-white text-xl font-bold leading-tight">
                {estudiante.nombre_completo}
              </h2>
              <p className="text-brand-300 text-sm mt-1">C.I. {estudiante.ci}</p>
              <p className="text-navy-200 text-sm">{estudiante.curso}</p>
            </div>
          </div>

          {/* QR Code */}
          <div className="bg-white rounded-2xl p-6 flex flex-col items-center">
            <div className="relative">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="QR Code" className="w-48 h-48" />
              ) : (
                <div className="w-48 h-48 bg-gray-100 rounded-xl flex items-center justify-center">
                  <QrCode className="w-16 h-16 text-gray-300" />
                </div>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-3 text-center">
              Presente este codigo al docente para registrar su asistencia
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 mt-4">
            <button
              onClick={handleDownload}
              className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2 text-sm"
            >
              <Download className="w-4 h-4" />
              Descargar
            </button>
            <button
              onClick={handleShare}
              className="flex-1 py-3 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2 text-sm"
            >
              <Share2 className="w-4 h-4" />
              Compartir
            </button>
          </div>
        </div>

        {/* Quick stats */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 card-hover">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-brand-100 rounded-xl flex items-center justify-center">
                <Award className="w-6 h-6 text-brand-600" />
              </div>
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Mi Promedio
              </span>
            </div>
            <div className="text-center my-4">
              <p className="text-5xl font-bold text-navy-900">{promedioGeneral.toFixed(1)}</p>
              <p className="text-sm text-gray-400 mt-1">sobre 5.0</p>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="text-center p-3 bg-success-50 rounded-xl">
                <CheckCircle2 className="w-5 h-5 text-success-600 mx-auto mb-1" />
                <p className="text-lg font-bold text-success-700">{presentes}</p>
                <p className="text-xs text-gray-400">Presentes</p>
              </div>
              <div className="text-center p-3 bg-warning-50 rounded-xl">
                <Clock className="w-5 h-5 text-warning-600 mx-auto mb-1" />
                <p className="text-lg font-bold text-warning-700">{tardanzas}</p>
                <p className="text-xs text-gray-400">Tardanzas</p>
              </div>
            </div>
          </div>

          {/* Recent attendance */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5 text-brand-600" />
              <h3 className="font-bold text-navy-900">Asistencia Reciente</h3>
            </div>
            <div className="space-y-2">
              {asistencia.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-4">Sin registros</p>
              ) : (
                asistencia.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          a.estado === 'PRESENTE' ? 'bg-success-100' : 'bg-warning-100'
                        }`}
                      >
                        {a.estado === 'PRESENTE' ? (
                          <CheckCircle2 className="w-4 h-4 text-success-600" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-warning-600" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-navy-900">
                          {new Date(a.fecha + 'T' + a.hora).toLocaleDateString('es-PY', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                          })}
                        </p>
                        <p className="text-xs text-gray-400">{a.hora.substring(0, 5)} hs</p>
                      </div>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        a.estado === 'PRESENTE'
                          ? 'bg-success-100 text-success-700'
                          : 'bg-warning-100 text-warning-700'
                      }`}
                    >
                      {a.estado === 'PRESENTE' ? 'Presente' : 'Tardanza'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* My grades summary */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-5">
          <BookOpen className="w-5 h-5 text-brand-600" />
          <h3 className="font-bold text-navy-900">Mis Calificaciones</h3>
        </div>
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
              <div
                key={cal.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-xl"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-navy-900 truncate">{cal.materia}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
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
              </div>
            );
          })}
        </div>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
