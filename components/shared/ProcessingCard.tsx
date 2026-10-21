import { useEffect } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useDreamStatus } from '../../hooks/useDreamStatus';

interface Props { dreamId: string; recordedAt: string; onReady: () => void; }

const STEP_MESSAGES: Record<string, string> = {
  uploading: 'Uploading your dream…',
  transcribing: 'Listening to your words…',
  analysing: 'Finding the story threads…',
  splitting: 'Breaking into scenes…',
  generating: 'Painting your comic panels…',
};

const STATUS_MESSAGES: Record<string, string> = {
  pending: 'Getting ready…',
  pending_sync: 'Waiting for connection…',
  processing: 'Your dream is being illustrated…',
  failed: 'Something went wrong.',
};

export function ProcessingCard({ dreamId, recordedAt, onReady }: Props) {
  const { status, pipelineStep, failedReason } = useDreamStatus(dreamId);

  useEffect(() => {
    if (status === 'ready') onReady();
  }, [status, onReady]);

  if (status === 'ready') return null;

  async function handleRetry() {
    const { error: updateErr } = await supabase.from('dreams').update({ status: 'pending', pipeline_step: 'uploading' }).eq('id', dreamId);
    if (updateErr) return;
    await supabase.functions.invoke('transcribe', { body: { dream_id: dreamId } });
  }

  const message = pipelineStep && STEP_MESSAGES[pipelineStep]
    ? STEP_MESSAGES[pipelineStep]
    : STATUS_MESSAGES[status ?? 'processing'];

  return (
    <View style={styles.card}>
      {status !== 'failed' && <ActivityIndicator color="#6c63ff" />}
      <View style={styles.text}>
        <Text style={styles.label}>{message}</Text>
        {status === 'failed' && failedReason && (
          <Text style={styles.reason}>{failedReason}</Text>
        )}
        <Text style={styles.date}>{new Date(recordedAt).toLocaleDateString()}</Text>
      </View>
      {status === 'failed' && (
        <TouchableOpacity onPress={handleRetry} style={styles.retryBtn}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a2e', borderRadius: 16, padding: 16, marginBottom: 12, gap: 12 },
  text: { flex: 1 },
  label: { color: '#fff', fontSize: 15, fontWeight: '500' },
  date: { color: '#666', fontSize: 13, marginTop: 4 },
  retryBtn: { backgroundColor: '#2a1a00', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#ff4444' },
  reason: { color: '#ff8866', fontSize: 13, marginTop: 2 },
  retryText: { color: '#ff6644', fontWeight: '600', fontSize: 13 },
});
