import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { listDreams } from '../../lib/dreams';
import { flushUploadQueue } from '../../lib/storage';
import { ProcessingCard } from '../../components/shared/ProcessingCard';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import type { Database } from '../../types/database';

type Dream = Database['public']['Tables']['dreams']['Row'];

export default function HomeScreen() {
  const [dreams, setDreams] = useState<Dream[]>([]);
  const { state, durationMs, showSilenceNudge, startRecording, stopRecording } = useAudioRecorder();
  const router = useRouter();

  useEffect(() => {
    flushUploadQueue();
    loadDreams();
  }, []);

  async function loadDreams() {
    try {
      const data = await listDreams();
      setDreams(data);
    } catch {
      // silently fail — list stays empty
    }
  }

  async function handleStop() {
    const result = await stopRecording();
    if (result.tooShort) {
      Alert.alert(
        'That was a short one',
        'Want to add more or save it as is?',
        [
          { text: 'Add more', onPress: startRecording },
          { text: 'Save as is', onPress: loadDreams },
        ]
      );
    } else if (result.dreamId) {
      loadDreams();
    }
  }

  const pendingDreams = dreams.filter(d => d.status !== 'ready');
  const readyDreams = dreams.filter(d => d.status === 'ready');

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>DreamLog</Text>
      <Text style={styles.subheading}>Capture your dreams before they fade</Text>

      <TouchableOpacity
        style={[styles.recordBtn, state === 'recording' && styles.recordBtnActive]}
        onPress={state === 'recording' ? handleStop : startRecording}
        activeOpacity={0.7}
      >
        <View style={[styles.recordDot, state === 'recording' && styles.recordDotActive]} />
        <Text style={styles.recordBtnText}>
          {state === 'recording' ? `Stop Recording  ·  ${Math.floor(durationMs / 1000)}s` : 'Record a Dream'}
        </Text>
      </TouchableOpacity>

      {showSilenceNudge && (
        <View style={styles.nudge}>
          <Text style={styles.nudgeText}>We're listening…</Text>
          <TouchableOpacity onPress={handleStop}>
            <Text style={styles.nudgeCancel}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {pendingDreams.map(d => (
        <ProcessingCard key={d.id} dreamId={d.id} recordedAt={d.recorded_at} onReady={loadDreams} />
      ))}

      {readyDreams.length === 0 && pendingDreams.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🌙</Text>
          <Text style={styles.emptyTitle}>No dreams yet</Text>
          <Text style={styles.emptyText}>
            Tap the button above right after you wake up to capture your dream. We'll turn it into an illustrated comic.
          </Text>
        </View>
      )}

      <FlatList
        data={readyDreams}
        keyExtractor={d => d.id}
        contentContainerStyle={readyDreams.length > 0 ? styles.listContent : undefined}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.dreamItem} onPress={() => router.push(`/dream/${item.id}`)} activeOpacity={0.7}>
            <View>
              <Text style={styles.dreamDate}>
                {new Date(item.recorded_at).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
              </Text>
              {item.transcription_raw && (
                <Text style={styles.dreamPreview} numberOfLines={1}>
                  {item.transcription_raw.slice(0, 80)}
                </Text>
              )}
            </View>
            <Text style={styles.dreamArrow}>›</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a14', padding: 20, paddingTop: 60 },
  heading: { color: '#fff', fontSize: 28, fontWeight: '700' },
  subheading: { color: '#666', fontSize: 14, marginTop: 4, marginBottom: 24 },
  recordBtn: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#2a2a44',
    gap: 12,
  },
  recordBtnActive: { borderColor: '#ff4444', backgroundColor: '#1a0a0a' },
  recordDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#6c63ff' },
  recordDotActive: { backgroundColor: '#ff4444' },
  recordBtnText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  nudge: { backgroundColor: '#1a1a2e', borderRadius: 12, padding: 12, flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  nudgeText: { color: '#888', fontSize: 14 },
  nudgeCancel: { color: '#ff4444', fontSize: 14, fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 8 },
  emptyText: { color: '#666', fontSize: 14, lineHeight: 20, textAlign: 'center' },
  listContent: { paddingTop: 8 },
  dreamItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  dreamDate: { color: '#ddd', fontSize: 15, fontWeight: '500' },
  dreamPreview: { color: '#777', fontSize: 13, marginTop: 4, maxWidth: 260 },
  dreamArrow: { color: '#6c63ff', fontSize: 22, fontWeight: '300' },
});
