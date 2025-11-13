import { Platform } from 'react-native';

/**
 * Marketing Design Tokens
 * Modern, minimal dark theme for marketing pages
 */

export const marketingTokens = {
  colors: {
    // Background layers (deep blacks with subtle variation)
    bg: {
      base: '#05060A',
      elevated: '#0A0E16',
      surface: '#0F1421',
      surfaceMuted: '#12192A',
    },
    
    // Foreground/Text colors
    fg: {
      primary: '#E8ECF4',
      secondary: '#A6B0C2',
      tertiary: '#818AA3',
      inverse: '#0A0E16',
    },
    
    // Accent colors (cyan/blue spectrum)
    accent: {
      cyan400: '#2BD9EF',
      cyan500: '#16C6DA',
      blue500: '#4C6FFF',
      indigo500: '#6366F1',
      green400: '#22D3A3',
      red400: '#F87171',
    },
    
    // Borders and overlays
    stroke: {
      soft: 'rgba(255,255,255,0.06)',
      medium: 'rgba(255,255,255,0.10)',
      highlight: 'rgba(255,255,255,0.08)',
    },
    
    overlay: {
      soft: 'rgba(255,255,255,0.03)',
      strong: 'rgba(255,255,255,0.06)',
    },
  },
  
  // Gradient definitions
  gradients: {
    primary: ['#19CFF7', '#4C6FFF'] as [string, string],
    indigo: ['#0EA5E9', '#6366F1'] as [string, string],
    glow: ['rgba(76,111,255,0.0)', 'rgba(76,111,255,0.15)', 'rgba(76,111,255,0.0)'] as [string, string, string],
    background: ['#05060A', '#0A0E16'] as [string, string],
  },
  
  // Spacing scale (8px base)
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    '2xl': 32,
    '3xl': 40,
    '4xl': 48,
    '5xl': 56,
    '6xl': 64,
  },
  
  // Border radii
  radii: {
    xs: 6,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    full: 999,
  },
  
  // Typography scale
  typography: {
    display1: {
      fontSize: 32,
      lineHeight: 38,
      fontWeight: '700' as const,
      letterSpacing: -0.4,
    },
    h1: {
      fontSize: 28,
      lineHeight: 34,
      fontWeight: '700' as const,
      letterSpacing: -0.3,
    },
    h2: {
      fontSize: 24,
      lineHeight: 30,
      fontWeight: '700' as const,
      letterSpacing: -0.2,
    },
    h3: {
      fontSize: 20,
      lineHeight: 26,
      fontWeight: '600' as const,
      letterSpacing: -0.1,
    },
    body: {
      fontSize: 16,
      lineHeight: 24,
      fontWeight: '400' as const,
    },
    caption: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '400' as const,
    },
    overline: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '500' as const,
      letterSpacing: 0.5,
    },
  },
  
  // Shadow helper (platform-specific)
  shadow: (level: 'xs' | 'sm' | 'md' | 'lg') => {
    return Platform.select({
      ios: {
        xs: {
          shadowColor: '#000',
          shadowOpacity: 0.25,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 2 },
        },
        sm: {
          shadowColor: '#000',
          shadowOpacity: 0.25,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
        },
        md: {
          shadowColor: '#000',
          shadowOpacity: 0.3,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 8 },
        },
        lg: {
          shadowColor: '#000',
          shadowOpacity: 0.35,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 12 },
        },
      }[level],
      android: {
        xs: { elevation: 2 },
        sm: { elevation: 4 },
        md: { elevation: 8 },
        lg: { elevation: 12 },
      }[level],
      default: {},
    });
  },
} as const;
