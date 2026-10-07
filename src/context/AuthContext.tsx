import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Usuario } from '@/types';

interface AuthContextValue {
  session: Session | null;
  usuario: Usuario | null;
  loading: boolean;
  signIn: (ci: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUsuario = useCallback(async (uid: string) => {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', uid)
      .maybeSingle();

    if (error) {
      console.error('Error loading usuario:', error);
      setUsuario(null);
      return;
    }
    setUsuario(data as Usuario | null);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        loadUsuario(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        (async () => {
          await loadUsuario(session.user.id);
        })();
      } else {
        setUsuario(null);
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [loadUsuario]);

  const signIn = useCallback(async (ci: string, password: string) => {
    const email = `${ci}@colegio.edu.py`;
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { error: error.message };
    }
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUsuario(null);
    setSession(null);
  }, []);

  return (
    <AuthContext.Provider value={{ session, usuario, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
