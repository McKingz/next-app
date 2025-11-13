/**
 * Expo Speech Recognition Provider
 * 
 * Uses expo-speech-recognition for on-device speech recognition.
 * Works on iOS, Android, and Web.
 * 
 * Benefits:
 * - Zero native module linking required (Expo managed workflow)
 * - Consistent API across all platforms
 * - On-device recognition (no server costs)
 * - Supports South African languages (device-dependent)
 */

import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import type { VoiceProvider, VoiceSession, VoiceStartOptions } from './unifiedProvider';

// Map app language codes to device locale codes
function mapLanguageToLocale(lang?: string): string {
  const base = String(lang || '').toLowerCase();
  if (base.startsWith('af')) return 'af-ZA';
  if (base.startsWith('zu')) return 'zu-ZA';
  if (base.startsWith('xh')) return 'xh-ZA';
  if (base.startsWith('nso')) return 'en-ZA'; // Sepedi not reliably supported on-device → fallback to en-ZA for ASR
  if (base.startsWith('en')) return 'en-ZA';
  return 'en-ZA'; // Default to English (South Africa)
}

class ExpoSpeechSession implements VoiceSession {
  private active = false;
  private muted = false;
  private currentOpts: VoiceStartOptions | null = null;

  async start(opts: VoiceStartOptions): Promise<boolean> {
    try {
      if (__DEV__) console.log('[ExpoProvider] Starting speech recognition...');
      
      this.currentOpts = opts;
      
      // Request microphone permissions
      const { status } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (status !== 'granted') {
        console.error('[ExpoProvider] Microphone permission denied');
        return false;
      }
      
      // Get locale for recognition
      const locale = mapLanguageToLocale(opts.language);
      
      if (__DEV__) {
        console.log('[ExpoProvider] Using locale:', locale);
      }
      
      // Configure and start recognition
      try {
        await ExpoSpeechRecognitionModule.start({
          lang: locale,
          interimResults: true, // Enable partial results
          maxAlternatives: 1,
          continuous: true, // Keep listening
          requiresOnDeviceRecognition: false, // Allow cloud if needed
          addsPunctuation: true,
          contextualStrings: [], // Could add domain-specific words
        });
      } catch (startErr) {
        // If locale unsupported, fallback to en-ZA then en-US
        console.warn('[ExpoProvider] Start failed for locale', locale, startErr);
        try {
          await ExpoSpeechRecognitionModule.start({
            lang: 'en-ZA',
            interimResults: true,
            maxAlternatives: 1,
            continuous: true,
            requiresOnDeviceRecognition: false,
            addsPunctuation: true,
            contextualStrings: [],
          });
        } catch (fallbackErr) {
          console.warn('[ExpoProvider] Fallback start failed for en-ZA, trying en-US', fallbackErr);
          await ExpoSpeechRecognitionModule.start({
            lang: 'en-US',
            interimResults: true,
            maxAlternatives: 1,
            continuous: true,
            requiresOnDeviceRecognition: false,
            addsPunctuation: true,
            contextualStrings: [],
          });
        }
      }
      
      // Set up event listeners
      ExpoSpeechRecognitionModule.addListener('result', (event: any) => {
        if (this.muted) return;
        
        const results = event.results || [];
        if (results.length === 0) return;
        
        const result = results[0];
        const transcript = result.transcript || '';
        
        if (result.isFinal) {
          if (__DEV__) console.log('[ExpoProvider] Final:', transcript);
          opts.onFinal?.(transcript);
        } else {
          if (__DEV__) console.log('[ExpoProvider] Partial:', transcript.substring(0, 50));
          opts.onPartial?.(transcript);
        }
      });
      
      ExpoSpeechRecognitionModule.addListener('error', (event: any) => {
        console.error('[ExpoProvider] Recognition error:', event.error);
        this.active = false;
      });
      
      ExpoSpeechRecognitionModule.addListener('end', () => {
        if (__DEV__) console.log('[ExpoProvider] Recognition ended');
        this.active = false;
      });
      
      this.active = true;
      if (__DEV__) console.log('[ExpoProvider] Recognition started successfully');
      return true;
    } catch (e) {
      console.error('[ExpoProvider] Start failed:', e);
      this.active = false;
      return false;
    }
  }

  async stop(): Promise<void> {
    try {
      if (__DEV__) console.log('[ExpoProvider] Stopping recognition...');
      await ExpoSpeechRecognitionModule.stop();
      this.active = false;
      
      // Remove event listeners
      ExpoSpeechRecognitionModule.removeAllListeners('result');
      ExpoSpeechRecognitionModule.removeAllListeners('error');
      ExpoSpeechRecognitionModule.removeAllListeners('end');
    } catch (e) {
      console.error('[ExpoProvider] Stop failed:', e);
    }
  }

  isActive(): boolean {
    return this.active;
  }
  
  isConnected(): boolean {
    return this.active; // For Expo, active = connected
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (__DEV__) console.log('[ExpoProvider] Muted:', muted);
  }

  updateConfig(cfg: { language?: string }): void {
    // Restart with new language
    if (this.currentOpts && cfg.language) {
      this.stop().then(() => {
        if (this.currentOpts) {
          this.currentOpts.language = cfg.language;
          this.start(this.currentOpts);
        }
      });
    }
  }
}

/**
 * Expo Speech Recognition Provider
 */
export const expoSpeech: VoiceProvider = {
  id: 'expo',
  
  async isAvailable(): Promise<boolean> {
    try {
      // Check if module is available
      if (!ExpoSpeechRecognitionModule) {
        if (__DEV__) console.warn('[ExpoProvider] Module not available');
        return false;
      }
      
      // Check if speech recognition is supported on device
      const isAvailable = await ExpoSpeechRecognitionModule.getStateAsync();
      
      if (__DEV__) {
        console.log('[ExpoProvider] Availability check:', isAvailable);
      }
      
      return true;
    } catch (e) {
      if (__DEV__) console.warn('[ExpoProvider] Availability check failed:', e);
      return false;
    }
  },
  
  createSession(): VoiceSession {
    return new ExpoSpeechSession();
  },
};

