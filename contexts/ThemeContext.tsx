import { logger } from '@/lib/logger';
/**
 * Theme Context for EduDash Pro
 * 
 * Provides comprehensive theming support with:
 * - Light and dark mode
 * - System theme detection
 * - Persistent user preferences
 * - Complete color palette for all UI elements
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Extended color palette for comprehensive theming
export interface ThemeColors {
  // Primary colors
  primary: string;
  primaryLight: string;
  primaryDark: string;
  onPrimary: string;
  
  // Secondary colors
  secondary: string;
  secondaryLight: string;
  secondaryDark: string;
  onSecondary: string;
  
  // Background colors
  background: string;
  surface: string;
  surfaceVariant: string;
  elevated: string;
  
  // Text colors
  text: string;
  textSecondary: string;
  textTertiary: string;
  textDisabled: string;
  
  // UI element colors
  border: string;
  borderLight: string;
  divider: string;
  
  // Status colors
  success: string;
  successLight: string;
  successDark: string;
  onSuccess: string;
  
  warning: string;
  warningLight: string;
  warningDark: string;
  onWarning: string;
  
  error: string;
  errorLight: string;
  errorDark: string;
  onError: string;
  
  info: string;
  infoLight: string;
  infoDark: string;
  onInfo: string;
  
  // Accent colors
  accent: string;
  accentLight: string;
  accentDark: string;
  onAccent: string;
  
  // Special UI elements
  tint: string;
  tabIconDefault: string;
  tabIconSelected: string;
  cardBackground: string;
  modalBackground: string;
  modalOverlay: string;
  
  // Input colors
  inputBackground: string;
  inputBorder: string;
  inputBorderFocused: string;
  inputText: string;
  inputPlaceholder: string;
  
  // Navigation colors
  headerBackground: string;
  headerText: string;
  headerTint: string;
  
  // Shadow and overlay
  shadow: string;
  overlay: string;
  
  // Chart colors
  chartPrimary: string;
  chartSecondary: string;
  chartTertiary: string;
  chartQuaternary: string;
  chartQuinary: string;
  
  // Notification colors
  notificationBackground: string;
  notificationText: string;
  notificationBorder: string;

  // Material-like alias objects used in some components
  colors: {
    primary: string;
    onPrimary: string;
    primaryContainer: string;
    onPrimaryContainer: string;
    surface: string;
    surfaceVariant: string;
    onSurface: string;
    onSurfaceVariant: string;
    outline: string;
    background: string;
    error: string;
    errorContainer: string;
    onErrorContainer: string;
    onBackground: string;
  };

  // Typography tokens used in some components for sizing
  typography: {
    caption: { fontSize: number; fontWeight?: string | number };
    body1: { fontSize: number; fontWeight?: string | number };
    body2: { fontSize: number; fontWeight?: string | number };
    subtitle1: { fontSize: number; fontWeight?: string | number };
    subtitle2: { fontSize: number; fontWeight?: string | number };
    titleLarge: { fontSize: number; fontWeight?: string | number };
    titleMedium: { fontSize: number; fontWeight?: string | number };
    labelLarge: { fontSize: number; fontWeight?: string | number };
    headlineSmall: { fontSize: number; fontWeight?: string | number };
  };
}

// Light theme colors - Soft, eye-friendly palette with proper depth
const lightTheme: ThemeColors = {
  // Primary colors
  primary: '#4F46E5',
  primaryLight: '#6366F1',
  primaryDark: '#4338CA',
  onPrimary: '#FFFFFF',
  
  // Secondary colors
  secondary: '#06B6D4',
  secondaryLight: '#22D3EE',
  secondaryDark: '#0891B2',
  onSecondary: '#FFFFFF',
  
  // Background colors - softer, less harsh
  background: '#F5F6F7',  // Soft light gray instead of pure white
  surface: '#FFFFFF',      // Cards/elevated surfaces are white for contrast
  surfaceVariant: '#ECEFF1', // Slightly darker for depth
  elevated: '#FFFFFF',     // Elevated elements stay white
  
  // Text colors
  text: '#111827',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  textDisabled: '#D1D5DB',
  
  // UI element colors - stronger borders for better definition
  border: '#D1D5DB',      // More visible borders
  borderLight: '#E5E7EB', // Subtle borders
  divider: '#E0E3E7',     // Clear dividers
  
  // Status colors
  success: '#10B981',
  successLight: '#34D399',
  successDark: '#059669',
  onSuccess: '#FFFFFF',
  
  warning: '#F59E0B',
  warningLight: '#FCD34D',
  warningDark: '#D97706',
  onWarning: '#FFFFFF',
  
  error: '#EF4444',
  errorLight: '#F87171',
  errorDark: '#DC2626',
  onError: '#FFFFFF',
  
  info: '#3B82F6',
  infoLight: '#60A5FA',
  infoDark: '#2563EB',
  onInfo: '#FFFFFF',
  
  // Accent colors
  accent: '#8B5CF6',
  accentLight: '#A78BFA',
  accentDark: '#7C3AED',
  onAccent: '#FFFFFF',
  
  // Special UI elements
  tint: '#4F46E5',
  tabIconDefault: '#9CA3AF',
  tabIconSelected: '#4F46E5',
  cardBackground: '#FFFFFF',      // Cards are white on gray background
  modalBackground: '#FFFFFF',
  modalOverlay: 'rgba(0, 0, 0, 0.6)', // Darker overlay for better focus
  
  // Input colors
  inputBackground: '#F9FAFB',
  inputBorder: '#D1D5DB',
  inputBorderFocused: '#4F46E5',
  inputText: '#111827',
  inputPlaceholder: '#9CA3AF',
  
  // Navigation colors
  headerBackground: '#FFFFFF',     // Header stays white for elevation
  headerText: '#111827',
  headerTint: '#4F46E5',
  
  // Shadow and overlay - more pronounced for depth
  shadow: 'rgba(0, 0, 0, 0.12)',   // Stronger shadows
  overlay: 'rgba(0, 0, 0, 0.4)',
  
  // Chart colors
  chartPrimary: '#4F46E5',
  chartSecondary: '#06B6D4',
  chartTertiary: '#10B981',
  chartQuaternary: '#F59E0B',
  chartQuinary: '#8B5CF6',
  
  // Notification colors
  notificationBackground: '#ECEFF1',
  notificationText: '#111827',
  notificationBorder: '#D1D5DB',

  // Alias map for components expecting Material-like theme.colors
  colors: {
    primary: '#4F46E5',
    onPrimary: '#FFFFFF',
    primaryContainer: '#ECEFF1',
    onPrimaryContainer: '#111827',
    surface: '#FFFFFF',
    surfaceVariant: '#ECEFF1',
    onSurface: '#111827',
    onSurfaceVariant: '#6B7280',
    outline: '#D1D5DB',
    background: '#F5F6F7',
    error: '#EF4444',
    errorContainer: '#F87171',
    onErrorContainer: '#FFFFFF',
    onBackground: '#111827',
  },

  // Basic typography tokens for components referencing theme.typography
  typography: {
    caption: { fontSize: 12, fontWeight: '400' },
    body1: { fontSize: 16, fontWeight: '400' },
    body2: { fontSize: 14, fontWeight: '400' },
    subtitle1: { fontSize: 16, fontWeight: '600' },
    subtitle2: { fontSize: 14, fontWeight: '600' },
    titleLarge: { fontSize: 22, fontWeight: '700' },
    titleMedium: { fontSize: 18, fontWeight: '600' },
    labelLarge: { fontSize: 14, fontWeight: '700' },
    headlineSmall: { fontSize: 18, fontWeight: '700' },
  },
};

// Dark theme colors
const darkTheme: ThemeColors = {
  // Primary colors
  primary: '#6366F1',
  primaryLight: '#818CF8',
  primaryDark: '#4F46E5',
  onPrimary: '#FFFFFF',
  
  // Secondary colors
  secondary: '#22D3EE',
  secondaryLight: '#67E8F9',
  secondaryDark: '#06B6D4',
  onSecondary: '#000000',
  
  // Background colors
  background: '#0F172A',
  surface: '#1E293B',
  surfaceVariant: '#334155',
  elevated: '#1E293B',
  
  // Text colors
  text: '#F9FAFB',
  textSecondary: '#CBD5E1',
  textTertiary: '#94A3B8',
  textDisabled: '#64748B',
  
  // UI element colors
  border: '#334155',
  borderLight: '#475569',
  divider: '#334155',
  
  // Status colors
  success: '#34D399',
  successLight: '#6EE7B7',
  successDark: '#10B981',
  onSuccess: '#000000',
  
  warning: '#FCD34D',
  warningLight: '#FDE68A',
  warningDark: '#F59E0B',
  onWarning: '#000000',
  
  error: '#F87171',
  errorLight: '#FCA5A5',
  errorDark: '#EF4444',
  onError: '#000000',
  
  info: '#60A5FA',
  infoLight: '#93C5FD',
  infoDark: '#3B82F6',
  onInfo: '#000000',
  
  // Accent colors
  accent: '#A78BFA',
  accentLight: '#C4B5FD',
  accentDark: '#8B5CF6',
  onAccent: '#000000',
  
  // Special UI elements
  tint: '#818CF8',
  tabIconDefault: '#64748B',
  tabIconSelected: '#818CF8',
  cardBackground: '#1E293B',
  modalBackground: '#1E293B',
  modalOverlay: 'rgba(0, 0, 0, 0.7)',
  
  // Input colors
  inputBackground: '#1E293B',
  inputBorder: '#475569',
  inputBorderFocused: '#6366F1',
  inputText: '#F9FAFB',
  inputPlaceholder: '#64748B',
  
  // Navigation colors
  headerBackground: '#1E293B',
  headerText: '#F9FAFB',
  headerTint: '#818CF8',
  
  // Shadow and overlay
  shadow: 'rgba(0, 0, 0, 0.3)',
  overlay: 'rgba(0, 0, 0, 0.5)',
  
  // Chart colors
  chartPrimary: '#818CF8',
  chartSecondary: '#22D3EE',
  chartTertiary: '#34D399',
  chartQuaternary: '#FCD34D',
  chartQuinary: '#A78BFA',
  
  // Notification colors
  notificationBackground: '#334155',
  notificationText: '#F9FAFB',
  notificationBorder: '#475569',

  // Alias map for components expecting Material-like theme.colors
  colors: {
    primary: '#6366F1',
    onPrimary: '#FFFFFF',
    primaryContainer: '#334155',
    onPrimaryContainer: '#F9FAFB',
    surface: '#1E293B',
    surfaceVariant: '#334155',
    onSurface: '#F9FAFB',
    onSurfaceVariant: '#CBD5E1',
    outline: '#334155',
    background: '#0F172A',
    error: '#F87171',
    errorContainer: '#FCA5A5',
    onErrorContainer: '#000000',
    onBackground: '#F9FAFB',
  },

  // Basic typography tokens for components referencing theme.typography
  typography: {
    caption: { fontSize: 12, fontWeight: '400' },
    body1: { fontSize: 16, fontWeight: '400' },
    body2: { fontSize: 14, fontWeight: '400' },
    subtitle1: { fontSize: 16, fontWeight: '600' },
    subtitle2: { fontSize: 14, fontWeight: '600' },
    titleLarge: { fontSize: 22, fontWeight: '700' },
    titleMedium: { fontSize: 18, fontWeight: '600' },
    labelLarge: { fontSize: 14, fontWeight: '700' },
    headlineSmall: { fontSize: 18, fontWeight: '700' },
  },
};

// Theme modes
export type ThemeMode = 'light' | 'dark' | 'system';

// Theme context interface
interface ThemeContextType {
  theme: ThemeColors;
  mode: ThemeMode;
  isDark: boolean;
  setMode: (mode: ThemeMode) => Promise<void>;
  toggleTheme: () => Promise<void>;
}

// Create context
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Storage keys
const THEME_STORAGE_KEY = '@edudash_theme_mode';
const LANGUAGE_STORAGE_KEY = '@edudash_language';

// Theme provider props
interface ThemeProviderProps {
  children: ReactNode;
}

// Theme provider component
export function ThemeProvider({ children }: ThemeProviderProps) {
  const systemColorScheme = useSystemColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [isLoading, setIsLoading] = useState(true);

  // Load saved theme mode on mount
  useEffect(() => {
    loadSavedThemeMode();
  }, []);

  // Load saved theme mode from storage
  const loadSavedThemeMode = async () => {
    try {
      const savedMode = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (savedMode && ['light', 'dark', 'system'].includes(savedMode)) {
        setModeState(savedMode as ThemeMode);
        if (__DEV__) logger.info('[Theme] Loaded persisted mode:', savedMode);
      } else if (__DEV__) {
        logger.info('[Theme] No persisted mode found, defaulting to system');
      }
    } catch (error) {
      console.error('Failed to load theme mode:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Save theme mode to storage
  const saveThemeMode = async (newMode: ThemeMode) => {
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newMode);
    } catch (error) {
      console.error('Failed to save theme mode:', error);
    }
  };

  // Set theme mode
  const setMode = async (newMode: ThemeMode) => {
    setModeState(newMode);
    await saveThemeMode(newMode);
  };

  // Toggle between light and dark modes
  const toggleTheme = async () => {
    const currentIsDark = isDark;
    const newMode = currentIsDark ? 'light' : 'dark';
    await setMode(newMode);
  };

  // Determine if dark mode is active
  const isDark = mode === 'dark' || (mode === 'system' && systemColorScheme === 'dark');

  // Get current theme
  const theme = isDark ? darkTheme : lightTheme;

  // Don't render until theme is loaded
  if (isLoading) {
    return null;
  }

  return (
    <ThemeContext.Provider
      value={{
        theme,
        mode,
        isDark,
        setMode,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

// Hook to use theme
export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

// Utility function to get theme colors (for use outside of components)
export function getThemeColors(isDark: boolean): ThemeColors {
  return isDark ? darkTheme : lightTheme;
}

// Export theme objects for direct access if needed
export { lightTheme, darkTheme };
