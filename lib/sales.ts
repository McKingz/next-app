import { normalizeRole } from '@/lib/rbac';
import type { Href } from 'expo-router';

/**
 * Return a route path (typed as Href) for either a sales contact page or a safe pricing page,
 * depending on the user's role. Principals/Admins are allowed to go to sales;
 * everyone else is redirected to pricing.
 */
export function salesOrPricingPath({
  role,
  salesPath,
  pricingPath = '/pricing',
}: {
  role?: string | null;
  salesPath: string;
  pricingPath?: string;
}): Href {
  const norm = normalizeRole(String(role || ''));
  const canRequest = norm === 'principal_admin' || norm === 'super_admin';
  const target = canRequest ? salesPath : pricingPath;
  // Cast to Href to satisfy expo-router's strongly-typed router.push
  return target as unknown as Href;
}

