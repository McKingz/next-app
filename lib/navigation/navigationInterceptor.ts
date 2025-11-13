/**
 * Navigation Error Interceptor
 * 
 * This interceptor catches navigation errors and prevents "Unmatched Route" issues
 * by providing fallback routes and error handling.
 */

import { router } from 'expo-router';

// Known problematic routes or patterns that should be redirected
const PROBLEMATIC_ROUTES = new Set([
  '',
  null,
  undefined,
  'null',
  'undefined',
  '/null',
  '/undefined',
]);

// Route mappings for common issues
const ROUTE_CORRECTIONS = new Map([
  ['/tabs/dashboard', '/screens/parent-dashboard'],
  ['/dashboard', '/'],
  ['/screens/dashboard', '/'],
  ['/screens/', '/'],
  ['screens/', '/'],
]);

/**
 * Clean and validate a route before navigation
 */
function cleanRoute(route: any): string | null {
  // Handle null/undefined
  if (!route) {
    return null;
  }

  // Convert to string
  let cleanedRoute = String(route).trim();

  // Handle object-based routes
  if (typeof route === 'object' && route.pathname) {
    cleanedRoute = String(route.pathname).trim();
  }

  // Check for problematic routes
  if (PROBLEMATIC_ROUTES.has(cleanedRoute)) {
    return null;
  }

  // Apply route corrections
  if (ROUTE_CORRECTIONS.has(cleanedRoute)) {
    cleanedRoute = ROUTE_CORRECTIONS.get(cleanedRoute)!;
  }

  // Remove double slashes
  cleanedRoute = cleanedRoute.replace(/\/+/g, '/');

  // Ensure it starts with /
  if (cleanedRoute && !cleanedRoute.startsWith('/')) {
    cleanedRoute = '/' + cleanedRoute;
  }

  // Remove trailing slash (except for root)
  if (cleanedRoute !== '/' && cleanedRoute.endsWith('/')) {
    cleanedRoute = cleanedRoute.slice(0, -1);
  }

  return cleanedRoute || null;
}

/**
 * Get a safe fallback route based on context
 */
function getSafeFallback(): string {
  try {
    // Try to determine user context from localStorage/sessionStorage
    if (typeof window !== 'undefined') {
      const userRole = localStorage.getItem('userRole') || sessionStorage.getItem('userRole');
      
      switch (userRole) {
        case 'super_admin':
          return '/screens/super-admin-dashboard';
        case 'principal_admin':
          return '/screens/principal-dashboard';
        case 'teacher':
          return '/screens/teacher-dashboard';
        case 'parent':
          return '/screens/parent-dashboard';
        default:
          return '/';
      }
    }
  } catch (error) {
    console.debug('Could not determine user context for fallback:', error);
  }

  return '/';
}

/**
 * Safe navigation wrapper that intercepts and handles errors
 */
export const interceptedRouter = {
  push(route: any) {
    try {
      const cleanedRoute = cleanRoute(route);
      
      if (!cleanedRoute) {
        console.warn('[NavInterceptor] Invalid route, using fallback:', route);
        const fallback = getSafeFallback();
        return router.push(fallback as any);
      }

      // For object-based routes, reconstruct the object
      if (typeof route === 'object' && route.pathname) {
        return router.push({
          ...route,
          pathname: cleanedRoute,
        });
      }

      return router.push(cleanedRoute as any);
    } catch (error) {
      console.error('[NavInterceptor] Push failed:', error, 'for route:', route);
      const fallback = getSafeFallback();
      router.push(fallback as any);
    }
  },

  replace(route: any) {
    try {
      const cleanedRoute = cleanRoute(route);
      
      if (!cleanedRoute) {
        console.warn('[NavInterceptor] Invalid route, using fallback:', route);
        const fallback = getSafeFallback();
        return router.replace(fallback as any);
      }

      // For object-based routes, reconstruct the object
      if (typeof route === 'object' && route.pathname) {
        return router.replace({
          ...route,
          pathname: cleanedRoute,
        });
      }

      return router.replace(cleanedRoute as any);
    } catch (error) {
      console.error('[NavInterceptor] Replace failed:', error, 'for route:', route);
      const fallback = getSafeFallback();
      router.replace(fallback as any);
    }
  },

  back() {
    try {
      const canGoBack = typeof router.canGoBack === 'function' ? router.canGoBack() : false;
      
      if (canGoBack) {
        return router.back();
      } else {
        console.log('[NavInterceptor] Cannot go back, using fallback');
        const fallback = getSafeFallback();
        return router.replace(fallback as any);
      }
    } catch (error) {
      console.error('[NavInterceptor] Back failed:', error);
      const fallback = getSafeFallback();
      router.replace(fallback as any);
    }
  },

  canGoBack(): boolean {
    try {
      return typeof router.canGoBack === 'function' ? router.canGoBack() : false;
    } catch (error) {
      console.error('[NavInterceptor] canGoBack check failed:', error);
      return false;
    }
  }
};

/**
 * Install navigation error handlers
 */
export function installNavigationErrorHandlers() {
  // Handle unhandled promise rejections that might be navigation-related
  if (typeof window !== 'undefined') {
    window.addEventListener('unhandledrejection', (event) => {
      if (event.reason && String(event.reason).includes('navigate')) {
        console.warn('[NavInterceptor] Caught navigation-related unhandled rejection:', event.reason);
        event.preventDefault();
        
        // Navigate to safe fallback
        const fallback = getSafeFallback();
        router.replace(fallback as any);
      }
    });

    // Handle general errors that might be navigation-related
    window.addEventListener('error', (event) => {
      if (event.error && String(event.error).includes('route')) {
        console.warn('[NavInterceptor] Caught route-related error:', event.error);
        
        // Navigate to safe fallback if needed
        setTimeout(() => {
          if (window.location.pathname === '/+not-found') {
            const fallback = getSafeFallback();
            router.replace(fallback as any);
          }
        }, 100);
      }
    });
  }
}

/**
 * Register route correction mapping
 */
export function registerRouteCorrection(from: string, to: string) {
  ROUTE_CORRECTIONS.set(from, to);
}

/**
 * Register problematic route to be blocked
 */
export function registerProblematicRoute(route: string) {
  PROBLEMATIC_ROUTES.add(route);
}