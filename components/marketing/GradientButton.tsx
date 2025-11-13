import React from 'react';
import { Text, Pressable, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { marketingTokens } from './tokens';

interface GradientButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'indigo';
  size?: 'sm' | 'md' | 'lg';
  style?: ViewStyle;
  textStyle?: TextStyle;
  accessibilityLabel?: string;
  testID?: string;
}

/**
 * Gradient button with scale press animation
 * Uses LinearGradient for modern aesthetic
 */

export function GradientButton({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  style,
  textStyle,
  accessibilityLabel,
  testID,
}: GradientButtonProps) {
  const scale = useSharedValue(1);
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withTiming(scale.value, { duration: 120 }) }],
  }));
  
  const gradientColors = variant === 'primary' 
    ? marketingTokens.gradients.primary 
    : marketingTokens.gradients.indigo;
  
  const sizeStyles = {
    sm: { paddingHorizontal: 16, paddingVertical: 10, fontSize: 14 },
    md: { paddingHorizontal: 24, paddingVertical: 14, fontSize: 16 },
    lg: { paddingHorizontal: 32, paddingVertical: 16, fontSize: 18 },
  }[size];
  
  return (
    <Animated.View style={[styles.container, animatedStyle, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => { scale.value = 0.98; }}
        onPressOut={() => { scale.value = 1; }}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || label}
        testID={testID}
        style={styles.pressable}
      >
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[
            styles.gradient,
            { 
              paddingHorizontal: sizeStyles.paddingHorizontal,
              paddingVertical: sizeStyles.paddingVertical,
            },
          ]}
        >
          <Text style={[styles.text, { fontSize: sizeStyles.fontSize }, textStyle]}>
            {label}
          </Text>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: marketingTokens.radii.full,
    overflow: 'hidden',
    // Minimum touch target
    minHeight: 44,
    minWidth: 44,
  },
  pressable: {
    width: '100%',
  },
  gradient: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: marketingTokens.colors.fg.inverse,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
