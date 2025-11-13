import * as Updates from 'expo-updates';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { track } from '@/lib/analytics';

interface OTAEventProperties {
  ota_channel: string | null;
  ota_runtime_version: string | null;
  ota_update_id: string | null;
  app_version: string | null;
  platform: string;
  is_emergency_launch: boolean;
  updates_enabled: boolean;
}

/**
 * Get standardized OTA properties for observability
 */
export function getOTAProperties(): OTAEventProperties {
  return {
    ota_channel: Updates.channel || null,
    ota_runtime_version: Updates.runtimeVersion || null,
    ota_update_id: Updates.updateId || null,
    app_version: Constants.expoConfig?.version || null,
    platform: Platform.OS,
    is_emergency_launch: Updates.isEmergencyLaunch,
    updates_enabled: Updates.isEnabled,
  };
}

/**
 * Track app launch with OTA context
 */
export function trackAppLaunch() {
  const otaProperties = getOTAProperties();
  
  try {
    track('app.launched', {
      ...otaProperties,
      // Add any additional app-specific properties here
      // Note: No PII per WARP rules - use hashed identifiers
    });

    // Log key OTA info for debugging (only in preview)
    if (process.env.EXPO_PUBLIC_ENVIRONMENT === 'preview') {
      console.log('[OTA] App launch tracked:', {
        updateId: otaProperties.ota_update_id,
        runtimeVersion: otaProperties.ota_runtime_version,
        channel: otaProperties.ota_channel,
        isEmergencyLaunch: otaProperties.is_emergency_launch,
      });
    }
  } catch (error) {
    // Don't throw on observability failures
    console.warn('[OTA] Failed to track app launch:', error);
  }
}

/**
 * Track OTA update check events
 */
export function trackOTAUpdateCheck(result: { isAvailable: boolean; manifest?: any }) {
  const otaProperties = getOTAProperties();
  
  try {
    track('ota.check_for_update', {
      ...otaProperties,
      update_available: result.isAvailable,
      new_manifest_id: result.manifest?.id || null,
    });

    if (process.env.EXPO_PUBLIC_ENVIRONMENT === 'preview') {
      console.log('[OTA] Update check tracked:', {
        available: result.isAvailable,
        manifestId: result.manifest?.id,
      });
    }
  } catch (error) {
    console.warn('[OTA] Failed to track update check:', error);
  }
}

/**
 * Track OTA update download events
 */
export function trackOTAUpdateFetch(result: { isNew: boolean }) {
  const otaProperties = getOTAProperties();
  
  try {
    track('ota.fetch_update', {
      ...otaProperties,
      update_is_new: result.isNew,
    });

    if (process.env.EXPO_PUBLIC_ENVIRONMENT === 'preview') {
      console.log('[OTA] Update fetch tracked:', {
        isNew: result.isNew,
      });
    }
  } catch (error) {
    console.warn('[OTA] Failed to track update fetch:', error);
  }
}

/**
 * Track OTA update application (restart)
 */
export function trackOTAUpdateApply() {
  const otaProperties = getOTAProperties();
  
  try {
    track('ota.apply_update', {
      ...otaProperties,
    });

    if (process.env.EXPO_PUBLIC_ENVIRONMENT === 'preview') {
      console.log('[OTA] Update apply tracked');
    }
  } catch (error) {
    console.warn('[OTA] Failed to track update apply:', error);
  }
}

/**
 * Track OTA-related errors
 */
export function trackOTAError(errorType: 'check' | 'fetch' | 'apply', error: Error) {
  const otaProperties = getOTAProperties();
  
  try {
    track('ota.error', {
      ...otaProperties,
      error_type: errorType,
      error_message: error.message,
      error_name: error.name,
    });

    if (process.env.EXPO_PUBLIC_ENVIRONMENT === 'preview') {
      console.log('[OTA] Error tracked:', {
        type: errorType,
        message: error.message,
      });
    }
  } catch (trackingError) {
    console.warn('[OTA] Failed to track error:', trackingError);
  }
}