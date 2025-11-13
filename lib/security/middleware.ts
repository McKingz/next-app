// Security Middleware for EduDash Pro
// Provides CORS configuration and security headers for Supabase Edge Functions

/**
 * CORS Configuration - Environment-based allow list
 */
export const CORS_CONFIG = {
  development: [
    'http://localhost:8081',
    'http://localhost:19006', 
    'http://127.0.0.1:8081',
    'http://127.0.0.1:19006',
    'exp://192.168.1.*:8081', // Expo dev server pattern
  ],
  staging: [
    'https://your-staging-domain.com',
    'exp://staging.*',
  ],
  production: [
    'https://edudashpro.org.za',
    'https://www.edudashpro.org.za',
    'https://app.edudashpro.org.za',
  ],
};

/**
 * Security Headers Configuration
 */
export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

/**
 * Rate Limiting Configuration
 */
export const RATE_LIMITS = {
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 attempts per window
    message: 'Too many authentication attempts, please try again later.',
  },
  ai: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 AI requests per minute
    message: 'AI request rate limit exceeded. Please wait before making another request.',
  },
  api: {
    windowMs: 60 * 1000, // 1 minute  
    maxRequests: 100, // 100 general API requests per minute
    message: 'API rate limit exceeded. Please reduce request frequency.',
  },
};

/**
 * Get CORS origins for current environment
 */
export function getCORSOrigins(environment: string = 'development'): string[] {
  const env = environment as keyof typeof CORS_CONFIG;
  return CORS_CONFIG[env] || CORS_CONFIG.development;
}

/**
 * Create CORS headers for Response
 */
export function createCORSHeaders(origin?: string, environment: string = 'development'): HeadersInit {
  const allowedOrigins = getCORSOrigins(environment);
  
  // Check if origin is allowed (with wildcard support)
  const isOriginAllowed = origin && allowedOrigins.some(allowed => {
    if (allowed.includes('*')) {
      const pattern = allowed.replace(/\*/g, '.*');
      return new RegExp(`^${pattern}$`).test(origin);
    }
    return allowed === origin;
  });

  return {
    'Access-Control-Allow-Origin': isOriginAllowed ? origin : 'null',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400', // 24 hours
    ...SECURITY_HEADERS,
  };
}

/**
 * Create error response with security headers
 */
export function createSecureErrorResponse(
  message: string | object, 
  status: number = 400, 
  origin?: string,
  environment?: string,
  additionalHeaders?: HeadersInit
): Response {
  const responseBody = typeof message === 'string' 
    ? { error: message } 
    : message;

  return new Response(
    JSON.stringify(responseBody),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...createCORSHeaders(origin, environment),
        ...additionalHeaders,
      },
    }
  );
}

/**
 * Create success response with security headers
 */
export function createSecureResponse(
  data: any, 
  status: number = 200, 
  origin?: string,
  environment?: string,
  additionalHeaders?: HeadersInit
): Response {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...createCORSHeaders(origin, environment),
        ...additionalHeaders,
      },
    }
  );
}

/**
 * Validate request size (prevent large payload attacks)
 */
export function validateRequestSize(request: Request, maxSize: number = 1024 * 1024): boolean {
  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength) > maxSize) {
    return false;
  }
  return true;
}

/**
 * Extract and validate origin from request
 */
export function getRequestOrigin(request: Request): string | null {
  return request.headers.get('origin') || request.headers.get('referer');
}

/**
 * Middleware helper for handling OPTIONS requests
 */
export function handleCORSPreflight(request: Request, environment?: string): Response | null {
  if (request.method === 'OPTIONS') {
    const origin = getRequestOrigin(request);
    return new Response(null, {
      status: 204,
      headers: createCORSHeaders(origin || undefined, environment),
    });
  }
  return null;
}
