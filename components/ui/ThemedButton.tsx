/**
 * Themed Button Component
 * 
 * A button component that properly uses the theme system
 */

import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface ThemedButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function ThemedButton({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  style,
  textStyle,
}: ThemedButtonProps) {
  const { theme } = useTheme();

  const getButtonStyle = (): ViewStyle => {
    const baseStyle = styles.button;
    const sizeStyle = styles[size];
    
    let variantStyle: ViewStyle = {};
    let textColor = theme.onPrimary;

    switch (variant) {
      case 'primary':
        variantStyle = { backgroundColor: theme.primary };
        textColor = theme.onPrimary;
        break;
      case 'secondary':
        variantStyle = { backgroundColor: theme.secondary };
        textColor = theme.onSecondary;
        break;
      case 'success':
        variantStyle = { backgroundColor: theme.success };
        textColor = theme.onSuccess;
        break;
      case 'danger':
        variantStyle = { backgroundColor: theme.error };
        textColor = theme.onError;
        break;
      case 'warning':
        variantStyle = { backgroundColor: theme.warning };
        textColor = theme.onWarning;
        break;
      case 'ghost':
        variantStyle = {
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: theme.border,
        };
        textColor = theme.text;
        break;
    }

    if (disabled) {
      variantStyle = {
        ...variantStyle,
        backgroundColor: theme.surfaceVariant,
        opacity: 0.6,
      };
    }

    return {
      ...baseStyle,
      ...sizeStyle,
      ...variantStyle,
      ...style,
    };
  };

  const getTextStyle = (): TextStyle => {
    const baseStyle = styles.text;
    const sizeStyle = size === 'small' ? styles.smallText : size === 'large' ? styles.largeText : styles.mediumText;
    
    return {
      ...baseStyle,
      ...sizeStyle,
      color: variant === 'ghost' ? theme.text : theme.onPrimary,
      ...textStyle,
    };
  };

  return (
    <TouchableOpacity
      style={getButtonStyle()}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator
          size={size === 'small' ? 'small' : 'small'}
          color={variant === 'ghost' ? theme.text : theme.onPrimary}
        />
      ) : (
        <Text style={getTextStyle()}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  small: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  medium: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  large: {
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  text: {
    fontWeight: '600',
  },
  smallText: {
    fontSize: 14,
  },
  mediumText: {
    fontSize: 16,
  },
  largeText: {
    fontSize: 18,
  },
});
