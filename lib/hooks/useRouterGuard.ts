import { useEffect, useMemo } from 'react';
import { router, usePathname } from 'expo-router';
import { safeRouter } from '@/lib/navigation/safeRouter';

// Hook to keep safeRouter aware of the current path and expose a drop-in router API
export function useRouterGuard() {
  const pathname = usePathname();

  useEffect(() => {
    try {
      if (typeof pathname === 'string') {
        safeRouter.setCurrentPathname(pathname);
      }
    } catch (e) {
      if (__DEV__) {
        console.warn('[useRouterGuard] Failed to set current pathname:', e);
      }
    }
  }, [pathname]);

  // Expose a router-like API that delegates to safeRouter
  const guarded = useMemo(() => ({
    push: safeRouter.push,
    replace: safeRouter.replace,
    back: safeRouter.back,
    canGoBack: safeRouter.canGoBack,
    // Provide access to original router if absolutely necessary
    original: router,
  }), []);

  return guarded;
}

// Optional provider that runs the hook for its side-effects and renders children
export function RouterGuardProvider({ children }: { children: any }) {
  useRouterGuard();
  return children;
}
