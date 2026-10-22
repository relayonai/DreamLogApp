import { Platform } from 'react-native';
import { supabase } from './supabase';

export async function signInWithGoogle() {
  if (Platform.OS === 'web') {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
    return;
  }

  const WebBrowser = require('expo-web-browser');
  const { makeRedirectUri } = require('expo-auth-session');

  const redirectUri = makeRedirectUri({ scheme: 'dreamlog', path: '' });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUri,
      skipBrowserRedirect: true,
    },
  });

  if (error) throw error;
  if (!data.url) throw new Error('No OAuth URL returned');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);

  if (result.type === 'success' && result.url) {
    const url = result.url;
    // Extract tokens from the callback URL
    const hashIdx = url.indexOf('#');
    const queryIdx = url.indexOf('?');
    const params = new URLSearchParams(
      hashIdx >= 0
        ? url.slice(hashIdx + 1)
        : queryIdx >= 0
          ? url.slice(queryIdx + 1)
          : '',
    );

    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (accessToken && refreshToken) {
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (sessionError) throw sessionError;
    }

    const code = params.get('code');
    if (code) {
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) throw exchangeError;
    }
  }
}
