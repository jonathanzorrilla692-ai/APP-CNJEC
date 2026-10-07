import { useState } from 'react';
import {
  LayoutDashboard,
  QrCode,
  Megaphone,
  GraduationCap,
  BookOpen,
} from 'lucide-react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import Login from '@/components/Login';
import Layout from '@/components/Layout';
import HomeTutor from '@/components/HomeTutor';
import HomeProfesor from '@/components/HomeProfesor';
import Comunicados from '@/components/Comunicados';

function AppContent() {
  const { session, usuario, loading } = useAuth();
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

  if (!session || !usuario) {
    return <Login />;
  }

  const isStaff = usuario.rol === 'DOCENTE' || usuario.rol === 'DIRECTIVO';

  const navItems = isStaff
    ? [
        { label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" />, view: 'home' },
        { label: 'Escáner QR', icon: <QrCode className="w-5 h-5" />, view: 'scanner' },
        { label: 'Comunicados', icon: <Megaphone className="w-5 h-5" />, view: 'comunicados' },
      ]
    : [
        { label: 'Panel de Padres', icon: <LayoutDashboard className="w-5 h-5" />, view: 'home' },
        { label: 'Calificaciones', icon: <BookOpen className="w-5 h-5" />, view: 'calificaciones' },
        { label: 'Comunicados', icon: <Megaphone className="w-5 h-5" />, view: 'comunicados' },
      ];

  const renderView = () => {
    if (view === 'comunicados') return <Comunicados />;

    if (isStaff) {
      if (view === 'scanner') return <HomeProfesor />;
      return <HomeProfesor />;
    } else {
      if (view === 'calificaciones') return <HomeTutor />;
      return <HomeTutor />;
    }
  };

  return (
    <Layout currentView={view} onNavigate={setView} navItems={navItems}>
      {renderView()}
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
