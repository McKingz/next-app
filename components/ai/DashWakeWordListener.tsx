import React, { useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

/**
 * DashWakeWordListener
 *
 * Foreground-only wake-word listener (in-app) with graceful fallback when
 * native wake-word packages are not installed. When enabled and the app is
 * active, it listens for a wake phrase (e.g., "Hello Dash") and navigates to
 * the Dash Assistant screen.
 *
 * Notes:
 * - Background wake word is NOT supported here. This only runs in-app.
 * - Implementation attempts to load '@picovoice/porcupine-react-native' if available.
 *   If not installed, it silently disables listening and logs a message.
 */
export default function DashWakeWordListener() {
  const [enabled, setEnabled] = useState<boolean>(false);
  const appStateRef = useRef<string>('active');

  // Porcupine refs (if available)
  const porcupineRef = useRef<any>(null);
  const audioEngineRef = useRef<any>(null);
  const isListeningRef = useRef<boolean>(false);

  useEffect(() => {
    let mounted = true;

    const loadToggle = async () => {
      try {
        const value = await AsyncStorage.getItem('@dash_ai_in_app_wake_word');
        if (mounted) setEnabled(value === 'true');
      } catch { /* Intentional: non-fatal */ }
    };

    loadToggle();

    const sub = AppState.addEventListener('change', async (next) => {
      appStateRef.current = next;
      if (next === 'active') {
        await loadToggle();
        if (enabled) startListening().catch(() => { /* Intentional: error handled */ });
      } else {
        stopListening().catch(() => { /* Intentional: error handled */ });
      }
    });

    // Start if already active and enabled
    if (appStateRef.current === 'active' && enabled) {
      startListening().catch(() => { /* Intentional: error handled */ });
    }

    return () => {
      mounted = false;
      sub.remove();
      stopListening().catch(() => { /* Intentional: error handled */ });
      release().catch(() => { /* Intentional: error handled */ });
    };
     
  }, []);

  useEffect(() => {
    // React to settings changes
    if (appStateRef.current === 'active') {
      if (enabled) startListening().catch(() => { /* Intentional: error handled */ });
      else stopListening().catch(() => { /* Intentional: error handled */ });
    }
  }, [enabled]);

  const ensurePorcupine = async (): Promise<boolean> => {
    if (Platform.OS === 'web') return false;
    if (porcupineRef.current) return true;

    try {
      // Dynamic import to avoid hard dependency when module isn't installed
       
      const Porcupine = require('@picovoice/porcupine-react-native');
      const accessKey = process.env.EXPO_PUBLIC_PICOVOICE_ACCESS_KEY || '';

      if (!accessKey) {
        console.debug('[DashWakeWord] No Picovoice access key provided; wake word disabled');
        return false;
      }

      // Initialize with a generic built-in keyword as a placeholder. Replace with a
      // custom trained phrase for best accuracy (e.g., "Hello Dash").
      porcupineRef.current = await Porcupine.create(accessKey, [{ builtin: 'Porcupine', sensitivity: 0.65 }]);

      // Minimal audio engine from the same lib (implementation may vary per SDK version)
      audioEngineRef.current = await Porcupine.createAudioEngine();
      await audioEngineRef.current.start();

      console.log('[DashWakeWord] Porcupine initialized');
      return true;
    } catch (e) {
      console.debug('[DashWakeWord] Wake word engine not available or failed to init:', e);
      return false;
    }
  };

  const startListening = async () => {
    if (isListeningRef.current) return;
    if (!enabled) return;

    const ok = await ensurePorcupine();
    if (!ok) return;

    try {
      const Porcupine = require('@picovoice/porcupine-react-native');
      await Porcupine.start();
      Porcupine.setDetectionCallback(async () => {
        try {
          // Navigate to Dash Assistant when wake word is detected
          router.push('/screens/dash-assistant');
        } catch { /* Intentional: non-fatal */ }
      });
      isListeningRef.current = true;
      console.log('[DashWakeWord] Listening (in app)');
    } catch (e) {
      console.debug('[DashWakeWord] Failed to start listening:', e);
    }
  };

  const stopListening = async () => {
    if (!isListeningRef.current) return;
    try {
      const Porcupine = require('@picovoice/porcupine-react-native');
      await Porcupine.stop();
      isListeningRef.current = false;
      console.log('[DashWakeWord] Stopped listening');
    } catch { /* Intentional: non-fatal */ }
  };

  const release = async () => {
    try {
      if (audioEngineRef.current?.stop) await audioEngineRef.current.stop();
      if (porcupineRef.current?.release) await porcupineRef.current.release();
    } catch { /* Intentional: non-fatal */ }
  };

  return null; // Invisible background helper
}