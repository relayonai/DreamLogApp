import { useEffect, useState } from 'react';
import { Alert, AppState } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '../lib/supabase';
import { flushUploadQueue } from '../lib/storage';
import { DreamLogRecorder } from '../native/DreamLogRecorder';
import type { Session } from '@supabase/supabase-js';

async function handleAuthCallback(url: string): Promise<{ ok: boolean; detail: string }> {
  // Strip the scheme so we can parse what's left as query+fragment.
  // Magic-link callbacks look like one of:
  //   dreamlog://?code=...                 (PKCE flow)
  //   dreamlog://#access_token=...&refresh_token=...  (implicit flow)
  //   dreamlog://?error=...                (error)
  //   dreamlog://#error=...                (error, fragment-style)
  // Safari sometimes URL-encodes the '#' (and may double-encode on redirect chains)
  // so we may see %23 or %2523 in place of #. Decode until it stabilizes.
  let decoded = url;
  for (let i = 0; i < 3; i++) {
    const next = decoded.replace(/%25/gi, '%').replace(/%23/gi, '#');
    if (next === decoded) break;
    decoded = next;
  }
  const queryIdx = decoded.indexOf('?');
  const fragIdx = decoded.indexOf('#');
  const queryStr = queryIdx >= 0 ? decoded.slice(queryIdx + 1, fragIdx >= 0 ? fragIdx : undefined) : '';
  const fragStr = fragIdx >= 0 ? decoded.slice(fragIdx + 1) : '';
  const query = new URLSearchParams(queryStr);
  const fragment = new URLSearchParams(fragStr);

  const error = query.get('error') || fragment.get('error');
  const errorDescription = query.get('error_description') || fragment.get('error_description');
  if (error) {
    return { ok: false, detail: `${error}: ${errorDescription ?? ''}` };
  }

  const code = query.get('code');
  if (code) {
    const { error: exchErr } = await supabase.auth.exchangeCodeForSession(code);
    return exchErr ? { ok: false, detail: `exchange: ${exchErr.message}` } : { ok: true, detail: 'pkce' };
  }

  const accessToken = fragment.get('access_token');
  const refreshToken = fragment.get('refresh_token');
  if (accessToken && refreshToken) {
    const { error: setErr } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    return setErr ? { ok: false, detail: `setSession: ${setErr.message}` } : { ok: true, detail: 'implicit' };
  }

  return { ok: false, detail: `no code/token in url: ${url.slice(0, 120)}` };
}

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setLoading(false);

      // Handle cold-launch magic-link callback
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl && initialUrl.startsWith('dreamlog://') && !initialUrl.startsWith('dreamlog://record')) {
        const res = await handleAuthCallback(initialUrl);
        if (!res.ok) Alert.alert('Auth failed (cold launch)', res.detail);
      }
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    const appStateSub = AppState.addEventListener('change', state => {
      if (state === 'active') flushUploadQueue();
    });

    // dreamlog://record deep link: from lock screen widget or wake notification
    // Also handle magic-link auth callbacks (warm launch)
    const linkSub = Linking.addEventListener('url', async ({ url }: { url: string }) => {
      if (url === 'dreamlog://record') {
        if (session) router.push('/(tabs)/home');
      } else if (url === 'dreamlog://stop') {
        // Live Activity stop button: stop the native recording and navigate home
        try { await DreamLogRecorder.stopRecording(); } catch {}
        if (session) router.push('/(tabs)/home');
      } else if (url.startsWith('dreamlog://')) {
        const res = await handleAuthCallback(url);
        if (!res.ok) Alert.alert('Auth failed', res.detail);
      }
    });

    return () => {
      subscription.unsubscribe();
      appStateSub.remove();
      linkSub.remove();
    };
  }, []);

  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === '(auth)';
    if (!session && !inAuth) router.replace('/(auth)/login');
    if (session && inAuth) router.replace('/(tabs)/home');
  }, [session, loading, segments, router]);

  return <Slot />;
}
