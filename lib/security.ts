/**
 * Client-side security utilities for database access and RLS policy compliance
 * Works in conjunction with server-side RLS policies to ensure data security
 */

import { assertSupabase } from '@/lib/supabase';
import { type Role, type Capability } from '@/lib/rbac';
import { track } from '@/lib/analytics';
import { reportError } from '@/lib/monitoring';

export type SecurityContext = {
  userId: string;
  role: Role;
  organizationId?: string;
  capabilities: Capability[];
  seatStatus?: string;
};

/**
 * Security-aware database query builder
 * Automatically applies appropriate filters based on user context
 */
export class SecureQueryBuilder {
  private context: SecurityContext;

  constructor(context: SecurityContext) {
    this.context = context;
  }

  /**
   * Build secure query for profiles table
   */
  profiles() {
    const query = assertSupabase().from('profiles').select('*');

    // Apply role-based filters
    if (this.context.role === 'super_admin') {
      // Super admins can see all profiles (RLS handles this)
      return query;
    } else if (['principal_admin', 'principal', 'admin'].includes(this.context.role)) {
      // Org admins can see profiles in their organization
      return query.eq('preschool_id', this.context.organizationId);
    } else {
      // Regular users can only see their own profile
      return query.eq('id', this.context.userId);
    }
  }

  /**
   * Build secure query for teachers table
   */
  teachers() {
    const query = assertSupabase().from('teachers').select('*');

    if (this.context.role === 'super_admin') {
      return query;
    } else if (['principal_admin', 'principal', 'admin'].includes(this.context.role)) {
      return query.eq('preschool_id', this.context.organizationId);
    } else if (this.context.role === 'teacher') {
      // Teachers can see colleagues in same org (if they have active seat)
      if (this.context.seatStatus === 'active') {
        return query.eq('preschool_id', this.context.organizationId);
      } else {
        // Only own record if seat is inactive
        return query.eq('user_id', this.context.userId);
      }
    } else {
      // Parents and others cannot access teacher data
      return query.eq('user_id', null); // Will return no results
    }
  }

  /**
   * Build secure query for students table
   */
  students() {
    const query = assertSupabase().from('students').select('*,age_groups!students_age_group_id_fkey(*)');

    if (this.context.role === 'super_admin') {
      return query;
    } else if (['principal_admin', 'principal', 'admin'].includes(this.context.role)) {
      return query.eq('preschool_id', this.context.organizationId);
    } else if (this.context.role === 'teacher' && this.context.seatStatus === 'active') {
      return query.eq('preschool_id', this.context.organizationId);
    } else if (this.context.role === 'parent') {
      // Parents can only see their own children (including as guardian)
      return query.or(`parent_id.eq.${this.context.userId},guardian_id.eq.${this.context.userId}`);
    } else {
      return query.eq('parent_id', null); // Will return no results
    }
  }

  /**
   * Build secure query for classes table
   */
  classes() {
    const query = assertSupabase().from('classes').select('*');

    if (this.context.role === 'super_admin') {
      return query;
    } else if (['principal_admin', 'principal', 'admin'].includes(this.context.role)) {
      return query.eq('preschool_id', this.context.organizationId);
    } else if (this.context.role === 'teacher' && this.context.seatStatus === 'active') {
      return query.eq('preschool_id', this.context.organizationId);
    } else if (this.context.role === 'parent') {
      // Parents can see classes their children are enrolled in
      // This requires a join with students table
      // NOTE: Client-side subqueries are limited; prefer server-side RPC.
      // As a safe client-side guard, scope to organization; RLS will further enforce visibility.
      return query.eq('preschool_id', this.context.organizationId);
    } else {
      return query.eq('preschool_id', null); // Will return no results
    }
  }

  /**
   * Build secure query for enterprise leads (super admin only)
   */
  enterpriseLeads() {
    const query = assertSupabase().from('enterprise_leads').select('*');

    if (this.context.role === 'super_admin') {
      return query;
    } else {
      // Only super admins can access leads
      return query.eq('id', null); // Will return no results
    }
  }

  /**
   * Build secure query for audit logs (super admin only)
   */
  auditLogs() {
    const query = assertSupabase().from('audit_logs').select('*');

    if (this.context.role === 'super_admin') {
      return query;
    } else {
      return query.eq('id', null); // Will return no results
    }
  }
}

/**
 * Security guard for sensitive operations
 */
export class SecurityGuard {
  private context: SecurityContext;

  constructor(context: SecurityContext) {
    this.context = context;
  }

  /**
   * Check if user can perform operation on resource
   */
  canAccess(resource: string, operation: 'read' | 'write' | 'delete', resourceOrgId?: string): boolean {
    // Super admins can do everything
    if (this.context.role === 'super_admin') {
      return true;
    }

    // Check organization-scoped permissions
    if (resourceOrgId && resourceOrgId !== this.context.organizationId) {
      return false; // Cannot access resources outside own organization
    }

    switch (resource) {
      case 'profiles':
        if (['principal_admin', 'principal', 'admin'].includes(this.context.role)) {
          return operation === 'read' || (operation === 'write' && resourceOrgId === this.context.organizationId);
        }
        return false;

      case 'teachers':
        if (['principal_admin', 'principal', 'admin'].includes(this.context.role)) {
          return true;
        }
        if (this.context.role === 'teacher' && operation === 'read') {
          return this.context.seatStatus === 'active';
        }
        return false;

      case 'students':
        if (['principal_admin', 'principal', 'admin'].includes(this.context.role)) {
          return true;
        }
        if (this.context.role === 'teacher' && this.context.seatStatus === 'active') {
          return operation === 'read' || operation === 'write';
        }
        if (this.context.role === 'parent') {
          return operation === 'read';
        }
        return false;

      case 'classes':
        if (['principal_admin', 'principal', 'admin'].includes(this.context.role)) {
          return true;
        }
        if (this.context.role === 'teacher' && this.context.seatStatus === 'active') {
          return operation === 'read' || operation === 'write';
        }
        if (this.context.role === 'parent') {
          return operation === 'read';
        }
        return false;

      case 'enterprise_leads':
        return false; // Only super admins (handled above)

      default:
        return false;
    }
  }

  /**
   * Throw error if user cannot access resource
   */
  requireAccess(resource: string, operation: 'read' | 'write' | 'delete', resourceOrgId?: string): void {
    if (!this.canAccess(resource, operation, resourceOrgId)) {
      const error = new Error(`Access denied: Cannot ${operation} ${resource}`);
      reportError(error, {
        userId: this.context.userId,
        role: this.context.role,
        resource,
        operation,
        resourceOrgId,
        userOrgId: this.context.organizationId,
      });
      throw error;
    }
  }

  /**
   * Log security audit event
   */
  logSecurityEvent(event: string, details: Record<string, any>): void {
    track('edudash.security.event', {
      user_id: this.context.userId,
      role: this.context.role,
      organization_id: this.context.organizationId,
      event,
      ...details,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Secure database operation wrapper
 * Automatically applies security checks and logging
 */
export class SecureDatabase {
  private context: SecurityContext;
  private queryBuilder: SecureQueryBuilder;
  private guard: SecurityGuard;

  constructor(context: SecurityContext) {
    this.context = context;
    this.queryBuilder = new SecureQueryBuilder(context);
    this.guard = new SecurityGuard(context);
  }

  /**
   * Execute secure query with automatic security checks
   */
  async query<T = any>(
    table: string,
    operation: 'read' | 'write' | 'delete',
    options: {
      resourceOrgId?: string;
      trackEvent?: boolean;
      customQuery?: any;
    } = {}
  ): Promise<{ data: T[] | null; error: any }> {
    const { resourceOrgId, trackEvent = true, customQuery } = options;

    try {
      // Check permissions
      this.guard.requireAccess(table, operation, resourceOrgId);

      // Use custom query or build secure query
      const query = customQuery || this.getTableQuery(table);

      // Execute query
      const result = await query;

      // Log successful access
      if (trackEvent) {
        this.guard.logSecurityEvent('database_access', {
          table,
          operation,
          success: !result.error,
          error: result.error?.message,
        });
      }

      return result;
    } catch (error: any) {
      // Log failed access attempt
      if (trackEvent) {
        this.guard.logSecurityEvent('access_denied', {
          table,
          operation,
          error: error.message,
        });
      }

      return { data: null, error };
    }
  }

  /**
   * Get appropriate secure query for table
   */
  private getTableQuery(table: string) {
    switch (table) {
      case 'profiles':
        return this.queryBuilder.profiles();
      case 'teachers':
        return this.queryBuilder.teachers();
      case 'students':
        return this.queryBuilder.students();
      case 'classes':
        return this.queryBuilder.classes();
      case 'enterprise_leads':
        return this.queryBuilder.enterpriseLeads();
      case 'audit_logs':
        return this.queryBuilder.auditLogs();
      default:
        throw new Error(`Unsupported table: ${table}`);
    }
  }

  /**
   * Execute secure write operation
   */
  async secureWrite(
    table: string,
    data: any,
    options: {
      resourceOrgId?: string;
      operation?: 'insert' | 'update' | 'upsert';
    } = {}
  ) {
    const { resourceOrgId, operation = 'insert' } = options;

    try {
      this.guard.requireAccess(table, 'write', resourceOrgId);

      // Ensure organization scoping for write operations
      if (this.context.organizationId && !data.preschool_id) {
        data.preschool_id = this.context.organizationId;
      }

      let query;
      switch (operation) {
        case 'insert':
          query = assertSupabase().from(table).insert(data);
          break;
        case 'update':
          query = assertSupabase().from(table).update(data);
          break;
        case 'upsert':
          query = assertSupabase().from(table).upsert(data);
          break;
        default:
          throw new Error(`Unsupported write operation: ${operation}`);
      }

      const result = await query;

      this.guard.logSecurityEvent('database_write', {
        table,
        operation,
        success: !result.error,
        error: result.error?.message,
      });

      return result;
    } catch (error: any) {
      this.guard.logSecurityEvent('write_denied', {
        table,
        operation,
        error: error.message,
      });

      return { data: null, error };
    }
  }
}

/**
 * Create secure database instance for user context
 */
export function createSecureDatabase(context: SecurityContext): SecureDatabase {
  return new SecureDatabase(context);
}

/**
 * Validate that a resource belongs to user's organization
 */
export function validateOrganizationAccess(
  resourceOrgId: string | null,
  userOrgId: string | null,
  userRole: Role
): boolean {
  // Super admins can access anything
  if (userRole === 'super_admin') {
    return true;
  }

  // Must have matching organization IDs
  return resourceOrgId === userOrgId && userOrgId !== null;
}

/**
 * Sanitize data for client-side display (remove sensitive fields)
 */
export function sanitizeUserData(data: any, viewerRole: Role, viewerOrgId?: string): any {
  if (!data) return data;

  // Always remove sensitive system fields
  const sanitized = { ...data };
  delete sanitized.password;
  delete sanitized.password_hash;
  delete sanitized.reset_token;
  delete sanitized.confirmation_token;

  // Role-based field filtering
  if (viewerRole !== 'super_admin') {
    // Remove admin-only fields
    delete sanitized.created_at;
    delete sanitized.updated_at;
    delete sanitized.last_login_at;
    
    // Remove organization-sensitive fields for non-org members
    if (data.preschool_id !== viewerOrgId) {
      delete sanitized.phone;
      delete sanitized.address;
      delete sanitized.emergency_contact;
    }

    // Remove role-specific sensitive fields
    if (viewerRole === 'parent') {
      delete sanitized.salary;
      delete sanitized.employment_details;
      delete sanitized.performance_notes;
    }
  }

  return sanitized;
}

/**
 * Error messages for security violations
 */
export const SecurityErrors = {
  ACCESS_DENIED: 'Access denied: insufficient permissions',
  INVALID_ORG: 'Access denied: resource not in your organization',
  INACTIVE_SEAT: 'Access denied: seat not active',
  INVALID_ROLE: 'Access denied: invalid role for this operation',
  EXPIRED_SESSION: 'Access denied: session expired',
  RATE_LIMITED: 'Access denied: too many requests',
} as const;
