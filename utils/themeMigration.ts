/**
 * Theme Migration Utility
 * 
 * Helper functions to assist in converting hardcoded colors to theme-aware colors
 */

import { ThemeColors } from '@/contexts/ThemeContext';

/**
 * Common hardcoded color mappings to theme properties
 */
export const colorMigrationMap = {
  // Whites and light grays
  '#FFFFFF': 'surface',
  '#ffffff': 'surface',
  '#F9FAFB': 'background',
  '#F3F4F6': 'surfaceVariant',
  '#E5E7EB': 'border',
  '#D1D5DB': 'borderLight',
  
  // Dark colors
  '#000000': 'text',
  '#111827': 'text',
  '#374151': 'textSecondary',
  '#6B7280': 'textSecondary',
  '#9CA3AF': 'textTertiary',
  
  // Blues (primary colors)
  '#4F46E5': 'primary',
  '#6366F1': 'primaryLight',
  '#4338CA': 'primaryDark',
  
  // Status colors
  '#EF4444': 'error',
  '#10B981': 'success',
  '#F59E0B': 'warning',
  '#3B82F6': 'info',
  
  // Overlays
  'rgba(0,0,0,0.4)': 'modalOverlay',
  'rgba(0,0,0,0.5)': 'overlay',
  'rgba(0,0,0,0.1)': 'shadow',
} as const;

/**
 * Suggests theme property for a given hardcoded color
 */
export function suggestThemeProperty(color: string): keyof ThemeColors | null {
  const normalizedColor = color.toLowerCase();
  
  // Direct mapping
  if (normalizedColor in colorMigrationMap) {
    return colorMigrationMap[normalizedColor as keyof typeof colorMigrationMap];
  }
  
  // Pattern matching for common cases
  if (normalizedColor.includes('rgba(0,0,0')) return 'shadow';
  if (normalizedColor.includes('rgba(255,255,255')) return 'surface';
  if (normalizedColor.startsWith('#f')) return 'background'; // Light colors
  if (normalizedColor.startsWith('#1') || normalizedColor.startsWith('#2')) return 'text'; // Dark colors
  if (normalizedColor.startsWith('#4') || normalizedColor.startsWith('#6')) return 'primary'; // Blue colors
  
  return null;
}

/**
 * Migration helper for component styles
 */
export function createThemeAwareStyle<T extends Record<string, any>>(
  theme: ThemeColors,
  styles: T,
  migrations?: Partial<Record<keyof T, Partial<Record<string, keyof ThemeColors>>>>
): T {
  if (!migrations) return styles;
  
  const result = { ...styles };
  
  Object.entries(migrations).forEach(([styleKey, colorMappings]) => {
    if (result[styleKey] && colorMappings) {
      Object.entries(colorMappings).forEach(([property, themeKey]) => {
        if (result[styleKey][property] && themeKey && theme[themeKey as keyof typeof theme]) {
          result[styleKey][property] = theme[themeKey as keyof typeof theme];
        }
      });
    }
  });
  
  return result;
}

/**
 * Quick theme-aware colors for common use cases
 */
export const getQuickThemeColors = (theme: ThemeColors) => ({
  // Common patterns
  cardStyle: {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    shadowColor: theme.shadow,
  },
  
  buttonPrimary: {
    backgroundColor: theme.primary,
    color: theme.onPrimary,
  },
  
  buttonSecondary: {
    backgroundColor: theme.secondary,
    color: theme.onSecondary,
  },
  
  inputStyle: {
    backgroundColor: theme.inputBackground,
    borderColor: theme.inputBorder,
    color: theme.inputText,
  },
  
  textPrimary: {
    color: theme.text,
  },
  
  textSecondary: {
    color: theme.textSecondary,
  },
  
  overlay: {
    backgroundColor: theme.modalOverlay,
  },
  
  divider: {
    backgroundColor: theme.divider,
  },
});

/**
 * Example usage in a component:
 * 
 * ```tsx
 * const { theme } = useTheme();
 * const quickColors = getQuickThemeColors(theme);
 * 
 * const styles = StyleSheet.create({
 *   card: {
 *     ...quickColors.cardStyle,
 *     padding: 16,
 *     borderRadius: 8,
 *   },
 *   title: {
 *     ...quickColors.textPrimary,
 *     fontSize: 18,
 *     fontWeight: 'bold',
 *   }
 * });
 * ```
 */