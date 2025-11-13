/**
 * Web SecureStore Stub
 * 
 * WARNING: This is NOT actually secure on web!
 * Uses localStorage with a prefix for namespace isolation.
 * Only use for non-sensitive data on web platform.
 */

const NS = 'SECURE_';

const hasLocalStorage =
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

export const secureStore = {
  getItem: async (key: string): Promise<string | null> => {
    if (!hasLocalStorage) return null;
    try {
      return window.localStorage.getItem(NS + key);
    } catch {
      return null;
    }
  },

  setItem: async (key: string, value: string): Promise<void> => {
    if (!hasLocalStorage) return;
    try {
      window.localStorage.setItem(NS + key, value);
    } catch {
      // Silent fail
    }
  },

  deleteItem: async (key: string): Promise<void> => {
    if (!hasLocalStorage) return;
    try {
      window.localStorage.removeItem(NS + key);
    } catch {
      // Silent fail
    }
  },
};
