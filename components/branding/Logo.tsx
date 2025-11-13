import React from 'react';
import { View, Text, Image, StyleSheet, ViewStyle, TextStyle, ImageStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export type LogoVariant = 'icon-only' | 'horizontal' | 'stacked' | 'text-only';
export type LogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface LogoProps {
  /**
   * Logo variant to display
   * - 'icon-only': Just the speech bubble icon
   * - 'horizontal': Icon + wordmark side-by-side
   * - 'stacked': Icon on top, wordmark below
   * - 'text-only': Just "EDUDASH" text with gradient
   */
  variant?: LogoVariant;
  
  /**
   * Size preset
   * - 'xs': 24px icon, 12px text
   * - 'sm': 32px icon, 14px text
   * - 'md': 48px icon, 18px text (default)
   * - 'lg': 64px icon, 24px text
   * - 'xl': 80px icon, 32px text
   */
  size?: LogoSize;
  
  /**
   * Show tagline below logo (only for stacked variant)
   */
  showTagline?: boolean;
  
  /**
   * Use monochrome version (for dark backgrounds)
   */
  monochrome?: boolean;
  
  /**
   * Custom color for monochrome version
   */
  monochromeColor?: string;
  
  /**
   * Additional container style
   */
  style?: ViewStyle;
  
  /**
   * Accessible label for screen readers
   */
  accessibilityLabel?: string;
}

const SIZE_CONFIG = {
  xs: { icon: 24, text: 12, spacing: 4 },
  sm: { icon: 32, text: 14, spacing: 6 },
  md: { icon: 48, text: 18, spacing: 8 },
  lg: { icon: 64, text: 24, spacing: 12 },
  xl: { icon: 80, text: 32, spacing: 16 },
};

const BRAND_COLORS = {
  turquoise: '#33C3D4',
  blue: '#1E6FBF',
  purple: '#7B3FF2',
  purpleLight: '#9B5FF2',
};

/**
 * EduDash Pro Logo Component
 * 
 * A flexible logo component that supports multiple variants and sizes.
 * Uses the official brand assets from assets/branding/
 * 
 * @example
 * ```tsx
 * // Icon only for app headers
 * <Logo variant="icon-only" size="sm" />
 * 
 * // Horizontal for navigation
 * <Logo variant="horizontal" size="md" />
 * 
 * // Stacked for splash screens
 * <Logo variant="stacked" size="xl" showTagline />
 * 
 * // Monochrome for dark backgrounds
 * <Logo variant="horizontal" size="lg" monochrome monochromeColor="#FFFFFF" />
 * ```
 */
export const Logo: React.FC<LogoProps> = ({
  variant = 'horizontal',
  size = 'md',
  showTagline = false,
  monochrome = false,
  monochromeColor = '#111827',
  style,
  accessibilityLabel = 'EduDash Pro',
}) => {
  const config = SIZE_CONFIG[size];
  
  // Icon Only Variant
  if (variant === 'icon-only') {
    return (
      <View 
        style={[styles.container, style]}
        accessible={true}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="image"
      >
        <Image 
          source={require('@/assets/branding/png/icon-512.png')}
          style={{ width: config.icon, height: config.icon }}
          resizeMode="contain"
        />
      </View>
    );
  }
  
  // Text Only Variant
  if (variant === 'text-only') {
    return (
      <View 
        style={[styles.container, style]}
        accessible={true}
        accessibilityLabel={accessibilityLabel}
      >
        {monochrome ? (
          <Text style={[styles.wordmark, { fontSize: config.text, color: monochromeColor }]}>
            EDUDASH
          </Text>
        ) : (
          <View style={styles.gradientTextContainer}>
            <LinearGradient
              colors={[BRAND_COLORS.turquoise, BRAND_COLORS.blue]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gradientEdu}
            >
              <Text style={[styles.wordmark, styles.gradientText, { fontSize: config.text }]}>
                EDU
              </Text>
            </LinearGradient>
            <LinearGradient
              colors={[BRAND_COLORS.purple, BRAND_COLORS.purpleLight]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gradientDash}
            >
              <Text style={[styles.wordmark, styles.gradientText, { fontSize: config.text }]}>
                DASH
              </Text>
            </LinearGradient>
          </View>
        )}
      </View>
    );
  }
  
  // Horizontal Variant
  if (variant === 'horizontal') {
    return (
      <View 
        style={[styles.container, styles.horizontal, style]}
        accessible={true}
        accessibilityLabel={accessibilityLabel}
      >
        <Image 
          source={
            monochrome 
              ? require('@/assets/branding/png/logo-monochrome-1024w.png')
              : require('@/assets/branding/png/logo-horizontal-1024w.png')
          }
          style={{ 
            width: config.icon * 3.2, 
            height: config.icon,
          }}
          resizeMode="contain"
          tintColor={monochrome ? monochromeColor : undefined}
        />
      </View>
    );
  }
  
  // Stacked Variant
  if (variant === 'stacked') {
    return (
      <View 
        style={[styles.container, styles.stacked, style]}
        accessible={true}
        accessibilityLabel={
          showTagline 
            ? `${accessibilityLabel} - Where Teachers Teach, Learners Grow, and Parents Stay Connected`
            : accessibilityLabel
        }
      >
        <Image 
          source={require('@/assets/branding/png/icon-512.png')}
          style={{ 
            width: config.icon, 
            height: config.icon,
            marginBottom: config.spacing,
          }}
          resizeMode="contain"
        />
        
        {monochrome ? (
          <Text style={[styles.wordmark, { fontSize: config.text, color: monochromeColor }]}>
            EDUDASH
          </Text>
        ) : (
          <View style={styles.gradientTextContainer}>
            <LinearGradient
              colors={[BRAND_COLORS.turquoise, BRAND_COLORS.blue]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gradientEdu}
            >
              <Text style={[styles.wordmark, styles.gradientText, { fontSize: config.text }]}>
                EDU
              </Text>
            </LinearGradient>
            <LinearGradient
              colors={[BRAND_COLORS.purple, BRAND_COLORS.purpleLight]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gradientDash}
            >
              <Text style={[styles.wordmark, styles.gradientText, { fontSize: config.text }]}>
                DASH
              </Text>
            </LinearGradient>
          </View>
        )}
        
        {showTagline && (
          <Text style={[styles.tagline, { fontSize: config.text * 0.5, color: monochrome ? monochromeColor : '#6B7280' }]}>
            Where Teachers Teach, Learners Grow,{'\n'}and Parents Stay Connected
          </Text>
        )}
      </View>
    );
  }
  
  return null;
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  horizontal: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stacked: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  wordmark: {
    fontWeight: '900',
    letterSpacing: -1,
  },
  gradientTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gradientEdu: {
    paddingHorizontal: 2,
    borderRadius: 4,
  },
  gradientDash: {
    paddingHorizontal: 2,
    borderRadius: 4,
  },
  gradientText: {
    color: 'transparent',
    // Note: Gradient text requires additional libraries like react-native-linear-gradient-text
    // For now, we'll use solid colors as fallback
  },
  tagline: {
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 16,
  },
});

// Export brand colors for use elsewhere
export const BrandColors = BRAND_COLORS;
