import { View, Text, Image, StyleSheet, Dimensions } from 'react-native';
import { PANEL_CONFIG } from '../../constants/comicStyles';
import type { Database } from '../../types/database';

type Scene = Database['public']['Tables']['scenes']['Row'];
const PANEL_WIDTH = Dimensions.get('window').width - 32;

export function ComicPanel({ scene, style }: { scene: Scene; style: string }) {
  const cfg = PANEL_CONFIG[style] ?? PANEL_CONFIG.classic;
  return (
    <View style={[styles.panel, { borderWidth: cfg.borderWidth, borderColor: cfg.borderColor, backgroundColor: cfg.backgroundColor }]}>
      {scene.image_url
        ? <Image source={{ uri: scene.image_url }} style={styles.image} resizeMode="cover" />
        : <View style={[styles.placeholder, { backgroundColor: cfg.backgroundColor }]}>
            <Text style={{ color: cfg.captionTextColor, opacity: 0.4, fontSize: 32 }}>✦</Text>
          </View>
      }
      <View style={[styles.caption, { backgroundColor: cfg.captionBg }]}>
        {scene.gap_filled && <Text style={[styles.aiTag, { color: cfg.captionTextColor }]}>✦ AI enhanced</Text>}
        <Text style={[styles.captionText, { color: cfg.captionTextColor }]}>{scene.text_content}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { width: PANEL_WIDTH, borderRadius: 4, overflow: 'hidden', marginBottom: 16 },
  image: { width: '100%', height: PANEL_WIDTH },
  placeholder: { width: '100%', height: PANEL_WIDTH * 0.6, justifyContent: 'center', alignItems: 'center' },
  caption: { padding: 12 },
  aiTag: { fontSize: 11, opacity: 0.7, marginBottom: 4, fontStyle: 'italic' },
  captionText: { fontSize: 14, lineHeight: 20 },
});
