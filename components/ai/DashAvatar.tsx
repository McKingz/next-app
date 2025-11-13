/**
 * Dash Avatar Component
 * 
 * AI assistant avatar for EduDash Pro using the brand logo
 * Supports different sizes, animated states, and optional glow effect
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { BrandGradients, BrandColors } from '@/components/branding';

export type DashAvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type DashAvatarStatus = 'idle' | 'thinking' | 'speaking' | 'listening';

interface DashAvatarProps {
  /**
   * Size of the avatar
   * - xs: 24px
   * - sm: 32px
   * - md: 48px (default)
   * - lg: 64px
   * - xl: 96px
   */
  size?: DashAvatarSize;
  
  /**
   * Current status of the AI assistant
   */
  status?: DashAvatarStatus;
  
  /**
   * Show animated pulse effect
   */
  animated?: boolean;
  
  /**
   * Show gradient glow around avatar
   */
  showGlow?: boolean;
  
  /**
   * Custom style for container
   */
  style?: any;
}

const SIZE_MAP = {
  xs: 24,
  sm: 32,
  md: 48,
  lg: 64,
  xl: 96,
};

/**
 * Dash AI Assistant Avatar
 * 
 * A branded avatar for the Dash AI assistant that uses the EduDash Pro logo
 * with optional animations and status indicators.
 * 
 * @example
 * ```tsx
 * // Basic avatar
 * <DashAvatar size="md" />
 * 
 * // Thinking state with animation
 * <DashAvatar size="lg" status="thinking" animated />
 * 
 * // With glow effect
 * <DashAvatar size="xl" showGlow animated />
 * ```
 */
export const DashAvatar: React.FC<DashAvatarProps> = ({
  size = 'md',
  status = 'idle',
  animated = false,
  showGlow = false,
  style,
}) => {
  const avatarSize = SIZE_MAP[size];
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    if (!animated) return;
    
    // Pulse animation
    if (status === 'thinking' || status === 'speaking') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
    
    // Rotation animation for listening
    if (status === 'listening') {
      Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 3000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    }
    
    // Glow animation
    if (showGlow) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 2000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 2000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
    
    return () => {
      pulseAnim.stopAnimation();
      rotateAnim.stopAnimation();
      glowAnim.stopAnimation();
    };
  }, [animated, status, showGlow, pulseAnim, rotateAnim, glowAnim]);
  
  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  
  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });
  
  const glowScale = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.2],
  });
  
  // Status-based border color
  const getBorderColor = () => {
    switch (status) {
      case 'thinking':
        return BrandColors.purple;
      case 'speaking':
        return BrandColors.turquoise;
      case 'listening':
        return BrandColors.blue;
      default:
        return 'transparent';
    }
  };
  
  return (
    <View style={[styles.container, style]}>
      {/* Animated glow effect */}
      {showGlow && (
        <Animated.View
          style={[
            styles.glowContainer,
            {
              width: avatarSize + 20,
              height: avatarSize + 20,
              borderRadius: (avatarSize + 20) / 2,
              opacity: glowOpacity,
              transform: [{ scale: glowScale }],
            },
          ]}
        >
          <LinearGradient
            colors={BrandGradients.primary}
            style={[
              styles.glowGradient,
              {
                width: avatarSize + 20,
                height: avatarSize + 20,
                borderRadius: (avatarSize + 20) / 2,
              },
            ]}
          />
        </Animated.View>
      )}
      
      {/* Main avatar */}
      <Animated.View
        style={[
          styles.avatarContainer,
          {
            width: avatarSize,
            height: avatarSize,
            borderRadius: avatarSize / 2,
            borderColor: getBorderColor(),
            borderWidth: status !== 'idle' ? 2 : 0,
            transform: [
              { scale: pulseAnim },
              { rotate },
            ],
          },
        ]}
      >
        <Image
          source={require('@/assets/branding/png/icon-512.png')}
          style={{
            width: avatarSize - 4,
            height: avatarSize - 4,
            borderRadius: (avatarSize - 4) / 2,
          }}
          contentFit="contain"
          transition={200}
        />
      </Animated.View>
      
      {/* Status indicator dot */}
      {status !== 'idle' && (
        <View
          style={[
            styles.statusDot,
            {
              backgroundColor: getBorderColor(),
              bottom: size === 'xs' ? -2 : size === 'sm' ? -2 : 0,
              right: size === 'xs' ? -2 : size === 'sm' ? -2 : 0,
            },
          ]}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowContainer: {
    position: 'absolute',
    top: -10,
    left: -10,
    zIndex: -1,
  },
  glowGradient: {
    opacity: 0.3,
  },
  avatarContainer: {
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  statusDot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
});

export default DashAvatar;
