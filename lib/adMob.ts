import { Platform } from 'react-native';
// TODO: Implement AdMob when ready for production
// import {
//   BannerAd,
//   InterstitialAd,
//   RewardedAd,
//   TestIds,
//   AdEventType,
//   RewardedAdEventType,
// } from 'react-native-google-mobile-ads';
import { getFeatureFlagsSync } from '@/lib/featureFlags';
import { track } from '@/lib/analytics';
import { reportError } from '@/lib/monitoring';
import { log, warn, debug, error as logError } from '@/lib/debug';

/**
 * AdMob Test IDs for development - Google's official test IDs
 * Production IDs should be configured when ready for production deployment
 */
const ADMOB_TEST_IDS = {
  android: {
    banner: 'ca-app-pub-3940256099942544/6300978111',
    interstitial: 'ca-app-pub-3940256099942544/1033173712', 
    rewarded: 'ca-app-pub-3940256099942544/5224354917',
  },
  ios: {
    banner: 'ca-app-pub-3940256099942544/2934735716',
    interstitial: 'ca-app-pub-3940256099942544/4411468910',
    rewarded: 'ca-app-pub-3940256099942544/1712485313',
  },
};

/**
 * Production AdMob IDs - TO BE CONFIGURED FOR PRODUCTION
 * TODO: Replace with actual production ad unit IDs when ready
 */
// const PRODUCTION_IDS = {
//   android: {
//     banner: 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',
//     interstitial: 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',
//     rewarded: 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',
//   },
//   ios: {
//     banner: 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX', 
//     interstitial: 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',
//     rewarded: 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',
//   },
// };

let isInitialized = false;

/**
 * Get appropriate ad unit ID based on testing mode
 */
function getAdUnitId(adType: keyof typeof ADMOB_TEST_IDS.android): string {
  const platform = Platform.OS as 'android' | 'ios';
  
  // Always use test IDs during development phase
  return ADMOB_TEST_IDS[platform][adType];
}

/**
 * Initialize AdMob - Simplified stub for development
 * TODO: Implement full AdMob integration when ready for production
 */
export async function initializeAdMob(): Promise<boolean> {
  if (isInitialized) return true;
  
  try {
    const flags = getFeatureFlagsSync();
    
    // Skip initialization on non-Android platforms during Android-only testing
    if (flags.android_only_mode && Platform.OS !== 'android') {
      log('AdMob initialization skipped: Android-only mode active');
      return false;
    }
    
    // Stub implementation - no actual AdMob calls yet
    isInitialized = true;
    
    track('edudash.ads.initialized', {
      platform: Platform.OS,
      test_mode: flags.admob_test_ids,
      android_only: flags.android_only_mode,
      stub_implementation: true,
    });
    
    debug('AdMob stub initialized - ready for production implementation');
    return true;
    
  } catch (error) {
    reportError(new Error('AdMob initialization failed'), { error });
    logError('Failed to initialize AdMob:', error);
    return false;
  }
}

// TODO: Implement actual AdMob ad loading when ready for production
// For now, using stubs to avoid TypeScript errors

/**
 * Show interstitial ad - Stub implementation
 */
export async function showInterstitialAd(): Promise<boolean> {
  const flags = getFeatureFlagsSync();
  
  // Skip on enterprise tier
  if (flags.enterprise_tier_enabled) {
    return false;
  }
  
  debug('AdMob Stub: Would show interstitial ad');
  track('edudash.ads.interstitial_stub_shown', {
    platform: Platform.OS,
  });
  return false; // Stub returns false for now
}

/**
 * Show rewarded ad - Stub implementation
 */
export async function showRewardedAd(): Promise<{
  shown: boolean;
  rewarded: boolean;
  reward?: { type: string; amount: number };
}> {
  const flags = getFeatureFlagsSync();
  
  // Skip on enterprise tier
  if (flags.enterprise_tier_enabled) {
    return { shown: false, rewarded: false };
  }
  
  debug('AdMob Stub: Would show rewarded ad');
  track('edudash.ads.rewarded_stub_shown', {
    platform: Platform.OS,
  });
  return { shown: false, rewarded: false }; // Stub returns false for now
}

/**
 * Check if interstitial ad is ready - Stub implementation
 */
export function isInterstitialReady(): boolean {
  return false; // Stub always returns false
}

/**
 * Check if rewarded ad is ready - Stub implementation
 */
export function isRewardedReady(): boolean {
  return false; // Stub always returns false
}

/**
 * Get banner ad unit ID for AdBanner component
 */
export function getBannerAdUnitId(): string {
  return getAdUnitId('banner');
}

/**
 * Clean up AdMob resources - Stub implementation
 */
export function cleanupAdMob(): void {
  debug('AdMob Stub: Cleanup called');
  isInitialized = false;
}
