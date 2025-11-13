/**
 * Deepgram Test Screen
 * 
 * Minimal isolated test for Picovoice → Deepgram streaming on native devices.
 * Tests:
 * - Picovoice VoiceProcessor initialization
 * - Raw audio frame capture
 * - Deepgram WebSocket connection
 * - Real-time transcription
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform } from 'react-native';
import { createClaudeVoiceSession } from '@/lib/voice/claudeProvider';

export default function DeepgramTestScreen() {
  const [status, setStatus] = useState<string>('Ready');
  const [logs, setLogs] = useState<string[]>([]);
  const [transcript, setTranscript] = useState<string>('');
  const [session, setSession] = useState<any>(null);
  const [isActive, setIsActive] = useState(false);

  const addLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${timestamp}] ${msg}`, ...prev].slice(0, 50));
    console.log('[DeepgramTest]', msg);
  };

  const startTest = async () => {
    try {
      addLog('🚀 Starting Deepgram test...');
      setStatus('Starting...');
      setTranscript('');

      const voiceSession = createClaudeVoiceSession();
      setSession(voiceSession);

      const started = await voiceSession.start({
        language: 'en',
        onPartialTranscript: (text) => {
          addLog(`📝 Partial: ${text}`);
          setTranscript(text);
        },
        onFinalTranscript: (text) => {
          addLog(`✅ Final: ${text}`);
          setTranscript(text);
        },
        onAssistantToken: (token) => {
          addLog(`🤖 AI Token: ${token}`);
        },
        onAssistantComplete: (response) => {
          addLog(`✅ AI Complete: ${response}`);
        },
        systemPrompt: 'You are a test assistant. Respond with "Test received: [user message]"',
      });

      if (started) {
        addLog('✅ Session started successfully');
        addLog(`📱 Platform: ${Platform.OS}`);
        addLog('🎤 Speak now to test transcription...');
        setStatus('Recording...');
        setIsActive(true);
      } else {
        addLog('❌ Session start failed');
        setStatus('Failed');
      }
    } catch (error) {
      addLog(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
      setStatus('Error');
    }
  };

  const stopTest = async () => {
    try {
      addLog('🛑 Stopping session...');
      setStatus('Stopping...');
      
      if (session) {
        await session.stop();
        addLog('✅ Session stopped');
      }
      
      setStatus('Stopped');
      setIsActive(false);
    } catch (error) {
      addLog(`❌ Stop error: ${error instanceof Error ? error.message : String(error)}`);
      setStatus('Error');
    }
  };

  const clearLogs = () => {
    setLogs([]);
    setTranscript('');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🎤 Deepgram Test</Text>
        <Text style={styles.platform}>Platform: {Platform.OS}</Text>
        <Text style={styles.status}>Status: {status}</Text>
      </View>

      <View style={styles.transcriptBox}>
        <Text style={styles.transcriptLabel}>Current Transcript:</Text>
        <Text style={styles.transcript}>{transcript || '(waiting for speech...)'}</Text>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.button, styles.startButton, isActive && styles.buttonDisabled]}
          onPress={startTest}
          disabled={isActive}
        >
          <Text style={styles.buttonText}>Start Test</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.stopButton, !isActive && styles.buttonDisabled]}
          onPress={stopTest}
          disabled={!isActive}
        >
          <Text style={styles.buttonText}>Stop Test</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.clearButton]} onPress={clearLogs}>
          <Text style={styles.buttonText}>Clear Logs</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.logsContainer}>
        <Text style={styles.logsLabel}>Logs ({logs.length}):</Text>
        <ScrollView style={styles.logsScroll}>
          {logs.map((log, index) => (
            <Text key={index} style={styles.logEntry}>
              {log}
            </Text>
          ))}
        </ScrollView>
      </View>

      <View style={styles.instructions}>
        <Text style={styles.instructionsTitle}>📋 Expected Behavior:</Text>
        <Text style={styles.instructionsText}>
          1. Tap "Start Test" to begin{'\n'}
          2. On native: Should see "VoiceProcessor started"{'\n'}
          3. On web: Should see "Web recording started"{'\n'}
          4. Speak clearly into the microphone{'\n'}
          5. Watch for "Partial" transcript updates{'\n'}
          6. After silence, should see "Final" transcript{'\n'}
          7. Check logs for audio frame streaming{'\n'}
          8. Tap "Stop Test" when finished
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  header: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  platform: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  status: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  transcriptBox: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    minHeight: 100,
  },
  transcriptLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#666',
  },
  transcript: {
    fontSize: 18,
    color: '#333',
    fontStyle: 'italic',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  button: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  startButton: {
    backgroundColor: '#4CAF50',
  },
  stopButton: {
    backgroundColor: '#f44336',
  },
  clearButton: {
    backgroundColor: '#2196F3',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  logsContainer: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  logsLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#666',
  },
  logsScroll: {
    flex: 1,
  },
  logEntry: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#333',
    marginBottom: 4,
  },
  instructions: {
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
  },
  instructionsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#1976D2',
  },
  instructionsText: {
    fontSize: 12,
    color: '#333',
    lineHeight: 18,
  },
});
