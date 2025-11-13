/**
 * React Native Voice Provider - On-Device Speech Recognition
 * 
 * Uses @react-native-voice/voice for fast, private, free on-device speech recognition.
 * Perfect for single-use voice input (mic button in chat).
 * 
 * Features:
 * - On-device processing (no cloud, no API costs)
 * - Works offline
 * - Fast and private
 * - Native iOS/Android speech recognition
 * - Supports multiple languages
 * 
 * Note: This provider is for SINGLE-USE voice input only.
 * For streaming/conversational voice (Interactive Orb), use claudeProvider.ts
 */

import Voice, {
  SpeechResultsEvent,
  SpeechErrorEvent,
  SpeechStartEvent,
  SpeechEndEvent,
} from '@react-native-voice/voice';
import { Platform } from 'react-native';
import type { VoiceProvider, VoiceSession, VoiceStartOptions } from './unifiedProvider';

// Map our language codes to React Native Voice locale codes
const LANGUAGE_MAP: Record<string, string> = {
  'en': 'en-ZA',
  'af': 'af-ZA',
  'zu': 'zu-ZA',
  'xh': 'xh-ZA',
  'nso': 'nso-ZA',
  'st': 'st-ZA',
};

function mapLanguageCode(lang?: string): string {
  if (!lang) return 'en-ZA';
  const code = lang.toLowerCase().split('-')[0];
  return LANGUAGE_MAP[code] || 'en-ZA';
}

class ReactNativeVoiceSession implements VoiceSession {
  private active = false;
  private onPartialCallback?: (text: string) => void;
  private onFinalCallback?: (text: string) => void;
  private partialResults: string[] = [];

  async start(opts: VoiceStartOptions): Promise<boolean> {
    try {
      // Check if Voice is available
      const available = await Voice.isAvailable();
      if (!available) {
        console.warn('[ReactNativeVoice] Speech recognition not available on this device');
        return false;
      }

      // Store callbacks
      this.onPartialCallback = opts.onPartial;
      this.onFinalCallback = opts.onFinal;
      this.partialResults = [];

      // Set up event listeners
      Voice.onSpeechStart = this.handleSpeechStart;
      Voice.onSpeechEnd = this.handleSpeechEnd;
      Voice.onSpeechResults = this.handleSpeechResults;
      Voice.onSpeechPartialResults = this.handleSpeechPartialResults;
      Voice.onSpeechError = this.handleSpeechError;

      // Start recognition
      const locale = mapLanguageCode(opts.language);
      await Voice.start(locale);
      
      this.active = true;
      if (__DEV__) console.log('[ReactNativeVoice] ✅ Started recognition with locale:', locale);
      return true;
    } catch (error) {
      console.error('[ReactNativeVoice] Failed to start:', error);
      return false;
    }
  }

  async stop(): Promise<void> {
    try {
      if (this.active) {
        await Voice.stop();
        this.active = false;
        if (__DEV__) console.log('[ReactNativeVoice] ✅ Stopped recognition');
      }
    } catch (error) {
      console.error('[ReactNativeVoice] Stop error:', error);
    }
  }

  isActive(): boolean {
    return this.active;
  }

  isConnected(): boolean {
    // On-device recognition is always "connected" if active
    return this.active;
  }

  setMuted(_muted: boolean): void {
    // Not applicable for on-device recognition
    // Could pause/resume recognition if needed
  }

  updateConfig(_cfg: { language?: string }): void {
    // Language changes require stopping and restarting
    // Not implemented for single-use case
  }

  // Event handlers
  private handleSpeechStart = (_e: SpeechStartEvent) => {
    if (__DEV__) console.log('[ReactNativeVoice] 🎤 Speech started');
  };

  private handleSpeechEnd = (_e: SpeechEndEvent) => {
    if (__DEV__) console.log('[ReactNativeVoice] 🎤 Speech ended');
    this.active = false;
  };

  private handleSpeechResults = (e: SpeechResultsEvent) => {
    if (__DEV__) console.log('[ReactNativeVoice] 📝 Final results:', e.value);
    
    if (e.value && e.value.length > 0) {
      const finalText = e.value[0];
      this.onFinalCallback?.(finalText);
    }
  };

  private handleSpeechPartialResults = (e: SpeechResultsEvent) => {
    if (__DEV__) console.log('[ReactNativeVoice] 📝 Partial results:', e.value);
    
    if (e.value && e.value.length > 0) {
      const partialText = e.value[0];
      this.partialResults.push(partialText);
      this.onPartialCallback?.(partialText);
    }
  };

  private handleSpeechError = (e: SpeechErrorEvent) => {
    // Filter out "no match" errors (user stopped before speaking)
    const errorMsg = e.error?.message || String(e.error);
    if (errorMsg.includes('No match') || errorMsg.includes('7/No match')) {
      if (__DEV__) console.log('[ReactNativeVoice] No speech detected (user cancelled)');
      return;
    }

    console.error('[ReactNativeVoice] ❌ Speech error:', e.error);
    this.active = false;
  };

  // Cleanup
  async destroy(): Promise<void> {
    try {
      await Voice.destroy();
      Voice.removeAllListeners();
      this.active = false;
    } catch (error) {
      console.error('[ReactNativeVoice] Destroy error:', error);
    }
  }
}

/**
 * React Native Voice Provider for on-device speech recognition
 * Use this for single-use voice input (mic button in chat)
 */
export const reactNativeVoiceProvider: VoiceProvider = {
  id: 'expo', // Use 'expo' id to maintain compatibility

  async isAvailable(): Promise<boolean> {
    // Check if we're on a supported platform
    if (Platform.OS === 'web') {
      // Web doesn't support @react-native-voice/voice
      return false;
    }

    try {
      // Check if Voice module is available
      const available = await Voice.isAvailable();
      // Voice.isAvailable() returns 1 (iOS) or true (Android) when available
      return Boolean(available);
    } catch (error) {
      if (__DEV__) console.warn('[ReactNativeVoice] Availability check failed:', error);
      return false;
    }
  },

  createSession(): VoiceSession {
    return new ReactNativeVoiceSession();
  },
};

export default reactNativeVoiceProvider;
