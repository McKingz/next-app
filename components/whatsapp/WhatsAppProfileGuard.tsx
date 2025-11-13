import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { track } from '../../lib/analytics';
import { convertToE164, formatAsUserTypes, validatePhoneNumber, EXAMPLE_PHONE_NUMBERS } from '../../lib/utils/phoneUtils';

interface ProfileRequirement {
  key: string;
  label: string;
  description: string;
  completed: boolean;
  value?: string;
}

interface WhatsAppProfileGuardProps {
  visible: boolean;
  onClose: () => void;
  onProfileComplete: () => void;
  onNavigateToProfile?: () => void;
}

/**
 * Guard component that checks if user profile is complete enough for WhatsApp integration
 * Shows a modal prompting user to complete missing profile information
 */
export const WhatsAppProfileGuard: React.FC<WhatsAppProfileGuardProps> = ({
  visible,
  onClose,
  onProfileComplete,
  onNavigateToProfile,
}) => {
  const { theme, isDark } = useTheme();
  const { user, profile, refreshProfile } = useAuth();
  
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [step, setStep] = useState<'requirements' | 'phone_entry'>('requirements');

  // Check what profile information is missing
  const checkProfileRequirements = (): ProfileRequirement[] => {
    const requirements: ProfileRequirement[] = [
      {
        key: 'first_name',
        label: 'First Name',
        description: 'Your first name for personalized messages',
        completed: !!(profile?.first_name && profile.first_name.trim()),
        value: profile?.first_name,
      },
      {
        key: 'last_name',
        label: 'Last Name',
        description: 'Your last name for identification',
        completed: !!(profile?.last_name && profile.last_name.trim()),
        value: profile?.last_name,
      },
      {
        key: 'phone',
        label: 'Phone Number',
        description: 'Your mobile number for WhatsApp messages',
        completed: !!(profile as any)?.phone && validatePhoneNumber((profile as any).phone).isValid,
        value: (profile as any)?.phone,
      },
      {
        key: 'preschool',
        label: 'School Association',
        description: 'You must be associated with a school',
        completed: !!(profile?.organization_id),
        value: profile?.organization_name,
      },
    ];

    return requirements;
  };

  const requirements = checkProfileRequirements();
  const incompleteRequirements = requirements.filter(req => !req.completed);
  const isProfileComplete = incompleteRequirements.length === 0;

  // Handle phone number update
  const handlePhoneUpdate = async () => {
    const validation = validatePhoneNumber(phoneNumber);
    
    if (!validation.isValid) {
      Alert.alert('Invalid Phone Number', validation.message || 'Please enter a valid phone number');
      return;
    }

    setIsUpdating(true);
    
    try {
      // Track phone update attempt
      track('edudash.whatsapp.phone_update_attempted', {
        user_id: user?.id,
        phone_length: phoneNumber.replace(/\D/g, '').length,
      });

      // TODO: Update profile with new phone number
      // This would typically call a profile service
      // const result = await profileService.updatePhone(validation.e164!);
      
      // For now, simulate the API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Refresh profile to get latest data
      await refreshProfile();
      
      Alert.alert(
        'Phone Updated!',
        `Your phone number has been updated to ${validation.e164}`,
        [
          {
            text: 'Continue to WhatsApp',
            onPress: () => {
              onProfileComplete();
            }
          }
        ]
      );
      
      track('edudash.whatsapp.phone_update_success', {
        user_id: user?.id,
      });
      
    } catch (error) {
      console.error('Failed to update phone number:', error);
      
      track('edudash.whatsapp.phone_update_failed', {
        user_id: user?.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      Alert.alert(
        'Update Failed',
        'Failed to update your phone number. Please try again or contact support.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePhoneNumberChange = (text: string) => {
    const formatted = formatAsUserTypes(text);
    setPhoneNumber(formatted);
  };

  const handleQuickPhoneFix = () => {
    const phoneRequirement = requirements.find(req => req.key === 'phone');
    if (phoneRequirement && !phoneRequirement.completed) {
      setStep('phone_entry');
      // Pre-fill with existing phone if available
      if (phoneRequirement.value) {
        setPhoneNumber(phoneRequirement.value);
      }
    }
  };

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modal: {
      backgroundColor: theme.background,
      borderRadius: 16,
      margin: 20,
      maxWidth: 400,
      width: '90%',
      maxHeight: '85%',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    headerIcon: {
      marginRight: 12,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.text,
      flex: 1,
    },
    closeButton: {
      padding: 4,
    },
    content: {
      padding: 20,
    },
    description: {
      fontSize: 16,
      color: theme.textSecondary,
      lineHeight: 24,
      marginBottom: 24,
      textAlign: 'center',
    },
    requirementsList: {
      marginBottom: 24,
    },
    requirementItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 16,
      padding: 16,
      backgroundColor: isDark ? '#2A2A2A' : '#F8F9FA',
      borderRadius: 12,
    },
    requirementItemIncomplete: {
      borderLeftWidth: 4,
      borderLeftColor: '#FF6B6B',
    },
    requirementItemComplete: {
      borderLeftWidth: 4,
      borderLeftColor: '#51CF66',
    },
    requirementIcon: {
      marginRight: 12,
      marginTop: 2,
    },
    requirementContent: {
      flex: 1,
    },
    requirementLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 4,
    },
    requirementDescription: {
      fontSize: 14,
      color: theme.textSecondary,
      lineHeight: 20,
    },
    requirementValue: {
      fontSize: 14,
      color: theme.primary,
      marginTop: 4,
      fontStyle: 'italic',
    },
    quickFixButton: {
      backgroundColor: theme.primary,
      borderRadius: 8,
      paddingVertical: 8,
      paddingHorizontal: 12,
      marginTop: 8,
      alignSelf: 'flex-start',
    },
    quickFixButtonText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '600',
    },
    completeSection: {
      alignItems: 'center',
      marginTop: 20,
    },
    completeIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: '#51CF66',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    completeTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.text,
      textAlign: 'center',
      marginBottom: 8,
    },
    completeMessage: {
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: 'center',
      marginBottom: 24,
    },
    buttonContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 20,
    },
    button: {
      flex: 1,
      backgroundColor: theme.primary,
      borderRadius: 8,
      paddingVertical: 14,
      alignItems: 'center',
      marginHorizontal: 4,
    },
    buttonSecondary: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: theme.border,
    },
    buttonDisabled: {
      backgroundColor: theme.border,
      opacity: 0.6,
    },
    buttonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    buttonTextSecondary: {
      color: theme.text,
    },
    phoneInputSection: {
      marginBottom: 20,
    },
    inputLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 8,
    },
    phoneInput: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      color: theme.text,
      backgroundColor: isDark ? '#2A2A2A' : '#FFFFFF',
      marginBottom: 8,
    },
    phoneInputFocused: {
      borderColor: theme.primary,
      borderWidth: 2,
    },
    inputHint: {
      fontSize: 12,
      color: theme.textSecondary,
      marginBottom: 16,
    },
    loadingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    loadingText: {
      marginLeft: 8,
      color: '#FFFFFF',
    },
  });

  const renderRequirements = () => (
    <ScrollView showsVerticalScrollIndicator={false}>
      <Text style={styles.description}>
        To use WhatsApp integration, please complete your profile with the following information:
      </Text>

      <View style={styles.requirementsList}>
        {requirements.map((req) => (
          <View
            key={req.key}
            style={[
              styles.requirementItem,
              req.completed ? styles.requirementItemComplete : styles.requirementItemIncomplete,
            ]}
          >
            <Ionicons
              name={req.completed ? 'checkmark-circle' : 'alert-circle'}
              size={20}
              color={req.completed ? '#51CF66' : '#FF6B6B'}
              style={styles.requirementIcon}
            />
            <View style={styles.requirementContent}>
              <Text style={styles.requirementLabel}>{req.label}</Text>
              <Text style={styles.requirementDescription}>{req.description}</Text>
              {req.completed && req.value && (
                <Text style={styles.requirementValue}>✓ {req.value}</Text>
              )}
              {!req.completed && req.key === 'phone' && (
                <TouchableOpacity style={styles.quickFixButton} onPress={handleQuickPhoneFix}>
                  <Text style={styles.quickFixButtonText}>Add Phone Number</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}
      </View>

      {isProfileComplete && (
        <View style={styles.completeSection}>
          <View style={styles.completeIcon}>
            <Ionicons name="checkmark" size={32} color="#FFFFFF" />
          </View>
          <Text style={styles.completeTitle}>Profile Complete!</Text>
          <Text style={styles.completeMessage}>
            Your profile has all the required information for WhatsApp integration.
          </Text>
        </View>
      )}

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.buttonSecondary]}
          onPress={onClose}
        >
          <Text style={[styles.buttonText, styles.buttonTextSecondary]}>
            Cancel
          </Text>
        </TouchableOpacity>

        {isProfileComplete ? (
          <TouchableOpacity
            style={styles.button}
            onPress={onProfileComplete}
          >
            <Text style={styles.buttonText}>
              Continue to WhatsApp
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.button}
            onPress={onNavigateToProfile || (() => Alert.alert('Profile', 'Please complete your profile first'))}
          >
            <Text style={styles.buttonText}>
              Complete Profile
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );

  const renderPhoneEntry = () => (
    <ScrollView showsVerticalScrollIndicator={false}>
      <Text style={styles.description}>
        Add your mobile phone number to receive WhatsApp messages from your school.
      </Text>

      <View style={styles.phoneInputSection}>
        <Text style={styles.inputLabel}>Mobile Phone Number</Text>
        <TextInput
          style={styles.phoneInput}
          value={phoneNumber}
          onChangeText={handlePhoneNumberChange}
          placeholder={EXAMPLE_PHONE_NUMBERS.local}
          placeholderTextColor={theme.textSecondary}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          maxLength={13} // Allow for formatted input
        />
        <Text style={styles.inputHint}>
          Enter your mobile number. Format: {EXAMPLE_PHONE_NUMBERS.local}
        </Text>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.buttonSecondary]}
          onPress={() => setStep('requirements')}
        >
          <Text style={[styles.buttonText, styles.buttonTextSecondary]}>
            Back
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.button,
            (!validatePhoneNumber(phoneNumber).isValid || isUpdating) && styles.buttonDisabled
          ]}
          onPress={handlePhoneUpdate}
          disabled={!validatePhoneNumber(phoneNumber).isValid || isUpdating}
        >
          {isUpdating ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={[styles.buttonText, styles.loadingText]}>
                Updating...
              </Text>
            </View>
          ) : (
            <Text style={styles.buttonText}>
              Save Phone Number
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.modal}>
          <View style={styles.header}>
            <Ionicons
              name="person-circle-outline"
              size={24}
              color={theme.primary}
              style={styles.headerIcon}
            />
            <Text style={styles.headerTitle}>
              Complete Profile for WhatsApp
            </Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            {step === 'requirements' ? renderRequirements() : renderPhoneEntry()}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default WhatsAppProfileGuard;