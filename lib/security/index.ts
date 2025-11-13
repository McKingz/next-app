/**
 * EduDash Pro Security Module
 * 
 * Comprehensive security middleware system with:
 * - CORS and security headers
 * - Schema-based request validation
 * - Rate limiting with brute force protection
 * - Authentication and authorization middleware
 * - Request size validation
 * - Progressive penalty system
 */

// Core middleware components
export {
  CORS_CONFIG,
  SECURITY_HEADERS,
  RATE_LIMITS,
  getCORSOrigins,
  createCORSHeaders,
  createSecureErrorResponse,
  createSecureResponse,
  validateRequestSize,
  getRequestOrigin,
  handleCORSPreflight,
} from './middleware';

// Request validation
export {
  validateRequestBody,
  validateParams,
  validateQuery,
  ValidationSchemas,
  Validators,
  createValidation,
} from './validation';
export type { ValidationContext } from './validation';

// Rate limiting
export {
  checkRateLimit,
  createRateLimitMiddleware,
  checkLoginAttempts,
  RateLimiters,
  addRateLimitHeaders,
  cleanupRateLimitStore,
} from './rateLimiting';
export type { RateLimitConfig } from './rateLimiting';

// Comprehensive security middleware
export {
  applySecurityMiddleware,
  validateLoginAttempt,
  recordSuccessfulLogin,
  SecurityMiddlewares,
  createSecureEndpoint,
} from './securityMiddleware';
export type { SecurityConfig, SecurityResult } from './securityMiddleware';

// RBAC Authorization
export {
  UserRole,
  Permission,
  ROLE_PERMISSIONS,
  hasRole,
  hasPermission,
  hasAllPermissions,
  getUserPermissions,
  checkAuthorization,
  requireAuthorization,
  requireRole,
  requirePermission,
  requireAdmin,
  requireInstructor,
  requireStudent,
  RBACMiddleware,
  checkResourceOwnership,
  Role, // Alias for UserRole
} from './rbac';
export type { AuthorizationResult, RBACContext } from './rbac';

// Route Guards
export {
  createProtectedRoute,
  RouteGuards,
  RouteGuardBuilder,
  createRouteGuard,
} from './routeGuards';
export type { RouteGuardConfig } from './routeGuards';

/**
 * Quick Start Examples:
 * 
 * 1. Basic endpoint with security:
 * ```typescript
 * import { createSecureEndpoint, SecurityMiddlewares } from './lib/security';
 * 
 * export const handler = createSecureEndpoint(
 *   async (request, { data }) => {
 *     // Your endpoint logic here
 *     return new Response(JSON.stringify({ success: true }));
 *   },
 *   SecurityMiddlewares.protectedAPI
 * );
 * ```
 * 
 * 2. Custom validation:
 * ```typescript
 * import { applySecurityMiddleware, ValidationSchemas } from './lib/security';
 * 
 * export async function POST(request: Request) {
 *   const security = await applySecurityMiddleware(request, {
 *     validation: { body: ValidationSchemas.register },
 *     rateLimit: 'auth',
 *     authentication: false,
 *   });
 *   
 *   if (!security.success) return security.response!;
 *   
 *   // Use security.data.body for validated data
 * }
 * ```
 * 
 * 3. Login with brute force protection:
 * ```typescript
 * import { validateLoginAttempt, recordSuccessfulLogin } from './lib/security';
 * 
 * export async function loginHandler(request: Request) {
 *   const credentials = await request.json();
 *   
 *   // Check for brute force attempts
 *   const security = await validateLoginAttempt(request, credentials);
 *   if (!security.success) return security.response!;
 *   
 *   // Attempt login...
 *   if (loginSuccess) {
 *     recordSuccessfulLogin(request, credentials.email);
 *   }
 * }
 * ```
 */