/**
 * Web Storage Adapter
 * Uses localStorage with async API to match React Native AsyncStorage interface
 */

type StorageAdapter = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

const hasLocalStorage =
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const ls = hasLocalStorage ? window.localStorage : undefined;

export const storage: StorageAdapter = {
  getItem: async (key: string) => {
    try {
      return ls ? ls.getItem(key) : null;
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string) => {
    try {
      if (ls) ls.setItem(key, value);
    } catch {
      // Silent fail on quota exceeded, etc.
    }
  },
  removeItem: async (key: string) => {
    try {
      if (ls) ls.removeItem(key);
    } catch {
      // Silent fail
    }
  },
};
