/**
 * Stub for setUpReactDevTools to work around React Native 0.79.5 issue
 * This prevents the bundling error when React DevTools setup fails
 */

// Empty function to replace the React DevTools setup
module.exports = function setUpReactDevTools() {
  // No-op in production/web builds
};

// Also provide default export for ES6 imports
module.exports.default = module.exports;