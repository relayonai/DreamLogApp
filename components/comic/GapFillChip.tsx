import { TouchableOpacity, Text, StyleSheet } from 'react-native';

const TONE_COLORS: Record<string, string> = {
  Action: '#ff6b35', Comedy: '#ffd700', Love: '#ff69b4',
  Drama: '#4169e1', Horror: '#8b0000', Warmth: '#ff8c00',
};

export function GapFillChip({ tone, selected, onPress }: { tone: string; selected: boolean; onPress: () => void }) {
  const color = TONE_COLORS[tone] ?? '#6c63ff';
  return (
    <TouchableOpacity onPress={onPress}
      style={[styles.chip, { borderColor: color, backgroundColor: selected ? color : 'transparent' }]}>
      <Text style={[styles.label, { color: selected ? '#fff' : color }]}>{tone}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: { borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, marginBottom: 8 },
  label: { fontSize: 14, fontWeight: '600' },
});
