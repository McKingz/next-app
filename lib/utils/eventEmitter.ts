import { Platform } from 'react-native';

let DeviceEventEmitter: any;

if (Platform.OS === 'web') {
  // Try to use eventemitter3 if available, otherwise use custom implementation
  try {
    const EventEmitter = require('eventemitter3');
    DeviceEventEmitter = new EventEmitter();
  } catch (error) {
    // Fallback to custom implementation if eventemitter3 is not available
    console.warn('EventEmitter3 not available, using custom implementation');
    
    class WebEventEmitter {
      private listeners: Map<string, Function[]> = new Map();

      addListener(eventName: string, callback: Function) {
        if (!this.listeners.has(eventName)) {
          this.listeners.set(eventName, []);
        }
        this.listeners.get(eventName)!.push(callback);
        
        return {
          remove: () => {
            const callbacks = this.listeners.get(eventName);
            if (callbacks) {
              const index = callbacks.indexOf(callback);
              if (index > -1) {
                callbacks.splice(index, 1);
              }
            }
          }
        };
      }

      emit(eventName: string, ...args: any[]) {
        const callbacks = this.listeners.get(eventName);
        if (callbacks) {
          callbacks.forEach(callback => {
            try {
              callback(...args);
            } catch (error) {
              console.warn(`Error in event listener for ${eventName}:`, error);
            }
          });
        }
      }

      removeAllListeners(eventName?: string) {
        if (eventName) {
          this.listeners.delete(eventName);
        } else {
          this.listeners.clear();
        }
      }
    }

    DeviceEventEmitter = new WebEventEmitter();
  }
} else {
  // Use React Native's DeviceEventEmitter
  try {
    const { DeviceEventEmitter: NativeDeviceEventEmitter } = require('react-native');
    DeviceEventEmitter = NativeDeviceEventEmitter;
  } catch {
    // Fallback if native module isn't available
    DeviceEventEmitter = {
      addListener: () => ({ remove: () => {} }),
      emit: () => {},
      removeAllListeners: () => {}
    };
  }
}

export { DeviceEventEmitter };