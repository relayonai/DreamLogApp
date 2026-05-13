import { useState } from 'react';
import { View, Text, Switch, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../types/database';

type UserInsert = Database['public']['Tables']['users']['Insert'];

export default function OnboardingScreen() {
  const [wakeWordEnabled, setWakeWordEnabled] = useState(false);
  const [watchPaired, setWatchPaired] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleFinish() {
    setLoading(true);
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user || !user.email) {
      Alert.alert('Error', 'Session expired. Please log in again.');
      setLoading(false);
      return;
    }
    const upsertData: UserInsert = {
      id: user.id,
      email: user.email,
      preferences: {
        wake_word_enabled: wakeWordEnabled,
        watch_paired: watchPaired,
        default_comic_style: 'classic',
        wake_window_start: null,
        wake_window_end: null,
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('users') as any).upsert(upsertData);
    if (error) {
      Alert.alert('Error', 'Could not save preferences. Please try again.');
      setLoading(false);
      return;
    }
    router.replace('/(tabs)/home');
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>How should we wake you?</Text>

      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text style={styles.label}>Wake Word</Text>
          <Text style={styles.sub}>"Hey DreamLog" — on-device, no cloud</Text>
        </View>
        <Switch value={wakeWordEnabled} onValueChange={setWakeWordEnabled} />
      </View>

      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text style={styles.label}>Apple Watch</Text>
          <Text style={styles.sub}>Detects REM exit automatically</Text>
        </View>
        <Switch value={watchPaired} onValueChange={setWatchPaired} />
      </View>

      <Text style={styles.note}>You can set a Smart Alarm Window in Settings anytime.</Text>

      <TouchableOpacity style={styles.button} onPress={handleFinish} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Saving…' : 'Start capturing dreams →'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 32, backgroundColor: '#0a0a14', justifyContent: 'center' },
  heading: { fontSize: 26, fontWeight: '700', color: '#fff', marginBottom: 32 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1a1a2e', borderRadius: 12, padding: 16, marginBottom: 12 },
  rowText: { flex: 1, marginRight: 12 },
  label: { color: '#fff', fontWeight: '600', fontSize: 15 },
  sub: { color: '#888', fontSize: 13, marginTop: 2 },
  note: { color: '#666', fontSize: 13, marginBottom: 32, lineHeight: 20 },
  button: { backgroundColor: '#6c63ff', borderRadius: 12, padding: 16, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
