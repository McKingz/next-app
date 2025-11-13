/**
 * Dash AI WhatsApp Connector
 * 
 * Enhanced WhatsApp integration component that uses Dash AI to provide
 * intelligent onboarding, contextual assistance, and seamless user connection
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  ScrollView,
  TextInput,
  Dimensions,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { DashWhatsAppIntegration } from '@/services/DashWhatsAppIntegration';
import { DashAIAssistant } from '@/services/dash-ai/DashAICompat';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';

const { width: screenWidth } = Dimensions.get('window');

interface DashWhatsAppConnectorProps {
  visible: boolean;
  onClose: () => void;
  mode?: 'connect' | 'invite' | 'manage';
  initialStep?: 'qr_code' | 'manual_setup' | 'smart_invite';
}

export const DashWhatsAppConnector: React.FC<DashWhatsAppConnectorProps> = ({
  visible,
  onClose,
  mode = 'connect',
  initialStep = 'qr_code'
}) => {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [loading, setLoading] = useState(false);
  const [qrCodeData, setQrCodeData] = useState<string>('');
  const [inviteLink, setInviteLink] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [dashSuggestions, setDashSuggestions] = useState<string[]>([]);
  const [whatsappIntegration, setWhatsappIntegration] = useState<DashWhatsAppIntegration | null>(null);

  useEffect(() => {
    if (visible) {
      initializeIntegration();
    }
  }, [visible]);

  const initializeIntegration = async () => {
    try {
      setLoading(true);
      
      // Initialize Dash WhatsApp integration
      const integration = DashWhatsAppIntegration.getInstance();
      await integration.initialize();
      setWhatsappIntegration(integration);
      
      // Generate QR code for connection
      const qrData = integration.generateConnectionQRCode(profile?.id);
      setQrCodeData(qrData);
      
      // Generate smart invite link
      if (profile?.role && profile?.organization_id) {
        const smartLink = integration.createSmartInviteLink(profile.role, profile.organization_id);
        setInviteLink(smartLink);
      }
      
      // Get Dash AI suggestions for WhatsApp integration
      await generateDashSuggestions();
      
    } catch (error) {
      console.error('[DashWhatsApp] Failed to initialize:', error);
      Alert.alert('Error', 'Failed to initialize WhatsApp integration');
    } finally {
      setLoading(false);
    }
  };

  const generateDashSuggestions = async () => {
    try {
      const dashInstance = DashAIAssistant.getInstance();
      
      const suggestionPrompt = `Generate 3 practical suggestions for how ${profile?.role} can use WhatsApp integration with EduDash Pro. 
      Keep each suggestion under 50 characters. Focus on daily workflow improvements.`;
      
      const response = await dashInstance.sendMessage(suggestionPrompt);
      
      // Extract suggestions from response (would parse AI response)
      const suggestions = [
        "Quick homework help via WhatsApp",
        "Instant parent notifications", 
        "Emergency school alerts",
        "AI lesson planning on-the-go"
      ];
      
      setDashSuggestions(suggestions);
    } catch (error) {
      console.error('[DashWhatsApp] Failed to generate suggestions:', error);
    }
  };

  const handleConnectPhoneNumber = async () => {
    if (!phoneNumber.trim()) {
      Alert.alert('Error', 'Please enter a valid phone number');
      return;
    }

    try {
      setLoading(true);
      
      if (whatsappIntegration) {
        const result = await whatsappIntegration.handleIncomingConnection(phoneNumber);
        
        if (result.success) {
          Alert.alert(
            'Connection Initiated! 🎉',
            'Check your WhatsApp for a welcome message from Dash AI. Follow the guided setup to complete your connection.',
            [
              { text: 'Open WhatsApp', onPress: () => openWhatsApp() },
              { text: 'Continue Setup', onPress: () => setCurrentStep('smart_invite') }
            ]
          );
        } else {
          Alert.alert('Connection Failed', result.error || 'Please try again');
        }
      }
    } catch (error) {
      console.error('[DashWhatsApp] Connection failed:', error);
      Alert.alert('Error', 'Failed to connect. Please check your phone number and try again.');
    } finally {
      setLoading(false);
    }
  };

  const openWhatsApp = () => {
    const whatsappUrl = `whatsapp://send?phone=${phoneNumber}&text=${encodeURIComponent("Hi! I'd like to connect to EduDash Pro 🎓")}`;
    
    Linking.openURL(whatsappUrl).catch(() => {
      Alert.alert(
        'WhatsApp Not Found',
        'Please install WhatsApp or use the web version',
        [
          { text: 'Web WhatsApp', onPress: () => Linking.openURL('https://web.whatsapp.com') },
          { text: 'OK' }
        ]
      );
    });
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await Clipboard.setStringAsync(text);
      Alert.alert('Copied!', `${label} copied to clipboard`);
    } catch (error) {
      console.error('[DashWhatsApp] Failed to copy:', error);
    }
  };

  const renderQRCodeStep = () => (
    <ScrollView style={styles.stepContent}>
      <View style={styles.headerSection}>
        <Ionicons name="qr-code" size={32} color={theme.primary} />
        <Text style={[styles.stepTitle, { color: theme.text }]}>
          Connect via QR Code
        </Text>
        <Text style={[styles.stepDescription, { color: theme.textSecondary }]}>
          Scan this QR code with your phone's camera or WhatsApp to instantly connect
        </Text>
      </View>

      <View style={styles.qrContainer}>
        {qrCodeData ? (
          <QRCode
            value={qrCodeData}
            size={200}
            backgroundColor="white"
            color={theme.text || '#000000'}
          />
        ) : (
          <View style={[styles.qrPlaceholder, { backgroundColor: theme.surface }]}>
            <Ionicons name="qr-code" size={80} color={theme.textSecondary} />
          </View>
        )}
      </View>

      <View style={styles.dashSuggestionsSection}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          🤖 Dash AI Suggestions
        </Text>
        {dashSuggestions.map((suggestion, index) => (
          <View key={index} style={[styles.suggestionItem, { backgroundColor: theme.surface }]}>
            <Ionicons name="sparkles" size={16} color={theme.primary} />
            <Text style={[styles.suggestionText, { color: theme.textSecondary }]}>
              {suggestion}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.secondaryButton, { borderColor: theme.border }]}
          onPress={() => setCurrentStep('manual_setup')}
        >
          <Text style={[styles.secondaryButtonText, { color: theme.text }]}>
            Manual Setup
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: theme.primary }]}
          onPress={() => copyToClipboard(qrCodeData, 'Connection link')}
        >
          <Text style={styles.primaryButtonText}>Copy Link</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderManualSetupStep = () => (
    <ScrollView style={styles.stepContent}>
      <View style={styles.headerSection}>
        <Ionicons name="phone-portrait" size={32} color={theme.primary} />
        <Text style={[styles.stepTitle, { color: theme.text }]}>
          Manual WhatsApp Setup
        </Text>
        <Text style={[styles.stepDescription, { color: theme.textSecondary }]}>
          Enter your WhatsApp number to receive guided setup from Dash AI
        </Text>
      </View>

      <View style={styles.inputSection}>
        <Text style={[styles.inputLabel, { color: theme.text }]}>
          WhatsApp Phone Number
        </Text>
        <TextInput
          style={[styles.phoneInput, { 
            backgroundColor: theme.inputBackground, 
            borderColor: theme.inputBorder,
            color: theme.inputText 
          }]}
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          placeholder="+27 82 123 4567"
          placeholderTextColor={theme.inputPlaceholder}
          keyboardType="phone-pad"
          autoFocus
        />
      </View>

      <View style={styles.featuresSection}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          What you'll get:
        </Text>
        <View style={styles.featuresList}>
          <View style={styles.featureItem}>
            <Ionicons name="chatbubble-ellipses" size={20} color="#10B981" />
            <Text style={[styles.featureText, { color: theme.textSecondary }]}>
              Direct chat with Dash AI
            </Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="notifications" size={20} color="#F59E0B" />
            <Text style={[styles.featureText, { color: theme.textSecondary }]}>
              Smart notifications & reminders
            </Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="flash" size={20} color="#8B5CF6" />
            <Text style={[styles.featureText, { color: theme.textSecondary }]}>
              Quick actions via WhatsApp
            </Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="analytics" size={20} color="#3B82F6" />
            <Text style={[styles.featureText, { color: theme.textSecondary }]}>
              Progress updates & insights
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.secondaryButton, { borderColor: theme.border }]}
          onPress={() => setCurrentStep('qr_code')}
        >
          <Text style={[styles.secondaryButtonText, { color: theme.text }]}>
            Use QR Code
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: theme.primary }]}
          onPress={handleConnectPhoneNumber}
          disabled={loading || !phoneNumber.trim()}
        >
          <Text style={styles.primaryButtonText}>
            {loading ? 'Connecting...' : 'Connect'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderSmartInviteStep = () => (
    <ScrollView style={styles.stepContent}>
      <View style={styles.headerSection}>
        <Ionicons name="share-social" size={32} color={theme.primary} />
        <Text style={[styles.stepTitle, { color: theme.text }]}>
          Smart Invite System
        </Text>
        <Text style={[styles.stepDescription, { color: theme.textSecondary }]}>
          Invite others to join EduDash Pro with intelligent onboarding
        </Text>
      </View>

      <View style={styles.inviteSection}>
        <View style={[styles.inviteCard, { backgroundColor: theme.surface }]}>
          <Text style={[styles.inviteTitle, { color: theme.text }]}>
            📱 Smart WhatsApp Invite
          </Text>
          <Text style={[styles.inviteDescription, { color: theme.textSecondary }]}>
            Share this link and Dash AI will guide new users through personalized onboarding
          </Text>
          
          <TouchableOpacity
            style={[styles.copyButton, { backgroundColor: theme.primary + '20' }]}
            onPress={() => copyToClipboard(inviteLink, 'Invite link')}
          >
            <Ionicons name="copy" size={20} color={theme.primary} />
            <Text style={[styles.copyButtonText, { color: theme.primary }]}>
              Copy Invite Link
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.inviteCard, { backgroundColor: theme.surface }]}>
          <Text style={[styles.inviteTitle, { color: theme.text }]}>
            🎯 Role-Based Onboarding
          </Text>
          <Text style={[styles.inviteDescription, { color: theme.textSecondary }]}>
            Dash AI automatically detects user roles and provides personalized setup experience
          </Text>
          
          <View style={styles.rolesList}>
            <View style={styles.roleItem}>
              <Ionicons name="school" size={16} color="#10B981" />
              <Text style={[styles.roleText, { color: theme.textSecondary }]}>
                Teachers → Lesson planning & grading tools
              </Text>
            </View>
            <View style={styles.roleItem}>
              <Ionicons name="business" size={16} color="#F59E0B" />
              <Text style={[styles.roleText, { color: theme.textSecondary }]}>
                Principals → School management dashboard
              </Text>
            </View>
            <View style={styles.roleItem}>
              <Ionicons name="heart" size={16} color="#8B5CF6" />
              <Text style={[styles.roleText, { color: theme.textSecondary }]}>
                Parents → Child progress & homework help
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.secondaryButton, { borderColor: theme.border }]}
          onPress={() => router.push('/screens/dash-assistant?initialMessage=Help me set up WhatsApp integration')}
        >
          <Text style={[styles.secondaryButtonText, { color: theme.text }]}>
            Ask Dash AI
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: theme.primary }]}
          onPress={() => {
            Clipboard.setStringAsync(inviteLink);
            Alert.alert('Copied!', 'Share this link to invite others with intelligent onboarding');
          }}
        >
          <Text style={styles.primaryButtonText}>Share Invite</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {['qr_code', 'manual_setup', 'smart_invite'].map((step, index) => (
        <TouchableOpacity
          key={step}
          style={[
            styles.stepDot,
            {
              backgroundColor: currentStep === step ? theme.primary : theme.surface,
              borderColor: theme.border
            }
          ]}
          onPress={() => setCurrentStep(step as any)}
        >
          <Text style={[
            styles.stepDotText,
            { color: currentStep === step ? 'white' : theme.textSecondary }
          ]}>
            {index + 1}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
          <View style={styles.headerContent}>
            <View style={styles.headerTitle}>
              <Ionicons name="logo-whatsapp" size={24} color="#25D366" />
              <Text style={[styles.title, { color: theme.text }]}>
                WhatsApp Integration
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>
          
          {renderStepIndicator()}
        </View>

        {/* Content */}
        <View style={styles.content}>
          {currentStep === 'qr_code' && renderQRCodeStep()}
          {currentStep === 'manual_setup' && renderManualSetupStep()}
          {currentStep === 'smart_invite' && renderSmartInviteStep()}
        </View>

        {/* Footer */}
        <View style={[styles.footer, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
          <Text style={[styles.footerText, { color: theme.textSecondary }]}>
            🤖 Powered by Dash AI • Enhanced user experience
          </Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepDotText: {
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  stepContent: {
    flex: 1,
    padding: 20,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  stepDescription: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  qrContainer: {
    alignItems: 'center',
    marginBottom: 32,
    padding: 20,
  },
  qrPlaceholder: {
    width: 200,
    height: 200,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dashSuggestionsSection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    gap: 8,
  },
  suggestionText: {
    fontSize: 14,
    flex: 1,
  },
  inputSection: {
    marginBottom: 32,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  phoneInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
  },
  featuresSection: {
    marginBottom: 32,
  },
  featuresList: {
    gap: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    fontSize: 14,
    flex: 1,
  },
  inviteSection: {
    gap: 16,
    marginBottom: 32,
  },
  inviteCard: {
    borderRadius: 12,
    padding: 16,
  },
  inviteTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  inviteDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  copyButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  rolesList: {
    gap: 8,
    marginTop: 12,
  },
  roleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  roleText: {
    fontSize: 12,
    flex: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  primaryButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
  },
});

export default DashWhatsAppConnector;
