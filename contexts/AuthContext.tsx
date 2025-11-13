import { logger } from '@/lib/logger';
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as Sentry from 'sentry-expo';
import { assertSupabase } from '@/lib/supabase';
import { getPostHog } from '@/lib/posthogClient';
import { track } from '@/lib/analytics';
import { Platform } from 'react-native';
import { routeAfterLogin } from '@/lib/routeAfterLogin';
import { useQueryClient } from '@tanstack/react-query';
import { 
  fetchEnhancedUserProfile, 
  createPermissionChecker,
  createEnhancedProfile,
  type EnhancedUserProfile,
  type PermissionChecker
} from '@/lib/rbac';
import { initializeSession, signOut } from '@/lib/sessionManager';
import { router } from 'expo-router';
import { securityAuditor } from '@/lib/security-audit';
import { initializeVisibilityHandler, destroyVisibilityHandler } from '@/lib/visibilityHandler';

export type AuthContextValue = {
  user: import('@supabase/supabase-js').User | null;
  session: import('@supabase/supabase-js').Session | null;
  profile: EnhancedUserProfile | null;
  permissions: PermissionChecker;
  loading: boolean;
  profileLoading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  profile: null,
  permissions: createPermissionChecker(null),
  loading: true,
  profileLoading: false,
  refreshProfile: async () => {},
  signOut: async () => {},
});

function toEnhancedProfile(p: any | null): EnhancedUserProfile | null {
  if (!p) return null;
  
  // If already an enhanced profile, return as is
  if (typeof p.hasRole === 'function' && typeof p.hasCapability === 'function') {
    return p as EnhancedUserProfile;
  }
  
  // Create enhanced profile using the same logic as createEnhancedProfile
  const baseProfile = {
    id: p.id,
    email: p.email,
    role: p.role,
    first_name: p.first_name,
    last_name: p.last_name,
    avatar_url: p.avatar_url,
    organization_id: p.organization_id,
    organization_name: p.organization_name,
    seat_status: p.seat_status || 'active',
    capabilities: p.capabilities || [],
    created_at: p.created_at,
    last_login_at: p.last_login_at,
  } as any;
  
  // Use createEnhancedProfile from rbac to ensure all methods are attached
  return createEnhancedProfile(baseProfile, {
    organization_id: p.organization_id,
    organization_name: p.organization_name,
    plan_tier: p.plan_tier || 'free',
    seat_status: p.seat_status || 'active',
    invited_by: p.invited_by,
    created_at: p.created_at,
  });
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthContextValue['user']>(null);
  const [session, setSession] = useState<AuthContextValue['session']>(null);
  const [profile, setProfile] = useState<EnhancedUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [permissions, setPermissions] = useState<PermissionChecker>(createPermissionChecker(null));
  const [lastRefreshAttempt, setLastRefreshAttempt] = useState<number>(0);

  // Fetch enhanced user profile
  const fetchProfile = useCallback(async (userId: string) => {
    try {
      setProfileLoading(true);
      const enhancedProfile = await fetchEnhancedUserProfile(userId);
      setProfile(enhancedProfile);
      setPermissions(createPermissionChecker(enhancedProfile));
      
      // Track profile load
      track('edudash.auth.profile_loaded', {
        user_id: userId,
        has_profile: !!enhancedProfile,
        role: enhancedProfile?.role,
        capabilities_count: enhancedProfile?.capabilities?.length || 0,
      });
      
      return enhancedProfile;
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
      setProfile(null);
      setPermissions(createPermissionChecker(null));
      return null;
    } finally {
      setProfileLoading(false);
    }
  }, []);

  // Refresh profile (useful when permissions change)
  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      await fetchProfile(user.id);
    }
  }, [user?.id]);

  // NO-OP refresh handler for web - prevents infinite loading loops
  const handleVisibilityRefresh = useCallback(async () => {
    // For web, we completely disable session refresh on visibility changes
    // This prevents the infinite loading state when switching browser tabs
    const now = Date.now();
    
    // Only log the visibility event, don't do anything else
    logger.info('[Auth] Tab visibility changed (refresh disabled for web stability)');
    
    // Track for analytics but don't refresh anything
    track('auth.tab_visibility_change', {
      platform: Platform.OS,
      timestamp: new Date().toISOString(),
    });
    
    // Don't check session, don't refresh profile - just continue where user left off
  }, []);

  // Enhanced sign out with cache clearing and browser history management
  const handleSignOut = useCallback(async () => {
    try {
      console.log('[AuthContext] Starting sign-out process...');
      
      // Security audit for logout
      if (user?.id) {
        securityAuditor.auditAuthenticationEvent(user.id, 'logout', {
          role: profile?.role,
          session_duration: session ? Date.now() - (session.user.created_at ? new Date(session.user.created_at).getTime() : Date.now()) : null,
        });
      }
      
      // Clear all state immediately to prevent stale data
      console.log('[AuthContext] Clearing auth state...');
      setUser(null);
      setSession(null);
      setProfile(null);
      setPermissions(createPermissionChecker(null));
      setProfileLoading(false);
      
      // Clear TanStack Query cache to prevent stale data flash
      try {
        console.log('[AuthContext] Clearing TanStack Query cache...');
        queryClient.clear();
        console.log('[AuthContext] Query cache cleared successfully');
      } catch (cacheErr) {
        console.warn('[AuthContext] Query cache clear failed:', cacheErr);
      }
      
      // Call sessionManager sign out (this clears storage and Supabase session)
      await signOut();
      
      // Clear PostHog and Sentry
      try {
        await getPostHog()?.reset();
        console.log('[AuthContext] PostHog reset completed');
      } catch (e) {
        console.warn('[AuthContext] PostHog reset failed:', e);
      }
      
      try {
        Sentry.Native.setUser(null as any);
        console.log('[AuthContext] Sentry user cleared');
      } catch (e) {
        console.warn('[AuthContext] Sentry clear user failed:', e);
      }
      
      console.log('[AuthContext] Sign-out completed successfully');
      
      // Navigate to sign-in screen using replace (no back navigation)
      try {
        // Web-only: Clear browser history to prevent back button to protected routes
        if (Platform.OS === 'web') {
          try {
            const w = globalThis as any;
            // Clear all history and navigate to sign-in with a fresh history stack
            // This prevents back button from accessing protected pages
            if (w?.location) {
              // Use location.replace to completely replace history entry
              w.location.replace('/(auth)/sign-in');
              console.log('[AuthContext] Browser navigated to sign-in with history cleared');
            } else {
              // Fallback to router if location is not available
              router.replace('/(auth)/sign-in');
            }
          } catch (historyErr) {
            console.warn('[AuthContext] Browser history manipulation failed:', historyErr);
            router.replace('/(auth)/sign-in');
          }
        } else {
          // Mobile: use router replace
          router.replace('/(auth)/sign-in');
        }
      } catch (navErr) {
        console.error('[AuthContext] Navigation to sign-in failed:', navErr);
        try { router.replace('/sign-in'); } catch { /* Intentional: non-fatal */ }
      }
    } catch (error) {
      console.error('[AuthContext] Sign out failed:', error);
      
      // Even if sign-out fails, clear local state to prevent UI issues
      setUser(null);
      setSession(null);
      setProfile(null);
      setPermissions(createPermissionChecker(null));
      
      // Clear query cache even on error
      try {
        queryClient.clear();
      } catch { /* Intentional: non-fatal */ }
      
      // Security audit for failed logout
      if (user?.id) {
        securityAuditor.auditAuthenticationEvent(user.id, 'auth_failure', {
          action: 'logout',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
      
      // Still try to navigate even if there was an error
      try {
        // Web-only: Clear browser history even on error
        if (Platform.OS === 'web') {
          try {
            const w = globalThis as any;
            if (w?.location) {
              w.location.replace('/(auth)/sign-in');
            } else {
              router.replace('/(auth)/sign-in');
            }
          } catch { 
            router.replace('/(auth)/sign-in');
          }
        } else {
          router.replace('/(auth)/sign-in');
        }
      } catch (navErr) {
        console.error('[AuthContext] Navigation to sign-in failed:', navErr);
        try { router.replace('/sign-in'); } catch { /* Intentional: non-fatal */ }
      }
    }
  }, [user?.id, profile?.role, session, queryClient]);

  useEffect(() => {
    let unsub: { subscription?: { unsubscribe: () => void } } | null = null;
    let mounted = true;

    // Define a local fetch function to avoid dependency issues
    const fetchProfileLocal = async (userId: string) => {
      if (!mounted) return null;
      try {
        setProfileLoading(true);
        const enhancedProfile = await fetchEnhancedUserProfile(userId);
        if (mounted) {
          setProfile(enhancedProfile);
          setPermissions(createPermissionChecker(enhancedProfile));
          
          // Track profile load
          track('edudash.auth.profile_loaded', {
            user_id: userId,
            has_profile: !!enhancedProfile,
            role: enhancedProfile?.role,
            capabilities_count: enhancedProfile?.capabilities?.length || 0,
          });
          
          // Security audit for authentication
          if (enhancedProfile) {
            securityAuditor.auditAuthenticationEvent(userId, 'login', {
              role: enhancedProfile.role,
              organization: enhancedProfile.organization_id,
              capabilities_count: enhancedProfile.capabilities?.length || 0,
            });
          }
        }
        return enhancedProfile;
      } catch (error) {
        console.error('Failed to fetch user profile:', error);
        if (mounted) {
          setProfile(null);
          setPermissions(createPermissionChecker(null));
        }
        return null;
      } finally {
        if (mounted) {
          setProfileLoading(false);
        }
      }
    };

    // Theme fix: ensure theme provider doesn't flicker on refresh
    try {
      const root = (globalThis as any)?.document?.documentElement;
      if (root && typeof (globalThis as any).matchMedia === 'function') {
        const prefersDark = (globalThis as any).matchMedia('(prefers-color-scheme: dark)')?.matches;
        if (prefersDark) root.classList.add('dark'); else root.classList.remove('dark');
      }
    } catch { /* Intentional: non-fatal */ }

    (async () => {
      try {
        // Initialize session from storage first
        const { session: storedSession, profile: storedProfile } = await initializeSession();
        
        // Debug session restoration
        console.log('=== SESSION RESTORATION DEBUG ===');
        console.log('Stored session exists:', !!storedSession);
        console.log('Stored profile exists:', !!storedProfile);
        if (storedSession) {
          console.log('Session user_id:', storedSession.user_id);
          console.log('Session email:', storedSession.email);
          console.log('Session expires_at:', new Date(storedSession.expires_at * 1000).toISOString());
        }
        if (storedProfile) {
          console.log('Profile role:', storedProfile.role);
          console.log('Profile org_id:', storedProfile.organization_id);
          console.log('Profile email:', storedProfile.email);
        }
        console.log('================================');
        
        if (storedSession && storedProfile && mounted) {
          setSession({ 
            access_token: storedSession.access_token, 
            refresh_token: storedSession.refresh_token, 
            expires_at: storedSession.expires_at,
            user: { id: storedSession.user_id, email: storedSession.email } 
          } as any);
          setUser({ id: storedSession.user_id, email: storedSession.email } as any);
          const enhanced = toEnhancedProfile(storedProfile as any);
          setProfile(enhanced);
          setPermissions(createPermissionChecker(enhanced));
        }

        // Get current auth session
        const client = assertSupabase();
        const { data } = await client.auth.getSession();
        if (mounted) {
          setSession(data.session ?? null);
          setUser(data.session?.user ?? null);
        }

        // Always refresh profile on boot to avoid stale cached roles
        let currentProfile: EnhancedUserProfile | null = storedProfile as any;
        if (data.session?.user && mounted) {
          try {
            const fresh = await fetchProfileLocal(data.session.user.id);
            if (fresh) currentProfile = fresh;
          } catch (e) {
            logger.debug('Initial profile refresh failed', e);
          }
        }

        // If there's a session, identify in monitoring tools
        if (data.session?.user && mounted) {
          try {
            const ph = getPostHog();
            const phProps: Record<string, any> = {
              ...(data.session.user.email ? { email: data.session.user.email } : {}),
              ...(currentProfile?.role ? { role: currentProfile.role } : {}),
              ...(currentProfile?.organization_id ? { organization_id: currentProfile.organization_id } : {}),
              ...(currentProfile?.organization_membership?.plan_tier ? { plan_tier: currentProfile.organization_membership.plan_tier } : {}),
            };
            ph?.identify(data.session.user.id, phProps);
          } catch (e) {
            logger.debug('PostHog identify failed', e);
          }
          try {
            Sentry.Native.setUser({ 
              id: data.session.user.id, 
              email: data.session.user.email || undefined 
            } as any);
          } catch (e) {
            logger.debug('Sentry setUser failed', e);
          }
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }

      // COMPLETELY DISABLE visibility handler for web to prevent loading loops
      // The issue is that ANY session check triggers Supabase's internal refresh mechanism
      try {
        const isWeb = Platform.OS === 'web';
        
        if (isWeb) {
          // For web: ONLY track visibility, never refresh session
          logger.info('[Visibility] Web visibility tracking enabled (NO auto-refresh)');
          initializeVisibilityHandler({
            onVisibilityChange: (isVisible) => {
              if (isVisible && mounted) {
                // Just track, don't check session
                track('auth.tab_focused', {
                  platform: 'web',
                  timestamp: new Date().toISOString(),
                });
              }
            },
            // No onSessionRefresh - this is the key fix
          });
        } else {
          // Mobile platforms can use full refresh logic
          logger.info('[Visibility] Initializing visibility handler for mobile platform');
          initializeVisibilityHandler({
            onSessionRefresh: async () => {
              const now = Date.now();
              if (now - lastRefreshAttempt < 5000) return;
              
              setLastRefreshAttempt(now);
              try {
                const { data: { session: currentSession } } = await assertSupabase().auth.getSession();
                if (currentSession && mounted) {
                  setSession(currentSession);
                  setUser(currentSession.user);
                  
                  const enhancedProfile = await fetchEnhancedUserProfile(currentSession.user.id);
                  if (enhancedProfile && mounted) {
                    setProfile(enhancedProfile);
                    setPermissions(createPermissionChecker(enhancedProfile));
                  }
                }
              } catch (error) {
                console.error('[Visibility] Mobile refresh failed:', error);
              }
            },
            onVisibilityChange: (isVisible) => {
              if (isVisible && mounted) {
                track('auth.tab_focused', {
                  platform: 'mobile',
                  timestamp: new Date().toISOString(),
                });
              }
            },
            refreshDelay: 1000,
          });
        }
      } catch (e) {
        logger.debug('[Visibility] Handler initialization failed', e);
      }

      // Subscribe to auth changes
      const { data: listener } = assertSupabase().auth.onAuthStateChange(async (event, s) => {
        if (!mounted) return;
        
        setSession(s ?? null);
        setUser(s?.user ?? null);

        try {
          if (event === 'SIGNED_IN' && s?.user) {
            // Fetch enhanced profile on sign in
            const enhancedProfile = await fetchProfileLocal(s.user.id);

            // Best-effort: update last_login_at via RPC for OAuth and external flows
            try {
              await assertSupabase().rpc('update_user_last_login');
            } catch (e) {
              logger.debug('update_user_last_login RPC failed (non-blocking)', e);
            }

            // Register or update push token (best-effort)
            try {
              const { registerPushDevice } = await import('@/lib/notifications');
              const result = await registerPushDevice(assertSupabase(), s.user);
              
              // Log result for debugging (no sensitive data)
              if (result.status === 'error') {
                logger.debug('Push registration failed:', result.reason);
              } else if (result.status === 'denied') {
                logger.debug('Push permissions denied');
                // Could surface a non-blocking UI hint here in the future
              } else if (result.status === 'registered') {
                logger.debug('Push registration successful');
              }
            } catch (e) {
              logger.debug('Push registration exception:', e);
            }
            
            // Identify in monitoring tools
            if (mounted) {
              try {
                const ph = getPostHog();
                const phProps: Record<string, any> = {
                  ...(s.user.email ? { email: s.user.email } : {}),
                  ...(enhancedProfile?.role ? { role: enhancedProfile.role } : {}),
                  ...(enhancedProfile?.organization_id ? { organization_id: enhancedProfile.organization_id } : {}),
                  ...(enhancedProfile?.organization_membership?.plan_tier ? { plan_tier: enhancedProfile.organization_membership.plan_tier } : {}),
                };
                ph?.identify(s.user.id, phProps);
              } catch (e) {
                logger.debug('PostHog identify (auth change) failed', e);
              }
              try {
                Sentry.Native.setUser({ 
                  id: s.user.id, 
                  email: s.user.email || undefined 
                } as any);
              } catch (e) {
                logger.debug('Sentry setUser (auth change) failed', e);
              }

              track('edudash.auth.signed_in', {
                user_id: s.user.id,
                role: enhancedProfile?.role,
              });

              // Route user after successful sign in
              try {
                await routeAfterLogin(s.user, enhancedProfile);
              } catch (error) {
                console.error('Post-login routing failed:', error);
              }
            }
          }

          if (event === 'SIGNED_OUT' && mounted) {
            console.log('[AuthContext] SIGNED_OUT event received, clearing all auth state');
            setProfile(null);
            setPermissions(createPermissionChecker(null));
            setUser(null);
            setSession(null);
            setProfileLoading(false);
            
            // Deregister push device
            try {
              const { deregisterPushDevice } = await import('@/lib/notifications');
              await deregisterPushDevice(assertSupabase(), { id: s?.user?.id || user?.id });
            } catch (e) {
              logger.debug('Push deregistration failed', e);
            }
            
            try { await getPostHog()?.reset(); } catch (e) { logger.debug('PostHog reset failed', e); }
            try { Sentry.Native.setUser(null as any); } catch (e) { logger.debug('Sentry clear user failed', e); }
            
            track('edudash.auth.signed_out', {});

            // Non-blocking toast to confirm sign-out
            try {
              const { toast } = await import('@/components/ui/ToastProvider');
              toast.success('You have been signed out');
            } catch (e) {
              logger.debug('Toast on sign-out failed (non-blocking)', e);
            }
            
            // Don't navigate here - let signOutAndRedirect handle navigation
            // This prevents conflicting navigation calls
            console.log('[AuthContext] Sign-out cleanup complete, navigation handled by signOutAndRedirect');
          }
        } catch (error) {
          console.error('Auth state change handler error:', error);
        }
      });
      unsub = listener;
    })();

    return () => {
      mounted = false;
      try { unsub?.subscription?.unsubscribe(); } catch (e) { logger.debug('Auth listener unsubscribe failed', e); }
      try { destroyVisibilityHandler(); } catch (e) { logger.debug('Visibility handler cleanup failed', e); }
    };
  }, []);

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      profile,
      permissions,
      loading, 
      profileLoading,
      refreshProfile,
      signOut: handleSignOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

// Convenience hooks for common permission checks
export function usePermissions(): PermissionChecker {
  const { permissions } = useAuth();
  return permissions;
}

export function useUserProfile(): EnhancedUserProfile | null {
  const { profile } = useAuth();
  return profile;
}
