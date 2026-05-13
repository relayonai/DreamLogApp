import { useEffect, useState } from 'react';
import { View, Text, Switch, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../types/database';
import { DreamLogRecorder } from '../../native/DreamLogRecorder';

type UserPreferences = NonNullable<Database['public']['Tables']['users']['Row']['preferences']>;

const STYLES = ['classic', 'graphic_novel', 'manga', 'surreal'] as const;

export default function SettingsScreen() {
  const [wakeWordEnabled, setWakeWordEnabled] = useState(false);
  const [watchPaired, setWatchPaired] = useState(false);
  const [wakeWindowEnabled, setWakeWindowEnabled] = useState(false);
  const [defaultStyle, setDefaultStyle] = useState('classic');
  const router = useRouter();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('users').select('preferences').eq('id', user.id).single();
      if (!data?.preferences) return;
      setWakeWordEnabled(data.preferences.wake_word_enabled ?? false);
      setWatchPaired(data.preferences.watch_paired ?? false);
      setWakeWindowEnabled(data.preferences.wake_window_start !== null);
      setDefaultStyle(data.preferences.default_comic_style ?? 'classic');
    }
    load();
  }, []);

  async function savePreferences(updates: Partial<UserPreferences>) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('users').select('preferences').eq('id', user.id).single();
    const merged = { ...(data?.preferences ?? {}), ...updates } as UserPreferences;
    await supabase.from('users').update({ preferences: merged }).eq('id', user.id);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace('/(auth)/login');
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Settings</Text>

      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text style={styles.label}>Wake Word</Text>
          <Text style={styles.sub}>"Hey DreamLog" — on-device, no cloud</Text>
        </View>
        <Switch value={wakeWordEnabled} onValueChange={async v => { setWakeWordEnabled(v); await savePreferences({ wake_word_enabled: v }); }} />
      </View>

      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text style={styles.label}>Apple Watch</Text>
          <Text style={styles.sub}>REM-exit detection via HRV</Text>
        </View>
        <Switch value={watchPaired} onValueChange={async v => { setWatchPaired(v); await savePreferences({ watch_paired: v }); }} />
      </View>

      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text style={styles.label}>Smart Alarm Window</Text>
          <Text style={styles.sub}>Daily notification at start of your wake window</Text>
        </View>
        <Switch value={wakeWindowEnabled} onValueChange={async v => {
          setWakeWindowEnabled(v);
          if (v) {
            await DreamLogRecorder.scheduleWakeWindow(6, 0);
            await savePreferences({ wake_window_start: '6:00', wake_window_end: '7:30' });
          } else {
            await DreamLogRecorder.cancelWakeWindow();
            await savePreferences({ wake_window_start: null, wake_window_end: null });
          }
        }} />
      </View>

      <Text style={styles.sectionLabel}>Default Comic Style</Text>
      <View style={styles.styleGrid}>
        {STYLES.map(s => (
          <TouchableOpacity key={s} style={[styles.styleOption, defaultStyle === s && styles.styleOptionActive]}
            onPress={() => { setDefaultStyle(s); savePreferences({ default_comic_style: s }); }}>
            <Text style={styles.styleText}>{s.replace('_', ' ')}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.signOut} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a14', padding: 20, paddingTop: 60 },
  heading: { color: '#fff', fontSize: 28, fontWeight: '700', marginBottom: 32 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1a1a2e', borderRadius: 12, padding: 16, marginBottom: 12 },
  rowText: { flex: 1, marginRight: 12 },
  label: { color: '#fff', fontWeight: '600', fontSize: 15 },
  sub: { color: '#888', fontSize: 13, marginTop: 2 },
  sectionLabel: { color: '#888', fontSize: 13, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  styleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  styleOption: { borderWidth: 1, borderColor: '#444', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  styleOptionActive: { borderColor: '#6c63ff', backgroundColor: 'rgba(108,99,255,0.2)' },
  styleText: { color: '#fff', fontSize: 14 },
  signOut: { marginTop: 48, padding: 16, alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: '#ff4444' },
  signOutText: { color: '#ff4444', fontWeight: '600', fontSize: 15 },
});
