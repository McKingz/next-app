/**
 * useOnDeviceVoice Hook
 * 
 * On-device speech recognition using @react-native-voice/voice
 * Perfect for short text input (chat messages, search, etc.)
 * 
 * Benefits:
 * - Fast (no network latency)
 * - Free (no API costs)
 * - Real-time partial results
 * - Works offline
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import Voice, {
  SpeechResultsEvent,
  SpeechErrorEvent,
} from '@react-native-voice/voice';
import * as Haptics from 'expo-haptics';

export interface OnDeviceVoiceOptions {
  language?: string; // e.g., 'en-ZA', 'af-ZA', 'zu-ZA'
  onPartialResult?: (text: string) => void;
  onFinalResult?: (text: string) => void;
  onError?: (error: string) => void;
}

export interface OnDeviceVoiceState {
  isListening: boolean;
  isAvailable: boolean;
  partialText: string;
  finalText: string;
  error: string | null;
}

export function useOnDeviceVoice(options: OnDeviceVoiceOptions = {}) {
  const {
    language = 'en-ZA',
    onPartialResult,
    onFinalResult,
    onError,
  } = options;

  const [state, setState] = useState<OnDeviceVoiceState>({
    isListening: false,
    isAvailable: true,
    partialText: '',
    finalText: '',
    error: null,
  });

  const isListeningRef = useRef(false);

  // Initialize Voice
  useEffect(() => {
    // Check if Voice module is available
    if (!Voice || typeof Voice.isAvailable !== 'function') {
      console.warn('[useOnDeviceVoice] Voice module not available');
      setState(prev => ({ ...prev, isAvailable: false }));
      return;
    }

    try {
      Voice.onSpeechStart = () => {
        console.log('[useOnDeviceVoice] Speech started');
        isListeningRef.current = true;
        setState(prev => ({ 
          ...prev, 
          isListening: true, 
          error: null,
          partialText: '',
          finalText: '' 
        }));
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { /* Intentional: error handled */ });
      };

      Voice.onSpeechEnd = () => {
        console.log('[useOnDeviceVoice] Speech ended');
        isListeningRef.current = false;
        setState(prev => ({ ...prev, isListening: false }));
      };

      Voice.onSpeechResults = (e: SpeechResultsEvent) => {
        console.log('[useOnDeviceVoice] Final results:', e.value);
        if (e.value && e.value.length > 0) {
          const text = e.value[0];
          setState(prev => ({ ...prev, finalText: text, partialText: '' }));
          onFinalResult?.(text);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { /* Intentional: error handled */ });
        }
      };

      Voice.onSpeechPartialResults = (e: SpeechResultsEvent) => {
        console.log('[useOnDeviceVoice] Partial results:', e.value);
        if (e.value && e.value.length > 0) {
          const text = e.value[0];
          setState(prev => ({ ...prev, partialText: text }));
          onPartialResult?.(text);
        }
      };

      Voice.onSpeechError = (e: SpeechErrorEvent) => {
        console.error('[useOnDeviceVoice] Speech error:', e.error);
        const errorMsg = e.error?.message || 'Speech recognition error';
        
        // Ignore "No match" errors (user stopped before saying anything)
        if (errorMsg.includes('No match') || errorMsg.includes('7/No match')) {
          isListeningRef.current = false;
          setState(prev => ({ ...prev, isListening: false }));
          return;
        }

        isListeningRef.current = false;
        setState(prev => ({ 
          ...prev, 
          isListening: false, 
          error: errorMsg 
        }));
        onError?.(errorMsg);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => { /* Intentional: error handled */ });
      };

      // Check if speech recognition is available
      Voice.isAvailable()
        .then((available: number) => {
          setState(prev => ({ ...prev, isAvailable: available === 1 }));
          if (available !== 1) {
            console.warn('[useOnDeviceVoice] Speech recognition not available');
          }
        })
        .catch((e: any) => {
          console.error('[useOnDeviceVoice] Error checking availability:', e);
          setState(prev => ({ ...prev, isAvailable: false }));
        });
    } catch (initError) {
      console.error('[useOnDeviceVoice] Voice initialization error:', initError);
      setState(prev => ({ ...prev, isAvailable: false }));
      return;
    }

    return () => {
      if (Voice && typeof Voice.destroy === 'function') {
        Voice.destroy().then(Voice.removeAllListeners).catch(() => { /* Intentional: error handled */ });
      }
    };
  }, [onPartialResult, onFinalResult, onError]);

  const startListening = useCallback(async () => {
    if (!state.isAvailable) {
      console.error('[useOnDeviceVoice] Voice not available');
      onError?.('Speech recognition not available on this device');
      return;
    }

    if (isListeningRef.current) {
      console.warn('[useOnDeviceVoice] Already listening');
      return;
    }

    try {
      console.log('[useOnDeviceVoice] Starting speech recognition with language:', language);
      
      // Stop any existing recognition
      try {
        await Voice.stop();
      } catch { /* Intentional: non-fatal */ }

      // Start new recognition
      await Voice.start(language);
      console.log('[useOnDeviceVoice] ✅ Speech recognition started');
    } catch (error) {
      console.error('[useOnDeviceVoice] Failed to start:', error);
      const errorMsg = error instanceof Error ? error.message : 'Failed to start speech recognition';
      setState(prev => ({ ...prev, error: errorMsg }));
      onError?.(errorMsg);
    }
  }, [state.isAvailable, language, onError]);

  const stopListening = useCallback(async () => {
    if (!isListeningRef.current) {
      console.warn('[useOnDeviceVoice] Not listening');
      return;
    }

    try {
      console.log('[useOnDeviceVoice] Stopping speech recognition');
      await Voice.stop();
      console.log('[useOnDeviceVoice] ✅ Speech recognition stopped');
    } catch (error) {
      console.error('[useOnDeviceVoice] Failed to stop:', error);
    }
  }, []);

  const cancelListening = useCallback(async () => {
    if (!isListeningRef.current) {
      return;
    }

    try {
      console.log('[useOnDeviceVoice] Canceling speech recognition');
      await Voice.cancel();
      isListeningRef.current = false;
      setState(prev => ({ 
        ...prev, 
        isListening: false, 
        partialText: '', 
        finalText: '' 
      }));
      console.log('[useOnDeviceVoice] ✅ Speech recognition canceled');
    } catch (error) {
      console.error('[useOnDeviceVoice] Failed to cancel:', error);
    }
  }, []);

  const clearResults = useCallback(() => {
    setState(prev => ({ ...prev, partialText: '', finalText: '', error: null }));
  }, []);

  return {
    ...state,
    startListening,
    stopListening,
    cancelListening,
    clearResults,
  };
}
