/**
 * FAB Visibility Hook
 * 
 * Determines whether the Floating Action Button (Dash Chat Button) should be visible
 * based on the current route. Hides FAB on auth, registration, landing, and AI assistant routes.
 */

import { useMemo } from 'react';

/**
 * Calculates FAB visibility based on pathname
 * 
 * @param pathname - Current route pathname from usePathname()
 * @returns Object with showFAB and shouldHideFAB boolean flags
 */
export const useFABVisibility = (pathname: string | null) => {
  const shouldHideFAB = useMemo(() => {
    if (!pathname || typeof pathname !== 'string') return false;

    // Auth routes - hide FAB during authentication flows
    if (
      pathname.startsWith('/(auth)') ||
      pathname === '/sign-in' ||
      pathname === '/(auth)/sign-in' ||
      pathname.includes('auth-callback')
    ) {
      return true;
    }

    // Registration routes - hide FAB during sign-up flows
    if (
      pathname.includes('registration') ||
      pathname.includes('register') ||
      pathname.includes('sign-up') ||
      pathname.includes('signup') ||
      pathname.includes('verify-your-email') ||
      pathname.includes('profiles-gate')
    ) {
      return true;
    }

    // Landing and onboarding routes
    if (
      pathname === '/' ||
      pathname === '/landing' ||
      pathname.startsWith('/landing') ||
      pathname.includes('welcome') ||
      pathname.includes('onboarding')
    ) {
      return true;
    }

    // Dash Assistant routes - hide FAB when user is already in AI interface
    if (
      pathname.includes('dash-assistant') ||
      pathname.includes('/screens/dash-assistant') ||
      pathname.startsWith('/ai/dash') ||
      pathname.startsWith('/ai/assistant')
    ) {
      return true;
    }

    // PWA install page - hide FAB on installation instructions
    if (pathname === '/pwa-install' || pathname.startsWith('/pwa-install')) {
      return true;
    }

    // Legal pages - hide FAB on static content pages
    if (
      pathname === '/privacy-policy' ||
      pathname === '/terms-of-service' ||
      pathname.startsWith('/privacy-policy') ||
      pathname.startsWith('/terms-of-service')
    ) {
      return true;
    }

    return false;
  }, [pathname]);

  const showFAB = !shouldHideFAB;

  return { showFAB, shouldHideFAB };
};
