/**
 * Stub for React Native InitializeCore to work around React Native 0.79.5 bundling issues on web
 * This replaces the problematic core initialization that includes developer tools setup
 */

// Minimal initialization without developer tools
if (typeof global !== 'undefined') {
  // Set up minimal globals for React Native Web compatibility
  if (typeof global.ErrorUtils === 'undefined') {
    global.ErrorUtils = {
      setGlobalHandler: () => {},
      getGlobalHandler: () => () => {},
    };
  }
  
  // Basic console polyfill if needed
  if (typeof global.console === 'undefined') {
    global.console = {
      log: () => {},
      warn: () => {},
      error: () => {},
      info: () => {},
      debug: () => {},
    };
  }
}

// Export empty to satisfy imports
module.exports = {};
module.exports.default = {};