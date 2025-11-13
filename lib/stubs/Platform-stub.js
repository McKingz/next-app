/**
 * Platform utilities stub for React Native web builds
 * This prevents bundling issues with developer tools trying to access native Platform utilities
 */

// Mock Platform object with basic properties
const Platform = {
  OS: typeof window !== 'undefined' ? 'web' : 'ios',
  Version: '1.0',
  isTV: false,
  isTVOS: false,
  isAndroid: false,
  isIOS: false,
  isMacOS: false,
  isWindows: false,
  isWeb: typeof window !== 'undefined',
  select: (obj) => {
    const platform = typeof window !== 'undefined' ? 'web' : 'default';
    return obj[platform] || obj.default || obj.native;
  }
};

// CommonJS export
module.exports = Platform;

// ES6 default export
module.exports.default = Platform;