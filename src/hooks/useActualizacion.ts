import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
export function useActualizacion(tabla: string, cargar: () => void) {
  useEffect(() => {
    const channel = supabase.channel(`${tabla}-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: tabla }, cargar).subscribe();
    const timer = window.setInterval(cargar, 30000);
    window.addEventListener('focus', cargar);
    return () => { void supabase.removeChannel(channel); clearInterval(timer); window.removeEventListener('focus', cargar); };
  }, [tabla, cargar]);
}
