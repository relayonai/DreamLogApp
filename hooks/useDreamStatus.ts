import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';

type DreamStatus = Database['public']['Tables']['dreams']['Row']['status'];

interface DreamProgress {
  status: DreamStatus | null;
  pipelineStep: string | null;
  failedReason: string | null;
}

export function useDreamStatus(dreamId: string): DreamProgress {
  const [progress, setProgress] = useState<DreamProgress>({
    status: null,
    pipelineStep: null,
    failedReason: null,
  });

  useEffect(() => {
    supabase.from('dreams').select('status, pipeline_step, failed_reason').eq('id', dreamId).single()
      .then(({ data }) => {
        if (data) {
          setProgress(prev =>
            prev.status === null
              ? { status: data.status, pipelineStep: data.pipeline_step, failedReason: data.failed_reason }
              : prev,
          );
        }
      });

    const channel = supabase
      .channel(`dream-status-${dreamId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'dreams', filter: `id=eq.${dreamId}`,
      }, (payload) => {
        const row = payload.new as Record<string, unknown>;
        setProgress({
          status: (typeof row.status === 'string' ? row.status : null) as DreamStatus | null,
          pipelineStep: typeof row.pipeline_step === 'string' ? row.pipeline_step : null,
          failedReason: typeof row.failed_reason === 'string' ? row.failed_reason : null,
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [dreamId]);

  return progress;
}
