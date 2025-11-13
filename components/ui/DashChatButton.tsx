/**
 * Dash Chat Floating Action Button
 * 
 * Simple FAB that appears on all dashboards to access Dash Assistant chat.
 * Replaces the archived voice orb FAB.
 */

import React from 'react';
import { TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import * as Haptics from 'expo-haptics';

interface DashChatButtonProps {
  bottom?: number;
  right?: number;
}

export const DashChatButton: React.FC<DashChatButtonProps> = ({ 
  bottom = 24, 
  right = 24 
}) => {
  const { theme } = useTheme();

  const handlePress = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      // Haptics not available
    }
    router.push('/screens/dash-assistant');
  };

  return (
    <TouchableOpacity
      style={[
        styles.fab,
        {
          bottom,
          right,
          backgroundColor: theme.primary || '#6366F1',
          shadowColor: theme.primary || '#6366F1',
        },
      ]}
      onPress={handlePress}
      activeOpacity={0.8}
      accessibilityLabel="Chat with Dash"
      accessibilityHint="Open Dash AI Assistant chat"
    >
      <Ionicons name="chatbubbles" size={28} color="#FFFFFF" />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 1000,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
});
