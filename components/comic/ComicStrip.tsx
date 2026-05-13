import { useState } from 'react';
import { FlatList, View, Text, StyleSheet, Dimensions } from 'react-native';
import { ComicPanel } from './ComicPanel';
import type { Database } from '../../types/database';

type Scene = Database['public']['Tables']['scenes']['Row'];
const { width: SCREEN_W } = Dimensions.get('window');

export function ComicStrip({ scenes, comicStyle }: { scenes: Scene[]; comicStyle: string }) {
  const [current, setCurrent] = useState(0);

  return (
    <View style={styles.container}>
      <FlatList
        data={scenes}
        keyExtractor={s => s.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={e => {
          const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
          setCurrent(index);
        }}
        renderItem={({ item }) => (
          <View style={styles.page}>
            <ComicPanel scene={item} style={comicStyle} />
          </View>
        )}
      />
      <View style={styles.dots}>
        {scenes.map((_, i) => (
          <View key={i} style={[styles.dot, i === current && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  page: { width: SCREEN_W, paddingHorizontal: 16, paddingBottom: 80 },
  dots: { flexDirection: 'row', justifyContent: 'center', paddingBottom: 16, gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#444' },
  dotActive: { backgroundColor: '#6c63ff' },
});
