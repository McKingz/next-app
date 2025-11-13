/**
 * Unified Storage API
 * 
 * Automatically uses the correct storage implementation:
 * - Web: localStorage via async API
 * - Native: @react-native-async-storage/async-storage
 * 
 * Usage:
 * ```ts
 * import { storage } from '@/lib/storage';
 * 
 * await storage.setItem('key', 'value');
 * const value = await storage.getItem('key');
 * await storage.removeItem('key');
 * ```
 */

// Platform-specific exports (Metro resolves .web.ts or .native.ts automatically)
export { storage } from './crossPlatform';
