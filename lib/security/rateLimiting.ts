/* eslint-disable @typescript-eslint/no-unused-vars */

import { createSecureErrorResponse } from './middleware';
import { getRateLimitMessage, getLoginLockoutMessage, getUserLanguage } from '../i18n/securityMessages';

/**
 * Rate Limiting Middleware with Brute Force Protection
 * 
 * Features:
 * - IP-based rate limiting with configurable windows
 * - Progressive penalties for repeated violations
 * - Login attempt throttling with account lockout
 * - Memory-based storage (suitable for serverless)
 * - Custom limits per endpoint type
 */

/**
 * Rate limit configuration interface
 */
export interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
  skipSuccessful?: boolean; // Only count failed requests
  message?: string;      // Custom error message
  progressivePenalty?: boolean; // Increase penalty on repeated violations
}

/**
 * Rate limit store interface
 */
interface RateLimitRecord {
  count: number;
  windowStart: number;
  violations: number; // Number of times this IP exceeded limits
  lastViolation: number;
  blocked: boolean;
  blockExpiry: number;
}

/**
 * In-memory rate limit store
 * In production, consider using Redis or similar for shared storage
 */
class MemoryRateLimitStore {
  private store = new Map<string, RateLimitRecord>();
  private cleanupInterval: any | null = null;

  constructor() {
    // Clean up expired records every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.store.entries()) {
      // Remove records that are older than 1 hour and not blocked
      if (now - record.windowStart > 60 * 60 * 1000 && !record.blocked) {
        this.store.delete(key);
      }
      // Remove expired blocks
      if (record.blocked && now > record.blockExpiry) {
        record.blocked = false;
        record.blockExpiry = 0;
      }
    }
  }

  getRecord(key: string): RateLimitRecord | null {
    return this.store.get(key) || null;
  }

  setRecord(key: string, record: RateLimitRecord): void {
    this.store.set(key, record);
  }

  deleteRecord(key: string): void {
    this.store.delete(key);
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.store.clear();
  }
}

// Global store instance
const rateLimitStore = new MemoryRateLimitStore();

/**
 * Extract client IP address from request
 */
function getClientIP(request: Request): string {
  // Check common proxy headers first
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  // Fallback to other headers
  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  if (cfConnectingIP) {
    return cfConnectingIP;
  }

  // For local development
  return '127.0.0.1';
}

/**
 * Create a unique key for rate limiting
 */
function createRateLimitKey(request: Request, prefix: string): string {
  const ip = getClientIP(request);
  const url = new URL(request.url);
  return `${prefix}:${ip}:${url.pathname}`;
}

/**
 * Calculate progressive penalty duration based on violation count
 */
function calculatePenaltyDuration(violations: number): number {
  // Progressive penalties: 5min, 15min, 30min, 1hr, 2hr, max 4hr
  const basePenalty = 5 * 60 * 1000; // 5 minutes
  const penalties = [1, 3, 6, 12, 24, 48]; // Multipliers
  const multiplier = penalties[Math.min(violations - 1, penalties.length - 1)] || 1;
  return basePenalty * multiplier;
}

/**
 * Check if request should be rate limited
 */
export function checkRateLimit(
  request: Request,
  config: RateLimitConfig,
  identifier: string = 'api'
): { 
  allowed: boolean; 
  record: RateLimitRecord; 
  remaining: number; 
  resetTime: number;
  retryAfter?: number;
} {
  const key = createRateLimitKey(request, identifier);
  const now = Date.now();
  
  let record = rateLimitStore.getRecord(key);
  
  // Initialize record if it doesn't exist
  if (!record) {
    record = {
      count: 0,
      windowStart: now,
      violations: 0,
      lastViolation: 0,
      blocked: false,
      blockExpiry: 0,
    };
  }

  // Check if currently blocked
  if (record.blocked && now < record.blockExpiry) {
    return {
      allowed: false,
      record,
      remaining: 0,
      resetTime: record.blockExpiry,
      retryAfter: Math.ceil((record.blockExpiry - now) / 1000),
    };
  }

  // Reset window if expired
  if (now - record.windowStart >= config.windowMs) {
    record.count = 0;
    record.windowStart = now;
  }

  const remaining = Math.max(0, config.maxRequests - record.count);
  const resetTime = record.windowStart + config.windowMs;

  // Check if limit exceeded
  if (record.count >= config.maxRequests) {
    // Record violation
    record.violations++;
    record.lastViolation = now;

    // Apply progressive penalty if enabled
    if (config.progressivePenalty && record.violations >= 2) {
      const penaltyDuration = calculatePenaltyDuration(record.violations);
      record.blocked = true;
      record.blockExpiry = now + penaltyDuration;
    }

    rateLimitStore.setRecord(key, record);
    
    return {
      allowed: false,
      record,
      remaining: 0,
      resetTime: record.blocked ? record.blockExpiry : resetTime,
      retryAfter: record.blocked 
        ? Math.ceil((record.blockExpiry - now) / 1000)
        : Math.ceil((resetTime - now) / 1000),
    };
  }

  // Increment counter
  record.count++;
  rateLimitStore.setRecord(key, record);

  return {
    allowed: true,
    record,
    remaining: remaining - 1,
    resetTime,
  };
}

/**
 * Rate limiting middleware factory
 */
export function createRateLimitMiddleware(
  config: RateLimitConfig,
  identifier: string = 'api'
) {
  return (request: Request, origin?: string, environment?: string) => {
    const result = checkRateLimit(request, config, identifier);
    
    if (!result.allowed) {
      const userLanguage = getUserLanguage(request);
      const message = config.message || getRateLimitMessage(
        result.retryAfter,
        result.resetTime,
        { lng: userLanguage }
      );
      const headers: HeadersInit = {
        'X-RateLimit-Limit': config.maxRequests.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': new Date(result.resetTime).toISOString(),
      };

      if (result.retryAfter) {
        headers['Retry-After'] = result.retryAfter.toString();
      }

      return createSecureErrorResponse(
        {
          message,
          retryAfter: result.retryAfter,
          resetTime: result.resetTime,
        },
        429,
        origin,
        environment,
        headers
      );
    }

    return {
      success: true,
      headers: {
        'X-RateLimit-Limit': config.maxRequests.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': new Date(result.resetTime).toISOString(),
      },
    };
  };
}

/**
 * Specialized login attempt rate limiter with account-specific tracking
 */
export function checkLoginAttempts(
  request: Request,
  email: string,
  success: boolean = false
): {
  allowed: boolean;
  attempts: number;
  maxAttempts: number;
  lockoutExpiry?: number;
  retryAfter?: number;
} {
  const ipKey = `login_ip:${getClientIP(request)}`;
  const emailKey = `login_email:${email.toLowerCase()}`;
  const now = Date.now();
  
  // Configuration for login attempts
  const config = {
    maxAttemptsPerIP: 10, // Max attempts per IP per 15 minutes
    maxAttemptsPerEmail: 5, // Max attempts per email per 15 minutes
    windowMs: 15 * 60 * 1000, // 15 minutes
    lockoutDuration: 30 * 60 * 1000, // 30 minutes lockout
  };

  // Check both IP and email-based limits
  const ipRecord = rateLimitStore.getRecord(ipKey);
  const emailRecord = rateLimitStore.getRecord(emailKey);

  // Helper to check/update record
  const checkRecord = (key: string, maxAttempts: number) => {
    let record = rateLimitStore.getRecord(key);
    
    if (!record) {
      record = {
        count: 0,
        windowStart: now,
        violations: 0,
        lastViolation: 0,
        blocked: false,
        blockExpiry: 0,
      };
    }

    // Check if blocked
    if (record.blocked && now < record.blockExpiry) {
      return {
        allowed: false,
        attempts: record.count,
        lockoutExpiry: record.blockExpiry,
        retryAfter: Math.ceil((record.blockExpiry - now) / 1000),
      };
    }

    // Reset window if expired
    if (now - record.windowStart >= config.windowMs) {
      record.count = 0;
      record.windowStart = now;
      record.blocked = false;
      record.blockExpiry = 0;
    }

    // If this was a successful login, reset the counter
    if (success) {
      record.count = 0;
      record.violations = 0;
      record.blocked = false;
      record.blockExpiry = 0;
    } else {
      // Increment failed attempt counter
      record.count++;

      // Check if limit exceeded
      if (record.count >= maxAttempts) {
        record.blocked = true;
        record.blockExpiry = now + config.lockoutDuration;
        record.violations++;
      }
    }

    rateLimitStore.setRecord(key, record);
    
    return {
      allowed: record.count < maxAttempts && !record.blocked,
      attempts: record.count,
      lockoutExpiry: record.blocked ? record.blockExpiry : undefined,
      retryAfter: record.blocked ? Math.ceil((record.blockExpiry - now) / 1000) : undefined,
    };
  };

  // Check IP-based limit
  const ipResult = checkRecord(ipKey, config.maxAttemptsPerIP);
  if (!ipResult.allowed) {
    return {
      allowed: false,
      attempts: ipResult.attempts,
      maxAttempts: config.maxAttemptsPerIP,
      lockoutExpiry: ipResult.lockoutExpiry,
      retryAfter: ipResult.retryAfter,
    };
  }

  // Check email-based limit
  const emailResult = checkRecord(emailKey, config.maxAttemptsPerEmail);
  if (!emailResult.allowed) {
    return {
      allowed: false,
      attempts: emailResult.attempts,
      maxAttempts: config.maxAttemptsPerEmail,
      lockoutExpiry: emailResult.lockoutExpiry,
      retryAfter: emailResult.retryAfter,
    };
  }

  return {
    allowed: true,
    attempts: Math.max(ipResult.attempts, emailResult.attempts),
    maxAttempts: config.maxAttemptsPerEmail,
  };
}

/**
 * Predefined rate limiters for common endpoints
 */
export const RateLimiters = {
  // Authentication endpoints
  auth: createRateLimitMiddleware({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 10,
    message: 'Too many authentication attempts. Please try again later.',
    progressivePenalty: true,
  }, 'auth'),

  // AI endpoints
  ai: createRateLimitMiddleware({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20,
    message: 'AI request rate limit exceeded. Please slow down your requests.',
    progressivePenalty: false,
  }, 'ai'),

  // General API endpoints
  api: createRateLimitMiddleware({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
    message: 'API rate limit exceeded. Please reduce request frequency.',
    progressivePenalty: false,
  }, 'api'),

  // File upload endpoints
  upload: createRateLimitMiddleware({
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 10,
    message: 'Upload rate limit exceeded. Please wait before uploading again.',
    progressivePenalty: true,
  }, 'upload'),

  // Password reset endpoints
  passwordReset: createRateLimitMiddleware({
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3,
    message: 'Too many password reset attempts. Please try again later.',
    progressivePenalty: true,
  }, 'password-reset'),
};

/**
 * Utility to add rate limit headers to any response
 */
export function addRateLimitHeaders(
  headers: HeadersInit,
  result: ReturnType<typeof checkRateLimit>
): HeadersInit {
  return {
    ...headers,
    'X-RateLimit-Limit': '100', // Default, should be overridden
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': new Date(result.resetTime).toISOString(),
  };
}

/**
 * Clean up rate limit store (for testing or shutdown)
 */
export function cleanupRateLimitStore(): void {
  rateLimitStore.destroy();
}