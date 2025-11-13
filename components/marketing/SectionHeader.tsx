import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { marketingTokens } from './tokens';
import { useResponsive } from './useResponsive';

interface SectionHeaderProps {
  overline?: string;
  title: string;
  subtitle?: string;
  align?: 'left' | 'center';
}

/**
 * Section header with gradient overline, title, and subtitle
 * Uses gradient text for overline accent
 */

export function SectionHeader({ overline, title, subtitle, align = 'center' }: SectionHeaderProps) {
  const { isSM } = useResponsive();
  const alignmentStyle = align === 'center' ? styles.center : styles.left;
  
  return (
    <View style={[styles.container, alignmentStyle]}>
      {overline && (
        <MaskedView
          maskElement={
            <Text style={[styles.overline, alignmentStyle]}>
              {overline.toUpperCase()}
            </Text>
          }
        >
          <LinearGradient
            colors={marketingTokens.gradients.primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={[styles.overline, styles.overlineHidden, alignmentStyle]}>
              {overline.toUpperCase()}
            </Text>
          </LinearGradient>
        </MaskedView>
      )}
      
      <Text style={[
        styles.title,
        isSM ? styles.titleSM : styles.titleLG,
        alignmentStyle,
      ]}>
        {title}
      </Text>
      
      {subtitle && (
        <Text style={[styles.subtitle, alignmentStyle]}>
          {subtitle}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: marketingTokens.spacing['3xl'],
  },
  center: {
    alignItems: 'center',
    textAlign: 'center',
  },
  left: {
    alignItems: 'flex-start',
    textAlign: 'left',
  },
  overline: {
    ...marketingTokens.typography.overline,
    color: marketingTokens.colors.accent.cyan400,
    marginBottom: marketingTokens.spacing.md,
    fontWeight: '600',
  },
  overlineHidden: {
    opacity: 0,
  },
  title: {
    ...marketingTokens.typography.h2,
    color: marketingTokens.colors.fg.primary,
    marginBottom: marketingTokens.spacing.md,
  },
  titleSM: {
    fontSize: 28,
    lineHeight: 34,
  },
  titleLG: {
    fontSize: 36,
    lineHeight: 42,
  },
  subtitle: {
    ...marketingTokens.typography.body,
    color: marketingTokens.colors.fg.secondary,
    maxWidth: 640,
  },
});
