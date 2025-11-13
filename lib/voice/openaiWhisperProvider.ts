/**
 * OpenAI Whisper Speech-to-Text Provider
 * 
 * Uses OpenAI Whisper API via Supabase Edge Function for STT
 * Works on all platforms (mobile + web)
 * 
 * Benefits:
 * - Excellent SA language support (en-ZA, af-ZA, zu-ZA, xh-ZA)
 * - Simple REST API (no SDK complexity)
 * - Cost-effective ($0.006/minute vs Azure $0.017/minute)
 * - Better accuracy than device STT for native SA languages
 */

import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import type { VoiceProvider, VoiceSession, VoiceStartOptions } from './unifiedProvider';
import { normalizeLanguageCode, type SALanguageCode } from './saLanguages';

export interface WhisperSTTResult {
  text: string;
  language?: string;
  duration?: number;
  provider: 'openai-whisper';
}

class OpenAIWhisperSession implements VoiceSession {
  private recording: Audio.Recording | null = null;
  private isRecordingActive = false;
  private startOptions: VoiceStartOptions | null = null;
  private supabaseClient: any = null;
  
  async start(opts: VoiceStartOptions): Promise<boolean> {
    try {
      if (__DEV__) console.log('[WhisperSTT] Starting recording...');
      
      this.startOptions = opts;
      
      // Import Supabase client
      const { supabase } = await import('@/lib/supabase');
      this.supabaseClient = supabase;
      
      // Request audio permissions
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        console.error('[WhisperSTT] Microphone permission denied');
        return false;
      }
      
      // Configure audio mode
      if (Platform.OS !== 'web') {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });
      }
      
      // Start recording
      this.recording = new Audio.Recording();
      await this.recording.prepareToRecordAsync({
        android: {
          extension: '.m4a',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 16000, // Whisper prefers 16kHz
          numberOfChannels: 1, // Mono
          bitRate: 128000,
        },
        ios: {
          extension: '.m4a',
          outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 16000, // Whisper prefers 16kHz
          numberOfChannels: 1, // Mono
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
      } as Audio.RecordingOptions);
      
      await this.recording.startAsync();
      this.isRecordingActive = true;
      
      if (__DEV__) console.log('[WhisperSTT] Recording started');
      
      // Note: No onPartial emissions - Whisper processes complete audio only
      // Do NOT send UI strings like "Listening..." as they trigger AI responses
      
      return true;
    } catch (error) {
      console.error('[WhisperSTT] Failed to start:', error);
      this.isRecordingActive = false;
      return false;
    }
  }
  
  async stop(): Promise<void> {
    if (!this.recording || !this.isRecordingActive) {
      if (__DEV__) console.log('[WhisperSTT] No active recording to stop');
      return;
    }
    
    try {
      if (__DEV__) console.log('[WhisperSTT] Stopping recording and transcribing...');
      
      // Stop recording
      await this.recording.stopAndUnloadAsync();
      const uri = this.recording.getURI();
      this.isRecordingActive = false;
      
      if (!uri) {
        throw new Error('No recording URI available');
      }
      
      // Validate file exists
      if (Platform.OS !== 'web') {
        const fileInfo = await FileSystem.getInfoAsync(uri);
        if (!fileInfo.exists || (fileInfo.size && fileInfo.size < 1024)) {
          throw new Error('Recording file is empty or invalid');
        }
        if (__DEV__) console.log('[WhisperSTT] Recording size:', fileInfo.size, 'bytes');
      }
      
      // Transcribe via Supabase Edge Function
      const result = await this.transcribe(uri);
      
      // Emit final transcript
      if (this.startOptions?.onFinal && result.text) {
        this.startOptions.onFinal(result.text);
      }
      
      // Cleanup
      this.recording = null;
      this.startOptions = null;
      
    } catch (error) {
      console.error('[WhisperSTT] Stop/transcribe failed:', error);
      this.isRecordingActive = false;
      this.recording = null;
      throw error;
    }
  }
  
  private async transcribe(audioUri: string): Promise<WhisperSTTResult> {
    try {
      // Normalize language code
      const language: SALanguageCode = normalizeLanguageCode(
        this.startOptions?.language
      );
      
      if (__DEV__) console.log('[WhisperSTT] Transcribing (RN fetch):', { audioUri, language });
      
      // Create FormData with RN file descriptor
      const formData = new FormData();
      // @ts-ignore - RN FormData file object
      formData.append('audio', { uri: audioUri, type: 'audio/m4a', name: 'recording.m4a' });
      formData.append('language', language);
      
      // Call Edge Function via fetch (RN-compatible multipart)
      const { supabase } = await import('@/lib/supabase');
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/stt-proxy`;
      
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: formData,
      });
      
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error(`STT proxy error: ${res.status} ${t}`);
      }
      
      const data = await res.json();
      
      if (!data || !data.text) {
        throw new Error('No transcription result');
      }
      
      if (__DEV__) console.log('[WhisperSTT] Transcribed:', data.text);
      
      return {
        text: data.text,
        language: data.language || language,
        duration: data.duration,
        provider: 'openai-whisper',
      };
      
    } catch (error) {
      console.error('[WhisperSTT] Transcription failed:', error);
      throw error;
    }
  }
  
  isActive(): boolean {
    return this.isRecordingActive;
  }
  
  isConnected(): boolean {
    return this.isRecordingActive; // For Whisper, active = connected
  }
  
  setMuted(_muted: boolean): void {
    // Not applicable for Whisper (processes complete audio)
    if (__DEV__) console.log('[WhisperSTT] setMuted called (no-op for Whisper)');
  }
  
  updateConfig(_cfg: { language?: string }): void {
    // Language is set at transcription time
    if (__DEV__) console.log('[WhisperSTT] updateConfig called (no-op for Whisper)');
  }
}

/**
 * OpenAI Whisper STT Provider
 */
export const openaiWhisperProvider: VoiceProvider = {
  id: 'openai-whisper' as any,
  
  async isAvailable(): Promise<boolean> {
    try {
      // Check if we have Supabase client (proxy for Edge Function availability)
      const { supabase } = await import('@/lib/supabase');
      if (!supabase) {
        if (__DEV__) console.warn('[WhisperSTT] Supabase client not available');
        return false;
      }
      
      // Check if Audio recording is available
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        if (__DEV__) console.warn('[WhisperSTT] Audio permission not granted');
        return false;
      }
      
      if (__DEV__) console.log('[WhisperSTT] Provider available');
      return true;
      
    } catch (error) {
      if (__DEV__) console.warn('[WhisperSTT] Availability check failed:', error);
      return false;
    }
  },
  
  createSession(): VoiceSession {
    return new OpenAIWhisperSession();
  },
};
