/**
 * BackHandler stub for React Native web builds
 * BackHandler is Android-specific, so we provide a no-op implementation for web
 */

const BackHandler = {
  exitApp: () => {
    if (typeof window !== 'undefined') {
      window.close();
    }
  },
  addEventListener: (event, handler) => {
    // No-op on web, return a dummy subscription
    return {
      remove: () => {},
    };
  },
  removeEventListener: () => {
    // No-op on web
  },
};

// CommonJS export
module.exports = BackHandler;

// ES6 default export
module.exports.default = BackHandler;