/**
 * Stub for React DevTools Settings Manager to work around React Native 0.79.5 issue
 * This prevents the bundling error: Unable to resolve "../../src/private/debugging/ReactDevToolsSettingsManager"
 */

// Create a mock ReactDevToolsSettingsManager
const ReactDevToolsSettingsManager = {
  getSettings: () => ({}),
  setSettings: () => {},
};

// Export for CommonJS
module.exports = ReactDevToolsSettingsManager;

// Also provide default export for ES6 imports
module.exports.default = ReactDevToolsSettingsManager;
