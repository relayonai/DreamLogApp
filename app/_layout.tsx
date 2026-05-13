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
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    const appStateSub = AppState.addEventListener('change', state => {
      if (state === 'active') flushUploadQueue();
    });

    // dreamlog://record deep link: from lock screen widget or wake notification
    const linkSub = Linking.addEventListener('url', ({ url }: { url: string }) => {
      if (url === 'dreamlog://record') router.push('/(tabs)/home');
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
  }, [session, loading, segments]);

  return <Slot />;
}
