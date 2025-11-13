/**
 * Native module stub for web builds
 * This prevents bundling errors for native-only modules like Porcupine, LocalAuthentication, etc.
 */

// Generic stub that provides no-op implementations
const nativeModuleStub = {
  // For Porcupine wake word
  PorcupineManager: {
    fromKeywordPaths: () => {
      console.warn('Native module not available on web');
      return null;
    },
  },

  // For biometric authentication
  authenticate: async () => {
    console.warn('Biometric authentication not available on web');
    return { success: false, error: 'Not supported on web' };
  },

  isEnrolled: async () => {
    return false;
  },

  hasHardwareAsync: async () => {
    return false;
  },

  isEnrolledAsync: async () => {
    return false;
  },

  authenticateAsync: async () => {
    return { success: false, error: 'Not supported on web' };
  },

  // Generic no-op for any other method calls
  default: {},
};

// Export as both CommonJS and ES6 module
module.exports = nativeModuleStub;
module.exports.default = nativeModuleStub;

// Export individual items for named imports
module.exports.PorcupineManager = nativeModuleStub.PorcupineManager;
module.exports.authenticate = nativeModuleStub.authenticate;
module.exports.isEnrolled = nativeModuleStub.isEnrolled;
module.exports.hasHardwareAsync = nativeModuleStub.hasHardwareAsync;
module.exports.isEnrolledAsync = nativeModuleStub.isEnrolledAsync;
module.exports.authenticateAsync = nativeModuleStub.authenticateAsync;