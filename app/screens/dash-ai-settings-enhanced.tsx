import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  TextInput,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { router } from 'expo-router';
import Slider from '@react-native-community/slider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import { voiceService } from '@/lib/voice/client';
import { initAndMigrate, setVoicePrefs, normalizeLanguageCode, resolveDefaultVoiceId } from '@/lib/ai/dashSettings';

export default function DashAISettingsEnhancedScreen() {
  const { theme } = useTheme();
  
  // Lazy load DashAI instance
  const [dashAIInstance, setDashAIInstance] = useState<any>(null);
  useEffect(() => {
    (async () => {
      try {
        const { getAssistant } = await import('@/services/core/getAssistant');
        const inst = await getAssistant();
        setDashAIInstance(inst);
      } catch (error) {
        console.error('[DashAISettingsEnhancedScreen] Failed to load DashAI:', error);
      }
    })();
  }, []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const lastSavedRef = React.useRef<string>('');
  const computeSignature = useCallback((s: typeof settings) => {
    // Only include fields that are actually persisted
    const langNorm = normalizeLanguageCode(s.voiceLanguage);
    return JSON.stringify({
      personality: s.personality,
      customInstructions: s.customInstructions?.trim() || '',
      userContext: s.userContext?.trim() || '',
      teachingStyle: s.teachingStyle,
      voice: {
        language: langNorm,
        voiceType: s.voiceType,
        rate: Number(s.voiceRate?.toFixed?.(2) ?? s.voiceRate),
        pitch: Number(s.voicePitch?.toFixed?.(2) ?? s.voicePitch),
        volume: Number(s.voiceVolume?.toFixed?.(2) ?? s.voiceVolume),
      },
      // Voice chat prefs mapping
      chat: {
        autoSpeak: !!s.autoReadResponses,
      },
    });
  }, []);
  const [settings, setSettings] = useState({
    // Core AI Settings
    voiceEnabled: true,
    proactiveHelp: true,
    memoryEnabled: true,
    multilingualSupport: true,
    
    // Personality Settings
    personality: 'encouraging' as 'professional' | 'casual' | 'encouraging' | 'formal',
    personalityCustom: '',
    adaptiveTone: true,
    emotionalIntelligence: true,
    
    // Voice Settings
    voiceLanguage: 'en',
    voiceType: 'female_warm',
    voiceRate: 1.0,
    voicePitch: 1.0,
    voiceVolume: 0.8,
    autoReadResponses: false,
    voiceActivation: false,
    
    // Chat Behavior Settings
    enterToSend: true,
    autoVoiceReply: false,
    showTypingIndicator: true,
    readReceiptEnabled: true,
    soundEnabled: true,
    autoSuggestQuestions: true,
    contextualHelp: true,
    
    // Learning & Memory Settings
    rememberPreferences: true,
    learnFromInteractions: true,
    personalizedRecommendations: true,
    crossSessionMemory: true,
    memoryRetentionDays: 30,
    
    // Advanced Features
    predictiveText: true,
    smartNotifications: true,
    offlineMode: false,
    dataSync: true,
    experimentalFeatures: false,
    
    // Privacy Settings
    dataCollection: true,
    anonymousUsage: false,
    shareAnalytics: true,
    localProcessing: Platform.OS === 'ios',
    
    // Custom Instructions
    customInstructions: '',
    userContext: '',
    teachingStyle: 'adaptive' as 'direct' | 'guided' | 'socratic' | 'adaptive',
    
    // Accessibility
    highContrast: false,
    largeFonts: false,
    screenReader: false,
    reducedMotion: false
  });
  
  const [streamingPref, setStreamingPref] = useState<boolean>(false);
  useEffect(() => { (async () => { try { const v = await AsyncStorage.getItem('@dash_streaming_enabled'); if (v !== null) setStreamingPref(v === 'true'); } catch (e) { if (__DEV__) console.warn('[Dash Settings] load streaming pref', e); } })(); }, []);
  const toggleStreamingPref = async (v: boolean) => { setStreamingPref(v); try { await AsyncStorage.setItem('@dash_streaming_enabled', v ? 'true' : 'false'); } catch (e) { if (__DEV__) console.warn('[Dash Settings] save streaming pref', e); } };
  const [expandedSections, setExpandedSections] = useState({
    personality: true,
    voice: true,
    chat: false,
    learning: false,
    custom: false,
    accessibility: false
  });

  // Voice sample playback state
  const [samplePlaying, setSamplePlaying] = useState(false);
  const [sampleLoading, setSampleLoading] = useState(false);
  const [sampleProgress, setSampleProgress] = useState(0);
  const sampleSoundRef = React.useRef<Audio.Sound | null>(null);

  const initializeDashAI = useCallback(async () => {
    try {
      setLoading(true);
      if (!dashAIInstance) return;
      await dashAIInstance.initialize();
      // One-time migrate legacy keys into SSOT (no-op after first run)
      try { await initAndMigrate(); } catch (e) { if (__DEV__) console.warn('[Dash Settings] migration warn', e); }
      
      // Load current settings from DashAI service
      const personality = dashAIInstance.getPersonality?.() || {};
      const memory = (typeof dashAIInstance.getMemoryItems === 'function')
        ? dashAIInstance.getMemoryItems()
        : (typeof dashAIInstance.getMemory === 'function' ? dashAIInstance.getMemory() : []);
      
      const loadedSettings = {
        // Start from current state to preserve unspecified settings
        ...settings,
        // Map DashAI personality to our settings, overriding current state
        personality: (personality.response_style === 'professional' ? 'professional' : 
                      personality.response_style === 'casual' ? 'casual' : 
                      personality.response_style === 'formal' ? 'formal' : 'encouraging') as 'professional' | 'casual' | 'encouraging' | 'formal',
        voiceLanguage: normalizeLanguageCode(personality.voice_settings?.language) || 'en',
        voiceType: personality.voice_settings?.voice || 'male', // Read from saved voice
        voiceRate: personality.voice_settings?.rate || 1.0,
        voicePitch: personality.voice_settings?.pitch || 1.0,
        memoryEnabled: memory && memory.length > 0,
        customInstructions: personality.personality_traits?.join(', ') || '',
      };
      
      setSettings(loadedSettings);
      // Initialize last saved signature to avoid immediate save when nothing changed
      try { lastSavedRef.current = computeSignature(loadedSettings as any); } catch {}
      if (__DEV__) console.log('📋 Enhanced settings loaded from DashAI:', loadedSettings);
    } catch (error) {
      console.error('Failed to initialize Dash AI:', error);
      Alert.alert('Error', 'Failed to load enhanced Dash AI settings');
    } finally {
      setLoading(false);
    }
   
  }, [dashAIInstance]);

  useEffect(() => {
    if (dashAIInstance) {
      initializeDashAI();
    }
  }, [dashAIInstance, initializeDashAI]);


  const handleSettingsChange = (key: string, value: any) => {
    setSettings(prev => {
      // Prevent unnecessary state updates when value hasn't changed
      if ((prev as any)[key] === value) return prev;
      return { ...prev, [key]: value };
    });
  };
  

  const saveSettings = async () => {
    try {
      setSaving(true);
      // Skip if no actual changes
      const sig = computeSignature(settings);
      if (sig === lastSavedRef.current) { setSaving(false); return; }
      
      // Build personality object for DashAI
      const dashPersonality = {
        personality_traits: [
          settings.personality,
          'educational',
          'supportive',
          ...(settings.customInstructions ? settings.customInstructions.split(',').map(s => s.trim()) : [])
        ].filter(Boolean),
        response_style: settings.personality,
        voice_settings: {
          language: settings.voiceLanguage,
          voice: settings.voiceType, // Save voice gender
          rate: settings.voiceRate,
          pitch: settings.voicePitch,
          volume: settings.voiceVolume
        },
        user_context: settings.userContext,
        teaching_style: settings.teachingStyle
      };
      
      await dashAIInstance.savePersonality(dashPersonality);

      // Persist voice prefs to SSOT (Supabase voice_preferences)
      try {
        const langNorm = normalizeLanguageCode(settings.voiceLanguage);
        // If a provider-specific voice name was selected, keep it; otherwise map by gender
        const isProviderVoice = /Neural$/i.test(settings.voiceType || '');
        const gender = settings.voiceType === 'male' ? 'male' : settings.voiceType === 'female' ? 'female' : 'female';
        const voice_id = isProviderVoice ? settings.voiceType : resolveDefaultVoiceId(langNorm, gender as any);
        await setVoicePrefs({
          language: langNorm as any,
          voice_id,
          speaking_rate: settings.voiceRate,
          pitch: settings.voicePitch,
          volume: settings.voiceVolume,
        });
      } catch (e) {
        console.warn('[Dash AI Enhanced] Failed to persist voice preferences:', e);
      }

      // Persist chat preferences mapping (auto-read responses -> autoSpeak)
      try {
        const { setVoiceChatPrefs } = await import('@/lib/ai/dashSettings');
        await setVoiceChatPrefs({ autoSpeak: !!settings.autoReadResponses });
      } catch (e) {
        if (__DEV__) console.warn('[Dash AI Enhanced] Failed to persist chat prefs:', e);
      }

      // Update last saved signature
      lastSavedRef.current = sig;
      if (__DEV__) console.log('✅ Enhanced settings saved to DashAI & voice_preferences');
    } catch (error) {
      console.error('Failed to save enhanced settings:', error);
      Alert.alert(
        'Save Error', 
        'Failed to save some settings. Please try again or contact support if the problem persists.'
      );
    } finally {
      setSaving(false);
    }
  };

  const testVoiceAdvanced = async () => {
    try {
      // First, save current settings to ensure voice preferences are applied
      console.log('[Test Voice] Applying current settings...');
      const langNorm = normalizeLanguageCode(settings.voiceLanguage);
      const isProviderVoice = /Neural$/i.test(settings.voiceType || '');
      const gender = settings.voiceType === 'male' ? 'male' : settings.voiceType === 'female' ? 'female' : 'female';
      const voice_id = isProviderVoice ? settings.voiceType : resolveDefaultVoiceId(langNorm, gender as any);
      
      // Save to voice preferences (SSOT)
      await setVoicePrefs({
        language: langNorm as any,
        voice_id,
        speaking_rate: settings.voiceRate,
        pitch: settings.voicePitch,
        volume: settings.voiceVolume,
      });
      
      // Also update DashAI personality for immediate use
      const dashPersonality = {
        personality_traits: [settings.personality, 'educational', 'supportive'],
        response_style: settings.personality,
        voice_settings: {
          language: settings.voiceLanguage,
          voice: settings.voiceType,
          rate: settings.voiceRate,
          pitch: settings.voicePitch,
          volume: settings.voiceVolume
        },
      };
      await dashAIInstance.savePersonality(dashPersonality);
      
      console.log('[Test Voice] Settings applied. Language:', langNorm, 'Voice:', voice_id);
      
      // Language-specific test messages
      const testMessages: Record<string, Record<string, string>> = {
        en: {
          professional: "Good day. I'm Dash, your professional AI teaching assistant. I'm ready to help with your educational needs.",
          casual: "Hey there! I'm Dash, your friendly AI buddy. Ready to learn something awesome together?",
          encouraging: "Hello! I'm Dash, and I'm here to support you every step of the way. You're doing great!",
          formal: "Greetings. I am Dash, your dedicated educational assistant. I am prepared to assist with your academic endeavors.",
        },
        af: {
          professional: "Goeiedag. Ek is Dash, jou professionele onderwysassistent. Ek is gereed om jou te help.",
          casual: "Haai daar! Ek is Dash, jou vriendelike helper. Klaar om iets awesome te leer?",
          encouraging: "Hallo! Ek is Dash, en ek is hier om jou elke stap van die pad te ondersteun. Jy doen great!",
          formal: "Groete. Ek is Dash, jou toegewyde opvoedkundige assistent. Ek is gereed om jou te help.",
        },
        zu: {
          professional: "Sawubona. Ngingu-Dash, umsizi wakho wezemfundo. Ngikulungele ukukusiza.",
          casual: "Yebo! Ngingu-Dash, umngane wakho. Usukulungele ukufunda into enhle?",
          encouraging: "Sawubona! Ngingu-Dash, futhi ngilapha ukukusekela ezinyathelweni zonke. Wenza kahle!",
          formal: "Sanibonani. Ngingu-Dash, umsizi wakho wezemfundo ozinikele. Ngikulungele ukukusiza.",
        },
        xh: {
          professional: "Molo. NdinguDash, umncedisi wakho wemfundo. Ndikulungele ukukunceda.",
          casual: "Ewe! NdinguDash, umhlobo wakho. Ukulungele ukufunda into entle?",
          encouraging: "Molo! NdinguDash, kwaye ndilapha ukukuxhasa kwinyathelo ngalinye. Wenza kakuhle!",
          formal: "Molweni. NdinguDash, umncedisi wakho wemfundo ozinikeleyo. Ndikulungele ukukunceda.",
        },
        nso: {
          professional: "Thobela. Ke Dash, mothusi wa gago wa thuto. Ke lokile go go thuša.",
          casual: "Hei! Ke Dash, mogwera wa gago. O lokile go ithuta se se botse?",
          encouraging: "Dumela! Ke Dash, gomme ke fano go go thekga mo kgatong ye nngwe le ye nngwe. O dira gabotse!",
          formal: "Dumelang. Ke Dash, mothusi wa gago wa thuto yo a ikgafilego. Ke lokile go go thuša.",
        },
      };
      
      // Get appropriate test message
      const langKey = langNorm as keyof typeof testMessages;
      const messages = testMessages[langKey] || testMessages.en;
      const content = messages[settings.personality] || messages.encouraging;
      
      console.log('[Test Voice] Playing test message in', langNorm);
      
      const msg = {
        id: `msg_test_${Date.now()}`,
        type: 'assistant' as const,
        content,
        timestamp: Date.now(),
      };
      
      await dashAIInstance.speakResponse(msg as any);
      
      // Show success with language info
      const langNames: Record<string, string> = {
        en: 'English',
        af: 'Afrikaans',
        zu: 'isiZulu',
        xh: 'isiXhosa',
        nso: 'Northern Sotho'
      };
      const langName = langNames[langNorm] || langNorm;
      const voiceName = voice_id.replace(/Neural$/i, '').replace(/-/g, ' ');
      
      Alert.alert(
        'Voice Test Complete',
        `Testing ${langName} voice: ${voiceName}\n\nRate: ${settings.voiceRate.toFixed(1)}x | Pitch: ${settings.voicePitch.toFixed(1)}x`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('[Enhanced Voice Test] Failed:', error);
      Alert.alert(
        'Voice Test Failed', 
        'Could not test voice settings. Please check your internet connection and try again.'
      );
    }
  };

  const resetToDefaults = async () => {
    Alert.alert(
      'Reset to Defaults',
      'This will reset all enhanced settings to their default values. Your saved conversations and memory will not be affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            setSettings({
              // Reset to default enhanced settings
              voiceEnabled: true,
              proactiveHelp: true,
              memoryEnabled: true,
              multilingualSupport: true,
              personality: 'encouraging',
              personalityCustom: '',
              adaptiveTone: true,
              emotionalIntelligence: true,
              voiceLanguage: 'en-ZA',
              voiceType: 'male', // Default to male voice
              voiceRate: 1.0,
              voicePitch: 1.0,
              voiceVolume: 0.8,
              autoReadResponses: false,
              voiceActivation: false,
              enterToSend: true,
              autoVoiceReply: false,
              showTypingIndicator: true,
              readReceiptEnabled: true,
              soundEnabled: true,
              autoSuggestQuestions: true,
              contextualHelp: true,
              rememberPreferences: true,
              learnFromInteractions: true,
              personalizedRecommendations: true,
              crossSessionMemory: true,
              memoryRetentionDays: 30,
              predictiveText: true,
              smartNotifications: true,
              offlineMode: false,
              dataSync: true,
              experimentalFeatures: false,
              dataCollection: true,
              anonymousUsage: false,
              shareAnalytics: true,
              localProcessing: Platform.OS === 'ios',
              customInstructions: '',
              userContext: '',
              teachingStyle: 'adaptive',
              highContrast: false,
              largeFonts: false,
              screenReader: false,
              reducedMotion: false
            });
            Alert.alert('Settings Reset', 'All settings have been reset to defaults');
          }
        }
      ]
    );
  };


  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const renderSectionHeader = (title: string, section: keyof typeof expandedSections, icon?: string) => (
    <TouchableOpacity
      style={[styles.sectionHeader, { backgroundColor: theme.surface, borderColor: theme.border }]}
      onPress={() => toggleSection(section)}
      accessibilityRole="button"
      accessibilityLabel={`${title} section`}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {icon ? <Text style={{ fontSize: 18 }}>{icon}</Text> : null}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
      </View>
      <Text style={[styles.expandIcon, { color: theme.textSecondary }]}>
        {expandedSections[section] ? '▼' : '▶'}
      </Text>
    </TouchableOpacity>
  );

  const renderToggleSetting = (
    key: string,
    title: string, 
    subtitle: string,
    value: boolean
  ) => (
    <View style={[styles.settingRow, { borderBottomColor: theme.border }]}>
      <View style={styles.settingInfo}>
        <Text style={[styles.settingTitle, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.settingSubtitle, { color: theme.textSecondary }]}>{subtitle}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={(newValue) => handleSettingsChange(key, newValue)}
        trackColor={{ false: theme.border, true: `${theme.primary}40` }}
        thumbColor={value ? theme.primary : '#f4f3f4'}
      />
    </View>
  );

  const renderSliderSetting = (
    key: string,
    title: string,
    subtitle: string,
    value: number,
    min: number,
    max: number,
    step: number
  ) => (
    <View style={[styles.settingRow, { borderBottomColor: theme.border }]}>
      <View style={styles.settingInfo}>
        <Text style={[styles.settingTitle, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.settingSubtitle, { color: theme.textSecondary }]}>{subtitle}</Text>
        <Text style={[styles.sliderValue, { color: theme.primary }]}>
          Current: {value.toFixed(1)}
        </Text>
      </View>
      <Slider
        style={styles.slider}
        minimumValue={min}
        maximumValue={max}
        step={step}
        value={value}
        onValueChange={(newValue) => handleSettingsChange(key, newValue)}
        minimumTrackTintColor={theme.primary}
        maximumTrackTintColor={theme.border}
        thumbTintColor={theme.primary}
      />
    </View>
  );

  const renderPickerSetting = (
    key: string,
    title: string,
    subtitle: string,
    value: string,
    options: { label: string; value: string; disabled?: boolean }[]
  ) => (
    <View style={[styles.settingRow, { borderBottomColor: theme.border }]}>
      <View style={styles.settingInfo}>
        <Text style={[styles.settingTitle, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.settingSubtitle, { color: theme.textSecondary }]}>{subtitle}</Text>
      </View>
      <View style={styles.pickerContainer}>
        {options.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.pickerOption,
              { 
                backgroundColor: value === option.value ? theme.primary : 'transparent',
                borderColor: theme.border,
                opacity: option.disabled ? 0.4 : 1
              }
            ]}
            onPress={() => !option.disabled && handleSettingsChange(key, option.value)}
            disabled={option.disabled}
          >
            <Text style={[
              styles.pickerOptionText,
              { 
                color: value === option.value ? 'white' : option.disabled ? theme.textSecondary : theme.text
              }
            ]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <ScreenHeader 
          title="Enhanced Dash AI Settings" 
          subtitle="Advanced AI assistant configuration" 
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Loading enhanced settings...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader 
        title="Dash AI Settings" 
        subtitle="Configure your AI assistant" 
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* Personality Settings */}
        {renderSectionHeader('Personality & Behavior', 'personality', '🎭')}
        {expandedSections.personality && (
          <View style={[styles.sectionContent, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {renderPickerSetting(
              'personality',
              'AI Personality',
              'Choose how Dash communicates',
              settings.personality,
              [
                { label: 'Professional', value: 'professional' },
                { label: 'Casual', value: 'casual' },
                { label: 'Encouraging', value: 'encouraging' },
                { label: 'Formal', value: 'formal' }
              ]
            )}
            

            <View style={[styles.settingRow, { borderBottomColor: theme.border }]}>
              <View style={styles.settingInfo}>
                <Text style={[styles.settingTitle, { color: theme.text }]}>Custom Instructions</Text>
                <Text style={[styles.settingSubtitle, { color: theme.textSecondary }]}>
                  Additional personality traits (comma-separated)
                </Text>
              </View>
              <TextInput
                style={[styles.textInput, { 
                  color: theme.text, 
                  borderColor: theme.border,
                  backgroundColor: theme.background 
                }]}
                value={settings.customInstructions}
                onChangeText={(text) => handleSettingsChange('customInstructions', text)}
                placeholder="e.g., humorous, patient, creative"
                placeholderTextColor={theme.textSecondary}
                multiline
              />
            </View>
          </View>
        )}

        {/* Voice Settings */}
        {renderSectionHeader('Voice & Speech', 'voice', '🎙️')}
        {expandedSections.voice && (
          <View style={[styles.sectionContent, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {/* Realtime Streaming (Beta) toggle */}
            <View style={[styles.settingRow, { borderBottomColor: theme.border }]}>
              <View style={styles.settingInfo}>
                <Text style={[styles.settingTitle, { color: theme.text }]}>Realtime Streaming (Beta)</Text>
                <Text style={[styles.settingSubtitle, { color: theme.textSecondary }]}>Stream voice input and receive live assistant tokens</Text>
                <Text style={[styles.settingSubtitle, { color: theme.textSecondary, marginTop: 4 }]}>Requires EXPO_PUBLIC_DASH_STREAM_URL</Text>
              </View>
              <Switch
                value={streamingPref}
                onValueChange={toggleStreamingPref}
                trackColor={{ false: theme.border, true: `${theme.primary}40` }}
                thumbColor={streamingPref ? theme.primary : '#f4f3f4'}
              />
            </View>

            {renderToggleSetting(
              'voiceEnabled',
              'Voice Responses',
              'Enable text-to-speech for Dash responses',
              settings.voiceEnabled
            )}
            
            {renderPickerSetting(
              'voiceLanguage',
              'Voice Language',
              'Primary language for voice output',
              settings.voiceLanguage,
              [
                { label: 'English (SA)', value: 'en' },
                { label: 'Afrikaans', value: 'af' },
                { label: 'isiZulu', value: 'zu' },
                { label: 'isiXhosa (Beta)', value: 'xh' },
                { label: 'Sepedi (Beta)', value: 'nso' }
              ]
            )}

            {/* Azure Neural Voice Names (for SA languages) */}
            {['en', 'af', 'zu', 'xh', 'nso'].includes(settings.voiceLanguage) && (
              <View style={[styles.settingRow, { borderBottomColor: theme.border }]}>
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingTitle, { color: theme.text }]}>Azure Neural Voice</Text>
                  <Text style={[styles.settingSubtitle, { color: theme.textSecondary }]}> 
                    {settings.voiceLanguage === 'en' && 'English (South Africa) voices'}
                    {settings.voiceLanguage === 'af' && 'Premium Afrikaans voices'}
                    {settings.voiceLanguage === 'zu' && 'Premium isiZulu voices'}
                    {settings.voiceLanguage === 'xh' && 'isiXhosa voice (Azure Speech)'}
                    {settings.voiceLanguage === 'nso' && 'Northern Sotho voice (Azure Speech)'}
                  </Text>
                </View>
                <View style={{ flexDirection: 'column', gap: 8 }}>
                  {settings.voiceLanguage === 'en' && (
                    <>
                      <TouchableOpacity
                        style={[
                          styles.pickerOption,
                          { 
                            backgroundColor: settings.voiceType === 'en-ZA-LeahNeural' ? theme.primary : 'transparent',
                            borderColor: theme.border
                          }
                        ]}
                        onPress={() => handleSettingsChange('voiceType', 'en-ZA-LeahNeural')}
                      >
                        <Text style={[
                          styles.pickerOptionText,
                          { color: settings.voiceType === 'en-ZA-LeahNeural' ? 'white' : theme.text }
                        ]}>
                          👩 Leah (Female)
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.pickerOption,
                          { 
                            backgroundColor: settings.voiceType === 'en-ZA-LukeNeural' ? theme.primary : 'transparent',
                            borderColor: theme.border
                          }
                        ]}
                        onPress={() => handleSettingsChange('voiceType', 'en-ZA-LukeNeural')}
                      >
                        <Text style={[
                          styles.pickerOptionText,
                          { color: settings.voiceType === 'en-ZA-LukeNeural' ? 'white' : theme.text }
                        ]}>
                          👨 Luke (Male)
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}
                  {settings.voiceLanguage === 'af' && (
                    <>
                      <TouchableOpacity
                        style={[
                          styles.pickerOption,
                          { 
                            backgroundColor: settings.voiceType === 'af-ZA-AdriNeural' ? theme.primary : 'transparent',
                            borderColor: theme.border
                          }
                        ]}
                        onPress={() => handleSettingsChange('voiceType', 'af-ZA-AdriNeural')}
                      >
                        <Text style={[
                          styles.pickerOptionText,
                          { color: settings.voiceType === 'af-ZA-AdriNeural' ? 'white' : theme.text }
                        ]}>
                          👩 Adri (Female)
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.pickerOption,
                          { 
                            backgroundColor: settings.voiceType === 'af-ZA-WillemNeural' ? theme.primary : 'transparent',
                            borderColor: theme.border
                          }
                        ]}
                        onPress={() => handleSettingsChange('voiceType', 'af-ZA-WillemNeural')}
                      >
                        <Text style={[
                          styles.pickerOptionText,
                          { color: settings.voiceType === 'af-ZA-WillemNeural' ? 'white' : theme.text }
                        ]}>
                          👨 Willem (Male)
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}
                  {settings.voiceLanguage === 'zu' && (
                    <>
                      <TouchableOpacity
                        style={[
                          styles.pickerOption,
                          { 
                            backgroundColor: settings.voiceType === 'zu-ZA-ThembaNeural' ? theme.primary : 'transparent',
                            borderColor: theme.border
                          }
                        ]}
                        onPress={() => handleSettingsChange('voiceType', 'zu-ZA-ThembaNeural')}
                      >
                        <Text style={[
                          styles.pickerOptionText,
                          { color: settings.voiceType === 'zu-ZA-ThembaNeural' ? 'white' : theme.text }
                        ]}>
                          👨 Themba (Male)
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.pickerOption,
                          { 
                            backgroundColor: settings.voiceType === 'zu-ZA-ThandoNeural' ? theme.primary : 'transparent',
                            borderColor: theme.border
                          }
                        ]}
                        onPress={() => handleSettingsChange('voiceType', 'zu-ZA-ThandoNeural')}
                      >
                        <Text style={[
                          styles.pickerOptionText,
                          { color: settings.voiceType === 'zu-ZA-ThandoNeural' ? 'white' : theme.text }
                        ]}>
                          👩 Thando (Female)
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}
                  {(settings.voiceLanguage === 'xh' || settings.voiceLanguage === 'nso') && (
                    <Text style={[styles.settingSubtitle, { color: theme.textSecondary, padding: 8 }]}>
                      Azure Speech supports {settings.voiceLanguage === 'xh' ? 'isiXhosa' : 'Northern Sotho'} with default voice.
                    </Text>
                  )}
                </View>
              </View>
            )}

            {/* Generic Voice Gender (for other languages) */}
            {!['en', 'af', 'zu', 'xh', 'nso'].includes(settings.voiceLanguage) && (
              <View style={[styles.settingRow, { borderBottomColor: theme.border }]}>
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingTitle, { color: theme.text }]}>Voice Gender</Text>
                  <Text style={[styles.settingSubtitle, { color: theme.textSecondary }]}>
                    {Platform.OS === 'android' 
                      ? 'Android: Voice distinction simulated using pitch modulation'
                      : 'iOS: Uses device-specific voice packs'}
                  </Text>
                </View>
                <View style={styles.pickerContainer}>
                  <TouchableOpacity
                    style={[
                      styles.pickerOption,
                      { 
                        backgroundColor: settings.voiceType === 'male' ? theme.primary : 'transparent',
                        borderColor: theme.border
                      }
                    ]}
                    onPress={() => handleSettingsChange('voiceType', 'male')}
                  >
                    <Text style={[
                      styles.pickerOptionText,
                      { color: settings.voiceType === 'male' ? 'white' : theme.text }
                    ]}>
                      👨 Male
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.pickerOption,
                      { 
                        backgroundColor: settings.voiceType === 'female' ? theme.primary : 'transparent',
                        borderColor: theme.border
                      }
                    ]}
                    onPress={() => handleSettingsChange('voiceType', 'female')}
                  >
                    <Text style={[
                      styles.pickerOptionText,
                      { color: settings.voiceType === 'female' ? 'white' : theme.text }
                    ]}>
                      👩 Female
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {renderSliderSetting(
              'voiceRate',
              'Speech Rate',
              'How fast Dash speaks',
              settings.voiceRate,
              0.5,
              2.0,
              0.1
            )}

            {renderSliderSetting(
              'voicePitch',
              'Voice Pitch',
              'Voice pitch level',
              settings.voicePitch,
              0.5,
              2.0,
              0.1
            )}

            {renderSliderSetting(
              'voiceVolume',
              'Voice Volume',
              'Audio output volume',
              settings.voiceVolume,
              0.1,
              1.0,
              0.1
            )}
            
            {/* Inline voice sample */}
            <View style={[styles.settingRow, { borderBottomColor: theme.border, paddingTop: 8 }]}>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity 
                  style={[styles.actionButton, { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.border, flex: 1 }]}
                  onPress={async () => {
                    try {
                      if (samplePlaying) {
                        const snd = sampleSoundRef.current; 
                        await snd?.stopAsync();
                        await snd?.unloadAsync();
                        sampleSoundRef.current = null;
                        setSamplePlaying(false);
                        setSampleProgress(0);
                        return;
                      }
                      setSampleLoading(true);
                      const langNorm = normalizeLanguageCode(settings.voiceLanguage);
                      const isProviderVoice = /Neural$/i.test(settings.voiceType || '');
                      const gender = settings.voiceType === 'male' ? 'male' : settings.voiceType === 'female' ? 'female' : 'female';
                      const voice_id = isProviderVoice ? settings.voiceType : resolveDefaultVoiceId(langNorm, gender as any);
                      const audioUrl = await voiceService.testVoice(langNorm as any, voice_id);
                      const sound = new Audio.Sound();
                      await sound.loadAsync({ uri: audioUrl }, { shouldPlay: true });
                      sound.setOnPlaybackStatusUpdate((status: any) => {
                        if (!status?.isLoaded) return;
                        if (status.didJustFinish) {
                          setSamplePlaying(false);
                          setSampleLoading(false);
                          setSampleProgress(1);
                          sound.unloadAsync().catch(() => {});
                          sampleSoundRef.current = null;
                        } else if (status.isPlaying && status.durationMillis) {
                          setSamplePlaying(true);
                          setSampleProgress(status.positionMillis / status.durationMillis);
                        }
                      });
                      sampleSoundRef.current = sound;
                      setSampleLoading(false);
                    } catch (err) {
                      setSampleLoading(false);
                      setSamplePlaying(false);
                      setSampleProgress(0);
                      Alert.alert('Sample Error', 'Could not play sample. Please try again.');
                    }
                  }}
                >
                  <Text style={[styles.actionButtonText, { color: theme.text }]}>
                    {samplePlaying ? '⏹ Stop Sample' : sampleLoading ? '⏳ Loading...' : '▶ Play Sample'}
                  </Text>
                </TouchableOpacity>
              </View>
              {samplePlaying || sampleLoading ? (
                <View style={{ marginTop: 8 }}>
                  <View style={{ height: 6, borderRadius: 4, backgroundColor: theme.border, overflow: 'hidden' }}>
                    <View style={{ width: `${Math.round(sampleProgress * 100)}%`, height: '100%', backgroundColor: theme.primary }} />
                  </View>
                  <Text style={{ marginTop: 6, fontSize: 12, color: theme.textSecondary }}>Playing sample… {Math.round(sampleProgress * 100)}%</Text>
                </View>
              ) : null}
            </View>

            {renderToggleSetting(
              'autoReadResponses',
              'Auto-Read Responses',
              'Automatically speak Dash responses',
              settings.autoReadResponses
            )}

            {renderToggleSetting(
              'voiceActivation',
              'Voice Activation',
              'Wake Dash with voice commands',
              settings.voiceActivation
            )}
          </View>
        )}

        {/* Chat Behavior */}
        {renderSectionHeader('Chat & Interaction', 'chat', '💬')}
        {expandedSections.chat && (
          <View style={[styles.sectionContent, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {renderToggleSetting(
              'enterToSend',
              'Enter to Send',
              'Send messages by pressing Enter',
              settings.enterToSend
            )}
            
            {renderToggleSetting(
              'autoVoiceReply',
              'Auto Voice Reply',
              'Automatically respond with voice',
              settings.autoVoiceReply
            )}

            {renderToggleSetting(
              'showTypingIndicator',
              'Typing Indicator',
              'Show when Dash is thinking',
              settings.showTypingIndicator
            )}


            {renderToggleSetting(
              'autoSuggestQuestions',
              'Question Suggestions',
              'Suggest follow-up questions',
              settings.autoSuggestQuestions
            )}

            {renderToggleSetting(
              'contextualHelp',
              'Contextual Help',
              'Offer help based on current topic',
              settings.contextualHelp
            )}
          </View>
        )}

        {/* Learning & Memory */}
        {renderSectionHeader('Learning & Memory', 'learning', '🧠')}
        {expandedSections.learning && (
          <View style={[styles.sectionContent, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {renderToggleSetting(
              'rememberPreferences',
              'Remember Preferences',
              'Save your settings and preferences',
              settings.rememberPreferences
            )}

            {renderToggleSetting(
              'learnFromInteractions',
              'Learn from Interactions',
              'Improve responses based on conversations',
              settings.learnFromInteractions
            )}

          </View>
        )}



        {/* Custom Instructions */}
        {renderSectionHeader('Customization', 'custom', '⚙️')}
        {expandedSections.custom && (
          <View style={[styles.sectionContent, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {renderPickerSetting(
              'teachingStyle',
              'Teaching Style',
              'How Dash explains concepts',
              settings.teachingStyle,
              [
                { label: 'Direct', value: 'direct' },
                { label: 'Guided', value: 'guided' },
                { label: 'Socratic', value: 'socratic' },
                { label: 'Adaptive', value: 'adaptive' }
              ]
            )}

            <View style={[styles.settingRow, { borderBottomColor: theme.border }]}>
              <View style={styles.settingInfo}>
                <Text style={[styles.settingTitle, { color: theme.text }]}>User Context</Text>
                <Text style={[styles.settingSubtitle, { color: theme.textSecondary }]}>
                  Tell Dash about yourself for better assistance
                </Text>
              </View>
              <TextInput
                style={[styles.textInput, { 
                  color: theme.text, 
                  borderColor: theme.border,
                  backgroundColor: theme.background 
                }]}
                value={settings.userContext}
                onChangeText={(text) => handleSettingsChange('userContext', text)}
                placeholder="e.g., Grade 5 teacher, Math specialist, New to teaching"
                placeholderTextColor={theme.textSecondary}
                multiline
                numberOfLines={3}
              />
            </View>
          </View>
        )}

        {/* Accessibility */}
        {renderSectionHeader('Accessibility', 'accessibility', '♿')}
        {expandedSections.accessibility && (
          <View style={[styles.sectionContent, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {renderToggleSetting(
              'highContrast',
              'High Contrast',
              'Increase color contrast for better visibility',
              settings.highContrast
            )}

            {renderToggleSetting(
              'largeFonts',
              'Large Fonts',
              'Use larger text throughout the app',
              settings.largeFonts
            )}

            {renderToggleSetting(
              'screenReader',
              'Screen Reader Support',
              'Optimize for screen reader users',
              settings.screenReader
            )}

            {renderToggleSetting(
              'reducedMotion',
              'Reduced Motion',
              'Minimize animations and effects',
              settings.reducedMotion
            )}
          </View>
        )}


        {/* Footer spacer */}
        <View style={{ height: 96 }} />
      </ScrollView>

      {/* Sticky footer actions */}
      <View style={[styles.footer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {
          (() => {
            const isDirty = computeSignature(settings) !== lastSavedRef.current;
            const successGreen = '#22c55e';
            return (
              <TouchableOpacity 
                style={[
                  styles.footerButton,
                  { 
                    backgroundColor: isDirty ? successGreen : 'transparent',
                    borderColor: isDirty ? successGreen : theme.error,
                    opacity: saving ? 0.7 : 1,
                  }
                ]}
                onPress={isDirty ? saveSettings : resetToDefaults}
                disabled={saving}
              >
                <Text style={[
                  styles.footerButtonText, 
                  { color: isDirty ? '#fff' : theme.error }
                ]}>
                  {isDirty ? (saving ? 'Saving…' : 'Save') : '↺ Reset'}
                </Text>
              </TouchableOpacity>
            );
          })()
        }
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
    paddingBottom: 96,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  actionButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  expandIcon: {
    fontSize: 16,
    fontWeight: '600',
  },
  sectionContent: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    overflow: 'hidden',
  },
  settingRow: {
    padding: 16,
    borderBottomWidth: 1,
  },
  settingInfo: {
    flex: 1,
    marginBottom: 8,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  settingSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderValue: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },
  pickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  pickerOption: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  pickerOptionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  backButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    marginTop: 8,
    marginBottom: 32,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  footerButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  footerButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
