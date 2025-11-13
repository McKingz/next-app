/**
 * RCTNetworking stub for React Native web builds
 * This provides a minimal implementation that delegates to fetch API
 */

const RCTNetworking = {
  sendRequest: () => {
    console.warn('RCTNetworking.sendRequest not implemented on web');
  },
  abortRequest: () => {
    console.warn('RCTNetworking.abortRequest not implemented on web');
  },
  clearCookies: () => {
    console.warn('RCTNetworking.clearCookies not implemented on web');
  },
};

// CommonJS export
module.exports = RCTNetworking;

// ES6 default export
module.exports.default = RCTNetworking;