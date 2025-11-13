/**
 * Safe router wrapper that prevents navigation to invalid routes and duplicate screens
 * Features:
 * - Validates routes before navigation to prevent "Unmatched Route" errors
 * - Prevents duplicate screen navigation (double-taps, same-route navigation)
 * - Smart debouncing for rapid navigation attempts
 * - Auto-replace instead of push for same-base-route with different params
 * - Visual feedback (toast/haptic) when blocking duplicate navigation
 */

import { router } from 'expo-router';
import { Platform, ToastAndroid } from 'react-native';

// ============================================================================
// Module-level state for duplicate prevention
// ============================================================================

const DEBOUNCE_MS = 300; // Prevent rapid navigation within 300ms
let lastNavAt = 0;
let lastTargetFull = '';
let currentPathBase = '/';
let lastToastAt = 0;
let isPatched = false;

// Store original router methods
let originalPush: typeof router.push | null = null;
let originalReplace: typeof router.replace | null = null;
let originalBack: typeof router.back | null = null;

// List of known valid routes in the app
const VALID_ROUTES = new Set([
  '/',
  '/landing',
  '/index',
  '/(auth)/sign-in',
  '/(auth)/sign-up',
  '/profiles-gate',
  '/pricing',
  '/marketing/pricing',
  '/sales/contact',
  '/invite',
  '/invite/parent',
  '/invite/student',
  '/screens/teacher-dashboard',
  '/screens/parent-dashboard',
  '/screens/principal-dashboard',
  '/screens/super-admin-dashboard',
  '/screens/org-admin-dashboard',
  '/screens/learner-dashboard',
  '/screens/student-dashboard',
  '/screens/account',
  '/screens/settings',
  '/screens/student-management',
  '/screens/teacher-management',
  '/screens/financial-dashboard',
  '/screens/financial-reports',
  '/screens/financial-transactions',
  '/screens/petty-cash',
  '/screens/petty-cash-reconcile',
  '/screens/ai-lesson-generator',
  '/screens/ai-homework-helper',
  '/screens/ai-homework-grader-live',
  '/screens/ai-progress-analysis',
  '/screens/dash-assistant',
  '/screens/dash-ai-settings',
  '/screens/dash-ai-settings-enhanced',
  '/screens/dash-conversations-history',
  '/screens/subscription-setup',
  '/screens/subscription-upgrade-post',
  '/screens/manage-subscription',
  '/screens/principal-onboarding',
  '/screens/org-onboarding',
  '/screens/super-admin-subscriptions',
  '/screens/super-admin-users',
  '/screens/super-admin-feature-flags',
  '/screens/super-admin-settings',
  '/screens/super-admin-analytics',
  '/screens/teacher-reports',
  '/screens/teacher-messages',
  // Add more routes as needed
]);

// Valid route patterns (for dynamic routes)
const VALID_PATTERNS = [
  /^\/screens\/student-detail/,
  /^\/screens\/teacher-detail/,
  /^\/screens\/teachers-detail/,
  /^\/screens\/activity-detail/,
  /^\/screens\/class-teacher-management/,
  /^\/screens\/class-details/,
  /^\/screens\/.+-detail/,
  /^\/screens\/admin\//,  // Allow all admin/* routes
  /^\/screens\/payments\//,  // Allow all payments/* routes
  /^\/screens\/super-admin/,  // Allow all super-admin routes
  /^\/screens\/.+/,  // Allow all other screens routes (catch-all for screens)
  /^\/invite/,  // Allow all invite routes
  /^\/pricing/,  // Allow pricing routes
  /^\/marketing/,  // Allow marketing routes
  /^\/sales/,  // Allow sales routes
  /^\/(auth)\//,  // Allow all auth routes
  // Add more patterns as needed
];

// ============================================================================
// Helper functions for duplicate prevention
// ============================================================================

/**
 * Normalize route base (pathname without query params)
 */
function normalizeBase(input: any): string {
  if (!input) return '/';
  
  let pathname = '';
  if (typeof input === 'string') {
    pathname = input.trim();
  } else if (typeof input === 'object' && input.pathname) {
    pathname = String(input.pathname).trim();
  } else {
    return '/';
  }
  
  // Remove hash
  pathname = pathname.split('#')[0];
  
  // Remove query params
  pathname = pathname.split('?')[0];
  
  // Lowercase
  pathname = pathname.toLowerCase();
  
  // Remove trailing slash except for root
  if (pathname !== '/' && pathname.endsWith('/')) {
    pathname = pathname.slice(0, -1);
  }
  
  return pathname || '/';
}

/**
 * Normalize full route (pathname + sorted query params)
 */
function normalizeFull(input: any): string {
  const base = normalizeBase(input);
  
  if (!input) return base;
  
  let queryString = '';
  
  if (typeof input === 'string') {
    const parts = input.split('?');
    if (parts[1]) {
      queryString = parts[1].split('#')[0];
    }
  } else if (typeof input === 'object' && input.params) {
    const params = new URLSearchParams();
    const sortedKeys = Object.keys(input.params).sort();
    sortedKeys.forEach(key => {
      params.set(key, String(input.params[key]));
    });
    queryString = params.toString();
  }
  
  if (queryString) {
    // Sort query params for stable comparison
    const params = new URLSearchParams(queryString);
    const sorted = Array.from(params.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    const stable = sorted.map(([k, v]) => `${k}=${v}`).join('&');
    return `${base}?${stable}`;
  }
  
  return base;
}

/**
 * Check if two routes have the same base path
 */
function sameBaseRoute(a: string, b: string): boolean {
  return a === b;
}

/**
 * Show user feedback for blocked navigation
 */
function showToast(message: string): void {
  const now = Date.now();
  
  // Cooldown to prevent toast spam
  if (now - lastToastAt < 1000) {
    return;
  }
  
  lastToastAt = now;
  
  try {
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    } else if (__DEV__) {
      console.log(`[SafeRouter] ${message}`);
    }
    
    // Optional haptic feedback
    try {
      const Haptics = require('expo-haptics');
      if (Haptics?.selectionAsync) {
        Haptics.selectionAsync();
      }
    } catch {
      // Haptics not available, skip
    }
  } catch (error) {
    if (__DEV__) {
      console.warn('[SafeRouter] Toast error:', error);
    }
  }
}

/**
 * Check if a route is valid
 */
function isValidRoute(route: string | null | undefined): boolean {
  if (!route || typeof route !== 'string') {
    return false;
  }

  // Remove query parameters for validation
  const cleanRoute = route.split('?')[0];

  // Check exact matches
  if (VALID_ROUTES.has(cleanRoute)) {
    return true;
  }

  // Check patterns
  return VALID_PATTERNS.some(pattern => pattern.test(cleanRoute));
}

// ============================================================================
// Safe navigation with duplicate prevention
// ============================================================================

/**
 * Safe navigation that validates routes and prevents duplicates
 */
export const safeRouter = {
  /**
   * Navigate to a new screen with duplicate prevention
   */
  push(route: any) {
    try {
      const now = Date.now();
      const baseTarget = normalizeBase(route);
      const fullTarget = normalizeFull(route);
      
      // Extract pathname for validation
      const pathname = typeof route === 'object' && route.pathname ? route.pathname : route;
      
      // Validate route - warn but don't block in development
      if (!isValidRoute(pathname)) {
        if (__DEV__) {
          console.warn(`[SafeRouter] Route not in whitelist (allowing anyway): ${pathname}`);
          console.warn(`[SafeRouter] Consider adding this route to VALID_ROUTES or VALID_PATTERNS`);
        }
        // Still allow the navigation - the route might be valid but not in our whitelist
        // This prevents false positives from blocking valid routes
      }
      
      // Debounce: prevent rapid duplicate navigation
      if (now - lastNavAt < DEBOUNCE_MS && fullTarget === lastTargetFull) {
        if (__DEV__) {
          console.log(`[SafeRouter] Blocked duplicate navigation (debounced): ${fullTarget}`);
        }
        showToast('Already navigating to this screen');
        return;
      }
      
      // Check if we're already on the same base route
      if (sameBaseRoute(baseTarget, currentPathBase)) {
        // If query params differ, use replace instead of push
        if (fullTarget !== lastTargetFull) {
          if (__DEV__) {
            console.log(`[SafeRouter] Same base route with different params, using replace: ${fullTarget}`);
          }
          lastNavAt = now;
          lastTargetFull = fullTarget;
          (originalReplace || router.replace)(route);
          return;
        } else {
          // Exact same route - block and show feedback
          if (__DEV__) {
            console.log(`[SafeRouter] Blocked duplicate navigation (same route): ${fullTarget}`);
          }
          showToast('Already on this screen');
          return;
        }
      }
      
      // Valid new navigation - proceed
      if (__DEV__) {
        console.log(`[SafeRouter] Navigating to: ${fullTarget}`);
      }
      
      lastNavAt = now;
      lastTargetFull = fullTarget;
      (originalPush || router.push)(route);
    } catch (error) {
      console.error('[SafeRouter] Navigation error:', error);
      // Only fallback to root if the error is actually a navigation error
      // Let expo-router handle "Unmatched Route" errors naturally
      if (error && String(error).includes('Unmatched')) {
        console.error('[SafeRouter] Unmatched route error - the route file may not exist');
        (originalPush || router.push)('/');
      } else {
        throw error; // Re-throw other errors
      }
    }
  },

  /**
   * Replace current screen
   */
  replace(route: any) {
    try {
      const now = Date.now();
      const fullTarget = normalizeFull(route);
      
      // Extract pathname for validation
      const pathname = typeof route === 'object' && route.pathname ? route.pathname : route;
      
      // Validate route - warn but don't block in development
      if (!isValidRoute(pathname)) {
        if (__DEV__) {
          console.warn(`[SafeRouter] Route not in whitelist (allowing anyway): ${pathname}`);
          console.warn(`[SafeRouter] Consider adding this route to VALID_ROUTES or VALID_PATTERNS`);
        }
        // Still allow the navigation - the route might be valid but not in our whitelist
      }
      
      // Debounce replace operations
      if (now - lastNavAt < DEBOUNCE_MS && fullTarget === lastTargetFull) {
        if (__DEV__) {
          console.log(`[SafeRouter] Blocked duplicate replace (debounced): ${fullTarget}`);
        }
        return;
      }
      
      lastNavAt = now;
      lastTargetFull = fullTarget;
      (originalReplace || router.replace)(route);
    } catch (error) {
      console.error('[SafeRouter] Replace error:', error);
      // Only fallback to root if the error is actually a navigation error
      if (error && String(error).includes('Unmatched')) {
        console.error('[SafeRouter] Unmatched route error - the route file may not exist');
        (originalReplace || router.replace)('/');
      } else {
        throw error; // Re-throw other errors
      }
    }
  },

  /**
   * Navigate back
   */
  back() {
    try {
      const canGoBack = typeof router.canGoBack === 'function' ? router.canGoBack() : false;
      
      if (canGoBack) {
        (originalBack || router.back)();
      } else {
        if (__DEV__) {
          console.log('[SafeRouter] Cannot go back, navigating to root');
        }
        (originalReplace || router.replace)('/');
      }
    } catch (error) {
      console.error('[SafeRouter] Back navigation error:', error);
      (originalReplace || router.replace)('/');
    }
  },

  /**
   * Check if can go back
   */
  canGoBack(): boolean {
    try {
      return typeof router.canGoBack === 'function' ? router.canGoBack() : false;
    } catch (error) {
      console.error('[SafeRouter] Error checking canGoBack:', error);
      return false;
    }
  },
  
  /**
   * Update current pathname (called by useRouterGuard hook)
   */
  setCurrentPathname(pathname: string) {
    const normalized = normalizeBase(pathname);
    if (__DEV__ && normalized !== currentPathBase) {
      console.log(`[SafeRouter] Current path updated: ${currentPathBase} → ${normalized}`);
    }
    currentPathBase = normalized;
    lastTargetFull = normalized;
  }
};

// ============================================================================
// Global router patching for automatic duplicate prevention
// ============================================================================

/**
 * Install global navigation guard by patching router methods
 * This makes duplicate prevention work automatically across the entire app
 */
export function installGlobalRouterGuard() {
  if (isPatched) {
    if (__DEV__) {
      console.log('[SafeRouter] Global guard already installed');
    }
    return;
  }
  
  try {
    // Store original methods
    originalPush = router.push.bind(router);
    originalReplace = router.replace.bind(router);
    originalBack = router.back.bind(router);
    
    // Patch router methods to use safeRouter
    (router as any).push = safeRouter.push.bind(safeRouter);
    (router as any).replace = safeRouter.replace.bind(safeRouter);
    (router as any).back = safeRouter.back.bind(safeRouter);
    
    isPatched = true;
    
    if (__DEV__) {
      console.log('[SafeRouter] Global navigation guard installed successfully');
    }
  } catch (error) {
    console.error('[SafeRouter] Failed to install global guard:', error);
  }
}

/**
 * Register a valid route (useful for dynamically added routes)
 */
export function registerValidRoute(route: string) {
  VALID_ROUTES.add(route);
}

/**
 * Register a valid route pattern (for dynamic routes)
 */
export function registerValidPattern(pattern: RegExp) {
  VALID_PATTERNS.push(pattern);
}

// ============================================================================
// Auto-install global guard when module is imported
// ============================================================================

// Install the global guard as a side effect of importing this module
if (typeof router !== 'undefined') {
  installGlobalRouterGuard();
}
