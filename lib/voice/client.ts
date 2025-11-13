/**
 * Voice Service Client
 * 
 * Client library for interacting with the TTS proxy Edge Function
 * Handles text-to-speech synthesis, voice preferences, and usage tracking
 */

import { assertSupabase } from '../supabase';
import type {
  TTSRequest,
  TTSResponse,
  VoicePreference,
  SupportedLanguage,
  VoiceServiceError,
  SUPPORTED_LANGUAGES,
} from './types';

const EDGE_FUNCTION_URL = process.env.EXPO_PUBLIC_SUPABASE_URL + '/functions/v1/tts-proxy';

class VoiceServiceClient {
  /**
   * Synthesize speech from text
   * 
   * @param request TTS request parameters
   * @returns Audio URL and metadata
   */
  async synthesize(request: TTSRequest): Promise<TTSResponse> {
    const supabase = assertSupabase();
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw this.createError('AUTH_REQUIRED', 'User must be authenticated to use voice services');
      }

      const response = await fetch(EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'synthesize',
          ...request,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw this.createError(
          'TTS_FAILED',
          errorData.error || `TTS request failed with status ${response.status}`,
          errorData.provider,
          errorData
        );
      }

      const raw = await response.json();

      // Normalize response keys and handle fallback responses
      if (raw?.fallback === 'device') {
        throw this.createError('DEVICE_FALLBACK', 'Edge function requested device TTS fallback', 'device', raw);
      }

      const normalized: TTSResponse = {
        audio_url: raw.audio_url || raw.audioUrl,
        cache_hit: (raw.cache_hit ?? raw.cacheHit) ?? false,
        provider: raw.provider || 'azure',
        content_hash: raw.content_hash || raw.contentHash || '',
        duration_ms: raw.duration_ms || raw.durationMs,
      } as TTSResponse;

      if (!normalized.audio_url) {
        throw this.createError('NO_AUDIO_URL', 'TTS proxy did not return an audio URL', normalized.provider, raw);
      }

      return normalized;
    } catch (error) {
      if ((error as VoiceServiceError).code) {
        throw error;
      }
      throw this.createError('NETWORK_ERROR', 'Failed to connect to voice service', undefined, error);
    }
  }

  /**
   * Get user's voice preferences
   * 
   * @returns User's voice preference or null
   */
  async getPreferences(): Promise<VoicePreference | null> {
    const supabase = assertSupabase();
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!user) {
        throw this.createError('AUTH_REQUIRED', 'User must be authenticated');
      }

      const { data, error } = await supabase
        .from('voice_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('[VoiceService] Failed to fetch preferences:', error);
        return null;
      }

      if (!data) {
        return null;
      }

      // Map database schema to TypeScript types
      return {
        user_id: data.user_id,
        language: data.language_code as SupportedLanguage,
        voice_id: data.tts_voice_id || '',
        speaking_rate: data.tts_rate ? 1.0 + (data.tts_rate / 100) : 1.0,
        pitch: data.tts_pitch ? 1.0 + (data.tts_pitch / 100) : 1.0,
        volume: 1.0, // Not in DB schema, default
        created_at: data.created_at,
        updated_at: data.updated_at,
      };
    } catch (error) {
      if ((error as VoiceServiceError).code) {
        throw error;
      }
      console.error('[VoiceService] Failed to fetch preferences:', error);
      return null;
    }
  }

  /**
   * Save or update user's voice preferences
   * 
   * @param preferences Voice preference settings
   */
  async savePreferences(preferences: Partial<VoicePreference>): Promise<VoicePreference> {
    const supabase = assertSupabase();
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!user || !session) {
        throw this.createError('AUTH_REQUIRED', 'User must be authenticated');
      }

      // Get preschool_id and role from session JWT
      const preschoolId = (session.user as any)?.user_metadata?.preschool_id || 
                         (session as any)?.preschool_id;
      const role = (session.user as any)?.user_metadata?.role || 'parent';

      if (!preschoolId) {
        console.warn('[VoiceService] No preschool_id found in session, cannot save preferences');
        throw this.createError('MISSING_PRESCHOOL', 'Preschool ID required');
      }

      // Map TypeScript types to database schema
      const dbData: any = {
        user_id: user.id,
        preschool_id: preschoolId,
        role: role,
        updated_at: new Date().toISOString(),
      };

      if (preferences.language) {
        dbData.language_code = preferences.language;
      }
      if (preferences.voice_id) {
        dbData.tts_voice_id = preferences.voice_id;
      }
      if (preferences.speaking_rate !== undefined) {
        // Convert from 0.5-2.0 range to -50 to +50 range
        dbData.tts_rate = Math.round((preferences.speaking_rate - 1.0) * 100);
      }
      if (preferences.pitch !== undefined) {
        // Convert from 0.5-2.0 range to -50 to +50 range
        dbData.tts_pitch = Math.round((preferences.pitch - 1.0) * 100);
      }

      const { data, error } = await supabase
        .from('voice_preferences')
        .upsert(dbData, {
          onConflict: 'preschool_id,user_id',
        })
        .select()
        .maybeSingle();

      if (error) {
        console.error('[VoiceService] Save error:', error);
        throw error;
      }

      if (!data) {
        throw new Error('No data returned after upsert');
      }

      // Map back to TypeScript types
      return {
        user_id: data.user_id,
        language: data.language_code as SupportedLanguage,
        voice_id: data.tts_voice_id || '',
        speaking_rate: data.tts_rate ? 1.0 + (data.tts_rate / 100) : 1.0,
        pitch: data.tts_pitch ? 1.0 + (data.tts_pitch / 100) : 1.0,
        volume: 1.0,
        created_at: data.created_at,
        updated_at: data.updated_at,
      };
    } catch (error) {
      if ((error as VoiceServiceError).code) {
        throw error;
      }
      console.error('[VoiceService] Failed to save preferences:', error);
      throw this.createError('SAVE_FAILED', 'Failed to save voice preferences', undefined, error);
    }
  }

  /**
   * Test voice output with sample text
   * 
   * @param language Language to test
   * @param voiceId Voice ID to test (optional)
   * @returns Audio URL for testing
   */
  async testVoice(language: SupportedLanguage, voiceId?: string): Promise<string> {
    const { SUPPORTED_LANGUAGES } = await import('./types');
    const languageInfo = SUPPORTED_LANGUAGES[language];
    
    const response = await this.synthesize({
      text: languageInfo.sampleText,
      language,
      voice_id: voiceId || languageInfo.defaultVoiceId,
    });

    return response.audio_url;
  }

  /**
   * Get usage statistics for the current user
   * 
   * @param limit Number of recent logs to fetch
   * @returns Array of usage logs
   */
  async getUsageStats(limit: number = 50) {
    const supabase = assertSupabase();
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw this.createError('AUTH_REQUIRED', 'User must be authenticated');
      }

      const { data, error } = await supabase
        .from('voice_usage_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('[VoiceService] Failed to fetch usage stats:', error);
      return [];
    }
  }

  /**
   * Create a standardized error object
   */
  private createError(
    code: string,
    message: string,
    provider?: string,
    details?: any
  ): VoiceServiceError {
    return {
      code,
      message,
      provider,
      details,
    };
  }

  /**
   * Check if a language is supported
   */
  async isLanguageSupported(language: string): Promise<boolean> {
    const { SUPPORTED_LANGUAGES } = await import('./types');
    return language in SUPPORTED_LANGUAGES;
  }

  /**
   * Get all supported languages
   */
  async getSupportedLanguages() {
    const { SUPPORTED_LANGUAGES } = await import('./types');
    return SUPPORTED_LANGUAGES;
  }
}

// Export singleton instance
export const voiceService = new VoiceServiceClient();

// Export class for testing/custom instances
export { VoiceServiceClient };
