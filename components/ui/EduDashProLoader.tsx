/**
 * EduDashPro Loading Component
 * 
 * Beautiful branded loading screen with animated icon
 */

import React, { useEffect, useRef } from 'react';
import { 
  View, 
  StyleSheet, 
  ActivityIndicator, 
  Animated, 
  Easing,
  Platform,
  Dimensions
} from 'react-native';
import { Image } from 'expo-image';
import { Text } from './Text';
import { useTheme } from '@/contexts/ThemeContext';

const { width, height } = Dimensions.get('window');

export interface EduDashProLoaderProps {
  message?: string;
  showIcon?: boolean;
  showSpinner?: boolean;
  iconSize?: number;
  style?: any;
  testID?: string;
  fullScreen?: boolean;
  variant?: 'default' | 'splash' | 'inline';
}

export function EduDashProLoader({
  message = 'Loading EduDashPro...',
  showIcon = true,
  showSpinner = true,
  iconSize = 120,
  style,
  testID,
  fullScreen = true,
  variant = 'default',
  ...props
}: EduDashProLoaderProps) {
  // Fallback theme for use outside ThemeProvider (e.g., splash screen)
  const defaultTheme = {
    background: '#1A1A2E',
    surface: '#16213E',
    primary: '#0F3460',
    accent: '#E94560',
    text: '#FFFFFF',
    textSecondary: '#A0A0A0',
    border: '#2A2A3E',
    success: '#4CAF50',
    warning: '#FFC107',
    error: '#F44336',
    isDark: true,
  };

  // Try to use theme from context, fallback to default if not available
  let themeContext;
  try {
    themeContext = useTheme();
  } catch (error) {
    themeContext = { theme: defaultTheme };
  }
  
  const theme = themeContext?.theme || defaultTheme;
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Start animations
    const animations = [
      // Fade in
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      // Scale up icon
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 600,
        easing: Easing.elastic(1.2),
        useNativeDriver: true,
      }),
    ];

    // Continuous animations
    const continuousAnimations = [
      // Gentle pulse
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 2000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 2000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      ),
    ];

    // Start entrance animations
    Animated.parallel(animations).start();
    
    // Start continuous animations
    continuousAnimations.forEach(anim => anim.start());

    return () => {
      // Clean up animations
      fadeAnim.stopAnimation();
      scaleAnim.stopAnimation();
      rotateAnim.stopAnimation();
      pulseAnim.stopAnimation();
    };
  }, [fadeAnim, scaleAnim, rotateAnim, pulseAnim]);

  const containerStyle = variant === 'splash' ? styles.splashContainer : 
                        fullScreen ? styles.fullScreenContainer : styles.inlineContainer;

  const iconSource = require('@/assets/branding/png/icon-512.png');

  return (
    <Animated.View 
      style={[
        containerStyle,
        { opacity: fadeAnim },
        variant === 'splash' && {
          backgroundColor: theme.colors.primary || '#00f5ff',
        },
        style
      ]} 
      testID={testID} 
      {...props}
    >
      {/* Background Gradient Effect for Splash */}
      {variant === 'splash' && (
        <View style={styles.backgroundGradient} />
      )}

      {/* Main Content */}
      <View style={styles.content}>
        {showIcon && (
          <Animated.View
            style={[
              styles.iconContainer,
              {
                transform: [
                  { scale: Animated.multiply(scaleAnim, pulseAnim) },
                ],
              },
            ]}
          >
            <Image
              source={iconSource}
              style={[
                styles.icon,
                { 
                  width: iconSize, 
                  height: iconSize,
                  borderRadius: iconSize / 2, // Make it perfectly round
                },
              ]}
              contentFit="contain"
              transition={200}
            />
            
            {/* Subtle glow effect */}
            <View 
              style={[
                styles.iconGlow,
                {
                  width: iconSize + 40,
                  height: iconSize + 40,
                  borderRadius: (iconSize + 40) / 2,
                  backgroundColor: variant === 'splash' ? 'rgba(255,255,255,0.2)' : 'rgba(0,245,255,0.1)',
                }
              ]}
            />
          </Animated.View>
        )}

        {/* Loading Text */}
        {message && (
          <Animated.View style={{ opacity: fadeAnim }}>
            <Text 
              variant={variant === 'splash' ? 'title2' : 'body'} 
              color={variant === 'splash' ? 'white' : 'primary'}
              style={[
                styles.message,
                variant === 'splash' && styles.splashMessage,
              ]}
            >
              {message}
            </Text>
          </Animated.View>
        )}

        {/* Spinner */}
        {showSpinner && (
          <Animated.View style={[styles.spinnerContainer, { opacity: fadeAnim }]}>
            <ActivityIndicator 
              size="large" 
              color={variant === 'splash' ? 'white' : (theme.colors.primary || '#00f5ff')}
            />
          </Animated.View>
        )}

        {/* Brand Name for Splash */}
        {variant === 'splash' && (
          <Animated.View style={{ opacity: fadeAnim }}>
            <Text 
              variant="title1" 
              color="white"
              style={styles.brandName}
            >
              EduDash Pro
            </Text>
            <Text 
              variant="caption1" 
              color="white"
              style={styles.tagline}
            >
              AI-Powered Educational Platform
            </Text>
          </Animated.View>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fullScreenContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    zIndex: 9999,
  },
  splashContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10000,
  },
  inlineContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    minHeight: 200,
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'linear-gradient(135deg, #00f5ff 0%, #0066cc 100%)',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  icon: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  iconGlow: {
    position: 'absolute',
    top: -20,
    left: -20,
    zIndex: -1,
  },
  message: {
    textAlign: 'center',
    marginBottom: 16,
    fontSize: 16,
    fontWeight: '500',
  },
  splashMessage: {
    fontSize: 18,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  spinnerContainer: {
    marginTop: 16,
  },
  brandName: {
    textAlign: 'center',
    marginTop: 32,
    marginBottom: 8,
    fontSize: 32,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  tagline: {
    textAlign: 'center',
    fontSize: 14,
    opacity: 0.9,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});

// Export different variants for convenience
export const EduDashProSplashLoader = (props: Omit<EduDashProLoaderProps, 'variant'>) => (
  <EduDashProLoader {...props} variant="splash" />
);

export const EduDashProInlineLoader = (props: Omit<EduDashProLoaderProps, 'variant' | 'fullScreen'>) => (
  <EduDashProLoader {...props} variant="inline" fullScreen={false} />
);

export default EduDashProLoader;