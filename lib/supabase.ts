import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { logger } from './logger';
import { storage } from './storage';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// Enhanced debugging for environment variable loading
const isDevelopment = typeof __DEV__ !== 'undefined' && __DEV__;
const envName = process.env.EXPO_PUBLIC_ENVIRONMENT || process.env.NODE_ENV || 'unknown';
try {
  const meta = { 
    hasUrl: !!url, 
    hasAnon: !!anon,
    urlLength: url ? url.length : 0,
    anonLength: anon ? anon.length : 0,
    urlStart: url ? url.substring(0, 25) + '...' : 'MISSING',
    anonStart: anon ? anon.substring(0, 20) + '...' : 'MISSING',
    env: envName,
  };
  if (isDevelopment) {
    logger.debug('Supabase env check', meta);
  } else if (envName === 'preview') {
    // Log minimally in preview to help diagnose missing env in release builds (no secrets)
    console.log('[Supabase] Env summary', meta);
  }
  } catch (e) {
    try { logger.error('Supabase debug error:', e); } catch { /* Logger unavailable */ }
  }

// Use unified storage adapter (handles web/native automatically)
// Web: localStorage, Native: AsyncStorage
const storageAdapter = {
  getItem: (key: string) => storage.getItem(key),
  setItem: (key: string, value: string) => storage.setItem(key, value),
  removeItem: (key: string) => storage.removeItem(key),
};

let client: SupabaseClient | null = null;
if (url && anon) {
  const isWeb = Platform?.OS === 'web';
  
  client = createClient(url, anon, {
    auth: {
      storage: storageAdapter as any,
      // Disable Supabase's internal autoRefresh on web to avoid lock contention with our session manager
      autoRefreshToken: !isWeb,
      persistSession: true,
      detectSessionInUrl: isWeb, // Allow URL detection on web for OAuth callbacks
      storageKey: 'edudash-auth-session',
      flowType: 'pkce', // Use PKCE flow for better security
      debug: process.env.EXPO_PUBLIC_DEBUG_SUPABASE === 'true',
    },
  });
  
  // Suppress excessive GoTrueClient debug logs in development
  if (isDevelopment && typeof global !== 'undefined') {
    const originalConsoleLog = console.log;
    console.log = (...args: any[]) => {
      // Filter out GoTrueClient session management spam
      const msg = args[0];
      if (typeof msg === 'string' && (
        msg.includes('GoTrueClient@') && (
          msg.includes('#_acquireLock') ||
          msg.includes('#__loadSession()') ||
          msg.includes('#_useSession') ||
          msg.includes('#getSession() session from storage')
        )
      )) {
        return; // Suppress
      }
      originalConsoleLog.apply(console, args);
    };
  }

  if (client && isDevelopment) {
    logger.info('Supabase client initialized successfully');
  }

  // Add global error handler for auth errors
  client.auth.onAuthStateChange((event) => {
    if (event === 'TOKEN_REFRESHED') {
      logger.info('Token refreshed successfully');
    } else if (event === 'SIGNED_OUT') {
      logger.info('User signed out');
      // Clear any stale session data
      storage.removeItem('edudash_user_session').catch(() => { /* Intentional: error handled */ });
      storage.removeItem('edudash_user_profile').catch(() => { /* Intentional: error handled */ });
    }
  });
}

// Helper function to assert supabase client exists
export function assertSupabase(): SupabaseClient {
  if (!client) {
    const isDev = typeof __DEV__ !== 'undefined' && __DEV__;
    const isTest = process.env.NODE_ENV === 'test';
    
    if (isDev || isTest) {
      // Development/test environment - show detailed debugging info
      const url = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
      const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
      
      let errorMsg = 'Supabase client not initialized.\n';
      
      if (!url && !anon) {
        errorMsg += 'BOTH environment variables are missing:\n';
        errorMsg += '- EXPO_PUBLIC_SUPABASE_URL\n';
        errorMsg += '- EXPO_PUBLIC_SUPABASE_ANON_KEY\n';
      } else if (!url) {
        errorMsg += 'Missing: EXPO_PUBLIC_SUPABASE_URL\n';
      } else if (!anon) {
        errorMsg += 'Missing: EXPO_PUBLIC_SUPABASE_ANON_KEY\n';
      } else {
        errorMsg += 'Environment variables are present but client failed to initialize.\n';
        errorMsg += `URL length: ${url.length}, Key length: ${anon.length}\n`;
      }
      
      errorMsg += '\nTo fix:\n';
      errorMsg += '1. Check that your .env file exists in the project root\n';
      errorMsg += '2. Restart your development server (Metro/Expo)\n';
      errorMsg += '3. Clear cache: npx expo start --clear\n';
      
      throw new Error(errorMsg);
    } else {
      // Production environment - show user-friendly message
      throw new Error('Unable to connect to the service. Please check your internet connection and try again.');
    }
  }
  return client;
}

export const supabase = client as unknown as SupabaseClient;
