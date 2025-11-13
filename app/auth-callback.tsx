import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View, StyleSheet, Platform } from 'react-native';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { assertSupabase } from '@/lib/supabase';

export default function AuthCallback() {
  const handled = useRef(false);
  const [message, setMessage] = useState('Finalizing sign-in…');

  async function handleCallback(urlStr?: string | null) {
    if (handled.current) return;
    handled.current = true;

    try {
      setMessage('Processing authentication...');
      
      if (!urlStr) {
        // Try to get URL from window location on web
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          urlStr = window.location.href;
        } else {
          throw new Error('No URL provided');
        }
      }

      console.log('[AuthCallback] Processing URL:', urlStr);

      // Case 1: OAuth callback (hash fragment with tokens)
      if (urlStr.includes('#access_token')) {
        setMessage('Validating OAuth session...');
        
        const hash = urlStr.slice(urlStr.indexOf('#') + 1);
        const params = new URLSearchParams(hash);
        
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');

        if (access_token) {
          const supabase = await assertSupabase();
          const { error } = await supabase.auth.setSession({
            access_token,
            refresh_token: refresh_token || '',
          });

          if (error) throw error;

          setMessage('Sign-in successful! Redirecting...');
          console.log('[AuthCallback] OAuth sign-in successful');
          
          // Small delay for better UX
          setTimeout(() => {
            router.replace('/profiles-gate');
          }, 500);
          
          return;
        }
      }

      // Case 2: Magic link / Email verification (query params)
      if (urlStr.includes('token_hash=')) {
        setMessage('Verifying email...');
        
        const url = new URL(urlStr);
        const token_hash = url.searchParams.get('token_hash');
        const type = url.searchParams.get('type') as any || 'magiclink';

        if (token_hash) {
          const supabase = await assertSupabase();
          const { error } = await supabase.auth.verifyOtp({
            token_hash,
            type,
          });

          if (error) throw error;

          setMessage('Verification successful! Redirecting...');
          console.log('[AuthCallback] Email verification successful');
          
          setTimeout(() => {
            if (type === 'recovery') {
              router.replace('/(auth)/reset-password');
            } else if (url.searchParams.get('verified') === 'true') {
              router.replace('/(auth)/sign-in?verified=true');
            } else {
              router.replace('/profiles-gate');
            }
          }, 500);
          
          return;
        }
      }

      // Case 3: Error in callback
      if (urlStr.includes('error=')) {
        const url = new URL(urlStr);
        const error = url.searchParams.get('error');
        const error_description = url.searchParams.get('error_description');
        
        console.error('[AuthCallback] OAuth error:', error, error_description);
        throw new Error(error_description || error || 'Authentication failed');
      }

      // No recognized callback pattern
      console.warn('[AuthCallback] Unrecognized callback pattern');
      setMessage('Could not process authentication. Redirecting to sign-in...');
      setTimeout(() => {
        router.replace('/(auth)/sign-in');
      }, 2000);

    } catch (e: any) {
      console.error('[AuthCallback] Error:', e);
      setMessage(e?.message || 'Authentication failed. Please try again.');
      
      // Redirect to sign-in after error
      setTimeout(() => {
        router.replace('/(auth)/sign-in');
      }, 3000);
    }
  }

  useEffect(() => {
    // Get initial URL
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleCallback(url);
      } else if (Platform.OS === 'web' && typeof window !== 'undefined') {
        // On web, check window.location
        handleCallback(window.location.href);
      }
    });

    // Listen for deep link events
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleCallback(url);
    });

    return () => subscription.remove();
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#00f5ff" />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0b1220',
    gap: 16,
    padding: 24,
  },
  text: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 16,
  },
});

