/**
 * Voice Interaction Demo Screen
 * 
 * Demonstrates voice recording, TTS playback, and voice preferences
 * This screen can be used for testing and as a reference implementation
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  Alert,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVoiceInteraction, SUPPORTED_LANGUAGES } from '@/lib/voice';
import { VoiceSettings } from '@/components/voice/VoiceSettings';

export default function VoiceDemoScreen() {
  const [showSettings, setShowSettings] = useState(false);
  const [textInput, setTextInput] = useState('');
  
  const {
    // Recording
    recordingState,
    hasPermission,
    requestPermission,
    startRecording,
    stopRecording,
    cancelRecording,
    // TTS
    speak,
    stopSpeaking,
    pauseSpeaking,
    resumeSpeaking,
    isSpeaking,
    isSynthesizing,
    playbackState,
    // Preferences
    preferredLanguage,
    preferences,
  } = useVoiceInteraction();

  const handleStartRecording = async () => {
    if (hasPermission === false) {
      const granted = await requestPermission();
      if (!granted) {
        Alert.alert('Permission Required', 'Microphone permission is required for voice recording');
        return;
      }
    }

    try {
      await startRecording();
    } catch (error) {
      Alert.alert('Error', 'Failed to start recording');
      console.error('[VoiceDemo] Recording failed:', error);
    }
  };

  const handleStopRecording = async () => {
    try {
      const uri = await stopRecording();
      if (uri) {
        Alert.alert('Success', `Recording saved: ${uri.substring(uri.lastIndexOf('/') + 1)}`);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to stop recording');
      console.error('[VoiceDemo] Stop failed:', error);
    }
  };

  const handleSpeak = async () => {
    if (!textInput.trim()) {
      Alert.alert('Enter Text', 'Please enter some text to speak');
      return;
    }

    try {
      await speak(textInput);
    } catch (error) {
      Alert.alert('Error', 'Failed to synthesize speech');
      console.error('[VoiceDemo] TTS failed:', error);
    }
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  if (showSettings) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setShowSettings(false)} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#007AFF" />
            <Text style={styles.backText}>Back to Demo</Text>
          </TouchableOpacity>
        </View>
        <VoiceSettings />
      </SafeAreaView>
    );
  }

  const langInfo = SUPPORTED_LANGUAGES[preferredLanguage];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Voice Demo</Text>
            <Text style={styles.subtitle}>
              Test voice recording and text-to-speech
            </Text>
          </View>
          <TouchableOpacity onPress={() => setShowSettings(true)} style={styles.settingsButton}>
            <Ionicons name="settings" size={28} color="#007AFF" />
          </TouchableOpacity>
        </View>

        {/* Current Language Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="language" size={24} color="#007AFF" />
            <Text style={styles.sectionTitle}>Current Language</Text>
          </View>
          <View style={styles.languageCard}>
            <Text style={styles.languageFlag}>{langInfo.flag}</Text>
            <View style={styles.languageInfo}>
              <Text style={styles.languageName}>{langInfo.name}</Text>
              <Text style={styles.languageEnglish}>{langInfo.englishName}</Text>
            </View>
            <TouchableOpacity onPress={() => setShowSettings(true)}>
              <Ionicons name="chevron-forward" size={24} color="#8E8E93" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Text-to-Speech Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="volume-high" size={24} color="#007AFF" />
            <Text style={styles.sectionTitle}>Text-to-Speech</Text>
          </View>
          
          <TextInput
            style={styles.textInput}
            placeholder={`Enter text in ${langInfo.name}...`}
            placeholderTextColor="#8E8E93"
            value={textInput}
            onChangeText={setTextInput}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[styles.primaryButton, (isSynthesizing || isSpeaking) && styles.primaryButtonDisabled]}
            onPress={handleSpeak}
            disabled={isSynthesizing || isSpeaking}
          >
            {isSynthesizing ? (
              <>
                <Ionicons name="hourglass" size={20} color="#FFF" />
                <Text style={styles.primaryButtonText}>Synthesizing...</Text>
              </>
            ) : isSpeaking ? (
              <>
                <Ionicons name="pause-circle" size={20} color="#FFF" />
                <Text style={styles.primaryButtonText}>Speaking...</Text>
              </>
            ) : (
              <>
                <Ionicons name="play-circle" size={20} color="#FFF" />
                <Text style={styles.primaryButtonText}>Speak Text</Text>
              </>
            )}
          </TouchableOpacity>

          {isSpeaking && (
            <View style={styles.playbackControls}>
              <TouchableOpacity style={styles.controlButton} onPress={pauseSpeaking}>
                <Ionicons name="pause" size={24} color="#007AFF" />
                <Text style={styles.controlText}>Pause</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.controlButton} onPress={stopSpeaking}>
                <Ionicons name="stop" size={24} color="#FF3B30" />
                <Text style={styles.controlText}>Stop</Text>
              </TouchableOpacity>
            </View>
          )}

          {playbackState.duration > 0 && (
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: `${(playbackState.position / playbackState.duration) * 100}%` }
                ]} 
              />
            </View>
          )}
        </View>

        {/* Voice Recording Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="mic" size={24} color="#FF3B30" />
            <Text style={styles.sectionTitle}>Voice Recording</Text>
          </View>

          <View style={styles.recordingCard}>
            {recordingState.isRecording && (
              <View style={styles.recordingIndicator}>
                <View style={styles.recordingDot} />
                <Text style={styles.recordingText}>
                  Recording: {formatDuration(recordingState.duration)}
                </Text>
              </View>
            )}

            {!recordingState.isRecording ? (
              <TouchableOpacity
                style={styles.recordButton}
                onPress={handleStartRecording}
              >
                <Ionicons name="mic" size={32} color="#FFF" />
                <Text style={styles.recordButtonText}>Start Recording</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.recordingActions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.stopButton]}
                  onPress={handleStopRecording}
                >
                  <Ionicons name="stop-circle" size={28} color="#FFF" />
                  <Text style={styles.actionButtonText}>Stop</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.cancelButton]}
                  onPress={cancelRecording}
                >
                  <Ionicons name="close-circle" size={28} color="#FFF" />
                  <Text style={styles.actionButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {recordingState.uri && !recordingState.isRecording && (
            <View style={styles.recordingResult}>
              <Ionicons name="checkmark-circle" size={24} color="#34C759" />
              <Text style={styles.resultText}>Recording saved successfully!</Text>
            </View>
          )}

          {hasPermission === false && (
            <View style={styles.permissionWarning}>
              <Ionicons name="warning" size={20} color="#FF9500" />
              <Text style={styles.warningText}>
                Microphone permission required for recording
              </Text>
            </View>
          )}
        </View>

        {/* Quick Test Samples */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="flash" size={24} color="#007AFF" />
            <Text style={styles.sectionTitle}>Quick Test</Text>
          </View>
          <TouchableOpacity
            style={styles.quickTestButton}
            onPress={() => {
              setTextInput(langInfo.sampleText);
              handleSpeak();
            }}
            disabled={isSynthesizing || isSpeaking}
          >
            <Text style={styles.quickTestText}>Try sample text</Text>
            <Ionicons name="arrow-forward" size={20} color="#007AFF" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backText: {
    fontSize: 17,
    color: '#007AFF',
    fontWeight: '600',
  },
  settingsButton: {
    padding: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
  },
  languageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  languageFlag: {
    fontSize: 40,
  },
  languageInfo: {
    flex: 1,
  },
  languageName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  languageEnglish: {
    fontSize: 14,
    color: '#8E8E93',
  },
  textInput: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#000',
    minHeight: 100,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
  },
  primaryButtonDisabled: {
    backgroundColor: '#8E8E93',
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFF',
  },
  playbackControls: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  controlButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  controlText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  progressBar: {
    height: 4,
    backgroundColor: '#E5E5EA',
    borderRadius: 2,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
  },
  recordingCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FF3B30',
  },
  recordingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FF3B30',
  },
  recordButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  recordButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  recordingActions: {
    flexDirection: 'row',
    gap: 16,
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    minWidth: 100,
  },
  stopButton: {
    backgroundColor: '#34C759',
  },
  cancelButton: {
    backgroundColor: '#8E8E93',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  recordingResult: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  resultText: {
    fontSize: 16,
    color: '#34C759',
    fontWeight: '600',
  },
  permissionWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: '#FF9500',
  },
  quickTestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  quickTestText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
});
