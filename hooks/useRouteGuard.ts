/**
 * Route Guard Hooks (Disabled)
 *
 * Per request, all auth and mobile-web guards are no-ops to allow
 * normal navigation without redirects or gating.
 */

import { useEffect } from 'react';

export const useMobileWebGuard = () => {
  // no-op (guards disabled)
  useEffect(() => {}, []);
};

export const useAuthGuard = () => {
  // no-op (guards disabled)
  useEffect(() => {}, []);
};
