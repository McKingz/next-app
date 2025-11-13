/**
 * Ultra-Fast Voice Recording System for Dash
 * 
 * Sub-500ms startup time with live waveform visualization,
 * real-time transcription, and agentic AI assistance
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  Dimensions,
  InteractionManager,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { ultraMemo, useSmartCallback, useStableStyles } from '@/lib/smart-memo';
import { logger } from '@/lib/logger';
import { safeAsync } from '@/lib/global-errors';
import { VoicePipeline, type TranscriptionChunk, type RecordingState } from '@/lib/voice-pipeline';
import { useTranslation } from 'react-i18next';

const { width: screenWidth } = Dimensions.get('window');

interface UltraVoiceRecorderProps {
  onTranscriptionComplete?: (text: string, audioUri?: string) => void;
  onRecordingStart?: () => void;
  onRecordingStop?: () => void;
  onError?: (error: Error) => void;
  maxDuration?: number;
  enableLiveTranscription?: boolean;
  style?: any;
  testID?: string;
}

interface VoiceRecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  liveTranscription: string;
  isProcessing: boolean;
  recordingUri?: string;
}

/**
 * Ultra-fast voice recorder with < 500ms startup time
 */
export const UltraVoiceRecorder = ultraMemo<UltraVoiceRecorderProps>(({
  onTranscriptionComplete,
  onRecordingStart,
  onRecordingStop,
  onError,
  maxDuration = 300000, // 5 minutes
  enableLiveTranscription = true,
  style,
  testID,
}) => {
  const { t } = useTranslation();
  const [state, setState] = useState<VoiceRecordingState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    liveTranscription: '',
    isProcessing: false,
  });

  // Memoize translated labels to avoid excessive t() calls on every render
  const labels = useMemo(() => ({
    processing: t('voice.recording.processing'),
    transcriptionLabel: t('voice.recording.transcription_label'),
    analyzing: t('voice.recording.analyzing'),
    clear: t('voice.recording.clear'),
    send: t('voice.recording.send'),
  }), [t]);

  const pipelineRef = useRef<VoicePipeline>(new VoicePipeline({
    maxDuration,
    quality: 'adaptive',
    silenceDetectionMs: 2000,
    enableBackgroundRecording: false,
  }));
  const waveformAnimation = useRef(new Animated.Value(0)).current;
  const pulseAnimation = useRef(new Animated.Value(1)).current;
  const audioLevelIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pre-warm audio system on mount for ultra-fast startup
  useEffect(() => {
    const preWarmAudio = async () => {
      try {
        await pipelineRef.current.preWarm();
        logger.debug('🚀 Voice pipeline ready');
      } catch (error) {
        logger.warn('Voice pipeline pre-warm failed', error);
      }
    };

    // Pre-warm after component mount but don't block rendering
    InteractionManager.runAfterInteractions(preWarmAudio);

    return () => {
      // Cleanup on unmount
      if (audioLevelIntervalRef.current) {
        clearInterval(audioLevelIntervalRef.current);
      }
      if (state.isRecording) {
        pipelineRef.current.cancelRecording();
      }
    };
  }, []);

  // Ultra-fast recording start with optimized pipeline
  const startRecording = useSmartCallback(async () => {
    if (state.isRecording) return;

    setState(prev => ({ ...prev, isProcessing: true }));

    const handleTranscription = (chunk: TranscriptionChunk) => {
      if (enableLiveTranscription) {
        setState(prev => ({
          ...prev,
          liveTranscription: prev.liveTranscription + (chunk.isFinal ? chunk.text + ' ' : chunk.text),
        }));
      }
    };

    const handleStateChange = (pipelineState: RecordingState) => {
      setState(prev => ({
        ...prev,
        isRecording: pipelineState === 'recording',
        isPaused: pipelineState === 'paused',
        isProcessing: pipelineState === 'initializing' || pipelineState === 'processing',
      }));
    };

    const success = await pipelineRef.current.startRecording(
      handleTranscription,
      handleStateChange
    );

    if (success) {
      setState(prev => ({
        ...prev,
        isRecording: true,
        isPaused: false,
        isProcessing: false,
        duration: 0,
        liveTranscription: '',
      }));

      // Start animations
      startWaveformAnimation();
      startPulseAnimation();

      // Start audio level monitoring for waveform
      startAudioLevelMonitoring();

      onRecordingStart?.();
    } else {
      setState(prev => ({ ...prev, isProcessing: false }));
      onError?.(new Error('Failed to start recording'));
    }
  }, [state.isRecording, enableLiveTranscription, onRecordingStart, onError], 'start_recording');

  // Stop recording with optimized pipeline
  const stopRecording = useSmartCallback(async () => {
    if (!state.isRecording) return;

    setState(prev => ({ ...prev, isProcessing: true }));

    // Stop animations
    stopWaveformAnimation();
    stopPulseAnimation();
    stopAudioLevelMonitoring();

    const result = await pipelineRef.current.stopRecording();

    if (result) {
      setState(prev => ({
        ...prev,
        isRecording: false,
        recordingUri: result.uri,
        duration: result.duration,
        isProcessing: false,
      }));

      onRecordingStop?.();

      // STREAMING-FIRST: With WebRTC streaming, liveTranscription is populated in real-time
      // No batch fallback - if no transcription chunks received, it's an error
      if (state.liveTranscription && state.liveTranscription.trim()) {
        // Success: We have streaming transcription
        onTranscriptionComplete?.(state.liveTranscription, result.uri || undefined);
      } else {
        // No transcription received - this shouldn't happen with WebRTC streaming
        logger.warn('No transcription chunks received during recording');
        // Still call callback with empty transcription for error handling
        onTranscriptionComplete?.('', result.uri || undefined);
      }
    } else {
      setState(prev => ({ ...prev, isProcessing: false }));
      onError?.(new Error('Failed to stop recording'));
    }
  }, [state.isRecording, state.liveTranscription, onRecordingStop, onError, onTranscriptionComplete], 'stop_recording');

  // REMOVED: processTranscription batch fallback
  // With WebRTC streaming, transcription chunks arrive in real-time via handleTranscription callback
  // No need for post-recording batch processing

  // Waveform animations
  const startWaveformAnimation = useCallback(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(waveformAnimation, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(waveformAnimation, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [waveformAnimation]);

  const stopWaveformAnimation = useCallback(() => {
    waveformAnimation.stopAnimation();
    Animated.timing(waveformAnimation, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [waveformAnimation]);

  const startPulseAnimation = useCallback(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnimation, {
          toValue: 1.2,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnimation, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnimation]);

  const stopPulseAnimation = useCallback(() => {
    pulseAnimation.stopAnimation();
    Animated.timing(pulseAnimation, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [pulseAnimation]);

  // Audio level monitoring for waveform
  const startAudioLevelMonitoring = useCallback(() => {
    audioLevelIntervalRef.current = setInterval(async () => {
      const level = await pipelineRef.current.getAudioLevel();
      const duration = pipelineRef.current.getDuration();
      
      setState(prev => ({
        ...prev,
        duration,
      }));
      
      // Update waveform animation based on audio level
      Animated.timing(waveformAnimation, {
        toValue: level,
        duration: 100,
        useNativeDriver: true,
      }).start();
    }, 100);
  }, [waveformAnimation]);

  const stopAudioLevelMonitoring = useCallback(() => {
    if (audioLevelIntervalRef.current) {
      clearInterval(audioLevelIntervalRef.current);
      audioLevelIntervalRef.current = null;
    }
  }, []);

  // Format duration
  const formattedDuration = useMemo(() => {
    const seconds = Math.floor(state.duration / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }, [state.duration]);

  // Stable styles
  const containerStyles = useStableStyles(() => [
    styles.container,
    style,
  ], [style]);

  const recordButtonStyles = useStableStyles(() => [
    styles.recordButton,
    state.isRecording && styles.recordButtonActive,
  ], [state.isRecording]);

  return (
    <View style={containerStyles} testID={testID}>
      {/* Live Transcription Display */}
      {(state.liveTranscription || state.isProcessing) && (
        <View style={styles.transcriptionContainer}>
          <Text style={styles.transcriptionLabel}>
            {state.isProcessing ? labels.processing : labels.transcriptionLabel}
          </Text>
          <Text style={styles.transcriptionText}>
            {state.isProcessing ? labels.analyzing : state.liveTranscription}
          </Text>
        </View>
      )}

      {/* Waveform Visualization */}
      {state.isRecording && (
        <View style={styles.waveformContainer}>
          {Array.from({ length: 20 }).map((_, index) => (
            <Animated.View
              key={index}
              style={[
                styles.waveformBar,
                {
                  height: Animated.multiply(
                    waveformAnimation,
                    Math.random() * 30 + 10
                  ),
                  opacity: waveformAnimation,
                },
              ]}
            />
          ))}
        </View>
      )}

      {/* Recording Controls */}
      <View style={styles.controlsContainer}>
        <Animated.View style={{ transform: [{ scale: pulseAnimation }] }}>
          <TouchableOpacity
            style={recordButtonStyles}
            onPress={state.isRecording ? stopRecording : startRecording}
            disabled={state.isProcessing}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={state.isRecording ? ['#ff4757', '#ff3742'] : ['#00f5ff', '#0080ff']}
              style={styles.recordButtonGradient}
            >
              <IconSymbol
                name={state.isRecording ? 'stop.fill' : 'mic.fill'}
                size={32}
                color="#FFFFFF"
              />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* Duration Display */}
        {state.isRecording && (
          <View style={styles.durationContainer}>
            <Text style={styles.durationText}>{formattedDuration}</Text>
            <View style={styles.recordingIndicator} />
          </View>
        )}
      </View>

      {/* Action Buttons (when not recording) */}
      {!state.isRecording && state.liveTranscription && (
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setState(prev => ({ ...prev, liveTranscription: '', recordingUri: undefined }))}
          >
            <Text style={styles.actionButtonText}>{labels.clear}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, styles.sendButton]}
            onPress={() => {
              if (state.liveTranscription) {
                onTranscriptionComplete?.(state.liveTranscription, state.recordingUri);
              }
            }}
          >
            <LinearGradient
              colors={['#00f5ff', '#0080ff']}
              style={styles.sendButtonGradient}
            >
              <Text style={styles.sendButtonText}>{labels.send}</Text>
              <IconSymbol name="arrow.up" size={16} color="#000000" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}, (prev, next) => (
  prev.maxDuration === next.maxDuration &&
  prev.enableLiveTranscription === next.enableLiveTranscription &&
  prev.style === next.style
), 'UltraVoiceRecorder');

const styles = StyleSheet.create({
  container: {
    padding: 20,
    alignItems: 'center',
  },
  transcriptionContainer: {
    backgroundColor: 'rgba(0, 245, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(0, 245, 255, 0.2)',
  },
  transcriptionLabel: {
    fontSize: 12,
    color: '#00f5ff',
    fontWeight: '600',
    marginBottom: 8,
  },
  transcriptionText: {
    fontSize: 16,
    color: '#FFFFFF',
    lineHeight: 24,
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 60,
    marginBottom: 20,
    gap: 2,
  },
  waveformBar: {
    width: 3,
    backgroundColor: '#00f5ff',
    borderRadius: 2,
    minHeight: 4,
  },
  controlsContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  recordButtonActive: {
    transform: [{ scale: 1.1 }],
  },
  recordButtonGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  durationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  durationText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  recordingIndicator: {
    width: 8,
    height: 8,
    backgroundColor: '#ff4757',
    borderRadius: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  actionButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  sendButton: {
    backgroundColor: 'transparent',
    borderColor: '#00f5ff',
  },
  sendButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    gap: 8,
  },
  sendButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default UltraVoiceRecorder;