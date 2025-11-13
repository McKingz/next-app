/**
 * DashSpeakingOverlay Component
 * 
 * Shows a floating banner when Dash is speaking that:
 * - Allows user to stop Dash mid-speech
 * - Doesn't block screen interaction
 * - Visible across all screens
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { audioManager } from '@/lib/voice/audio';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface DashSpeakingOverlayProps {
  isSpeaking: boolean;
  onStopSpeaking?: () => void;
}

export function DashSpeakingOverlay({ isSpeaking, onStopSpeaking }: DashSpeakingOverlayProps) {
  const { theme } = useTheme();
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isSpeaking) {
      // Slide down
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }).start();

      // Pulse animation for speaker icon
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      // Slide up
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }).start();
      pulseAnim.setValue(1);
    }
  }, [isSpeaking]);

  const handleStop = async () => {
    try {
      console.log('[DashSpeakingOverlay] 🛑 Stop button pressed - immediate stop');
      
      // Execute all stop operations in parallel for immediate effect
      const stopPromises = [
        audioManager.stop().catch(e => console.warn('[DashSpeakingOverlay] Audio manager stop warning:', e))
      ];
      
      // Also stop via Dash AI Assistant
      try {
        const module = await import('@/services/dash-ai/DashAICompat');
        const DashClass = (module as any).DashAIAssistant || (module as any).default;
        const dash = DashClass?.getInstance?.();
        if (dash?.stopSpeaking) { await dash.stopSpeaking(); }
      } catch { /* Intentional: non-fatal */ }
      
      // Wait for all stop operations with timeout
      await Promise.race([
        Promise.all(stopPromises),
        new Promise(resolve => setTimeout(resolve, 500))
      ]);
      
      console.log('[DashSpeakingOverlay] ✅ All audio stopped');
      onStopSpeaking?.();
    } catch (error) {
      console.error('[DashSpeakingOverlay] Failed to stop speaking:', error);
      // Still call callback even if stop failed
      onStopSpeaking?.();
    }
  };

  if (!isSpeaking) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: theme.surface || '#1C1C1E',
          transform: [{ translateY: slideAnim }],
        },
      ]}
      pointerEvents="box-none" // Allow touches to pass through except for the banner itself
    >
      <View style={[styles.banner, { backgroundColor: theme.primary || '#007AFF' }]}>
        <View style={styles.leftContent}>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <Ionicons name="volume-high" size={24} color="#FFF" />
          </Animated.View>
          <Text style={styles.text}>Dash is speaking...</Text>
        </View>
        
        <TouchableOpacity
          style={[styles.stopButton, { backgroundColor: 'rgba(255,255,255,0.2)' }]}
          onPress={handleStop}
          activeOpacity={0.7}
        >
          <Ionicons name="stop-circle" size={20} color="#FFF" />
          <Text style={styles.stopText}>Stop</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 998, // Just below FAB (999)
    paddingTop: Platform.OS === 'ios' ? 50 : 10,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  text: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  stopText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
