import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';

type DreamStatus = Database['public']['Tables']['dreams']['Row']['status'];

export function useDreamStatus(dreamId: string) {
  const [status, setStatus] = useState<DreamStatus | null>(null);

  useEffect(() => {
    supabase.from('dreams').select('status').eq('id', dreamId).single()
      .then(({ data }) => { if (data) setStatus(data.status); });

    const channel = supabase
      .channel(`dream-status-${dreamId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'dreams', filter: `id=eq.${dreamId}`,
      }, (payload) => {
        setStatus((payload.new as { status: DreamStatus }).status);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [dreamId]);

  return status;
}
