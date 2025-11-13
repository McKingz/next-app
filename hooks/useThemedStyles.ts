/**
 * useThemedStyles Hook
 * 
 * A custom hook that makes it easy to create theme-aware styles
 */

import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { useTheme, ThemeColors } from '@/contexts/ThemeContext';

/**
 * Hook to create themed styles
 * @param stylesFn A function that receives theme colors and returns styles
 * @returns Memoized styles object
 */
export function useThemedStyles<T extends StyleSheet.NamedStyles<T>>(
  stylesFn: (theme: ThemeColors, isDark: boolean) => T
): T {
  const { theme, isDark } = useTheme();
  
  return useMemo(() => stylesFn(theme, isDark), [theme, isDark, stylesFn]);
}

/**
 * Common themed style utilities
 */
export const themedStyles = {
  /**
   * Card style with theme-aware colors
   */
  card: (theme: ThemeColors) => ({
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 16,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  }),

  /**
   * Input field style with theme-aware colors
   */
  input: (theme: ThemeColors) => ({
    backgroundColor: theme.inputBackground,
    borderWidth: 1,
    borderColor: theme.inputBorder,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: theme.inputText,
  }),

  /**
   * Button style with theme-aware colors
   */
  button: (theme: ThemeColors, variant: 'primary' | 'secondary' | 'ghost' = 'primary') => {
    const baseStyle = {
      borderRadius: 8,
      paddingHorizontal: 24,
      paddingVertical: 12,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    };

    switch (variant) {
      case 'primary':
        return {
          ...baseStyle,
          backgroundColor: theme.primary,
        };
      case 'secondary':
        return {
          ...baseStyle,
          backgroundColor: theme.secondary,
        };
      case 'ghost':
        return {
          ...baseStyle,
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: theme.border,
        };
    }
  },

  /**
   * Text styles with theme-aware colors
   */
  text: {
    heading1: (theme: ThemeColors) => ({
      fontSize: 32,
      fontWeight: '700' as const,
      color: theme.text,
    }),
    heading2: (theme: ThemeColors) => ({
      fontSize: 24,
      fontWeight: '600' as const,
      color: theme.text,
    }),
    heading3: (theme: ThemeColors) => ({
      fontSize: 20,
      fontWeight: '500' as const,
      color: theme.text,
    }),
    body: (theme: ThemeColors) => ({
      fontSize: 16,
      color: theme.text,
    }),
    caption: (theme: ThemeColors) => ({
      fontSize: 14,
      color: theme.textSecondary,
    }),
    small: (theme: ThemeColors) => ({
      fontSize: 12,
      color: theme.textTertiary,
    }),
  },

  /**
   * Container with theme-aware background
   */
  container: (theme: ThemeColors) => ({
    flex: 1,
    backgroundColor: theme.background,
  }),

  /**
   * Section separator
   */
  separator: (theme: ThemeColors) => ({
    height: 1,
    backgroundColor: theme.divider,
    marginVertical: 16,
  }),

  /**
   * List item
   */
  listItem: (theme: ThemeColors) => ({
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.divider,
  }),

  /**
   * Badge/chip style
   */
  badge: (theme: ThemeColors, variant: 'default' | 'success' | 'warning' | 'error' = 'default') => {
    const variants = {
      default: {
        backgroundColor: theme.surfaceVariant,
        color: theme.text,
      },
      success: {
        backgroundColor: theme.successLight,
        color: theme.onSuccess,
      },
      warning: {
        backgroundColor: theme.warningLight,
        color: theme.onWarning,
      },
      error: {
        backgroundColor: theme.errorLight,
        color: theme.onError,
      },
    };

    return {
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
      ...variants[variant],
    };
  },
};

/**
 * Example usage:
 * 
 * const styles = useThemedStyles((theme, isDark) => ({
 *   container: {
 *     flex: 1,
 *     backgroundColor: theme.background,
 *   },
 *   title: {
 *     fontSize: 24,
 *     color: theme.text,
 *   },
 *   card: themedStyles.card(theme),
 * }));
 */
