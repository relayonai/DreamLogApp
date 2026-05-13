import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { GapFillChip } from '../../../components/comic/GapFillChip';
import { useGapFill, TONES } from '../../../hooks/useGapFill';
import type { Database } from '../../../types/database';

type Scene = Database['public']['Tables']['scenes']['Row'];

function GapScene({ scene }: { scene: Scene }) {
  const { suggestions, accepted, previewTone, acceptSuggestion, restoreOriginal } = useGapFill(scene.id, scene.text_content);

  return (
    <View style={styles.sceneCard}>
      <Text style={styles.originalText}>{scene.text_content}</Text>
      <View style={styles.chips}>
        {TONES.map(tone => (
          <GapFillChip key={tone} tone={tone} selected={accepted === tone} onPress={() => previewTone(tone)} />
        ))}
      </View>
      {TONES.map(tone => {
        const s = suggestions[tone];
        if (!s) return null;
        return (
          <View key={tone} style={styles.suggestion}>
            {s.loading
              ? <ActivityIndicator color="#6c63ff" />
              : <>
                  <Text style={styles.suggestionText}>{s.text}</Text>
                  <View style={styles.actions}>
                    <TouchableOpacity onPress={() => acceptSuggestion(tone)} style={styles.acceptBtn}>
                      <Text style={styles.acceptText}>Accept</Text>
                    </TouchableOpacity>
                    {accepted && (
                      <TouchableOpacity onPress={restoreOriginal}>
                        <Text style={styles.restoreText}>Restore original</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </>
            }
          </View>
        );
      })}
    </View>
  );
}

const COMIC_STYLES = ['classic', 'graphic_novel', 'manga', 'surreal'];

export default function ShapeYourDreamScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [gapScenes, setGapScenes] = useState<Scene[]>([]);
  const [comicStyle, setComicStyle] = useState('classic');
  const router = useRouter();

  useEffect(() => {
    supabase.from('scenes').select('*').eq('dream_id', id).eq('gap_filled', true).order('order_index')
      .then(({ data }) => setGapScenes(data ?? []));
    supabase.from('dreams').select('comic_style').eq('id', id).single()
      .then(({ data }) => { if (data?.comic_style) setComicStyle(data.comic_style); });
  }, [id]);

  async function handleStyleChange(s: string) {
    setComicStyle(s);
    await supabase.from('dreams').update({ comic_style: s as 'classic' | 'graphic_novel' | 'manga' | 'surreal' }).eq('id', id);
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Done</Text>
        </TouchableOpacity>
        <Text style={styles.heading}>Shape Your Dream</Text>
      </View>

      <Text style={styles.sectionLabel}>Comic Style</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.styleRow}>
        {COMIC_STYLES.map(s => (
          <TouchableOpacity key={s} onPress={() => handleStyleChange(s)}
            style={[styles.styleChip, comicStyle === s && styles.styleChipActive]}>
            <Text style={styles.styleChipText}>{s.replace('_', ' ')}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {gapScenes.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>Gap-Fill Suggestions</Text>
          <Text style={styles.sectionSub}>Tap a tone to preview a fill. Original text is always restorable.</Text>
          {gapScenes.map(scene => <GapScene key={scene.id} scene={scene} />)}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a14' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16, paddingTop: 56 },
  back: { color: '#6c63ff', fontSize: 16 },
  heading: { color: '#fff', fontSize: 20, fontWeight: '700' },
  sectionLabel: { color: '#fff', fontSize: 18, fontWeight: '700', paddingHorizontal: 16, marginTop: 24, marginBottom: 8 },
  sectionSub: { color: '#888', fontSize: 14, paddingHorizontal: 16, marginBottom: 16, lineHeight: 20 },
  styleRow: { paddingLeft: 16, marginBottom: 8 },
  styleChip: { borderWidth: 1, borderColor: '#444', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginRight: 8 },
  styleChipActive: { borderColor: '#6c63ff', backgroundColor: 'rgba(108,99,255,0.2)' },
  styleChipText: { color: '#fff', fontSize: 14 },
  sceneCard: { margin: 16, backgroundColor: '#1a1a2e', borderRadius: 16, padding: 16 },
  originalText: { color: '#ccc', fontSize: 14, lineHeight: 22, marginBottom: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  suggestion: { marginTop: 12, backgroundColor: '#0a0a22', borderRadius: 12, padding: 12 },
  suggestionText: { color: '#e0e0ff', fontSize: 14, lineHeight: 22 },
  actions: { flexDirection: 'row', gap: 16, marginTop: 12 },
  acceptBtn: { backgroundColor: '#6c63ff', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  acceptText: { color: '#fff', fontWeight: '600' },
  restoreText: { color: '#888', fontSize: 14, alignSelf: 'center' },
});
