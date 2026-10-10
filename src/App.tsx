import { useState } from 'react';
import {
  LayoutDashboard,
  QrCode,
  Megaphone,
  GraduationCap,
  BookOpen,
  Users,
  History,
} from 'lucide-react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import Login from '@/components/Login';
import Layout from '@/components/Layout';
import HomeTutor from '@/components/HomeTutor';
import HomeProfesor from '@/components/HomeProfesor';
import Comunicados from '@/components/Comunicados';
import HomeEstudiante from '@/components/HomeEstudiante';
import CargaNotas from '@/components/CargaNotas';
import Carnets from '@/components/Carnets';
import GestionEstudiantes from '@/components/GestionEstudiantes';
import GestionMaterias from '@/components/GestionMaterias';
import HistorialAsistencia from '@/components/HistorialAsistencia';
import { configuracionValida } from '@/lib/supabase';

function AppContent() {
  const { session, usuario, loading, error, signOut } = useAuth();
  const [view, setView] = useState('home');

  if (loading) {
    return (
      <div className="min-h-screen bg-navy-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-14 h-14 bg-brand-600 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <div className="w-8 h-8 border-3 border-brand-400 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  if (session && error && !usuario) return <main className="panel max-w-xl mx-auto mt-10"><p role="alert" className="notice-error">{error}</p><button className="btn mt-4" onClick={signOut}>Volver al inicio de sesión</button></main>;
  if (!session || !usuario) {
    return <Login />;
  }

  const isStaff = ['DOCENTE', 'DIRECTIVO', 'PRECEPTOR'].includes(usuario.rol);
  const puedeNotas = usuario.rol === 'DOCENTE' || usuario.rol === 'DIRECTIVO';

  const navItems = isStaff
    ? [
        { label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" />, view: 'home' },
        { label: 'Escáner QR', icon: <QrCode className="w-5 h-5" />, view: 'scanner' },
        { label: 'Carnets digitales', icon: <GraduationCap className="w-5 h-5" />, view: 'carnets' },
        { label: 'Historial de asistencia', icon: <History className="w-5 h-5" />, view: 'historial' },
        ...(usuario.rol === 'DIRECTIVO' ? [
          { label: 'Estudiantes', icon: <Users className="w-5 h-5" />, view: 'estudiantes' },
          { label: 'Materias', icon: <BookOpen className="w-5 h-5" />, view: 'materias' },
        ] : []),
        ...(puedeNotas ? [{ label: 'Carga de notas', icon: <BookOpen className="w-5 h-5" />, view: 'notas' }] : []),
        { label: 'Comunicados', icon: <Megaphone className="w-5 h-5" />, view: 'comunicados' },
      ]
    : [
        { label: usuario.rol === 'ESTUDIANTE' ? 'Mi panel' : 'Panel de Padres', icon: <LayoutDashboard className="w-5 h-5" />, view: 'home' },
        { label: 'Carnet digital', icon: <QrCode className="w-5 h-5" />, view: 'carnet' },
        { label: 'Calificaciones', icon: <BookOpen className="w-5 h-5" />, view: 'calificaciones' },
        { label: 'Comunicados', icon: <Megaphone className="w-5 h-5" />, view: 'comunicados' },
      ];

  const renderView = () => {
    if (view === 'comunicados') return <Comunicados />;

    if (isStaff) {
      if (view === 'historial') return <HistorialAsistencia />;
      if (view === 'estudiantes' && usuario.rol === 'DIRECTIVO') return <GestionEstudiantes />;
      if (view === 'materias' && usuario.rol === 'DIRECTIVO') return <GestionMaterias />;
      if (view === 'carnets') return <Carnets />;
      if (view === 'notas' && puedeNotas) return <CargaNotas />;
      if (view === 'scanner') return <HomeProfesor scanner />;
      return <HomeProfesor />;
    } else {
      const modo = view === 'calificaciones' ? 'notas' : view === 'carnet' ? 'carnet' : 'resumen';
      return usuario.rol === 'ESTUDIANTE' ? <HomeEstudiante modo={modo} /> : <HomeTutor modo={modo} />;
    }
  };

  return (
    <Layout currentView={view} onNavigate={setView} navItems={navItems}>
      {renderView()}
    </Layout>
  );
}

export default function App() {
  if (!configuracionValida) return <main className="max-w-xl mx-auto p-8"><h1 className="text-xl font-bold">Configuración pendiente</h1><p>Configurá VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY para iniciar la plataforma.</p></main>;
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
