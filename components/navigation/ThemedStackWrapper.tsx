/**
 * Themed Stack Wrapper Component
 * 
 * Wraps the Stack navigator with theme-aware styling
 */

import React, { useEffect, useState } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '@/contexts/ThemeContext';
import { View, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DashCommandPalette } from '@/components/ai/DashCommandPalette';

export function ThemedStackWrapper() {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [showPalette, setShowPalette] = useState(false);

  // Global keyboard shortcut Cmd/Ctrl+K for web
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    // Verify DOM APIs exist before using them (React Native compatibility)
    if (
      typeof window === 'undefined' ||
      typeof window.addEventListener !== 'function' ||
      typeof window.removeEventListener !== 'function'
    ) {
      return undefined;
    }

    const seqRef = { lastKey: '', lastTime: 0 } as { lastKey: string; lastTime: number };

    const handler = (e: any) => {
      const key = e.key;
      const lower = key?.toLowerCase?.() || '';

      // ESC closes palette
      if (key === 'Escape') {
        if (showPalette) {
          e.preventDefault();
          setShowPalette(false);
          return;
        }
      }

      // Cmd/Ctrl+K opens palette
      const isCmdK = (e.metaKey || e.ctrlKey) && (lower === 'k');
      if (isCmdK) {
        // Ignore if typing in input/textarea/contentEditable
        const t = e.target as HTMLElement | null;
        const tag = (t && t.tagName) ? t.tagName.toLowerCase() : '';
        const editing = tag === 'input' || tag === 'textarea' || (t && (t as any).isContentEditable);
        if (editing) return;
        e.preventDefault();
        setShowPalette(true);
        return;
      }

      // Two-key sequences (e.g., g l)
      const now = Date.now();
      const within = now - seqRef.lastTime < 800; // 800ms window
      if (seqRef.lastKey === 'g' && within) {
        // Map sequences
        const map: Record<string, string> = {
          'l': '/screens/lessons-hub',
          's': '/screens/lessons-search',
          'c': '/screens/lessons-categories',
          'a': '/screens/dash-assistant',
          'd': '/screens/teacher-dashboard',
          'p': '/screens/principal-dashboard',
          'f': '/screens/financial-dashboard',
          'h': '/screens/dash-conversations-history',
        };
        const route = map[lower];
        if (route) {
          e.preventDefault();
          // Reset sequence and navigate
          seqRef.lastKey = '';
          seqRef.lastTime = 0;
          try { router.push(route as any); } catch { /* Intentional: non-fatal */ }
          return;
        }
      }

      // Update sequence
      seqRef.lastKey = lower;
      seqRef.lastTime = now;
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showPalette]);

  return (
    <>
      {/* Use translucent status bar and render our own underlay to control background */}
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View
        style={{
          pointerEvents: 'none' as any,
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: Platform.OS === 'android' ? (0 as number) : insets.top,
          backgroundColor: theme.headerBackground,
          zIndex: 1,
        }}
      />
      <Stack
        screenOptions={{
          headerShown: false,
          headerStyle: { backgroundColor: theme.headerBackground },
          headerTitleStyle: { color: theme.headerText },
          headerTintColor: theme.headerTint,
          contentStyle: { backgroundColor: theme.background, paddingTop: Platform.OS === 'android' ? 0 : insets.top },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
      </Stack>
      {/* Global Command Palette */}
      <DashCommandPalette visible={showPalette} onClose={() => setShowPalette(false)} />
    </>
  );
}
