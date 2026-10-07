import { useEffect, useState, useCallback } from 'react';
import {
  GraduationCap,
  BookOpen,
  Save,
  Loader2,
  CheckCircle2,
  Search,
  X,
  Edit3,
  Plus,
  AlertCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { Estudiante, Calificacion } from '@/types';

const MATERIAS = [
  'Matematica',
  'Lengua Espanola',
  'Ciencias Naturales',
  'Estudios Sociales',
  'Ingles',
  'Educacion Fisica',
  'Artes',
  'Informatica',
];

const PERIODO = '2026 Trimestre 1';

export default function CargaNotas() {
  const { usuario } = useAuth();
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [filteredEstudiantes, setFilteredEstudiantes] = useState<Estudiante[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEstudiante, setSelectedEstudiante] = useState<Estudiante | null>(null);
  const [selectedMateria, setSelectedMateria] = useState('');
  const [existingCal, setExistingCal] = useState<Calificacion | null>(null);
  const [parcial1, setParcial1] = useState('');
  const [parcial2, setParcial2] = useState('');
  const [parcial3, setParcial3] = useState('');
  const [examenFinal, setExamenFinal] = useState('');
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const promedioCalculado = (() => {
    const p1 = parseFloat(parcial1) || 0;
    const p2 = parseFloat(parcial2) || 0;
    const p3 = parseFloat(parcial3) || 0;
    const ef = parseFloat(examenFinal) || 0;
    return ((p1 + p2 + p3 + ef) / 4).toFixed(2);
  })();

  const loadEstudiantes = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('estudiantes')
      .select('*')
      .order('nombre_completo', { ascending: true });
    const ests = (data || []) as Estudiante[];
    setEstudiantes(ests);
    setFilteredEstudiantes(ests);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadEstudiantes();
  }, [loadEstudiantes]);

  useEffect(() => {
    if (searchTerm.trim()) {
      const filtered = estudiantes.filter(
        (e) =>
          e.nombre_completo.toLowerCase().includes(searchTerm.toLowerCase()) ||
          e.ci.includes(searchTerm)
      );
      setFilteredEstudiantes(filtered);
    } else {
      setFilteredEstudiantes(estudiantes);
    }
  }, [searchTerm, estudiantes]);

  const loadExistingCalificacion = useCallback(
    async (estudianteId: string, materia: string) => {
      const { data } = await supabase
        .from('calificaciones')
        .select('*')
        .eq('estudiante_id', estudianteId)
        .eq('materia', materia)
        .maybeSingle();

      const cal = data as Calificacion | null;
      setExistingCal(cal);
      if (cal) {
        setParcial1(String(cal.parcial1));
        setParcial2(String(cal.parcial2));
        setParcial3(String(cal.parcial3));
        setExamenFinal(String(cal.examen_final));
      } else {
        setParcial1('');
        setParcial2('');
        setParcial3('');
        setExamenFinal('');
      }
    },
    []
  );

  const handleSelectEstudiante = (est: Estudiante) => {
    setSelectedEstudiante(est);
    setSearchTerm('');
    setSuccessMsg(null);
    setErrorMsg(null);
    if (selectedMateria) {
      loadExistingCalificacion(est.id, selectedMateria);
    }
  };

  const handleSelectMateria = (materia: string) => {
    setSelectedMateria(materia);
    setSuccessMsg(null);
    setErrorMsg(null);
    if (selectedEstudiante) {
      loadExistingCalificacion(selectedEstudiante.id, materia);
    }
  };

  const validateGrade = (value: string): boolean => {
    if (value === '') return true;
    const num = parseFloat(value);
    return !isNaN(num) && num >= 0 && num <= 5;
  };

  const handleSave = async () => {
    if (!selectedEstudiante || !selectedMateria) {
      setErrorMsg('Seleccione un estudiante y una materia');
      return;
    }

    if (!validateGrade(parcial1) || !validateGrade(parcial2) || !validateGrade(parcial3) || !validateGrade(examenFinal)) {
      setErrorMsg('Las notas deben estar entre 0 y 5');
      return;
    }

    if (!parcial1 || !parcial2 || !parcial3 || !examenFinal) {
      setErrorMsg('Complete todos los campos de calificacion');
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const p1 = parseFloat(parcial1);
    const p2 = parseFloat(parcial2);
    const p3 = parseFloat(parcial3);
    const ef = parseFloat(examenFinal);
    const promedio = (p1 + p2 + p3 + ef) / 4;

    if (existingCal) {
      const { error } = await supabase
        .from('calificaciones')
        .update({
          parcial1: p1,
          parcial2: p2,
          parcial3: p3,
          examen_final: ef,
          promedio,
        })
        .eq('id', existingCal.id);

      if (error) {
        setErrorMsg('Error al actualizar la calificacion');
      } else {
        setSuccessMsg('Calificacion actualizada correctamente');
        setExistingCal({ ...existingCal, parcial1: p1, parcial2: p2, parcial3: p3, examen_final: ef, promedio });
      }
    } else {
      const { data, error } = await supabase
        .from('calificaciones')
        .insert({
          estudiante_id: selectedEstudiante.id,
          materia: selectedMateria,
          parcial1: p1,
          parcial2: p2,
          parcial3: p3,
          examen_final: ef,
          promedio,
          periodo: PERIODO,
        })
        .select()
        .maybeSingle();

      if (error) {
        setErrorMsg('Error al guardar la calificacion');
      } else {
        setSuccessMsg('Calificacion registrada correctamente');
        setExistingCal(data as Calificacion);
      }
    }
    setSaving(false);
  };

  const handleClearSelection = () => {
    setSelectedEstudiante(null);
    setSelectedMateria('');
    setExistingCal(null);
    setParcial1('');
    setParcial2('');
    setParcial3('');
    setExamenFinal('');
    setSuccessMsg(null);
    setErrorMsg(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Cargando estudiantes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-navy-900 to-navy-800 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-brand-600 rounded-xl flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Carga de Calificaciones</h2>
            <p className="text-brand-300 text-sm">
              Seleccione el estudiante y la materia para registrar o editar notas
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Student list */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-bold text-navy-900 mb-4">Estudiantes</h3>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre o C.I."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-navy-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>

          {/* List */}
          <div className="space-y-1 max-h-[400px] overflow-y-auto">
            {filteredEstudiantes.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-8">Sin resultados</p>
            ) : (
              filteredEstudiantes.map((est) => (
                <button
                  key={est.id}
                  onClick={() => handleSelectEstudiante(est)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left ${
                    selectedEstudiante?.id === est.id
                      ? 'bg-brand-50 border border-brand-200'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  {est.foto_url ? (
                    <img
                      src={est.foto_url}
                      alt={est.nombre_completo}
                      className="w-9 h-9 rounded-lg object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-lg bg-brand-100 flex items-center justify-center flex-shrink-0">
                      <GraduationCap className="w-5 h-5 text-brand-600" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-navy-900 truncate">
                      {est.nombre_completo}
                    </p>
                    <p className="text-xs text-gray-400">
                      {est.ci} · {est.curso}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Grade form */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          {!selectedEstudiante ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <BookOpen className="w-8 h-8 text-gray-300" />
              </div>
              <p className="text-gray-400">
                Seleccione un estudiante de la lista para comenzar
              </p>
            </div>
          ) : (
            <>
              {/* Selected student header */}
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  {selectedEstudiante.foto_url ? (
                    <img
                      src={selectedEstudiante.foto_url}
                      alt={selectedEstudiante.nombre_completo}
                      className="w-12 h-12 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-brand-100 flex items-center justify-center">
                      <GraduationCap className="w-6 h-6 text-brand-600" />
                    </div>
                  )}
                  <div>
                    <p className="font-bold text-navy-900">{selectedEstudiante.nombre_completo}</p>
                    <p className="text-sm text-gray-400">
                      C.I. {selectedEstudiante.ci} · {selectedEstudiante.curso}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleClearSelection}
                  className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Materia selector */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-navy-800 mb-2">
                  Materia
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {MATERIAS.map((m) => (
                    <button
                      key={m}
                      onClick={() => handleSelectMateria(m)}
                      className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        selectedMateria === m
                          ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/20'
                          : 'bg-gray-50 text-navy-700 hover:bg-gray-100'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Grade inputs */}
              {selectedMateria && (
                <div className="animate-slide-up">
                  <div className="flex items-center gap-2 mb-4">
                    {existingCal ? (
                      <span className="flex items-center gap-1.5 text-sm text-brand-600 font-medium">
                        <Edit3 className="w-4 h-4" />
                        Editando calificacion existente
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-sm text-success-600 font-medium">
                        <Plus className="w-4 h-4" />
                        Nueva calificacion
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    {[
                      { label: 'Parcial 1', value: parcial1, setter: setParcial1 },
                      { label: 'Parcial 2', value: parcial2, setter: setParcial2 },
                      { label: 'Parcial 3', value: parcial3, setter: setParcial3 },
                      { label: 'Examen Final', value: examenFinal, setter: setExamenFinal },
                    ].map((field) => (
                      <div key={field.label}>
                        <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                          {field.label}
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="5"
                          step="0.1"
                          value={field.value}
                          onChange={(e) => field.setter(e.target.value)}
                          placeholder="0.0"
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-navy-900 text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                        />
                      </div>
                    ))}
                  </div>

                  {/* Promedio display */}
                  <div className="flex items-center justify-between p-5 bg-navy-900 rounded-2xl mb-6">
                    <div>
                      <p className="text-xs text-brand-300 uppercase tracking-wide font-semibold">
                        Promedio Calculado
                      </p>
                      <p className="text-3xl font-bold text-white mt-1">
                        {promedioCalculado}
                      </p>
                    </div>
                    <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center">
                      <span className="text-2xl font-bold text-brand-300">/5</span>
                    </div>
                  </div>

                  {/* Messages */}
                  {successMsg && (
                    <div className="flex items-center gap-3 p-4 bg-success-50 border border-success-100 rounded-xl mb-4 animate-slide-down">
                      <CheckCircle2 className="w-5 h-5 text-success-600 flex-shrink-0" />
                      <p className="text-success-700 text-sm font-medium">{successMsg}</p>
                    </div>
                  )}
                  {errorMsg && (
                    <div className="flex items-center gap-3 p-4 bg-error-50 border border-error-100 rounded-xl mb-4 animate-slide-down">
                      <AlertCircle className="w-5 h-5 text-error-600 flex-shrink-0" />
                      <p className="text-error-700 text-sm font-medium">{errorMsg}</p>
                    </div>
                  )}

                  {/* Save button */}
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full py-3.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-brand-600/20 disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Save className="w-5 h-5" />
                        {existingCal ? 'Actualizar Calificacion' : 'Guardar Calificacion'}
                      </>
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
