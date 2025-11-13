/**
 * Voice Service React Hooks
 * 
 * Custom hooks for integrating voice features into React components
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { voiceService } from './client';
import { audioManager, AudioManager } from './audio';
import type {
  VoicePreference,
  TTSRequest,
  TTSResponse,
  SupportedLanguage,
  RecordingState,
  PlaybackState,
} from './types';

/**
 * Hook for managing voice preferences
 */
export function useVoicePreferences() {
  const queryClient = useQueryClient();

  const { data: preferences, isLoading, error, refetch } = useQuery({
    queryKey: ['voice-preferences'],
    queryFn: () => voiceService.getPreferences(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const saveMutation = useMutation({
    mutationFn: (prefs: Partial<VoicePreference>) => voiceService.savePreferences(prefs),
    onSuccess: (data) => {
      queryClient.setQueryData(['voice-preferences'], data);
    },
  });

  const testVoice = useCallback(
    async (language: SupportedLanguage, voiceId?: string) => {
      const audioUrl = await voiceService.testVoice(language, voiceId);
      await audioManager.play(audioUrl);
    },
    []
  );

  return {
    preferences,
    isLoading,
    error,
    savePreferences: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
    testVoice,
    refetch,
  };
}

/**
 * Hook for text-to-speech synthesis
 */
export function useTextToSpeech() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    isPlaying: false,
    duration: 0,
    position: 0,
  });

  const synthesizeMutation = useMutation({
    mutationFn: (request: TTSRequest) => voiceService.synthesize(request),
  });

  const speak = useCallback(
    async (text: string, language: SupportedLanguage, voiceId?: string) => {
      try {
        // Stop any current playback
        await audioManager.stop();

        // Synthesize speech
        const response = await synthesizeMutation.mutateAsync({
          text,
          language,
          voice_id: voiceId,
        });

        // Play the audio
        setIsPlaying(true);
        await audioManager.play(response.audio_url, (state) => {
          setPlaybackState(state);
          if (!state.isPlaying) {
            setIsPlaying(false);
          }
        });

        return response;
      } catch (error) {
        setIsPlaying(false);
        throw error;
      }
    },
    [synthesizeMutation]
  );

  const stop = useCallback(async () => {
    await audioManager.stop();
    setIsPlaying(false);
    setPlaybackState({
      isPlaying: false,
      duration: 0,
      position: 0,
    });
  }, []);

  const pause = useCallback(async () => {
    await audioManager.pause();
    setIsPlaying(false);
  }, []);

  const resume = useCallback(async () => {
    await audioManager.resume();
    setIsPlaying(true);
  }, []);

  return {
    speak,
    stop,
    pause,
    resume,
    isPlaying,
    isSynthesizing: synthesizeMutation.isPending,
    playbackState,
    error: synthesizeMutation.error,
  };
}

/**
 * Hook for audio recording
 * @deprecated Use useVoiceController with streaming instead
 * Recording via expo-av has been removed in favor of real-time streaming
 */
export function useVoiceRecording() {
  const [recordingState, setRecordingState] = useState<RecordingState>({
    isRecording: false,
    duration: 0,
  });
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const managerRef = useRef<AudioManager>(audioManager);

  // Deprecated: Recording methods no longer functional
  // Use useVoiceController with streaming instead
  
  const requestPermission = useCallback(async () => {
    console.warn('[useVoiceRecording] DEPRECATED: Use useVoiceController instead');
    setHasPermission(false);
    return false;
  }, []);

  const startRecording = useCallback(async () => {
    console.warn('[useVoiceRecording] DEPRECATED: Use useVoiceController instead');
    setRecordingState({
      isRecording: false,
      duration: 0,
      error: 'Recording via expo-av removed. Use useVoiceController with streaming.',
    });
  }, []);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    console.warn('[useVoiceRecording] DEPRECATED: Use useVoiceController instead');
    return null;
  }, []);

  const cancelRecording = useCallback(async () => {
    console.warn('[useVoiceRecording] DEPRECATED: Use useVoiceController instead');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      managerRef.current.cleanup();
    };
  }, []);

  return {
    recordingState,
    hasPermission,
    requestPermission,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}

/**
 * Hook for usage statistics
 */
export function useVoiceUsage(limit: number = 50) {
  const { data: usage, isLoading, error, refetch } = useQuery({
    queryKey: ['voice-usage', limit],
    queryFn: () => voiceService.getUsageStats(limit),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  return {
    usage: usage || [],
    isLoading,
    error,
    refetch,
  };
}

/**
 * Combined hook for voice interaction (recording + TTS)
 * 
 * This hook combines recording and TTS for a complete voice interaction flow
 */
export function useVoiceInteraction() {
  const recording = useVoiceRecording();
  const tts = useTextToSpeech();
  const { preferences } = useVoicePreferences();

  const speakWithPreferences = useCallback(
    async (text: string, languageOverride?: SupportedLanguage) => {
      const language = languageOverride || preferences?.language || 'af';
      const voiceId = preferences?.voice_id;
      return tts.speak(text, language, voiceId);
    },
    [preferences, tts]
  );

  return {
    // Recording
    ...recording,
    // TTS
    speak: speakWithPreferences,
    stopSpeaking: tts.stop,
    pauseSpeaking: tts.pause,
    resumeSpeaking: tts.resume,
    isSpeaking: tts.isPlaying,
    isSynthesizing: tts.isSynthesizing,
    playbackState: tts.playbackState,
    // Preferences
    preferredLanguage: preferences?.language || 'af',
    preferences,
  };
}
