import React, { PropsWithChildren } from 'react';
import { View, StyleSheet, ViewStyle, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { marketingTokens } from './tokens';

interface GlassCardProps {
  style?: ViewStyle;
  intensity?: 'soft' | 'medium' | 'strong';
}

/**
 * Glassmorphism card component
 * Uses blur + translucent background for modern depth effect
 */
export function GlassCard({ children, style, intensity = 'medium' }: PropsWithChildren<GlassCardProps>) {
  const isAndroid = Platform.OS === 'android';

  // Adjust blur intensity based on prop and platform
  const blurIntensity = isAndroid
    ? (intensity === 'soft' ? 10 : intensity === 'strong' ? 30 : 20)
    : (intensity === 'soft' ? 20 : intensity === 'strong' ? 60 : 40);

  return (
    <View style={[styles.container, style]}>
      <BlurView
        intensity={blurIntensity}
        tint="dark"
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: marketingTokens.radii.md,
    overflow: 'hidden', // Clip content to border radius
    backgroundColor: marketingTokens.colors.overlay.soft,
    borderWidth: 1,
    borderColor: marketingTokens.colors.stroke.soft,
    borderTopWidth: 1,
    borderTopColor: marketingTokens.colors.stroke.highlight,
    ...marketingTokens.shadow('sm'),
  },
  content: {
    padding: marketingTokens.spacing.lg,
  },
});
