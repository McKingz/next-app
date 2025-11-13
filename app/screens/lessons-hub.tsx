/**
 * Lessons Hub Screen
 * 
 * Main screen for the comprehensive lessons hub showing categories,
 * featured content, search, and navigation to detailed lesson views.
 */

import React, { useRef } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { LessonsHub } from '@/components/lessons/LessonsHub';

export default function LessonsHubScreen() {
  const { theme } = useTheme();
  const lessonsHubRef = useRef<any>(null);

  const handleRefresh = () => {
    if (lessonsHubRef.current && lessonsHubRef.current.handleRefresh) {
      lessonsHubRef.current.handleRefresh();
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/dashboard');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen 
        options={{ 
          headerShown: true,
          title: 'Lessons Hub',
          headerStyle: {
            backgroundColor: theme.background,
          },
          headerTintColor: theme.text,
          headerTitleStyle: {
            fontWeight: '600',
          },
          headerLeft: () => (
            <TouchableOpacity
              onPress={handleBack}
              style={{ marginLeft: 8 }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="arrow-back" size={24} color={theme.text} />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity
              onPress={handleRefresh}
              style={{ marginRight: 8 }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="refresh" size={24} color={theme.text} />
            </TouchableOpacity>
          ),
        }} 
      />
      
      <LessonsHub ref={lessonsHubRef} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});