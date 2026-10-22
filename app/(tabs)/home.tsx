import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { listDreams } from '../../lib/dreams';
import { flushUploadQueue } from '../../lib/storage';
import { ProcessingCard } from '../../components/shared/ProcessingCard';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import type { Database } from '../../types/database';

type Dream = Database['public']['Tables']['dreams']['Row'];

export default function HomeScreen() {
  const [dreams, setDreams] = useState<Dream[]>([]);
  const [refreshing, setRefreshing] = useState(false);
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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadDreams();
    setRefreshing(false);
  }, []);

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
  const isRecording = state === 'recording';

  function formatDuration(ms: number) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}:${sec.toString().padStart(2, '0')}` : `0:${sec.toString().padStart(2, '0')}`;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.heading}>DreamLog</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{dreams.length}</Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.recordBtn, isRecording && styles.recordBtnActive]}
        onPress={isRecording ? handleStop : startRecording}
        activeOpacity={0.7}
      >
        <View style={styles.recordBtnInner}>
          <View style={[styles.recordDot, isRecording && styles.recordDotActive]} />
          <View>
            <Text style={styles.recordBtnText}>
              {isRecording ? 'Stop Recording' : 'Record a Dream'}
            </Text>
            {isRecording ? (
              <Text style={styles.recordTimer}>{formatDuration(durationMs)}</Text>
            ) : (
              <Text style={styles.recordSub}>Tap to start capturing</Text>
            )}
          </View>
        </View>
        {isRecording && (
          <View style={styles.recordingIndicator}>
            <View style={styles.recordingBar} />
            <View style={[styles.recordingBar, { height: 16 }]} />
            <View style={[styles.recordingBar, { height: 10 }]} />
            <View style={[styles.recordingBar, { height: 20 }]} />
            <View style={[styles.recordingBar, { height: 8 }]} />
          </View>
        )}
      </TouchableOpacity>

      {showSilenceNudge && (
        <View style={styles.nudge}>
          <View style={styles.nudgeDot} />
          <Text style={styles.nudgeText}>Listening for your voice...</Text>
          <TouchableOpacity onPress={handleStop} style={styles.nudgeCancelBtn}>
            <Text style={styles.nudgeCancel}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {pendingDreams.map(d => (
        <ProcessingCard key={d.id} dreamId={d.id} recordedAt={d.recorded_at} onReady={loadDreams} />
      ))}

      {readyDreams.length === 0 && pendingDreams.length === 0 && (
        <View style={styles.emptyState}>
          <View style={styles.emptyCircle}>
            <View style={styles.emptyMoon} />
          </View>
          <Text style={styles.emptyTitle}>No dreams yet</Text>
          <Text style={styles.emptyText}>
            Record right after waking up.{'\n'}We'll turn it into an illustrated comic.
          </Text>
        </View>
      )}

      {readyDreams.length > 0 && (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Dreams</Text>
          <Text style={styles.sectionCount}>{readyDreams.length}</Text>
        </View>
      )}

      <FlatList
        data={readyDreams}
        keyExtractor={d => d.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8b7cf7" />
        }
        renderItem={({ item, index }) => (
          <TouchableOpacity
            style={[styles.dreamItem, index === 0 && styles.dreamItemFirst]}
            onPress={() => router.push(`/dream/${item.id}`)}
            activeOpacity={0.6}
          >
            <View style={styles.dreamLeft}>
              <View style={[styles.dreamDot, { backgroundColor: item.status === 'ready' ? '#8b7cf7' : '#444' }]} />
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
            </View>
            <Text style={styles.dreamChevron}>{'>'}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a14', paddingHorizontal: 20, paddingTop: 60 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  heading: { color: '#fff', fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  badge: { backgroundColor: 'rgba(139,124,247,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { color: '#8b7cf7', fontSize: 13, fontWeight: '600' },
  recordBtn: {
    backgroundColor: '#12122a',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(139,124,247,0.2)',
  },
  recordBtnActive: { borderColor: '#ff4455', backgroundColor: '#1a0a10' },
  recordBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  recordDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#8b7cf7' },
  recordDotActive: { backgroundColor: '#ff4455' },
  recordBtnText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  recordSub: { color: '#555', fontSize: 13, marginTop: 2 },
  recordTimer: { color: '#ff4455', fontSize: 14, fontWeight: '600', marginTop: 2, fontVariant: ['tabular-nums'] },
  recordingIndicator: { flexDirection: 'row', gap: 3, marginTop: 14, alignItems: 'flex-end', height: 22 },
  recordingBar: { width: 3, height: 12, backgroundColor: '#ff4455', borderRadius: 2, opacity: 0.6 },
  nudge: {
    backgroundColor: '#12122a',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  nudgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#8b7cf7', marginRight: 10 },
  nudgeText: { color: '#777', fontSize: 14, flex: 1 },
  nudgeCancelBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: 'rgba(255,68,85,0.1)' },
  nudgeCancel: { color: '#ff4455', fontSize: 13, fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingVertical: 56, paddingHorizontal: 40 },
  emptyCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(139,124,247,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(139,124,247,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyMoon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#8b7cf7',
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
    transform: [{ rotate: '-45deg' }],
  },
  emptyTitle: { color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 8 },
  emptyText: { color: '#555', fontSize: 14, lineHeight: 21, textAlign: 'center' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 8 },
  sectionTitle: { color: '#777', fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionCount: { color: '#555', fontSize: 12 },
  dreamItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#12122a',
    borderRadius: 14,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  dreamItemFirst: { borderColor: 'rgba(139,124,247,0.15)' },
  dreamLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  dreamDot: { width: 8, height: 8, borderRadius: 4 },
  dreamDate: { color: '#ddd', fontSize: 15, fontWeight: '500' },
  dreamPreview: { color: '#666', fontSize: 13, marginTop: 3, maxWidth: 240 },
  dreamChevron: { color: '#444', fontSize: 16, fontWeight: '300' },
});
