import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router } from 'expo-router';

export default function NotFound() {
  useEffect(() => {
    const t = setTimeout(() => router.replace('/'), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a14' }}>
      <ActivityIndicator />
    </View>
  );
}
