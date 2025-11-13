import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useOnboarding } from '@/contexts/OnboardingContext';

export default function GuardianLinkageScreen() {
  const router = useRouter();
  const { state, updateState, completeStep } = useOnboarding();
  const [guardianEmail, setGuardianEmail] = useState(state.guardianEmail || '');
  const [guardianPhone, setGuardianPhone] = useState(state.guardianPhone || '');
  const [isLoading, setIsLoading] = useState(false);

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSendInvite = async () => {
    if (!validateEmail(guardianEmail)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address');
      return;
    }

    setIsLoading(true);

    try {
      // TODO: Implement actual guardian invite logic via Supabase Edge Function
      // For now, we'll just save the guardian info
      await updateState({
        guardianEmail,
        guardianPhone: guardianPhone || undefined,
        guardianInviteSent: true,
      });
      await completeStep('guardian');

      Alert.alert(
        'Guardian Invite Sent',
        `We've sent an invitation to ${guardianEmail}. They'll need to accept before you can access all features.`,
        [
          {
            text: 'OK',
            onPress: () => router.replace('/onboarding/complete'),
          },
        ]
      );
    } catch (error) {
      console.error('Failed to send guardian invite:', error);
      Alert.alert(
        'Error',
        'Failed to send guardian invite. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = async () => {
    Alert.alert(
      'Skip Guardian Setup?',
      'You can add guardian information later, but some features may be limited until then.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Skip',
          style: 'destructive',
          onPress: async () => {
            await updateState({ guardianInviteSent: true });
            router.replace('/onboarding/complete');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Guardian Information</Text>
            <Text style={styles.subtitle}>
              As a minor ({state.ageGroup}), you need a guardian to oversee your account.
              We'll send them an invitation to link their account with yours.
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Guardian's Email *</Text>
              <TextInput
                style={styles.input}
                placeholder="guardian@example.com"
                value={guardianEmail}
                onChangeText={setGuardianEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Guardian's Phone (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="+1 (555) 123-4567"
                value={guardianPhone}
                onChangeText={setGuardianPhone}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.infoBox}>
              <Text style={styles.infoIcon}>🔒</Text>
              <Text style={styles.infoText}>
                Your guardian will receive an email with instructions to create or link
                their account. They'll be able to monitor your activity and manage certain
                settings based on your organization's policies.
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.skipButton}
            onPress={handleSkip}
            disabled={isLoading}
          >
            <Text style={styles.skipButtonText}>Skip for Now</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.continueButton,
              (!guardianEmail || isLoading) && styles.continueButtonDisabled,
            ]}
            onPress={handleSendInvite}
            disabled={!guardianEmail || isLoading}
          >
            <Text
              style={[
                styles.continueButtonText,
                (!guardianEmail || isLoading) && styles.continueButtonTextDisabled,
              ]}
            >
              {isLoading ? 'Sending Invite...' : 'Send Invite'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    marginTop: 40,
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    lineHeight: 22,
  },
  form: {
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  input: {
    backgroundColor: '#F8F9FA',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    fontSize: 16,
    color: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  infoBox: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    marginTop: 8,
  },
  infoIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#4F46E5',
    lineHeight: 20,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },
  skipButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  skipButtonText: {
    color: '#666666',
    fontSize: 17,
    fontWeight: '600',
  },
  continueButton: {
    backgroundColor: '#4F46E5',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    backgroundColor: '#E5E7EB',
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  continueButtonTextDisabled: {
    color: '#9CA3AF',
  },
});
