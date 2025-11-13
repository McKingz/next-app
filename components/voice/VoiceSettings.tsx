/**
 * Voice Settings Component
 * 
 * Allows users to configure their voice preferences:
 * - Select preferred language
 * - Test voice output
 * - Adjust speaking rate, pitch, volume
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVoicePreferences } from '@/lib/voice';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/lib/voice/types';

export function VoiceSettings() {
  const {
    preferences,
    isLoading,
    savePreferences,
    isSaving,
    testVoice,
  } = useVoicePreferences();

  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>(
    preferences?.language || 'af'
  );
  const [testingLanguage, setTestingLanguage] = useState<SupportedLanguage | null>(null);

  const handleLanguageSelect = async (language: SupportedLanguage) => {
    setSelectedLanguage(language);
    const langInfo = SUPPORTED_LANGUAGES[language];
    
    try {
      await savePreferences({
        language,
        voice_id: langInfo.defaultVoiceId,
      });
      Alert.alert(
        'Success',
        `Your preferred language has been set to ${langInfo.name}`
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to save language preference');
      console.error('[VoiceSettings] Save failed:', error);
    }
  };

  const handleTestVoice = async (language: SupportedLanguage) => {
    setTestingLanguage(language);
    try {
      await testVoice(language);
    } catch (error) {
      Alert.alert('Error', 'Failed to test voice');
      console.error('[VoiceSettings] Test failed:', error);
    } finally {
      setTestingLanguage(null);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading voice settings...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Ionicons name="volume-high" size={32} color="#007AFF" />
        <Text style={styles.title}>Voice Settings</Text>
        <Text style={styles.subtitle}>
          Choose your preferred language for voice interactions
        </Text>
      </View>

      <View style={styles.languageList}>
        {Object.entries(SUPPORTED_LANGUAGES).map(([code, info]) => {
          const lang = code as SupportedLanguage;
          const isSelected = selectedLanguage === lang;
          const isTesting = testingLanguage === lang;

          return (
            <TouchableOpacity
              key={code}
              style={[styles.languageCard, isSelected && styles.languageCardSelected]}
              onPress={() => handleLanguageSelect(lang)}
              disabled={isSaving || isTesting}
            >
              <View style={styles.languageHeader}>
                <View style={styles.languageInfo}>
                  <Text style={styles.flag}>{info.flag}</Text>
                  <View>
                    <Text style={styles.languageName}>{info.name}</Text>
                    <Text style={styles.languageNameEn}>{info.englishName}</Text>
                  </View>
                </View>
                {isSelected && (
                  <Ionicons name="checkmark-circle" size={24} color="#34C759" />
                )}
              </View>

              <Text style={styles.sampleText}>{info.sampleText}</Text>

              <TouchableOpacity
                style={styles.testButton}
                onPress={() => handleTestVoice(lang)}
                disabled={isTesting}
              >
                {isTesting ? (
                  <>
                    <ActivityIndicator size="small" color="#007AFF" />
                    <Text style={styles.testButtonText}>Playing...</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="play-circle" size={20} color="#007AFF" />
                    <Text style={styles.testButtonText}>Test Voice</Text>
                  </>
                )}
              </TouchableOpacity>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.infoBox}>
        <Ionicons name="information-circle" size={20} color="#007AFF" />
        <Text style={styles.infoText}>
          Your voice preference will be used throughout the app for voice messages, 
          AI assistant interactions, and voice notes.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  content: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#8E8E93',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    marginTop: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 8,
  },
  languageList: {
    gap: 12,
  },
  languageCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  languageCardSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#F0F8FF',
  },
  languageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  languageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  flag: {
    fontSize: 32,
  },
  languageName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  languageNameEn: {
    fontSize: 14,
    color: '#8E8E93',
  },
  sampleText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 12,
    lineHeight: 20,
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#F0F8FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  testButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  infoBox: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#E8F4FD',
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#007AFF',
    lineHeight: 20,
  },
});
