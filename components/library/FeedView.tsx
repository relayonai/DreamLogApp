import { FlatList, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import type { Database } from '../../types/database';

type Dream = Database['public']['Tables']['dreams']['Row'];

export function FeedView({ dreams }: { dreams: Dream[] }) {
  const router = useRouter();
  return (
    <FlatList
      data={dreams}
      keyExtractor={d => d.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <TouchableOpacity style={styles.item} onPress={() => router.push(`/dream/${item.id}`)}>
          <Text style={styles.date}>{new Date(item.recorded_at).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
          <Text style={styles.preview} numberOfLines={2}>{item.transcription_raw ?? 'Processing…'}</Text>
          <Text style={styles.style}>{item.comic_style ?? 'classic'}</Text>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16 },
  item: { backgroundColor: '#1a1a2e', borderRadius: 16, padding: 16, marginBottom: 12 },
  date: { color: '#6c63ff', fontSize: 13, fontWeight: '600', marginBottom: 4 },
  preview: { color: '#ccc', fontSize: 14, lineHeight: 20 },
  style: { color: '#666', fontSize: 12, marginTop: 8 },
});
