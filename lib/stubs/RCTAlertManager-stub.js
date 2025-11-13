/**
 * RCTAlertManager stub for React Native web builds
 * This provides a web-compatible implementation of native alerts
 */

const RCTAlertManager = {
  alertWithArgs: (args, callback) => {
    const { title, message, buttons, type } = args;
    
    // Use browser's native alert/confirm
    if (!buttons || buttons.length === 0) {
      window.alert(`${title}\n\n${message}`);
      if (callback) callback();
    } else if (buttons.length === 1) {
      window.alert(`${title}\n\n${message}`);
      if (callback) callback(0);
    } else {
      const result = window.confirm(`${title}\n\n${message}`);
      if (callback) callback(result ? 0 : 1);
    }
  },
};

// CommonJS export
module.exports = RCTAlertManager;

// ES6 default export
module.exports.default = RCTAlertManager;