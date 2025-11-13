import { useCallback, useEffect, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import type { DashAIAssistant, DashMessage } from '@/services/dash-ai/DashAICompat';
import { useRealtimeVoice } from './useRealtimeVoice';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';

export type VoiceState = 'idle' | 'prewarm' | 'listening' | 'transcribing' | 'thinking' | 'speaking' | 'error';

export interface VoiceController {
  state: VoiceState;
  isLocked: boolean;
  timerMs: number;
  startPress: () => Promise<void>;
  release: () => Promise<void>;
  lock: () => void;
  cancel: () => Promise<void>;
  interrupt: () => Promise<void>;
}

interface Options {
  onResponse?: (message: DashMessage) => void;
  autoSilenceMs?: number;
  maxListenMs?: number;
}

export function useVoiceController(dash: DashAIAssistant | null, opts: Options = {}): VoiceController {
  const { onResponse } = opts;
  const [prefAutoSilence, setPrefAutoSilence] = useState<number>(7000);
  const [prefListenCap, setPrefListenCap] = useState<number>(15000);
  const [prefDefaultLocked, setPrefDefaultLocked] = useState<boolean>(false);
  const [streamingEnabled, setStreamingEnabled] = useState(false);
  const [state, setState] = useState<VoiceState>('idle');
  const [isLocked, setLocked] = useState(false);
  const [timerMs, setTimerMs] = useState(0);
  const listenTimerRef = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);
  const streamTranscriptRef = useRef<string>('');
  const streamCompleteRef = useRef<boolean>(false);

  const clearTimers = () => {
    if (listenTimerRef.current) { clearTimeout(listenTimerRef.current as unknown as number); listenTimerRef.current = null; }
    if (tickRef.current) { clearInterval(tickRef.current as unknown as number); tickRef.current = null; }
  };

  // Check if streaming is enabled from env or preferences
  useEffect(() => {
    (async () => {
      try {
        const envEnabled = String(process.env.EXPO_PUBLIC_DASH_STREAMING || '').toLowerCase() === 'true';
        const prefValue = await AsyncStorage.getItem('@dash_streaming_enabled');
        setStreamingEnabled(envEnabled || prefValue === 'true');
      } catch {
        setStreamingEnabled(false);
      }
    })();
  }, []);

  const { i18n } = useTranslation();
  const mapLang = (l?: string) => {
    const base = String(l || '').toLowerCase();
    if (base.startsWith('af')) return 'af';
    if (base.startsWith('zu')) return 'zu';
    if (base.startsWith('xh')) return 'xh';
    if (base.startsWith('nso') || base.startsWith('st') || base.startsWith('so')) return 'nso';
    if (base.startsWith('en')) return 'en';
    return 'en';
  };
  const activeLang = mapLang(i18n?.language);

  // Initialize real-time voice streaming
  const realtimeVoice = useRealtimeVoice({
    enabled: streamingEnabled,
    language: activeLang,
    onPartialTranscript: (text) => {
      streamTranscriptRef.current = text || '';
      console.log('[VoiceController] Streaming partial:', text);
    },
    onFinalTranscript: (text) => {
      streamTranscriptRef.current = text || '';
      streamCompleteRef.current = true;
      console.log('[VoiceController] Streaming final:', text);
    },
    onAssistantToken: (token) => {
      // Handle assistant responses if needed in the future
      console.log('[VoiceController] Assistant token:', token);
    },
    onStatusChange: (status) => {
      console.log('[VoiceController] Stream status:', status);
      if (status === 'error' && state === 'listening') {
        console.warn('[VoiceController] Streaming failed, will fallback to batch');
      }
    },
  });

  // Load voice prefs (async storage) once
  useEffect(() => {
    (async () => {
      try {
        const [a, b, c] = await Promise.all([
          AsyncStorage.getItem('@voice_auto_silence_ms'),
          AsyncStorage.getItem('@voice_listen_cap_ms'),
          AsyncStorage.getItem('@voice_default_lock'),
        ]);
        if (a && !Number.isNaN(Number(a))) setPrefAutoSilence(Math.max(2000, Number(a)));
        if (b && !Number.isNaN(Number(b))) setPrefListenCap(Math.max(5000, Number(b)));
        if (c !== null) setPrefDefaultLocked(c === 'true');
      } catch { /* Intentional: non-fatal */ }
    })();
  }, []);

  const startTick = () => {
    setTimerMs(0);
    tickRef.current = (setInterval(() => {
      setTimerMs((t) => t + 250);
    }, 250) as unknown) as number;
  };

  const startAutoSilence = () => {
    clearTimeout(listenTimerRef.current as unknown as number);
    listenTimerRef.current = (setTimeout(async () => {
      if (!isLocked) {
        await release();
      }
    }, prefAutoSilence) as unknown) as number;
  };

  const startPress = useCallback(async () => {
    try {
      if (!dash) return;
      if (state === 'listening' || state === 'transcribing' || state === 'thinking') {
        // Already engaged in recording or processing; ignore start
        return;
      }
      if (state === 'speaking') {
        try { await dash.stopSpeaking(); } catch { /* Intentional: non-fatal */ }
      }
      
      // Log language but allow all - OpenAI Realtime will handle what it can
      console.log('[VoiceController] 🌍 Starting recording for language:', activeLang);
      
      // Reset streaming state
      streamTranscriptRef.current = '';
      streamCompleteRef.current = false;
      
      setLocked(false);
      setState('prewarm');
      try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch { /* Intentional: non-fatal */ }
      
      // Start streaming if enabled (local file recording removed)
      let started = false;
      console.log('[VoiceController] 🎬 Attempting to start voice recording...');
      console.log('[VoiceController] 📊 Config - streamingEnabled:', streamingEnabled, 'realtimeVoice.enabled:', realtimeVoice.enabled, 'language:', activeLang);
      
      if (streamingEnabled && realtimeVoice.enabled) {
        console.log('[VoiceController] 🚀 Starting streaming transcription via realtimeVoice.startStream()...');
        started = await realtimeVoice.startStream();
        console.log('[VoiceController] 📋 Stream start result:', started);
        if (!started) {
          console.error('[VoiceController] ❌ Streaming failed to start; local file recording has been removed');
        }
      } else {
        console.error('[VoiceController] ⚠️ Cannot start: streaming not enabled or realtimeVoice not ready');
        console.error('[VoiceController] Debug: streamingEnabled=', streamingEnabled, ', realtimeVoice.enabled=', realtimeVoice.enabled);
      }
      
      if (!started) {
        console.error('[VoiceController] ❌ Recording failed to start, setting error state');
        console.error('[VoiceController] Debug info - streamingEnabled:', streamingEnabled, 'realtimeVoice.enabled:', realtimeVoice.enabled);
        setState('error');
        return;
      }
      console.log('[VoiceController] ✅ Voice recording started successfully, transitioning to listening state');

      setState('listening');
      startTick();
      if (prefDefaultLocked) {
        // honor default lock: set locked and start cap timer
        setLocked(true);
        clearTimeout(listenTimerRef.current as unknown as number);
        listenTimerRef.current = (setTimeout(async () => { await release(); }, prefListenCap) as unknown) as number;
      } else {
        startAutoSilence();
      }
    } catch (err) {
      console.error('[VoiceController] Start error:', err);
      setState('error');
    }
  }, [dash, state, streamingEnabled, realtimeVoice]);

  const lock = useCallback(() => {
    setLocked(true);
    try { Haptics.selectionAsync(); } catch { /* Intentional: non-fatal */ }
    clearTimeout(listenTimerRef.current as unknown as number);
    listenTimerRef.current = (setTimeout(async () => {
      // Defer calling release via event loop to avoid closure order issues
      try { await release(); } catch { /* Intentional: non-fatal */ }
    }, prefListenCap) as unknown) as number;
  }, [prefListenCap]);

  const release = useCallback(async () => {
    try {
      if (!dash) return;
      if (state !== 'listening' && state !== 'prewarm') return;
      clearTimers();

      // Local file recording removed: skip waiting for expo-av recorder

      setState('transcribing');
      
      // Handle stream stop
      const currentStatus = realtimeVoice.statusRef.current;
      console.log('[VoiceController] 🔍 Checking stream status before stopping. Current:', currentStatus);

      // If user released while still connecting, cancel gracefully instead of erroring
      if (streamingEnabled && currentStatus === 'connecting') {
        console.warn('[VoiceController] ⚠️ Release while connecting — cancelling instead of transcribing');
        try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); } catch { /* Intentional: non-fatal */ }
        try { await realtimeVoice.cancel(); } catch { /* Intentional: non-fatal */ }
        setState('idle');
        return;
      }

      // If already streaming, stop and wait briefly for final transcript
      if (streamingEnabled && currentStatus === 'streaming') {
        console.log('[VoiceController] Stopping streaming transcription...');
        await realtimeVoice.stopStream();
        
        console.log('[VoiceController] ⏳ Waiting for final transcript...');
        const maxWait = 5000;
        const checkInterval = 100;
        let waited = 0;
        while (waited < maxWait && !streamCompleteRef.current && streamTranscriptRef.current.trim().length === 0) {
          await new Promise(resolve => setTimeout(resolve, checkInterval));
          waited += checkInterval;
        }
        console.log('[VoiceController] Waited', waited, 'ms for transcript. Complete:', streamCompleteRef.current, 'Length:', streamTranscriptRef.current.length);
      }
      
      let transcript = '';
      let duration = 0;
      
      if (streamingEnabled) {
        if (streamTranscriptRef.current && streamTranscriptRef.current.trim().length > 0) {
          console.log('[VoiceController] ✅ Using streaming transcript:', streamTranscriptRef.current);
          transcript = streamTranscriptRef.current;
          duration = Math.floor(timerMs / 1000);
        } else {
          console.error('[VoiceController] ❌ No streaming transcript available after waiting');
          setState('error');
          try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch { /* Intentional: non-fatal */ }
          return;
        }
      } else {
        // Non-streaming path no longer supported
        console.warn('[VoiceController] Non-streaming voice note is disabled (expo-av removed)');
        setState('error');
        try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch { /* Intentional: non-fatal */ }
        return;
      }
      
      // Generate AI response (no local audio URI available in streaming mode)
      setState('thinking');
      const response = await dash.sendMessage(transcript);
      onResponse?.(response);
      setState('idle');
      try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch { /* Intentional: non-fatal */ }
    } catch (err) {
      console.error('[VoiceController] Release error:', err);
      setState('error');
    } finally {
      // Cleanup streaming
      if (streamingEnabled && realtimeVoice.statusRef.current !== 'disconnected') {
        try { await realtimeVoice.cancel(); } catch { /* Intentional: non-fatal */ }
      }
      clearTimers();
      setLocked(false);
      setTimerMs(0);
      streamTranscriptRef.current = '';
      streamCompleteRef.current = false;
    }
  }, [dash, onResponse, state, streamingEnabled, realtimeVoice, timerMs]);

  const cancel = useCallback(async () => {
    try {
      if (!dash) return;
      
      // Cancel streaming if active
      if (streamingEnabled && realtimeVoice.statusRef.current !== 'disconnected') {
        try { await realtimeVoice.cancel(); } catch { /* Intentional: non-fatal */ }
      }
      
      // Local recording disabled: do not call dash.stopRecording()
      if (state === 'speaking') {
        try { await dash.stopSpeaking(); } catch { /* Intentional: non-fatal */ }
      }
    } finally {
      clearTimers();
      setLocked(false);
      setTimerMs(0);
      setState('idle');
      streamTranscriptRef.current = '';
      streamCompleteRef.current = false;
    }
  }, [dash, state, streamingEnabled, realtimeVoice]);

  const interrupt = useCallback(async () => {
    try { if (dash) await dash.stopSpeaking(); } catch { /* Intentional: non-fatal */ }
    try { await Haptics.selectionAsync(); } catch { /* Intentional: non-fatal */ }
    setState('idle');
  }, [dash]);

  useEffect(() => () => { clearTimers(); }, []);

  return { state, isLocked, timerMs, startPress, release, lock, cancel, interrupt };
}
