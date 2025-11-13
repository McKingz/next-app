import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Platform,
  Clipboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';
import { track } from '@/lib/analytics';

interface NotificationStatus {
  hasPermission: boolean;
  canSetBadge: boolean;
  canPlaySound: boolean;
  canAlert: boolean;
  expoPushToken: string | null;
  devicePushToken: string | null;
  isPhysicalDevice: boolean;
  isLoading: boolean;
}

export const PushNotificationTester: React.FC = () => {
  const { theme } = useTheme();
  const { user, profile } = useAuth();
  const [notificationStatus, setNotificationStatus] = useState<NotificationStatus>({
    hasPermission: false,
    canSetBadge: false,
    canPlaySound: false,
    canAlert: false,
    expoPushToken: null,
    devicePushToken: null,
    isPhysicalDevice: false,
    isLoading: true,
  });

  const [testMessage, setTestMessage] = useState({
    title: 'Test Notification',
    body: 'This is a test push notification from EduDash Pro',
    data: { test: true },
  });

  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResults, setTestResults] = useState<string[]>([]);

  useEffect(() => {
    initializeNotificationStatus();
  }, []);

  const initializeNotificationStatus = async () => {
    try {
      setNotificationStatus(prev => ({ ...prev, isLoading: true }));

      // Check if device is physical
      const isPhysicalDevice = Device.isDevice;
      
      // Get current permission status
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      const hasPermission = existingStatus === 'granted';

      // Get detailed permissions
      const permissions = await Notifications.getPermissionsAsync();
      const canSetBadge = permissions.canSetBadge;
      const canPlaySound = permissions.canPlaySound;
      const canAlert = permissions.canAlert;

      // Get push tokens if we have permission
      let expoPushToken = null;
      let devicePushToken = null;

      if (hasPermission && isPhysicalDevice) {
        try {
          // Get Expo push token
          const token = await Notifications.getExpoPushTokenAsync({
            projectId: Constants.expoConfig?.extra?.eas?.projectId,
          });
          expoPushToken = token.data;

          // Get device-specific token
          const deviceToken = await Notifications.getDevicePushTokenAsync();
          devicePushToken = deviceToken.data;
        } catch (error) {
          console.error('Error getting push tokens:', error);
          addTestResult(`❌ Token Error: ${error}`);
        }
      }

      setNotificationStatus({
        hasPermission,
        canSetBadge,
        canPlaySound,
        canAlert,
        expoPushToken,
        devicePushToken,
        isPhysicalDevice,
        isLoading: false,
      });

      addTestResult(`✅ Notification status initialized`);
      
      // Track initialization
      track('push_notifications.status_checked', {
        user_id: user?.id,
        has_permission: hasPermission,
        is_physical_device: isPhysicalDevice,
        can_alert: canAlert,
        has_expo_token: !!expoPushToken,
        platform: Platform.OS,
      });

    } catch (error) {
      console.error('Error initializing notification status:', error);
      setNotificationStatus(prev => ({ ...prev, isLoading: false }));
      addTestResult(`❌ Initialization Error: ${error}`);
    }
  };

  const requestPermissions = async () => {
    try {
      addTestResult('🔄 Requesting notification permissions...');

      if (!Device.isDevice) {
        Alert.alert(
          'Physical Device Required',
          'Push notifications require a physical device. They will not work in simulators.'
        );
        addTestResult('❌ Not a physical device - notifications not available');
        return;
      }

      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowDisplayInCarPlay: false,
          allowCriticalAlerts: false,
          provideAppNotificationSettings: false,
          allowProvisional: false,
          allowAnnouncements: false,
        },
      });

      const hasPermission = status === 'granted';
      addTestResult(`${hasPermission ? '✅' : '❌'} Permission ${status}`);

      if (hasPermission) {
        await initializeNotificationStatus();
      } else {
        Alert.alert(
          'Permission Denied',
          'Notifications permission was denied. You can enable it in your device settings.',
          [
            { text: 'OK' },
            { text: 'Open Settings', onPress: () => Notifications.openSettingsAsync() }
          ]
        );
      }

      // Track permission request
      track('push_notifications.permission_requested', {
        user_id: user?.id,
        status,
        granted: hasPermission,
        platform: Platform.OS,
      });

    } catch (error) {
      console.error('Error requesting permissions:', error);
      addTestResult(`❌ Permission Error: ${error}`);
    }
  };

  const sendTestNotification = async () => {
    try {
      setIsSendingTest(true);
      addTestResult('🔄 Sending test notification...');

      if (!notificationStatus.hasPermission) {
        Alert.alert('No Permission', 'Please grant notification permissions first.');
        addTestResult('❌ No permission for notifications');
        return;
      }

      // Local notification test
      await Notifications.scheduleNotificationAsync({
        content: {
          title: testMessage.title,
          body: testMessage.body,
          data: testMessage.data,
          sound: 'default',
        },
        trigger: { seconds: 1 },
      });

      addTestResult('✅ Local notification scheduled');

      // Remote notification test (if we have push token)
      if (notificationStatus.expoPushToken) {
        await sendRemoteTestNotification();
      }

      // Track test
      track('push_notifications.test_sent', {
        user_id: user?.id,
        has_expo_token: !!notificationStatus.expoPushToken,
        title: testMessage.title,
        platform: Platform.OS,
      });

      Alert.alert('Test Sent', 'Check if you received the test notification!');

    } catch (error) {
      console.error('Error sending test notification:', error);
      addTestResult(`❌ Test Error: ${error}`);
      Alert.alert('Test Failed', `Error: ${error}`);
    } finally {
      setIsSendingTest(false);
    }
  };

  const sendRemoteTestNotification = async () => {
    try {
      const message = {
        to: notificationStatus.expoPushToken,
        sound: 'default',
        title: testMessage.title,
        body: testMessage.body,
        data: testMessage.data,
      };

      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      const result = await response.json();
      
      if (result.data && result.data.status === 'ok') {
        addTestResult('✅ Remote notification sent via Expo');
      } else {
        addTestResult(`❌ Remote notification failed: ${JSON.stringify(result)}`);
      }
    } catch (error) {
      console.error('Error sending remote notification:', error);
      addTestResult(`❌ Remote notification error: ${error}`);
    }
  };

  const saveTokenToDatabase = async () => {
    try {
      if (!notificationStatus.expoPushToken || !user?.id) {
        Alert.alert('Missing Data', 'No push token or user ID available');
        return;
      }

      addTestResult('🔄 Saving token to database...');

      const { error } = await assertSupabase()
        .from('push_devices')
        .upsert({
          user_id: user.id,
          expo_push_token: notificationStatus.expoPushToken,
          device_type: Platform.OS,
          is_active: true,
          last_used_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,expo_push_token'
        });

      if (error) {
        addTestResult(`❌ Database Error: ${error.message}`);
        Alert.alert('Database Error', error.message);
      } else {
        addTestResult('✅ Token saved to database');
        Alert.alert('Success', 'Push token saved to database!');
      }

      // Track save
      track('push_notifications.token_saved', {
        user_id: user.id,
        platform: Platform.OS,
        success: !error,
      });

    } catch (error) {
      console.error('Error saving token:', error);
      addTestResult(`❌ Save Error: ${error}`);
      Alert.alert('Error', `Failed to save token: ${error}`);
    }
  };

  const copyTokenToClipboard = async (token: string, type: string) => {
    try {
      await Clipboard.setString(token);
      Alert.alert('Copied', `${type} token copied to clipboard!`);
      addTestResult(`📋 ${type} token copied to clipboard`);
    } catch (error) {
      Alert.alert('Error', 'Failed to copy token to clipboard');
    }
  };

  const addTestResult = (result: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setTestResults(prev => [`[${timestamp}] ${result}`, ...prev]);
  };

  const clearTestResults = () => {
    setTestResults([]);
    addTestResult('🧹 Test results cleared');
  };

  const styles = StyleSheet.create({
    container: {
      padding: 16,
      backgroundColor: theme.background,
    },
    title: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.text,
      marginBottom: 16,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 12,
    },
    statusCard: {
      backgroundColor: theme.surface,
      padding: 16,
      borderRadius: 12,
      marginBottom: 12,
    },
    statusRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
    },
    statusLabel: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    statusValue: {
      fontSize: 14,
      fontWeight: '500',
    },
    statusSuccess: {
      color: theme.success,
    },
    statusError: {
      color: theme.error,
    },
    statusWarning: {
      color: theme.warning,
    },
    button: {
      backgroundColor: theme.primary,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
      alignItems: 'center',
      marginBottom: 12,
    },
    buttonSecondary: {
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    buttonText: {
      color: theme.onPrimary,
      fontSize: 14,
      fontWeight: '600',
    },
    buttonTextSecondary: {
      color: theme.text,
    },
    buttonDisabled: {
      backgroundColor: theme.surface,
      opacity: 0.5,
    },
    input: {
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      padding: 12,
      color: theme.text,
      marginBottom: 12,
    },
    tokenContainer: {
      backgroundColor: theme.surface,
      padding: 12,
      borderRadius: 8,
      marginBottom: 8,
    },
    tokenLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.textSecondary,
      marginBottom: 4,
    },
    tokenText: {
      fontSize: 10,
      color: theme.text,
      fontFamily: 'monospace',
    },
    tokenActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 8,
    },
    testResults: {
      backgroundColor: theme.surface,
      padding: 12,
      borderRadius: 8,
      maxHeight: 200,
    },
    testResult: {
      fontSize: 12,
      color: theme.textSecondary,
      marginBottom: 4,
      fontFamily: 'monospace',
    },
    loadingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    },
    loadingText: {
      marginLeft: 8,
      color: theme.textSecondary,
    },
  });

  if (notificationStatus.isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={theme.primary} />
        <Text style={styles.loadingText}>Loading notification status...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>🔔 Push Notification Tester</Text>

      {/* Status Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Current Status</Text>
        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Physical Device</Text>
            <Text style={[
              styles.statusValue,
              notificationStatus.isPhysicalDevice ? styles.statusSuccess : styles.statusError
            ]}>
              {notificationStatus.isPhysicalDevice ? 'Yes' : 'No (Simulator)'}
            </Text>
          </View>
          
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Permission Granted</Text>
            <Text style={[
              styles.statusValue,
              notificationStatus.hasPermission ? styles.statusSuccess : styles.statusError
            ]}>
              {notificationStatus.hasPermission ? 'Yes' : 'No'}
            </Text>
          </View>

          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Can Show Alerts</Text>
            <Text style={[
              styles.statusValue,
              notificationStatus.canAlert ? styles.statusSuccess : styles.statusWarning
            ]}>
              {notificationStatus.canAlert ? 'Yes' : 'No'}
            </Text>
          </View>

          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Can Play Sound</Text>
            <Text style={[
              styles.statusValue,
              notificationStatus.canPlaySound ? styles.statusSuccess : styles.statusWarning
            ]}>
              {notificationStatus.canPlaySound ? 'Yes' : 'No'}
            </Text>
          </View>

          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Can Set Badge</Text>
            <Text style={[
              styles.statusValue,
              notificationStatus.canSetBadge ? styles.statusSuccess : styles.statusWarning
            ]}>
              {notificationStatus.canSetBadge ? 'Yes' : 'No'}
            </Text>
          </View>

          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Expo Push Token</Text>
            <Text style={[
              styles.statusValue,
              notificationStatus.expoPushToken ? styles.statusSuccess : styles.statusError
            ]}>
              {notificationStatus.expoPushToken ? 'Available' : 'None'}
            </Text>
          </View>
        </View>

        <TouchableOpacity 
          style={styles.button} 
          onPress={initializeNotificationStatus}
        >
          <Text style={styles.buttonText}>🔄 Refresh Status</Text>
        </TouchableOpacity>
      </View>

      {/* Permission Section */}
      {!notificationStatus.hasPermission && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Request Permission</Text>
          <TouchableOpacity style={styles.button} onPress={requestPermissions}>
            <Text style={styles.buttonText}>🔔 Request Notification Permission</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Token Section */}
      {notificationStatus.expoPushToken && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Push Tokens</Text>
          
          <View style={styles.tokenContainer}>
            <Text style={styles.tokenLabel}>Expo Push Token</Text>
            <Text style={styles.tokenText} numberOfLines={3} ellipsizeMode="middle">
              {notificationStatus.expoPushToken}
            </Text>
            <View style={styles.tokenActions}>
              <TouchableOpacity 
                style={[styles.button, styles.buttonSecondary, { flex: 1, marginRight: 8 }]}
                onPress={() => copyTokenToClipboard(notificationStatus.expoPushToken!, 'Expo')}
              >
                <Text style={[styles.buttonText, styles.buttonTextSecondary]}>📋 Copy</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.button, { flex: 1, marginLeft: 8 }]}
                onPress={saveTokenToDatabase}
              >
                <Text style={styles.buttonText}>💾 Save to DB</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Test Section */}
      {notificationStatus.hasPermission && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Test Notification</Text>
          
          <TextInput
            style={styles.input}
            placeholder="Notification Title"
            placeholderTextColor={theme.textSecondary}
            value={testMessage.title}
            onChangeText={(text) => setTestMessage(prev => ({ ...prev, title: text }))}
          />
          
          <TextInput
            style={styles.input}
            placeholder="Notification Body"
            placeholderTextColor={theme.textSecondary}
            value={testMessage.body}
            onChangeText={(text) => setTestMessage(prev => ({ ...prev, body: text }))}
            multiline
            numberOfLines={3}
          />

          <TouchableOpacity 
            style={[styles.button, isSendingTest && styles.buttonDisabled]}
            onPress={sendTestNotification}
            disabled={isSendingTest}
          >
            {isSendingTest ? (
              <ActivityIndicator size="small" color={theme.onPrimary} />
            ) : (
              <Text style={styles.buttonText}>🚀 Send Test Notification</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Test Results */}
      {testResults.length > 0 && (
        <View style={styles.section}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={styles.sectionTitle}>Test Results</Text>
            <TouchableOpacity onPress={clearTestResults}>
              <Text style={[styles.buttonText, { color: theme.textSecondary }]}>Clear</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.testResults}>
            {testResults.map((result, index) => (
              <Text key={index} style={styles.testResult}>
                {result}
              </Text>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <TouchableOpacity 
          style={[styles.button, styles.buttonSecondary]}
          onPress={() => Notifications.openSettingsAsync()}
        >
          <Text style={[styles.buttonText, styles.buttonTextSecondary]}>⚙️ Open Notification Settings</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};