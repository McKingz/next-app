/**
 * Universal stub for React Native internal modules on web
 * This provides a safe fallback for any RN internal module that doesn't have a web equivalent
 */

const universalStub = new Proxy({}, {
  get(target, prop) {
    // Return a no-op function for any method call
    if (typeof prop === 'string') {
      return (...args) => {
        console.debug(`[Web Stub] Called ${prop} (not available on web)`);
        return undefined;
      };
    }
    return undefined;
  }
});

// CommonJS export
module.exports = universalStub;

// ES6 default export
module.exports.default = universalStub;

// Export common RN utilities as no-ops
module.exports.Platform = {
  OS: 'web',
  Version: '1.0',
  select: (obj) => obj.web || obj.default,
};

module.exports.BackHandler = {
  exitApp: () => window.close?.(),
  addEventListener: () => ({ remove: () => {} }),
  removeEventListener: () => {},
};

module.exports.PermissionsAndroid = {
  request: async () => 'granted',
  check: async () => true,
  requestMultiple: async () => ({}),
};

module.exports.AppRegistry = {
  registerComponent: () => {},
  registerConfig: () => {},
  runApplication: () => {},
};