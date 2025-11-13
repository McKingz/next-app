/**
 * Badge Component
 * 
 * Small status indicator component
 */

import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Text } from './Text';
import { useTheme } from '@/contexts/ThemeContext';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
  size?: 'small' | 'medium' | 'large';
  style?: ViewStyle;
  testID?: string;
}

const sizes = {
  small: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  medium: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  large: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
};

export function Badge({
  children,
  variant = 'primary',
  size = 'medium',
  style,
  testID,
  ...props
}: BadgeProps) {
  const { theme } = useTheme();
  
  const getColors = () => {
    switch (variant) {
      case 'primary':
        return { bg: theme.primary, text: theme.onPrimary };
      case 'secondary':
        return { bg: theme.secondary, text: theme.onSecondary };
      case 'success':
        return { bg: theme.success, text: theme.onSuccess };
      case 'warning':
        return { bg: theme.warning, text: theme.onWarning };
      case 'error':
        return { bg: theme.error, text: theme.onError };
      default:
        return { bg: theme.primary, text: theme.onPrimary };
    }
  };
  
  const colors = getColors();
  
  return (
    <View
      style={[
        styles.base,
        sizes[size],
        { backgroundColor: colors.bg },
        style,
      ]}
      testID={testID}
      {...props}
    >
      {typeof children === 'string' ? (
        <Text
          variant={size === 'small' ? 'caption2' : 'caption1'}
          style={{ color: colors.text, fontWeight: '600' }}
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
});