import { ReactNode, useState } from 'react';
import { GraduationCap, LogOut, Menu, X, Bell, User as UserIcon } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface NavItem {
  label: string;
  icon: ReactNode;
  view: string;
}

interface LayoutProps {
  children: ReactNode;
  currentView: string;
  onNavigate: (view: string) => void;
  navItems: NavItem[];
}

export default function Layout({ children, currentView, onNavigate, navItems }: LayoutProps) {
  const { usuario, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const roleLabel =
    usuario?.rol === 'TUTOR'
      ? 'Tutor / Padre'
      : usuario?.rol === 'DOCENTE'
      ? 'Docente'
      : 'Directivo';

  const roleColor =
    usuario?.rol === 'TUTOR'
      ? 'bg-success-100 text-success-700'
      : usuario?.rol === 'DOCENTE'
      ? 'bg-brand-100 text-brand-700'
      : 'bg-warning-100 text-warning-700';

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar - desktop */}
      <aside
        className={`${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 fixed lg:sticky top-0 left-0 z-40 w-72 h-screen bg-navy-900 flex flex-col transition-transform duration-300 ease-in-out`}
      >
        {/* Logo */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-brand-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-white font-bold text-sm leading-tight truncate">
                Colegio Nacional
              </h1>
              <p className="text-brand-300 text-xs truncate">Juan Eudoro Cáceres</p>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden ml-auto text-white/60 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const active = currentView === item.view;
            return (
              <button
                key={item.view}
                onClick={() => {
                  onNavigate(item.view);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all ${
                  active
                    ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/20'
                    : 'text-navy-200 hover:bg-white/5 hover:text-white'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* User profile + logout */}
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 mb-3 px-4 py-2">
            <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center flex-shrink-0">
              <UserIcon className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-white text-sm font-semibold truncate">
                {usuario?.nombre_completo}
              </p>
              <span
                className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${roleColor}`}
              >
                {roleLabel}
              </span>
            </div>
          </div>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-navy-200 hover:bg-error-600/20 hover:text-error-100 font-medium text-sm transition-all"
          >
            <LogOut className="w-5 h-5" />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-navy-900/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="glass sticky top-0 z-20 border-b border-gray-200 px-4 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
            >
              <Menu className="w-5 h-5 text-navy-800" />
            </button>
            <div>
              <h2 className="text-lg font-bold text-navy-900">
                {navItems.find((n) => n.view === currentView)?.label || 'Panel'}
              </h2>
              <p className="text-xs text-gray-400">
                {new Date().toLocaleDateString('es-PY', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('comunicados')}
            className="relative p-2.5 rounded-xl bg-white border border-gray-200 hover:border-brand-300 hover:bg-brand-50 transition-all"
          >
            <Bell className="w-5 h-5 text-navy-700" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-brand-600 rounded-full" />
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-8 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
