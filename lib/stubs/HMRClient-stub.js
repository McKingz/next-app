/**
 * HMR Client stub for web
 * Bypasses Expo's HMR client that fails on web
 */

// Create a no-op logger
const noopLogger = () => {};

// No-op HMR client for web with all expected methods
const HMRClient = {
  setup: noopLogger,
  enable: noopLogger,
  disable: noopLogger,
  registerBundle: noopLogger,
  log: noopLogger,
  send: noopLogger,
};

// Export as default
export default HMRClient;

// Also export as named export for compatibility
export { HMRClient };

// Support CommonJS require
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HMRClient;
  module.exports.default = HMRClient;
}
