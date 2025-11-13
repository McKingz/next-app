/**
 * Security configuration for profile fallbacks
 * 
 * This allows us to completely disable fallback profiles once
 * database issues are resolved in production
 */

export const SECURITY_CONFIG = {
  // Set to false in production once database issues are resolved
  ALLOW_PROFILE_FALLBACK: process.env.NODE_ENV !== 'production' || 
                          process.env.EXPO_PUBLIC_ALLOW_PROFILE_FALLBACK === 'true',
  
  // Maximum number of fallback profiles per session (rate limiting)
  MAX_FALLBACKS_PER_SESSION: 3,
  
  // Log all fallback usage for security monitoring
  LOG_FALLBACK_USAGE: true,
};

// Track fallback usage per session for rate limiting
const fallbackUsage = new Map<string, number>();

export function shouldAllowFallback(sessionId: string): boolean {
  if (!SECURITY_CONFIG.ALLOW_PROFILE_FALLBACK) {
    return false;
  }
  
  const currentUsage = fallbackUsage.get(sessionId) || 0;
  if (currentUsage >= SECURITY_CONFIG.MAX_FALLBACKS_PER_SESSION) {
    console.error('SECURITY: Maximum fallback usage exceeded for session');
    return false;
  }
  
  return true;
}

export function trackFallbackUsage(sessionId: string): void {
  const currentUsage = fallbackUsage.get(sessionId) || 0;
  fallbackUsage.set(sessionId, currentUsage + 1);
  
  // Clean up old entries periodically
  if (fallbackUsage.size > 1000) {
    fallbackUsage.clear();
  }
}
