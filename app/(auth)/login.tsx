import { useState, useRef, useEffect } from 'react';
import { View, TextInput, Text, TouchableOpacity, StyleSheet, Alert, Animated, KeyboardAvoidingView, Platform } from 'react-native';
import { supabase } from '../../lib/supabase';
import { signInWithGoogle } from '../../lib/google-auth';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  async function handleEmailAuth() {
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password.trim(),
      });
      setLoading(false);
      if (error) Alert.alert('Error', error.message);
      else Alert.alert('Success', 'Account created! You are now signed in.');
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });
      setLoading(false);
      if (error) Alert.alert('Error', error.message);
    }
  }

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Google sign-in failed';
      Alert.alert('Error', message);
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Animated.View style={[styles.inner, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.brandSection}>
          <View style={styles.logoMark}>
            <View style={styles.logoMoon} />
          </View>
          <Text style={styles.title}>DreamLog</Text>
          <Text style={styles.subtitle}>Capture your dreams{'\n'}before they fade</Text>
        </View>

        <TouchableOpacity
          style={[styles.googleButton, googleLoading && styles.buttonDisabled]}
          onPress={handleGoogleSignIn}
          disabled={googleLoading}
          activeOpacity={0.8}
        >
          <View style={styles.googleLetterWrap}>
            <Text style={styles.googleLetter}>G</Text>
          </View>
          <Text style={styles.googleText}>
            {googleLoading ? 'Signing in...' : 'Continue with Google'}
          </Text>
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={[styles.inputWrap, emailFocused && styles.inputWrapFocused]}>
          <Text style={[styles.inputLabel, (emailFocused || email) ? styles.inputLabelActive : null]}>
            Email
          </Text>
          <TextInput
            style={styles.input}
            placeholder="your@email.com"
            placeholderTextColor="#444"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            onFocus={() => setEmailFocused(true)}
            onBlur={() => setEmailFocused(false)}
          />
        </View>

        <View style={[styles.inputWrap, passwordFocused && styles.inputWrapFocused]}>
          <Text style={[styles.inputLabel, (passwordFocused || password) ? styles.inputLabelActive : null]}>
            Password
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Enter password"
            placeholderTextColor="#444"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            onFocus={() => setPasswordFocused(true)}
            onBlur={() => setPasswordFocused(false)}
          />
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, loading && styles.buttonDisabled]}
          onPress={handleEmailAuth}
          disabled={loading}
          activeOpacity={0.8}
        >
          <Text style={styles.submitText}>
            {loading ? 'Please wait...' : isSignUp ? 'Create account' : 'Sign in'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.toggleButton}
          onPress={() => setIsSignUp(!isSignUp)}
          activeOpacity={0.7}
        >
          <Text style={styles.toggleText}>
            {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
            <Text style={styles.toggleAction}>{isSignUp ? 'Sign in' : 'Sign up'}</Text>
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a14' },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  brandSection: { alignItems: 'center', marginBottom: 40 },
  logoMark: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(139,124,247,0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(139,124,247,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoMoon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 3,
    borderColor: '#8b7cf7',
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
    transform: [{ rotate: '-45deg' }],
  },
  title: { fontSize: 32, fontWeight: '700', color: '#fff', letterSpacing: -0.5, marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#666', textAlign: 'center', lineHeight: 23 },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 15,
    marginBottom: 24,
    gap: 12,
  },
  googleLetterWrap: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: '#4285F4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  googleLetter: { fontSize: 14, fontWeight: '700', color: '#fff' },
  googleText: { color: '#222', fontWeight: '600', fontSize: 16 },
  buttonDisabled: { opacity: 0.6 },
  divider: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
  dividerText: { color: '#555', paddingHorizontal: 16, fontSize: 13 },
  inputWrap: {
    backgroundColor: '#12122a',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  inputWrapFocused: { borderColor: '#8b7cf7' },
  inputLabel: { fontSize: 11, fontWeight: '600', color: '#555', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  inputLabelActive: { color: '#8b7cf7' },
  input: { color: '#fff', fontSize: 16, padding: 0 },
  submitBtn: {
    backgroundColor: '#8b7cf7',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  submitText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  toggleButton: { marginTop: 20, alignItems: 'center' },
  toggleText: { color: '#555', fontSize: 14 },
  toggleAction: { color: '#8b7cf7', fontWeight: '600' },
});
