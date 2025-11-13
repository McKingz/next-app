/**
 * DashVoiceService
 * 
 * Handles all voice-related functionality for Dash AI:
 * - Audio recording (start/stop)
 * - Speech-to-Text (STT) transcription via Azure Speech SDK or Supabase Edge Function
 * - Text-to-Speech (TTS) playback with intelligent text normalization
 * - Platform-specific audio configuration (iOS/Android/Web)
 * 
 * Design principles:
 * - Dependency injection for configuration (personality settings, Supabase client)
 * - Platform-agnostic (handles Web, iOS, Android)
 * - No AI service calls (delegates to Edge Functions)
 * - Focused on voice I/O only
 */

import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import type { DashPersonality } from './types';

// Declare global window for web platform type safety
declare const window: any;
declare const navigator: any;

// Dynamically import SecureStore for cross-platform compatibility
let SecureStore: any = null;
try {
  if (Platform.OS !== 'web') {
    SecureStore = require('expo-secure-store');
  }
} catch (e) {
  console.debug('[DashVoice] SecureStore import failed (web or unsupported platform)', e);
}

/**
 * Voice recording configuration
 */
export interface VoiceRecordingConfig {
  /** Voice settings (language, pitch, rate) */
  voiceSettings: DashPersonality['voice_settings'];
  /** Supabase client for uploading audio and calling Edge Functions */
  supabaseClient: any;
}

/**
 * Transcription result
 */
export interface TranscriptionResult {
  transcript: string;
  storagePath?: string;
  language?: string;
  provider?: string;
  contentType?: string;
}

/**
 * Speech playback callbacks
 */
export interface SpeechCallbacks {
  onStart?: () => void;
  onDone?: () => void;
  onStopped?: () => void;
  onError?: (error: any) => void;
}

/**
 * DashVoiceService
 * Manages all voice input/output for Dash AI
 */
export class DashVoiceService {
  private config: VoiceRecordingConfig;
  private isRecording = false;
  private recordingObject: Audio.Recording | null = null;
  private soundObject: Audio.Sound | null = null;
  private voiceController: any = null; // Optional Phase 4 architecture

  constructor(config: VoiceRecordingConfig) {
    this.config = config;
  }

  /**
   * Initialize audio system
   */
  public async initializeAudio(): Promise<void> {
    try {
      // On web, expo-av audio mode options are not applicable; skip configuration
      if (Platform.OS === 'web') {
        console.debug('[DashVoice] Skipping audio mode configuration on web');
        return;
      }

      await Audio.requestPermissionsAsync();

      if (Platform.OS === 'ios') {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });
      } else if (Platform.OS === 'android') {
        await Audio.setAudioModeAsync({
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        } as any);
      }
    } catch (error) {
      console.error('[DashVoice] Audio initialization failed:', error);
    }
  }

  /**
   * Start voice recording
   */
  public async startRecording(): Promise<void> {
    if (this.isRecording) {
      console.warn('[DashVoice] Already recording, ignoring start request');
      throw new Error('Recording already in progress');
    }

    // Clean up any existing recording object
    if (this.recordingObject) {
      console.log('[DashVoice] Cleaning up existing recording object');
      try {
        await this.recordingObject.stopAndUnloadAsync();
      } catch {
        // Ignore errors during cleanup
      }
      this.recordingObject = null;
    }

    try {
      // Web compatibility checks for recording support and secure context
      if (Platform.OS === 'web') {
        try {
          const w: any = typeof window !== 'undefined' ? window : null;
          const nav: any = typeof navigator !== 'undefined' ? navigator : null;

          const isSecure = w && (w.isSecureContext || w.location?.protocol === 'https:' || w.location?.hostname === 'localhost' || w.location?.hostname === '127.0.0.1');
          if (!isSecure) {
            throw new Error('Microphone requires a secure context (HTTPS or localhost).');
          }

          if (!nav?.mediaDevices?.getUserMedia) {
            throw new Error('Your browser does not support microphone capture (mediaDevices.getUserMedia missing). Please use Chrome or Edge.');
          }

          if (w?.MediaRecorder && typeof (w as any).MediaRecorder.isTypeSupported === 'function') {
            const preferred = 'audio/webm';
            if (!(w as any).MediaRecorder.isTypeSupported(preferred)) {
              console.warn(`[DashVoice] ${preferred} not fully supported; the browser may record using a different container/codec.`);
            }
          } else {
            console.warn('[DashVoice] MediaRecorder is not available; recording may not work in this browser (e.g., Safari).');
          }
        } catch (compatErr) {
          console.error('[DashVoice] Web recording compatibility error:', compatErr);
          throw compatErr;
        }
      }

      console.log('[DashVoice] Starting recording...');
      this.recordingObject = new Audio.Recording();

      // Use the Expo AV recording API: prepareToRecordAsync + startAsync
      await this.recordingObject.prepareToRecordAsync({
        android: {
          extension: '.m4a',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
        },
        ios: {
          extension: '.m4a',
          outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
          audioQuality: Audio.IOSAudioQuality.MAX,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
      } as Audio.RecordingOptions);

      await this.recordingObject.startAsync();
      this.isRecording = true;
      console.log('[DashVoice] Recording started');
    } catch (error) {
      // Reset state on error
      this.isRecording = false;
      this.recordingObject = null;
      console.error('[DashVoice] Failed to start recording:', error);
      throw error;
    }
  }

  /**
   * Stop voice recording and return audio URI
   */
  public async stopRecording(): Promise<string> {
    if (!this.isRecording) {
      console.warn('[DashVoice] Not recording, cannot stop');
      throw new Error('No recording in progress');
    }

    if (!this.recordingObject) {
      console.warn('[DashVoice] No recording object found');
      // Reset state and throw error
      this.isRecording = false;
      throw new Error('Recording object not found');
    }

    try {
      console.log('[DashVoice] Stopping recording...');
      await this.recordingObject.stopAndUnloadAsync();
      const recordingUri = this.recordingObject.getURI();
      
      // Clean up state
      this.recordingObject = null;
      this.isRecording = false;
      
      // Validate that we got a valid URI
      if (!recordingUri) {
        throw new Error('Recording URI is null or empty');
      }
      
      console.log('[DashVoice] Recording stopped successfully:', recordingUri);
      
      // Additional validation: check if file exists on native platforms
      if (Platform.OS !== 'web') {
        try {
          const fileInfo = await FileSystem.getInfoAsync(recordingUri);
          if (!fileInfo.exists) {
            throw new Error('Recorded audio file does not exist');
          }
          if (fileInfo.size && fileInfo.size < 1024) {
            throw new Error(`Recorded audio file too small: ${fileInfo.size} bytes`);
          }
          console.log('[DashVoice] Audio file validated:', fileInfo.size, 'bytes');
        } catch (fileError) {
          console.error('[DashVoice] Audio file validation failed:', fileError);
          throw new Error(`Audio file validation failed: ${fileError}`);
        }
      }
      
      return recordingUri;
    } catch (error) {
      // Always clean up state on error
      this.recordingObject = null;
      this.isRecording = false;
      console.error('[DashVoice] Failed to stop recording:', error);
      throw error;
    }
  }

  /**
   * Transcribe audio by uploading to Supabase Storage and invoking Edge Function.
   * - Web: uses blob: URI fetch
   * - Native: uses file:// fetch
   */
  public async transcribeAudio(audioUri: string, userId: string = 'anonymous'): Promise<TranscriptionResult> {
    let storagePath: string | undefined;
    let contentType: string | undefined;
    try {
      console.log('[DashVoice] Transcribing audio:', audioUri);

      // Language hint derived from personality voice settings
      const voiceLang = this.config.voiceSettings.language || 'en-ZA';
      const language = (() => {
        const map: Record<string, string> = { 'en-ZA': 'en', 'en-US': 'en', 'en-GB': 'en', 'af': 'af', 'zu': 'zu', 'xh': 'zu', 'st': 'st' };
        return map[voiceLang] || voiceLang.slice(0, 2).toLowerCase();
      })();

      // Load audio file content using FileSystem for React Native or fetch for web
      let blob: Blob;
      
      if (Platform.OS === 'web') {
        // Web: use fetch for blob: URLs
        const res = await fetch(audioUri);
        if (!res.ok) {
          throw new Error(`Failed to load recorded audio: ${res.status}`);
        }
        blob = await res.blob();
      } else {
        // React Native: validate file exists and get size info
        try {
          const fileInfo = await FileSystem.getInfoAsync(audioUri);
          if (!fileInfo.exists) {
            throw new Error('Audio file does not exist');
          }
          
          console.log('[DashVoice] Audio file info:', fileInfo.size, 'bytes');
          
          // For React Native, we'll use the file URI directly with Supabase upload
          // Create a fake blob object for the upload logic
          blob = {
            size: fileInfo.size || 0,
            type: contentType || 'audio/mp4'
          } as any;
          
        } catch (fsError) {
          console.error('[DashVoice] FileSystem validation failed:', fsError);
          throw new Error(`Failed to validate audio file: ${fsError}`);
        }
      }
      
      // Validate blob content
      if (!blob || blob.size === 0) {
        throw new Error('Audio file is empty or invalid');
      }
      
      // Check minimum file size (should be at least a few KB for valid audio)
      if (blob.size < 1024) {
        console.warn('[DashVoice] Audio file very small:', blob.size, 'bytes');
        throw new Error(`Audio file too small: ${blob.size} bytes`);
      }
      
      console.log('[DashVoice] Audio file loaded successfully:', blob.size, 'bytes');

      // Infer content type and extension
      const uriLower = (audioUri || '').toLowerCase();
      contentType = blob.type || (uriLower.endsWith('.m4a') ? 'audio/mp4'
        : uriLower.endsWith('.mp3') ? 'audio/mpeg'
        : uriLower.endsWith('.wav') ? 'audio/wav'
        : uriLower.endsWith('.ogg') ? 'audio/ogg'
        : uriLower.endsWith('.webm') ? 'audio/webm'
        : 'application/octet-stream');
      const ext = contentType.includes('mp4') || uriLower.endsWith('.m4a') ? 'm4a'
        : contentType.includes('mpeg') || uriLower.endsWith('.mp3') ? 'mp3'
        : contentType.includes('wav') || uriLower.endsWith('.wav') ? 'wav'
        : contentType.includes('ogg') || uriLower.endsWith('.ogg') ? 'ogg'
        : contentType.includes('webm') || uriLower.endsWith('.webm') ? 'webm'
        : 'bin';
      const fileName = `dash_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

      // Storage path for RLS: user_id/filename (RLS policy requires first folder to be user's ID)
      storagePath = `${userId}/${fileName}`;
      
      if (__DEV__) console.log('[DashVoice] Voice upload path:', storagePath, 'Platform:', Platform.OS);

      // Upload to Supabase Storage (voice-notes bucket)
      let uploadResult;
      
      if (Platform.OS === 'web') {
        // Web: use blob/file approach
        let body: any;
        try {
          // @ts-ignore: File may not exist in some environments
          const maybeFile = typeof File !== 'undefined' ? new File([blob], fileName, { type: contentType }) : null;
          body = maybeFile || blob;
        } catch {
          body = blob;
        }
        
        uploadResult = await this.config.supabaseClient
          .storage
          .from('voice-notes')
          .upload(storagePath, body, { contentType, upsert: true });
      } else {
        // React Native: read file as base64 and upload as Uint8Array
        try {
          const base64Data = await FileSystem.readAsStringAsync(audioUri, {
            encoding: FileSystem.EncodingType.Base64
          });
          
          // Convert base64 to Uint8Array for upload
          const binaryString = atob(base64Data);
          const uint8Array = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            uint8Array[i] = binaryString.charCodeAt(i);
          }
          
          console.log('[DashVoice] Uploading audio as Uint8Array:', uint8Array.length, 'bytes');
          console.log('[DashVoice] Upload path:', storagePath);
          
          uploadResult = await this.config.supabaseClient
            .storage
            .from('voice-notes')
            .upload(storagePath, uint8Array, { 
              contentType: contentType || 'audio/mp4', 
              upsert: true 
            });
            
          console.log('[DashVoice] Upload result:', uploadResult);
            
        } catch (uploadError) {
          console.error('[DashVoice] Uint8Array upload failed, trying FormData approach:', uploadError);
          
          // Fallback: try with FormData approach (React Native compatible)
          const formData = new FormData();
          formData.append('file', {
            uri: audioUri,
            type: contentType || 'audio/mp4',
            name: fileName
          } as any);
          
          uploadResult = await this.config.supabaseClient
            .storage
            .from('voice-notes')
            .upload(storagePath, formData, { 
              contentType: contentType || 'audio/mp4', 
              upsert: true 
            });
        }
      }
      
      const { error: uploadError } = uploadResult;
      if (uploadError) {
        console.error('[DashVoice] Upload failed:', uploadError.message);
        
        // If it's an RLS policy error, try to continue without upload
        if (uploadError.message.includes('row-level security policy')) {
          console.warn('[DashVoice] RLS policy prevents upload, attempting transcription without storage');
          
          // Return mock transcription for now - in production you'd need to set up proper RLS policies
          return {
            transcript: 'Voice message received successfully. (Upload blocked by database policy - please contact admin to configure voice-notes bucket permissions)',
            language: this.config.voiceSettings.language?.slice(0,2).toLowerCase() || 'en'
          };
        }
        
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      // Invoke the new STT proxy with auto language detection
      const { data, error: fnError } = await this.config.supabaseClient
        .functions
        .invoke('stt-proxy', {
          body: {
            storage_path: storagePath,
            candidate_languages: ['af-ZA','zu-ZA','xh-ZA','nso-ZA','en-ZA','en-US']
          }
        });
      if (fnError) {
        throw new Error(`Transcription function failed: ${fnError.message || String(fnError)}`);
      }

      const transcript = (data as any)?.text || (data as any)?.transcript || '';
      const detectedLang = (data as any)?.language || language;
      const provider = (data as any)?.provider;

      return {
        transcript: transcript || 'Transcription returned empty result.',
        storagePath,
        language: detectedLang,
        provider,
        contentType,
      };
    } catch (error) {
      console.error('[DashVoice] Transcription failed:', error);
      return {
        transcript: "Voice message received - couldn't transcribe audio.",
        storagePath,
        language: this.config.voiceSettings.language?.slice(0,2).toLowerCase() || 'en',
        contentType,
      };
    }
  }

  /**
   * Speak text using TTS with intelligent text normalization
   */
  public async speakText(text: string, callbacks?: SpeechCallbacks, options?: { language?: string }): Promise<void> {
    try {
      const voiceSettings = this.config.voiceSettings;

      // Normalize text first
      const normalizedText = this.normalizeTextForSpeech(text);
      if (normalizedText.length === 0) {
        console.log('[DashVoice] No speakable content after normalization');
        callbacks?.onError?.('No speakable content after normalization');
        return;
      }

      // Short language code for Edge Function (af, zu, xh, nso, en)
      let shortLang = 'en';
      try {
        const { getCurrentLanguage } = await import('@/lib/i18n');
        const { normalizeLanguageCode, resolveDefaultVoiceId } = await import('@/lib/ai/dashSettings');
        const ui = getCurrentLanguage?.();
        shortLang = normalizeLanguageCode(options?.language || ui || voiceSettings.language) as any;

        // Resolve voice ID preference
        const { voiceService } = await import('@/lib/voice/client');
        const prefs = await voiceService.getPreferences().catch(() => null);
        const gender = (voiceSettings as any).voice === 'male' ? 'male' : 'female';
        const voice_id = (prefs?.language === shortLang && prefs?.voice_id)
          ? prefs.voice_id
          : resolveDefaultVoiceId(shortLang as any, gender as any);

        // Convert rate/pitch (1.0 baseline) to -50..+50 scale expected by Edge Function
        const speaking_rate = Math.round(((voiceSettings.rate ?? 1.0) - 1.0) * 100);
        const pitch = Math.round(((voiceSettings.pitch ?? 1.0) - 1.0) * 100);

        // Try Edge Function (Azure/Google)
        try {
          const resp = await voiceService.synthesize({
            text: normalizedText,
            language: shortLang as any,
            voice_id,
            speaking_rate,
            pitch,
          });

          // Play via audio manager
          const { audioManager } = await import('@/lib/voice/audio');
          callbacks?.onStart?.();
          await audioManager.play(resp.audio_url, (state) => {
            if (!state.isPlaying && state.position === 0 && !state.error) {
              callbacks?.onDone?.();
            } else if (state.error) {
              callbacks?.onError?.(new Error(state.error));
            }
          });
          return;
        } catch (edgeError: any) {
          if (edgeError?.code !== 'DEVICE_FALLBACK') {
            console.warn('[DashVoice] Edge TTS failed or unavailable, falling back to device TTS');
          }
          // Fall through to device TTS below
        }
      } catch (mapErr) {
        console.warn('[DashVoice] Language normalization failed, using device TTS fallback');
      }

      // Determine device TTS locale (en-ZA, af-ZA, etc.)
      let effectiveLang = (options?.language as any) || voiceSettings.language || 'en-ZA';
      try {
        const { getCurrentLanguage } = await import('@/lib/i18n');
        const ui = options?.language ? options.language : getCurrentLanguage?.(); // prefer explicit override
        const map = (l?: string) => {
          const base = String(l || '').toLowerCase();
          if (base.startsWith('af')) return 'af-ZA';
          if (base.startsWith('zu')) return 'zu-ZA';
          if (base.startsWith('xh')) return 'xh-ZA';
          if (base.startsWith('nso') || base === 'st' || base.includes('sotho')) return 'nso-ZA';
          if (base.startsWith('en')) return 'en-ZA';
          return 'en-ZA';
        };
        effectiveLang = map(ui) || map(voiceSettings.language) || 'en-ZA';
      } catch {
        const base = String(voiceSettings.language || '').toLowerCase();
        effectiveLang = base ? (base.startsWith('en') ? 'en-ZA' : base) : 'en-ZA';
      }

      // Device TTS fallback
      return new Promise<void>((resolve, reject) => {
        Speech.speak(normalizedText, {
          language: effectiveLang,
          pitch: voiceSettings.pitch,
          rate: voiceSettings.rate,
          voice: (voiceSettings as any).voice,
          onStart: () => {
            callbacks?.onStart?.();
          },
          onDone: () => {
            callbacks?.onDone?.();
            resolve();
          },
          onStopped: () => {
            callbacks?.onStopped?.();
            resolve();
          },
          onError: (error: any) => {
            callbacks?.onError?.(error);
            reject(error);
          },
        });
      });
    } catch (error) {
      console.error('[DashVoice] Failed to speak text:', error);
      callbacks?.onError?.(error);
      throw error;
    }
  }

  /**
   * Stop current speech - IMMEDIATELY stops all audio sources
   * This is a CRITICAL function for interrupt handling
   */
  public async stopSpeaking(): Promise<void> {
    try {
      console.log('[DashVoice] 🛑 IMMEDIATE STOP - Stopping all speech playback...');
      
      // Execute all stop operations in parallel for immediate effect
      const stopOperations = [];
      
      // Stop device TTS (expo-speech) - HIGHEST PRIORITY
      if (Speech && typeof Speech.stop === 'function') {
        stopOperations.push(
          Speech.stop().then(() => console.log('[DashVoice] ✅ Device TTS stopped'))
        );
      }
      
      // Stop audio manager (Azure TTS)
      stopOperations.push(
        (async () => {
          try {
            const { audioManager } = await import('@/lib/voice/audio');
            await audioManager.stop();
            console.log('[DashVoice] ✅ Audio manager stopped');
          } catch (e) {
            console.warn('[DashVoice] ⚠️ Audio manager stop warning:', e);
          }
        })()
      );
      
      // Stop voice controller if using Phase 4 architecture
      if (this.voiceController) {
        stopOperations.push(
          this.voiceController.stopSpeaking().then(() => console.log('[DashVoice] ✅ Voice controller stopped'))
        );
      }
      
      // Wait for all stop operations to complete (with timeout)
      await Promise.race([
        Promise.all(stopOperations),
        new Promise((resolve) => setTimeout(resolve, 500)) // 500ms timeout
      ]);
      
      console.log('[DashVoice] ✅ All speech stopped successfully');
    } catch (error) {
      console.error('[DashVoice] ❌ Failed to stop speaking:', error);
      // Don't throw - we want stop to be as robust as possible
      // Throwing could prevent cleanup in the caller
    }
  }

  /**
   * Check if currently recording
   */
  public isCurrentlyRecording(): boolean {
    return this.isRecording;
  }

  /**
   * Pre-warm audio recorder for faster voice input
   */
  public async preWarmRecorder(): Promise<void> {
    try {
      console.log('[DashVoice] Pre-warming audio recorder...');
      
      // Skip on web platform
      if (Platform.OS === 'web') {
        console.debug('[DashVoice] Skipping recorder pre-warm on web');
        return;
      }
      
      // Request permissions if not already granted
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        console.warn('[DashVoice] Audio permissions not granted');
        return;
      }
      
      // Create and immediately release a recording to warm up the system
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.stopAndUnloadAsync();
      
      console.log('[DashVoice] Recorder pre-warmed successfully');
    } catch (error) {
      console.warn('[DashVoice] Failed to pre-warm recorder:', error);
      // Non-critical failure, continue silently
    }
  }

  /**
   * Update voice configuration
   */
  public updateConfig(config: Partial<VoiceRecordingConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Dispose and clean up all resources
   */
  public dispose(): void {
    console.log('[DashVoice] Disposing DashVoiceService...');
    
    // Clear audio resources
    if (this.recordingObject) {
      this.recordingObject.stopAndUnloadAsync().catch(() => {});
      this.recordingObject = null;
    }
    if (this.soundObject) {
      this.soundObject.unloadAsync().catch(() => {});
      this.soundObject = null;
    }
    
    this.isRecording = false;
    console.log('[DashVoice] Disposal complete');
  }

  // ==================== TEXT NORMALIZATION FOR SPEECH ====================

  /**
   * Intelligent text normalization for smart reading
   * Handles numbers, dates, special characters, and formatting
   */
  public normalizeTextForSpeech(text: string): string {
    let normalized = text;
    
    // Remove markdown formatting FIRST (before other transformations)
    normalized = this.removeMarkdownFormatting(normalized);
    
    // Handle bullet points and list formatting
    normalized = this.normalizeBulletPoints(normalized);
    
    // Handle awkward age/number phrases BEFORE general number normalization
    normalized = this.normalizeAgeAndQuantityPhrases(normalized);
    
    // Handle numbers intelligently
    normalized = this.normalizeNumbers(normalized);
    
    // Handle dates and time formats
    normalized = this.normalizeDatesAndTime(normalized);
    
    // Handle underscores and special formatting
    normalized = this.normalizeSpecialFormatting(normalized);
    
    // Handle abbreviations and acronyms
    normalized = this.normalizeAbbreviations(normalized);
    
    // Handle mathematical expressions (only in math contexts)
    normalized = this.normalizeMathExpressions(normalized);
    
    // Remove emojis and special characters (simplified for ES5 compatibility)
    normalized = normalized
      .replace(/[\u2600-\u26FF]/g, '')  // Misc symbols
      .replace(/[\u2700-\u27BF]/g, '')  // Dingbats
      .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '') // Surrogate pairs (emojis)
      // Remove extra whitespace
      .replace(/\s+/g, ' ')
      .trim();
    
    return normalized;
  }

  /**
   * Normalize awkward age and quantity phrases for natural speech
   * Examples:
   * - "children to 6 years old" -> "6 year old children"
   * - "students from 5 to 7 years" -> "students aged 5 to 7 years"
   * - "kids aged 3-4 years old" -> "3 to 4 year old kids"
   */
  private normalizeAgeAndQuantityPhrases(text: string): string {
    return text
      // Fix "X to Y years old" patterns
      .replace(/(\w+)\s+to\s+(\d+)\s+years?\s+old/gi, '$2 year old $1')
      .replace(/(\w+)\s+from\s+(\d+)\s+to\s+(\d+)\s+years?/gi, '$1 aged $2 to $3 years')
      // Fix awkward "aged X-Y years old" patterns
      .replace(/aged\s+(\d+)-(\d+)\s+years?\s+old/gi, '$1 to $2 year old')
      // Fix "students/children/kids of X years"
      .replace(/(students?|children?|kids?)\s+of\s+(\d+)\s+years?/gi, '$2 year old $1')
      // Fix "X year students" -> "X year old students"
      .replace(/(\d+)\s+year\s+(students?|children?|kids?)/gi, '$1 year old $2')
      // Fix plural "years old" when singular needed
      .replace(/(\d+)\s+years\s+old\s+(student|child|kid|boy|girl)/gi, '$1 year old $2')
      // Normalize "X-Y year old" patterns
      .replace(/(\d+)-(\d+)\s+years?\s+old/gi, '$1 to $2 year old');
  }

  /**
   * Remove markdown formatting for speech
   */
  private removeMarkdownFormatting(text: string): string {
    return text
      // Remove bold/italic markers (**, *, __, _)
      .replace(/\*\*([^*]+)\*\*/g, '$1')  // **bold** -> bold
      .replace(/\*([^*]+)\*/g, '$1')      // *italic* -> italic
      .replace(/__([^_]+)__/g, '$1')      // __bold__ -> bold
      .replace(/_([^_]+)_/g, '$1')        // _italic_ -> italic
      // Remove answer blanks (_____ or ____)
      .replace(/_{3,}/g, 'blank')         // _____ -> blank
      // Remove code blocks
      .replace(/```[\s\S]*?```/g, '')     // Remove code blocks
      .replace(/`([^`]+)`/g, '$1')        // `code` -> code
      // Remove strikethrough
      .replace(/~~([^~]+)~~/g, '$1')      // ~~strike~~ -> strike
      // Remove headers (# ## ###)
      .replace(/^#{1,6}\s+/gm, '')        // # Header -> Header
      // Remove horizontal rules
      .replace(/^[-*_]{3,}$/gm, '')       // --- -> (removed)
      // Remove blockquotes
      .replace(/^>\s+/gm, '')             // > quote -> quote
      // Remove link formatting but keep text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // [text](url) -> text
      .trim();
  }

  /**
   * Normalize numbers for intelligent reading
   */
  private normalizeNumbers(text: string): string {
    return text
      // Handle large numbers with separators (e.g., 1,000 -> one thousand)
      .replace(/\b(\d{1,3}(?:,\d{3})+)\b/g, (match) => {
        const number = parseInt(match.replace(/,/g, ''));
        return this.numberToWords(number);
      })
      // Handle decimal numbers (e.g., 3.14 -> three point one four)
      .replace(/\b(\d+)\.(\d+)\b/g, (match, whole, decimal) => {
        const wholeWords = this.numberToWords(parseInt(whole));
        const decimalWords = decimal.split('').map((d: string) => this.numberToWords(parseInt(d))).join(' ');
        return `${wholeWords} point ${decimalWords}`;
      })
      // Handle ordinal numbers (e.g., 1st -> first, 2nd -> second)
      .replace(/\b(\d+)(st|nd|rd|th)\b/gi, (match, num) => {
        return this.numberToOrdinal(parseInt(num));
      })
      // Handle regular numbers (e.g., 123 -> one hundred twenty three)
      .replace(/\b\d+\b/g, (match) => {
        const number = parseInt(match);
        if (number > 2024 && number < 2100) {
          // Handle years specially (e.g., 2025 -> twenty twenty five)
          return this.numberToWords(number, true);
        }
        return this.numberToWords(number);
      });
  }

  /**
   * Normalize dates and time for speech
   */
  private normalizeDatesAndTime(text: string): string {
    return text
      // Handle ISO dates (2024-12-25)
      .replace(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g, (match, year, month, day) => {
        const monthName = this.getMonthName(parseInt(month));
        const dayOrdinal = this.numberToOrdinal(parseInt(day));
        return `${monthName} ${dayOrdinal}, ${year}`;
      })
      // Handle US dates (12/25/2024)
      .replace(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g, (match, month, day, year) => {
        const monthName = this.getMonthName(parseInt(month));
        const dayOrdinal = this.numberToOrdinal(parseInt(day));
        return `${monthName} ${dayOrdinal}, ${year}`;
      })
      // Handle time (14:30 -> two thirty PM)
      .replace(/\b(\d{1,2}):(\d{2})\b/g, (match, hour, minute) => {
        return this.timeToWords(parseInt(hour), parseInt(minute));
      });
  }

  /**
   * Normalize bullet points and list formatting
   */
  private normalizeBulletPoints(text: string): string {
    return text
      // Handle bullet points at start of lines
      .replace(/^[\s]*[-•*+]\s+/gm, '') // Remove bullet at line start
      .replace(/\n[\s]*[-•*+]\s+/g, '\n') // Remove bullet after newlines
      // Handle numbered lists
      .replace(/^[\s]*(\d+)[.)\s]+/gm, '') // Remove "1. " or "1) " at line start
      .replace(/\n[\s]*(\d+)[.)\s]+/g, '\n') // Remove numbered bullets after newlines
      // Handle dashes in educational content (not math contexts)
      .replace(/([a-zA-Z])\s*-\s*([A-Z][a-z])/g, '$1, $2') // "Students - They will" -> "Students, They will"
      // Handle dash separators in descriptions
      .replace(/([a-z])\s*-\s*([a-z])/g, '$1 to $2') // "5-6 years" -> "5 to 6 years"
      // Clean up extra spaces and newlines
      .replace(/\n\s*\n/g, '. ') // Double newlines become sentence breaks
      .replace(/\n/g, '. ') // Single newlines become sentence breaks
      .replace(/\s+/g, ' ') // Multiple spaces become single space
      .trim();
  }

  /**
   * Normalize special formatting like underscores and camelCase
   */
  private normalizeSpecialFormatting(text: string): string {
    return text
      // Handle underscore formatting (date_month_year -> date month year)
      .replace(/([a-zA-Z]+)_([a-zA-Z]+)/g, '$1 $2')
      // Handle camelCase (firstName -> first name)
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      // Handle kebab-case (first-name -> first name)
      .replace(/([a-zA-Z]+)-([a-zA-Z]+)/g, '$1 $2')
      // Handle file extensions (.pdf -> dot P D F)
      .replace(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|jpg|png|gif)\b/gi, (match, ext) => {
        return ` dot ${ext.toUpperCase().split('').join(' ')}`;
      });
  }

  /**
   * Normalize common abbreviations and acronyms
   */
  private normalizeAbbreviations(text: string): string {
    const abbreviations: Record<string, string> = {
      'Mr.': 'Mister',
      'Mrs.': 'Missus',
      'Dr.': 'Doctor',
      'Prof.': 'Professor',
      'St.': 'Street',
      'Ave.': 'Avenue',
      'Rd.': 'Road',
      'Ltd.': 'Limited',
      'Inc.': 'Incorporated',
      'vs.': 'versus',
      'etc.': 'etcetera',
      'i.e.': 'that is',
      'e.g.': 'for example',
      'AI': 'A I',
      'API': 'A P I',
      'URL': 'U R L',
      'HTML': 'H T M L',
      'CSS': 'C S S',
      'JS': 'JavaScript',
      'PDF': 'P D F',
      'FAQ': 'F A Q',
      'CEO': 'C E O',
      'CTO': 'C T O'
    };
    
    let normalized = text;
    for (const [abbr, expansion] of Object.entries(abbreviations)) {
      const regex = new RegExp(`\\b${abbr.replace('.', '\\.')}\\b`, 'gi');
      normalized = normalized.replace(regex, expansion);
    }
    
    return normalized;
  }

  /**
   * Normalize mathematical expressions (only in math contexts)
   */
  private normalizeMathExpressions(text: string): string {
    // Check if this appears to be mathematical content
    const hasMathContext = /\b(math|equation|formula|calculate|solve|problem|exercise)\b/i.test(text) ||
                          /\d+\s*[+\-*/=]\s*\d+/g.test(text) ||
                          /\b\d+\s*\/\s*\d+\b/.test(text);
    
    if (!hasMathContext) {
      // Only handle standalone fractions and percentages in non-math contexts
      return text
        .replace(/\b(\d+)\s*%/g, '$1 percent')
        // Handle fractions only when clearly mathematical (surrounded by numbers/operators)
        .replace(/\b(\d+)\s*\/\s*(\d+)\b(?=[^a-zA-Z]|$)/g, (match, num, den) => {
          return this.fractionToWords(parseInt(num), parseInt(den));
        });
    }
    
    // Full math processing for mathematical contexts
    return text
      // Handle basic operations
      .replace(/\+/g, ' plus ')
      .replace(/(?<!\w)-(?=\d)/g, ' minus ') // Only replace minus before numbers
      .replace(/\*/g, ' times ')
      .replace(/\//g, ' divided by ')
      .replace(/=/g, ' equals ')
      .replace(/%/g, ' percent ')
      // Handle fractions (1/2 -> one half)
      .replace(/\b(\d+)\s*\/\s*(\d+)\b/g, (match, num, den) => {
        return this.fractionToWords(parseInt(num), parseInt(den));
      });
  }

  /**
   * Convert number to words
   */
  private numberToWords(num: number, isYear: boolean = false): string {
    if (num === 0) return 'zero';
    
    const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
    const teens = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
    const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
    const thousands = ['', 'thousand', 'million', 'billion'];
    
    // Special handling for years
    if (isYear && num >= 1000 && num <= 9999) {
      const century = Math.floor(num / 100);
      const yearPart = num % 100;
      if (yearPart === 0) {
        return this.numberToWords(century) + ' hundred';
      } else {
        return this.numberToWords(century) + ' ' + (yearPart < 10 ? 'oh ' + this.numberToWords(yearPart) : this.numberToWords(yearPart));
      }
    }
    
    if (num < 10) return ones[num];
    if (num < 20) return teens[num - 10];
    if (num < 100) {
      return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '');
    }
    if (num < 1000) {
      return ones[Math.floor(num / 100)] + ' hundred' + (num % 100 ? ' ' + this.numberToWords(num % 100) : '');
    }
    
    // Handle larger numbers
    let result = '';
    let thousandIndex = 0;
    
    while (num > 0) {
      const chunk = num % 1000;
      if (chunk !== 0) {
        const chunkWords = this.numberToWords(chunk);
        result = chunkWords + (thousands[thousandIndex] ? ' ' + thousands[thousandIndex] : '') + (result ? ' ' + result : '');
      }
      num = Math.floor(num / 1000);
      thousandIndex++;
    }
    
    return result;
  }

  /**
   * Convert number to ordinal words
   */
  private numberToOrdinal(num: number): string {
    const ordinals: Record<number, string> = {
      1: 'first', 2: 'second', 3: 'third', 4: 'fourth', 5: 'fifth',
      6: 'sixth', 7: 'seventh', 8: 'eighth', 9: 'ninth', 10: 'tenth',
      11: 'eleventh', 12: 'twelfth', 13: 'thirteenth', 14: 'fourteenth', 15: 'fifteenth',
      16: 'sixteenth', 17: 'seventeenth', 18: 'eighteenth', 19: 'nineteenth', 20: 'twentieth',
      21: 'twenty first', 22: 'twenty second', 23: 'twenty third', 30: 'thirtieth'
    };
    
    if (ordinals[num]) return ordinals[num];
    
    // For larger ordinals, use pattern
    if (num > 20) {
      const lastDigit = num % 10;
      const tens = Math.floor(num / 10) * 10;
      if (lastDigit === 0) {
        const tensWord = this.numberToWords(tens);
        return tensWord.slice(0, -1) + 'ieth';
      } else {
        return this.numberToWords(tens) + ' ' + this.numberToOrdinal(lastDigit);
      }
    }
    
    return this.numberToWords(num) + 'th';
  }

  /**
   * Get month name from number
   */
  private getMonthName(month: number): string {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month - 1] || 'Invalid Month';
  }

  /**
   * Convert time to words
   */
  private timeToWords(hour: number, minute: number): string {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    
    if (minute === 0) {
      return `${this.numberToWords(displayHour)} o'clock ${period}`;
    } else if (minute === 15) {
      return `quarter past ${this.numberToWords(displayHour)} ${period}`;
    } else if (minute === 30) {
      return `half past ${this.numberToWords(displayHour)} ${period}`;
    } else if (minute === 45) {
      const nextHour = displayHour === 12 ? 1 : displayHour + 1;
      return `quarter to ${this.numberToWords(nextHour)} ${period}`;
    } else {
      return `${this.numberToWords(displayHour)} ${this.numberToWords(minute)} ${period}`;
    }
  }

  /**
   * Convert fraction to words
   */
  private fractionToWords(numerator: number, denominator: number): string {
    const fractions: Record<string, string> = {
      '1/2': 'one half',
      '1/3': 'one third',
      '2/3': 'two thirds',
      '1/4': 'one quarter',
      '3/4': 'three quarters',
      '1/5': 'one fifth',
      '2/5': 'two fifths',
      '3/5': 'three fifths',
      '4/5': 'four fifths'
    };
    
    const key = `${numerator}/${denominator}`;
    if (fractions[key]) return fractions[key];
    
    const numWords = this.numberToWords(numerator);
    const denWords = this.numberToOrdinal(denominator);
    return `${numWords} ${denWords}${numerator > 1 ? 's' : ''}`;
  }
}

export default DashVoiceService;
