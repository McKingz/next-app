import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

/**
 * useFABAnimations
 * - Provides scale and pulse animations and voice recording pulsing
 */
export function useFABAnimations(recording: boolean) {
  const scaleAnimation = useRef(new Animated.Value(1)).current;
  const pulseAnimation = useRef(new Animated.Value(1)).current;
  const voiceAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnimation, { toValue: 1.12, duration: 1800, useNativeDriver: true }),
        Animated.timing(pulseAnimation, { toValue: 1, duration: 1800, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  useEffect(() => {
    if (recording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(voiceAnimation, { toValue: 1, duration: 800, useNativeDriver: true }),
          Animated.timing(voiceAnimation, { toValue: 0, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    } else {
      voiceAnimation.setValue(0);
    }
  }, [recording]);

  return { scaleAnimation, pulseAnimation, voiceAnimation };
}
