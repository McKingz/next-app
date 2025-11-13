import { 
  handleCORSPreflight, 
  validateRequestSize, 
  getRequestOrigin,
  createSecureErrorResponse,
  createSecureResponse,
} from './middleware';
import { ValidationContext, validateRequestBody, ValidationSchemas } from './validation';
import { RateLimiters, checkLoginAttempts } from './rateLimiting';
import { authService } from '../auth/AuthService';
import { getAppConfiguration } from '../config';
import { getUserLanguage, getSecurityMessage, getLoginLockoutMessage } from '../i18n/securityMessages';

/**
 * Comprehensive Security Middleware Composer
 * 
 * Combines all security features into easy-to-use middleware functions:
 * - CORS and security headers
 * - Request size validation
 * - Schema-based input validation
 * - Rate limiting with brute force protection
 * - Authentication verification
 * - Authorization (RBAC) checks
 */

/**
 * Security middleware configuration
 */
export interface SecurityConfig {
  cors?: boolean;
  rateLimit?: 'auth' | 'ai' | 'api' | 'upload' | 'passwordReset' | false;
  maxRequestSize?: number;
  validation?: {
    body?: any; // Zod schema
    params?: any; // Zod schema
    query?: any; // Zod schema
  };
  authentication?: boolean;
  authorization?: {
    roles?: string[];
    permissions?: string[];
    requireAll?: boolean; // Require all permissions vs any
  };
}

/**
 * Security middleware result
 */
export interface SecurityResult {
  success: boolean;
  response?: Response;
  data?: {
    body?: any;
    params?: any;
    query?: any;
    user?: any;
    profile?: any;
  };
  headers?: HeadersInit;
}

/**
 * Apply comprehensive security middleware to a request
 */
export async function applySecurityMiddleware(
  request: Request,
  config: SecurityConfig = {},
  routeParams?: Record<string, string>
): Promise<SecurityResult> {
  const origin = getRequestOrigin(request);
const environment = getAppConfiguration().environment;

  try {
    // 1. Handle CORS preflight requests
    if (config.cors !== false) {
      const corsResponse = handleCORSPreflight(request, environment);
      if (corsResponse) {
        return { success: true, response: corsResponse };
      }
    }

    // 2. Validate request size
    const maxSize = config.maxRequestSize || 1024 * 1024; // 1MB default
    if (!validateRequestSize(request, maxSize)) {
      const userLanguage = getUserLanguage(request);
      return {
        success: false,
        response: createSecureErrorResponse(
          getSecurityMessage('errors.requestTooLarge', { lng: userLanguage, maxSize: Math.floor(maxSize / 1024) }),
          413,
          origin || undefined,
          environment
        ),
      };
    }

    // 3. Apply rate limiting
    if (config.rateLimit && RateLimiters[config.rateLimit]) {
      const rateLimitResult = RateLimiters[config.rateLimit](request, origin || undefined, environment);
      if (rateLimitResult instanceof Response) {
        return { success: false, response: rateLimitResult };
      }
    }

    // 4. Input validation
    const validationContext: ValidationContext = {
      request,
      params: routeParams,
      origin: origin || undefined,
      environment,
    };

    const validatedData: any = {};

    // Validate request body
    if (config.validation?.body) {
      const bodyValidation = await validateRequestBody(
        validationContext,
        config.validation.body
      );
      
      if (!bodyValidation.valid) {
        return { success: false, response: (bodyValidation as any).response };
      }
      
      validatedData.body = bodyValidation.data;
    }

    // Validate URL parameters
    if (config.validation?.params) {
      const { validateParams } = await import('./validation');
      const paramsValidation = validateParams(validationContext, config.validation.params);
      
      if (!paramsValidation.valid) {
        return { success: false, response: (paramsValidation as any).response };
      }
      
      validatedData.params = paramsValidation.data;
    }

    // Validate query parameters
    if (config.validation?.query) {
      const { validateQuery } = await import('./validation');
      const queryValidation = validateQuery(validationContext, config.validation.query);
      
      if (!queryValidation.valid) {
        return { success: false, response: (queryValidation as any).response };
      }
      
      validatedData.query = queryValidation.data;
    }

    // 5. Authentication check
    if (config.authentication) {
      const authHeader = request.headers.get('Authorization');
      const userLanguage = getUserLanguage(request);
      
      if (!authHeader) {
        return {
          success: false,
          response: createSecureErrorResponse(
            getSecurityMessage('errors.authRequired', { lng: userLanguage }),
            401,
            origin || undefined,
            environment
          ),
        };
      }

      // Verify token and get user
      const user = authService.getCurrentUser();
      const profile = authService.getCurrentProfile();
      
      if (!user || !profile) {
        return {
          success: false,
          response: createSecureErrorResponse(
            getSecurityMessage('errors.invalidToken', { lng: userLanguage }),
            401,
            origin || undefined,
            environment
          ),
        };
      }

      validatedData.user = user;
      validatedData.profile = profile;

      // 6. Authorization check (RBAC)
      if (config.authorization) {
        const authResult = checkAuthorization(profile, config.authorization);
        
        if (!authResult.allowed) {
          return {
            success: false,
            response: createSecureErrorResponse(
              {
                error: getSecurityMessage('errors.insufficientPermissions', { lng: userLanguage }),
                required: authResult.required,
                missing: authResult.missing,
              },
              403,
              origin || undefined,
              environment
            ),
          };
        }
      }
    }

    return {
      success: true,
      data: validatedData,
    };

  } catch (error) {
    console.error('Security middleware error:', error);
    const userLanguage = getUserLanguage(request);
    
    return {
      success: false,
      response: createSecureErrorResponse(
        getSecurityMessage('errors.internalSecurityError', { lng: userLanguage }),
        500,
        origin || undefined,
        environment
      ),
    };
  }
}

/**
 * Check if user has required authorization
 */
function checkAuthorization(
  profile: any,
  authConfig: NonNullable<SecurityConfig['authorization']>
): {
  allowed: boolean;
  required: string[];
  missing: string[];
} {
  const userRole = profile.role;
  const userCapabilities = profile.capabilities || [];
  const required: string[] = [];
  const missing: string[] = [];

  // Check roles
  if (authConfig.roles && authConfig.roles.length > 0) {
    required.push(...authConfig.roles.map(role => `role:${role}`));
    
    if (!authConfig.roles.includes(userRole)) {
      missing.push(`role:${userRole} (required: ${authConfig.roles.join(', ')})`);
    }
  }

  // Check permissions/capabilities
  if (authConfig.permissions && authConfig.permissions.length > 0) {
    required.push(...authConfig.permissions);
    
    if (authConfig.requireAll) {
      // User must have ALL specified permissions
      const missingPermissions = authConfig.permissions.filter(
        perm => !userCapabilities.includes(perm)
      );
      missing.push(...missingPermissions);
    } else {
      // User must have AT LEAST ONE specified permission
      const hasAnyPermission = authConfig.permissions.some(
        perm => userCapabilities.includes(perm)
      );
      
      if (!hasAnyPermission) {
        missing.push(`any of: ${authConfig.permissions.join(', ')}`);
      }
    }
  }

  return {
    allowed: missing.length === 0,
    required,
    missing,
  };
}

/**
 * Enhanced login attempt validation with security middleware
 */
export async function validateLoginAttempt(
  request: Request,
  credentials: { email: string; password: string }
): Promise<SecurityResult> {
  const origin = getRequestOrigin(request);
  const environment = getAppConfiguration().environment;

  // Check login attempt limits
  const loginCheck = checkLoginAttempts(request, credentials.email);
  
  if (!loginCheck.allowed) {
    const userLanguage = getUserLanguage(request);
    const message = getLoginLockoutMessage(
      loginCheck.lockoutExpiry,
      { lng: userLanguage }
    );

    return {
      success: false,
      response: createSecureErrorResponse(
        {
          error: message,
          attempts: loginCheck.attempts,
          maxAttempts: loginCheck.maxAttempts,
          retryAfter: loginCheck.retryAfter,
          lockoutExpiry: loginCheck.lockoutExpiry,
        },
        429,
        origin || undefined,
        environment,
        loginCheck.retryAfter 
          ? { 'Retry-After': loginCheck.retryAfter.toString() }
          : undefined
      ),
    };
  }

  return { success: true };
}

/**
 * Record successful login (resets attempt counters)
 */
export function recordSuccessfulLogin(request: Request, email: string): void {
  checkLoginAttempts(request, email, true);
}

/**
 * Predefined security middleware configurations
 */
export const SecurityMiddlewares = {
  /**
   * Authentication endpoints (login, register)
   */
  auth: {
    cors: true,
    rateLimit: 'auth' as const,
    maxRequestSize: 16 * 1024, // 16KB
    authentication: false,
  },

  /**
   * Public API endpoints
   */
  publicAPI: {
    cors: true,
    rateLimit: 'api' as const,
    authentication: false,
  },

  /**
   * Protected API endpoints
   */
  protectedAPI: {
    cors: true,
    rateLimit: 'api' as const,
    authentication: true,
  },

  /**
   * Admin-only endpoints
   */
  adminOnly: {
    cors: true,
    rateLimit: 'api' as const,
    authentication: true,
    authorization: {
      roles: ['admin'],
    },
  },

  /**
   * Instructor endpoints
   */
  instructorOnly: {
    cors: true,
    rateLimit: 'api' as const,
    authentication: true,
    authorization: {
      roles: ['admin', 'instructor'],
    },
  },

  /**
   * AI endpoints
   */
  aiEndpoint: {
    cors: true,
    rateLimit: 'ai' as const,
    authentication: true,
    authorization: {
      permissions: ['use_ai_features'],
    },
  },

  /**
   * File upload endpoints
   */
  fileUpload: {
    cors: true,
    rateLimit: 'upload' as const,
    maxRequestSize: 10 * 1024 * 1024, // 10MB
    authentication: true,
  },
};

/**
 * Helper function to create endpoint handlers with security middleware
 */
export function createSecureEndpoint(
  handler: (request: Request, context: { data: any }) => Promise<Response>,
  securityConfig: SecurityConfig = {},
  routeParams?: Record<string, string>
) {
  return async (request: Request): Promise<Response> => {
    const securityResult = await applySecurityMiddleware(
      request,
      securityConfig,
      routeParams
    );

    // If security middleware returned a response (error or preflight), return it
    if (securityResult.response) {
      return securityResult.response;
    }

    // If security check failed without a response, return generic error
    if (!securityResult.success) {
      const userLanguage = getUserLanguage(request);
      return createSecureErrorResponse(
        getSecurityMessage('errors.securityValidationFailed', { lng: userLanguage }),
        400,
        getRequestOrigin(request) || undefined,
        getAppConfiguration().environment
      );
    }

    try {
      // Call the actual handler with validated data
      const response = await handler(request, { 
        data: securityResult.data || {} 
      });
      
      return response;
    } catch (error) {
      console.error('Endpoint handler error:', error);
      const userLanguage = getUserLanguage(request);
      
      return createSecureErrorResponse(
        getSecurityMessage('errors.internalError', { lng: userLanguage }),
        500,
        getRequestOrigin(request) || undefined,
        getAppConfiguration().environment
      );
    }
  };
}