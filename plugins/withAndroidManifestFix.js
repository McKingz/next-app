const { withAndroidManifest, withGradleProperties } = require('@expo/config-plugins');

/**
 * Config plugin to fix Android Manifest merger errors
 * - Ensures AndroidX compatibility
 * - Removes conflicting tools:replace attributes
 * - Works with both local builds (expo run:android) and EAS builds
 */
const withAndroidManifestFix = (config) => {
  // First, ensure AndroidX is enabled in gradle.properties
  config = withGradleProperties(config, (config) => {
    config.modResults = config.modResults.filter(
      (item) => !['android.useAndroidX', 'android.enableJetifier'].includes(item.key)
    );
    
    config.modResults.push(
      { type: 'property', key: 'android.useAndroidX', value: 'true' },
      { type: 'property', key: 'android.enableJetifier', value: 'true' }
    );
    
    return config;
  });

  // Then fix the manifest
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;
    
    // Ensure the application tag exists
    if (androidManifest.manifest.application) {
      const application = androidManifest.manifest.application[0];
      
      // Ensure tools namespace is declared
      if (!androidManifest.manifest.$['xmlns:tools']) {
        androidManifest.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
      }
      
      // Remove any existing tools:replace that might be causing issues
      if (application.$['tools:replace']) {
        delete application.$['tools:replace'];
      }
      
      // Set the appComponentFactory to use AndroidX version
      // This should be set without tools:replace since we're using AndroidX throughout
      application.$['android:appComponentFactory'] = 'androidx.core.app.CoreComponentFactory';
    }
    
    return config;
  });
};

module.exports = withAndroidManifestFix;
