/**
 * app.config.js - Minimal Dynamic Configuration
 * 
 * This file handles ONLY truly dynamic configuration that cannot be static.
 * All static configuration is in app.json (primary source of truth).
 * 
 * Dynamic behaviors:
 * 1. Conditionally include expo-dev-client (only for development builds)
 * 2. Dynamic AdMob IDs from environment variables (for different environments)
 * 
 * @param {import('@expo/config').ConfigContext} ctx
 */
module.exports = ({ config }) => {
  const profile = process.env.EAS_BUILD_PROFILE || '';
  const isDevBuild = profile === 'development';
  const isWeb = process.env.EXPO_PUBLIC_PLATFORM === 'web';

  // Get AdMob IDs from environment (fallback to test IDs)
  const androidAdMobId = process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID || 'ca-app-pub-3940256099942544~3347511713';
  const iosAdMobId = process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID || 'ca-app-pub-3940256099942544~1458002511';

  // Build plugins array with dynamic AdMob config
  const plugins = config.plugins.map((plugin) => {
    // Update AdMob plugin with environment-specific IDs
    if (Array.isArray(plugin) && plugin[0] === 'react-native-google-mobile-ads') {
      return [
        'react-native-google-mobile-ads',
        {
          androidAppId: androidAdMobId,
          iosAppId: iosAdMobId,
        },
      ];
    }
    return plugin;
  });

  // Conditionally add expo-dev-client for development builds only
  // This is required for OTA updates to work correctly in production
  if (!isWeb && (isDevBuild || !process.env.EAS_BUILD_PLATFORM)) {
    plugins.push('expo-dev-client');
  }

  return {
    ...config,
    plugins,
  };
};
