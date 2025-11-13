/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * RBAC (Role-Based Access Control) Authorization Middleware
 * 
 * Provides fine-grained authorization control based on user roles and permissions.
 * Integrates with the security middleware system and supports i18n error messages.
 */

import { createSecureErrorResponse } from './middleware';
import { getUserLanguage, getSecurityMessage } from '../i18n/securityMessages';
import { authService } from '../auth/AuthService';

/**
 * User roles in the system
 */
export enum UserRole {
  STUDENT = 'student',
  INSTRUCTOR = 'instructor', 
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin'
}

/**
 * System permissions
 */
export enum Permission {
  // User management
  MANAGE_USERS = 'manage_users',
  VIEW_USERS = 'view_users',
  
  // Course management
  MANAGE_COURSES = 'manage_courses',
  VIEW_COURSES = 'view_courses',
  ENROLL_COURSES = 'enroll_courses',
  
  // Assignment management  
  MANAGE_ASSIGNMENTS = 'manage_assignments',
  VIEW_ASSIGNMENTS = 'view_assignments',
  SUBMIT_ASSIGNMENTS = 'submit_assignments',
  GRADE_ASSIGNMENTS = 'grade_assignments',
  
  // Enrollment management
  MANAGE_ENROLLMENTS = 'manage_enrollments',
  VIEW_ENROLLMENTS = 'view_enrollments',
  
  // AI features
  USE_AI_FEATURES = 'use_ai_features',
  MANAGE_AI_TIERS = 'manage_ai_tiers',
  
  // System administration
  VIEW_AUDIT_LOGS = 'view_audit_logs',
  MANAGE_SYSTEM = 'manage_system',
}

/**
 * Role-permission matrix defining what each role can do
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.STUDENT]: [
    Permission.VIEW_COURSES,
    Permission.ENROLL_COURSES,
    Permission.VIEW_ASSIGNMENTS, 
    Permission.SUBMIT_ASSIGNMENTS,
    Permission.USE_AI_FEATURES,
  ],
  
  [UserRole.INSTRUCTOR]: [
    Permission.VIEW_USERS,
    Permission.MANAGE_COURSES,
    Permission.VIEW_COURSES,
    Permission.MANAGE_ASSIGNMENTS,
    Permission.VIEW_ASSIGNMENTS,
    Permission.GRADE_ASSIGNMENTS,
    Permission.MANAGE_ENROLLMENTS,
    Permission.VIEW_ENROLLMENTS,
    Permission.USE_AI_FEATURES,
  ],
  
  [UserRole.ADMIN]: [
    Permission.MANAGE_USERS,
    Permission.VIEW_USERS,
    Permission.MANAGE_COURSES,
    Permission.VIEW_COURSES,
    Permission.MANAGE_ASSIGNMENTS,
    Permission.VIEW_ASSIGNMENTS,
    Permission.GRADE_ASSIGNMENTS,
    Permission.MANAGE_ENROLLMENTS,
    Permission.VIEW_ENROLLMENTS,
    Permission.USE_AI_FEATURES,
    Permission.MANAGE_AI_TIERS,
    Permission.VIEW_AUDIT_LOGS,
  ],
  
  [UserRole.SUPER_ADMIN]: [
    ...Object.values(Permission), // Super admin has all permissions
  ],
};

/**
 * Authorization result interface
 */
export interface AuthorizationResult {
  allowed: boolean;
  user?: any;
  profile?: any;
  missingRoles?: UserRole[];
  missingPermissions?: Permission[];
  reason?: string;
}

/**
 * RBAC context for authorization checks
 */
export interface RBACContext {
  request: Request;
  origin?: string;
  environment?: string;
}

/**
 * Check if user has required role(s)
 */
export function hasRole(userRole: UserRole, requiredRoles: UserRole[]): boolean {
  return requiredRoles.includes(userRole);
}

/**
 * Check if user has required permission(s)
 */
export function hasPermission(userRole: UserRole, requiredPermissions: Permission[]): boolean {
  const rolePermissions = ROLE_PERMISSIONS[userRole] || [];
  return requiredPermissions.some(permission => rolePermissions.includes(permission));
}

/**
 * Check if user has ALL required permissions
 */
export function hasAllPermissions(userRole: UserRole, requiredPermissions: Permission[]): boolean {
  const rolePermissions = ROLE_PERMISSIONS[userRole] || [];
  return requiredPermissions.every(permission => rolePermissions.includes(permission));
}

/**
 * Get user's permissions based on their role
 */
export function getUserPermissions(userRole: UserRole): Permission[] {
  return ROLE_PERMISSIONS[userRole] || [];
}

/**
 * Check authorization for current user
 */
export async function checkAuthorization(
  context: RBACContext,
  requirements: {
    roles?: UserRole[];
    permissions?: Permission[];
    requireAllPermissions?: boolean; // If true, user must have ALL permissions, not just one
  }
): Promise<AuthorizationResult> {
  const { request, origin, environment } = context;
  
  // Get current authenticated user
  const user = authService.getCurrentUser();
  const profile = authService.getCurrentProfile();
  
  if (!user || !profile) {
    return {
      allowed: false,
      reason: 'User not authenticated',
    };
  }
  
  const userRole = profile.role as UserRole;
  if (!userRole) {
    return {
      allowed: false,
      user,
      profile,
      reason: 'User role not found',
    };
  }
  
  // Check role requirements
  if (requirements.roles && requirements.roles.length > 0) {
    if (!hasRole(userRole, requirements.roles)) {
      return {
        allowed: false,
        user,
        profile,
        missingRoles: requirements.roles,
        reason: `User role '${userRole}' does not match required roles: ${requirements.roles.join(', ')}`,
      };
    }
  }
  
  // Check permission requirements
  if (requirements.permissions && requirements.permissions.length > 0) {
    const hasRequiredPermissions = requirements.requireAllPermissions
      ? hasAllPermissions(userRole, requirements.permissions)
      : hasPermission(userRole, requirements.permissions);
      
    if (!hasRequiredPermissions) {
      const userPermissions = getUserPermissions(userRole);
      const missingPermissions = requirements.permissions.filter(
        permission => !userPermissions.includes(permission)
      );
      
      return {
        allowed: false,
        user,
        profile,
        missingPermissions,
        reason: requirements.requireAllPermissions
          ? `User missing required permissions: ${missingPermissions.join(', ')}`
          : `User has none of the required permissions: ${requirements.permissions.join(', ')}`,
      };
    }
  }
  
  return {
    allowed: true,
    user,
    profile,
  };
}

/**
 * Authorization middleware factory
 */
export function requireAuthorization(requirements: {
  roles?: UserRole[];
  permissions?: Permission[];
  requireAllPermissions?: boolean;
}) {
  return async (
    request: Request,
    origin?: string,
    environment?: string
  ): Promise<Response | { success: true; user: any; profile: any }> => {
    const context: RBACContext = { request, origin, environment };
    const authResult = await checkAuthorization(context, requirements);
    
    if (!authResult.allowed) {
      const userLanguage = getUserLanguage(request);
      
      return createSecureErrorResponse(
        {
          error: getSecurityMessage('errors.insufficientPermissions', { lng: userLanguage }),
          reason: authResult.reason,
          required: {
            roles: requirements.roles,
            permissions: requirements.permissions,
          },
          missing: {
            roles: authResult.missingRoles,
            permissions: authResult.missingPermissions,
          },
        },
        403,
        origin,
        environment
      );
    }
    
    return {
      success: true,
      user: authResult.user,
      profile: authResult.profile,
    };
  };
}

/**
 * Convenience functions for common authorization patterns
 */
export const requireRole = (roles: UserRole | UserRole[]) =>
  requireAuthorization({ roles: Array.isArray(roles) ? roles : [roles] });

export const requirePermission = (permissions: Permission | Permission[], requireAll: boolean = false) =>
  requireAuthorization({ 
    permissions: Array.isArray(permissions) ? permissions : [permissions],
    requireAllPermissions: requireAll 
  });

export const requireAdmin = () => requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]);

export const requireInstructor = () => requireRole([UserRole.INSTRUCTOR, UserRole.ADMIN, UserRole.SUPER_ADMIN]);

export const requireStudent = () => requireRole(UserRole.STUDENT);

/**
 * Predefined RBAC middleware for common authorization scenarios
 */
export const RBACMiddleware = {
  /**
   * Admin-only endpoints
   */
  adminOnly: requireAdmin(),
  
  /**
   * Instructor or admin endpoints
   */
  instructorOnly: requireInstructor(),
  
  /**
   * Student-only endpoints
   */
  studentOnly: requireStudent(),
  
  /**
   * Course management (Instructor or Admin)
   */
  courseManagement: requirePermission(Permission.MANAGE_COURSES),
  
  /**
   * User management (Admin only)
   */
  userManagement: requirePermission(Permission.MANAGE_USERS),
  
  /**
   * Assignment management (Instructor or Admin)
   */
  assignmentManagement: requirePermission(Permission.MANAGE_ASSIGNMENTS),
  
  /**
   * AI features access
   */
  aiFeatures: requirePermission(Permission.USE_AI_FEATURES),
  
  /**
   * Audit log viewing (Admin only)
   */
  auditLogs: requirePermission(Permission.VIEW_AUDIT_LOGS),
};

/**
 * Resource ownership check - used for checking if user owns/can access specific resources
 */
export function checkResourceOwnership(
  userRole: UserRole,
  userId: string,
  resourceOwnerId: string,
  resourceType: 'course' | 'assignment' | 'submission' | 'user'
): boolean {
  // Super admin and admin can access all resources
  if (userRole === UserRole.SUPER_ADMIN || userRole === UserRole.ADMIN) {
    return true;
  }
  
  // Users can always access their own resources
  if (userId === resourceOwnerId) {
    return true;
  }
  
  // Instructors can access courses and assignments they created
  if (userRole === UserRole.INSTRUCTOR) {
    if (resourceType === 'course' || resourceType === 'assignment') {
      return userId === resourceOwnerId;
    }
  }
  
  return false;
}

/**
 * Export all role and permission types for external use
 */
export { UserRole as Role };
