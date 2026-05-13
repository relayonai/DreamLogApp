import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '../lib/supabase';
import { flushUploadQueue } from '../lib/storage';
import type { Session } from '@supabase/supabase-js';

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
      if (initialUrl && !initialUrl.includes('dreamlog://record')) {
        await supabase.auth.exchangeCodeForSession(initialUrl);
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
        // Live Activity stop button: navigate to home where user can tap Stop
        if (session) router.push('/(tabs)/home');
      } else if (url.startsWith('dreamlog://')) {
        await supabase.auth.exchangeCodeForSession(url);
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
