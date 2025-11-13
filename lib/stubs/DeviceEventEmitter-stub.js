/**
 * DeviceEventEmitter stub for React Native web builds
 * This provides a minimal EventEmitter implementation for web
 */

class DeviceEventEmitter {
  constructor() {
    this.listeners = {};
  }

  addListener(eventType, listener, context) {
    if (!this.listeners[eventType]) {
      this.listeners[eventType] = [];
    }
    
    this.listeners[eventType].push(listener);
    
    // Return subscription object
    return {
      remove: () => this.removeListener(eventType, listener),
    };
  }

  removeListener(eventType, listener) {
    if (!this.listeners[eventType]) return;
    
    this.listeners[eventType] = this.listeners[eventType].filter(
      (l) => l !== listener
    );
  }

  removeAllListeners(eventType) {
    if (eventType) {
      delete this.listeners[eventType];
    } else {
      this.listeners = {};
    }
  }

  emit(eventType, ...args) {
    if (!this.listeners[eventType]) return;
    
    this.listeners[eventType].forEach((listener) => {
      try {
        listener(...args);
      } catch (error) {
        console.error('[DeviceEventEmitter] Error in listener:', error);
      }
    });
  }

  listenerCount(eventType) {
    return this.listeners[eventType]?.length || 0;
  }
}

// Create singleton instance
const instance = new DeviceEventEmitter();

// CommonJS export
module.exports = instance;

// ES6 default export
module.exports.default = instance;