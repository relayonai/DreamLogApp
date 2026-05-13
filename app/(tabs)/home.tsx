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
    const data = await listDreams();
    setDreams(data);
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

      <TouchableOpacity
        style={[styles.recordBtn, state === 'recording' && styles.recordBtnActive]}
        onPress={state === 'recording' ? handleStop : startRecording}
      >
        <Text style={styles.recordBtnText}>
          {state === 'recording' ? `■ Stop (${Math.floor(durationMs / 1000)}s)` : '● Record a Dream'}
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

      <FlatList
        data={readyDreams}
        keyExtractor={d => d.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.dreamItem} onPress={() => router.push(`/dream/${item.id}`)}>
            <Text style={styles.dreamDate}>
              {new Date(item.recorded_at).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
            </Text>
            <Text style={styles.dreamArrow}>→</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a14', padding: 20, paddingTop: 60 },
  heading: { color: '#fff', fontSize: 28, fontWeight: '700', marginBottom: 24 },
  recordBtn: { backgroundColor: '#1a1a2e', borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 16, borderWidth: 2, borderColor: '#333' },
  recordBtnActive: { borderColor: '#ff4444', backgroundColor: '#2a1a1a' },
  recordBtnText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  nudge: { backgroundColor: '#1a1a2e', borderRadius: 12, padding: 12, flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  nudgeText: { color: '#888', fontSize: 14 },
  nudgeCancel: { color: '#ff4444', fontSize: 14, fontWeight: '600' },
  dreamItem: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#1a1a2e', borderRadius: 12, padding: 16, marginBottom: 8 },
  dreamDate: { color: '#ccc', fontSize: 15 },
  dreamArrow: { color: '#6c63ff', fontSize: 15 },
});
