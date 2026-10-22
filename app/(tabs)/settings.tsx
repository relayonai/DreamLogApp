import { useEffect, useState } from 'react';
import { View, Text, Switch, TouchableOpacity, StyleSheet, ScrollView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../types/database';
import { DreamLogRecorder } from '../../native/DreamLogRecorder';

type UserPreferences = NonNullable<Database['public']['Tables']['users']['Row']['preferences']>;

const STYLES: { key: string; label: string; desc: string }[] = [
  { key: 'classic', label: 'Classic', desc: 'Bold lines, bright palette' },
  { key: 'graphic_novel', label: 'Graphic Novel', desc: 'Moody, high contrast' },
  { key: 'manga', label: 'Manga', desc: 'Expressive, dynamic panels' },
  { key: 'surreal', label: 'Surreal', desc: 'Abstract, dreamlike forms' },
];

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
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.heading}>Settings</Text>

      <Text style={styles.sectionLabel}>Recording</Text>

      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <View style={[styles.iconWrap, { backgroundColor: 'rgba(139,124,247,0.12)' }]}>
              <View style={styles.micIcon}>
                <View style={styles.micBar} />
                <View style={styles.micBase} />
              </View>
            </View>
            <View style={styles.rowText}>
              <Text style={styles.label}>Wake Word</Text>
              <Text style={styles.sub}>"Hey DreamLog" -- on-device</Text>
            </View>
          </View>
          <Switch
            value={wakeWordEnabled}
            onValueChange={async v => { setWakeWordEnabled(v); await savePreferences({ wake_word_enabled: v }); }}
            trackColor={{ false: '#2a2a3e', true: 'rgba(139,124,247,0.5)' }}
            thumbColor={wakeWordEnabled ? '#8b7cf7' : '#555'}
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <View style={[styles.iconWrap, { backgroundColor: 'rgba(74,222,128,0.12)' }]}>
              <View style={styles.watchIcon}>
                <View style={styles.watchFace} />
              </View>
            </View>
            <View style={styles.rowText}>
              <Text style={styles.label}>Apple Watch</Text>
              <Text style={styles.sub}>REM-exit detection via HRV</Text>
            </View>
          </View>
          <Switch
            value={watchPaired}
            onValueChange={async v => { setWatchPaired(v); await savePreferences({ watch_paired: v }); }}
            trackColor={{ false: '#2a2a3e', true: 'rgba(74,222,128,0.5)' }}
            thumbColor={watchPaired ? '#4ade80' : '#555'}
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <View style={[styles.iconWrap, { backgroundColor: 'rgba(251,191,36,0.12)' }]}>
              <View style={styles.alarmIcon}>
                <View style={styles.alarmBell} />
                <View style={styles.alarmDot} />
              </View>
            </View>
            <View style={styles.rowText}>
              <Text style={styles.label}>Smart Alarm</Text>
              <Text style={styles.sub}>Wake window notification</Text>
            </View>
          </View>
          <Switch
            value={wakeWindowEnabled}
            onValueChange={async v => {
              setWakeWindowEnabled(v);
              if (v) {
                await DreamLogRecorder.scheduleWakeWindow(6, 0);
                await savePreferences({ wake_window_start: '6:00', wake_window_end: '7:30' });
              } else {
                await DreamLogRecorder.cancelWakeWindow();
                await savePreferences({ wake_window_start: null, wake_window_end: null });
              }
            }}
            trackColor={{ false: '#2a2a3e', true: 'rgba(251,191,36,0.5)' }}
            thumbColor={wakeWindowEnabled ? '#fbbf24' : '#555'}
          />
        </View>
      </View>

      <Text style={styles.sectionLabel}>Comic Style</Text>

      <View style={styles.styleGrid}>
        {STYLES.map(s => (
          <TouchableOpacity
            key={s.key}
            style={[styles.styleCard, defaultStyle === s.key && styles.styleCardActive]}
            onPress={() => { setDefaultStyle(s.key); savePreferences({ default_comic_style: s.key }); }}
            activeOpacity={0.7}
          >
            <View style={styles.styleHeader}>
              <Text style={[styles.styleLabel, defaultStyle === s.key && styles.styleLabelActive]}>
                {s.label}
              </Text>
              {defaultStyle === s.key && (
                <View style={styles.activeCheck}>
                  <Text style={styles.checkMark}>{'>'}</Text>
                </View>
              )}
            </View>
            <Text style={styles.styleDesc}>{s.desc}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionLabel}>Account</Text>

      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.7}>
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>

      <Text style={styles.version}>DreamLog v1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a14' },
  scrollContent: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 40 },
  heading: { color: '#fff', fontSize: 28, fontWeight: '700', letterSpacing: -0.5, marginBottom: 28 },
  sectionLabel: {
    color: '#777',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 4,
  },
  card: {
    backgroundColor: '#12122a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    marginBottom: 24,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 12 },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  micIcon: { alignItems: 'center' },
  micBar: { width: 6, height: 10, borderRadius: 3, backgroundColor: '#8b7cf7' },
  micBase: { width: 12, height: 2, borderRadius: 1, backgroundColor: '#8b7cf7', marginTop: 2 },
  watchIcon: { alignItems: 'center', justifyContent: 'center' },
  watchFace: { width: 12, height: 14, borderRadius: 3, borderWidth: 1.5, borderColor: '#4ade80' },
  alarmIcon: { alignItems: 'center' },
  alarmBell: { width: 12, height: 10, borderRadius: 6, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderWidth: 1.5, borderColor: '#fbbf24', borderBottomWidth: 0 },
  alarmDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#fbbf24', marginTop: 1 },
  rowText: { flex: 1 },
  label: { color: '#fff', fontWeight: '600', fontSize: 15 },
  sub: { color: '#555', fontSize: 13, marginTop: 2 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.04)', marginLeft: 64 },
  styleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  styleCard: {
    width: '48%' as unknown as number,
    backgroundColor: '#12122a',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.06)',
    flexGrow: 1,
    flexBasis: '46%' as unknown as number,
  },
  styleCardActive: { borderColor: '#8b7cf7', backgroundColor: 'rgba(139,124,247,0.08)' },
  styleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  styleLabel: { color: '#ddd', fontWeight: '600', fontSize: 14 },
  styleLabelActive: { color: '#8b7cf7' },
  activeCheck: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#8b7cf7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkMark: { color: '#fff', fontSize: 10, fontWeight: '700' },
  styleDesc: { color: '#555', fontSize: 12 },
  signOutBtn: {
    padding: 16,
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: 'rgba(255,68,68,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,68,68,0.2)',
  },
  signOutText: { color: '#ff4455', fontWeight: '600', fontSize: 15 },
  version: { color: '#333', fontSize: 12, textAlign: 'center', marginTop: 24 },
});
