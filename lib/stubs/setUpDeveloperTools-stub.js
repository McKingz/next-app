/**
 * Stub for setUpDeveloperTools to work around React Native 0.79.5 issue
 * This prevents the bundling error when developer tools setup fails
 */

// Empty function to replace the developer tools setup
module.exports = function setUpDeveloperTools() {
  // No-op in production/web builds
};

// Also provide default export for ES6 imports
module.exports.default = module.exports;