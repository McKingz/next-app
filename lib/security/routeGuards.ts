/**
 * Route Guards for API Endpoint Protection
 * 
 * Provides easy-to-use decorators and guard functions for protecting API endpoints
 * with RBAC authorization, authentication, and comprehensive security middleware.
 */

import { applySecurityMiddleware, SecurityConfig } from './securityMiddleware';
import { requireAuthorization, UserRole, Permission } from './rbac';
import { getRequestOrigin } from './middleware';
import { getAppConfiguration } from '../config';

/**
 * Route guard configuration
 */
export interface RouteGuardConfig extends SecurityConfig {
  rbac?: {
    roles?: UserRole[];
    permissions?: Permission[];
    requireAllPermissions?: boolean;
  };
}

/**
 * Create a protected route handler with comprehensive security
 */
export function createProtectedRoute<T = any>(
  handler: (request: Request, context: { data: T; user: any; profile: any }) => Promise<Response>,
  config: RouteGuardConfig = {},
  routeParams?: Record<string, string>
) {
  return async (request: Request): Promise<Response> => {
    const origin = getRequestOrigin(request);
const environment = getAppConfiguration().environment;

    try {
      // 1. Apply general security middleware
      const securityResult = await applySecurityMiddleware(request, config, routeParams);
      
      if (securityResult.response) {
        return securityResult.response;
      }
      
      if (!securityResult.success) {
        throw new Error('Security validation failed');
      }

      // 2. Apply RBAC authorization if specified
      let authUser = securityResult.data?.user;
      let authProfile = securityResult.data?.profile;
      
      if (config.rbac) {
        const rbacMiddleware = requireAuthorization(config.rbac);
        const rbacResult = await rbacMiddleware(request, origin || undefined, environment);
        
        if (rbacResult instanceof Response) {
          return rbacResult;
        }
        
        authUser = rbacResult.user;
        authProfile = rbacResult.profile;
      }

      // 3. Call the actual handler with validated data and user context
      return await handler(request, {
        data: (securityResult.data || {}) as T,
        user: authUser,
        profile: authProfile,
      });

    } catch (error) {
      console.error('Protected route error:', error);
      return new Response(JSON.stringify({ 
        error: 'Internal server error' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  };
}

/**
 * Predefined route guards for common scenarios
 */
export class RouteGuards {
  /**
   * Public route - no authentication required, basic security only
   */
  static public(config?: Omit<SecurityConfig, 'authentication'>) {
    return (handler: (request: Request, context: { data: any }) => Promise<Response>) =>
      createProtectedRoute(
        (req, ctx) => handler(req, { data: ctx.data }),
        { 
          cors: true,
          rateLimit: 'api',
          ...config,
          authentication: false 
        }
      );
  }

  /**
   * Authenticated route - requires valid authentication
   */
  static authenticated(config?: Omit<SecurityConfig, 'authentication'>) {
    return (handler: (request: Request, context: { data: any; user: any; profile: any }) => Promise<Response>) =>
      createProtectedRoute(handler, {
        cors: true,
        rateLimit: 'api',
        ...config,
        authentication: true
      });
  }

  /**
   * Admin only route
   */
  static adminOnly(config?: Omit<RouteGuardConfig, 'authentication' | 'rbac'>) {
    return (handler: (request: Request, context: { data: any; user: any; profile: any }) => Promise<Response>) =>
      createProtectedRoute(handler, {
        cors: true,
        rateLimit: 'api',
        ...config,
        authentication: true,
        rbac: {
          roles: [UserRole.ADMIN, UserRole.SUPER_ADMIN]
        }
      });
  }

  /**
   * Instructor or Admin route
   */
  static instructorOnly(config?: Omit<RouteGuardConfig, 'authentication' | 'rbac'>) {
    return (handler: (request: Request, context: { data: any; user: any; profile: any }) => Promise<Response>) =>
      createProtectedRoute(handler, {
        cors: true,
        rateLimit: 'api',
        ...config,
        authentication: true,
        rbac: {
          roles: [UserRole.INSTRUCTOR, UserRole.ADMIN, UserRole.SUPER_ADMIN]
        }
      });
  }

  /**
   * Student only route
   */
  static studentOnly(config?: Omit<RouteGuardConfig, 'authentication' | 'rbac'>) {
    return (handler: (request: Request, context: { data: any; user: any; profile: any }) => Promise<Response>) =>
      createProtectedRoute(handler, {
        cors: true,
        rateLimit: 'api',
        ...config,
        authentication: true,
        rbac: {
          roles: [UserRole.STUDENT]
        }
      });
  }

  /**
   * Course management route (Instructor or Admin)
   */
  static courseManagement(config?: Omit<RouteGuardConfig, 'authentication' | 'rbac'>) {
    return (handler: (request: Request, context: { data: any; user: any; profile: any }) => Promise<Response>) =>
      createProtectedRoute(handler, {
        cors: true,
        rateLimit: 'api',
        ...config,
        authentication: true,
        rbac: {
          permissions: [Permission.MANAGE_COURSES]
        }
      });
  }

  /**
   * Assignment management route (Instructor or Admin)
   */
  static assignmentManagement(config?: Omit<RouteGuardConfig, 'authentication' | 'rbac'>) {
    return (handler: (request: Request, context: { data: any; user: any; profile: any }) => Promise<Response>) =>
      createProtectedRoute(handler, {
        cors: true,
        rateLimit: 'api',
        ...config,
        authentication: true,
        rbac: {
          permissions: [Permission.MANAGE_ASSIGNMENTS]
        }
      });
  }

  /**
   * AI features route
   */
  static aiFeatures(config?: Omit<RouteGuardConfig, 'authentication' | 'rbac'>) {
    return (handler: (request: Request, context: { data: any; user: any; profile: any }) => Promise<Response>) =>
      createProtectedRoute(handler, {
        cors: true,
        rateLimit: 'ai',
        ...config,
        authentication: true,
        rbac: {
          permissions: [Permission.USE_AI_FEATURES]
        }
      });
  }

  /**
   * File upload route
   */
  static fileUpload(config?: Omit<RouteGuardConfig, 'authentication' | 'maxRequestSize' | 'rateLimit'>) {
    return (handler: (request: Request, context: { data: any; user: any; profile: any }) => Promise<Response>) =>
      createProtectedRoute(handler, {
        cors: true,
        rateLimit: 'upload',
        maxRequestSize: 10 * 1024 * 1024, // 10MB
        ...config,
        authentication: true
      });
  }

  /**
   * Auth endpoints (login, register)
   */
  static auth(config?: Omit<SecurityConfig, 'authentication' | 'rateLimit'>) {
    return (handler: (request: Request, context: { data: any }) => Promise<Response>) =>
      createProtectedRoute(
        (req, ctx) => handler(req, { data: ctx.data }),
        {
          cors: true,
          rateLimit: 'auth',
          maxRequestSize: 16 * 1024, // 16KB
          ...config,
          authentication: false
        }
      );
  }

  /**
   * Password reset endpoints
   */
  static passwordReset(config?: Omit<SecurityConfig, 'authentication' | 'rateLimit'>) {
    return (handler: (request: Request, context: { data: any }) => Promise<Response>) =>
      createProtectedRoute(
        (req, ctx) => handler(req, { data: ctx.data }),
        {
          cors: true,
          rateLimit: 'passwordReset',
          maxRequestSize: 16 * 1024, // 16KB
          ...config,
          authentication: false
        }
      );
  }
}

/**
 * Custom route guard builder for specific requirements
 */
export class RouteGuardBuilder {
  private config: RouteGuardConfig = {};

  cors(enabled: boolean = true) {
    this.config.cors = enabled;
    return this;
  }

  rateLimit(type: 'auth' | 'ai' | 'api' | 'upload' | 'passwordReset' | false) {
    this.config.rateLimit = type;
    return this;
  }

  maxRequestSize(bytes: number) {
    this.config.maxRequestSize = bytes;
    return this;
  }

  authentication(required: boolean = true) {
    this.config.authentication = required;
    return this;
  }

  requireRoles(...roles: UserRole[]) {
    if (!this.config.rbac) this.config.rbac = {};
    this.config.rbac.roles = roles;
    return this;
  }

  requirePermissions(permissions: Permission[], requireAll: boolean = false) {
    if (!this.config.rbac) this.config.rbac = {};
    this.config.rbac.permissions = permissions;
    this.config.rbac.requireAllPermissions = requireAll;
    return this;
  }

  validation(schemas: {
    body?: any;
    params?: any;
    query?: any;
  }) {
    this.config.validation = schemas;
    return this;
  }

  build() {
    return (handler: (request: Request, context: { data: any; user?: any; profile?: any }) => Promise<Response>) =>
      createProtectedRoute(handler as any, this.config);
  }
}

/**
 * Create a custom route guard
 */
export function createRouteGuard() {
  return new RouteGuardBuilder();
}

/**
 * Export commonly used types and classes
 */
export { UserRole, Permission };
