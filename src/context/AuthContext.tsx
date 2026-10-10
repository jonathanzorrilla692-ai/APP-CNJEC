import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { mensajeError } from '@/lib/errores';
import type { Usuario } from '@/types';

interface AuthContextValue {
  session: Session | null; usuario: Usuario | null; loading: boolean; error: string;
  signIn: (ci: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}
const AuthContext = createContext<AuthContextValue | undefined>(undefined);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const version = useRef(0);
  useEffect(() => {
    const contador = version;
    let vivo = true;
    let timer: ReturnType<typeof setTimeout>;
    let uidActual: string | null = null;
    let perfilCargado = false;
    const aplicar = (actual: Session | null) => {
      // La renovación del token no debe desmontar formularios con cambios sin guardar.
      if (actual && actual.user.id === uidActual && perfilCargado) { setSession(actual); return; }
      uidActual = actual?.user.id ?? null; perfilCargado = false;
      const turno = ++version.current;
      setSession(actual); setUsuario(null); setError(''); setLoading(!!actual);
      if (!actual) return;
      // Fuera del callback de Auth para no bloquear su lock interno.
      clearTimeout(timer);
      timer = setTimeout(async () => {
        try {
          const { data, error } = await supabase.from('usuarios').select('*').eq('id', actual.user.id).maybeSingle();
          if (!vivo || turno !== version.current) return;
          if (error) throw error;
          if (!data) throw new Error('La cuenta no tiene un perfil vinculado. Contactá al colegio.');
          setUsuario(data as Usuario);
          perfilCargado = true;
        } catch (e) { if (vivo && turno === version.current) setError(mensajeError(e)); }
        finally { if (vivo && turno === version.current) setLoading(false); }
      }, 0);
    };
    const { data } = supabase.auth.onAuthStateChange((_event, actual) => aplicar(actual));
    supabase.auth.getSession().then(({ data, error }) => {
      if (!vivo || version.current !== 0) return;
      if (error) { setError(mensajeError(error)); setLoading(false); }
      else aplicar(data.session);
    }).catch(e => { if (vivo) { setError(mensajeError(e)); setLoading(false); } });
    return () => { vivo = false; contador.current++; clearTimeout(timer); data.subscription.unsubscribe(); };
  }, []);
  const signIn = useCallback(async (ci: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: `${ci.trim()}@colegio.edu.py`, password });
      return { error: error?.message ?? null };
    } catch (e) { return { error: mensajeError(e) }; }
  }, []);
  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) { setError(mensajeError(error)); return; }
    setUsuario(null); setSession(null); setError('');
  }, []);
  return <AuthContext.Provider value={{ session, usuario, loading, error, signIn, signOut }}>{children}</AuthContext.Provider>;
}
// Shared hook and provider intentionally live together.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return context;
}
