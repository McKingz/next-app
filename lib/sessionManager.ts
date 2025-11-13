import { Platform } from 'react-native';
import { assertSupabase } from '@/lib/supabase';
import { track, identifyUser } from '@/lib/analytics';
import { identifyUserForFlags } from '@/lib/featureFlags';
import { reportError } from '@/lib/monitoring';

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

export interface UserSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user_id: string;
  role?: string;
  organization_id?: string;
  email?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  role: 'super_admin' | 'principal_admin' | 'principal' | 'teacher' | 'parent';
  organization_id?: string;
  organization_name?: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  seat_status?: 'active' | 'inactive' | 'pending';
  capabilities?: string[];
  created_at?: string;
  last_login_at?: string;
}

const SESSION_STORAGE_KEY = 'edudash_session';
const PROFILE_STORAGE_KEY = 'edudash_profile';
const REFRESH_THRESHOLD = parseInt(process.env.EXPO_PUBLIC_SESSION_REFRESH_THRESHOLD || '300000'); // 5 minutes

let sessionRefreshTimer: any = null;

/**
 * Securely store session data
 */
async function storeSession(session: UserSession): Promise<void> {
  try {
    await storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch (error) {
    reportError(new Error('Failed to store session'), { error });
    throw error;
  }
}

/**
 * Retrieve stored session data
 */
async function getStoredSession(): Promise<UserSession | null> {
  try {
    const sessionData = await storage.getItem(SESSION_STORAGE_KEY);
    return sessionData ? JSON.parse(sessionData) : null;
  } catch (error) {
    console.error('Failed to retrieve session:', error);
    return null;
  }
}

/**
 * Securely store user profile
 */
async function storeProfile(profile: UserProfile): Promise<void> {
  try {
    await storage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch (error) {
    console.error('Failed to store profile:', error);
  }
}

/**
 * Retrieve stored user profile
 */
async function getStoredProfile(): Promise<UserProfile | null> {
  try {
    const profileData = await storage.getItem(PROFILE_STORAGE_KEY);
    return profileData ? JSON.parse(profileData) : null;
  } catch (error) {
    console.error('Failed to retrieve profile:', error);
    return null;
  }
}

/**
 * Clear stored session and profile data
 */
async function clearStoredData(): Promise<void> {
  try {
    console.log('[SessionManager] Clearing all stored data...');
    await Promise.all([
      storage.removeItem(SESSION_STORAGE_KEY),
      storage.removeItem(PROFILE_STORAGE_KEY),
    ]);
    
    // Also clear from AsyncStorage if it's available (extra safety)
    if (AsyncStorage) {
      try {
        await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
        await AsyncStorage.removeItem(PROFILE_STORAGE_KEY);
      } catch (e) {
        console.debug('AsyncStorage clear skipped:', e);
      }
    }
    
    console.log('[SessionManager] All stored data cleared successfully');
  } catch (error) {
    console.error('Failed to clear stored data:', error);
  }
}

/**
 * Fetch user profile from database
 */
async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    // Try both auth_user_id and id fields for compatibility
    let profile = null;
    let profileError = null;
    
    // First try with auth_user_id (the correct field)
    const { data: profileByAuth, error: authError } = await assertSupabase()
      .from('users')
      .select(`
        id,
        email,
        role,
        first_name,
        last_name,
        avatar_url,
        created_at,
        preschool_id,
        is_active
      `)
      .eq('auth_user_id', userId)
      .maybeSingle();
      
    if (!authError && profileByAuth) {
      profile = profileByAuth;
    } else {
      // Fallback to id field
      const { data: profileById, error: idError } = await assertSupabase()
        .from('users')
        .select(`
          id,
          email,
          role,
          first_name,
          last_name,
          avatar_url,
          created_at,
          preschool_id,
          is_active
        `)
        .eq('id', userId)
        .maybeSingle();
        
      if (!idError && profileById) {
        profile = profileById;
      } else {
        profileError = authError || idError;
      }
    }

    if (profileError && !profile) {
      console.error('Failed to fetch user profile:', profileError);
      return null;
    }

    if (!profile) {
      // No profile row; construct a minimal placeholder to avoid crashes
      console.warn('No profile row found for user:', userId);
      const planTier = undefined;
      const capabilities = await getUserCapabilities('parent', planTier);
      return {
        id: userId,
        email: '',
        role: 'parent',
        first_name: '',
        last_name: '',
        avatar_url: '',
        organization_id: undefined,
        organization_name: undefined,
        seat_status: 'active',
        capabilities,
        created_at: new Date().toISOString(),
        last_login_at: null as any,
      };
    }

    // Get user capabilities based on role and subscription
    const planTier = undefined;
    const capabilities = await getUserCapabilities(profile.role, planTier);

    return {
      id: profile.id,
      email: profile.email,
      role: profile.role,
      first_name: profile.first_name,
      last_name: profile.last_name,
      avatar_url: profile.avatar_url,
      organization_id: profile.preschool_id,
      organization_name: undefined,
      seat_status: profile.is_active !== false ? 'active' : 'inactive',
      capabilities,
      created_at: profile.created_at,
      last_login_at: (profile as any).last_login_at ?? null,
    };
  } catch (error) {
    reportError(new Error('Failed to fetch user profile'), { userId, error });
    return null;
  }
}

/**
 * Get user capabilities based on role and subscription tier
 */
async function getUserCapabilities(role: string, planTier?: string): Promise<string[]> {
  // Default to parent for unknown/missing roles to allow minimal mobile access
  const normalizedRole = (String(role || 'parent').toLowerCase());
  const baseCapabilities: Record<string, string[]> = {
    super_admin: [
      'access_mobile_app',
      'view_all_organizations',
      'manage_organizations',
      'view_billing',
      'manage_subscriptions',
      'access_admin_tools',
    ],
    principal_admin: [
      'access_mobile_app',
      'view_school_metrics',
      'manage_teachers',
      'manage_students',
      'access_principal_hub',
      'generate_reports',
    ],
    principal: [
      'access_mobile_app',
      'view_school_metrics',
      'manage_teachers',
      'manage_students',
      'access_principal_hub',
      'generate_reports',
    ],
    teacher: [
      'access_mobile_app',
      'manage_classes',
      'create_assignments',
      'grade_assignments',
      'view_class_analytics',
    ],
    parent: [
      'access_mobile_app',
      'view_child_progress',
      'communicate_with_teachers',
      'access_homework_help',
    ],
  };

  const capabilities = baseCapabilities[normalizedRole] || baseCapabilities['parent'];

  // Add tier-specific capabilities
  if (planTier === 'premium' || planTier === 'enterprise') {
    capabilities.push('ai_lesson_generation', 'advanced_analytics');
  }

  if (planTier === 'enterprise') {
    capabilities.push(
      'ai_grading_assistance',
      'bulk_operations',
      'custom_reports',
      'sso_access',
      'priority_support'
    );
  }

  return capabilities;
}

/**
 * Check if session needs refresh
 */
function needsRefresh(session: UserSession): boolean {
  const now = Date.now();
  const timeUntilExpiry = session.expires_at * 1000 - now;
  return timeUntilExpiry < REFRESH_THRESHOLD;
}

// Track pending refresh to prevent concurrent calls
let pendingRefresh: Promise<UserSession | null> | null = null;

/**
 * Process refresh session result
 */
async function processRefreshResult(
  result: { data: any; error: any },
  attempt: number
): Promise<UserSession | null> {
  const { data, error } = result;
  
  if (error) {
    console.error('[SessionManager] Supabase refresh error:', error.message);
    throw error;
  }

  if (!data.session) {
    throw new Error('No session returned from refresh');
  }

  console.log('[INFO] Token refreshed successfully');

  const newSession: UserSession = {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at || Date.now() / 1000 + 3600,
    user_id: data.session.user.id,
    email: data.session.user.email,
  };

  await storeSession(newSession);

  track('edudash.auth.session_refreshed', {
    attempt,
    success: true,
  });

  return newSession;
}

/**
 * Refresh session using refresh token
 */
async function refreshSession(
  refreshToken: string,
  attempt: number = 1,
  maxAttempts: number = 3
): Promise<UserSession | null> {
  // If refresh is already in progress, return the pending promise
  if (pendingRefresh && attempt === 1) {
    console.log('[SessionManager] Refresh already in progress, waiting...');
    return pendingRefresh;
  }

  try {
    // Validate refresh token before attempting refresh
    if (!refreshToken || refreshToken.trim() === '') {
      throw new Error('Invalid refresh token: empty or null');
    }

    console.log(`[SessionManager] Attempting refresh (attempt ${attempt}/${maxAttempts})`);
    
    // Start refresh and track it
    const refreshPromise = assertSupabase().auth.refreshSession({
      refresh_token: refreshToken,
    });
    
    if (attempt === 1) {
      pendingRefresh = (async () => {
        try {
          const result = await refreshPromise;
          return await processRefreshResult(result, attempt);
        } finally {
          pendingRefresh = null;
        }
      })();
      return pendingRefresh;
    }
    
    const { data, error } = await refreshPromise;

    return await processRefreshResult({ data, error }, attempt);
  } catch (error) {
    console.error(`Session refresh attempt ${attempt} failed:`, error);

    // Special handling for specific refresh token errors
    if (error instanceof Error) {
      // Don't retry for "Already Used" errors - this means a concurrent refresh succeeded
      if (error.message.includes('Already Used')) {
        console.log('[SessionManager] Refresh token already used (concurrent refresh), fetching current session');
        // Try to get the session that was just refreshed
        const currentSession = await getStoredSession();
        if (currentSession) {
          return currentSession;
        }
      }
      
      if (error.message.includes('Invalid Refresh Token') || 
          error.message.includes('Refresh Token Not Found') ||
          error.message.includes('refresh_token_not_found')) {
        console.log('[SessionManager] Refresh token is invalid, clearing stored session');
        await clearStoredData();
        
        track('edudash.auth.session_refresh_failed', {
          attempts: attempt,
          error: 'invalid_refresh_token',
          final: true,
        });
        
        return null; // Don't retry for invalid tokens
      }
    }

    if (attempt < maxAttempts) {
      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, attempt - 1) * 1000;
      console.log(`[SessionManager] Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return refreshSession(refreshToken, attempt + 1, maxAttempts);
    }

    track('edudash.auth.session_refresh_failed', {
      attempts: attempt,
      error: error instanceof Error ? error.message : 'Unknown error',
      final: true,
    });

    reportError(new Error('Session refresh failed after all attempts'), { 
      attempts: attempt, 
      originalError: error 
    });

    // Clear stored session if all attempts failed
    await clearStoredData();
    return null;
  }
}

/**
 * Auto-refresh session management
 */
function setupAutoRefresh(session: UserSession): void {
  // Clear existing timer
  if (sessionRefreshTimer) {
    clearTimeout(sessionRefreshTimer);
  }

  if (process.env.EXPO_PUBLIC_SESSION_AUTO_REFRESH !== 'true') {
    return;
  }

  const now = Date.now();
  const timeUntilRefresh = session.expires_at * 1000 - now - REFRESH_THRESHOLD;

  if (timeUntilRefresh > 0) {
    sessionRefreshTimer = setTimeout(async () => {
      try {
        const currentSession = await getStoredSession();
        if (currentSession && needsRefresh(currentSession)) {
          const refreshedSession = await refreshSession(currentSession.refresh_token);
          if (refreshedSession) {
            setupAutoRefresh(refreshedSession);
          }
        }
      } catch (error) {
        console.error('Auto-refresh failed:', error);
      }
    }, timeUntilRefresh);
  }
}

/**
 * Initialize session from stored data
 */
export async function initializeSession(): Promise<{
  session: UserSession | null;
  profile: UserProfile | null;
}> {
  try {
    const storedSession = await getStoredSession();
    const storedProfile = await getStoredProfile();

    if (!storedSession) {
      return { session: null, profile: null };
    }

    // Check if session is expired or needs refresh
    if (needsRefresh(storedSession)) {
      const refreshedSession = await refreshSession(storedSession.refresh_token);
      if (!refreshedSession) {
        await clearStoredData();
        return { session: null, profile: null };
      }
      
      setupAutoRefresh(refreshedSession);
      return { session: refreshedSession, profile: storedProfile };
    }

    setupAutoRefresh(storedSession);
    return { session: storedSession, profile: storedProfile };

  } catch (error) {
    reportError(new Error('Session initialization failed'), { error });
    await clearStoredData();
    return { session: null, profile: null };
  }
}

/**
 * Sign in and establish session
 */
export async function signInWithSession(
  email: string,
  password: string
): Promise<{
  session: UserSession | null;
  profile: UserProfile | null;
  error?: string;
}> {
  try {
    console.log('[SessionManager] signInWithSession called for:', email);
    
    // Clear any stale session data before attempting new sign-in
    console.log('[SessionManager] Clearing stale session data before sign-in...');
    await clearStoredData();
    
    // Small delay to ensure storage is cleared
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const { data, error } = await assertSupabase().auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('[SessionManager] Supabase auth error:', error.message);
      
      // Special handling for "already signed in" errors
      if (error.message?.includes('already') || error.message?.includes('signed in')) {
        console.log('[SessionManager] User already signed in, attempting to get session...');
        try {
          const { data: sessionData } = await assertSupabase().auth.getSession();
          if (sessionData?.session) {
            console.log('[SessionManager] Retrieved existing session');
            // Use the existing session
            const session: UserSession = {
              access_token: sessionData.session.access_token,
              refresh_token: sessionData.session.refresh_token,
              expires_at: sessionData.session.expires_at || Date.now() / 1000 + 3600,
              user_id: sessionData.session.user.id,
              email: sessionData.session.user.email,
            };
            const profile = await fetchUserProfile(sessionData.session.user.id);
            if (profile) {
              await storeSession(session);
              await storeProfile(profile);
              setupAutoRefresh(session);
              return { session, profile };
            }
          }
        } catch (recoveryError) {
          console.error('[SessionManager] Session recovery failed:', recoveryError);
        }
      }
      
      track('edudash.auth.sign_in', {
        method: 'email',
        role: 'unknown',
        success: false,
        error: error.message,
      });
      return { session: null, profile: null, error: error.message };
    }

    if (!data.session || !data.user) {
      return { session: null, profile: null, error: 'Invalid credentials' };
    }

    // Create session object
    const session: UserSession = {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at || Date.now() / 1000 + 3600,
      user_id: data.user.id,
      email: data.user.email,
    };

    // Fetch user profile
    console.log('[SessionManager] Fetching user profile for:', data.user.id);
    const profile = await fetchUserProfile(data.user.id);

    if (!profile) {
      console.error('[SessionManager] Failed to load user profile for user:', data.user.id);
      return { session: null, profile: null, error: 'Failed to load user profile' };
    }
    console.log('[SessionManager] Profile loaded successfully. Role:', profile.role, 'Org:', profile.organization_id);

    // Store session and profile
    console.log('[SessionManager] Storing session and profile...');
    try {
      await Promise.all([
        storeSession(session),
        storeProfile(profile),
      ]);
      console.log('[SessionManager] Session and profile stored successfully');
    } catch (storeError) {
      console.error('[SessionManager] Storage error:', storeError);
      throw new Error(`Storage failed: ${storeError instanceof Error ? storeError.message : 'Unknown error'}`);
    }

    // Update last login via RPC to avoid REST conflicts on public.users
    try {
      const { error: lastLoginError } = await assertSupabase()
        .rpc('update_user_last_login');
      if (lastLoginError) {
        console.warn('Could not update last_login_at via RPC:', lastLoginError);
      }
    } catch (updateError) {
      console.warn('Error updating last_login_at via RPC:', updateError);
      // Continue anyway - this is not critical for login success
    }

    // Set up monitoring and feature flags
    identifyUser(data.user.id, {
      role: profile.role,
      organization_id: profile.organization_id,
      seat_status: profile.seat_status,
    });

    identifyUserForFlags(data.user.id, {
      role: profile.role,
      organization_tier: profile.organization_id ? 'org_member' : 'individual',
      capabilities: profile.capabilities,
    });

    // Set up auto-refresh
    setupAutoRefresh(session);

    track('edudash.auth.sign_in', {
      method: 'email',
      role: profile.role,
      success: true,
    });

    return { session, profile };

  } catch (error) {
    console.error('[SessionManager] signInWithSession caught error:', error);
    console.error('[SessionManager] Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : 'No stack',
    });
    reportError(new Error('Sign-in failed'), { email, error });
    return { 
      session: null, 
      profile: null, 
      error: error instanceof Error ? error.message : 'Sign-in failed' 
    };
  }
}

/**
 * Sign out and clear session
 */
export async function signOut(): Promise<void> {
  try {
    console.log('[SessionManager] Starting sign-out process...');
    const session = await getStoredSession();
    const sessionDuration = session 
      ? Math.round((Date.now() - (session.expires_at * 1000 - 3600000)) / 1000 / 60)
      : 0;

    // Clear auto-refresh timer
    if (sessionRefreshTimer) {
      clearTimeout(sessionRefreshTimer);
      sessionRefreshTimer = null;
    }

    try {
      // Sign out from Supabase and clear local session
      console.log('[SessionManager] Signing out from Supabase (local scope)...');
      await assertSupabase().auth.signOut({ scope: 'local' } as any);
      console.log('[SessionManager] Supabase sign-out (local) successful');
    } catch (supabaseLocalError) {
      console.warn('[SessionManager] Supabase local sign-out error:', supabaseLocalError);
      try {
        // Fallback: try default signOut without scope
        console.log('[SessionManager] Attempting Supabase sign-out (default scope)...');
        await assertSupabase().auth.signOut();
        console.log('[SessionManager] Supabase sign-out (default) successful');
      } catch (supabaseDefaultError) {
        console.warn('[SessionManager] Supabase default sign-out error:', supabaseDefaultError);
        try {
          // Last resort: try global (revokes refresh token); safe for client sign-out
          console.log('[SessionManager] Attempting Supabase sign-out (global scope)...');
          await assertSupabase().auth.signOut({ scope: 'global' } as any);
          console.log('[SessionManager] Supabase sign-out (global) successful');
        } catch (supabaseGlobalError) {
          // Continue even if Supabase sign-out ultimately fails (network issues, etc.)
          console.warn('[SessionManager] Supabase sign-out failed across all scopes (continuing):', supabaseGlobalError);
        }
      }
    }

    // Clear stored data
    await clearStoredData();

    track('edudash.auth.sign_out', {
      session_duration_minutes: sessionDuration,
    });

    console.log('[SessionManager] Sign-out completed successfully');

  } catch (error) {
    console.error('[SessionManager] Sign-out failed:', error);
    // Still try to clear local data even if other steps failed
    try {
      await clearStoredData();
    } catch (clearError) {
      console.error('[SessionManager] Failed to clear data during error recovery:', clearError);
    }
    reportError(new Error('Sign-out failed'), { error });
  }
}

/**
 * Get current session if valid
 */
export async function getCurrentSession(): Promise<UserSession | null> {
  const session = await getStoredSession();
  
  if (!session) return null;

  // Check if session is expired or needs refresh
  const now = Date.now();
  const timeUntilExpiry = session.expires_at * 1000 - now;
  
  // If completely expired, try to refresh anyway (token might still be valid)
  if (timeUntilExpiry <= 0) {
    console.log('Session expired, attempting refresh');
    const refreshedSession = await refreshSession(session.refresh_token);
    if (refreshedSession) {
      setupAutoRefresh(refreshedSession);
      return refreshedSession;
    }
    // If refresh fails, clear the expired session
    await clearStoredData();
    return null;
  }
  
  // If needs refresh but not expired yet
  if (needsRefresh(session)) {
    console.log('Session needs refresh, attempting refresh');
    const refreshedSession = await refreshSession(session.refresh_token);
    if (refreshedSession) {
      setupAutoRefresh(refreshedSession);
      return refreshedSession;
    }
    // If refresh fails, return the current session (still valid)
    console.warn('Session refresh failed, using current session');
  }

  return session;
}

/**
 * Get current user profile
 */
export async function getCurrentProfile(): Promise<UserProfile | null> {
  return await getStoredProfile();
}

/**
 * Refresh user profile data
 */
export async function refreshProfile(): Promise<UserProfile | null> {
  const session = await getCurrentSession();
  if (!session) return null;

  const profile = await fetchUserProfile(session.user_id);
  if (profile) {
    await storeProfile(profile);
  }

  return profile;
}
