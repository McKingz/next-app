import { useCallback, useRef, useState } from 'react';
import { Animated, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useVoiceUI } from '@/components/voice/VoiceUIController';

/**
 * useFABVoiceActivation
 * - Handles tap vs long-press logic, permissions, and opening voice UI
 */
export function useFABVoiceActivation(options?: { onLongPressStart?: () => void; onLongPressEnd?: () => void }) {
  const voiceUI = useVoiceUI();
  const [isLoading, setIsLoading] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressActivated = useRef(false);

  // Sound disabled stub
  const playClickSound = async (_: 'awaken' | 'pulse' = 'awaken') => {};

  const handleSingleTap = useCallback(async () => {
    try {
      setIsLoading(true);
      playClickSound();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      router.push('/screens/dash-assistant');
      setTimeout(() => setIsLoading(false), 500);
    } catch (e) {
      setIsLoading(false);
    }
  }, []);

  const ensureMicPermissionAndroid = useCallback(async () => {
    if (Platform.OS !== 'android') return true;
    try {
      const { PermissionsAndroid } = await import('react-native');
      const perm = PermissionsAndroid.PERMISSIONS.RECORD_AUDIO;
      const already = await PermissionsAndroid.check(perm as any);
      if (already) return true;
      const status = await PermissionsAndroid.request(perm as any);
      return status === PermissionsAndroid.RESULTS.GRANTED;
    } catch {
      return false;
    }
  }, []);

  const handleLongPress = useCallback(async () => {
    options?.onLongPressStart?.();
    try {
      setIsLoading(true);
      playClickSound('pulse');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      const ok = await ensureMicPermissionAndroid();
      if (!ok) {
        setIsLoading(false);
        return;
      }

      // Detect preferred language
      let detectedLang = 'en';
      try {
        const storedLang = await AsyncStorage.getItem('@dash_voice_language');
        if (storedLang) detectedLang = storedLang.toLowerCase();
      } catch {}

      await voiceUI.open({ language: detectedLang, forceMode: 'streaming' });
      setIsLoading(false);
    } catch {
      setIsLoading(false);
    } finally {
      options?.onLongPressEnd?.();
    }
  }, [ensureMicPermissionAndroid, voiceUI]);

  const handlePressIn = useCallback((scaleAnimation: Animated.Value) => {
    playClickSound();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    longPressActivated.current = false;
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => {
      longPressActivated.current = true;
      handleLongPress();
    }, 450);
    Animated.spring(scaleAnimation, { toValue: 0.9, useNativeDriver: true }).start();
  }, [handleLongPress]);

  const handlePressOut = useCallback((scaleAnimation: Animated.Value) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    longPressActivated.current = false;
    Animated.spring(scaleAnimation, { toValue: 1, friction: 3, tension: 40, useNativeDriver: true }).start();
  }, []);

  return { isLoading, longPressActivated, handleSingleTap, handleLongPress, handlePressIn, handlePressOut };
}
