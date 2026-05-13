import { useState } from 'react';
import { View, TextInput, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { supabase } from '../../lib/supabase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleMagicLink() {
    if (!email.trim()) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim() });
    setLoading(false);
    if (error) Alert.alert('Error', error.message);
    else Alert.alert('Check your email', 'We sent you a magic link.');
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>DreamLog</Text>
      <Text style={styles.subtitle}>Capture your dreams before they fade</Text>
      <TextInput
        style={styles.input}
        placeholder="your@email.com"
        placeholderTextColor="#555"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TouchableOpacity style={styles.button} onPress={handleMagicLink} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Sending…' : 'Send magic link'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 32, backgroundColor: '#0a0a14' },
  title: { fontSize: 36, fontWeight: '700', color: '#fff', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#888', textAlign: 'center', marginBottom: 40 },
  input: { backgroundColor: '#1a1a2e', color: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, fontSize: 16 },
  button: { backgroundColor: '#6c63ff', borderRadius: 12, padding: 16, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
