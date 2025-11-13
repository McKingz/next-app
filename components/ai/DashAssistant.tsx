/**
 * Dash AI Assistant Chat Component
 * 
 * Modern chat interface for the Dash AI Assistant with voice recording,
 * message display, and interactive features.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Vibration,
  ActionSheetIOS,
  InteractionManager,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { styles } from './DashAssistant.styles';
import { Ionicons } from '@expo/vector-icons';
import { DashAssistantMessages } from './dash-assistant/DashAssistantMessages';
import { useTheme } from '@/contexts/ThemeContext';
import type { DashMessage, DashConversation, DashAttachment } from '@/services/dash-ai/types';
import type { IDashAIAssistant } from '@/services/dash-ai/DashAICompat';
import { useDashboardPreferences } from '@/contexts/DashboardPreferencesContext';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DashCommandPalette } from '@/components/ai/DashCommandPalette';
import { TierBadge } from '@/components/ui/TierBadge';
import { useSubscription } from '@/contexts/SubscriptionContext';
// VOICETODO: VoiceUI archived for production build
// import { useVoiceUI } from '@/components/voice/VoiceUIController';
import { assertSupabase } from '@/lib/supabase';
import { 
  pickDocuments, 
  pickImages,
  takePhoto,
  uploadAttachment,
  getFileIconName,
  formatFileSize 
} from '@/services/AttachmentService';
import { track } from '@/lib/analytics';
import { renderCAPSResults } from '@/lib/caps/parseCAPSResults';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface DashAssistantProps {
  conversationId?: string;
  onClose?: () => void;
  initialMessage?: string;
}

export const DashAssistant: React.FC<DashAssistantProps> = ({
  conversationId,
  onClose,
  initialMessage
}: DashAssistantProps) => {
  const { theme, isDark } = useTheme();
  const { setLayout } = useDashboardPreferences();
  const [messages, setMessages] = useState<DashMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<'uploading' | 'thinking' | 'responding' | null>(null);
  const [statusStartTime, setStatusStartTime] = useState<number>(0);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState<string>('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [conversation, setConversation] = useState<DashConversation | null>(null);
  const [dashInstance, setDashInstance] = useState<IDashAIAssistant | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [enterToSend, setEnterToSend] = useState(true);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [selectedAttachments, setSelectedAttachments] = useState<DashAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const prevLengthRef = useRef<number>(0);
  const { tier, ready: subReady, refresh: refreshTier } = useSubscription();
  // VOICETODO: voiceUI hook removed (archived)

  const flashListRef = useRef<FlashList<DashMessage>>(null);
  const inputRef = useRef<TextInput>(null);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Request queue for concurrency control
  const requestQueueRef = useRef<Array<{ text: string; attachments: DashAttachment[] }>>([]);
  const isProcessingRef = useRef(false);
  
  /**
   * Robust auto-scroll utility for React Native 0.79 Fabric
   * Ensures FlatList scrolls to bottom reliably after layout
   */
  const scrollToBottom = useCallback((opts?: { animated?: boolean; delay?: number }) => {
    const delay = opts?.delay ?? 120;
    const animated = opts?.animated ?? true;

    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = null;
    }

    scrollTimeoutRef.current = setTimeout(() => {
      try {
        InteractionManager.runAfterInteractions(() => {
          requestAnimationFrame(() => {
            try {
              const lastIndex = Math.max(0, (messages?.length || 1) - 1);
              flashListRef.current?.scrollToIndex({ index: lastIndex, animated });
            } catch (e) {
              console.debug('[DashAssistant] scrollToIndex failed:', e);
            }
          });
        });
      } catch (e) {
        try {
          const lastIndex = Math.max(0, (messages?.length || 1) - 1);
          flashListRef.current?.scrollToIndex({ index: lastIndex, animated });
        } catch (fallbackErr) {
          console.debug('[DashAssistant] Fallback scroll failed:', fallbackErr);
        }
      }
    }, delay);
  }, [messages?.length]);
  
  // Cleanup scroll timeouts
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Initialize Dash AI Assistant
  useEffect(() => {
    const initializeDash = async () => {
      try {
        const module = await import('@/services/dash-ai/DashAICompat');
        const DashClass = (module as any).DashAIAssistant || (module as any).default;
        const dash: IDashAIAssistant | null = DashClass?.getInstance?.() || null;
        if (!dash) throw new Error('DashAIAssistant unavailable');
        await dash.initialize();
        setDashInstance(dash);
        setIsInitialized(true);

        let hasExistingMessages = false;

        // Load existing conversation or create new one
        if (conversationId) {
          const existingConv = await dash.getConversation(conversationId);
          if (existingConv) {
            hasExistingMessages = (existingConv.messages?.length || 0) > 0;
            setConversation(existingConv);
            setMessages(existingConv.messages || []);
            dash.setCurrentConversationId(conversationId);
          }
        } else {
          // Try to resume last active conversation
          const savedConvId = await AsyncStorage.getItem('@dash_ai_current_conversation_id');
          let newConvId = savedConvId || null;
          
          if (newConvId) {
            const existingConv = await dash.getConversation(newConvId);
            if (existingConv) {
              hasExistingMessages = (existingConv.messages?.length || 0) > 0;
              setConversation(existingConv);
              setMessages(existingConv.messages || []);
              dash.setCurrentConversationId(newConvId);
            } else {
              newConvId = null;
            }
          }
          
          if (!newConvId) {
            try {
              const convs = await dash.getAllConversations();
              if (Array.isArray(convs) && convs.length > 0) {
                const latest = convs.reduce((a: any, b: any) => (a.updated_at > b.updated_at ? a : b));
                hasExistingMessages = (latest.messages?.length || 0) > 0;
                setConversation(latest);
                setMessages(latest.messages || []);
                dash.setCurrentConversationId(latest.id);
                newConvId = latest.id;
              } else {
                const createdId = await dash.startNewConversation('Chat with Dash');
                const newConv = await dash.getConversation(createdId);
                if (newConv) {
                  setConversation(newConv);
                }
              }
            } catch (e) {
              const createdId = await dash.startNewConversation('Chat with Dash');
              const newConv = await dash.getConversation(createdId);
              if (newConv) {
                setConversation(newConv);
              }
            }
          }
        }

        // Load enterToSend setting
        try {
          const enterToSendSetting = await AsyncStorage.getItem('@dash_ai_enter_to_send');
          if (enterToSendSetting !== null) {
            setEnterToSend(enterToSendSetting === 'true');
          }
        } catch {}

        // Send initial message if provided
        if (initialMessage && initialMessage.trim()) {
          // Send immediately for faster interaction
          sendMessage(initialMessage);
        } else if (!hasExistingMessages) {
          // Add greeting message only if there are no previous messages
          const greeting: DashMessage = {
            id: `greeting_${Date.now()}`,
            type: 'assistant',
            content: dash.getPersonality().greeting,
            timestamp: Date.now(),
          };
          setMessages([greeting]);
        }
      } catch (error) {
        console.error('Failed to initialize Dash:', error);
        Alert.alert('Error', 'Failed to initialize AI Assistant. Please try again.');
      }
    };

    initializeDash();
  }, [conversationId, initialMessage]);

  // Auto-scroll on mount when initialized with existing messages
  useEffect(() => {
    if (isInitialized && messages.length > 0 && flashListRef.current) {
      // Non-animated scroll on mount for instant positioning
      scrollToBottom({ animated: false, delay: 300 });
    }
    // Only run when initialization completes
     
  }, [isInitialized]);
  
  // Auto-scroll when loading states change (thinking/responding)
  useEffect(() => {
    if (isLoading && flashListRef.current) {
      // Slight delay ensures footer (typing indicator) is rendered
      scrollToBottom({ animated: true, delay: 150 });
    }
  }, [isLoading, loadingStatus, scrollToBottom]);

  // Track unread count when new messages arrive while scrolled up
  useEffect(() => {
    if (!isInitialized) return;
    const prevLen = prevLengthRef.current || 0;
    const currLen = messages.length;
    if (currLen > prevLen) {
      if (isNearBottom) {
        // If user is at bottom, keep unread at zero
        setUnreadCount(0);
      } else {
        setUnreadCount((c) => Math.min(999, c + (currLen - prevLen)));
      }
    }
    prevLengthRef.current = currLen;
  }, [messages.length, isNearBottom, isInitialized]);

  // Focus effect to refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      // Refresh conversation when screen focuses
      if (dashInstance && conversation) {
        dashInstance.getConversation(conversation.id).then((updatedConv: any) => {
          if (updatedConv && updatedConv.messages.length !== messages.length) {
            setMessages(updatedConv.messages);
            setConversation(updatedConv);
          }
        });
      }

      // Return cleanup function that runs when screen loses focus
      return () => {
        if (dashInstance && isSpeaking) {
          setIsSpeaking(false);
          dashInstance.stopSpeaking().catch(() => {
            // Ignore errors during cleanup
          });
        }
      };
    }, [dashInstance, conversation, messages.length, isSpeaking])
  );

  // Cleanup effect to stop speech when component unmounts
  useEffect(() => {
    return () => {
      // Cleanup when component unmounts (page refresh, navigation away, etc.)
      if (dashInstance) {
        dashInstance.stopSpeaking().catch(() => {
          // Ignore errors during cleanup
        });
        dashInstance.cleanup();
      }
    };
  }, [dashInstance]);

  // Handle page refresh/close in web environments
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (dashInstance && isSpeaking) {
        dashInstance.stopSpeaking().catch(() => {
          // Ignore errors during cleanup
        });
      }
    };

    // Only add event listener if we're in a web environment with proper DOM API
    // Verify both addEventListener and removeEventListener are functions to avoid RN errors
    if (
      Platform.OS === 'web' && 
      typeof window !== 'undefined' && 
      typeof window.addEventListener === 'function' &&
      typeof window.removeEventListener === 'function'
    ) {
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
      };
    }
    return undefined;
  }, [dashInstance, isSpeaking]);

  const wantsLessonGenerator = (t: string, assistantText?: string): boolean => {
    const rx = /(create|plan|generate)\s+(a\s+)?lesson(\s+plan)?|lesson\s+plan|teach\s+.*(about|on)/i
    if (rx.test(t)) return true
    if (assistantText && rx.test(assistantText)) return true
    return false
  }

  // Extract follow-up questions embedded in assistant text like "User: <question>"
  const extractFollowUps = (text: string): string[] => {
    try {
      const lines = (text || '').split(/\n+/);
      const results: string[] = [];
      for (const line of lines) {
        const m = line.match(/^\s*User:\s*(.+)$/i);
        if (m && m[1]) {
          const q = m[1].trim();
          if (q.length > 0) results.push(q);
        }
      }
      return results;
    } catch {
      return [];
    }
  }

  // Process queued requests sequentially
  const processQueue = async () => {
    if (isProcessingRef.current || requestQueueRef.current.length === 0) return;
    
    isProcessingRef.current = true;
    const request = requestQueueRef.current.shift();
    
    if (request) {
      await sendMessageInternal(request.text, request.attachments);
    }
    
    isProcessingRef.current = false;
    
    // Process next item if any
    if (requestQueueRef.current.length > 0) {
      setTimeout(() => processQueue(), 0);
    }
  };

  // Public sendMessage - handles queueing and concurrency
  const sendMessage = async (text: string = inputText.trim()) => {
    if ((!text && selectedAttachments.length === 0) || !dashInstance) return;
    
    // Check if already processing a request
    if (isProcessingRef.current) {
      // Track concurrent attempt
      track('edudash.dash_ai.concurrent_request_queued', {
        queue_length: requestQueueRef.current.length,
        timestamp: Date.now(),
      });
      
      console.log('[DashAssistant] Request queued - already processing');
    }

    // Add request to queue
    requestQueueRef.current.push({
      text,
      attachments: [...selectedAttachments],
    });

    // Clear input and attachments immediately for better UX
    setInputText('');
    setSelectedAttachments([]);

    // Start processing queue
    processQueue();
  };

  // Internal message sender (called by queue processor)
  const sendMessageInternal = async (text: string, attachments: DashAttachment[]) => {
    if (!dashInstance) return;

    try {
      setIsLoading(true);
      scrollToBottom({ animated: true, delay: 120 });
      
      // Track state: Uploading attachments
      if (attachments.length > 0) {
        setLoadingStatus('uploading');
        setStatusStartTime(Date.now());
        setIsUploading(true);
        
        track('edudash.dash_ai.status_transition', {
          from: null,
          to: 'uploading',
          attachment_count: attachments.length,
        });
      } else {
        // Skip directly to thinking if no attachments
        setLoadingStatus('thinking');
        setStatusStartTime(Date.now());
        
        track('edudash.dash_ai.status_transition', {
          from: null,
          to: 'thinking',
        });
      }

      // Upload attachments first if any
      const uploadedAttachments: DashAttachment[] = [];
      if (attachments.length > 0 && conversation?.id) {
        for (const attachment of attachments) {
          try {
            updateAttachmentProgress(attachment.id, 0, 'uploading');
            const uploaded = await uploadAttachment(
              attachment, 
              conversation.id,
              (progress) => updateAttachmentProgress(attachment.id, progress)
            );
            updateAttachmentProgress(attachment.id, 100, 'uploaded');
            uploadedAttachments.push(uploaded);
          } catch (error) {
            console.error(`Failed to upload ${attachment.name}:`, error);
            updateAttachmentProgress(attachment.id, 0, 'failed');
            Alert.alert(
              'Upload Failed', 
              `Failed to upload ${attachment.name}. Please try again.`
            );
          }
        }
        
        // Track upload completion time
        const uploadDuration = Date.now() - statusStartTime;
        track('edudash.dash_ai.upload_complete', {
          duration_ms: uploadDuration,
          file_count: attachments.length,
        });
      }

      setIsUploading(false);
      
      // Transition to thinking state
      const thinkingStartTime = Date.now();
      setLoadingStatus('thinking');
      setStatusStartTime(thinkingStartTime);
      scrollToBottom({ animated: true, delay: 120 });
      
      track('edudash.dash_ai.status_transition', {
        from: attachments.length > 0 ? 'uploading' : null,
        to: 'thinking',
        timestamp: thinkingStartTime,
      });

      const userText = text || 'Attached files';
      
      // Check if streaming is enabled (feature flag)
      // Note: Streaming disabled on React Native due to fetch limitations
      const streamingEnabled = Platform.OS === 'web' && (process.env.EXPO_PUBLIC_AI_STREAMING_ENABLED === 'true' || process.env.EXPO_PUBLIC_ENABLE_AI_STREAMING === 'true');
      
      let response: DashMessage;
      
      if (streamingEnabled) {
        // STREAMING MODE: Progressive message rendering
        const tempStreamingMsgId = `streaming_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        setStreamingMessageId(tempStreamingMsgId);
        setStreamingContent('');
        
        // Add temporary streaming message to UI for progressive rendering
        const tempStreamingMessage: DashMessage = {
          id: tempStreamingMsgId,
          type: 'assistant',
          content: '',
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, tempStreamingMessage]);
        
        // Call sendMessage with streaming callback
        response = await dashInstance.sendMessage(
          userText, 
          undefined, 
          uploadedAttachments.length > 0 ? uploadedAttachments : undefined,
          (chunk: string) => {
            // Streaming callback - update content progressively
            setStreamingContent(prev => {
              const newContent = prev + chunk;
              // Update the streaming message in the messages array
              setMessages(prevMessages => 
                prevMessages.map(msg => 
                  msg.id === tempStreamingMsgId 
                    ? { ...msg, content: newContent }
                    : msg
                )
              );
              return newContent;
            });
            // Keep newest chunk in view during streaming
            scrollToBottom({ animated: true, delay: 60 });
          }
        );
        
        // Clear streaming state and remove temporary message
        setStreamingMessageId(null);
        setStreamingContent('');
        setMessages(prev => prev.filter(msg => msg.id !== tempStreamingMsgId));
      } else {
        // NON-STREAMING MODE: Traditional all-at-once response
        response = await dashInstance.sendMessage(
          userText, 
          undefined, 
          uploadedAttachments.length > 0 ? uploadedAttachments : undefined
        );
      }
      
      // Track thinking completion time
      const thinkingDuration = Date.now() - thinkingStartTime;
      track('edudash.dash_ai.thinking_complete', {
        duration_ms: thinkingDuration,
        message_length: userText.length,
      });
      
      // Transition to responding state (for rendering response)
      setLoadingStatus('responding');
      setStatusStartTime(Date.now());
      scrollToBottom({ animated: true, delay: 120 });
      
      track('edudash.dash_ai.status_transition', {
        from: 'thinking',
        to: 'responding',
      });
      
      // Handle dashboard actions if present
      if (response.metadata?.dashboard_action?.type === 'switch_layout') {
        const newLayout = response.metadata.dashboard_action.layout;
        if (newLayout && (newLayout === 'classic' || newLayout === 'enhanced')) {
          console.log(`[Dash] Switching dashboard layout to: ${newLayout}`);
          setLayout(newLayout);
          
          // Provide haptic feedback
          try {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          } catch { /* Haptics not available */ }
        }
      } else if (response.metadata?.dashboard_action?.type === 'open_screen') {
        const { route, params } = response.metadata.dashboard_action as any;
        console.log(`[Dash] Proposed open_screen: ${route}`, params || {});
        // Require confirmation for AI Lesson Generator to avoid auto-navigation
        if (typeof route === 'string' && route.includes('/screens/ai-lesson-generator')) {
          Alert.alert(
            'Open Lesson Generator?',
            'Dash suggests opening the AI Lesson Generator with prefilled details. Please confirm the fields in the next screen, then press Generate to start.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open', onPress: () => { try { router.push({ pathname: route, params } as any); } catch (e) { console.warn('Failed to navigate:', e); } } },
            ]
          );
        } else {
          try {
            router.push({ pathname: route, params } as any);
          } catch (e) {
            console.warn('Failed to navigate to route from Dash action:', e);
          }
        }
      }
      
      // Update messages from conversation
      const updatedConv = await dashInstance.getConversation(dashInstance.getCurrentConversationId()!);
      if (updatedConv) {
        setMessages(updatedConv.messages);
        setConversation(updatedConv);
        // Auto-scroll to show the new response
        scrollToBottom({ animated: true, delay: 150 });
      }

      // Offer to open Lesson Generator when intent detected
      try {
        const intentType = response?.metadata?.user_intent?.primary_intent || ''
        const shouldOpen = intentType === 'create_lesson' || wantsLessonGenerator(userText, response?.content)
        if (shouldOpen) {
          // Ask user to proceed immediately
          Alert.alert(
            'Open Lesson Generator?',
            'I can open the AI Lesson Generator with the details we discussed. Please confirm the fields are correct in the next screen, then press Generate to create the lesson.',
            [
              { text: 'Not now', style: 'cancel' },
              { text: 'Open', onPress: () => dashInstance.openLessonGeneratorFromContext(userText, response?.content || '') }
            ]
          )
        }
      } catch {}

      // Auto-speak response immediately if enabled
      speakResponse(response);

    } catch (error) {
      console.error('Failed to send message:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
      
      // Track error state
      if (loadingStatus) {
        track('edudash.dash_ai.status_error', {
          status_at_error: loadingStatus,
          error_message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    } finally {
      setIsLoading(false);
      setLoadingStatus(null);
      
      // Track total interaction time
      if (statusStartTime > 0) {
        const totalDuration = Date.now() - statusStartTime;
        track('edudash.dash_ai.interaction_complete', {
          total_duration_ms: totalDuration,
        });
      }
    }
  };

  // VOICETODO: Voice recording disabled (archived)
  const handleInputMicPress = async () => {
    Alert.alert(
      'Voice Input Unavailable',
      'Voice input is temporarily disabled. Please use the text input instead.',
      [{ text: 'OK' }]
    );
  };

  const speakResponse = async (message: DashMessage) => {
    console.log(`[DashAssistant] speakResponse called for message: ${message.id}`);
    console.log(`[DashAssistant] Current state - isSpeaking: ${isSpeaking}, speakingMessageId: ${speakingMessageId}`);
    
    if (!dashInstance || message.type !== 'assistant') {
      console.log(`[DashAssistant] Cannot speak - dashInstance: ${!!dashInstance}, messageType: ${message.type}`);
      return;
    }

    // If already speaking this message, stop it
    if (speakingMessageId === message.id) {
      console.log(`[DashAssistant] Stopping speech for message: ${message.id}`);
      await stopSpeaking();
      return;
    }

    // Stop any current speech
    if (isSpeaking && speakingMessageId) {
      console.log(`[DashAssistant] Stopping previous speech for message: ${speakingMessageId}`);
      await stopSpeaking();
    }

    try {
      console.log(`[DashAssistant] Starting speech for message: ${message.id}`);
      setIsSpeaking(true);
      setSpeakingMessageId(message.id);
      
      await dashInstance.speakResponse(message, {
        onStart: () => {
          console.log(`[DashAssistant] Speech started for message: ${message.id}`);
          // State is already set above
        },
        onDone: () => {
          console.log(`[DashAssistant] Speech finished for message: ${message.id}`);
          setIsSpeaking(false);
          setSpeakingMessageId(null);
        },
        onStopped: () => {
          console.log(`[DashAssistant] Speech stopped for message: ${message.id}`);
          setIsSpeaking(false);
          setSpeakingMessageId(null);
        },
        onError: (error: any) => {
          console.error(`[DashAssistant] Speech error for message ${message.id}:`, error);
          setIsSpeaking(false);
          setSpeakingMessageId(null);
        }
      });
      
      console.log(`[DashAssistant] Speech completed for message: ${message.id}`);
    } catch (error) {
      console.error('Failed to speak response:', error);
      setIsSpeaking(false);
      setSpeakingMessageId(null);
    }
  };

  const stopSpeaking = async () => {
    console.log(`[DashAssistant] stopSpeaking called - current speakingMessageId: ${speakingMessageId}`);
    
    if (!dashInstance) {
      console.log(`[DashAssistant] Cannot stop speaking - no dashInstance`);
      return;
    }

    try {
      console.log(`[DashAssistant] Calling dashInstance.stopSpeaking()`);
      await dashInstance.stopSpeaking();
      console.log(`[DashAssistant] dashInstance.stopSpeaking() completed`);
      setIsSpeaking(false);
      setSpeakingMessageId(null);
      console.log(`[DashAssistant] Speech state cleared`);
    } catch (error) {
      console.error('Failed to stop speaking:', error);
      // Still clear the state even if stopping failed
      setIsSpeaking(false);
      setSpeakingMessageId(null);
    }
  };

  const handleAttachFile = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      const options = [
        'Documents',
        'Photos',
        'Cancel'
      ];
      
      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options,
            cancelButtonIndex: 2,
            title: 'Select files to attach'
          },
          (buttonIndex) => {
            if (buttonIndex === 0) {
              handlePickDocuments();
            } else if (buttonIndex === 1) {
              handlePickImages();
            }
          }
        );
      } else {
        // For Android, show a simple alert
        Alert.alert(
          'Attach Files',
          'Choose the type of files to attach',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Documents', onPress: handlePickDocuments },
            { text: 'Photos', onPress: handlePickImages }
          ]
        );
      }
    } catch (error) {
      console.error('Failed to show file picker:', error);
    }
  };

  const handlePickDocuments = async () => {
    try {
      const documents = await pickDocuments();
      if (documents.length > 0) {
        setSelectedAttachments(prev => [...prev, ...documents]);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      console.error('Failed to pick documents:', error);
      Alert.alert('Error', 'Failed to select documents. Please try again.');
    }
  };

  const handlePickImages = async () => {
    try {
      const images = await pickImages();
      if (images.length > 0) {
        setSelectedAttachments(prev => [...prev, ...images]);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      console.error('Failed to pick images:', error);
      Alert.alert('Error', 'Failed to select images. Please try again.');
    }
  };

  const handleTakePhoto = async () => {
    try {
      const photos = await takePhoto();
      if (photos.length > 0) {
        setSelectedAttachments(prev => [...prev, ...photos]);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      console.error('Failed to take photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const handleRemoveAttachment = async (attachmentId: string) => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setSelectedAttachments(prev => prev.filter(att => att.id !== attachmentId));
    } catch (error) {
      console.error('Failed to remove attachment:', error);
    }
  };

  const updateAttachmentProgress = (attachmentId: string, progress: number, status?: DashAttachment['status']) => {
    setSelectedAttachments(prev => prev.map(att => 
      att.id === attachmentId 
        ? { ...att, uploadProgress: progress, ...(status && { status }) }
        : att
    ));
  };

  const renderMessage = (message: DashMessage, index: number) => {
    const isUser = message.type === 'user';
    const isLastMessage = index === messages.length - 1;
    // Show retry button for the most recent user message
    const isLastUserMessage = isUser && (() => {
      // Find the most recent user message
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].type === 'user') {
          return i === index;
        }
      }
      return false;
    })();
    
    return (
      <View
        key={message.id}
        style={[
          styles.messageContainer,
          isUser ? styles.userMessage : styles.assistantMessage,
        ]}
      >
        {/* Avatar for assistant messages */}
        {!isUser && (
          <View style={[styles.avatarContainer, { backgroundColor: theme.primary }]}>
            <Ionicons name="sparkles" size={16} color={theme.onPrimary} />
          </View>
        )}
        
        <View
          style={[
            styles.messageBubble,
            isUser ? styles.userBubble : styles.assistantBubble,
            isUser
              ? { backgroundColor: theme.primary }
              : { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 0.5 },
            // Modern shadow with better depth
            Platform.OS === 'ios' ? {
              shadowColor: isDark ? '#000' : '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: isUser ? 0.25 : 0.12,
              shadowRadius: 4,
            } : {
              elevation: isUser ? 3 : 2,
            }
          ]}
        >
          <View style={styles.messageContentRow}>
            <Text
              style={[
                styles.messageText,
                { color: isUser ? theme.onPrimary : theme.text, flex: 1 },
              ]}
              selectable={true}
              selectionColor={isUser ? 'rgba(255,255,255,0.3)' : theme.primaryLight}
            >
              {isUser ? message.content : (message.content || '').split(/\n+/).filter(line => !/^\s*User:\s*/i.test(line)).join('\n')}
            </Text>
            
            {isUser && isLastUserMessage && !isLoading && (
              <TouchableOpacity
                style={styles.inlineBubbleRetryButton}
                onPress={() => sendMessage(message.content)}
                accessibilityLabel="Try again"
                activeOpacity={0.7}
              >
                <Ionicons 
                  name="refresh" 
                  size={14} 
                  color={theme.onPrimary} 
                />
              </TouchableOpacity>
            )}
          </View>
          
          {/* Voice note indicator */}
          {message.voiceNote && (
            <View style={styles.voiceNoteIndicator}>
              <Ionicons 
                name="mic" 
                size={12} 
                color={isUser ? theme.onPrimary : theme.textSecondary} 
              />
              <Text
                style={[
                  styles.voiceNoteDuration,
                  { color: isUser ? theme.onPrimary : theme.textSecondary },
                ]}
              >
                {Math.round((message.voiceNote.duration || 0) / 1000)}s
              </Text>
            </View>
          )}
          
          {/* Attachments display */}
          {message.attachments && message.attachments.length > 0 && (
            <View style={styles.messageAttachmentsContainer}>
              {message.attachments.map((attachment, idx) => (
                <View 
                  key={idx}
                  style={[
                    styles.messageAttachment,
                    { 
                      backgroundColor: isUser 
                        ? 'rgba(255, 255, 255, 0.2)' 
                        : theme.surfaceVariant,
                      borderColor: isUser ? 'rgba(255, 255, 255, 0.3)' : theme.border,
                    }
                  ]}
                >
                  <Ionicons 
                    name={getFileIconName(attachment.kind)} 
                    size={14} 
                    color={isUser ? theme.onPrimary : theme.text} 
                  />
                  <Text 
                    style={[
                      styles.messageAttachmentName,
                      { color: isUser ? theme.onPrimary : theme.text }
                    ]}
                    numberOfLines={1}
                  >
                    {attachment.name}
                  </Text>
                  <Text 
                    style={[
                      styles.messageAttachmentSize,
                      { color: isUser ? theme.onPrimary : theme.textSecondary }
                    ]}
                  >
                    {formatFileSize(attachment.size)}
                  </Text>
                </View>
              ))}
            </View>
          )}
          
          {/* CAPS results (tool outputs) */}
          {!isUser && message.metadata?.tool_results && (
            <View style={{ marginTop: 8 }}>
              {renderCAPSResults(message.metadata)}
            </View>
          )}

          {/* Follow-up question chips inside assistant message */}
          {!isUser && (
            () => {
              const suggestions = message.metadata?.suggested_actions && message.metadata.suggested_actions.length > 0
                ? message.metadata.suggested_actions
                : extractFollowUps(message.content);
              if (!suggestions || suggestions.length === 0) return null;
              return (
                <View style={styles.followUpContainer}>
                  {suggestions.map((q, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={[styles.followUpChip, { backgroundColor: theme.surface, borderColor: theme.border }]}
                      onPress={() => sendMessage(q)}
                      activeOpacity={0.75}
                      accessibilityRole="button"
                      accessibilityLabel={`Send: ${q}`}
                    >
                      <Text style={[styles.followUpText, { color: theme.text }]}>{q}</Text>
                      <View pointerEvents="none" style={[styles.followUpFab, { backgroundColor: theme.primary }]}> 
                        <Ionicons name="send" size={16} color={theme.onPrimary || '#fff'} />
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              );
            }
          )()}
          
          {/* PDF/Link quick action for assistant messages */}
          {!isUser && (() => {
            try {
              const content = String(message.content || '');
              const urlMatch = content.match(/https?:\/\/[^\s)]+/i);
              const url = urlMatch ? urlMatch[0] : undefined;
              if (!url) return null;
              const isPdf = /\.pdf(\?|$)/i.test(url);
              return (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 }}>
                  <TouchableOpacity
                    style={[styles.inlineSpeakButton, { backgroundColor: isPdf ? theme.primary : theme.accent }]}
                    onPress={() => {
                      if (Platform.OS === 'web') {
                        window.open(url, '_blank');
                      } else {
                        Linking.openURL(url).catch(() => Alert.alert('Open failed', 'Could not open the link'));
                      }
                    }}
                    accessibilityLabel={isPdf ? 'Open PDF' : 'Open link'}
                    activeOpacity={0.8}
                  >
                    <Ionicons name={isPdf ? 'document' : 'open-outline'} size={12} color={theme.onAccent || '#fff'} />
                  </TouchableOpacity>
                  <Text style={{ color: theme.textSecondary, fontSize: 12 }} numberOfLines={1}>
                    {isPdf ? 'Open PDF' : 'Open link'}
                  </Text>
                </View>
              );
            } catch { return null; }
          })()}

          {/* Bottom row with speak button (left) and timestamp (right) */}
          <View style={styles.messageBubbleFooter}>
            {!isUser && (
              <TouchableOpacity
                style={[
                  styles.inlineSpeakButton, 
                  { 
                    backgroundColor: speakingMessageId === message.id ? theme.error : theme.accent,
                  }
                ]}
                onPress={() => {
                  console.log(`[DashAssistant] Speak button pressed for message ${message.id}`);
                  console.log(`[DashAssistant] Currently speaking: ${speakingMessageId}`);
                  console.log(`[DashAssistant] Is same message: ${speakingMessageId === message.id}`);
                  speakResponse(message);
                }}
                activeOpacity={0.7}
                accessibilityLabel={speakingMessageId === message.id ? "Stop speaking" : "Speak message"}
              >
                <Ionicons 
                  name={speakingMessageId === message.id ? "stop" : "volume-high"} 
                  size={12} 
                  color={speakingMessageId === message.id ? theme.onError || theme.background : theme.onAccent} 
                />
              </TouchableOpacity>
            )}
            <View style={{ flex: 1 }} />
            <Text
              style={[
                styles.messageTime,
                { color: isUser ? theme.onPrimary : theme.textTertiary },
              ]}
            >
              {new Date(message.timestamp).toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </Text>
          </View>
        </View>
        

      </View>
    );
  };

  const handleSuggestedAction = (action: string) => {
    // Map suggested actions to proper commands
    const actionMap: Record<string, string> = {
      'switch_to_enhanced': 'switch to enhanced dashboard',
      'switch_to_classic': 'switch to classic dashboard', 
      'dashboard_help': 'help me with dashboard settings',
      'dashboard_settings': 'show dashboard settings',
      'view_enhanced_features': 'what are enhanced dashboard features',
      'view_classic_features': 'what are classic dashboard features',
      'switch_dashboard_layout': 'help me switch dashboard layout',
      'view_options': 'show me dashboard options',
      // Additional
      'export_pdf': 'export pdf',
      'send_message': 'message parents',
      'view_financial_dashboard': 'open financial dashboard',
      'create_announcement': 'create announcement'
    };
    
    const command = actionMap[action] || action.replace('_', ' ');
    sendMessage(command);
  };

  const getActionDisplayText = (action: string): string => {
    const displayMap: Record<string, string> = {
      'switch_to_enhanced': '✨ Enhanced Dashboard',
      'switch_to_classic': '📊 Classic Dashboard',
      'dashboard_help': '❓ Dashboard Help',
      'dashboard_settings': '⚙️ Settings',
      'view_enhanced_features': '🌟 Enhanced Features',
      'view_classic_features': '📋 Classic Features',
      'switch_dashboard_layout': '🔄 Switch Layout',
      'view_options': '👀 View Options',
      'explore_features': '🔍 Explore Features',
      'lesson_planning': '📚 Lesson Planning',
      'student_management': '👥 Student Management',
    };
    
    return displayMap[action] || action.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const renderSuggestedActions = () => {
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.type === 'user' || !lastMessage.metadata?.suggested_actions) {
      return null;
    }

    return (
      <View style={styles.suggestedActionsContainer}>
        <Text style={[styles.suggestedActionsTitle, { color: theme.textSecondary }]}>
          Quick actions:
        </Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.suggestedActionsScrollContent}
        >
          {lastMessage.metadata.suggested_actions.map((action: string, index: number) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.suggestedAction, 
                { 
                  backgroundColor: action.includes('dashboard') ? theme.primaryLight : theme.surfaceVariant,
                  borderColor: action.includes('dashboard') ? theme.primary : theme.border,
                  borderWidth: 1
                },
                // Modern shadow for quick actions
                Platform.OS === 'ios' ? {
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.08,
                  shadowRadius: 3,
                } : {
                  elevation: 2,
                }
              ]}
              onPress={() => handleSuggestedAction(action)}
            >
              <Text style={[
                styles.suggestedActionText, 
                { color: action.includes('dashboard') ? theme.primary : theme.text }
              ]}>
                {getActionDisplayText(action)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderAttachmentChips = () => {
    if (selectedAttachments.length === 0) {
      return null;
    }

    return (
      <View style={styles.attachmentChipsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {selectedAttachments.map((attachment) => (
            <View 
              key={attachment.id} 
              style={[
                styles.attachmentChip,
                { 
                  backgroundColor: theme.surface,
                  borderColor: attachment.status === 'failed' ? theme.error : theme.border
                }
              ]}
            >
              <View style={styles.attachmentChipContent}>
                <Ionicons 
                  name={getFileIconName(attachment.kind)}
                  size={16} 
                  color={attachment.status === 'failed' ? theme.error : theme.text} 
                />
                <View style={styles.attachmentChipText}>
                  <Text 
                    style={[
                      styles.attachmentChipName, 
                      { color: attachment.status === 'failed' ? theme.error : theme.text }
                    ]}
                    numberOfLines={1}
                  >
                    {attachment.name}
                  </Text>
                  <Text style={[styles.attachmentChipSize, { color: theme.textSecondary }]}>
                    {formatFileSize(attachment.size)}
                  </Text>
                </View>
                
                {/* Progress indicator */}
                {attachment.status === 'uploading' && (
                  <View style={styles.attachmentProgressContainer}>
                    <ActivityIndicator size="small" color={theme.primary} />
                  </View>
                )}
                
                {/* Status indicator */}
                {attachment.status === 'uploaded' && (
                  <Ionicons name="checkmark-circle" size={16} color={theme.success} />
                )}
                
                {attachment.status === 'failed' && (
                  <Ionicons name="alert-circle" size={16} color={theme.error} />
                )}
                
                {/* Remove button */}
                {attachment.status !== 'uploading' && (
                  <TouchableOpacity
                    style={styles.attachmentChipRemove}
                    onPress={() => handleRemoveAttachment(attachment.id)}
                    accessibilityLabel={`Remove ${attachment.name}`}
                  >
                    <Ionicons name="close" size={14} color={theme.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
              
              {/* Progress bar */}
              {attachment.status === 'uploading' && attachment.uploadProgress !== undefined && (
                <View style={[styles.attachmentProgressBar, { backgroundColor: theme.surfaceVariant }]}>
                  <View 
                    style={[
                      styles.attachmentProgressFill,
                      { 
                        backgroundColor: theme.primary,
                        width: `${attachment.uploadProgress}%`
                      }
                    ]} 
                  />
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      </View>
    );
  };

  // Animated typing indicator
  const [dotAnimations] = useState([
    useRef(new Animated.Value(0.3)).current,
    useRef(new Animated.Value(0.3)).current,
    useRef(new Animated.Value(0.3)).current,
  ]);

  useEffect(() => {
    if (isLoading) {
      // Start the animation when loading begins
      const animateTyping = () => {
        const animations = dotAnimations.map((dot: any, index: number) => 
          Animated.loop(
            Animated.sequence([
              Animated.delay(index * 200), // Stagger the animation
              Animated.timing(dot, {
                toValue: 1,
                duration: 600,
                useNativeDriver: false,
              }),
              Animated.timing(dot, {
                toValue: 0.3,
                duration: 600,
                useNativeDriver: false,
              }),
            ])
          )
        );
        Animated.parallel(animations).start();
      };
      animateTyping();
    } else {
      // Stop animations and reset to default state
      dotAnimations.forEach((dot: any) => {
        dot.stopAnimation();
        dot.setValue(0.3);
      });
    }
  }, [isLoading, dotAnimations]);

  const getStatusText = (): string => {
    switch (loadingStatus) {
      case 'uploading':
        return 'Uploading files...';
      case 'thinking':
        return 'Thinking...';
      case 'responding':
        return 'Responding...';
      default:
        return 'Processing...';
    }
  };
  
  const getStatusIcon = (): string => {
    switch (loadingStatus) {
      case 'uploading':
        return 'cloud-upload-outline';
      case 'thinking':
        return 'bulb-outline';
      case 'responding':
        return 'chatbox-ellipses-outline';
      default:
        return 'ellipsis-horizontal';
    }
  };

  const renderTypingIndicator = () => {
    if (!isLoading) return null;

    return (
      <View style={styles.typingIndicator}>
        <View style={[styles.typingBubble, { backgroundColor: theme.surface }]}>
          <View style={styles.typingContentRow}>
            {/* Status Icon */}
            <Ionicons 
              name={getStatusIcon() as any} 
              size={16} 
              color={theme.accent} 
              style={{ marginRight: 8 }}
            />
            
            {/* Status Text */}
            <Text style={[styles.typingText, { color: theme.text }]}>
              {getStatusText()}
            </Text>
            
            {/* Animated Dots */}
            <View style={styles.typingDots}>
              {dotAnimations.map((dot: any, index: number) => (
                <Animated.View
                  key={index}
                  style={[
                    styles.typingDot,
                    {
                      backgroundColor: theme.accent,
                      opacity: dot,
                      transform: [
                        {
                          scale: dot.interpolate({
                            inputRange: [0.3, 1],
                            outputRange: [0.8, 1.2],
                          }),
                        },
                      ],
                    },
                  ]}
                />
              ))}
            </View>
          </View>
        </View>
      </View>
    );
  };

  if (!isInitialized) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.text }]}>
          Initializing Dash...
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <KeyboardAvoidingView 
        style={[styles.container, { backgroundColor: theme.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <View style={styles.headerLeft}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={[styles.headerTitle, { color: theme.text }]}>Dash</Text>
{subReady && tier && (
<TierBadge tier={tier as any} size="sm" />
              )}
            </View>
            <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
              AI Teaching Assistant
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          {/* VOICETODO: Voice mode disabled for production build */}
          {/* <TouchableOpacity
            style={styles.iconButton}
            accessibilityLabel="Interactive Voice Assistant"
            onPress={async () => {
              try {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                const storedLang = await AsyncStorage.getItem('@dash_voice_language');
                const detectedLang = storedLang ? storedLang.toLowerCase() : 'en';
                await voiceUI.open({ language: detectedLang, tier: String(tier || 'free') });
              } catch (error) {
                console.error('[DashAssistant] Voice UI open failed:', error);
                await voiceUI.open({ language: 'en', tier: 'free' });
              }
            }}
          >
            <Ionicons name="mic" size={screenWidth < 400 ? 18 : 22} color="#007AFF" />
          </TouchableOpacity> */}
          {isSpeaking && (
            <TouchableOpacity
              style={[styles.iconButton, { backgroundColor: theme.error }]}
              accessibilityLabel="Stop speaking"
              onPress={stopSpeaking}
            >
              <Ionicons name="stop" size={screenWidth < 400 ? 18 : 22} color={theme.onError || theme.background} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.iconButton}
            accessibilityLabel="Conversations"
            onPress={() => router.push('/screens/dash-conversations-history')}
          >
            <Ionicons name="time-outline" size={screenWidth < 400 ? 18 : 22} color={theme.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            accessibilityLabel="Settings"
            onPress={() => router.push('/screens/dash-ai-settings')}
          >
            <Ionicons name="settings-outline" size={screenWidth < 400 ? 18 : 22} color={theme.text} />
          </TouchableOpacity>
          {onClose && (
            <TouchableOpacity
              style={styles.closeButton}
              onPress={async () => {
                // Stop any ongoing speech and update UI state
                if (dashInstance) {
                  setIsSpeaking(false);
                  setSpeakingMessageId(null);
                  await dashInstance.stopSpeaking();
                  dashInstance.cleanup();
                }
                onClose();
              }}
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={screenWidth < 400 ? 20 : 24} color={theme.text} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Messages */}
      <DashAssistantMessages
        flashListRef={flashListRef}
        messages={messages}
        renderMessage={renderMessage}
        styles={styles}
        theme={theme}
        isLoading={isLoading}
        isNearBottom={isNearBottom}
        setIsNearBottom={setIsNearBottom}
        unreadCount={unreadCount}
        setUnreadCount={setUnreadCount}
        scrollToBottom={scrollToBottom}
        renderTypingIndicator={renderTypingIndicator}
        renderSuggestedActions={renderSuggestedActions}
      />

      {/* Jump to end FAB */}
      {Platform.OS === 'android' && !isNearBottom && messages.length > 0 && (
        <TouchableOpacity
          style={[styles.scrollToBottomFab, { backgroundColor: theme.primary, bottom: (styles.scrollToBottomFab?.bottom || 24) + 8 }]}
          onPress={() => { setUnreadCount(0); scrollToBottom({ animated: true, delay: 0 }); }}
          accessibilityLabel="Jump to bottom"
          activeOpacity={0.8}
        >
          <Ionicons name="chevron-down" size={20} color={theme.onPrimary || '#fff'} />
          {unreadCount > 0 && (
            <View style={[styles.scrollToBottomBadge, { backgroundColor: theme.error }]}>
              <Text style={[styles.scrollToBottomBadgeText, { color: theme.onError || '#fff' }]}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      )}

      {/* Input Area */}
      <View style={[styles.inputContainer, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
        {/* Attachment chips */}
        {renderAttachmentChips()}
        
        <View style={styles.inputRow}>
          {/* Camera button (outside input) */}
          <TouchableOpacity
            style={styles.cameraButton}
            onPress={async () => {
              try {
                await Haptics.selectionAsync();
              } catch {}
              handleTakePhoto();
            }}
            disabled={isLoading || isUploading}
            accessibilityLabel="Take photo"
            accessibilityRole="button"
          >
            <Ionicons 
              name="camera-outline" 
              size={24} 
              color={isLoading || isUploading ? theme.textTertiary : theme.textSecondary} 
            />
          </TouchableOpacity>
          
          {/* Input wrapper with paperclip inside */}
          <View style={[styles.inputWrapper, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder }]}>
            {/* Paperclip icon (inside left of input) */}
            <TouchableOpacity
              style={styles.inputLeftIcon}
              onPress={async () => {
                try {
                  await Haptics.selectionAsync();
                } catch {}
                handleAttachFile();
              }}
              disabled={isLoading || isUploading}
              accessibilityLabel="Attach files"
              accessibilityRole="button"
            >
              <Ionicons 
                name="attach" 
                size={20} 
                color={selectedAttachments.length > 0 ? theme.primary : theme.textTertiary} 
              />
              {selectedAttachments.length > 0 && (
                <View style={[styles.attachBadgeSmall, { backgroundColor: theme.primary }]}>
                  <Text style={[styles.attachBadgeSmallText, { color: theme.onPrimary }]}>
                    {selectedAttachments.length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            
            <TextInput
              ref={inputRef}
              style={[
                styles.textInput,
                { 
                  color: theme.inputText,
                  paddingLeft: 36, // Make room for paperclip icon
                }
              ]}
              placeholder={selectedAttachments.length > 0 ? "Add a message (optional)..." : "Ask Dash anything..."}
              placeholderTextColor={theme.inputPlaceholder}
              value={inputText}
              onChangeText={setInputText}
              multiline={true}
              maxLength={500}
              editable={!isLoading && !isUploading}
              onSubmitEditing={undefined}
              returnKeyType="default"
              blurOnSubmit={false}
            />
          </View>
          
          {/* Send or Mic button */}
          {(inputText.trim() || selectedAttachments.length > 0) ? (
            <TouchableOpacity
              style={[styles.sendButton, { backgroundColor: theme.primary, opacity: (isLoading || isUploading) ? 0.5 : 1 }]}
              onPress={async () => {
                console.log('[DashAssistant] Send button pressed');
                try {
                  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                } catch (e) {
                  console.log('[DashAssistant] Haptics failed:', e);
                }
                sendMessage();
              }}
              disabled={isLoading || isUploading}
              accessibilityLabel="Send message"
              accessibilityRole="button"
              activeOpacity={0.7}
            >
              {(isLoading || isUploading) ? (
                <ActivityIndicator size="small" color={theme.onPrimary} />
              ) : (
                <Ionicons name="send" size={20} color={theme.onPrimary} />
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.recordButton, { backgroundColor: theme.accent }]}
              onPress={handleInputMicPress}
              disabled={isLoading}
              accessibilityLabel="Record voice message"
              accessibilityRole="button"
            >
              <Ionicons 
                name="mic-outline" 
                size={20} 
                color={theme.onAccent} 
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
      {/* Command Palette Modal */}
      <DashCommandPalette visible={showCommandPalette} onClose={() => setShowCommandPalette(false)} />
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// Helper functions for tier badge
function getTierLabel(tier?: string) {
  const t = String(tier || '').toLowerCase()
  switch (t) {
    case 'starter': return 'Starter'
    case 'basic': return 'Basic'
    case 'premium': return 'Premium'
    case 'pro': return 'Pro'
    case 'enterprise': return 'Enterprise'
    case 'free':
    default: return 'Free'
  }
}
function getTierColor(tier?: string) {
  const t = String(tier || '').toLowerCase()
  switch (t) {
    case 'starter': return '#059669' // green
    case 'premium': return '#7C3AED' // purple
    case 'pro': return '#2563EB' // blue
    case 'enterprise': return '#DC2626' // red
    case 'basic': return '#10B981' // teal/emerald
    case 'free':
    default: return '#6B7280' // gray
  }
}

export default DashAssistant;
