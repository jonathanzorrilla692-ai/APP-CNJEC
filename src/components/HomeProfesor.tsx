import { useEffect, useState, useCallback } from 'react';
import { QrCode, Calendar, Users, Clock, CheckCircle2, AlertTriangle, BarChart3 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import QRScanner from '@/components/QRScanner';
import type { Asistencia, Estudiante } from '@/types';

export default function HomeProfesor() {
  const { usuario } = useAuth();
  const [todayAttendance, setTodayAttendance] = useState<
    (Asistencia & { estudiante?: Estudiante })[]
  >([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [todayPresent, setTodayPresent] = useState(0);
  const [todayTardanza, setTodayTardanza] = useState(0);

  const loadDashboard = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0];

    const { data: studentsData } = await supabase.from('estudiantes').select('id');
    setTotalStudents(studentsData?.length || 0);

    const { data: asisData } = await supabase
      .from('asistencia')
      .select('*, estudiantes(*)')
      .eq('fecha', today)
      .order('created_at', { ascending: false });

    const records = (asisData || []) as (Asistencia & { estudiante?: Estudiante })[];
    setTodayAttendance(records);
    setTodayPresent(records.filter((r) => r.estado === 'PRESENTE').length);
    setTodayTardanza(records.filter((r) => r.estado === 'TARDANZA').length);
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleScanComplete = () => {
    loadDashboard();
  };

  const todayLabel = new Date().toLocaleDateString('es-PY', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Welcome banner */}
      <div className="bg-gradient-to-r from-navy-900 to-navy-800 rounded-2xl p-6 text-white shadow-lg flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold">Bienvenido, {usuario?.nombre_completo}</h2>
          <p className="text-brand-300 text-sm mt-1 capitalize">{todayLabel}</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-xl">
          <QrCode className="w-5 h-5 text-brand-300" />
          <span className="text-sm font-medium">Sistema de Asistencia QR</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 card-hover">
          <div className="w-10 h-10 bg-brand-100 rounded-xl flex items-center justify-center mb-3">
            <Users className="w-5 h-5 text-brand-600" />
          </div>
          <p className="text-2xl font-bold text-navy-900">{totalStudents}</p>
          <p className="text-xs text-gray-400 mt-1">Estudiantes totales</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 card-hover">
          <div className="w-10 h-10 bg-success-100 rounded-xl flex items-center justify-center mb-3">
            <CheckCircle2 className="w-5 h-5 text-success-600" />
          </div>
          <p className="text-2xl font-bold text-navy-900">{todayPresent}</p>
          <p className="text-xs text-gray-400 mt-1">Presentes hoy</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 card-hover">
          <div className="w-10 h-10 bg-warning-100 rounded-xl flex items-center justify-center mb-3">
            <Clock className="w-5 h-5 text-warning-600" />
          </div>
          <p className="text-2xl font-bold text-navy-900">{todayTardanza}</p>
          <p className="text-xs text-gray-400 mt-1">Tardanzas hoy</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 card-hover">
          <div className="w-10 h-10 bg-navy-100 rounded-xl flex items-center justify-center mb-3">
            <BarChart3 className="w-5 h-5 text-navy-700" />
          </div>
          <p className="text-2xl font-bold text-navy-900">
            {totalStudents > 0
              ? Math.round(((todayPresent + todayTardanza) / totalStudents) * 100)
              : 0}
            %
          </p>
          <p className="text-xs text-gray-400 mt-1">Asistencia total</p>
        </div>
      </div>

      {/* Two-column layout: Scanner + Today's records */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* QR Scanner */}
        <div>
          <QRScanner onScanComplete={handleScanComplete} />
        </div>

        {/* Today's attendance log */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="w-5 h-5 text-brand-600" />
            <h3 className="text-lg font-bold text-navy-900">Asistencia de Hoy</h3>
          </div>
          <p className="text-sm text-gray-400 mb-5">
            {todayAttendance.length} registro(s) en total
          </p>

          {todayAttendance.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <QrCode className="w-8 h-8 text-gray-300" />
              </div>
              <p className="text-gray-400 text-sm">
                No hay registros de asistencia hoy.
                <br />
                Escanee un código QR para comenzar.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {todayAttendance.map((record) => (
                <div
                  key={record.id}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl animate-slide-up"
                >
                  {record.estudiante?.foto_url ? (
                    <img
                      src={record.estudiante.foto_url}
                      alt={record.estudiante.nombre_completo}
                      className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-brand-100 flex items-center justify-center flex-shrink-0">
                      <Users className="w-5 h-5 text-brand-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-navy-900 truncate">
                      {record.estudiante?.nombre_completo || 'Estudiante'}
                    </p>
                    <p className="text-xs text-gray-400">
                      C.I. {record.estudiante?.ci} · {record.estudiante?.curso}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        record.estado === 'PRESENTE'
                          ? 'bg-success-100 text-success-700'
                          : 'bg-warning-100 text-warning-700'
                      }`}
                    >
                      {record.estado === 'PRESENTE' ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : (
                        <AlertTriangle className="w-3 h-3" />
                      )}
                      {record.estado === 'PRESENTE' ? 'Presente' : 'Tardanza'}
                    </span>
                    <p className="text-xs text-gray-400 mt-1">{record.hora.substring(0, 5)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
