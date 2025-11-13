import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import type { VoiceController } from '@/hooks/useVoiceController';
import AsyncStorage from '@react-native-async-storage/async-storage';

function msToClock(ms: number) {
  const s = Math.floor(ms / 1000);
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export function VoiceDock({ vc }: { vc: VoiceController }) {
  const { theme } = useTheme();
  const isListening = vc.state === 'listening';
  const isThinking = vc.state === 'thinking' || vc.state === 'transcribing' || vc.state === 'prewarm';
  const isSpeaking = vc.state === 'speaking';

  // Hint shown once
  const [showHint, setShowHint] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem('@voice_hint_shown');
        if (!stored) {
          setShowHint(true);
          await AsyncStorage.setItem('@voice_hint_shown', '1');
        }
      } catch { /* Intentional: non-fatal */ }
    })();
  }, []);

  // Simple animated waveform when listening
  const bars = useMemo(() => new Array(5).fill(0).map(() => new Animated.Value(0.3)), []);
  useEffect(() => {
    if (isListening) {
      const anims = bars.map((v, i) => Animated.loop(Animated.sequence([
        Animated.delay(i * 120),
        Animated.timing(v, { toValue: 1, duration: 350, useNativeDriver: false }),
        Animated.timing(v, { toValue: 0.3, duration: 350, useNativeDriver: false }),
      ])));
      Animated.parallel(anims).start();
      return () => { bars.forEach(v => v.stopAnimation()); };
    } else {
      bars.forEach(v => { v.stopAnimation(); v.setValue(0.3); });
    }
  }, [isListening, bars]);

  return (
    <View>
      <View style={[styles.container, { backgroundColor: theme.surface, borderColor: theme.border }]}> 
        <View style={styles.left}>
          {isListening ? (
            <TouchableOpacity style={[styles.round, { backgroundColor: theme.error }]}
              onPress={vc.release}
              onLongPress={vc.lock}
              accessibilityLabel="Stop listening">
              <Ionicons name="stop" size={18} color={theme.onError || '#fff'} />
            </TouchableOpacity>
          ) : isSpeaking ? (
            <TouchableOpacity style={[styles.round, { backgroundColor: theme.error }]} onPress={vc.interrupt} accessibilityLabel="Stop speaking">
              <Ionicons name="stop" size={18} color={theme.onError || '#fff'} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.round, { backgroundColor: theme.accent }]}
              onPressIn={vc.startPress}
              onLongPress={vc.lock}
              onPressOut={async () => { if (vc.state === 'listening' && !vc.isLocked) { await vc.release(); } }}
              accessibilityLabel="Hold to talk. Release to send. Long‑press to lock.">
              <Ionicons name="mic" size={18} color={theme.onAccent} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.center}>
          {isListening && (
            <>
              <Text style={[styles.label, { color: theme.text }]}>{vc.isLocked ? 'Listening (locked)…' : 'Listening…'} <Text style={{ color: theme.textSecondary }}>{msToClock(vc.timerMs)}</Text></Text>
              <View style={{ flexDirection: 'row', gap: 3, marginTop: 6 }}>
                {bars.map((v, i) => (
                  <Animated.View key={i} style={{ width: 4, height: 12, borderRadius: 2, backgroundColor: theme.primary, opacity: v, transform: [{ scaleY: v.interpolate({ inputRange: [0.3, 1], outputRange: [0.8, 1.6] }) }] }} />
                ))}
              </View>
            </>
          )}
          {isThinking && (
            <View style={styles.row}> 
              <ActivityIndicator size="small" color={theme.primary} />
              <Text style={[styles.label, { marginLeft: 8, color: theme.text }]}>Thinking…</Text>
            </View>
          )}
          {isSpeaking && (
            <Text style={[styles.label, { color: theme.text }]}>Speaking…</Text>
          )}
          {!isListening && !isThinking && !isSpeaking && (
            <Text style={[styles.label, { color: theme.textSecondary }]}>Tap to talk. Tap again to stop. Long‑press to lock.</Text>
          )}
        </View>

        <View style={styles.right}>
          {isListening ? (
            <TouchableOpacity style={[styles.pill, { borderColor: theme.border }]} onPress={vc.cancel} accessibilityLabel="Cancel">
              <Text style={{ color: theme.text }}>Cancel</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
      {showHint && !isListening && !isThinking && !isSpeaking && (
        <View style={{ alignItems: 'center', marginTop: 4 }}>
          <View style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: theme.surfaceVariant }}>
            <Text style={{ color: theme.text, fontSize: 11 }}>Tip: Long‑press the mic to lock hands‑free</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  left: { width: 40 },
  center: { flex: 1, alignItems: 'center' },
  right: { width: 80, alignItems: 'flex-end' },
  round: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 12, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center' },
  pill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth },
});
