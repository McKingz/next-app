/**
 * School Settings Screen
 * 
 * Clean, compact settings interface for school administrators
 * Only accessible by Principals and School Administrators.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';
import { offlineCacheService } from '@/lib/services/offlineCacheService';
import { useSchoolSettings, useUpdateSchoolSettings } from '@/lib/hooks/useSchoolSettings';
import { useTheme } from '@/contexts/ThemeContext';
// import { useThemedStyles } from '@/hooks/useThemedStyles'; // TODO: Use for theme-aware styles
import { Colors } from '@/constants/Colors';

interface SchoolSettings {
  // Basic School Info
  schoolName: string;
  schoolLogo?: string;
  primaryColor: string;
  secondaryColor: string;
  timezone: string;
  currency: string;
  
  // Feature Toggles
  features: {
    activityFeed: {
      enabled: boolean;
      allowTeacherDelete: boolean;
      allowParentComment: boolean;
      showPriorityBadges: boolean;
    };
    studentsDirectory: {
      enabled: boolean;
      showPhotos: boolean;
      showMedicalInfo: boolean;
      allowTeacherEdit: boolean;
      showPaymentStatus: boolean;
    };
    teachersDirectory: {
      enabled: boolean;
      showSalaries: boolean;
      showPerformanceRatings: boolean;
      allowParentContact: boolean;
      showQualifications: boolean;
    };
    financialReports: {
      enabled: boolean;
      showTeacherView: boolean;
      allowExport: boolean;
      showDetailedBreakdown: boolean;
      requireApprovalLimit: number;
    };
    pettyCash: {
      enabled: boolean;
      dailyLimit: number;
      requireApprovalAbove: number;
      allowedCategories: string[];
      requireReceipts: boolean;
    };
  };
  
  // Display Options
  display: {
    dashboardLayout: 'grid' | 'list';
    showWeatherWidget: boolean;
    showCalendarWidget: boolean;
    defaultLanguage: string;
    dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
    timeFormat: '12h' | '24h';
  };
  
  // Permissions & Roles
  permissions: {
    allowTeacherReports: boolean;
    allowParentMessaging: boolean;
    requireTwoFactorAuth: boolean;
    sessionTimeout: number;
  };
  
  // Notifications
  notifications: {
    emailEnabled: boolean;
    smsEnabled: boolean;
    pushEnabled: boolean;
    dailyReports: boolean;
    urgentAlertsOnly: boolean;
  };
  
  // Backup & Data
  backup: {
    autoBackupEnabled: boolean;
    backupFrequency: 'daily' | 'weekly' | 'monthly';
    dataRetentionMonths: number;
  };
}

const DEFAULT_SETTINGS: SchoolSettings = {
  schoolName: 'My School',
  primaryColor: '#4F46E5',
  secondaryColor: '#6B7280',
  timezone: 'Africa/Johannesburg',
  currency: 'ZAR',
  features: {
    activityFeed: {
      enabled: true,
      allowTeacherDelete: false,
      allowParentComment: true,
      showPriorityBadges: true,
    },
    studentsDirectory: {
      enabled: true,
      showPhotos: true,
      showMedicalInfo: true,
      allowTeacherEdit: true,
      showPaymentStatus: true,
    },
    teachersDirectory: {
      enabled: true,
      showSalaries: false,
      showPerformanceRatings: true,
      allowParentContact: true,
      showQualifications: true,
    },
    financialReports: {
      enabled: true,
      showTeacherView: false,
      allowExport: true,
      showDetailedBreakdown: true,
      requireApprovalLimit: 1000,
    },
    pettyCash: {
      enabled: true,
      dailyLimit: 500,
      requireApprovalAbove: 200,
      allowedCategories: ['Office Supplies', 'Maintenance', 'Emergency', 'Utilities'],
      requireReceipts: true,
    },
  },
  display: {
    dashboardLayout: 'grid',
    showWeatherWidget: true,
    showCalendarWidget: true,
    defaultLanguage: 'en',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '24h',
  },
  permissions: {
    allowTeacherReports: true,
    allowParentMessaging: true,
    requireTwoFactorAuth: false,
    sessionTimeout: 30,
  },
  notifications: {
    emailEnabled: true,
    smsEnabled: false,
    pushEnabled: true,
    dailyReports: true,
    urgentAlertsOnly: false,
  },
  backup: {
    autoBackupEnabled: true,
    backupFrequency: 'daily',
    dataRetentionMonths: 12,
  },
};

export default function SchoolSettingsScreen() {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const { theme } = useTheme();
  const [settings, setSettings] = useState<SchoolSettings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const insets = useSafeAreaInsets();

  const schoolId = profile?.organization_id;
  const settingsQuery = useSchoolSettings(schoolId);
  const updateMutation = useUpdateSchoolSettings(schoolId);

  useEffect(() => {
    if (settingsQuery.data) {
      setSettings(prev => ({ ...prev, ...settingsQuery.data! }));
    }
     
  }, [settingsQuery.data]);

  const canAccessSettings = (): boolean => {
    return profile?.role === 'principal' || profile?.role === 'principal_admin';
  };

  const loadSettings = async () => {
    try {
      const cached = schoolId ? await offlineCacheService.get(`school_settings`, schoolId, user?.id || '') : null;
      if (cached) {
        const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
        setSettings({ ...DEFAULT_SETTINGS, ...(parsed as Partial<SchoolSettings>) });
      }
      // Server data comes via React Query effect above
    } catch (error) {
      console.error('Failed to load school settings:', error);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      if (schoolId) {
        // Optimistically cache
        await offlineCacheService.set(`school_settings`, schoolId, settings, user?.id || '', schoolId);
        // Persist to backend
        await updateMutation.mutateAsync(settings);
      }
      Alert.alert(
        'Settings Saved', 
        'Your school settings have been updated successfully.\n\nChanges will take effect immediately.',
        [{ text: 'OK', style: 'default' }]
      );
    } catch (error) {
      console.error('Failed to save settings:', error);
      Alert.alert(
        'Save Failed', 
        'There was an error saving your settings. Please check your connection and try again.',
        [{ text: 'OK', style: 'default' }]
      );
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key: keyof SchoolSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const updateNestedSetting = (path: string[], value: any) => {
    setSettings(prev => {
      const newSettings = { ...prev };
      let current = newSettings as any;
      
      for (let i = 0; i < path.length - 1; i++) {
        if (current[path[i]]) {
          current[path[i]] = { ...current[path[i]] };
          current = current[path[i]];
        }
      }
      
      current[path[path.length - 1]] = value;
      return newSettings;
    });
  };

  const renderSettingRow = (label: string, value: string | boolean, onPress?: () => void) => (
    <TouchableOpacity style={[styles.settingRow, { backgroundColor: theme.surface }]} onPress={onPress} disabled={!onPress}>
      <Text style={[styles.settingLabel, { color: theme.text }]}>{label}</Text>
      <View style={styles.settingValue}>
        {typeof value === 'boolean' ? (
          <Switch
            value={value}
            onValueChange={onPress || (() => {})}
            trackColor={{ false: theme.border, true: theme.primary + '40' }}
            thumbColor={value ? theme.primary : theme.surface}
          />
        ) : (
          <>
            <Text style={[styles.settingValueText, { color: theme.textSecondary }]}>{value}</Text>
            {onPress && <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />}
          </>
        )}
      </View>
    </TouchableOpacity>
  );

  if (!canAccessSettings()) {
    return (
      <View style={[styles.accessDenied, { backgroundColor: theme.background }]}>
        <Ionicons name="lock-closed" size={64} color={theme.textSecondary} />
        <Text style={[styles.accessDeniedTitle, { color: theme.text }]}>Access Denied</Text>
        <Text style={[styles.accessDeniedText, { color: theme.textSecondary }]}>
          {t('school_settings.access_denied_text', { defaultValue: 'Only school principals can access these settings.' })}
        </Text>
        <TouchableOpacity style={[styles.backButton, { backgroundColor: theme.primary }]} onPress={() => router.back()}>
          <Text style={[styles.backButtonText, { color: theme.onPrimary }]}>{t('navigation.back', { defaultValue: 'Back' })}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Content */}
      <ScrollView style={styles.content} contentContainerStyle={[styles.scrollContent, { paddingBottom: 80 + insets.bottom }]}>
        {/* Hero */}
        <View style={[styles.heroCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: theme.surfaceVariant }]}>
            <Ionicons name="arrow-back" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.heroTitle, { color: theme.text }]}>{t('school_settings.title', { defaultValue: 'School Settings' })}</Text>
            <Text style={[styles.heroSubtitle, { color: theme.textSecondary }]}>{t('school_settings.hero_subtitle', { defaultValue: 'Manage features, permissions and policies' })}</Text>
          </View>
        </View>

        {/* Basic Settings */}
        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('school_settings.section.school_information', { defaultValue: 'School Information' })}</Text>
          {renderSettingRow(t('school_settings.label.school_name', { defaultValue: 'School Name' }), settings.schoolName, () => {
            Alert.prompt(t('school_settings.prompt.school_name_title', { defaultValue: 'School Name' }), t('school_settings.prompt.school_name_desc', { defaultValue: 'Enter school name' }), (text) => {
              if (text) updateSetting('schoolName', text);
            });
          })}
          {renderSettingRow(t('school_settings.label.currency', { defaultValue: 'Currency' }), settings.currency, () => {
            Alert.alert(t('school_settings.alert.currency_title', { defaultValue: 'Currency' }), t('school_settings.alert.currency_change', { defaultValue: 'Change currency?' }));
          })}
          {renderSettingRow(t('school_settings.label.timezone', { defaultValue: 'Timezone' }), settings.timezone, () => {
            Alert.alert(t('school_settings.alert.timezone_title', { defaultValue: 'Timezone' }), t('school_settings.alert.timezone_change', { defaultValue: 'Change timezone?' }));
          })}
        </View>

        {/* Display Settings */}
        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('school_settings.section.display_language', { defaultValue: 'Display & Language' })}</Text>
          {renderSettingRow(t('school_settings.label.language', { defaultValue: 'Language' }), settings.display.defaultLanguage.toUpperCase(), () => {
            Alert.alert(t('school_settings.alert.language_title', { defaultValue: 'Language' }), t('school_settings.alert.language_change', { defaultValue: 'Change language?' }));
          })}
          {renderSettingRow(t('school_settings.label.date_format', { defaultValue: 'Date Format' }), settings.display.dateFormat, () => {
            Alert.alert(t('school_settings.alert.date_format_title', { defaultValue: 'Date Format' }), t('school_settings.alert.date_format_change', { defaultValue: 'Change date format?' }));
          })}
          {renderSettingRow(t('school_settings.label.time_format', { defaultValue: 'Time Format' }), settings.display.timeFormat, () => {
            Alert.alert(t('school_settings.alert.time_format_title', { defaultValue: 'Time Format' }), t('school_settings.alert.time_format_change', { defaultValue: 'Change time format?' }));
          })}
        </View>

        {/* Features */}
        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('school_settings.section.features', { defaultValue: 'Features' })}</Text>
          {renderSettingRow(t('school_settings.label.activity_feed', { defaultValue: 'Activity Feed' }), settings.features.activityFeed.enabled, () => {
            updateNestedSetting(['features', 'activityFeed', 'enabled'], !settings.features.activityFeed.enabled);
          })}
          {renderSettingRow(t('school_settings.label.students_directory', { defaultValue: 'Students Directory' }), settings.features.studentsDirectory.enabled, () => {
            updateNestedSetting(['features', 'studentsDirectory', 'enabled'], !settings.features.studentsDirectory.enabled);
          })}
          {renderSettingRow(t('school_settings.label.financial_reports', { defaultValue: 'Financial Reports' }), settings.features.financialReports.enabled, () => {
            updateNestedSetting(['features', 'financialReports', 'enabled'], !settings.features.financialReports.enabled);
          })}
          {renderSettingRow(t('school_settings.label.petty_cash_system', { defaultValue: 'Petty Cash System' }), settings.features.pettyCash.enabled, () => {
            updateNestedSetting(['features', 'pettyCash', 'enabled'], !settings.features.pettyCash.enabled);
          })}
        </View>

        {/* Permissions */}
        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('school_settings.section.permissions', { defaultValue: 'Permissions' })}</Text>
          {renderSettingRow(t('school_settings.label.allow_teacher_reports', { defaultValue: 'Allow Teacher Reports' }), settings.permissions.allowTeacherReports, () => {
            updateNestedSetting(['permissions', 'allowTeacherReports'], !settings.permissions.allowTeacherReports);
          })}
          {renderSettingRow(t('school_settings.label.allow_parent_messaging', { defaultValue: 'Allow Parent Messaging' }), settings.permissions.allowParentMessaging, () => {
            updateNestedSetting(['permissions', 'allowParentMessaging'], !settings.permissions.allowParentMessaging);
          })}
          {renderSettingRow(t('school_settings.label.session_timeout', { defaultValue: 'Session Timeout' }), `${settings.permissions.sessionTimeout} min`, () => {
            Alert.alert(t('school_settings.alert.session_timeout_title', { defaultValue: 'Session Timeout' }), t('school_settings.alert.session_timeout_choose', { defaultValue: 'Choose timeout duration:' }), [
              { text: t('school_settings.option.minutes_15', { defaultValue: '15 min' }), onPress: () => updateNestedSetting(['permissions', 'sessionTimeout'], 15) },
              { text: t('school_settings.option.minutes_30', { defaultValue: '30 min' }), onPress: () => updateNestedSetting(['permissions', 'sessionTimeout'], 30) },
              { text: t('school_settings.option.minutes_60', { defaultValue: '60 min' }), onPress: () => updateNestedSetting(['permissions', 'sessionTimeout'], 60) },
              { text: t('school_settings.option.minutes_120', { defaultValue: '120 min' }), onPress: () => updateNestedSetting(['permissions', 'sessionTimeout'], 120) },
              { text: t('navigation.cancel', { defaultValue: 'Cancel' }), style: 'cancel' }
            ]);
          })}
        </View>

        {/* Notifications */}
        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('school_settings.section.notifications', { defaultValue: 'Notifications' })}</Text>
          {renderSettingRow(t('school_settings.label.email_notifications', { defaultValue: 'Email Notifications' }), settings.notifications.emailEnabled, () => {
            updateNestedSetting(['notifications', 'emailEnabled'], !settings.notifications.emailEnabled);
          })}
          {renderSettingRow(t('school_settings.label.sms_notifications', { defaultValue: 'SMS Notifications' }), settings.notifications.smsEnabled, () => {
            updateNestedSetting(['notifications', 'smsEnabled'], !settings.notifications.smsEnabled);
          })}
          {renderSettingRow(t('school_settings.label.push_notifications', { defaultValue: 'Push Notifications' }), settings.notifications.pushEnabled, () => {
            updateNestedSetting(['notifications', 'pushEnabled'], !settings.notifications.pushEnabled);
          })}
          {renderSettingRow(t('school_settings.label.daily_reports', { defaultValue: 'Daily Reports' }), settings.notifications.dailyReports, () => {
            updateNestedSetting(['notifications', 'dailyReports'], !settings.notifications.dailyReports);
          })}
        </View>

        {/* Security & Backup */}
        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('school_settings.section.security_backup', { defaultValue: 'Security & Backup' })}</Text>
          {renderSettingRow(t('school_settings.label.two_factor_auth', { defaultValue: 'Two-Factor Authentication' }), settings.permissions.requireTwoFactorAuth, () => {
            updateNestedSetting(['permissions', 'requireTwoFactorAuth'], !settings.permissions.requireTwoFactorAuth);
          })}
          {renderSettingRow(t('school_settings.label.auto_backup', { defaultValue: 'Auto Backup' }), settings.backup.autoBackupEnabled, () => {
            updateNestedSetting(['backup', 'autoBackupEnabled'], !settings.backup.autoBackupEnabled);
          })}
          {renderSettingRow(t('school_settings.label.backup_frequency', { defaultValue: 'Backup Frequency' }), settings.backup.backupFrequency, () => {
            Alert.alert(t('school_settings.alert.backup_frequency_title', { defaultValue: 'Backup Frequency' }), t('school_settings.alert.choose_frequency', { defaultValue: 'Choose frequency' }), [
              { text: t('school_settings.option.daily', { defaultValue: 'Daily' }), onPress: () => updateNestedSetting(['backup', 'backupFrequency'], 'daily') },
              { text: t('school_settings.option.weekly', { defaultValue: 'Weekly' }), onPress: () => updateNestedSetting(['backup', 'backupFrequency'], 'weekly') },
              { text: t('school_settings.option.monthly', { defaultValue: 'Monthly' }), onPress: () => updateNestedSetting(['backup', 'backupFrequency'], 'monthly') },
              { text: t('navigation.cancel', { defaultValue: 'Cancel' }), style: 'cancel' }
            ]);
          })}
          {renderSettingRow(t('school_settings.label.data_retention', { defaultValue: 'Data Retention' }), `${settings.backup.dataRetentionMonths} months`, () => {
            Alert.alert(t('school_settings.alert.data_retention_title', { defaultValue: 'Data Retention' }), t('school_settings.alert.data_retention_choose', { defaultValue: 'Choose retention period:' }), [
              { text: t('school_settings.option.months_6', { defaultValue: '6 months' }), onPress: () => updateNestedSetting(['backup', 'dataRetentionMonths'], 6) },
              { text: t('school_settings.option.months_12', { defaultValue: '12 months' }), onPress: () => updateNestedSetting(['backup', 'dataRetentionMonths'], 12) },
              { text: t('school_settings.option.months_24', { defaultValue: '24 months' }), onPress: () => updateNestedSetting(['backup', 'dataRetentionMonths'], 24) },
              { text: t('school_settings.option.months_36', { defaultValue: '36 months' }), onPress: () => updateNestedSetting(['backup', 'dataRetentionMonths'], 36) },
              { text: t('navigation.cancel', { defaultValue: 'Cancel' }), style: 'cancel' }
            ]);
          })}
        </View>

        {/* Advanced Settings */}
        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('school_settings.section.advanced_settings', { defaultValue: 'Advanced Settings' })}</Text>
          {renderSettingRow(t('school_settings.label.dashboard_layout', { defaultValue: 'Dashboard Layout' }), settings.display.dashboardLayout, () => {
            Alert.alert(t('school_settings.alert.dashboard_layout_title', { defaultValue: 'Dashboard Layout' }), t('school_settings.alert.choose_layout', { defaultValue: 'Choose layout' }), [
              { text: t('school_settings.option.grid', { defaultValue: 'Grid' }), onPress: () => updateNestedSetting(['display', 'dashboardLayout'], 'grid') },
              { text: t('school_settings.option.list', { defaultValue: 'List' }), onPress: () => updateNestedSetting(['display', 'dashboardLayout'], 'list') },
              { text: t('navigation.cancel', { defaultValue: 'Cancel' }), style: 'cancel' }
            ]);
          })}
          {renderSettingRow(t('school_settings.label.weather_widget', { defaultValue: 'Weather Widget' }), settings.display.showWeatherWidget, () => {
            updateNestedSetting(['display', 'showWeatherWidget'], !settings.display.showWeatherWidget);
          })}
          {renderSettingRow(t('school_settings.label.calendar_widget', { defaultValue: 'Calendar Widget' }), settings.display.showCalendarWidget, () => {
            updateNestedSetting(['display', 'showCalendarWidget'], !settings.display.showCalendarWidget);
          })}
          {renderSettingRow(t('school_settings.label.financial_reports_limit', { defaultValue: 'Financial Reports Limit' }), `${settings.features.financialReports.requireApprovalLimit}`, () => {
            Alert.alert(t('school_settings.alert.approval_limit_title', { defaultValue: 'Approval Limit' }), t('school_settings.alert.approval_limit_choose', { defaultValue: 'Choose amount requiring approval:' }), [
              { text: t('school_settings.option.r500', { defaultValue: 'R500' }), onPress: () => updateNestedSetting(['features', 'financialReports', 'requireApprovalLimit'], 500) },
              { text: t('school_settings.option.r1000', { defaultValue: 'R1000' }), onPress: () => updateNestedSetting(['features', 'financialReports', 'requireApprovalLimit'], 1000) },
              { text: t('school_settings.option.r2500', { defaultValue: 'R2500' }), onPress: () => updateNestedSetting(['features', 'financialReports', 'requireApprovalLimit'], 2500) },
              { text: t('school_settings.option.r5000', { defaultValue: 'R5000' }), onPress: () => updateNestedSetting(['features', 'financialReports', 'requireApprovalLimit'], 5000) },
              { text: t('navigation.cancel', { defaultValue: 'Cancel' }), style: 'cancel' }
            ]);
          })}
          {renderSettingRow(t('school_settings.label.petty_cash_daily_limit', { defaultValue: 'Petty Cash Daily Limit' }), `${settings.features.pettyCash.dailyLimit}`, () => {
            Alert.alert(t('school_settings.alert.daily_limit_title', { defaultValue: 'Daily Limit' }), t('school_settings.alert.daily_limit_choose', { defaultValue: 'Choose daily petty cash limit:' }), [
              { text: t('school_settings.option.r200', { defaultValue: 'R200' }), onPress: () => updateNestedSetting(['features', 'pettyCash', 'dailyLimit'], 200) },
              { text: t('school_settings.option.r500', { defaultValue: 'R500' }), onPress: () => updateNestedSetting(['features', 'pettyCash', 'dailyLimit'], 500) },
              { text: t('school_settings.option.r1000', { defaultValue: 'R1000' }), onPress: () => updateNestedSetting(['features', 'pettyCash', 'dailyLimit'], 1000) },
              { text: t('school_settings.option.r2000', { defaultValue: 'R2000' }), onPress: () => updateNestedSetting(['features', 'pettyCash', 'dailyLimit'], 2000) },
              { text: t('navigation.cancel', { defaultValue: 'Cancel' }), style: 'cancel' }
            ]);
          })}
        </View>
      </ScrollView>
      {/* Sticky bottom action bar */}
      <View style={[styles.bottomBar, { paddingBottom: 12 + insets.bottom, backgroundColor: theme.background, borderTopColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.bottomBtn, { backgroundColor: theme.surfaceVariant, borderColor: theme.border }]}>
          <Ionicons name="close" size={18} color={theme.text} />
          <Text style={[styles.bottomBtnText, { color: theme.text }]}>{t('navigation.close', { defaultValue: 'Close' })}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={saveSettings} disabled={saving} style={[styles.bottomBtn, { backgroundColor: theme.primary, borderColor: theme.primary }]}>
          {saving ? <ActivityIndicator size="small" color={theme.onPrimary} /> : <Ionicons name="checkmark" size={18} color={theme.onPrimary} />}
          <Text style={[styles.bottomBtnText, { color: theme.onPrimary }]}>{t('school_settings.save_changes', { defaultValue: 'Save changes' })}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  backBtn: {
    padding: 8,
    borderRadius: 8,
  },
  heroTitle: { fontSize: 20, fontWeight: '800' },
  heroSubtitle: { marginTop: 4 },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  settingValue: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingValueText: {
    fontSize: 14,
    marginRight: 8,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  bottomBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  bottomPrimary: { },
  bottomSecondary: { },
  bottomBtnText: { fontWeight: '800' },
  sectionTabs: {
    backgroundColor: 'white',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  sectionTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 4,
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  sectionTabActive: {
    backgroundColor: Colors.light.tint,
  },
  sectionTabText: {
    fontSize: 14,
    color: Colors.light.tabIconDefault,
    marginLeft: 8,
  },
  sectionTabTextActive: {
    color: 'white',
    fontWeight: '600',
  },
  sectionContainer: {
    flex: 1,
  },
  sectionContent: {
    flex: 1,
    padding: 20,
  },
  subsectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    marginTop: 24,
    marginBottom: 16,
  },
  headerButton: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  accessDenied: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  accessDeniedTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  accessDeniedText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  settingDescription: {
    fontSize: 14,
    color: Colors.light.tabIconDefault,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    minWidth: 120,
  },
  numberInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  numberInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    width: 80,
    textAlign: 'right',
  },
  numberInputSuffix: {
    fontSize: 14,
    color: Colors.light.tabIconDefault,
    marginLeft: 8,
  },
  pickerContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  pickerOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: 'white',
  },
  pickerOptionSelected: {
    backgroundColor: Colors.light.tint,
    borderColor: Colors.light.tint,
  },
  pickerOptionText: {
    fontSize: 14,
    color: Colors.light.text,
  },
  pickerOptionTextSelected: {
    color: 'white',
    fontWeight: '600',
  },
  colorPreview: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorPreviewInner: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 12,
    padding: 4,
  },
  footer: {
    padding: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  saveButton: {
    backgroundColor: Colors.light.tint,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: Colors.light.tabIconDefault,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'white',
  },
});
