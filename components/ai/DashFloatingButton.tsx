/**
 * Dash AI Assistant Floating Action Button
 * 
 * A floating button that provides quick access to the Dash AI Assistant
 * from anywhere in the app with animated interactions.
 */

import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  Animated,
  StyleSheet,
  Dimensions,
  Platform,
  Text,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface DashFloatingButtonProps {
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  onPress?: () => void;
  showWelcomeMessage?: boolean;
  style?: any;
}

export const DashFloatingButton: React.FC<DashFloatingButtonProps> = ({
  position = 'bottom-right',
  onPress,
  showWelcomeMessage = false,
  style,
}) => {
  const { theme } = useTheme();
  const [showTooltip, setShowTooltip] = useState(showWelcomeMessage);
  const [isPressed, setIsPressed] = useState(false);
  
  const scaleAnimation = useRef(new Animated.Value(1)).current;
  const pulseAnimation = useRef(new Animated.Value(1)).current;
  const tooltipAnimation = useRef(new Animated.Value(0)).current;
  const rotationAnimation = useRef(new Animated.Value(0)).current;

  // Auto-hide tooltip after 3 seconds
  useEffect(() => {
    if (showTooltip) {
      Animated.timing(tooltipAnimation, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      const timer = setTimeout(() => {
        hideTooltip();
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [showTooltip]);

  // Subtle pulse animation
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnimation, {
          toValue: 1.05,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnimation, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    return () => pulse.stop();
  }, []);

  const hideTooltip = () => {
    Animated.timing(tooltipAnimation, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setShowTooltip(false);
    });
  };

  const handlePressIn = () => {
    setIsPressed(true);
    Animated.parallel([
      Animated.timing(scaleAnimation, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(rotationAnimation, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePressOut = () => {
    setIsPressed(false);
    Animated.parallel([
      Animated.timing(scaleAnimation, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(rotationAnimation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePress = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      if (showTooltip) {
        hideTooltip();
      }

      if (onPress) {
        onPress();
      } else {
        // Navigate to Dash Assistant screen
        router.push('/screens/dash-assistant');
      }
    } catch (error) {
      console.error('Failed to open Dash Assistant:', error);
    }
  };

  const getPositionStyle = () => {
    const margin = 20;
    const safeAreaBottom = Platform.OS === 'ios' ? 34 : 0;
    
    switch (position) {
      case 'bottom-right':
        return {
          position: 'absolute',
          bottom: margin + safeAreaBottom,
          right: margin,
        };
      case 'bottom-left':
        return {
          position: 'absolute',
          bottom: margin + safeAreaBottom,
          left: margin,
        };
      case 'top-right':
        return {
          position: 'absolute',
          top: Platform.OS === 'ios' ? 60 : 20,
          right: margin,
        };
      case 'top-left':
        return {
          position: 'absolute',
          top: Platform.OS === 'ios' ? 60 : 20,
          left: margin,
        };
      default:
        return {
          position: 'absolute',
          bottom: margin + safeAreaBottom,
          right: margin,
        };
    }
  };

  const rotation = rotationAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '15deg'],
  });

  return (
    <View style={[getPositionStyle(), style]}>
      {/* Tooltip */}
      {showTooltip && (
        <Animated.View
          style={[
            styles.tooltip,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.border,
              opacity: tooltipAnimation,
              transform: [{ scale: tooltipAnimation }],
            },
            position.includes('right') ? styles.tooltipRight : styles.tooltipLeft,
          ]}
          pointerEvents="none"
        >
          <Text style={[styles.tooltipText, { color: theme.text }]}>
            Hi! I'm Dash, your AI assistant
          </Text>
          <Text style={[styles.tooltipSubtext, { color: theme.textSecondary }]}>
            Tap to chat with me!
          </Text>
        </Animated.View>
      )}

      {/* Main Button */}
      <Animated.View
        style={[
          styles.buttonContainer,
          {
            transform: [
              { scale: Animated.multiply(scaleAnimation, pulseAnimation) },
              { rotate: rotation },
            ],
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.button,
            {
              backgroundColor: theme.primary,
              shadowColor: theme.shadow,
              elevation: isPressed ? 4 : 8,
            },
          ]}
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={0.8}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          {/* Sparkle icon with gradient effect */}
          <View style={styles.iconContainer}>
            <Ionicons
              name="sparkles"
              size={28}
              color={theme.onPrimary}
            />
            
            {/* Animated glow effect */}
            <Animated.View
              style={[
                styles.glowEffect,
                {
                  backgroundColor: theme.primaryLight,
                  opacity: pulseAnimation.interpolate({
                    inputRange: [1, 1.05],
                    outputRange: [0, 0.3],
                  }),
                },
              ]}
            />
          </View>
        </TouchableOpacity>
      </Animated.View>

      {/* Ripple effect overlay */}
      {isPressed && (
        <Animated.View
          style={[
            styles.rippleEffect,
            {
              backgroundColor: theme.primaryLight,
              opacity: scaleAnimation.interpolate({
                inputRange: [0.95, 1],
                outputRange: [0.3, 0],
              }),
            },
          ]}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  buttonContainer: {
    position: 'relative',
  },
  button: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  iconContainer: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  glowEffect: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    zIndex: -1,
  },
  rippleEffect: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    top: -8,
    left: -8,
    zIndex: -1,
  },
  tooltip: {
    position: 'absolute',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 200,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  tooltipRight: {
    bottom: 70,
    right: 0,
  },
  tooltipLeft: {
    bottom: 70,
    left: 0,
  },
  tooltipText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  tooltipSubtext: {
    fontSize: 12,
  },
});

export default DashFloatingButton;