import { FlatList, TouchableOpacity, Image, View, StyleSheet, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import type { Database } from '../../types/database';

type Dream = Database['public']['Tables']['dreams']['Row'] & { scenes?: Array<{ image_url: string | null }> };
const TILE = (Dimensions.get('window').width - 48) / 3;

export function GridView({ dreams }: { dreams: Dream[] }) {
  const router = useRouter();
  return (
    <FlatList
      data={dreams}
      numColumns={3}
      keyExtractor={d => d.id}
      contentContainerStyle={styles.grid}
      columnWrapperStyle={styles.row}
      renderItem={({ item }) => {
        const cover = item.scenes?.find(s => s.image_url)?.image_url;
        return (
          <TouchableOpacity style={[styles.tile, { width: TILE, height: TILE }]} onPress={() => router.push(`/dream/${item.id}`)}>
            {cover ? <Image source={{ uri: cover }} style={styles.img} /> : <View style={styles.placeholder} />}
          </TouchableOpacity>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  grid: { padding: 16 }, row: { gap: 8, marginBottom: 8 },
  tile: { borderRadius: 8, overflow: 'hidden', backgroundColor: '#1a1a2e' },
  img: { width: '100%', height: '100%' },
  placeholder: { flex: 1, backgroundColor: '#2a2a3e' },
});
