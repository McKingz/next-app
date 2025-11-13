/**
 * Button Component
 * 
 * Accessible button component with consistent styling
 * Complies with WARP.md accessibility and touch target requirements
 */

import React from 'react';
import { Pressable, StyleSheet, ViewStyle, ActivityIndicator, View } from 'react-native';
import { Text } from './Text';
import { useTheme } from '@/contexts/ThemeContext';

export interface ButtonProps {
  children: React.ReactNode;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  testID?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

const sizes = {
  small: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 32,
    borderRadius: 8,
  },
  medium: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 44, // WCAG minimum touch target
    borderRadius: 10,
  },
  large: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    minHeight: 52,
    borderRadius: 12,
  },
};

export function Button({
  children,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  style,
  testID,
  accessibilityLabel,
  accessibilityHint,
  ...props
}: ButtonProps) {
  const { theme } = useTheme();
  const isDisabled = disabled || loading;
  
  const getBackgroundColor = (pressed: boolean) => {
    if (isDisabled) return theme.textDisabled;
    if (pressed) {
      switch (variant) {
        case 'primary': return theme.primaryDark;
        case 'secondary': return theme.secondaryDark;
        case 'outline': return theme.surfaceVariant;
        case 'ghost': return theme.surfaceVariant;
        default: return theme.primaryDark;
      }
    }
    switch (variant) {
      case 'primary': return theme.primary;
      case 'secondary': return theme.secondary;
      case 'outline': return 'transparent';
      case 'ghost': return 'transparent';
      default: return theme.primary;
    }
  };
  
  const getTextColor = () => {
    if (isDisabled) return theme.textDisabled;
    switch (variant) {
      case 'primary': return theme.onPrimary;
      case 'secondary': return theme.onSecondary;
      case 'outline': return theme.primary;
      case 'ghost': return theme.primary;
      default: return theme.onPrimary;
    }
  };
  
  const getBorderStyle = () => {
    if (variant === 'outline') {
      return {
        borderWidth: 1,
        borderColor: isDisabled ? theme.textDisabled : theme.primary,
      };
    }
    return {};
  };

  return (
    <Pressable
      onPress={isDisabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.base,
        sizes[size],
        {
          backgroundColor: getBackgroundColor(pressed),
        },
        getBorderStyle(),
        style,
        isDisabled && styles.disabled,
      ]}
      disabled={isDisabled}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      {...props}
    >
      <>
        <View style={styles.content}>
        {loading && (
          <ActivityIndicator 
            size="small" 
            color={getTextColor()} 
            style={styles.loader}
          />
        )}
        {typeof children === 'string' ? (
          <Text
            variant={size === 'small' ? 'caption1' : 'callout'}
            style={[styles.text, { color: getTextColor() }]}
          >
            {children}
          </Text>
        ) : (
          children
        )}
        </View>
      </>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    // Minimum touch target of 44x44 for accessibility
    minWidth: 44,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '600',
  },
  loader: {
    marginRight: 8,
  },
  disabled: {
    opacity: 0.6,
  },
});