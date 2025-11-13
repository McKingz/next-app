/**
 * Test Screen for Chunked Transcription
 * 
 * This screen tests the new hybrid transcription system with:
 * - Optimized audio compression
 * - 1-second chunk uploads
 * - Real-time progress tracking
 * - Works in Expo web environment
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { Stack } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { ChunkedTranscription, type ChunkTranscriptResult } from '@/lib/speech/chunked-transcription';
import { logger } from '@/lib/logger';

export default function TestChunkedTranscriptionScreen() {
  const { theme } = useTheme();
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [stats, setStats] = useState({
    totalChunks: 0,
    successfulChunks: 0,
    avgLatency: 0,
    duration: 0,
  });
  const [chunks, setChunks] = useState<Array<{ index: number; text: string; latency: number }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [chunker, setChunker] = useState<ChunkedTranscription | null>(null);

  // Check if we're on web
  const isWeb = Platform.OS === 'web';

  useEffect(() => {
    if (!isWeb) {
      Alert.alert(
        'Not Supported',
        'This test screen only works on web platform. Please run with: npm run web'
      );
    }
  }, [isWeb]);

  const startRecording = async () => {
    if (!isWeb) {
      setError('This test only works on web platform');
      return;
    }

    try {
      setError(null);
      setTranscript('');
      setChunks([]);
      setStats({ totalChunks: 0, successfulChunks: 0, avgLatency: 0, duration: 0 });

      // Check if ChunkedTranscription is supported
      if (!ChunkedTranscription.isSupported()) {
        throw new Error('MediaRecorder not supported in this browser. Use Chrome or Edge.');
      }

      // Get microphone permission
      const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setStream(mediaStream);

      // Create chunked transcription instance
      const transcription = new ChunkedTranscription({
        chunkDurationMs: 1000,
        language: 'en',
        onChunkResult: (result: ChunkTranscriptResult) => {
          logger.info(`Chunk ${result.chunkIndex} received`, { latency: result.latency });
          
          // Update chunks list
          setChunks(prev => [...prev, {
            index: result.chunkIndex,
            text: result.text,
            latency: result.latency,
          }]);

          // Update transcript (stitched)
          setTranscript(prev => prev + ' ' + result.text);
        },
        onError: (error, chunkIndex) => {
          logger.error(`Chunk ${chunkIndex} failed`, error);
          setError(`Chunk ${chunkIndex} failed: ${error.message}`);
        },
      });

      // Start chunking
      await transcription.startChunking(mediaStream);
      setChunker(transcription);
      setIsRecording(true);

      logger.info('Chunked transcription started');

    } catch (err: any) {
      logger.error('Failed to start recording', err);
      setError(err.message || 'Failed to start recording');
      
      // Cleanup on error
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }
    }
  };

  const stopRecording = async () => {
    if (!chunker) return;

    try {
      // Stop chunking
      chunker.stop();

      // Stop media stream
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }

      // Get final stats
      const finalStats = chunker.getStats();
      setStats({
        totalChunks: finalStats.totalChunks,
        successfulChunks: finalStats.successfulChunks,
        avgLatency: Math.round(finalStats.avgChunkLatencyMs),
        duration: Math.round(finalStats.totalDurationMs / 1000),
      });

      // Get final transcript
      const finalTranscript = chunker.getStitchedTranscript();
      setTranscript(finalTranscript);

      setIsRecording(false);
      setChunker(null);

      logger.info('Chunked transcription stopped', finalStats);

    } catch (err: any) {
      logger.error('Failed to stop recording', err);
      setError(err.message || 'Failed to stop recording');
    }
  };

  const clearResults = () => {
    setTranscript('');
    setChunks([]);
    setStats({ totalChunks: 0, successfulChunks: 0, avgLatency: 0, duration: 0 });
    setError(null);
  };

  if (!isWeb) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ title: 'Chunked Transcription Test' }} />
        <View style={styles.center}>
          <Text style={[styles.errorText, { color: theme.error }]}>
            ⚠️ This test screen only works on web platform.
          </Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            Run: npm run web
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: 'Chunked Transcription Test' }} />
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Info Box */}
        <View style={[styles.infoBox, { backgroundColor: theme.elevated }]}>
          <Text style={[styles.infoTitle, { color: theme.text }]}>
            🎤 Chunked Transcription Test
          </Text>
          <Text style={[styles.infoText, { color: theme.textSecondary }]}>
            Tests the hybrid transcription system with 1-second audio chunks sent to OpenAI Whisper.
          </Text>
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          {!isRecording ? (
            <TouchableOpacity
              style={[styles.button, styles.startButton, { backgroundColor: theme.primary }]}
              onPress={startRecording}
            >
              <Text style={styles.buttonText}>🎤 Start Recording</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.button, styles.stopButton, { backgroundColor: theme.error }]}
              onPress={stopRecording}
            >
              <Text style={styles.buttonText}>⏹️ Stop Recording</Text>
            </TouchableOpacity>
          )}

          {transcript && !isRecording && (
            <TouchableOpacity
              style={[styles.button, styles.clearButton, { backgroundColor: theme.secondary }]}
              onPress={clearResults}
            >
              <Text style={[styles.buttonText, { color: theme.text }]}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Stats */}
        <View style={styles.statsGrid}>
          <View style={[styles.statBox, { backgroundColor: theme.elevated }]}>
            <Text style={[styles.statValue, { color: theme.primary }]}>{stats.totalChunks}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total Chunks</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: theme.elevated }]}>
            <Text style={[styles.statValue, { color: theme.primary }]}>{stats.avgLatency}ms</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Avg Latency</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: theme.elevated }]}>
            <Text style={[styles.statValue, { color: theme.primary }]}>
              {stats.totalChunks > 0 ? Math.round((stats.successfulChunks / stats.totalChunks) * 100) : 0}%
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Success Rate</Text>
          </View>
        </View>

        {/* Transcript */}
        {transcript && (
          <View style={[styles.transcriptBox, { backgroundColor: theme.elevated }]}>
            <Text style={[styles.transcriptTitle, { color: theme.text }]}>Transcript:</Text>
            <Text style={[styles.transcriptText, { color: theme.text }]}>{transcript || 'Waiting for transcription...'}</Text>
          </View>
        )}

        {/* Recent Chunks */}
        {chunks.length > 0 && (
          <View style={[styles.chunksBox, { backgroundColor: theme.elevated }]}>
            <Text style={[styles.chunksTitle, { color: theme.text }]}>Recent Chunks:</Text>
            {chunks.slice(-5).reverse().map((chunk) => (
              <View key={chunk.index} style={[styles.chunkItem, { borderBottomColor: theme.border }]}>
                <Text style={[styles.chunkIndex, { color: theme.textSecondary }]}>
                  Chunk {chunk.index} ({chunk.latency}ms)
                </Text>
                <Text style={[styles.chunkText, { color: theme.text }]} numberOfLines={2}>
                  {chunk.text}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Error */}
        {error && (
          <View style={[styles.errorBox, { backgroundColor: theme.errorLight }]}>
            <Text style={[styles.errorText, { color: theme.error }]}>⚠️ {error}</Text>
          </View>
        )}

        {/* Instructions */}
        <View style={[styles.instructionsBox, { backgroundColor: theme.elevated }]}>
          <Text style={[styles.instructionsTitle, { color: theme.text }]}>Instructions:</Text>
          <Text style={[styles.instructionsText, { color: theme.textSecondary }]}> 
            1. Make sure you've deployed the transcribe-chunk Edge Function
            {'\n'}2. Set OPENAI_API_KEY in Supabase secrets
            {'\n'}3. Click "Start Recording" and speak for 10-15 seconds
            {'\n'}4. Watch chunks transcribe in real-time!
            {'\n\n'}Expected: First chunk in ~1.5s, subsequent chunks every 1-2s
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    gap: 20,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  infoBox: {
    padding: 16,
    borderRadius: 12,
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
  },
  controls: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButton: {
    // backgroundColor handled by theme
  },
  stopButton: {
    // backgroundColor handled by theme
  },
  clearButton: {
    flex: 0.5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statBox: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  transcriptBox: {
    padding: 16,
    borderRadius: 12,
    minHeight: 120,
  },
  transcriptTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  transcriptText: {
    fontSize: 14,
    lineHeight: 20,
  },
  chunksBox: {
    padding: 16,
    borderRadius: 12,
  },
  chunksTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  chunkItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  chunkIndex: {
    fontSize: 12,
    marginBottom: 4,
  },
  chunkText: {
    fontSize: 14,
  },
  errorBox: {
    padding: 16,
    borderRadius: 12,
  },
  errorText: {
    fontSize: 14,
    fontWeight: '500',
  },
  instructionsBox: {
    padding: 16,
    borderRadius: 12,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 13,
    lineHeight: 20,
  },
  text: {
    fontSize: 14,
    marginTop: 8,
  },
});
