// Helper to build PayFast-compatible return/cancel URLs
// Prefer a bridge endpoint (https) that can deep-link back into the app

export function getPaymentsBaseUrl(): string {
  const bridge = process.env.EXPO_PUBLIC_PAYMENTS_BRIDGE_URL;
  if (bridge && /^https?:\/\//i.test(bridge)) return bridge.replace(/\/$/, '');
  // Fallback to Supabase Functions base (works in all envs)
  const supa = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (supa && /^https?:\/\//i.test(supa)) return supa.replace(/\/$/, '') + '/functions/v1';
  // Final fallback: production domain (avoid Vercel bridge to prevent 404s)
  return 'https://lvvvjywrmpcqrpvuptdi.supabase.co/functions/v1';
}

export function getReturnUrl(): string {
  const base = getPaymentsBaseUrl();
  return `${base}/payments-webhook`;
}

export function getCancelUrl(): string {
  const base = getPaymentsBaseUrl();
  return `${base}/payments-webhook`;
}
