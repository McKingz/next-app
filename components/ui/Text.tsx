/**
 * Text Component
 * 
 * Consistent typography system for EduDash Pro
 * Complies with WARP.md accessibility standards
 */

import React from 'react';
import { Text as RNText, StyleSheet, TextStyle, StyleProp } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

export interface TextProps {
  children: React.ReactNode;
  variant?: 'title1' | 'title2' | 'title3' | 'headline' | 'subheadline' | 'body' | 'callout' | 'caption1' | 'caption2' | 'footnote';
  color?: 'primary' | 'secondary' | 'tertiary' | 'error' | 'success' | 'warning' | 'white';
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  ellipsizeMode?: 'head' | 'middle' | 'tail' | 'clip';
  testID?: string;
  accessibilityLabel?: string;
}

const typography = {
  title1: {
    fontSize: 34,
    fontWeight: '700' as const,
    lineHeight: 41,
  },
  title2: {
    fontSize: 28,
    fontWeight: '700' as const,
    lineHeight: 34,
  },
  title3: {
    fontSize: 22,
    fontWeight: '600' as const,
    lineHeight: 28,
  },
  headline: {
    fontSize: 17,
    fontWeight: '600' as const,
    lineHeight: 22,
  },
  subheadline: {
    fontSize: 15,
    fontWeight: '400' as const,
    lineHeight: 20,
  },
  body: {
    fontSize: 17,
    fontWeight: '400' as const,
    lineHeight: 22,
  },
  callout: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 21,
  },
  caption1: {
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 16,
  },
  caption2: {
    fontSize: 11,
    fontWeight: '400' as const,
    lineHeight: 13,
  },
  footnote: {
    fontSize: 13,
    fontWeight: '400' as const,
    lineHeight: 18,
  },
};

export function Text({
  children,
  variant = 'body',
  color = 'primary',
  style,
  numberOfLines,
  ellipsizeMode = 'tail',
  testID,
  accessibilityLabel,
  ...props
}: TextProps) {
  const { theme } = useTheme();
  
  const getTextColor = () => {
    switch (color) {
      case 'primary':
        return theme.text;
      case 'secondary':
        return theme.textSecondary;
      case 'tertiary':
        return theme.textTertiary;
      case 'error':
        return theme.error;
      case 'success':
        return theme.success;
      case 'warning':
        return theme.warning;
      case 'white':
        return theme.onPrimary;
      default:
        return theme.text;
    }
  };
  
  const textStyle = [
    styles.base,
    typography[variant],
    { color: getTextColor() },
    style,
  ];

  return (
    <RNText
      style={textStyle}
      numberOfLines={numberOfLines}
      ellipsizeMode={ellipsizeMode}
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      {...props}
    >
      {children}
    </RNText>
  );
}

const styles = StyleSheet.create({
  base: {
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
});