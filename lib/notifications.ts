import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import * as Application from 'expo-application'
import * as Localization from 'expo-localization'
import { Platform } from 'react-native'
import Constants from 'expo-constants'

// Constant project ID for Expo push tokens (Android only scope for now)
// Matches extra.eas.projectId in app.config.js
const EXPO_PROJECT_ID = 'ab7c9230-2f47-4bfa-b4f4-4ae516a334bc'

// Show notifications while app is foregrounded (customize as needed)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    // SDK >= 51 supports banner/list behavior on iOS
    shouldShowBanner: true,
    shouldShowList: true,
  } as Notifications.NotificationBehavior),
})

export type PushRegistrationResult = {
  status: 'registered' | 'denied' | 'skipped' | 'error'
  token?: string
  reason?: string
  message?: string
}

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  // Web or emulators/devices that don't support notifications should return null
  if (Platform.OS === 'web' || !Device.isDevice) return null

  // Android 8+ requires channel configuration for predictable behavior
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'General',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    })
  }

  // iOS requires explicit permission prompt; Android shows without prompt
  const settings = await Notifications.getPermissionsAsync()
  let status = settings.status
  if (status !== 'granted') {
    const req = await Notifications.requestPermissionsAsync()
    status = req.status
  }
  if (status !== 'granted') return null

  try {
    // Bind token to this Expo project to ensure it works in internal/dev builds
    const token = await Notifications.getExpoPushTokenAsync({ projectId: EXPO_PROJECT_ID })
    return token.data ?? null
  } catch (error: any) {
    // Firebase/FCM not configured - gracefully skip in dev mode
    if (error?.message?.includes('FirebaseApp') || error?.message?.includes('FCM')) {
      console.log('[Push Registration] FCM not configured - skipping (dev mode)')
      return null
    }
    throw error
  }
}

export async function registerPushDevice(supabase: any, user: any): Promise<PushRegistrationResult> {
  try {
    console.log('[Push Registration] Starting registration for user:', user?.id)
    
    // Skip registration on web or emulators
    if (Platform.OS === 'web' || !Device.isDevice) {
      console.log('[Push Registration] Skipping - unsupported platform')
      return { status: 'skipped', reason: 'unsupported_platform' }
    }
    
    // Skip if no user
    if (!user?.id) {
      console.log('[Push Registration] Skipping - no user ID')
      return { status: 'skipped', reason: 'no_user' }
    }

    // Get device metadata
    console.log('[Push Registration] Getting device metadata...')
    const rawLanguageTag = Localization.getLocales?.()?.[0]?.languageTag || 'en'
    console.log('[Push Registration] Raw language tag:', rawLanguageTag)
    // Generate a simple device identifier since Application methods vary by Expo version
    const installationId = Constants.deviceId || Constants.sessionId || `${Platform.OS}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const deviceMetadata = {
      platform: Platform.OS,
      brand: Device.brand,
      model: Device.modelName,
      osVersion: Device.osVersion,
      appVersion: Constants.expoConfig?.version,
      appBuild: Constants.expoConfig?.runtimeVersion,
      locale: rawLanguageTag.split('-')[0].toLowerCase(),
      timezone: Localization.getCalendars?.()?.[0]?.timeZone || 'UTC',
      installationId,
    }
    
    // Validate and normalize language for database constraint
    const supportedLanguages = ['en', 'af', 'zu', 'st'];
    const normalizedLanguage = supportedLanguages.includes(deviceMetadata.locale) ? deviceMetadata.locale : 'en';
    console.log('[Push Registration] Device metadata:', { installationId, platform: Platform.OS, model: Device.modelName, locale: deviceMetadata.locale, normalizedLanguage })

    // Get push token
    console.log('[Push Registration] Getting push token...')
    const token = await registerForPushNotificationsAsync()
    if (!token) {
      console.log('[Push Registration] Failed to get push token - permissions denied')
      return { status: 'denied', reason: 'permissions_denied', message: 'Push notifications not permitted' }
    }
    console.log('[Push Registration] Got push token:', token.substring(0, 20) + '...')

    // Upsert to database
    console.log('[Push Registration] Saving to database...')
    const { error } = await supabase
      .from('push_devices')
      .upsert({
        user_id: user.id,
        expo_push_token: token,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        is_active: true,
        device_installation_id: installationId,
        device_metadata: deviceMetadata,
        language: normalizedLanguage,
        timezone: deviceMetadata.timezone,
        last_seen_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,device_installation_id'
      })

    if (error) {
      console.error('[Push Registration] Database error:', error)
      return { status: 'error', reason: 'database_error', message: error.message }
    }

    console.log('[Push Registration] Successfully registered device')
    return { status: 'registered', token }
  } catch (error: any) {
    console.error('[Push Registration] Exception:', error?.message || error)
    // Log full error details in dev mode
    if (__DEV__) {
      console.error('[Push Registration] Full error:', error)
    }
    return { status: 'error', reason: 'exception', message: error?.message || String(error) }
  }
}

export async function deregisterPushDevice(supabase: any, user: any): Promise<void> {
  try {
    if (Platform.OS === 'web' || !Device.isDevice) return
    
    const installationId = Constants.deviceId || Constants.sessionId || `${Platform.OS}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    await supabase
      .from('push_devices')
      .update({ is_active: false, revoked_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('device_installation_id', installationId)
  } catch (error) {
    console.debug('Push device deregistration failed:', error)
  }
}

export async function scheduleLocalNotification(title: string, body: string) {
  return Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: null, // fire immediately
  })
}

export function onNotificationReceived(cb: (n: Notifications.Notification) => void) {
  const sub = Notifications.addNotificationReceivedListener(cb)
  return () => sub.remove()
}
