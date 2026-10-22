import { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, RefreshControl, ScrollView } from 'react-native';
import { supabase } from '../../lib/supabase';
import { FeedView } from '../../components/library/FeedView';
import { GridView } from '../../components/library/GridView';
import { CalendarView } from '../../components/library/CalendarView';
import type { Database } from '../../types/database';

type LibraryView = 'feed' | 'grid' | 'calendar';
type DreamWithScenes = Database['public']['Tables']['dreams']['Row'] & {
  scenes?: Array<{ image_url: string | null }>;
};

export default function LibraryScreen() {
  const [view, setView] = useState<LibraryView>('feed');
  const [dreams, setDreams] = useState<DreamWithScenes[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadDreams = useCallback(async () => {
    const { data } = await supabase.from('dreams').select('*, scenes(image_url)').eq('status', 'ready')
      .order('recorded_at', { ascending: false });
    setDreams(data ?? []);
  }, []);

  useEffect(() => { loadDreams(); }, [loadDreams]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadDreams();
    setRefreshing(false);
  }, [loadDreams]);

  const views: { key: LibraryView; label: string }[] = [
    { key: 'feed', label: 'Feed' },
    { key: 'grid', label: 'Grid' },
    { key: 'calendar', label: 'Calendar' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.heading}>Library</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{dreams.length} dreams</Text>
        </View>
      </View>

      <View style={styles.toggle}>
        {views.map(v => (
          <TouchableOpacity
            key={v.key}
            style={[styles.tab, view === v.key && styles.tabActive]}
            onPress={() => setView(v.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, view === v.key && styles.tabTextActive]}>
              {v.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {dreams.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8b7cf7" />}
        >
          <View style={styles.emptyCircle}>
            <View style={styles.emptyInner}>
              <View style={styles.emptyLine} />
              <View style={[styles.emptyLine, { width: 16 }]} />
            </View>
          </View>
          <Text style={styles.emptyTitle}>Your library is empty</Text>
          <Text style={styles.emptyText}>
            Recorded dreams will appear here{'\n'}once they've been processed.
          </Text>
        </ScrollView>
      ) : (
        <View style={styles.content}>
          {view === 'feed' && <FeedView dreams={dreams} />}
          {view === 'grid' && <GridView dreams={dreams} />}
          {view === 'calendar' && <CalendarView dreams={dreams} />}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a14', paddingTop: 60 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 20 },
  heading: { color: '#fff', fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  countBadge: { backgroundColor: 'rgba(139,124,247,0.12)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10 },
  countText: { color: '#8b7cf7', fontSize: 13, fontWeight: '500' },
  toggle: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: '#12122a',
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 11, alignItems: 'center' },
  tabActive: { backgroundColor: '#8b7cf7' },
  tabText: { color: '#555', fontWeight: '600', fontSize: 14 },
  tabTextActive: { color: '#fff' },
  content: { flex: 1, paddingHorizontal: 20 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40, paddingBottom: 100 },
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
  emptyInner: { gap: 5, alignItems: 'center' },
  emptyLine: { width: 24, height: 3, backgroundColor: 'rgba(139,124,247,0.3)', borderRadius: 2 },
  emptyTitle: { color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 8 },
  emptyText: { color: '#555', fontSize: 14, lineHeight: 21, textAlign: 'center' },
});
