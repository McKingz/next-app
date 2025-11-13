/**
 * Client-side tenant context helpers for multi-tenant isolation
 * Provides consistent access to current school/organization ID across the app
 */

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';
import { track } from '@/lib/analytics';

export type TenantInfo = {
  schoolId: string;
  schoolName?: string;
  role: string;
  permissions: string[];
};

/**
 * Hook to get current active school ID for the authenticated user
 * Returns null if no school is assigned or user is not authenticated
 */
export function useActiveSchoolId(): string | null {
  const { user, profile } = useAuth();
  
  // First try to get from enhanced profile (most reliable)
  if (profile?.organization_id) {
    return profile.organization_id;
  }
  
  // Fallback to user metadata (for backwards compatibility)
  if (user?.user_metadata?.preschool_id) {
    return user.user_metadata.preschool_id;
  }
  
  return null;
}

/**
 * Hook to get comprehensive tenant information
 */
export function useTenantInfo(): {
  tenantInfo: TenantInfo | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
} {
  const { user, profile, loading: authLoading } = useAuth();
  const [tenantInfo, setTenantInfo] = useState<TenantInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTenantInfo = useCallback(async () => {
    if (!user || authLoading) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Try to get from profile first
      let schoolId = profile?.organization_id;
      let schoolName = profile?.organization_name;
      const role = profile?.role || 'unknown';

      // If not in profile, query profiles table
      if (!schoolId) {
        const { data: userProfile, error: userError } = await assertSupabase()
          .from('profiles')
          .select('preschool_id, role')
          .eq('id', user.id)
          .single();

        if (userError) {
          throw new Error(`Failed to fetch user profile: ${userError.message}`);
        }

        schoolId = userProfile?.preschool_id;
      }

      // If still no school ID, user might not be assigned to a school
      if (!schoolId) {
        setTenantInfo(null);
        track('tenant.no_school_assigned', { user_id: user.id, role });
        return;
      }

      // Get school details if we don't have them
      if (!schoolName) {
        const { data: schoolData, error: schoolError } = await assertSupabase()
          .from('preschools')
          .select('name')
          .eq('id', schoolId)
          .single();

        if (!schoolError && schoolData) {
          schoolName = schoolData.name;
        }
      }

      // Fallback: try organizations if no preschool found
      if (!schoolName) {
        const { data: orgData, error: orgError } = await assertSupabase()
          .from('organizations')
          .select('name')
          .eq('id', schoolId)
          .single();

        if (!orgError && orgData) {
          schoolName = orgData.name;
        }
      }

      // Get user permissions/capabilities
      const permissions = profile?.capabilities || [];

      const info: TenantInfo = {
        schoolId,
        schoolName,
        role,
        permissions,
      };

      setTenantInfo(info);
      
      track('tenant.context_loaded', {
        user_id: user.id,
        school_id: schoolId,
        role,
        permissions_count: permissions.length,
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load tenant info';
      setError(errorMessage);
      console.error('Error fetching tenant info:', err);
      
      track('tenant.load_error', {
        user_id: user.id,
        error: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  }, [user, profile, authLoading]);

  useEffect(() => {
    fetchTenantInfo();
  }, [fetchTenantInfo]);

  return {
    tenantInfo,
    loading,
    error,
    refetch: fetchTenantInfo,
  };
}

/**
 * Validate that current user has access to a specific school
 */
export function useValidateSchoolAccess() {
  const { user, profile } = useAuth();
  
  return useCallback(async (schoolId: string): Promise<boolean> => {
    if (!user || !schoolId) return false;
    
    // Super admins can access any school
    if (profile?.role === 'super_admin') return true;
    
    // Check if user belongs to this school
    const userSchoolId = profile?.organization_id;
    if (userSchoolId === schoolId) return true;
    
    // Additional check for cross-school access (e.g., district admin)
    try {
      const { data, error } = await assertSupabase()
        .from('user_school_memberships')
        .select('school_id')
        .eq('user_id', user.id)
        .eq('school_id', schoolId)
        .eq('status', 'active')
        .single();
        
      return !error && !!data;
    } catch {
      return false;
    }
  }, [user, profile]);
}

/**
 * Ensure query is properly tenant-scoped
 * Throws error if schoolId is missing for non-super-admin users
 */
export function ensureTenantScope(schoolId: string | null, userRole?: string): string {
  if (userRole === 'super_admin') {
    // Super admins can operate without tenant scope in some cases
    if (!schoolId) {
      throw new Error('School ID required even for super admin operations');
    }
  }
  
  if (!schoolId) {
    throw new Error('School ID is required for this operation');
  }
  
  return schoolId;
}

/**
 * Get current school ID or throw error if not available
 */
export function requireSchoolId(profile: any): string {
  const schoolId = profile?.organization_id;
  
  if (!schoolId) {
    throw new Error('No school assigned to current user');
  }
  
  return schoolId;
}