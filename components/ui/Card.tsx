/**
 * Card Component
 * 
 * Container component with consistent styling and shadows
 * Mobile-first design with accessibility support
 */

import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

export interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  padding?: number;
  margin?: number;
  elevation?: 'none' | 'small' | 'medium' | 'large';
  testID?: string;
}

const elevations = {
  none: {
    shadowOpacity: 0,
    elevation: 0,
  },
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 1.0,
    elevation: 1,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 2,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.32,
    shadowRadius: 5.46,
    elevation: 4,
  },
};

export function Card({
  children,
  style,
  padding = 16,
  margin = 0,
  elevation = 'small',
  testID,
  ...props
}: CardProps) {
  const { theme } = useTheme();
  
  const styles = StyleSheet.create({
    base: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
  });
  
  return (
    <View
      style={[
        styles.base,
        elevations[elevation],
        {
          padding,
          margin,
        },
        style,
      ]}
      testID={testID}
      {...props}
    >
      {children}
    </View>
  );
}

