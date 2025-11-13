import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { assertSupabase } from './supabase';

export interface NotificationData {
  id: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  categoryId?: string;
  priority?: 'min' | 'low' | 'default' | 'high' | 'max';
  sound?: boolean | string;
  vibrate?: boolean | number[];
  badge?: number;
  color?: string;
  channelId?: string;
}

export interface PushToken {
  userId: string;
  token: string;
  platform: 'ios' | 'android' | 'web';
  deviceInfo: {
    deviceId?: string;
    deviceName?: string;
    osVersion?: string;
    appVersion: string;
  };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    console.log('Notification received:', notification);
    
    // Determine if we should show the notification when app is in foreground
    const shouldShow = notification.request.content.data?.forceShow === true;
    
    return {
      shouldShowAlert: shouldShow,
      shouldPlaySound: true,
      shouldSetBadge: true,
    };
  },
});

class NotificationService {
  private static instance: NotificationService;
  private pushToken: string | null = null;
  private isInitialized = false;
  
  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Initialize notification service and request permissions
   */
  public async initialize(): Promise<boolean> {
    if (this.isInitialized) {
      return true;
    }

    try {
      // Check if device supports push notifications
      if (!Device.isDevice) {
        console.log('Must use physical device for Push Notifications');
        return false;
      }

      // Request permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Push notification permission denied');
        return false;
      }

      // Configure notification channels for Android
      if (Platform.OS === 'android') {
        await this.setupAndroidChannels();
      }

      // Set up notification categories
      await this.setupNotificationCategories();

      this.isInitialized = true;
      console.log('Notification service initialized successfully');
      return true;

    } catch (error) {
      console.error('Failed to initialize notification service:', error);
      return false;
    }
  }

  /**
   * Register device for push notifications and store token
   */
  public async registerForPushNotifications(userId: string, appVersion: string): Promise<string | null> {
    try {
      if (!this.isInitialized) {
        const initialized = await this.initialize();
        if (!initialized) {
          throw new Error('Failed to initialize notification service');
        }
      }

      // Get push token
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig?.extra?.eas?.projectId, // From app.json
      });

      this.pushToken = tokenData.data;

      // Get device info
      const deviceInfo = {
        deviceId: await Device.osBuildIdAsync?.() || undefined,
        deviceName: Device.deviceName || undefined,
        osVersion: Device.osVersion || undefined,
        appVersion,
      };

      // Save token to database
      const pushTokenData: Omit<PushToken, 'createdAt' | 'updatedAt'> = {
        userId,
        token: this.pushToken,
        platform: Platform.OS as 'ios' | 'android' | 'web',
        deviceInfo,
        isActive: true,
      };

      // Upsert push token in database
      const { error } = await assertSupabase()
        .from('push_tokens')
        .upsert(
          {
            ...pushTokenData,
            updated_at: new Date().toISOString(),
          },
          { 
            onConflict: 'user_id,platform,token',
          }
        );

      if (error) {
        console.error('Failed to save push token:', error);
        throw error;
      }

      console.log('Push token registered successfully:', this.pushToken);
      return this.pushToken;

    } catch (error) {
      console.error('Failed to register for push notifications:', error);
      return null;
    }
  }

  /**
   * Setup Android notification channels
   */
  private async setupAndroidChannels(): Promise<void> {
    if (Platform.OS !== 'android') return;

    // Default channel
    await Notifications.setNotificationChannelAsync('default', {
      name: 'General Notifications',
      description: 'General app notifications',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#00f5ff',
      sound: 'default',
      enableLights: true,
      enableVibrate: true,
    });

    // Urgent notifications
    await Notifications.setNotificationChannelAsync('urgent', {
      name: 'Urgent Notifications',
      description: 'Critical alerts that require immediate attention',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 200, 500],
      lightColor: '#ff4444',
      sound: 'default',
      enableLights: true,
      enableVibrate: true,
    });

    // Educational content
    await Notifications.setNotificationChannelAsync('educational', {
      name: 'Educational Content',
      description: 'Learning activities and educational updates',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250],
      lightColor: '#00f5ff',
      sound: 'default',
      enableLights: true,
      enableVibrate: true,
    });

    // Social/communication
    await Notifications.setNotificationChannelAsync('social', {
      name: 'Communication',
      description: 'Messages and communication from teachers/parents',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 300, 100, 300],
      lightColor: '#4ade80',
      sound: 'default',
      enableLights: true,
      enableVibrate: true,
    });

    console.log('Android notification channels configured');
  }

  /**
   * Setup notification categories with actions
   */
  private async setupNotificationCategories(): Promise<void> {
    await Notifications.setNotificationCategoryAsync('MESSAGE', [
      {
        identifier: 'REPLY',
        buttonTitle: 'Reply',
        options: {
          opensAppToForeground: true,
          isAuthenticationRequired: false,
        },
      },
      {
        identifier: 'MARK_READ',
        buttonTitle: 'Mark Read',
        options: {
          opensAppToForeground: false,
          isAuthenticationRequired: false,
        },
      },
    ]);

    await Notifications.setNotificationCategoryAsync('REMINDER', [
      {
        identifier: 'SNOOZE',
        buttonTitle: 'Snooze',
        options: {
          opensAppToForeground: false,
          isAuthenticationRequired: false,
        },
      },
      {
        identifier: 'COMPLETE',
        buttonTitle: 'Mark Complete',
        options: {
          opensAppToForeground: false,
          isAuthenticationRequired: false,
        },
      },
    ]);

    console.log('Notification categories configured');
  }

  /**
   * Schedule a local notification
   */
  public async scheduleLocalNotification(
    notificationData: NotificationData,
    trigger?: Notifications.NotificationTriggerInput
  ): Promise<string> {
    try {
      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title: notificationData.title,
          body: notificationData.body,
          data: notificationData.data,
          categoryIdentifier: notificationData.categoryId,
          priority: this.mapPriorityToExpo(notificationData.priority),
          sound: notificationData.sound === false ? false : (notificationData.sound || 'default'),
          vibrate: notificationData.vibrate,
          badge: notificationData.badge,
          color: notificationData.color || '#00f5ff',
        },
        trigger: trigger || null,
        identifier: notificationData.id,
      });

      console.log('Local notification scheduled:', identifier);
      return identifier;

    } catch (error) {
      console.error('Failed to schedule local notification:', error);
      throw error;
    }
  }

  /**
   * Cancel a scheduled notification
   */
  public async cancelNotification(identifier: string): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync(identifier);
      console.log('Notification cancelled:', identifier);
    } catch (error) {
      console.error('Failed to cancel notification:', error);
      throw error;
    }
  }

  /**
   * Cancel all scheduled notifications
   */
  public async cancelAllNotifications(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('All notifications cancelled');
    } catch (error) {
      console.error('Failed to cancel all notifications:', error);
      throw error;
    }
  }

  /**
   * Get all scheduled notifications
   */
  public async getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
    try {
      return await Notifications.getAllScheduledNotificationsAsync();
    } catch (error) {
      console.error('Failed to get scheduled notifications:', error);
      return [];
    }
  }

  /**
   * Set app badge count
   */
  public async setBadgeCount(count: number): Promise<void> {
    try {
      await Notifications.setBadgeCountAsync(count);
      console.log('Badge count set to:', count);
    } catch (error) {
      console.error('Failed to set badge count:', error);
    }
  }

  /**
   * Clear app badge
   */
  public async clearBadge(): Promise<void> {
    await this.setBadgeCount(0);
  }

  /**
   * Get current permissions status
   */
  public async getPermissionStatus(): Promise<Notifications.NotificationPermissionsStatus> {
    return await Notifications.getPermissionsAsync();
  }

  /**
   * Open app notification settings
   */
  public async openSettings(): Promise<void> {
    try {
      await Notifications.openSettingsAsync();
    } catch (error) {
      console.error('Failed to open notification settings:', error);
    }
  }

  /**
   * Update push token status (activate/deactivate)
   */
  public async updateTokenStatus(userId: string, isActive: boolean): Promise<void> {
    try {
      if (!this.pushToken) {
        throw new Error('No push token available');
      }

      const { error } = await assertSupabase()
        .from('push_tokens')
        .update({
          is_active: isActive,
          updated_at: new Date().toISOString(),
        })
        .match({
          user_id: userId,
          token: this.pushToken,
        });

      if (error) {
        throw error;
      }

      console.log('Push token status updated:', isActive);

    } catch (error) {
      console.error('Failed to update push token status:', error);
      throw error;
    }
  }

  /**
   * Map priority to Expo priority format
   */
  private mapPriorityToExpo(priority?: 'min' | 'low' | 'default' | 'high' | 'max'): Notifications.AndroidImportance {
    switch (priority) {
      case 'min': return Notifications.AndroidImportance.MIN;
      case 'low': return Notifications.AndroidImportance.LOW;
      case 'high': return Notifications.AndroidImportance.HIGH;
      case 'max': return Notifications.AndroidImportance.MAX;
      default: return Notifications.AndroidImportance.DEFAULT;
    }
  }

  /**
   * Get current push token
   */
  public getPushToken(): string | null {
    return this.pushToken;
  }

  /**
   * Handle notification response (when user taps notification)
   */
  public addNotificationResponseListener(
    listener: (response: Notifications.NotificationResponse) => void
  ): Notifications.EventSubscription {
    return Notifications.addNotificationResponseReceivedListener(listener);
  }

  /**
   * Handle incoming notifications
   */
  public addNotificationReceivedListener(
    listener: (notification: Notifications.Notification) => void
  ): Notifications.EventSubscription {
    return Notifications.addNotificationReceivedListener(listener);
  }
}

export default NotificationService;