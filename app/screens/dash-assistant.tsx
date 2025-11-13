/**
 * Dash AI Assistant Screen
 * 
 * Screen wrapper for the Dash AI Assistant component that integrates
 * with the app's navigation and provides a full-screen chat experience.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import DashAssistant from '@/components/ai/DashAssistant';
import { useAuth } from '@/contexts/AuthContext';
import { normalizeRole } from '@/lib/rbac';

export default function DashAssistantScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const params = useLocalSearchParams<{ initialMessage?: string }>();
  const initialMessage = typeof params?.initialMessage === 'string' ? params.initialMessage : undefined;

  const getFallbackPath = () => {
    const role = normalizeRole(String(profile?.role || ''));
    switch (role) {
      case 'teacher':
        return '/screens/teacher-dashboard';
      case 'principal':
      case 'principal_admin':
        return '/screens/principal-dashboard';
      case 'parent':
        return '/screens/parent-dashboard';
      case 'super_admin':
        return '/screens/super-admin-dashboard';
      default:
        return '/'; // safe landing
    }
  };

  const handleClose = () => {
    // Navigate back to the previous screen
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(getFallbackPath());
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen 
        options={{ 
          headerShown: false,
          presentation: 'fullScreenModal',
          animation: 'slide_from_bottom',
        }} 
      />
      
      <DashAssistant 
        onClose={handleClose}
        initialMessage={initialMessage}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});