/**
 * Web-specific entry point for EduDash Pro
 * Fixes HMR issues and ensures proper web module loading
 */

// Polyfill EventEmitter for web
if (typeof global !== 'undefined' && !global.EventEmitter) {
  global.EventEmitter = class EventEmitter {
    constructor() {
      this.events = {};
    }
    addListener(event, listener) {
      if (!this.events[event]) this.events[event] = [];
      this.events[event].push(listener);
      return { remove: () => this.removeListener(event, listener) };
    }
    removeListener(event, listener) {
      if (!this.events[event]) return;
      this.events[event] = this.events[event].filter(l => l !== listener);
    }
    emit(event, ...args) {
      if (!this.events[event]) return;
      this.events[event].forEach(listener => listener(...args));
    }
    removeAllListeners(event) {
      if (event) {
        delete this.events[event];
      } else {
        this.events = {};
      }
    }
  };
}

// Disable HMR on web to prevent initialization errors
if (typeof module !== 'undefined' && module.hot) {
  module.hot.accept = () => {};
}

// Import the regular entry point
import 'expo-router/entry';
