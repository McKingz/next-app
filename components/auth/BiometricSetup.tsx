/**
 * Biometric Setup Component
 * 
 * Helps users set up biometric authentication after successful login
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { BiometricAuthService } from '@/services/BiometricAuthService';
import { EnhancedBiometricAuth } from '@/services/EnhancedBiometricAuth';

interface BiometricSetupProps {
  visible: boolean;
  onClose: () => void;
  onSetupComplete?: (enabled: boolean) => void;
}

export function BiometricSetup({ visible, onClose, onSetupComplete }: BiometricSetupProps) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricEnrolled, setBiometricEnrolled] = useState(false);
  const [availableTypes, setAvailableTypes] = useState<string[]>([]);
  const [securityLevel, setSecurityLevel] = useState<string>('weak');

  // Check biometric capabilities when component mounts
  useEffect(() => {
    if (visible) {
      checkBiometricCapabilities();
    }
  }, [visible]);

  const checkBiometricCapabilities = async () => {
    try {
      const capabilities = await BiometricAuthService.checkCapabilities();
      const types = await BiometricAuthService.getAvailableBiometricOptions();
      
      setBiometricSupported(capabilities.isAvailable);
      setBiometricEnrolled(capabilities.isEnrolled);
      setAvailableTypes(types);
      setSecurityLevel(capabilities.securityLevel);
    } catch (error) {
      console.error('Error checking biometric capabilities:', error);
      setBiometricSupported(false);
      setBiometricEnrolled(false);
    }
  };

  const enableBiometric = async () => {
    if (!user?.id || !user?.email) {
      Alert.alert(
        t('common.error'),
        'User information not available. Please try again.',
        [{ text: t('common.ok') }]
      );
      return;
    }

    try {
      setLoading(true);
      
      // Get user profile for enhanced biometric setup
      let profile = null;
      try {
        const { fetchEnhancedUserProfile } = await import('@/lib/rbac');
        profile = await fetchEnhancedUserProfile(user.id);
      } catch (profileError) {
        console.warn('Could not fetch profile for biometric setup:', profileError);
      }
      
      // Use enhanced biometric service for setup
      const success = await EnhancedBiometricAuth.setupBiometricForUser(user, profile);
      
      if (success) {
        // Enhanced service shows its own success alert
        // Set lastUnlockedAt to now to avoid immediate re-prompt after enabling
        try { await BiometricAuthService.setLastUnlockedAt(Date.now()); } catch { /* Intentional: non-fatal */ }
        onSetupComplete?.(true);
        onClose();
      }
    } catch (error) {
      console.error('Error enabling biometric:', error);
      Alert.alert(
        t('common.error'),
        'Failed to enable biometric authentication. Please try again.',
        [{ text: t('common.ok') }]
      );
    } finally {
      setLoading(false);
    }
  };

  const getBiometricIcon = () => {
    if (availableTypes.includes('Face ID')) return 'scan';
    if (availableTypes.includes('Fingerprint')) return 'finger-print';
    return 'shield-checkmark';
  };

  const getBiometricTitle = () => {
    if (availableTypes.includes('Face ID')) return t('settings.biometric.faceId');
    if (availableTypes.includes('Fingerprint')) return t('settings.biometric.fingerprint');
    return t('settings.biometric.title');
  };

  const getBiometricDescription = () => {
    if (availableTypes.includes('Fingerprint')) {
      return 'Sign in quickly and securely using your fingerprint. Your biometric data stays on your device and is never shared.';
    }
    if (availableTypes.includes('Face ID')) {
      return 'Sign in quickly and securely using Face ID. Your biometric data stays on your device and is never shared.';
    }
    return 'Sign in quickly and securely using biometric authentication.';
  };

  const styles = StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: theme.modalOverlay,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      backgroundColor: theme.surface,
      borderRadius: 20,
      padding: 24,
      margin: 20,
      maxWidth: 400,
      width: '90%',
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 8,
    },
    header: {
      alignItems: 'center',
      marginBottom: 24,
    },
    iconContainer: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: theme.primaryLight,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.text,
      textAlign: 'center',
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      color: theme.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
    },
    featuresContainer: {
      marginVertical: 20,
    },
    feature: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    featureIcon: {
      marginRight: 12,
    },
    featureText: {
      fontSize: 16,
      color: theme.text,
      flex: 1,
    },
    securityNote: {
      backgroundColor: theme.surfaceVariant,
      padding: 16,
      borderRadius: 12,
      marginVertical: 16,
    },
    securityText: {
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    buttonContainer: {
      gap: 12,
    },
    enableButton: {
      backgroundColor: theme.primary,
      paddingVertical: 16,
      paddingHorizontal: 24,
      borderRadius: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    enableButtonText: {
      color: theme.onPrimary,
      fontSize: 18,
      fontWeight: '600',
    },
    skipButton: {
      paddingVertical: 16,
      paddingHorizontal: 24,
      alignItems: 'center',
    },
    skipButtonText: {
      color: theme.textSecondary,
      fontSize: 16,
      fontWeight: '500',
    },
    unavailableContainer: {
      alignItems: 'center',
      padding: 20,
    },
    unavailableText: {
      fontSize: 16,
      color: theme.textSecondary,
      textAlign: 'center',
      marginBottom: 20,
      lineHeight: 24,
    },
  });

  if (!biometricSupported || !biometricEnrolled) {
    return (
      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.unavailableContainer}>
              <View style={[styles.iconContainer, { backgroundColor: theme.textDisabled + '20' }]}>
                <Ionicons name="information-circle" size={40} color={theme.textDisabled} />
              </View>
              <Text style={styles.title}>Biometric Setup</Text>
              <Text style={styles.unavailableText}>
                {!biometricSupported 
                  ? 'Biometric authentication is not available on this device.'
                  : 'Please set up fingerprint or face recognition in your device settings first, then try again.'
                }
              </Text>
              <TouchableOpacity style={styles.skipButton} onPress={onClose}>
                <Text style={styles.skipButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Ionicons name={getBiometricIcon()} size={40} color={theme.onPrimary} />
            </View>
            <Text style={styles.title}>Enable {getBiometricTitle()}?</Text>
            <Text style={styles.subtitle}>
              {getBiometricDescription()}
            </Text>
          </View>

          <View style={styles.featuresContainer}>
            <View style={styles.feature}>
              <Ionicons name="flash" size={20} color={theme.success} style={styles.featureIcon} />
              <Text style={styles.featureText}>Quick & convenient sign in</Text>
            </View>
            <View style={styles.feature}>
              <Ionicons name="shield-checkmark" size={20} color={theme.success} style={styles.featureIcon} />
              <Text style={styles.featureText}>Enhanced security</Text>
            </View>
            <View style={styles.feature}>
              <Ionicons name="lock-closed" size={20} color={theme.success} style={styles.featureIcon} />
              <Text style={styles.featureText}>Data stays on your device</Text>
            </View>
          </View>

          <View style={styles.securityNote}>
            <Text style={styles.securityText}>
              🔒 {t('settings.biometric.dataSecure')} {t('settings.biometric.backupAvailable')}
            </Text>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.enableButton}
              onPress={enableBiometric}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={theme.onPrimary} size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color={theme.onPrimary} />
                  <Text style={styles.enableButtonText}>
                    {t('common.enable')} {availableTypes.length > 1 ? 'Biometric' : availableTypes[0]}
                  </Text>
                </>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.skipButton} onPress={onClose}>
              <Text style={styles.skipButtonText}>{t('common.later')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}