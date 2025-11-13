/**
 * Voice Service Module
 * 
 * Comprehensive voice interaction system for South African languages
 * Supports Afrikaans, Zulu, Xhosa, and Sepedi
 */

// Core client
export { voiceService, VoiceServiceClient } from './client';

// React hooks (recording hooks deprecated; prefer streaming controllers)
export {
  useVoicePreferences,
  useTextToSpeech,
  useVoiceRecording,
  useVoiceUsage,
  useVoiceInteraction,
} from './hooks';

// Types
export type {
  SupportedLanguage,
  VoicePreference,
  TTSRequest,
  TTSResponse,
  TranscriptionRequest,
  TranscriptionResponse,
  VoiceUsageLog,
  RecordingState,
  PlaybackState,
  VoiceServiceError,
  LanguageInfo,
} from './types';

export { SUPPORTED_LANGUAGES, PROVIDER_PRIORITY } from './types';
