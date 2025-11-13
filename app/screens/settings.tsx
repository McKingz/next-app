import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Switch,
  ActivityIndicator,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { BiometricAuthService } from "@/services/BiometricAuthService";
import { BiometricBackupManager } from "@/lib/BiometricBackupManager";
import { assertSupabase } from "@/lib/supabase";
import { useTheme } from "@/contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import { useThemedStyles, themedStyles } from "@/hooks/useThemedStyles";
import { ThemeLanguageSettings } from '@/components/settings/ThemeLanguageSettings';
import InvoiceNotificationSettings from '@/components/settings/InvoiceNotificationSettings';
import { RoleBasedHeader } from '@/components/RoleBasedHeader';
import Constants from 'expo-constants';
// Safe useUpdates hook that handles missing provider
const useSafeUpdates = () => {
  try {
    const { useUpdates } = require('@/contexts/UpdatesProvider');
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useUpdates();
  } catch (error) {
    console.warn('[Settings] UpdatesProvider not available:', error instanceof Error ? error.message : String(error));
    // Return fallback values
    return {
      isDownloading: false,
      isUpdateDownloaded: false,
      updateError: null,
      checkForUpdates: async () => {
        console.log('[Settings] Updates check not available in current environment');
        return false;
      },
      applyUpdate: async () => {
        console.log('[Settings] Update apply not available in current environment');
      },
    };
  }
};
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolSettings } from '@/lib/hooks/useSchoolSettings';
import AsyncStorage from '@react-native-async-storage/async-storage';
// Haptics temporarily disabled to prevent device-specific crashes
// import { Vibration } from 'react-native';
// import Feedback from '@/lib/feedback';

export default function SettingsScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation('common');
  const { profile } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricEnrolled, setBiometricEnrolled] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricTypes, setBiometricTypes] = useState<string[]>([]);
  const [biometricLastUsed, setBiometricLastUsed] = useState<string | null>(null);
  const [hasBackupMethods, setHasBackupMethods] = useState(false);
  const [loading, setLoading] = useState(true);
  const { isDownloading, isUpdateDownloaded, updateError, checkForUpdates, applyUpdate } = useSafeUpdates();
  const schoolId = profile?.organization_id || undefined;
  const schoolSettingsQuery = useSchoolSettings(schoolId);
  
  // Feedback preferences
  const [hapticsEnabled, setHapticsEnabled] = useState<boolean>(true);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  const styles = useThemedStyles((theme) => ({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 40,
    },
    section: {
      padding: 20,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 16,
    },
    settingsCard: {
      ...themedStyles.card(theme),
      padding: 0,
      overflow: 'hidden',
    },
    settingItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.divider,
    },
    lastSettingItem: {
      borderBottomWidth: 0,
    },
    settingLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    settingIcon: {
      marginRight: 16,
    },
    settingContent: {
      flex: 1,
    },
    settingTitle: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.text,
      marginBottom: 2,
    },
    settingSubtitle: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    settingRight: {
      marginLeft: 16,
    },
    biometricInfo: {
      backgroundColor: theme.surfaceVariant,
      padding: 12,
      marginTop: 8,
      borderRadius: 8,
    },
    biometricInfoText: {
      fontSize: 12,
      color: theme.textSecondary,
      lineHeight: 16,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
    },
    loadingText: {
      marginTop: 16,
      fontSize: 16,
      color: theme.textSecondary,
    },
    divider: {
      height: 1,
      backgroundColor: theme.divider,
      marginVertical: 8,
    },
    themeSectionContainer: {
      backgroundColor: theme.surface,
      marginHorizontal: 20,
      marginTop: 8,
      borderRadius: 12,
      overflow: 'hidden',
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
  }));

  // Load feedback preferences
  const loadFeedbackPrefs = useCallback(async () => {
    try {
      const [h, s] = await Promise.all([
        AsyncStorage.getItem('pref_haptics_enabled'),
        AsyncStorage.getItem('pref_sound_enabled'),
      ]);
      setHapticsEnabled(h !== 'false');
      setSoundEnabled(s !== 'false');
    } catch { /* Storage unavailable */ }
  }, []);

  const saveHapticsPref = async (val: boolean) => {
    setHapticsEnabled(val);
    try { await AsyncStorage.setItem('pref_haptics_enabled', val ? 'true' : 'false'); } catch { /* Storage unavailable */ }
  };

  const saveSoundPref = async (val: boolean) => {
    setSoundEnabled(val);
    try { await AsyncStorage.setItem('pref_sound_enabled', val ? 'true' : 'false'); } catch { /* Storage unavailable */ }
  };

  // Load user settings and biometric information
  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      
      // Load biometric information using direct methods that work on OppoA40
      try {
        // Use unified service
        const [capabilities, availableTypes, isEnabled] = await Promise.all([
          BiometricAuthService.checkCapabilities(),
          BiometricAuthService.getAvailableBiometricOptions(),
          BiometricAuthService.isBiometricEnabled(),
        ]);
        
        console.log('Settings: Biometric check:', { capabilities, availableTypes, isEnabled });
        
        setBiometricSupported(capabilities.isAvailable);
        setBiometricEnrolled(capabilities.isEnrolled);
        setBiometricEnabled(isEnabled);
        setBiometricTypes(availableTypes);
        setBiometricLastUsed(null); // We'll get this later if needed

        // Check for backup methods
        const backupMethods = await BiometricBackupManager.getAvailableFallbackMethods();
        setHasBackupMethods(backupMethods.hasPin || backupMethods.hasSecurityQuestions);
      } catch (error) {
        console.error("Error loading biometric info:", error);
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
    loadFeedbackPrefs();
  }, [loadSettings, loadFeedbackPrefs]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadSettings();
    setRefreshing(false);
  }, [loadSettings]);

  const toggleBiometric = async () => {
    if (!biometricEnrolled) {
      Alert.alert(
        t('settings.biometric_alerts.setup_required_title'),
        t('settings.biometric_alerts.setup_required_message'),
        [{ text: t('common.ok') }],
      );
      return;
    }

    try {
      const { data } = await assertSupabase().auth.getUser();
      const user = data.user;

      if (!user) {
        Alert.alert(t('common.error'), t('settings.biometric_alerts.user_not_found'));
        return;
      }

      if (biometricEnabled) {
        // Disable biometric authentication
        await BiometricAuthService.disableBiometric();
        setBiometricEnabled(false);
        Alert.alert(
          t('settings.biometric_alerts.disabled_title'),
          t('settings.biometric_alerts.disabled_message'),
        );
      } else {
        // Enable biometric authentication
        const success = await BiometricAuthService.enableBiometric(
          user.id,
          user.email || "",
        );
        if (success) {
          setBiometricEnabled(true);
          Alert.alert(
            t('settings.biometric_alerts.enabled_title'),
            t('settings.biometric_alerts.enabled_message'),
          );
        }
      }
    } catch (error) {
      console.error("Error toggling biometric:", error);
      Alert.alert(t('common.error'), t('settings.biometric_alerts.update_failed'));
    }
  };

  const getBiometricStatusText = () => {
    if (!biometricSupported) return t('settings.biometric.notAvailable');
    if (!biometricEnrolled) return t('settings.biometric.setupRequired');
    if (biometricEnabled && biometricTypes.length > 0) {
      return `${t('settings.biometric.enabled')} (${biometricTypes.join(', ')})`;
    }
    return biometricEnabled ? t('settings.biometric.enabled') : t('settings.biometric.disabled');
  };

  const getBiometricIcon = () => {
    if (!biometricSupported) return "finger-print-outline";
    // Prioritize Fingerprint icon for OPPO devices with multiple biometric types
    if (biometricTypes.includes('Fingerprint')) {
      return biometricEnabled ? "finger-print" : "finger-print-outline";
    } else if (biometricTypes.includes('Face ID')) {
      return biometricEnabled ? "scan" : "scan-outline";
    } else if (biometricTypes.includes('Iris Scan')) {
      return biometricEnabled ? "eye" : "eye-outline";
    }
    // Default to fingerprint icon
    return biometricEnabled ? "finger-print" : "finger-print-outline";
  };

  const getBiometricIconColor = () => {
    if (!biometricSupported) return theme.textDisabled;
    return biometricEnabled ? theme.success : theme.textSecondary;
  };

  const getBiometricTitle = () => {
    if (biometricTypes.length > 0) {
      // Prioritize Fingerprint over Face ID for OPPO devices
      if (biometricTypes.includes('Fingerprint')) return t('settings.biometric.fingerprint');
      if (biometricTypes.includes('Face ID')) return t('settings.biometric.faceId');
      if (biometricTypes.includes('Iris Scan')) return t('settings.biometric.title');
      return t('settings.biometric.title');
    }
    return t('settings.biometric.title');
  };

  // Testing and debug UI removed from Settings screen

  if (loading) {
    return (
      <View style={styles.container}>
        <RoleBasedHeader title="Settings" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>{t('settings.loading.settings')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <RoleBasedHeader title="Settings" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
          />
        }
      >
        {/* Security Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.securityPrivacy')}</Text>
          
          <View style={styles.settingsCard}>
            {/* Biometric Authentication */}
            <TouchableOpacity
              style={[styles.settingItem]}
              onPress={() => {
                if (biometricSupported && biometricEnrolled) {
                  // Open switch account picker quickly from settings if biometrics enabled
                  if (biometricEnabled) {
                    router.push('/(auth)/sign-in?switch=1');
                    return;
                  }
                  // Toggle biometric authentication
                  toggleBiometric();
                } else {
                  // Show information about setting up biometrics
                  Alert.alert(
                    t('settings.biometric.title'),
                    !biometricSupported 
                      ? t('settings.biometric.notAvailable')
                      : t('settings.biometric.setupRequired'),
                    [{ text: t('common.ok') }]
                  );
                }
              }}
            >
              <View style={styles.settingLeft}>
                <Ionicons
                  name={getBiometricIcon()}
                  size={24}
                  color={getBiometricIconColor()}
                  style={styles.settingIcon}
                />
                <View style={styles.settingContent}>
                  <Text style={styles.settingTitle}>{getBiometricTitle()}</Text>
                  <Text style={styles.settingSubtitle}>
                    {getBiometricStatusText()}
                  </Text>
                  {biometricEnabled && biometricLastUsed && (
                    <Text style={[styles.settingSubtitle, { fontSize: 12, marginTop: 2 }]}>
                      {t('settings.biometric_info.last_used', { date: new Date(biometricLastUsed).toLocaleDateString() })}
                    </Text>
                  )}
                </View>
              </View>
              <View style={styles.settingRight}>
                {biometricSupported && biometricEnrolled ? (
                  <Switch
                    value={biometricEnabled}
                    onValueChange={toggleBiometric}
                    trackColor={{ false: theme.border, true: theme.primary }}
                    thumbColor={biometricEnabled ? theme.onPrimary : theme.textTertiary}
                  />
                ) : biometricSupported && !biometricEnrolled ? (
                  <TouchableOpacity onPress={() => {
                    Alert.alert(
                      t('settings.biometric_alerts.setup_required_title'),
                      t('settings.biometric_alerts.setup_required_message'),
                      [{ text: t('common.ok') }]
                    );
                  }}>
                    <Ionicons
                      name="settings"
                      size={20}
                      color={theme.textSecondary}
                    />
                  </TouchableOpacity>
                ) : (
                  <Ionicons
                    name="information-circle"
                    size={20}
                    color={theme.textDisabled}
                  />
                )}
              </View>
            </TouchableOpacity>

            {/* Privacy & Data Protection */}
            <TouchableOpacity
              style={[styles.settingItem, styles.lastSettingItem]}
              onPress={() =>
                Alert.alert(
                  t('settings.privacy_alert.title'),
                  t('settings.privacy_alert.message'),
                )
              }
            >
              <View style={styles.settingLeft}>
                <Ionicons
                  name="lock-closed"
                  size={24}
                  color={theme.textSecondary}
                  style={styles.settingIcon}
                />
                <View style={styles.settingContent}>
                  <Text style={styles.settingTitle}>{t('settings.dataProtection')}</Text>
                  <Text style={styles.settingSubtitle}>
                    {t('settings.learnDataProtection')}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Biometric Info Card */}
          {biometricSupported && (
            <View style={styles.biometricInfo}>
              <Text style={styles.biometricInfoText}>
                🔒 {t('settings.biometric_info.data_local')}
                {biometricTypes.length > 0 && (
                  biometricTypes.includes('Fingerprint') 
                    ? ' ' + t('settings.biometric_info.fingerprint_secure')
                    : biometricTypes.includes('Face ID')
                    ? ' ' + t('settings.biometric_info.face_secure')
                    : ' ' + t('settings.biometric_info.available_methods', { methods: biometricTypes.join(', ') })
                )}
                {hasBackupMethods && ' ' + t('settings.biometric_info.backup_available')}
                {biometricEnabled && biometricLastUsed && (
                  ' ' + t('settings.biometric_info.last_authenticated', { date: new Date(biometricLastUsed).toLocaleDateString() })
                )}
              </Text>
            </View>
          )}
        </View>

        {/* Notifications & Alerts */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.notifications')}</Text>
          
          {/* Feedback toggles */}
          <View style={styles.settingsCard}>
            {/* Haptic feedback */}
            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
<Ionicons name="pulse" size={24} color={theme.textSecondary} style={styles.settingIcon} />
                <View style={styles.settingContent}>
                  <Text style={styles.settingTitle}>{t('settings.feedback.vibration_title')}</Text>
                  <Text style={styles.settingSubtitle}>{t('settings.feedback.vibration_subtitle')}</Text>
                </View>
              </View>
              <Switch
                value={hapticsEnabled}
                onValueChange={saveHapticsPref}
                trackColor={{ false: theme.border, true: theme.primary }}
                thumbColor={hapticsEnabled ? theme.onPrimary : theme.textTertiary}
              />
            </View>

            {/* Sound alerts */}
            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <Ionicons name="volume-high" size={24} color={theme.textSecondary} style={styles.settingIcon} />
                <View style={styles.settingContent}>
                  <Text style={styles.settingTitle}>{t('settings.feedback.sound_title')}</Text>
                  <Text style={styles.settingSubtitle}>{t('settings.feedback.sound_subtitle')}</Text>
                </View>
              </View>
              <Switch
                value={soundEnabled}
                onValueChange={saveSoundPref}
                trackColor={{ false: theme.border, true: theme.primary }}
                thumbColor={soundEnabled ? theme.onPrimary : theme.textTertiary}
              />
            </View>

            {/* Advanced Sound Alert Settings */}
            <View style={[styles.settingItem, styles.lastSettingItem]}>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                onPress={() => router.push('/screens/sound-alert-settings')}
              >
                <View style={styles.settingLeft}>
                  <Ionicons name="musical-notes" size={24} color={theme.textSecondary} style={styles.settingIcon} />
                  <View style={styles.settingContent}>
                    <Text style={styles.settingTitle}>{t('settings.feedback.advanced_sound_title')}</Text>
                    <Text style={styles.settingSubtitle}>{t('settings.feedback.advanced_sound_subtitle')}</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Billing & Subscriptions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.billing.title')}</Text>
          <View style={{ backgroundColor: theme.surface, borderRadius: 12, overflow: 'hidden' }}>
            <InvoiceNotificationSettings />
            <View style={styles.divider} />
            <TouchableOpacity
              style={[styles.settingItem, styles.lastSettingItem]}
              onPress={() => router.push('/screens/manage-subscription')}
            >
              <View style={styles.settingLeft}>
                <Ionicons name="card" size={24} color={theme.textSecondary} style={styles.settingIcon} />
                <View style={styles.settingContent}>
                  <Text style={styles.settingTitle}>{t('settings.billing.manage_subscription')}</Text>
                  <Text style={styles.settingSubtitle}>{t('settings.billing.manage_subscription_subtitle')}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Feedback test actions */}
        <View style={styles.section}>
          <View style={styles.settingsCard}>
            <TouchableOpacity
              style={[styles.settingItem, styles.lastSettingItem]}
              onPress={() => {
                Alert.alert(t('settings.feedback_test_alert.title'), t('settings.feedback_test_alert.message'));
              }}
            >
              <View style={styles.settingLeft}>
                <Ionicons name="play" size={24} color={theme.textSecondary} style={styles.settingIcon} />
                <View style={styles.settingContent}>
                  <Text style={styles.settingTitle}>{t('settings.feedback.test_title')}</Text>
                  <Text style={styles.settingSubtitle}>{t('settings.feedback.test_subtitle')}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Appearance Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.appearanceLanguage')}</Text>
        </View>

        {/* Theme & Language Settings Component */}
        <View style={styles.themeSectionContainer}>
          <ThemeLanguageSettings />
        </View>

        {/* School Settings - Enhanced Overview */}
        {(profile?.role === 'principal' || profile?.role === 'principal_admin' || profile?.role === 'super_admin') && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.schoolOverview')}</Text>
          
          {/* Loading state */}
          {schoolSettingsQuery.isLoading && (
            <View style={styles.settingsCard}>
              <View style={[styles.settingItem, { justifyContent: 'center', paddingVertical: 24 }]}>
                <ActivityIndicator color={theme.primary} />
                <Text style={[styles.settingSubtitle, { marginTop: 8, textAlign: 'center' }]}>
                  {t('settings.loadingSchoolSettings')}
                </Text>
              </View>
            </View>
          )}
          
          {/* Settings snapshot */}
          {!schoolSettingsQuery.isLoading && schoolSettingsQuery.data && (
          <View style={styles.settingsCard}>
            {/* School Name */}
            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <Ionicons name="business" size={24} color={theme.primary} style={styles.settingIcon} />
                <View style={styles.settingContent}>
                  <Text style={styles.settingTitle}>{t('settings.schoolName')}</Text>
                  <Text style={styles.settingSubtitle}>
                    {schoolSettingsQuery.data.schoolName || t('dashboard.your_school')}
                  </Text>
                </View>
              </View>
            </View>
            
            {/* Regional Settings */}
            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <Ionicons name="globe" size={24} color={theme.textSecondary} style={styles.settingIcon} />
                <View style={styles.settingContent}>
                  <Text style={styles.settingTitle}>{t('settings.regionalSettings')}</Text>
                  <Text style={styles.settingSubtitle}>
                    {schoolSettingsQuery.data.timezone || '—'} • {schoolSettingsQuery.data.currency || '—'}
                  </Text>
                </View>
              </View>
            </View>
            
            {/* WhatsApp Integration */}
            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <Ionicons 
                  name="logo-whatsapp" 
                  size={24} 
                  color={schoolSettingsQuery.data.whatsapp_number ? '#25D366' : theme.textSecondary} 
                  style={styles.settingIcon} 
                />
                <View style={styles.settingContent}>
                  <Text style={styles.settingTitle}>{t('settings.whatsappIntegration')}</Text>
                  <Text style={[styles.settingSubtitle, schoolSettingsQuery.data.whatsapp_number && { color: theme.success }]}>
                    {schoolSettingsQuery.data.whatsapp_number ? t('settings.whatsappConfigured') : t('settings.whatsappNotConfigured')}
                  </Text>
                </View>
              </View>
              {schoolSettingsQuery.data.whatsapp_number && (
                <View style={[styles.settingRight, { backgroundColor: theme.successLight, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }]}>
                  <Text style={{ fontSize: 11, color: theme.success, fontWeight: '600' }}>✓ {t('settings.active')}</Text>
                </View>
              )}
            </View>
            
            {/* Active Features Summary */}
            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <Ionicons name="checkmark-circle" size={24} color={theme.accent} style={styles.settingIcon} />
                <View style={styles.settingContent}>
                  <Text style={styles.settingTitle}>{t('settings.activeFeatures')}</Text>
                  <Text style={styles.settingSubtitle}>
                    {[
                      schoolSettingsQuery.data.features?.activityFeed?.enabled && t('settings.feature.activityFeed'),
                      schoolSettingsQuery.data.features?.financialReports?.enabled && t('settings.feature.financials'),
                      schoolSettingsQuery.data.features?.pettyCash?.enabled && t('settings.feature.pettyCash'),
                    ].filter(Boolean).join(' • ') || t('settings.noFeaturesEnabled')}
                  </Text>
                </View>
              </View>
            </View>
            
            {/* Edit Full Settings CTA */}
            <TouchableOpacity 
              style={[styles.settingItem, styles.lastSettingItem, { backgroundColor: theme.primaryLight }]}
              onPress={() => router.push('/screens/admin/school-settings')}
            >
              <View style={styles.settingLeft}>
                <Ionicons name="settings" size={24} color={theme.primary} style={styles.settingIcon} />
                <View style={styles.settingContent}>
                  <Text style={[styles.settingTitle, { color: theme.primary, fontWeight: '600' }]}>
                    {t('settings.editFullSettings')}
                  </Text>
                  <Text style={[styles.settingSubtitle, { color: theme.primary, opacity: 0.8 }]}>
                    {t('settings.configureAllSchoolSettings')}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.primary} />
            </TouchableOpacity>
          </View>
          )}
          
          {/* Error state */}
          {schoolSettingsQuery.isError && (
            <View style={styles.settingsCard}>
              <View style={[styles.settingItem, { flexDirection: 'column', alignItems: 'flex-start' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <Ionicons name="warning" size={24} color={theme.error} style={styles.settingIcon} />
                  <Text style={[styles.settingTitle, { color: theme.error }]}>
                    {t('settings.failedToLoadSettings')}
                  </Text>
                </View>
                <TouchableOpacity 
                  onPress={() => schoolSettingsQuery.refetch()}
                  style={{ paddingHorizontal: 12, paddingVertical: 6, backgroundColor: theme.primary, borderRadius: 8, marginTop: 8 }}
                >
                  <Text style={{ color: theme.onPrimary, fontSize: 14, fontWeight: '600' }}>
                    {t('common.retry')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
        )}

        {/* Updates */}
        {Platform.OS !== 'web' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('settings.updates.title')}</Text>
            <View style={styles.settingsCard}>
              <TouchableOpacity
                style={[styles.settingItem, styles.lastSettingItem]}
                onPress={async () => {
                  if (isUpdateDownloaded) {
                    Alert.alert(
                      t('updates.Restart App'),
                      t('updates.The app will restart to apply the update. Any unsaved changes will be lost.'),
                      [
                        { text: t('cancel'), style: 'cancel' },
                        { text: t('updates.Restart Now'), onPress: applyUpdate }
                      ]
                    );
                  } else {
                    try {
                      const downloaded = await checkForUpdates();
                      Alert.alert(
                        t('settings.updates.title'),
                        downloaded
                          ? t('settings.updates.update_downloaded_message')
                          : t('settings.updates.no_updates_message')
                      );
                    } catch {
                      Alert.alert(t('common.error'), t('settings.updates.check_failed_message'));
                    }
                  }
                }}
                disabled={isDownloading}
              >
                <View style={styles.settingLeft}>
                  <Ionicons
                    name="cloud-download"
                    size={24}
                    color={theme.textSecondary}
                    style={styles.settingIcon}
                  />
                  <View style={styles.settingContent}>
                    <Text style={styles.settingTitle}>{t('settings.updates.check_for_updates')}</Text>
                    <Text style={styles.settingSubtitle}>
                      {isDownloading 
                        ? t('settings.updates.downloading') 
                        : isUpdateDownloaded 
                        ? t('settings.updates.ready_to_install') 
                        : updateError 
                        ? t('settings.updates.check_failed') 
                        : t('settings.updates.current_version', { version: Constants.expoConfig?.version ?? 'n/a' })}
                    </Text>
                  </View>
                </View>
                {isDownloading ? (
                  <ActivityIndicator color={theme.primary} />
                ) : (
                  <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
                )}
              </TouchableOpacity>

            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.aboutSupport')}</Text>
          
          <View style={styles.settingsCard}>
            <TouchableOpacity
              style={[styles.settingItem]}
              onPress={() =>
                Alert.alert(
                  t('settings.about_alert.title'),
                  t('settings.about_alert.message'),
                  [{ text: t('common.ok') }]
                )
              }
            >
              <View style={styles.settingLeft}>
                <Ionicons
                  name="information-circle"
                  size={24}
                  color={theme.textSecondary}
                  style={styles.settingIcon}
                />
                <View style={styles.settingContent}>
                  <Text style={styles.settingTitle}>{t('settings.about_app.title')}</Text>
                  <Text style={styles.settingSubtitle}>{t('settings.about_app.subtitle')}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.settingItem]}
              onPress={() =>
                Alert.alert(
                  t('settings.help_alert.title'),
                  t('settings.help_alert.message'),
                  [{ text: t('common.ok') }]
                )
              }
            >
              <View style={styles.settingLeft}>
                <Ionicons
                  name="help-circle"
                  size={24}
                  color={theme.textSecondary}
                  style={styles.settingIcon}
                />
                <View style={styles.settingContent}>
                  <Text style={styles.settingTitle}>{t('settings.help_support.title')}</Text>
                  <Text style={styles.settingSubtitle}>{t('settings.help_support.subtitle')}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.settingItem, styles.lastSettingItem]}
              onPress={() => router.push('/screens/account')}
            >
              <View style={styles.settingLeft}>
                <Ionicons
                  name="person-circle"
                  size={24}
                  color={theme.primary}
                  style={styles.settingIcon}
                />
                <View style={styles.settingContent}>
                  <Text style={styles.settingTitle}>{t('settings.account_settings.title')}</Text>
                  <Text style={styles.settingSubtitle}>{t('settings.account_settings.subtitle')}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}