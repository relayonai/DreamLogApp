import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Share, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { ComicStrip } from '../../components/comic/ComicStrip';
import { COMIC_STYLE_LABELS } from '../../constants/comicStyles';
import type { Database } from '../../types/database';

type Dream = Database['public']['Tables']['dreams']['Row'];
type Scene = Database['public']['Tables']['scenes']['Row'];

export default function DreamScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [dream, setDream] = useState<Dream | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [manualText, setManualText] = useState('');
  const router = useRouter();

  useEffect(() => {
    async function load() {
      const { data: d } = await supabase.from('dreams').select('*').eq('id', id).single();
      const { data: s } = await supabase.from('scenes').select('*').eq('dream_id', id).order('order_index');
      setDream(d); setScenes(s ?? []); setLoading(false);
    }
    load();
  }, [id]);

  async function handleExport() {
    if (!dream) return;
    if (dream.export_url) {
      await Share.share({ url: dream.export_url, message: 'My dream, illustrated by DreamLog' });
      return;
    }
    setExporting(true);
    const { data, error } = await supabase.functions.invoke('generate-export', { body: { dream_id: dream.id } });
    setExporting(false);
    if (error || !data?.export_url) { Alert.alert('Export failed', 'Could not generate your comic. Please try again.'); return; }
    setDream(prev => prev ? { ...prev, export_url: data.export_url } : prev);
    await Share.share({ url: data.export_url, message: 'My dream, illustrated by DreamLog' });
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color="#6c63ff" /></View>;
  if (!dream) return <View style={styles.center}><Text style={{ color: '#fff' }}>Dream not found</Text></View>;

  if (dream.status === 'failed' && !dream.transcription_raw) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.back}>←</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.failedState}>
          <Text style={styles.failedTitle}>We couldn't hear this one</Text>
          <Text style={styles.failedSub}>Type your dream from memory and we'll illustrate it.</Text>
          <TextInput
            style={styles.manualInput}
            placeholder="Describe your dream…"
            placeholderTextColor="#555"
            multiline
            value={manualText}
            onChangeText={setManualText}
          />
          <TouchableOpacity style={styles.manualBtn} onPress={async () => {
            if (!manualText.trim()) return;
            await supabase.from('dreams').update({
              transcription_raw: manualText,
              transcription_enhanced: manualText,
              status: 'processing',
            }).eq('id', id);
            await supabase.functions.invoke('analyse-gaps', { body: { dream_id: id } });
            router.replace(`/dream/${id}`);
          }}>
            <Text style={styles.manualBtnText}>Illustrate this dream →</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>←</Text>
        </TouchableOpacity>
        <Text style={styles.styleLabel}>{COMIC_STYLE_LABELS[dream.comic_style ?? 'classic']}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => router.push(`/dream/shape/${id}`)}>
            <Text style={styles.shape}>Shape ✦</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleExport} disabled={exporting} style={styles.exportBtn}>
            {exporting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.exportText}>↑ Share</Text>}
          </TouchableOpacity>
        </View>
      </View>

      {dream.low_confidence && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>⚠️ This one was hard to hear — you may want to review the text</Text>
        </View>
      )}

      <ComicStrip scenes={scenes} comicStyle={dream.comic_style ?? 'classic'} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a14' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a14' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 56 },
  back: { color: '#6c63ff', fontSize: 24 },
  styleLabel: { color: '#888', fontSize: 14 },
  headerActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  shape: { color: '#6c63ff', fontSize: 15, fontWeight: '600' },
  exportBtn: { backgroundColor: '#6c63ff', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, justifyContent: 'center' },
  exportText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  banner: { backgroundColor: '#2a1a00', padding: 12, marginHorizontal: 16, borderRadius: 10, marginBottom: 8 },
  bannerText: { color: '#ffaa44', fontSize: 13 },
  failedState: { flex: 1, padding: 24 },
  failedTitle: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 8 },
  failedSub: { color: '#888', fontSize: 14, lineHeight: 20, marginBottom: 20 },
  manualInput: { backgroundColor: '#1a1a2e', color: '#fff', borderRadius: 12, padding: 16, fontSize: 15, minHeight: 160, textAlignVertical: 'top', marginBottom: 16 },
  manualBtn: { backgroundColor: '#6c63ff', borderRadius: 12, padding: 16, alignItems: 'center' },
  manualBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
