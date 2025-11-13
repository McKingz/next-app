// ================================================
// Invoice Notification Settings Component
// Comprehensive UI for managing notification preferences and digital signatures
// ================================================

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Switch,
  TouchableOpacity,
  Image,
  Alert,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

// Hooks and Services
import {
  useInvoiceNotificationSettings,
  useOptimisticPreferencesUpdate,
  useSignatureUpload,
  useSignatureDelete,
  useTestNotification,
  useUserRole,
  useSignatureStorageStatus,
} from '@/lib/hooks/useProfileSettings';
import { useTheme } from '@/contexts/ThemeContext';

// Types and labels
import type {
  NotificationEvent,
  NotificationChannel,
} from '@/lib/types/profile';

import {
  NOTIFICATION_EVENT_LABELS,
  NOTIFICATION_CHANNEL_LABELS,
} from '@/lib/types/profile';

interface InvoiceNotificationSettingsProps {
  onClose?: () => void;
}

export default function InvoiceNotificationSettings({ onClose }: InvoiceNotificationSettingsProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  
  // Data hooks
  const { data: settings, isLoading: settingsLoading, error: settingsError } = useInvoiceNotificationSettings();
  const { data: userRole, isLoading: roleLoading } = useUserRole();
  const { data: storageStatus } = useSignatureStorageStatus();
  
  // Mutation hooks
  const { updateWithOptimistic, isPending: isUpdating } = useOptimisticPreferencesUpdate();
  const uploadSignatureMutation = useSignatureUpload();
  const deleteSignatureMutation = useSignatureDelete();
  const testNotificationMutation = useTestNotification();

  // Local state
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['events']));
  const [testingNotification, setTestingNotification] = useState<{event: NotificationEvent; channel: NotificationChannel} | null>(null);
  const showTestSection = process.env.EXPO_PUBLIC_ENABLE_TEST_TOOLS === '1';

  const preferences = settings?.preferences;
  const signature = settings?.signature;
  const isLoading = settingsLoading || roleLoading;

  // Utility functions
  const toggleSection = useCallback((section: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  }, []);

  const updatePreference = useCallback((path: string, value: any) => {
    if (!preferences) return;

    // Create nested update object from dot notation path
    const pathParts = path.split('.');
    const update: any = {};
    
    let current = update;
    for (let i = 0; i < pathParts.length - 1; i++) {
      current[pathParts[i]] = {};
      current = current[pathParts[i]];
    }
    current[pathParts[pathParts.length - 1]] = value;

    updateWithOptimistic({ preferences: update });
  }, [preferences, updateWithOptimistic]);

  const handleImagePicker = useCallback(async () => {
    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow access to your photo library to upload a signature.');
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [3, 1], // Wide aspect ratio for signatures
        quality: 0.8,
        base64: false,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        uploadSignatureMutation.mutate(result.assets[0].uri, {
          onSuccess: () => {
            Alert.alert('Success', 'Signature uploaded successfully!');
          },
          onError: (error) => {
            Alert.alert('Upload Failed', `Failed to upload signature: ${error.message}`);
          },
        });
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to open image picker');
    }
  }, [uploadSignatureMutation]);

  const handleDeleteSignature = useCallback(() => {
    Alert.alert(
      'Delete Signature',
      'Are you sure you want to remove your digital signature?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteSignatureMutation.mutate(undefined, {
              onSuccess: () => {
                Alert.alert('Success', 'Signature deleted successfully');
              },
              onError: (error) => {
                Alert.alert('Delete Failed', `Failed to delete signature: ${error.message}`);
              },
            });
          },
        },
      ]
    );
  }, [deleteSignatureMutation]);

  const handleTestNotification = useCallback(async (event: NotificationEvent, channel: NotificationChannel) => {
    setTestingNotification({ event, channel });
    
    try {
      await testNotificationMutation.mutateAsync({ event, channel });
      Alert.alert('Test Sent', `Test ${NOTIFICATION_EVENT_LABELS[event]} notification sent via ${NOTIFICATION_CHANNEL_LABELS[channel]}`);
    } catch (error) {
      Alert.alert('Test Failed', `Failed to send test notification: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setTestingNotification(null);
    }
  }, [testNotificationMutation]);

  const getRoleSpecificHints = useCallback((role: string) => {
    switch (role) {
      case 'parent':
        return 'You\'ll receive notifications about invoices for your children, payment confirmations, and overdue reminders.';
      case 'teacher':
        return 'You\'ll receive notifications about invoices related to students in your classes.';
      case 'principal':
      case 'principal_admin':
        return 'You\'ll receive comprehensive notifications about all school invoices, plus optional daily and weekly summaries.';
      default:
        return 'Configure your invoice notification preferences to stay informed about important updates.';
    }
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={styles.loadingText}>Loading notification settings...</Text>
      </View>
    );
  }

  // Error state
  if (settingsError) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="warning" size={48} color={theme.error} />
        <Text style={styles.errorTitle}>Failed to load settings</Text>
        <Text style={styles.errorText}>{settingsError.message}</Text>
      </View>
    );
  }

  // No preferences loaded
  if (!preferences) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="settings-outline" size={48} color={theme.textSecondary} />
        <Text style={styles.errorTitle}>No preferences found</Text>
        <Text style={styles.errorText}>Unable to load your notification preferences</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Ionicons name="notifications-outline" size={28} color={theme.primary} />
          <View style={styles.headerText}>
            <Text style={styles.title}>Invoice Notifications</Text>
            <Text style={styles.subtitle}>
              {getRoleSpecificHints(userRole || 'parent')}
            </Text>
          </View>
        </View>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={theme.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Email Events Section */}
      <View style={styles.section}>
        <TouchableOpacity 
          style={styles.sectionHeader} 
          onPress={() => toggleSection('events')}
        >
          <Text style={styles.sectionTitle}>Email Notifications</Text>
          <Ionicons 
            name={expandedSections.has('events') ? 'chevron-up' : 'chevron-down'} 
            size={20} 
            color={theme.textSecondary} 
          />
        </TouchableOpacity>

        {expandedSections.has('events') && (
          <View style={styles.sectionContent}>
            {/* New Invoice */}
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>New Invoice Created</Text>
                <Text style={styles.settingDescription}>
                  Get notified when a new invoice is created
                </Text>
              </View>
              <Switch
                value={preferences.events.new_invoice.email}
                onValueChange={(value) => updatePreference('events.new_invoice.email', value)}
                trackColor={{ false: theme.surfaceVariant, true: theme.primary }}
                thumbColor={preferences.events.new_invoice.email ? theme.surface : theme.textSecondary}
                disabled={isUpdating}
              />
            </View>

            {/* Invoice Sent */}
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Invoice Sent</Text>
                <Text style={styles.settingDescription}>
                  Get notified when an invoice is sent to parents
                </Text>
              </View>
              <Switch
                value={preferences.events.invoice_sent.email}
                onValueChange={(value) => updatePreference('events.invoice_sent.email', value)}
                trackColor={{ false: theme.surfaceVariant, true: theme.primary }}
                thumbColor={preferences.events.invoice_sent.email ? theme.surface : theme.textSecondary}
                disabled={isUpdating}
              />
            </View>

            {/* Overdue Reminders */}
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Overdue Reminders</Text>
                <Text style={styles.settingDescription}>
                  Get notified about overdue invoices (1, 3, and 7 days)
                </Text>
              </View>
              <Switch
                value={preferences.events.overdue_reminder.email}
                onValueChange={(value) => updatePreference('events.overdue_reminder.email', value)}
                trackColor={{ false: theme.surfaceVariant, true: theme.primary }}
                thumbColor={preferences.events.overdue_reminder.email ? theme.surface : theme.textSecondary}
                disabled={isUpdating}
              />
            </View>

            {/* Payment Confirmations */}
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Payment Confirmed</Text>
                <Text style={styles.settingDescription}>
                  Get notified when invoice payments are received
                </Text>
              </View>
              <Switch
                value={preferences.events.payment_confirmed.email}
                onValueChange={(value) => updatePreference('events.payment_confirmed.email', value)}
                trackColor={{ false: theme.surfaceVariant, true: theme.primary }}
                thumbColor={preferences.events.payment_confirmed.email ? theme.surface : theme.textSecondary}
                disabled={isUpdating}
              />
            </View>

            {/* Invoice Viewed */}
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Invoice Viewed</Text>
                <Text style={styles.settingDescription}>
                  Get notified when someone views an invoice (optional)
                </Text>
              </View>
              <Switch
                value={preferences.events.invoice_viewed.email}
                onValueChange={(value) => updatePreference('events.invoice_viewed.email', value)}
                trackColor={{ false: theme.surfaceVariant, true: theme.primary }}
                thumbColor={preferences.events.invoice_viewed.email ? theme.surface : theme.textSecondary}
                disabled={isUpdating}
              />
            </View>
          </View>
        )}
      </View>

      {/* Digital Signature Section */}
      <View style={styles.section}>
        <TouchableOpacity 
          style={styles.sectionHeader} 
          onPress={() => toggleSection('signature')}
        >
          <Text style={styles.sectionTitle}>Digital Signature</Text>
          <Ionicons 
            name={expandedSections.has('signature') ? 'chevron-up' : 'chevron-down'} 
            size={20} 
            color={theme.textSecondary} 
          />
        </TouchableOpacity>

        {expandedSections.has('signature') && (
          <View style={styles.sectionContent}>
            {/* Include Signature Toggle */}
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Include in Emails</Text>
                <Text style={styles.settingDescription}>
                  Add your signature to invoice emails
                </Text>
              </View>
              <Switch
                value={preferences.email_include_signature}
                onValueChange={(value) => updatePreference('email_include_signature', value)}
                trackColor={{ false: theme.surfaceVariant, true: theme.primary }}
                thumbColor={preferences.email_include_signature ? theme.surface : theme.textSecondary}
                disabled={isUpdating}
              />
            </View>

            {/* Signature Management */}
            <View style={styles.signatureContainer}>
              <Text style={styles.signatureLabel}>Your Signature</Text>
              
              {signature?.url ? (
                <View style={styles.signaturePreview}>
                  <Image 
                    source={{ uri: signature.url }} 
                    style={styles.signatureImage}
                    resizeMode="contain"
                  />
                  <View style={styles.signatureActions}>
                    <TouchableOpacity 
                      style={[styles.signatureButton, styles.replaceButton]}
                      onPress={handleImagePicker}
                      disabled={uploadSignatureMutation.isPending}
                    >
                      {uploadSignatureMutation.isPending ? (
                        <ActivityIndicator size="small" color={theme.surface} />
                      ) : (
                        <>
                          <Ionicons name="camera" size={16} color={theme.surface} />
                          <Text style={styles.buttonText}>Replace</Text>
                        </>
                      )}
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={[styles.signatureButton, styles.deleteButton]}
                      onPress={handleDeleteSignature}
                      disabled={deleteSignatureMutation.isPending}
                    >
                      {deleteSignatureMutation.isPending ? (
                        <ActivityIndicator size="small" color={theme.surface} />
                      ) : (
                        <>
                          <Ionicons name="trash" size={16} color={theme.surface} />
                          <Text style={styles.buttonText}>Remove</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity 
                  style={styles.uploadButton}
                  onPress={handleImagePicker}
                  disabled={uploadSignatureMutation.isPending || !storageStatus?.available}
                >
                  {uploadSignatureMutation.isPending ? (
                    <ActivityIndicator size="small" color={theme.primary} />
                  ) : (
                    <>
                      <Ionicons name="add-circle-outline" size={24} color={theme.primary} />
                      <Text style={styles.uploadButtonText}>Upload Signature</Text>
                      <Text style={styles.uploadButtonSubtext}>
                        {storageStatus?.available 
                          ? 'Add your signature to personalize invoice emails'
                          : 'Signature storage not available'
                        }
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </View>

      {/* Principal/Admin Digest Options */}
      {(userRole === 'principal' || userRole === 'principal_admin') && (
        <View style={styles.section}>
          <TouchableOpacity 
            style={styles.sectionHeader} 
            onPress={() => toggleSection('digest')}
          >
            <Text style={styles.sectionTitle}>Summary Digests</Text>
            <Ionicons 
              name={expandedSections.has('digest') ? 'chevron-up' : 'chevron-down'} 
              size={20} 
              color={theme.textSecondary} 
            />
          </TouchableOpacity>

          {expandedSections.has('digest') && (
            <View style={styles.sectionContent}>
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Daily Overdue Report</Text>
                  <Text style={styles.settingDescription}>
                    Get a daily summary of overdue invoices
                  </Text>
                </View>
                <Switch
                  value={preferences.digest.overdue_daily}
                  onValueChange={(value) => updatePreference('digest.overdue_daily', value)}
                  trackColor={{ false: theme.surfaceVariant, true: theme.primary }}
                  thumbColor={preferences.digest.overdue_daily ? theme.surface : theme.textSecondary}
                  disabled={isUpdating}
                />
              </View>

              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Weekly Summary</Text>
                  <Text style={styles.settingDescription}>
                    Get a weekly summary of invoice activity
                  </Text>
                </View>
                <Switch
                  value={preferences.digest.weekly_summary}
                  onValueChange={(value) => updatePreference('digest.weekly_summary', value)}
                  trackColor={{ false: theme.surfaceVariant, true: theme.primary }}
                  thumbColor={preferences.digest.weekly_summary ? theme.surface : theme.textSecondary}
                  disabled={isUpdating}
                />
              </View>
            </View>
          )}
        </View>
      )}

      {/* Test Notifications Section (hidden by default) */}
      {showTestSection && (
        <View style={styles.section}>
          <TouchableOpacity 
            style={styles.sectionHeader} 
            onPress={() => toggleSection('test')}
          >
            <Text style={styles.sectionTitle}>Test Notifications</Text>
            <Ionicons 
              name={expandedSections.has('test') ? 'chevron-up' : 'chevron-down'} 
              size={20} 
              color={theme.textSecondary} 
            />
          </TouchableOpacity>

          {expandedSections.has('test') && (
            <View style={styles.sectionContent}>
              <Text style={styles.testDescription}>
                Send test notifications to verify your settings work correctly.
              </Text>
              
              <View style={styles.testButtons}>
                {(['new_invoice', 'invoice_sent', 'payment_confirmed', 'overdue_reminder'] as NotificationEvent[]).map((event) => (
                  <TouchableOpacity
                  key={event}
                  style={styles.testButton}
                  onPress={() => handleTestNotification(event, 'email')}
                  disabled={testingNotification?.event === event}
                >
                  {testingNotification?.event === event ? (
                    <ActivityIndicator size="small" color={theme.primary} />
                  ) : (
                    <>
                      <Ionicons name="mail-outline" size={16} color={theme.primary} />
                      <Text style={styles.testButtonText}>
                        Test {NOTIFICATION_EVENT_LABELS[event]}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
        </View>
      )}

      {/* Bottom Padding */}
      <View style={styles.bottomPadding} />
    </ScrollView>
  );
}

// Styles function
function createStyles(theme: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    loadingText: {
      marginTop: 16,
      fontSize: 16,
      color: theme.textSecondary,
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    errorTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
      marginTop: 16,
      marginBottom: 8,
    },
    errorText: {
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 20,
      backgroundColor: theme.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.divider,
    },
    headerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    headerText: {
      marginLeft: 12,
      flex: 1,
    },
    title: {
      fontSize: 20,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 14,
      color: theme.textSecondary,
      lineHeight: 20,
    },
    closeButton: {
      padding: 8,
    },
    section: {
      backgroundColor: theme.surface,
      marginTop: 8,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.divider,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
    },
    sectionContent: {
      padding: 16,
    },
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.divider,
    },
    settingInfo: {
      flex: 1,
      marginRight: 16,
    },
    settingLabel: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.text,
      marginBottom: 4,
    },
    settingDescription: {
      fontSize: 14,
      color: theme.textSecondary,
      lineHeight: 18,
    },
    signatureContainer: {
      marginTop: 16,
    },
    signatureLabel: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.text,
      marginBottom: 12,
    },
    signaturePreview: {
      backgroundColor: theme.surfaceVariant,
      borderRadius: 8,
      padding: 16,
    },
    signatureImage: {
      width: '100%',
      height: 80,
      backgroundColor: theme.surface,
      borderRadius: 4,
      marginBottom: 12,
    },
    signatureActions: {
      flexDirection: 'row',
      gap: 12,
    },
    signatureButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 6,
      gap: 6,
    },
    replaceButton: {
      backgroundColor: theme.primary,
    },
    deleteButton: {
      backgroundColor: theme.error,
    },
    buttonText: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.surface,
    },
    uploadButton: {
      alignItems: 'center',
      padding: 24,
      backgroundColor: theme.surfaceVariant,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: theme.divider,
      borderStyle: 'dashed',
    },
    uploadButtonText: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.primary,
      marginTop: 8,
    },
    uploadButtonSubtext: {
      fontSize: 14,
      color: theme.textSecondary,
      marginTop: 4,
      textAlign: 'center',
    },
    testDescription: {
      fontSize: 14,
      color: theme.textSecondary,
      marginBottom: 16,
      lineHeight: 20,
    },
    testButtons: {
      gap: 12,
    },
    testButton: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      backgroundColor: theme.surfaceVariant,
      borderRadius: 6,
      gap: 8,
    },
    testButtonText: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.primary,
    },
    bottomPadding: {
      height: 20,
    },
  });
}