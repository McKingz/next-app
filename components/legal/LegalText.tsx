import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { DesignSystem } from '@/constants/DesignSystem';

interface LegalTextProps {
  children: React.ReactNode;
  variant?: 'paragraph' | 'list-item' | 'bold' | 'link';
  style?: any;
}

/**
 * Text component for legal documents
 * Supports paragraphs, list items, bold text, and link-styled text
 */
export function LegalText({ children, variant = 'paragraph', style }: LegalTextProps) {
  const textStyle = [
    styles.base,
    variant === 'paragraph' && styles.paragraph,
    variant === 'list-item' && styles.listItem,
    variant === 'bold' && styles.bold,
    variant === 'link' && styles.link,
    style,
  ];

  if (variant === 'list-item') {
    return (
      <View style={styles.listItemContainer}>
        <Text style={styles.bullet}>•</Text>
        <Text style={textStyle}>{children}</Text>
      </View>
    );
  }

  return <Text style={textStyle}>{children}</Text>;
}

const styles = StyleSheet.create({
  base: {
    color: DesignSystem.colors.text.secondary,
    fontSize: 15,
    lineHeight: 24,
  },
  paragraph: {
    marginBottom: DesignSystem.spacing.md,
  },
  listItem: {
    flex: 1,
  },
  listItemContainer: {
    flexDirection: 'row',
    marginBottom: DesignSystem.spacing.sm,
  },
  bullet: {
    color: DesignSystem.colors.text.primary,
    fontSize: 15,
    marginRight: DesignSystem.spacing.sm,
    width: 20,
  },
  bold: {
    fontWeight: '600',
    color: DesignSystem.colors.text.primary,
  },
  link: {
    color: DesignSystem.colors.primary,
    textDecorationLine: 'underline',
  },
});
