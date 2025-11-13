/**
 * Cross-platform storage type declaration
 * Supports both .web.ts and .native.ts implementations
 */

export interface StorageAdapter {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

export const storage: StorageAdapter;
