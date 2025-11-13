// StorageService adapter using AsyncStorage/SecureStore with memory fallback
import type { StorageService } from '../types';
import { Platform } from 'react-native';

let SecureStore: any = null;
try { if (Platform.OS !== 'web') { SecureStore = require('expo-secure-store'); } } catch {}
let AsyncStorage: any = null;
try { AsyncStorage = require('@react-native-async-storage/async-storage').default; } catch {}

const memory = new Map<string, string>();

function getBackend() {
  // Prefer AsyncStorage on Android; SecureStore elsewhere; fallbacks for web/tests
  if (Platform?.OS === 'android' && AsyncStorage) return 'async';
  if (SecureStore) return 'secure';
  if (AsyncStorage) return 'async';
  return 'memory';
}

export class StorageAdapter implements StorageService {
  private backend = getBackend();

  async getItem<T = string>(key: string): Promise<T | null> {
    switch (this.backend) {
      case 'secure':
        return (await SecureStore.getItemAsync(key)) as T | null;
      case 'async':
        return (await AsyncStorage.getItem(key)) as T | null;
      default:
        return (memory.has(key) ? (memory.get(key) as unknown as T) : null);
    }
  }

  async setItem<T = string>(key: string, value: T): Promise<void> {
    const str = String(value as any);
    switch (this.backend) {
      case 'secure':
        await SecureStore.setItemAsync(key, str, { keychainService: key });
        break;
      case 'async':
        await AsyncStorage.setItem(key, str);
        break;
      default:
        memory.set(key, str);
    }
  }

  async removeItem(key: string): Promise<void> {
    switch (this.backend) {
      case 'secure':
        await SecureStore.deleteItemAsync(key);
        break;
      case 'async':
        await AsyncStorage.removeItem(key);
        break;
      default:
        memory.delete(key);
    }
  }
}
