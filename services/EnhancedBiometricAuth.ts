/**
 * Enhanced Biometric Authentication Service
 * 
 * Provides a more streamlined biometric authentication experience by maintaining
 * secure session tokens and bypassing email-based OTP flows for returning users.
 */

import { assertSupabase } from '@/lib/supabase';
import { BiometricAuthService } from './BiometricAuthService';
import { Alert, Platform } from 'react-native';

// Dynamically import SecureStore to avoid web issues
let SecureStore: any = null;
try {
  if (Platform.OS !== 'web') {
    SecureStore = require('expo-secure-store');
  }
} catch (e) {
  console.debug('SecureStore import failed (web or unsupported platform)', e);
}

// Dynamically require AsyncStorage to avoid web/test issues
let AsyncStorage: any = null;
try {
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
} catch (e) {
  console.debug('AsyncStorage import failed (non-React Native env?)', e);
  // Web fallback using localStorage
  if (typeof window !== 'undefined' && window.localStorage) {
    AsyncStorage = {
      getItem: async (key: string) => {
        try {
          return window.localStorage.getItem(key);
        } catch {
          return null;
        }
      },
      setItem: async (key: string, value: string) => {
        try {
          window.localStorage.setItem(key, value);
        } catch {
          // ignore
        }
      },
      removeItem: async (key: string) => {
        try {
          window.localStorage.removeItem(key);
        } catch {
          // ignore
        }
      },
    };
  }
}

// SecureStore adapter (preferred for iOS). Note: SecureStore has a ~2KB limit per item on Android.
const SecureStoreAdapter = SecureStore ? {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value, { keychainService: key }),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
} : null;

// AsyncStorage adapter (preferred for Android, no 2KB limit)
const AsyncStorageAdapter = AsyncStorage
  ? {
      getItem: (key: string) => AsyncStorage.getItem(key),
      setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
      removeItem: (key: string) => AsyncStorage.removeItem(key),
    }
  : null;

// In-memory fallback for tests or environments without the above storages
const MemoryStorageAdapter = {
  _map: new Map<string, string>(),
  getItem: async (key: string) => (MemoryStorageAdapter._map.has(key) ? MemoryStorageAdapter._map.get(key)! : null),
  setItem: async (key: string, value: string) => {
    MemoryStorageAdapter._map.set(key, value);
  },
  removeItem: async (key: string) => {
    MemoryStorageAdapter._map.delete(key);
  },
};

function chooseStorage() {
  try {
    // Web platform: use localStorage via AsyncStorage or memory fallback
    if (Platform?.OS === 'web') {
      if (AsyncStorageAdapter) return AsyncStorageAdapter;
      return MemoryStorageAdapter;
    }
    // Use AsyncStorage on Android to avoid SecureStore size limit warning/failures
    if (Platform?.OS === 'android' && AsyncStorageAdapter) return AsyncStorageAdapter;
    // iOS and other platforms: prefer SecureStore; fall back if unavailable
    if (SecureStoreAdapter) return SecureStoreAdapter;
    if (AsyncStorageAdapter) return AsyncStorageAdapter;
  } catch (e) {
    console.debug('chooseStorage unexpected error', e);
  }
  return MemoryStorageAdapter;
}

const storage = chooseStorage();

const BIOMETRIC_SESSION_KEY = 'biometric_session_token';
const BIOMETRIC_USER_PROFILE_KEY = 'biometric_user_profile';
const BIOMETRIC_REFRESH_TOKEN_KEY = 'biometric_refresh_token';
// V2 multi-account support
const BIOMETRIC_SESSIONS_KEY = 'biometric_sessions_v2';
const BIOMETRIC_ACTIVE_USER_ID_KEY = 'biometric_active_user_id_v2';

export interface BiometricSessionData {
  userId: string;
  email: string;
  sessionToken: string;
  expiresAt: string;
  lastUsed: string;
  profileSnapshot?: any;
}

export class EnhancedBiometricAuth {
  /**
   * Internal: get sessions map for v2 multi-account store
   */
  private static async getSessionsMap(): Promise<Record<string, BiometricSessionData>> {
    try {
      const raw = await storage.getItem(BIOMETRIC_SESSIONS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  private static async setSessionsMap(map: Record<string, BiometricSessionData>): Promise<void> {
    await storage.setItem(BIOMETRIC_SESSIONS_KEY, JSON.stringify(map));
  }

  private static async getActiveUserId(): Promise<string | null> {
    try {
      if (SecureStore) {
        return await SecureStore.getItemAsync(BIOMETRIC_ACTIVE_USER_ID_KEY);
      } else if (AsyncStorage) {
        return await AsyncStorage.getItem(BIOMETRIC_ACTIVE_USER_ID_KEY);
      }
    } catch { /* Intentional: non-fatal */ }
    return null;
  }

  public static async setActiveUserId(userId: string): Promise<void> {
    try {
      if (SecureStore) {
        await SecureStore.setItemAsync(BIOMETRIC_ACTIVE_USER_ID_KEY, userId);
      } else if (AsyncStorage) {
        await AsyncStorage.setItem(BIOMETRIC_ACTIVE_USER_ID_KEY, userId);
      }
    } catch { /* Intentional: non-fatal */ }
  }

  private static makeRefreshKey(userId: string): string {
    return `biometric_refresh_token_${userId}`;
  }

  private static async setRefreshTokenForUser(userId: string, token: string): Promise<void> {
    try {
      if (SecureStore) {
        await SecureStore.setItemAsync(this.makeRefreshKey(userId), token);
      } else if (AsyncStorage) {
        await AsyncStorage.setItem(this.makeRefreshKey(userId), token);
      }
    } catch { /* Intentional: non-fatal */ }
  }

  private static async getRefreshTokenForUser(userId: string): Promise<string | null> {
    try {
      if (SecureStore) {
        return await SecureStore.getItemAsync(this.makeRefreshKey(userId));
      } else if (AsyncStorage) {
        return await AsyncStorage.getItem(this.makeRefreshKey(userId));
      }
    } catch { /* Intentional: non-fatal */ }
    return null;
  }

  private static async clearRefreshTokenForUser(userId: string): Promise<void> {
    try {
      if (SecureStore) {
        await SecureStore.deleteItemAsync(this.makeRefreshKey(userId));
      } else if (AsyncStorage) {
        await AsyncStorage.removeItem(this.makeRefreshKey(userId));
      }
    } catch { /* Intentional: non-fatal */ }
  }

  /**
   * Ensure a given session is present in the v2 sessions map and set active user id.
   */
  private static async ensureSessionInMap(session: BiometricSessionData): Promise<void> {
    try {
      const sessions = await this.getSessionsMap();
      if (!sessions[session.userId]) {
        sessions[session.userId] = session;
        await this.setSessionsMap(sessions);
      }
      await this.setActiveUserId(session.userId);
    } catch (e) {
      console.warn('ensureSessionInMap failed:', e);
    }
  }

  /**
   * Store secure session data for biometric users (supports multi-account)
   */
  static async storeBiometricSession(userId: string, email: string, profile?: any, refreshToken?: string): Promise<boolean> {
    try {
      // Create a session token that's valid for 30 days
      const expirationTime = new Date();
      expirationTime.setDate(expirationTime.getDate() + 30);
      
      const sessionData: BiometricSessionData = {
        userId,
        email,
        sessionToken: await this.generateSecureToken(),
        expiresAt: expirationTime.toISOString(),
        lastUsed: new Date().toISOString(),
        profileSnapshot: profile ? {
          role: profile.role,
          organization_id: profile.organization_id,
          seat_status: profile.seat_status,
          cached_at: new Date().toISOString()
        } : undefined
      };

      await storage.setItem(
        BIOMETRIC_SESSION_KEY,
        JSON.stringify(sessionData)
      );

      // Persist refresh token separately (prefer SecureStore)
      try {
        let tokenToStore = refreshToken;
        if (!tokenToStore) {
          // Try to get current session's refresh token
          const { getCurrentSession } = await import('@/lib/sessionManager');
          const current = await getCurrentSession();
          tokenToStore = current?.refresh_token;
        }
        if (tokenToStore) {
          // Global fallback (legacy)
          if (SecureStore) {
            await SecureStore.setItemAsync(BIOMETRIC_REFRESH_TOKEN_KEY, tokenToStore);
          } else if (AsyncStorage) {
            await AsyncStorage.setItem(BIOMETRIC_REFRESH_TOKEN_KEY, tokenToStore);
          }
          // Per-user token for multi-account support
          await this.setRefreshTokenForUser(userId, tokenToStore);
        }
      } catch (storeTokenErr) {
        console.warn('Could not store biometric refresh token:', storeTokenErr);
      }

      // V2 multi-account: store in sessions map and set active user
      try {
        const sessions = await this.getSessionsMap();
        sessions[userId] = sessionData;
        await this.setSessionsMap(sessions);
        await this.setActiveUserId(userId);
      } catch (e) {
        console.warn('Could not persist v2 biometric sessions map:', e);
      }

      console.log('Stored biometric session data for user:', email);
      return true;
    } catch (error) {
      console.error('Error storing biometric session:', error);
      return false;
    }
  }

  /**
   * Get stored biometric session data
   */
  static async getBiometricSession(): Promise<BiometricSessionData | null> {
    try {
      // Prefer v2 active user session
      const activeId = await this.getActiveUserId();
      if (activeId) {
        const sessions = await this.getSessionsMap();
        const sessionData = sessions[activeId];
        if (sessionData) {
          const expirationTime = new Date(sessionData.expiresAt);
          if (expirationTime < new Date()) {
            console.log('Biometric session expired for active user, clearing');
            await this.removeBiometricSession(activeId);
            return null;
          }
          return sessionData;
        }
      }

      // Legacy single-session fallback
      const sessionDataString = await storage.getItem(BIOMETRIC_SESSION_KEY);
      if (!sessionDataString) {
        return null;
      }

      const sessionData: BiometricSessionData = JSON.parse(sessionDataString);
      
      // Check if session is expired
      const expirationTime = new Date(sessionData.expiresAt);
      if (expirationTime < new Date()) {
        console.log('Biometric session expired, clearing data');
        await this.clearBiometricSession();
        return null;
      }

      return sessionData;
    } catch (error) {
      console.error('Error getting biometric session:', error);
      return null;
    }
  }

  /**
   * Clear stored biometric session
   */
  static async clearBiometricSession(): Promise<void> {
    try {
      // Legacy single-session cleanup
      await storage.removeItem(BIOMETRIC_SESSION_KEY);
      await storage.removeItem(BIOMETRIC_USER_PROFILE_KEY);

      // V2 multi-account cleanup: remove all sessions and per-user refresh tokens
      try {
        const sessions = await this.getSessionsMap();
        const userIds = Object.keys(sessions);
        for (const uid of userIds) {
          await this.clearRefreshTokenForUser(uid);
        }
        await storage.removeItem(BIOMETRIC_SESSIONS_KEY);
        if (SecureStore) {
          await SecureStore.deleteItemAsync(BIOMETRIC_ACTIVE_USER_ID_KEY).catch(() => { /* Intentional: error handled */ });
        } else if (AsyncStorage) {
          await AsyncStorage.removeItem(BIOMETRIC_ACTIVE_USER_ID_KEY).catch(() => { /* Intentional: error handled */ });
        }
      } catch { /* Intentional: non-fatal */ }

      // Also remove global stored biometric refresh token
      try {
        if (SecureStore) {
          await SecureStore.deleteItemAsync(BIOMETRIC_REFRESH_TOKEN_KEY);
        } else if (AsyncStorage) {
          await AsyncStorage.removeItem(BIOMETRIC_REFRESH_TOKEN_KEY);
        }
      } catch {
        // ignore
      }
    } catch (error) {
      console.error('Error clearing biometric session:', error);
    }
  }

  /**
   * Perform enhanced biometric authentication with session management
   */
  static async authenticateWithBiometric(): Promise<{
    success: boolean;
    userData?: BiometricSessionData;
    sessionRestored?: boolean;
    error?: string;
  }> {
    try {
      // First check if device biometrics are available and enrolled
      const capabilities = await BiometricAuthService.checkCapabilities();
      if (!capabilities.isAvailable || !capabilities.isEnrolled) {
        return {
          success: false,
          error: 'Biometric authentication is not available or not enrolled on this device'
        };
      }

      // Get stored session data (active user)
      const sessionData = await this.getBiometricSession();
      if (!sessionData) {
        return {
          success: false,
          error: 'No biometric session found. Please sign in with password first.'
        };
      }

      // Perform biometric authentication
      const authResult = await BiometricAuthService.authenticate(
        'Use biometric authentication to sign in'
      );

      if (!authResult.success) {
        return {
          success: false,
          error: authResult.error || 'Biometric authentication failed'
        };
      }

      // Try to restore Supabase session if needed
      let sessionRestored = false;
      try {
        const { assertSupabase } = await import('@/lib/supabase');
        {
          // Check if current session is valid
          const { data } = await assertSupabase().auth.getSession();
          
          if (!data.session?.user) {
            console.log('No active Supabase session, attempting to restore');

            // Prefer per-user biometric refresh token for active user
            let perUserRefresh: string | null = await this.getRefreshTokenForUser(sessionData.userId);

            if (perUserRefresh) {
              const { data: refreshed, error: refreshErr } = await assertSupabase().auth.refreshSession({
                refresh_token: perUserRefresh,
              });
              if (!refreshErr && refreshed?.session?.user) {
                console.log('Restored Supabase session using per-user biometric refresh token');
                sessionRestored = true;
              }
            }

            if (!sessionRestored) {
              // Fallback to sessionManager stored session (if any)
              const { getCurrentSession } = await import('@/lib/sessionManager');
              const storedSession = await getCurrentSession();
              if (storedSession) {
              const { data: refreshed2, error: refreshErr2 } = await assertSupabase().auth.refreshSession({
                refresh_token: storedSession.refresh_token,
              });
                if (!refreshErr2 && refreshed2?.session?.user) {
                  console.log('Successfully refreshed and restored Supabase session from stored session');
                  sessionRestored = true;
                }
              }
            }

            if (!sessionRestored) {
              // Last resort: global biometric refresh token
              let biometricRefresh: string | null = null;
              try {
                biometricRefresh = SecureStore 
                  ? await SecureStore.getItemAsync(BIOMETRIC_REFRESH_TOKEN_KEY)
                  : await AsyncStorage.getItem(BIOMETRIC_REFRESH_TOKEN_KEY);
              } catch { /* Intentional: non-fatal */ }
              if (biometricRefresh) {
                const { data: refreshed3, error: refreshErr3 } = await assertSupabase().auth.refreshSession({
                  refresh_token: biometricRefresh,
                });
                if (!refreshErr3 && refreshed3?.session?.user) {
                  console.log('Restored Supabase session using global biometric refresh token');
                  sessionRestored = true;
                }
              }
            }

          } else {
            console.log('Valid Supabase session already exists');
            sessionRestored = true;
          }
        }
      } catch (sessionError) {
        console.error('Error during session restoration:', sessionError);
        // Continue anyway, as biometric auth was successful
      }

      // Update last used time
      sessionData.lastUsed = new Date().toISOString();
      await storage.setItem(
        BIOMETRIC_SESSION_KEY,
        JSON.stringify(sessionData)
      );

      // Migration: ensure this active user exists in v2 sessions map and set active
      await this.ensureSessionInMap(sessionData);

      console.log('Enhanced biometric authentication successful for:', sessionData.email);
      
      // Ensure session data is persisted for later restores if we refreshed tokens
      if (sessionRestored) {
        try {
          const { getCurrentSession } = await import('@/lib/sessionManager');
          const current = await getCurrentSession();
          if (current) {
            await storage.setItem(
              BIOMETRIC_SESSION_KEY,
              JSON.stringify({
                ...sessionData,
                lastUsed: new Date().toISOString(),
              })
            );
          }
        } catch (persistErr) {
          console.warn('Could not persist biometric session after restore:', persistErr);
        }
      }

      return {
        success: true,
        userData: sessionData,
        sessionRestored
      };

    } catch (error) {
      console.error('Enhanced biometric authentication error:', error);
      return {
        success: false,
        error: 'Authentication failed due to an error'
      };
    }
  }

  /**
   * Get a list of biometric accounts stored on device (multi-account)
   */
  static async getBiometricAccounts(): Promise<Array<{ userId: string; email: string; lastUsed: string; expiresAt: string }>> {
    try {
      const sessions = await this.getSessionsMap();
      const accountsMap: Record<string, { userId: string; email: string; lastUsed: string; expiresAt: string }> = {};
      Object.values(sessions).forEach(s => {
        accountsMap[s.userId] = { userId: s.userId, email: s.email, lastUsed: s.lastUsed, expiresAt: s.expiresAt };
      });

      // Also include legacy single-session if present and not already in map
      try {
        const legacy = await storage.getItem(BIOMETRIC_SESSION_KEY);
        if (legacy) {
          const s: BiometricSessionData = JSON.parse(legacy);
          if (s?.userId && !accountsMap[s.userId]) {
            accountsMap[s.userId] = { userId: s.userId, email: s.email, lastUsed: s.lastUsed, expiresAt: s.expiresAt };
          }
        }
      } catch { /* Intentional: non-fatal */ }

      const accounts = Object.values(accountsMap);
      // Sort by lastUsed desc
      accounts.sort((a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime());
      return accounts;
    } catch {
      return [];
    }
  }

  /**
   * Remove a specific biometric session by user id
   */
  static async removeBiometricSession(userId: string): Promise<void> {
    try {
      const sessions = await this.getSessionsMap();
      if (sessions[userId]) {
        delete sessions[userId];
        await this.setSessionsMap(sessions);
      }
      await this.clearRefreshTokenForUser(userId);
      // Clear legacy active id if it matches
      const active = await this.getActiveUserId();
      if (active === userId) {
        await this.setActiveUserId('');
      }
    } catch (e) {
      console.warn('removeBiometricSession error:', e);
    }
  }

  /**
   * Authenticate and restore session for a specific user (switch account)
   */
  static async authenticateWithBiometricForUser(userId: string): Promise<{
    success: boolean;
    userData?: BiometricSessionData;
    sessionRestored?: boolean;
    error?: string;
  }> {
    try {
      const capabilities = await BiometricAuthService.checkCapabilities();
      if (!capabilities.isAvailable || !capabilities.isEnrolled) {
        return { success: false, error: 'Biometric not available or not enrolled' };
      }

      const sessions = await this.getSessionsMap();
      const sessionData = sessions[userId];
      if (!sessionData) {
        return { success: false, error: 'No biometric session found for selected account' };
      }

      const authResult = await BiometricAuthService.authenticate('Confirm to switch account');
      if (!authResult.success) {
        return { success: false, error: authResult.error || 'Authentication failed' };
      }

      // Restore Supabase session using per-user refresh token
      let sessionRestored = false;
      try {
        const { assertSupabase } = await import('@/lib/supabase');
        {
          const refresh = await this.getRefreshTokenForUser(userId);
          if (refresh) {
            const { data: refreshed, error: refreshErr } = await assertSupabase().auth.refreshSession({ refresh_token: refresh });
            if (!refreshErr && refreshed?.session?.user) {
              sessionRestored = true;
            }
          }
        }
      } catch (e) {
        console.warn('Switch account session restore error:', e);
      }

      // Update active user and last used
      sessionData.lastUsed = new Date().toISOString();
      const newMap = await this.getSessionsMap();
      newMap[userId] = sessionData;
      await this.setSessionsMap(newMap);
      await this.setActiveUserId(userId);

      return { success: true, userData: sessionData, sessionRestored };
    } catch (error) {
      console.error('authenticateWithBiometricForUser error:', error);
      return { success: false, error: 'Authentication failed due to an error' };
    }
  }

  /**
   * Setup biometric authentication for a user after successful password login
   */
  static async setupBiometricForUser(user: any, profile?: any): Promise<boolean> {
    try {
      const capabilities = await BiometricAuthService.checkCapabilities();
      if (!capabilities.isAvailable || !capabilities.isEnrolled) {
        Alert.alert(
          'Biometric Setup',
          'Biometric authentication is not available or not set up on this device.'
        );
        return false;
      }

      // Test biometric authentication
      const authResult = await BiometricAuthService.authenticate(
        'Enable biometric sign-in for faster access'
      );

      if (!authResult.success) {
        Alert.alert(
          'Setup Failed',
          authResult.error || 'Could not verify biometric authentication'
        );
        return false;
      }

      // Enable biometric auth in the service
      const enableResult = await BiometricAuthService.enableBiometric(user.id, user.email);
      if (!enableResult) {
        return false;
      }

      // Store enhanced session data
      const sessionStored = await this.storeBiometricSession(user.id, user.email, profile);
      if (!sessionStored) {
        // Rollback biometric enablement if session storage fails
        await BiometricAuthService.disableBiometric();
        Alert.alert('Setup Failed', 'Could not complete biometric setup');
        return false;
      }

      Alert.alert(
        'Biometric Sign-In Enabled',
        'You can now use biometric authentication to sign in quickly and securely.'
      );

      return true;
    } catch (error) {
      console.error('Error setting up biometric authentication:', error);
      Alert.alert('Setup Error', 'Failed to set up biometric authentication');
      return false;
    }
  }

  /**
   * Update cached profile data for biometric session
   */
  static async updateCachedProfile(profile: any): Promise<void> {
    try {
      const sessionData = await this.getBiometricSession();
      if (sessionData) {
        sessionData.profileSnapshot = {
          role: profile.role,
          organization_id: profile.organization_id,
          seat_status: profile.seat_status,
          cached_at: new Date().toISOString()
        };

        await storage.setItem(
          BIOMETRIC_SESSION_KEY,
          JSON.stringify(sessionData)
        );
      }
    } catch (error) {
      console.error('Error updating cached profile:', error);
    }
  }

  /**
   * Generate a secure token for session management
   */
  private static async generateSecureToken(): Promise<string> {
    try {
      // Use the centralized crypto utility
      const { generateSecureToken } = await import('@/utils/crypto');
      return await generateSecureToken(32);
    } catch (error) {
      console.error('Error generating secure token:', error);
      
      // Ultimate fallback: simple but functional
      const timestamp = Date.now().toString(16);
      const random1 = Math.random().toString(16).substring(2);
      const random2 = Math.random().toString(16).substring(2);
      const random3 = Math.random().toString(16).substring(2);
      return (timestamp + random1 + random2 + random3).substring(0, 64);
    }
  }
}