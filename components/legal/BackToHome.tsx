import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { DesignSystem } from '@/constants/DesignSystem';
import { Ionicons } from '@expo/vector-icons';

interface BackToHomeProps {
  variant?: 'header' | 'footer';
}

/**
 * Navigation component for legal pages
 * Provides "Back" and "Back to Home" actions
 */
export function BackToHome({ variant = 'header' }: BackToHomeProps) {
  const router = useRouter();

  if (variant === 'header') {
    return (
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color={DesignSystem.colors.text.primary} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  // Footer variant
  return (
    <View style={styles.footer}>
      <Pressable
        onPress={() => router.push('/')}
        style={({ pressed }) => [
          styles.homeLink,
          pressed && styles.pressed,
        ]}
        accessibilityRole="link"
        accessibilityLabel="Return to home page"
      >
        <Ionicons name="home-outline" size={18} color={DesignSystem.colors.primary} />
        <Text style={styles.homeText}>Back to Home</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: DesignSystem.spacing.xl,
    paddingTop: DesignSystem.spacing.sm,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DesignSystem.spacing.sm,
    paddingVertical: DesignSystem.spacing.sm,
    paddingHorizontal: DesignSystem.spacing.md,
    borderRadius: 8,
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
      transition: 'opacity 0.2s',
    }),
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
    color: DesignSystem.colors.text.primary,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: DesignSystem.spacing.xxl,
    paddingTop: DesignSystem.spacing.xl,
    borderTopWidth: 1,
    borderTopColor: DesignSystem.colors.surface,
  },
  homeLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DesignSystem.spacing.sm,
    paddingVertical: DesignSystem.spacing.sm,
    paddingHorizontal: DesignSystem.spacing.lg,
    borderRadius: 8,
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
      transition: 'opacity 0.2s',
    }),
  },
  homeText: {
    fontSize: 16,
    fontWeight: '600',
    color: DesignSystem.colors.primary,
    textDecorationLine: 'underline',
  },
  pressed: {
    opacity: 0.6,
  },
});
