/**
 * ChatGPT-Style Voice Controller Hook
 * 
 * Enhanced voice interaction hook that provides:
 * - Continuous conversation flow
 * - Natural turn-taking
 * - Voice activity detection
 * - Seamless interruption handling
 * - Auto-listening after AI responses
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRealtimeVoice } from '@/hooks/useRealtimeVoice';
import type { IDashAIAssistant, DashMessage } from '@/services/dash-ai/DashAICompat';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';

export type ChatGPTVoiceState = 
  | 'disconnected'
  | 'connecting' 
  | 'listening' 
  | 'processing' 
  | 'speaking' 
  | 'waiting'
  | 'error';

export interface VoiceActivity {
  isActive: boolean;
  level: number; // 0-1
  duration: number; // ms
}

export interface ChatGPTVoiceController {
  // State
  state: ChatGPTVoiceState;
  isConnected: boolean;
  voiceActivity: VoiceActivity;
  currentTranscript: string;
  currentResponse: string;
  
  // Controls
  startConversation: () => Promise<boolean>;
  stopConversation: () => Promise<void>;
  interruptAI: () => Promise<void>;
  toggleAutoListen: () => void;
  manualTalk: () => void;
  
  // Settings
  autoListenEnabled: boolean;
  language: string;
  
  // Events
  onUserMessage?: (transcript: string) => void;
  onAIResponse?: (response: DashMessage) => void;
  onStateChange?: (state: ChatGPTVoiceState) => void;
}

interface UseChatGPTVoiceOptions {
  dashInstance: IDashAIAssistant | null;
  onUserMessage?: (transcript: string) => void;
  onAIResponse?: (response: DashMessage) => void;
  onStateChange?: (state: ChatGPTVoiceState) => void;
  autoListenDefault?: boolean;
  vadSensitivity?: number; // 0-1, higher = more sensitive
  silenceThreshold?: number; // ms before considering speech ended
}

export function useChatGPTVoice(options: UseChatGPTVoiceOptions): ChatGPTVoiceController {
  const {
    dashInstance,
    onUserMessage,
    onAIResponse,
    onStateChange,
    autoListenDefault = true,
    vadSensitivity = 0.7,
    silenceThreshold = 1000,
  } = options;

  const { i18n } = useTranslation();
  
  // Core state
  const [state, setState] = useState<ChatGPTVoiceState>('disconnected');
  const [isConnected, setIsConnected] = useState(false);
  const [autoListenEnabled, setAutoListenEnabled] = useState(autoListenDefault);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [currentResponse, setCurrentResponse] = useState('');
  
  // Voice activity detection
  const [voiceActivity, setVoiceActivity] = useState<VoiceActivity>({
    isActive: false,
    level: 0,
    duration: 0,
  });
  
  // Internal state management
  const processingRef = useRef(false);
  const interruptedRef = useRef(false);
  const voiceStartTimeRef = useRef<number>(0);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const activityTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Language mapping
  const mapLanguage = useCallback((lang?: string) => {
    const base = String(lang || '').toLowerCase();
    if (base.startsWith('af')) return 'af';
    if (base.startsWith('zu')) return 'zu';
    if (base.startsWith('xh')) return 'xh';
    if (base.startsWith('nso')) return 'nso';
    return 'en';
  }, []);
  
  const language = mapLanguage(i18n?.language);

  // Enhanced realtime voice with ChatGPT optimizations
  const realtimeVoice = useRealtimeVoice({
    enabled: true,
    language,
    vadSilenceMs: silenceThreshold,
    onPartialTranscript: (text) => {
      const transcript = String(text || '').trim();
      setCurrentTranscript(transcript);
      
      if (transcript.length > 0) {
        // Update voice activity
        const now = Date.now();
        if (!voiceActivity.isActive) {
          voiceStartTimeRef.current = now;
        }
        
        const duration = now - voiceStartTimeRef.current;
        const level = Math.min(transcript.length / 20 * vadSensitivity, 1);
        
        setVoiceActivity({
          isActive: true,
          level,
          duration,
        });
        
        // Clear existing timeouts
        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current);
          silenceTimeoutRef.current = null;
        }
        
        if (activityTimeoutRef.current) {
          clearTimeout(activityTimeoutRef.current);
          activityTimeoutRef.current = null;
        }
        
        // Interrupt AI if user starts speaking during AI response
        if (state === 'speaking' && transcript.length >= 2) {
          handleInterruption();
        }
        
        // Start activity timeout to detect when user stops speaking
        activityTimeoutRef.current = setTimeout(() => {
          setVoiceActivity(prev => ({ ...prev, isActive: false, level: 0 }));
        }, 500);
      }
    },
    onFinalTranscript: async (text) => {
      const transcript = String(text || '').trim();
      console.log('[ChatGPTVoice] Final transcript:', transcript);
      
      if (!transcript || processingRef.current) return;
      
      // Reset voice activity
      setVoiceActivity({ isActive: false, level: 0, duration: 0 });
      setCurrentTranscript(transcript);
      
      // Notify listeners
      onUserMessage?.(transcript);
      
      // Process the message
      await processUserMessage(transcript);
    },
    onStatusChange: (status) => {
      console.log('[ChatGPTVoice] Stream status:', status);
      setIsConnected(status === 'streaming');
      
      if (status === 'error') {
        setState('error');
      } else if (status === 'streaming' && state === 'connecting') {
        setState('listening');
      }
    },
  });

  // Handle AI interruption
  const handleInterruption = useCallback(async () => {
    if (state !== 'speaking') return;
    
    console.log('[ChatGPTVoice] Handling user interruption');
    interruptedRef.current = true;
    
    try {
      await dashInstance?.stopSpeaking();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setState('listening');
      setCurrentResponse('');
    } catch (error) {
      console.error('[ChatGPTVoice] Failed to interrupt AI:', error);
    }
  }, [state, dashInstance]);

  // Process user message and generate AI response
  const processUserMessage = useCallback(async (transcript: string) => {
    if (!dashInstance || processingRef.current) return;
    
    try {
      processingRef.current = true;
      interruptedRef.current = false;
      setState('processing');
      
      console.log('[ChatGPTVoice] Processing user message:', transcript);
      
      // Send message to AI
      const response = await dashInstance.sendMessage(transcript);
      
      // Notify listeners
      onAIResponse?.(response);
      
      const responseText = response.content || '';
      setCurrentResponse(responseText);
      
      // Check if response should be spoken
      const shouldSpeak = !(response.metadata as any)?.doNotSpeak;
      
      if (responseText && shouldSpeak && !interruptedRef.current) {
        setState('speaking');
        await speakAIResponse(responseText);
        
        // After speaking, decide next state
        if (!interruptedRef.current) {
          if (autoListenEnabled) {
            // Automatically start listening for next user input
            setTimeout(() => {
              if (state !== 'error') {
                setState('listening');
                setCurrentTranscript('');
                setCurrentResponse('');
              }
            }, 800); // Brief pause before listening again
          } else {
            setState('waiting');
          }
        }
      } else {
        // No speech or interrupted
        setState(autoListenEnabled ? 'listening' : 'waiting');
        if (autoListenEnabled) {
          setCurrentTranscript('');
          setCurrentResponse('');
        }
      }
    } catch (error) {
      console.error('[ChatGPTVoice] Error processing message:', error);
      setState('error');
    } finally {
      processingRef.current = false;
    }
  }, [dashInstance, autoListenEnabled, state, onAIResponse]);

  // Speak AI response
  const speakAIResponse = useCallback(async (text: string) => {
    if (!dashInstance || interruptedRef.current) return;
    
    try {
      const dummyMessage: DashMessage = {
        id: `chatgpt_voice_${Date.now()}`,
        type: 'assistant',
        content: text,
        timestamp: Date.now(),
      };
      
      await dashInstance.speakResponse(dummyMessage, {
        onStart: () => {
          if (!interruptedRef.current) {
            console.log('[ChatGPTVoice] AI speech started');
          }
        },
        onDone: () => {
          if (!interruptedRef.current) {
            console.log('[ChatGPTVoice] AI speech completed');
          }
        },
        onError: (error) => {
          console.error('[ChatGPTVoice] AI speech error:', error);
        },
      });
    } catch (error) {
      console.error('[ChatGPTVoice] Failed to speak AI response:', error);
    }
  }, [dashInstance]);

  // Start conversation
  const startConversation = useCallback(async (): Promise<boolean> => {
    if (!dashInstance) {
      console.error('[ChatGPTVoice] Cannot start: no dashInstance');
      return false;
    }
    
    try {
      setState('connecting');
      processingRef.current = false;
      interruptedRef.current = false;
      setCurrentTranscript('');
      setCurrentResponse('');
      setVoiceActivity({ isActive: false, level: 0, duration: 0 });
      
      // Check streaming availability
      const streamingEnabled = await AsyncStorage.getItem('@dash_streaming_enabled');
      if (streamingEnabled !== 'true' && !process.env.EXPO_PUBLIC_DASH_STREAMING) {
        setState('error');
        return false;
      }
      
      // Start voice stream
      const connected = await realtimeVoice.startStream();
      if (connected) {
        setState('listening');
        setIsConnected(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        return true;
      } else {
        setState('error');
        return false;
      }
    } catch (error) {
      console.error('[ChatGPTVoice] Failed to start conversation:', error);
      setState('error');
      return false;
    }
  }, [dashInstance, realtimeVoice]);

  // Stop conversation
  const stopConversation = useCallback(async () => {
    try {
      // Clear all timeouts
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = null;
      }
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
        activityTimeoutRef.current = null;
      }
      
      // Stop voice stream
      await realtimeVoice.stopStream();
      
      // Stop AI speech
      await dashInstance?.stopSpeaking();
      
      // Reset state
      setState('disconnected');
      setIsConnected(false);
      setCurrentTranscript('');
      setCurrentResponse('');
      setVoiceActivity({ isActive: false, level: 0, duration: 0 });
      processingRef.current = false;
      interruptedRef.current = false;
      
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error('[ChatGPTVoice] Failed to stop conversation:', error);
    }
  }, [realtimeVoice, dashInstance]);

  // Interrupt AI
  const interruptAI = useCallback(async () => {
    await handleInterruption();
  }, [handleInterruption]);

  // Toggle auto-listen
  const toggleAutoListen = useCallback(() => {
    const newValue = !autoListenEnabled;
    setAutoListenEnabled(newValue);
    
    // Save preference
    AsyncStorage.setItem('@chatgpt_voice_auto_listen', String(newValue));
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [autoListenEnabled]);

  // Manual talk (when in waiting state)
  const manualTalk = useCallback(() => {
    if (state === 'waiting' || state === 'disconnected') {
      setState('listening');
      setCurrentTranscript('');
      setCurrentResponse('');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, [state]);

  // Load auto-listen preference
  useEffect(() => {
    AsyncStorage.getItem('@chatgpt_voice_auto_listen').then(value => {
      if (value !== null) {
        setAutoListenEnabled(value === 'true');
      }
    });
  }, []);

  // Notify state changes
  useEffect(() => {
    onStateChange?.(state);
  }, [state, onStateChange]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
      }
    };
  }, []);

  return {
    // State
    state,
    isConnected,
    voiceActivity,
    currentTranscript,
    currentResponse,
    
    // Controls
    startConversation,
    stopConversation,
    interruptAI,
    toggleAutoListen,
    manualTalk,
    
    // Settings
    autoListenEnabled,
    language,
  };
}

export default useChatGPTVoice;
