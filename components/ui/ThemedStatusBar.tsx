import React from 'react';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '@/contexts/ThemeContext';

/**
 * ThemedStatusBar
 *
 * Centralized status bar styling to ensure consistent visibility across themes/platforms.
 * - Uses light content in dark mode, dark content in light mode
 * - On Android, sets a solid background color to avoid "hidden" or translucent look
 */
export default function ThemedStatusBar() {
  const { theme, isDark } = useTheme();

  // For Android, explicitly set a background color so icons have clear contrast.
  // translucent=false ensures the OS draws a solid status bar (not overlaying content).
  if (Platform.OS === 'android') {
    return (
      <StatusBar
        style={isDark ? 'light' : 'dark'}
        backgroundColor={theme.headerBackground}
        translucent={false}
        hidden={false}
        animated
      />
    );
  }

  // iOS / web: bar color is inferred from style; background behind bar comes from layout/header
  return <StatusBar style={isDark ? 'light' : 'dark'} hidden={false} animated />;
}