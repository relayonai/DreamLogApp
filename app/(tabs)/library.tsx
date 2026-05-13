import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { supabase } from '../../lib/supabase';
import { FeedView } from '../../components/library/FeedView';
import { GridView } from '../../components/library/GridView';
import { CalendarView } from '../../components/library/CalendarView';
import type { Database } from '../../types/database';

type LibraryView = 'calendar' | 'feed' | 'grid';
type DreamWithScenes = Database['public']['Tables']['dreams']['Row'] & {
  scenes?: Array<{ image_url: string | null }>;
};

export default function LibraryScreen() {
  const [view, setView] = useState<LibraryView>('feed');
  const [dreams, setDreams] = useState<DreamWithScenes[]>([]);

  useEffect(() => {
    supabase.from('dreams').select('*, scenes(image_url)').eq('status', 'ready')
      .order('recorded_at', { ascending: false })
      .then(({ data }) => setDreams(data ?? []));
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Library</Text>
      <View style={styles.toggle}>
        {(['calendar', 'feed', 'grid'] as LibraryView[]).map(v => (
          <TouchableOpacity key={v} style={[styles.tab, view === v && styles.tabActive]} onPress={() => setView(v)}>
            <Text style={[styles.tabText, view === v && styles.tabTextActive]}>{v.charAt(0).toUpperCase() + v.slice(1)}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {view === 'feed' && <FeedView dreams={dreams} />}
      {view === 'grid' && <GridView dreams={dreams} />}
      {view === 'calendar' && <CalendarView dreams={dreams} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a14', paddingTop: 56 },
  heading: { color: '#fff', fontSize: 28, fontWeight: '700', paddingHorizontal: 16, marginBottom: 16 },
  toggle: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 16, backgroundColor: '#1a1a2e', borderRadius: 12, padding: 4 },
  tab: { flex: 1, padding: 8, borderRadius: 10, alignItems: 'center' },
  tabActive: { backgroundColor: '#6c63ff' },
  tabText: { color: '#888', fontWeight: '600', fontSize: 14 },
  tabTextActive: { color: '#fff' },
});
