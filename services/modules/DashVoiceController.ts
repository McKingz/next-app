/**
 * DashVoiceController
 * 
 * Handles voice synthesis (TTS) for Dash AI Assistant responses.
 * Supports Azure TTS for SA languages via Edge Function with device TTS fallback.
 * 
 * Extracted from DashAIAssistant.ts as part of Phase 4 modularization.
 */

import * as Speech from 'expo-speech';
import { Platform } from 'react-native';
import { voiceService } from '@/lib/voice/client';
import type { DashMessage } from '@/services/dash-ai/types';

export interface VoiceSettings {
  rate: number;
  pitch: number;
  language: string;
  voice?: 'male' | 'female';
}

export interface SpeechCallbacks {
  onStart?: () => void;
  onDone?: () => void;
  onStopped?: () => void;
  onError?: (error: any) => void;
}

/**
 * Manages voice synthesis and TTS for Dash AI Assistant
 */
export class DashVoiceController {
  private isSpeechAborted = false;
  private isDisposed = false;
  
  /**
   * Speak assistant message with TTS
   * Uses Azure for SA languages (af, zu, xh, nso), device TTS for others
   */
  public async speakResponse(
    message: DashMessage,
    voiceSettings: VoiceSettings,
    callbacks?: SpeechCallbacks
  ): Promise<void> {
    if (message.type !== 'assistant') return;
    
    this.checkDisposed();
    this.isSpeechAborted = false;
    
    try {
      if (this.isSpeechAborted) {
        callbacks?.onStopped?.();
        return;
      }
      
      const normalizedText = this.normalizeTextForSpeech(message.content);
      if (normalizedText.length === 0) {
        callbacks?.onError?.('No speakable content');
        return;
      }
      
      // Derive language
      const prefs = await voiceService.getPreferences().catch(() => null);
      let language = (prefs?.language as any) || undefined;
      if (!language) {
        const metaLang = (message.metadata?.detected_language || '').toString();
        if (metaLang) language = this.mapLanguageCode(metaLang);
        else language = this.detectLanguageFromText(message.content);
      }
      if (!language) language = (voiceSettings.language?.toLowerCase()?.slice(0, 2) as any) || 'en';
      
      // Prefer Azure TTS for all supported locales; device TTS is last resort
      try {
        await this.speakWithAzureTTS(normalizedText, language, callbacks);
        if (this.isSpeechAborted) callbacks?.onStopped?.();
        return;
      } catch (azureError) {
        console.error('[DashVoiceController] Azure TTS failed, falling back:', azureError);
      }
      
      // Device TTS fallback
      await this.speakWithDeviceTTS(normalizedText, voiceSettings, callbacks);
    } catch (error) {
      console.error('[DashVoiceController] Failed to speak:', error);
      callbacks?.onError?.(error);
      throw error;
    }
  }
  
  /**
   * Stop all speech playback
   */
  public async stopSpeaking(): Promise<void> {
    try {
      this.isSpeechAborted = true;
      
      if (Speech && typeof Speech.stop === 'function') {
        await Speech.stop();
      }
      
      const { audioManager } = await import('@/lib/voice/audio');
      await audioManager.stop();
    } catch (error) {
      console.error('[DashVoiceController] Failed to stop:', error);
    }
  }
  
  /**
   * Speak using Azure TTS via Edge Function
   */
  private async speakWithAzureTTS(
    text: string,
    language: string,
    callbacks?: SpeechCallbacks
  ): Promise<void> {
    const { assertSupabase } = await import('@/lib/supabase');
    const supabase = assertSupabase();
    
    // The Edge Function expects short codes (af, zu, xh, nso, en)
    const shortCode = this.mapLanguageCode(language);
    
    const { data, error } = await supabase.functions.invoke('tts-proxy', {
      body: { text, language: shortCode, rate: 5, pitch: 0 }
    });
    
    if (error) throw error;
    if (data.fallback === 'device') throw new Error('Edge Function returned device fallback');
    if (!data.audio_url) throw new Error('No audio URL');
    
    if (this.isSpeechAborted) {
      callbacks?.onStopped?.();
      return;
    }
    
    callbacks?.onStart?.();
    
    const { audioManager } = await import('@/lib/voice/audio');
    await audioManager.play(data.audio_url, (state) => {
      if (this.isSpeechAborted) {
        audioManager.stop();
        callbacks?.onStopped?.();
        return;
      }
      if (!state.isPlaying && state.position === 0 && !state.error) {
        callbacks?.onDone?.();
      } else if (state.error) {
        callbacks?.onError?.(new Error(state.error));
      }
    });
  }
  
  /**
   * Speak using device TTS (expo-speech)
   */
  private async speakWithDeviceTTS(
    text: string,
    voiceSettings: VoiceSettings,
    callbacks?: SpeechCallbacks
  ): Promise<void> {
    let adjustedPitch = voiceSettings.pitch || 1.0;
    let adjustedRate = voiceSettings.rate || 1.0;
    let selectedVoice: string | undefined;
    
    if (Platform.OS === 'android') {
      adjustedPitch = voiceSettings.voice === 'male' 
        ? Math.max(0.7, adjustedPitch * 0.85)
        : Math.min(1.5, adjustedPitch * 1.15);
    } else if (Speech && typeof Speech.getAvailableVoicesAsync === 'function') {
      try {
        const voices = await Speech.getAvailableVoicesAsync();
        const langCode = voiceSettings.language?.substring(0, 2) || 'en';
        const matching = voices.filter(v => v.language?.startsWith(langCode));
        if (matching.length > 0) {
          const targetGender = voiceSettings.voice;
          if (targetGender === 'male') {
            const male = matching.find(v => 
              v.name?.toLowerCase().includes('male') || 
              (v as any).gender === 'male'
            );
            selectedVoice = male?.identifier || matching[0]?.identifier;
          } else {
            const female = matching.find(v =>
              v.name?.toLowerCase().includes('female') ||
              (v as any).gender === 'female'
            );
            selectedVoice = female?.identifier || matching[0]?.identifier;
          }
        }
      } catch {
        // Use default voice
      }
    }
    
    return new Promise<void>((resolve, reject) => {
      if (this.isSpeechAborted) {
        callbacks?.onStopped?.();
        resolve();
        return;
      }
      
      const options: any = {
        language: voiceSettings.language,
        pitch: adjustedPitch,
        rate: adjustedRate,
        onStart: () => {
          if (this.isSpeechAborted) {
            Speech.stop();
            callbacks?.onStopped?.();
            resolve();
            return;
          }
          callbacks?.onStart?.();
        },
        onDone: () => {
          this.isSpeechAborted ? callbacks?.onStopped?.() : callbacks?.onDone?.();
          resolve();
        },
        onStopped: () => {
          callbacks?.onStopped?.();
          resolve();
        },
        onError: (error: any) => {
          callbacks?.onError?.(error);
          reject(error);
        }
      };
      
      if (Platform.OS === 'ios' && selectedVoice) options.voice = selectedVoice;
      
      if (Speech && typeof Speech.speak === 'function') {
        Speech.speak(text, options);
      } else {
        reject(new Error('Speech module not available'));
      }
    });
  }
  
  /**
   * Normalize text for speech (remove markdown, fix awkward phrases)
   */
  private normalizeTextForSpeech(text: string): string {
    let normalized = text
      .replace(/```[\s\S]*?```/g, '') // Remove code blocks
      .replace(/`[^`]+`/g, '') // Remove inline code
      .replace(/\*\*([^*]+)\*\*/g, '$1') // Bold
      .replace(/\*([^*]+)\*/g, '$1') // Italic
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Links
      .replace(/#{1,6}\s+/g, '') // Headers
      .replace(/>\s+/g, '') // Blockquotes
      .replace(/[-*+]\s+/g, '') // Lists
      .replace(/\n{2,}/g, '. ') // Multi-newlines
      .replace(/\n/g, ' ') // Single newlines
      // IMPROVEMENT: Remove "User:" and "Assistant:" prefixes that shouldn't be spoken
      .replace(/^\s*User:\s*/gi, '') // Remove "User:" at start
      .replace(/\bUser:\s*/gi, '') // Remove "User:" anywhere
      .replace(/^\s*Assistant:\s*/gi, '') // Remove "Assistant:" at start
      .replace(/\bAssistant:\s*/gi, '') // Remove "Assistant:" anywhere
      .trim();
    
    // Fix awkward age and quantity phrases
    normalized = normalized
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
    
    return normalized;
  }
  
  /**
   * Detect language from text content
   */
  private detectLanguageFromText(text: string): 'en' | 'af' | 'zu' | 'xh' | 'nso' {
    const t = (text || '').toLowerCase();
    
    // Unique markers
    if (/\b(molo|ndiyabulela|uxolo|ewe|hayi|yintoni|ndiza|umntwana)\b/i.test(t)) return 'xh';
    if (/\b(sawubona|ngiyabonga|ngiyaphila|umfundi|siyakusiza|ufunde|yebo|cha)\b/i.test(t)) return 'zu';
    if (/\b(hallo|asseblief|baie|goed|graag|ek|jy|nie|met|van|is|dit)\b/i.test(t)) return 'af';
    if (/\b(thobela|le\s+kae|ke\s+a\s+leboga|hle|ka\s+kgopelo)\b/i.test(t)) return 'nso';
    
    // Shared Nguni words default to Zulu
    if (/\b(unjani|kakhulu|enkosi)\b/i.test(t)) return 'zu';
    
    return 'en';
  }
  
  /**
   * Map language code to standard format
   */
  private mapLanguageCode(code: string): string {
    const normalized = code.toLowerCase().slice(0, 2);
    const mapping: Record<string, string> = {
      'en': 'en', 'af': 'af', 'zu': 'zu', 'xh': 'xh',
      'ns': 'nso', 'st': 'nso', 'se': 'nso'
    };
    return mapping[normalized] || 'en';
  }
  
  /** Map to Azure locale (e.g., af -> af-ZA) */
  private mapAzureLocale(code: string): string {
    const c = (code || 'en').toLowerCase();
    if (c.startsWith('af')) return 'af-ZA';
    if (c.startsWith('zu')) return 'zu-ZA';
    if (c.startsWith('xh')) return 'xh-ZA';
    if (c.startsWith('nso') || c.startsWith('ns') || c.startsWith('se') || c.startsWith('st')) return 'nso-ZA';
    if (c.startsWith('en')) return 'en-ZA';
    return 'en-ZA';
  }
  
  /**
   * Dispose and clean up
   */
  public dispose(): void {
    this.stopSpeaking();
    this.isDisposed = true;
  }
  
  private checkDisposed(): void {
    if (this.isDisposed) {
      throw new Error('[DashVoiceController] Instance disposed');
    }
  }
}
