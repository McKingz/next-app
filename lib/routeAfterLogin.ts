import { assertSupabase } from '@/lib/supabase';
import { router } from 'expo-router';
import { track } from '@/lib/analytics';
import { reportError } from '@/lib/monitoring';
import { fetchEnhancedUserProfile, type EnhancedUserProfile, type Role } from '@/lib/rbac';
import type { User } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

// Optional AsyncStorage for bridging plan selection across auth (no-op on web)
let AsyncStorage: any = null;
try { AsyncStorage = require('@react-native-async-storage/async-storage').default; } catch (e) { /* noop */ }

function normalizeRole(r?: string | null): string | null {
  if (!r) return null;
  const s = String(r).trim().toLowerCase();
  
  // Map potential variants to canonical Role types
  if (s.includes('super') || s === 'superadmin') return 'super_admin';
  if (s === 'principal' || s.includes('principal') || s === 'admin' || s.includes('school admin')) return 'principal_admin';
  if (s.includes('teacher')) return 'teacher';
  if (s.includes('parent')) return 'parent';
  if (s.includes('student') || s.includes('learner')) return 'student';
  
  // Handle exact matches for the canonical types
  if (['super_admin', 'principal_admin', 'teacher', 'parent', 'student'].includes(s)) {
    return s;
  }
  
  console.warn('Unrecognized role:', r, '-> normalized to null');
  return null; // Default to null so we can route to sign-in/profile setup
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use fetchEnhancedUserProfile from RBAC instead
 */
export async function detectRoleAndSchool(user?: User | null): Promise<{ role: string | null; school: string | null }> {
  // Use provided user or fetch from auth
  let authUser = user;
  if (!authUser) {
    const { data: { user: fetchedUser } } = await assertSupabase().auth.getUser();
    authUser = fetchedUser;
  }
  
  const id = authUser?.id;
  let role: string | null = normalizeRole((authUser?.user_metadata as any)?.role ?? null);
  let school: string | null = (authUser?.user_metadata as any)?.preschool_id ?? null;

  // First fallback: check profiles table by id (auth.users.id)
  if (id && (!role || school === null)) {
    try {
      const { data: udata, error: uerror } = await assertSupabase()
        .from('profiles')
        .select('role,preschool_id')
        .eq('id', id)
        .maybeSingle();
      if (!uerror && udata) {
        role = normalizeRole((udata as any).role ?? role);
        school = (udata as any).preschool_id ?? school;
      }
    } catch (e) {
      console.debug('Fallback #1 (profiles table) lookup failed', e);
    }
  }
  
  // Second fallback removed:
  // Some deployments used a legacy 'user_id' column in profiles. Referencing it causes 400 errors
  // on databases that never had that column. To avoid noisy logs and failed requests, we rely solely
  // on the primary key lookup above (id = auth.users.id). If you need legacy support, consider a
  // dedicated RPC that handles both shapes server-side.
  // if (id && (!role || school === null)) { ... }
  return { role, school };
}

/**
 * Enhanced post-login routing with comprehensive RBAC integration
 * Routes users to appropriate dashboard based on their role, capabilities, and organization membership
 */
export async function routeAfterLogin(user?: User | null, profile?: EnhancedUserProfile | null) {
  try {
    const userId = user?.id;
    if (!userId) {
      console.error('No user ID provided for post-login routing');
      router.replace('/(auth)/sign-in');
      return;
    }

    // Fetch enhanced profile if not provided or if the provided profile is not enhanced
    let enhancedProfile = profile as any;
    const needsEnhanced = !enhancedProfile || typeof enhancedProfile.hasCapability !== 'function';
    if (needsEnhanced) {
      console.log('[ROUTE DEBUG] Fetching enhanced profile for user:', userId);
      
      // Add timeout protection to prevent infinite hanging
      const fetchPromise = fetchEnhancedUserProfile(userId);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Profile fetch timeout')), 10000)
      );
      
      try {
        enhancedProfile = await Promise.race([fetchPromise, timeoutPromise]) as any;
        console.log('[ROUTE DEBUG] fetchEnhancedUserProfile result:', enhancedProfile ? 'SUCCESS' : 'NULL');
        if (enhancedProfile) {
          console.log('[ROUTE DEBUG] Profile role:', enhancedProfile.role);
          console.log('[ROUTE DEBUG] Profile org_id:', enhancedProfile.organization_id);
        }
      } catch (fetchError) {
        console.error('[ROUTE DEBUG] Profile fetch failed:', fetchError);
        enhancedProfile = null;
      }
    }

    if (!enhancedProfile) {
      console.error('Failed to fetch user profile for routing - routing to profiles-gate for setup');
      track('edudash.auth.route_failed', {
        user_id: userId,
        reason: 'no_profile',
      });
      // Route to profiles-gate instead of sign-in to avoid redirect loop
      // User is authenticated but needs profile setup
      router.replace('/profiles-gate');
      return;
    }

    // If there is a pending plan selection (from unauthenticated plan click),
    // prioritize routing to subscription setup and auto-start checkout.
    try {
      const raw = await AsyncStorage?.getItem('pending_plan_selection');
      if (raw) {
        await AsyncStorage?.removeItem('pending_plan_selection');
        try {
          const pending = JSON.parse(raw);
          const planTier = pending?.planTier;
          const billing = pending?.billing === 'annual' ? 'annual' : 'monthly';
          if (planTier) {
            track('edudash.auth.bridge_to_checkout', {
              user_id: userId,
              plan_tier: planTier,
              billing,
            });
            router.replace({
              pathname: '/screens/subscription-setup' as any,
              params: { planId: String(planTier), billing, auto: '1' },
            } as any);
            return;
          }
        } catch {
          // ignore JSON parse errors
        }
      }
    } catch {
      // best-effort only
    }

    // Determine route based on enhanced profile
    const route = determineUserRoute(enhancedProfile);
    
    // Track routing decision
    track('edudash.auth.route_after_login', {
      user_id: userId,
      role: enhancedProfile.role,
      organization_id: enhancedProfile.organization_id,
      seat_status: enhancedProfile.seat_status,
      plan_tier: enhancedProfile.organization_membership?.plan_tier,
      route: route.path,
      has_params: !!route.params,
    });

    // Prevent concurrent navigation attempts
    const navLock = 'route_after_login_' + userId;
    if (typeof window !== 'undefined' && (window as any)[navLock]) {
      console.log('🚦 [ROUTE] Navigation already in progress, skipping');
      return;
    }
    
    // Set navigation lock and dashboard switching flag
    if (typeof window !== 'undefined') {
      (window as any)[navLock] = true;
      (window as any).dashboardSwitching = true;
    }
    
    // Navigate to determined route (with params if needed)
    if (process.env.EXPO_PUBLIC_ENABLE_CONSOLE === 'true') {
      console.log('🚦 [ROUTE] Navigating to route:', route);
    }
    
    try {
      // Use setTimeout to prevent blocking the UI thread
      setTimeout(() => {
        try {
          if (route.params) {
            if (process.env.EXPO_PUBLIC_ENABLE_CONSOLE === 'true') {
              console.log('🚦 [ROUTE] Using router.replace with params:', { pathname: route.path, params: route.params });
            }
            router.replace({ pathname: route.path as any, params: route.params } as any);
          } else {
            if (process.env.EXPO_PUBLIC_ENABLE_CONSOLE === 'true') {
              console.log('🚦 [ROUTE] Using router.replace without params:', route.path);
            }
            router.replace(route.path as any);
          }
          
          if (process.env.EXPO_PUBLIC_ENABLE_CONSOLE === 'true') {
            console.log('🚦 [ROUTE] router.replace call completed successfully');
          }
        } catch (navigationError) {
          console.error('🚦 [ROUTE] Navigation failed, falling back to profiles-gate:', navigationError);
          // Fallback to profile gate to ensure user can access the app
          router.replace('/profiles-gate');
        } finally {
          // Clear locks after navigation
          setTimeout(() => {
            if (typeof window !== 'undefined') {
              delete (window as any)[navLock];
              delete (window as any).dashboardSwitching;
            }
          }, 1000);
        }
      }, 50);
    } catch (error) {
      console.error('🚦 [ROUTE] Unexpected error during navigation setup:', error);
      // Clear locks on error
      if (typeof window !== 'undefined') {
        delete (window as any)[navLock];
        delete (window as any).dashboardSwitching;
      }
      throw error;
    }
  } catch (error) {
    reportError(new Error('Post-login routing failed'), {
      userId: user?.id,
      error,
    });
    
    // Fallback to safe route
    router.replace('/(auth)/sign-in');
  }
}

/**
 * Determine the appropriate route for a user based on their enhanced profile
 */
function determineUserRoute(profile: EnhancedUserProfile): { path: string; params?: Record<string, string> } {
  let role = normalizeRole(profile.role);
  
  console.log('[ROUTE DEBUG] ==> Determining route for user');
  console.log('[ROUTE DEBUG] Original role:', profile.role, '-> normalized:', role);
  console.log('[ROUTE DEBUG] Profile organization_id:', profile.organization_id);
  console.log('[ROUTE DEBUG] Profile seat_status:', profile.seat_status);
  console.log('[ROUTE DEBUG] Profile capabilities:', profile.capabilities);
  console.log('[ROUTE DEBUG] Profile hasCapability(access_mobile_app):', profile.hasCapability('access_mobile_app'));
  
  // Tenant kind detection (best-effort)
  const orgKind = (profile as any)?.organization_membership?.organization_kind
    || (profile as any)?.organization_kind
    || (profile as any)?.tenant_kind
    || 'school'; // default
  const isSkillsLike = ['skills', 'tertiary', 'org'].includes(String(orgKind).toLowerCase());
  
  if (process.env.EXPO_PUBLIC_ENABLE_CONSOLE === 'true') {
    console.log('[ROUTE DEBUG] ==> Determining route for user');
    console.log('[ROUTE DEBUG] Original role:', profile.role, '-> normalized:', role);
    console.log('[ROUTE DEBUG] Profile organization_id:', profile.organization_id);
    console.log('[ROUTE DEBUG] Profile seat_status:', profile.seat_status);
    console.log('[ROUTE DEBUG] Profile capabilities:', profile.capabilities);
    console.log('[ROUTE DEBUG] Profile hasCapability(access_mobile_app):', profile.hasCapability('access_mobile_app'));
  }
  
  // Safeguard: If role is null/undefined, route to sign-in/profile setup
  if (!role || role === null) {
    console.warn('User role is null, routing to sign-in');
    return { path: '/(auth)/sign-in' };
  }
  
  // Check if user has active access
  if (!profile.hasCapability('access_mobile_app')) {
    console.log('[ROUTE DEBUG] User lacks access_mobile_app capability');
    
    // For teachers, be more permissive - allow them to access their dashboard
    // even if they don't have the general mobile app capability
    if (role !== 'teacher') {
      return { path: '/screens/account' }; // Route to account settings to resolve access issues
    } else {
      console.log('[ROUTE DEBUG] Teacher without mobile app capability - allowing dashboard access');
    }
  }

  // Route based on role and tenant kind
  switch (role) {
    case 'super_admin':
      return { path: '/screens/super-admin-dashboard' };
    
    case 'principal_admin':
      console.log('[ROUTE DEBUG] Principal admin routing - organization_id:', profile.organization_id);
      console.log('[ROUTE DEBUG] Principal seat_status:', profile.seat_status);
      if (isSkillsLike) {
        return { path: '/screens/org-admin-dashboard' };
      }
      return { path: '/screens/principal-dashboard' };

    case 'teacher':
      return { path: '/screens/teacher-dashboard' };

    case 'parent':
      return { path: '/screens/parent-dashboard' };

    case 'student':
      if (isSkillsLike) {
        return { path: '/screens/learner-dashboard' };
      }
      return { path: '/screens/student-dashboard' };
  }

  // Default fallback
  return { path: '/' };
}

/**
 * Check if user has valid access to the mobile app
 */
export function validateUserAccess(profile: EnhancedUserProfile | null): {
  hasAccess: boolean;
  reason?: string;
  suggestedAction?: string;
} {
  if (!profile) {
    return {
      hasAccess: false,
      reason: 'No user profile found',
      suggestedAction: 'Complete your profile setup',
    };
  }

  if (!profile.hasCapability('access_mobile_app')) {
    return {
      hasAccess: false,
      reason: 'Mobile app access not enabled',
      suggestedAction: 'Contact your administrator',
    };
  }

  // Check seat-based access for non-admin roles
  const role = normalizeRole(profile.role) as Role;
  if (role === 'teacher') {
    // Allow access for all current statuses per type definition
  }

  return { hasAccess: true };
}

/**
 * Get the appropriate route path for a given role (without navigation)
 */
export function getRouteForRole(role: Role | string | null): string {
  const normalizedRole = normalizeRole(role as string);
  
  switch (normalizedRole) {
    case 'super_admin':
      return '/screens/super-admin-dashboard';
    case 'principal_admin':
      return '/screens/principal-dashboard';
    case 'teacher':
      return '/screens/teacher-dashboard';
    case 'parent':
      return '/screens/parent-dashboard';
    default:
      return '/landing';
  }
}

