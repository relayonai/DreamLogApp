import { FlatList, TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import type { Database } from '../../types/database';

type Dream = Database['public']['Tables']['dreams']['Row'];

function groupByDate(dreams: Dream[]): Record<string, Dream[]> {
  return dreams.reduce<Record<string, Dream[]>>((acc, d) => {
    const key = new Date(d.recorded_at).toDateString();
    acc[key] = [...(acc[key] ?? []), d];
    return acc;
  }, {});
}

export function CalendarView({ dreams }: { dreams: Dream[] }) {
  const router = useRouter();
  const grouped = groupByDate(dreams);
  const dates = Object.keys(grouped).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  return (
    <FlatList
      data={dates}
      keyExtractor={d => d}
      contentContainerStyle={styles.list}
      renderItem={({ item: date }) => (
        <View style={styles.block}>
          <Text style={styles.dateLabel}>{date}</Text>
          {grouped[date].map(dream => (
            <TouchableOpacity key={dream.id} style={styles.row} onPress={() => router.push(`/dream/${dream.id}`)}>
              <Text style={styles.preview} numberOfLines={1}>{dream.transcription_raw?.slice(0, 60) ?? 'Processing…'}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16 },
  block: { marginBottom: 24 },
  dateLabel: { color: '#6c63ff', fontSize: 13, fontWeight: '700', marginBottom: 8 },
  row: { backgroundColor: '#1a1a2e', borderRadius: 10, padding: 12, marginBottom: 6 },
  preview: { color: '#ccc', fontSize: 14 },
});
