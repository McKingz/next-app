/**
 * Server-side tenant context helpers for multi-tenant isolation
 * NOTE: This is adapted for React Native/Expo app context
 * For true server-side operations (when/if we add server actions), use proper cookies
 */

import { assertSupabase } from '@/lib/supabase';
import { track } from '@/lib/analytics';

export type ServerTenantContext = {
  schoolId: string;
  userId: string;
  role: string;
  capabilities?: string[];
};

/**
 * Get tenant context from user session
 * This works in React Native context where we have access to the authenticated Supabase client
 */
export async function getTenantContext(): Promise<ServerTenantContext | null> {
  try {
    // Get current authenticated user
    const { data: { user }, error: userError } = await assertSupabase().auth.getUser();
    
    if (userError || !user) {
      console.warn('No authenticated user found');
      return null;
    }

    // Get user profile with organization info
    const { data: profile, error: profileError } = await assertSupabase()
      .from('profiles')
      .select(`
        preschool_id,
        role,
        capabilities,
        preschools!inner(id, name)
      `)
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('Failed to fetch user profile:', profileError);
      return null;
    }

    const schoolId = profile.preschool_id;
    if (!schoolId) {
      console.warn('User has no school assigned');
      return null;
    }

    return {
      schoolId,
      userId: user.id,
      role: profile.role,
      capabilities: profile.capabilities || [],
    };
  } catch (error) {
    console.error('Error getting tenant context:', error);
    return null;
  }
}

/**
 * Validate school access for current user
 */
export async function validateSchoolAccess(schoolId: string): Promise<boolean> {
  try {
    const context = await getTenantContext();
    
    if (!context) {
      return false;
    }

    // Super admins can access any school
    if (context.role === 'super_admin') {
      return true;
    }

    // Check if user belongs to this school
    if (context.schoolId === schoolId) {
      return true;
    }

    // Check for cross-school membership (future feature)
    const { data: membership } = await assertSupabase()
      .from('user_school_memberships')
      .select('school_id')
      .eq('user_id', context.userId)
      .eq('school_id', schoolId)
      .eq('status', 'active')
      .single();

    return !!membership;
  } catch (error) {
    console.error('Error validating school access:', error);
    return false;
  }
}

/**
 * Get school context with validation
 * Throws error if user doesn't have access
 */
export async function requireSchoolAccess(schoolId: string): Promise<ServerTenantContext> {
  const context = await getTenantContext();
  
  if (!context) {
    throw new Error('User not authenticated');
  }

  const hasAccess = await validateSchoolAccess(schoolId);
  
  if (!hasAccess) {
    // Log security event
    track('security.unauthorized_school_access', {
      user_id: context.userId,
      requested_school_id: schoolId,
      user_school_id: context.schoolId,
      role: context.role,
    });
    
    throw new Error('Access denied to requested school');
  }

  return {
    ...context,
    schoolId, // Use the requested school ID
  };
}

/**
 * Create tenant-scoped Supabase query builder
 */
export function createTenantQuery(tableName: string, schoolId: string) {
  return assertSupabase()
    .from(tableName)
    .select('*')
    .eq('preschool_id', schoolId) as any;
}

/**
 * Create tenant-scoped query with RLS enforcement
 * This adds the school_id filter and relies on RLS for additional security
 */
export class TenantQueryBuilder {
  private schoolId: string;
  private context: ServerTenantContext;

  constructor(context: ServerTenantContext) {
    this.schoolId = context.schoolId;
    this.context = context;
  }

  /**
   * Create base query for any table with tenant scoping
   */
  table(tableName: string) {
    return assertSupabase()
      .from(tableName)
      .select('*')
      .eq('preschool_id', this.schoolId) as any;
  }

  /**
   * Petty cash transactions query
   */
  pettyCashTransactions() {
    return this.table('petty_cash_transactions');
  }

  /**
   * Petty cash accounts query
   */
  pettyCashAccounts() {
    return this.table('petty_cash_accounts');
  }

  /**
   * Petty cash receipts query
   */
  pettyCashReceipts() {
    return this.table('petty_cash_receipts');
  }

  /**
   * Students query
   */
  students() {
    return this.table('students');
  }

  /**
   * Teachers query
   */
  teachers() {
    return this.table('teachers');
  }

  /**
   * Classes query
   */
  classes() {
    return this.table('classes');
  }

  /**
   * School settings query
   */
  schoolSettings() {
    return this.table('school_settings');
  }

  /**
   * Financial transactions query
   */
  financialTransactions() {
    return this.table('financial_transactions');
  }

  /**
   * Insert with automatic tenant scoping
   */
  async insert(tableName: string, data: any) {
    const insertData = {
      ...data,
      preschool_id: this.schoolId,
      created_by: data.created_by || this.context.userId,
    };

    return assertSupabase()
      .from(tableName)
      .insert(insertData);
  }

  /**
   * Update with tenant validation
   */
  async update(tableName: string, data: any, filters: Record<string, any>) {
    return assertSupabase()
      .from(tableName)
      .update(data)
      .eq('preschool_id', this.schoolId)
      .match(filters);
  }

  /**
   * Delete with tenant validation
   */
  async delete(tableName: string, filters: Record<string, any>) {
    return assertSupabase()
      .from(tableName)
      .delete()
      .eq('preschool_id', this.schoolId)
      .match(filters);
  }
}

/**
 * Create tenant query builder with context
 */
export async function createTenantQueryBuilder(schoolId?: string): Promise<TenantQueryBuilder> {
  const context = await getTenantContext();
  
  if (!context) {
    throw new Error('User not authenticated');
  }

  // Use provided school ID or user's default school
  const targetSchoolId = schoolId || context.schoolId;
  
  // Validate access if different from user's default school
  if (schoolId && schoolId !== context.schoolId) {
    const hasAccess = await validateSchoolAccess(schoolId);
    if (!hasAccess) {
      throw new Error('Access denied to requested school');
    }
  }

  return new TenantQueryBuilder({
    ...context,
    schoolId: targetSchoolId,
  });
}

/**
 * Execute function with tenant context
 * Provides consistent error handling and logging
 */
export async function withTenantContext<T>(
  schoolId: string,
  fn: (context: ServerTenantContext, queryBuilder: TenantQueryBuilder) => Promise<T>
): Promise<T> {
  try {
    const context = await requireSchoolAccess(schoolId);
    const queryBuilder = new TenantQueryBuilder(context);
    
    return await fn(context, queryBuilder);
  } catch (error) {
    console.error('Tenant context operation failed:', error);
    
    // Track error for monitoring
    const context = await getTenantContext();
    if (context) {
      track('tenant.operation_error', {
        user_id: context.userId,
        school_id: schoolId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
    
    throw error;
  }
}