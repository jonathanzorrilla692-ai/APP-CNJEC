import { useState, FormEvent } from 'react';
import { GraduationCap, Lock, User, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function Login() {
  const { signIn } = useAuth();
  const [ci, setCi] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ci.trim() || !password.trim()) {
      setError('Por favor complete todos los campos');
      return;
    }
    setError(null);
    setLoading(true);
    const { error: signInError } = await signIn(ci.trim(), password);
    setLoading(false);
    if (signInError) {
      setError('Cédula de Identidad o contraseña incorrecta');
    }
  };

  const fillDemo = (demoCi: string, demoPass: string) => {
    setCi(demoCi);
    setPassword(demoPass);
    setError(null);
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left panel - branding */}
      <div className="lg:w-1/2 bg-navy-900 relative overflow-hidden flex items-center justify-center p-8 lg:p-16">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-brand-600 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/4" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-brand-500 rounded-full blur-3xl translate-x-1/3 translate-y-1/4" />
        </div>
        <div className="relative z-10 max-w-md text-white">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-14 h-14 bg-brand-600 rounded-2xl flex items-center justify-center shadow-lg shadow-brand-600/30">
              <GraduationCap className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold leading-tight">Colegio Nacional</h1>
              <p className="text-brand-300 text-sm">Juan Eudoro Cáceres</p>
            </div>
          </div>
          <h2 className="text-3xl lg:text-4xl font-bold leading-tight mb-4">
            Plataforma de Gestión Escolar
          </h2>
          <p className="text-navy-200 text-lg leading-relaxed mb-10">
            Sistema integral de asistencia, calificaciones y comunicación institucional.
          </p>
          <div className="space-y-4">
            {[
              { title: 'Asistencia por QR', desc: 'Registro rápido y seguro' },
              { title: 'Calificaciones en línea', desc: 'Seguimiento académico en tiempo real' },
              { title: 'Comunicados institucionales', desc: 'Información al día para tutores' },
            ].map((item) => (
              <div key={item.title} className="flex items-center gap-4">
                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center border border-white/10">
                  <div className="w-2.5 h-2.5 bg-brand-400 rounded-full" />
                </div>
                <div>
                  <p className="font-semibold text-white">{item.title}</p>
                  <p className="text-navy-300 text-sm">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel - login form */}
      <div className="lg:w-1/2 flex items-center justify-center p-8 lg:p-16 bg-gray-50">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-navy-900 mb-2">Iniciar Sesión</h2>
            <p className="text-gray-500">Ingrese sus credenciales para acceder al sistema</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="flex items-center gap-3 p-4 bg-error-50 border border-error-100 rounded-xl animate-slide-down">
                <AlertCircle className="w-5 h-5 text-error-600 flex-shrink-0" />
                <p className="text-error-700 text-sm font-medium">{error}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-navy-800 mb-2">
                Cédula de Identidad
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={ci}
                  onChange={(e) => setCi(e.target.value)}
                  placeholder="Ej: 1234567"
                  className="w-full pl-12 pr-4 py-3.5 bg-white border border-gray-200 rounded-xl text-navy-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                  autoComplete="username"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-navy-800 mb-2">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-12 pr-12 py-3.5 bg-white border border-gray-200 rounded-xl text-navy-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-brand-600/20 hover:shadow-brand-600/30 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Ingresando...
                </>
              ) : (
                'Ingresar al Sistema'
              )}
            </button>
          </form>

          {/* Demo credentials */}
          {import.meta.env.DEV && import.meta.env.VITE_DEMO_LOGIN === 'true' && <div className="mt-8 p-5 bg-white border border-gray-200 rounded-xl">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              Credenciales de Demostración
            </p>
            <div className="space-y-2">
              <button
                onClick={() => fillDemo('1234567', 'Tutor2026!')}
                className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-brand-50 rounded-lg transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-brand-100 rounded-lg flex items-center justify-center">
                    <User className="w-4 h-4 text-brand-600" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-navy-800">Tutor / Padre</p>
                    <p className="text-xs text-gray-400">CI: 1234567 · Clave: Tutor2026!</p>
                  </div>
                </div>
              </button>
              <button
                onClick={() => fillDemo('9876543', 'Docente2026!')}
                className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-brand-50 rounded-lg transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-brand-100 rounded-lg flex items-center justify-center">
                    <User className="w-4 h-4 text-brand-600" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-navy-800">Docente</p>
                    <p className="text-xs text-gray-400">CI: 9876543 · Clave: Docente2026!</p>
                  </div>
                </div>
              </button>
              <button
                onClick={() => fillDemo('1111111', 'Directivo2026!')}
                className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-brand-50 rounded-lg transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-brand-100 rounded-lg flex items-center justify-center">
                    <User className="w-4 h-4 text-brand-600" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-navy-800">Directivo</p>
                    <p className="text-xs text-gray-400">CI: 1111111 · Clave: Directivo2026!</p>
                  </div>
                </div>
              </button>
            </div>
          </div>}
        </div>
      </div>
    </div>
  );
}
