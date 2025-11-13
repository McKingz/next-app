/**
 * Themed Stack Navigator Component
 * 
 * A Stack navigator that automatically applies theme colors
 */

import React from 'react';
import { Stack } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';

interface ThemedStackProps {
  children: React.ReactNode;
}

export function ThemedStack({ children }: ThemedStackProps) {
  const { theme, isDark } = useTheme();

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          headerStyle: { backgroundColor: theme.headerBackground },
          headerTitleStyle: { color: theme.headerText },
          headerTintColor: theme.headerTint,
          contentStyle: { backgroundColor: theme.background },
          animation: 'slide_from_right',
          statusBarStyle: isDark ? 'light' : 'dark',
          statusBarTranslucent: true,
        }}
      >
        {children}
      </Stack>
    </>
  );
}

// Export Stack.Screen for convenience
export const ThemedScreen = Stack.Screen;
