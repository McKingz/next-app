import { Platform } from 'react-native';
import { log, warn, debug } from '@/lib/debug';

let initialized = false;
export async function startAds() {
  if (initialized) return; initialized = true;
  if (Platform.OS === 'web') return; // Skip on web
  if (process.env.EXPO_PUBLIC_ENABLE_ADS === '0') return;

  const isTest = (__DEV__ as boolean) || process.env.EXPO_PUBLIC_ENABLE_TEST_ADS === 'true';
  
  try {
    // Dynamically import ads module only on mobile platforms
    const { default: mobileAds, MaxAdContentRating } = require('react-native-google-mobile-ads');

    const config: any = {
      maxAdContentRating: MaxAdContentRating.G,
      tagForChildDirectedTreatment: false,
      tagForUnderAgeOfConsent: false,
    };
    if (isTest) {
      config.testDeviceIdentifiers = ['EMULATOR'];
    }

    await mobileAds()
      .setRequestConfiguration(config)
      .then(() => mobileAds().initialize());

    debug('Ads initialized', { platform: Platform.OS, isTest });
  } catch (error) {
    warn('Failed to initialize ads:', error);
  }
}
