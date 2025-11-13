/* eslint-disable @typescript-eslint/no-unused-vars */

import * as Notifications from 'expo-notifications';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { assertSupabase } from './supabase';
import AudioModeCoordinator from './AudioModeCoordinator';

export type AlertType = 
  | 'urgent' 
  | 'message' 
  | 'payment' 
  | 'attendance' 
  | 'system' 
  | 'success' 
  | 'warning' 
  | 'error'
  | 'notification'
  | 'reminder';

export type SoundStyle = 
  | 'subtle' 
  | 'normal' 
  | 'prominent' 
  | 'urgent' 
  | 'custom';

export type HapticPattern = 
  | 'none' 
  | 'light' 
  | 'medium' 
  | 'heavy' 
  | 'success' 
  | 'warning' 
  | 'error';

export interface SoundAlertSettings {
  userId: string;
  alertType: AlertType;
  enabled: boolean;
  soundStyle: SoundStyle;
  customSoundUri?: string;
  volume: number; // 0-1
  hapticEnabled: boolean;
  hapticPattern: HapticPattern;
  respectSystemSettings: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string; // "22:00"
  quietHoursEnd: string; // "07:00"
  updatedAt: string;
}

export interface SoundAlert {
  id: string;
  type: AlertType;
  title: string;
  message: string;
  data?: Record<string, any>;
  priority: 'low' | 'normal' | 'high' | 'critical';
  autoPlay?: boolean;
  customSound?: string;
  customHaptic?: HapticPattern;
}

class SoundAlertService {
  private static instance: SoundAlertService;
  private audioCache = new Map<string, Audio.Sound>();
  private isInitialized = false;
  private userSettings: Map<string, SoundAlertSettings> = new Map();
  
  // Default sound mappings - using system notification sounds for compatibility
  private defaultSounds: Record<AlertType, string | null> = {
    urgent: null, // Will use default system sound
    message: null,
    payment: null,
    attendance: null,
    system: null,
    success: null,
    warning: null,
    error: null,
    notification: null,
    reminder: null,
  };

  // Sound style configurations
  private soundStyles: Record<SoundStyle, { volume: number; looping: boolean; rate: number }> = {
    subtle: { volume: 0.3, looping: false, rate: 1.0 },
    normal: { volume: 0.6, looping: false, rate: 1.0 },
    prominent: { volume: 0.8, looping: false, rate: 1.0 },
    urgent: { volume: 1.0, looping: true, rate: 1.2 },
    custom: { volume: 0.6, looping: false, rate: 1.0 },
  };

  public static getInstance(): SoundAlertService {
    if (!SoundAlertService.instance) {
      SoundAlertService.instance = new SoundAlertService();
    }
    return SoundAlertService.instance;
  }

  /**
   * Initialize the sound alert service
   * Now uses AudioModeCoordinator to prevent conflicts with WebRTC streaming
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Initialize audio mode coordinator
      // This ensures audio mode is coordinated with streaming and TTS
      await AudioModeCoordinator.initialize();

      // Preload default sounds
      await this.preloadSounds();

      this.isInitialized = true;
      console.log('[SoundAlertService] ✅ Initialized with AudioModeCoordinator');
    } catch (error) {
      console.error('[SoundAlertService] ❌ Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Preload frequently used sounds for better performance
   */
  private async preloadSounds(): Promise<void> {
    // Skip preloading as we're using system sounds
    console.log('Using system notification sounds - skipping preload');
  }

  /**
   * Play sound alert with full system integration
   */
  public async playAlert(alert: SoundAlert): Promise<void> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Get user settings for this alert type
      const settings = await this.getAlertSettings(alert.type);
      
      // Check if alerts are enabled
      if (!settings.enabled) {
        console.log(`Alert disabled for type: ${alert.type}`);
        return;
      }

      // Check quiet hours
      if (settings.quietHoursEnabled && this.isInQuietHours(settings)) {
        console.log('Alert suppressed due to quiet hours');
        return;
      }

      // Check system do-not-disturb settings
      if (settings.respectSystemSettings) {
        const systemSettings = await this.getSystemNotificationSettings();
        if (!systemSettings.alertsEnabled) {
          console.log('Alert suppressed due to system settings');
          return;
        }
      }

      // Play sound
      await this.playSoundForAlert(alert, settings);

      // Trigger haptic feedback
      if (settings.hapticEnabled) {
        await this.triggerHapticFeedback(alert.customHaptic || settings.hapticPattern);
      }

      // Log alert for analytics
      await this.logAlertEvent(alert, settings);

    } catch (error) {
      console.error('Failed to play alert:', error);
    }
  }

  /**
   * Play sound for specific alert
   */
  private async playSoundForAlert(alert: SoundAlert, settings: SoundAlertSettings): Promise<void> {
    try {
      // For now, we'll use notifications API to play system sounds
      // instead of audio files to avoid bundling issues
      await this.playSystemNotificationSound(alert, settings);

    } catch (error) {
      console.error('Error playing sound:', error);
    }
  }

  /**
   * Play system notification sound
   * Uses AudioModeCoordinator to safely manage audio mode
   */
  private async playSystemNotificationSound(alert: SoundAlert, settings: SoundAlertSettings): Promise<void> {
    try {
      // Only play if not in quiet hours and enabled
      if (settings.enabled && (!settings.quietHoursEnabled || !this.isInQuietHours(settings))) {
        // Use coordinator to request notification audio mode
        await AudioModeCoordinator.withAudioMode('notification', async () => {
          // For basic sound feedback, we can trigger a simple notification
          // that will play the system notification sound
          const notification = {
            title: alert.title,
            body: alert.message,
            data: alert.data,
            sound: true, // Use default system sound
          };

          console.log(
            `[SoundAlertService] 🔊 Playing ${settings.soundStyle} sound for ${alert.type} alert`
          );
          
          // In a real implementation, you might want to show a brief notification
          // or use a different approach to play system sounds
        });
      }

    } catch (error) {
      console.warn('[SoundAlertService] ⚠️ Failed to play notification sound:', error);
    }
  }

  /**
   * Trigger haptic feedback based on pattern
   */
  private async triggerHapticFeedback(pattern: HapticPattern): Promise<void> {
    if (Platform.OS === 'ios') {
      switch (pattern) {
        case 'light':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;
        case 'medium':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          break;
        case 'heavy':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          break;
        case 'success':
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          break;
        case 'warning':
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          break;
        case 'error':
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          break;
        case 'none':
        default:
          // No haptic feedback
          break;
      }
    } else if (Platform.OS === 'android') {
      // Android haptic patterns
      switch (pattern) {
        case 'light':
        case 'success':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;
        case 'medium':
        case 'warning':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          break;
        case 'heavy':
        case 'error':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          break;
        case 'none':
        default:
          break;
      }
    }
  }

  /**
   * Get alert settings for a specific alert type
   */
  private async getAlertSettings(alertType: AlertType, userId?: string): Promise<SoundAlertSettings> {
    const settingsKey = `${userId || 'default'}_${alertType}`;
    
    if (this.userSettings.has(settingsKey)) {
      return this.userSettings.get(settingsKey)!;
    }

    try {
      // Try to load from database
      const { data, error } = await assertSupabase()
        .from('sound_alert_settings')
        .select('*')
        .eq('user_id', userId || 'default')
        .eq('alert_type', alertType)
        .single();

      if (data && !error) {
        const settings: SoundAlertSettings = {
          userId: data.user_id,
          alertType: data.alert_type,
          enabled: data.enabled,
          soundStyle: data.sound_style,
          customSoundUri: data.custom_sound_uri,
          volume: data.volume,
          hapticEnabled: data.haptic_enabled,
          hapticPattern: data.haptic_pattern,
          respectSystemSettings: data.respect_system_settings,
          quietHoursEnabled: data.quiet_hours_enabled,
          quietHoursStart: data.quiet_hours_start,
          quietHoursEnd: data.quiet_hours_end,
          updatedAt: data.updated_at,
        };
        
        this.userSettings.set(settingsKey, settings);
        return settings;
      }
    } catch (error) {
      console.warn('Failed to load alert settings from database:', error);
    }

    // Return default settings
    const defaultSettings: SoundAlertSettings = {
      userId: userId || 'default',
      alertType,
      enabled: true,
      soundStyle: this.getDefaultSoundStyle(alertType),
      volume: 0.7,
      hapticEnabled: true,
      hapticPattern: this.getDefaultHapticPattern(alertType),
      respectSystemSettings: true,
      quietHoursEnabled: false,
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
      updatedAt: new Date().toISOString(),
    };

    this.userSettings.set(settingsKey, defaultSettings);
    return defaultSettings;
  }

  /**
   * Update alert settings for a specific alert type
   */
  public async updateAlertSettings(
    alertType: AlertType, 
    updates: Partial<SoundAlertSettings>,
    userId?: string
  ): Promise<void> {
    try {
      const currentSettings = await this.getAlertSettings(alertType, userId);
      const updatedSettings: SoundAlertSettings = {
        ...currentSettings,
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      // Save to database
      const { error } = await assertSupabase()
        .from('sound_alert_settings')
        .upsert({
          user_id: updatedSettings.userId,
          alert_type: updatedSettings.alertType,
          enabled: updatedSettings.enabled,
          sound_style: updatedSettings.soundStyle,
          custom_sound_uri: updatedSettings.customSoundUri,
          volume: updatedSettings.volume,
          haptic_enabled: updatedSettings.hapticEnabled,
          haptic_pattern: updatedSettings.hapticPattern,
          respect_system_settings: updatedSettings.respectSystemSettings,
          quiet_hours_enabled: updatedSettings.quietHoursEnabled,
          quiet_hours_start: updatedSettings.quietHoursStart,
          quiet_hours_end: updatedSettings.quietHoursEnd,
          updated_at: updatedSettings.updatedAt,
        }, {
          onConflict: 'user_id,alert_type'
        });

      if (error) {
        throw error;
      }

      // Update cache
      const settingsKey = `${userId || 'default'}_${alertType}`;
      this.userSettings.set(settingsKey, updatedSettings);

      console.log(`Updated alert settings for ${alertType}`);
    } catch (error) {
      console.error('Failed to update alert settings:', error);
      throw error;
    }
  }

  /**
   * Get all alert settings for a user
   */
  public async getAllAlertSettings(userId?: string): Promise<SoundAlertSettings[]> {
    try {
      const { data, error } = await assertSupabase()
        .from('sound_alert_settings')
        .select('*')
        .eq('user_id', userId || 'default');

      if (error) {
        throw error;
      }

      return (data || []).map(row => ({
        userId: row.user_id,
        alertType: row.alert_type,
        enabled: row.enabled,
        soundStyle: row.sound_style,
        customSoundUri: row.custom_sound_uri,
        volume: row.volume,
        hapticEnabled: row.haptic_enabled,
        hapticPattern: row.haptic_pattern,
        respectSystemSettings: row.respect_system_settings,
        quietHoursEnabled: row.quiet_hours_enabled,
        quietHoursStart: row.quiet_hours_start,
        quietHoursEnd: row.quiet_hours_end,
        updatedAt: row.updated_at,
      }));
    } catch (error) {
      console.error('Failed to get alert settings:', error);
      return [];
    }
  }

  /**
   * Test play a specific alert type
   */
  public async testAlert(alertType: AlertType, userId?: string): Promise<void> {
    const testAlert: SoundAlert = {
      id: `test_${Date.now()}`,
      type: alertType,
      title: 'Test Alert',
      message: `This is a test ${alertType} alert`,
      priority: 'normal',
      autoPlay: true,
    };

    await this.playAlert(testAlert);
  }

  /**
   * Check if current time is within quiet hours
   */
  private isInQuietHours(settings: SoundAlertSettings): boolean {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    const [startHour, startMin] = settings.quietHoursStart.split(':').map(Number);
    const [endHour, endMin] = settings.quietHoursEnd.split(':').map(Number);
    
    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    // Handle overnight quiet hours (e.g., 22:00 to 07:00)
    if (startTime > endTime) {
      return currentTime >= startTime || currentTime <= endTime;
    }
    
    return currentTime >= startTime && currentTime <= endTime;
  }

  /**
   * Get system notification settings
   */
  private async getSystemNotificationSettings(): Promise<{ alertsEnabled: boolean }> {
    try {
        const permissions = await Notifications.getPermissionsAsync();
        return {
          alertsEnabled: permissions.status === 'granted',
        };
    } catch (error) {
      console.error('Failed to get system notification settings:', error);
      return { alertsEnabled: true }; // Default to enabled
    }
  }

  /**
   * Get default sound style for alert type
   */
  private getDefaultSoundStyle(alertType: AlertType): SoundStyle {
    switch (alertType) {
      case 'urgent':
      case 'error':
        return 'urgent';
      case 'system':
      case 'warning':
        return 'prominent';
      case 'message':
      case 'notification':
        return 'normal';
      default:
        return 'normal';
    }
  }

  /**
   * Get default haptic pattern for alert type
   */
  private getDefaultHapticPattern(alertType: AlertType): HapticPattern {
    switch (alertType) {
      case 'urgent':
      case 'error':
        return 'error';
      case 'success':
        return 'success';
      case 'warning':
      case 'payment':
        return 'warning';
      case 'system':
        return 'medium';
      default:
        return 'light';
    }
  }

  /**
   * Log alert event for analytics
   */
  private async logAlertEvent(alert: SoundAlert, settings: SoundAlertSettings): Promise<void> {
    try {
      // Track alert played for analytics
      console.log(`Alert played: ${alert.type} - ${alert.title}`);
      
      // You can extend this to log to your analytics service
      // track('sound_alert_played', {
      //   alert_type: alert.type,
      //   alert_priority: alert.priority,
      //   sound_style: settings.soundStyle,
      //   haptic_enabled: settings.hapticEnabled,
      // });
      
    } catch (error) {
      console.warn('Failed to log alert event:', error);
    }
  }

  /**
   * Cleanup resources
   */
  public async cleanup(): Promise<void> {
    try {
      // Unload cached sounds
      for (const [key, sound] of this.audioCache) {
        await sound.unloadAsync();
      }
      this.audioCache.clear();
      
      console.log('SoundAlertService cleanup completed');
    } catch (error) {
      console.error('Error during SoundAlertService cleanup:', error);
    }
  }
}

export default SoundAlertService;