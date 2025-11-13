/**
 * metro.config.js - Minimal Metro Configuration
 * 
 * Using Expo's default Metro config with minimal customizations.
 * Expo handles most optimizations automatically.
 * 
 * Only essential customizations:
 * - JSON files as source files (required for i18n locales)
 * - Public assets serving (PWA manifest and icons)
 * 
 * Learn more: https://docs.expo.io/guides/customizing-metro
 */
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Load environment variables from .env file
require('dotenv').config();

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Treat JSON files as source files (required for i18n locale imports)
config.resolver.assetExts = config.resolver.assetExts.filter(ext => ext !== 'json');
config.resolver.sourceExts = [...config.resolver.sourceExts, 'json'];

// Add support for .ppn files (Porcupine wake word models)
config.resolver.assetExts.push('ppn');
config.resolver.sourceExts = config.resolver.sourceExts.filter(ext => ext !== 'ppn');

// Platform-specific resolver to exclude native-only modules from web
config.resolver.platforms = ['ios', 'android', 'web'];
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];

// Exclude debug/test/mock files from production bundle
const exclusionList = require('metro-config/src/defaults/exclusionList');
config.resolver.blockList = exclusionList([
  /\/(scripts\/.*test.*|scripts\/.*debug.*|utils\/.*test.*|utils\/.*debug.*|.*mock.*)\//,
  /\/components\/debug\//,
  /\/app\/.*debug.*\.tsx?$/,
  /\/app\/biometric-test\.tsx$/,
  /\/app\/debug-user\.tsx$/,
]);

// Comprehensive web-specific module resolution
const originalResolver = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Only intercept for web platform
  if (platform !== 'web') {
    if (originalResolver) {
      return originalResolver(context, moduleName, platform);
    }
    return context.resolveRequest(context, moduleName, platform);
  }

  // WEB PLATFORM RESOLUTIONS
  try {
    // 1. Block Google Mobile Ads on web
    if (moduleName === 'react-native-google-mobile-ads' || 
        moduleName.startsWith('react-native-google-mobile-ads/')) {
      return {
        filePath: require.resolve('./lib/stubs/ads-stub.js'),
        type: 'sourceFile',
      };
    }

    // 1.5. Block RevenueCat on web
    if (moduleName === 'react-native-purchases') {
      return {
        filePath: require.resolve('./lib/stubs/revenuecat-stub.js'),
        type: 'sourceFile',
      };
    }

    // 1.6. Block Voice recognition on web
    if (moduleName === '@react-native-voice/voice') {
      return {
        filePath: require.resolve('./lib/stubs/voice-stub.js'),
        type: 'sourceFile',
      };
    }

    // 2. Block native-only modules
    const nativeOnlyModules = [
      '@picovoice/porcupine-react-native',
      'expo-local-authentication',
      'react-native-biometrics',
    ];
    if (nativeOnlyModules.includes(moduleName)) {
      return {
        filePath: require.resolve('./lib/stubs/native-module-stub.js'),
        type: 'sourceFile',
      };
    }

    // 3. Handle React Native internal modules (the main issue)
    // These are modules inside react-native/Libraries that have no web equivalent
    const isReactNativeInternal = 
      moduleName.includes('react-native/Libraries/') ||
      moduleName.includes('/Utilities/') ||
      moduleName.includes('/Network/') ||
      moduleName.includes('/Core/') ||
      moduleName.includes('/RCT') ||
      moduleName.startsWith('./') && context.originModulePath?.includes('react-native/Libraries');

    if (isReactNativeInternal) {
      // Use universal stub for all React Native internals
      return {
        filePath: require.resolve('./lib/stubs/universal-rn-stub.js'),
        type: 'sourceFile',
      };
    }

    // 4. Specific stubs for known problematic modules
    const stubMappings = {
      'ReactDevToolsSettingsManager': './lib/stubs/devtools-stub.js',
      '/src/private/debugging': './lib/stubs/devtools-stub.js',
      '/Core/Devtools/': './lib/stubs/devtools-stub.js',
      'DeviceEventEmitter': './lib/stubs/DeviceEventEmitter-stub.js',
      'NativeEventEmitter': './lib/stubs/NativeEventEmitter-stub.js',
      '/EventEmitter/': './lib/stubs/NativeEventEmitter-stub.js',
      'HMRClient': './lib/stubs/HMRClient-stub.js',
      '/HMRClient': './lib/stubs/HMRClient-stub.js',
    };

    for (const [pattern, stubPath] of Object.entries(stubMappings)) {
      if (moduleName.includes(pattern)) {
        return {
          filePath: require.resolve(stubPath),
          type: 'sourceFile',
        };
      }
    }

  } catch (error) {
    // If our stub resolution fails, fall through to default resolver
    console.warn('[Metro Web] Stub resolution error:', error.message);
  }
  
  // Use default resolver for everything else
  if (originalResolver) {
    return originalResolver(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

// Serve public assets (PWA manifest and icons) for web builds
const fs = require('fs');

config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      // Serve /manifest.json from /public/manifest.json
      if (req.url === '/manifest.json') {
        const manifestPath = path.join(__dirname, 'public', 'manifest.json');
        try {
          const content = fs.readFileSync(manifestPath, 'utf8');
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'public, max-age=3600');
          res.end(content);
          return;
        } catch (err) {
          console.error('[Metro] Failed to serve manifest.json:', err);
        }
      }
      
      // Serve /icons/* from /public/icons/*
      if (req.url.startsWith('/icons/')) {
        const iconPath = path.join(__dirname, 'public', req.url);
        try {
          const content = fs.readFileSync(iconPath);
          res.setHeader('Content-Type', 'image/png');
          res.setHeader('Cache-Control', 'public, max-age=31536000');
          res.end(content);
          return;
        } catch (err) {
          console.error('[Metro] Failed to serve icon:', req.url, err.message);
        }
      }
      
      // Serve /sw.js from /public/sw.js
      if (req.url === '/sw.js') {
        const swPath = path.join(__dirname, 'public', 'sw.js');
        try {
          const content = fs.readFileSync(swPath, 'utf8');
          res.setHeader('Content-Type', 'application/javascript');
          res.setHeader('Cache-Control', 'no-cache');
          res.end(content);
          return;
        } catch (err) {
          console.error('[Metro] Failed to serve sw.js:', err);
        }
      }
      
      return middleware(req, res, next);
    };
  },
};

module.exports = config;
