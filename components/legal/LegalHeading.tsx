import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { DesignSystem } from '@/constants/DesignSystem';

interface LegalHeadingProps {
  level: 1 | 2 | 3;
  children: React.ReactNode;
  style?: any;
}

/**
 * Heading component for legal documents
 * Supports H1, H2, H3 levels with consistent typography
 */
export function LegalHeading({ level, children, style }: LegalHeadingProps) {
  const headingStyle = [
    styles.base,
    level === 1 && styles.h1,
    level === 2 && styles.h2,
    level === 3 && styles.h3,
    style,
  ];

  return (
    <Text style={headingStyle} accessibilityRole="header">
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    color: DesignSystem.colors.text.primary,
    fontWeight: '700',
    marginBottom: DesignSystem.spacing.md,
  },
  h1: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '800',
    marginBottom: DesignSystem.spacing.lg,
    marginTop: DesignSystem.spacing.md,
  },
  h2: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
    marginTop: DesignSystem.spacing.xl,
    marginBottom: DesignSystem.spacing.md,
  },
  h3: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '600',
    marginTop: DesignSystem.spacing.lg,
    marginBottom: DesignSystem.spacing.sm,
  },
});
