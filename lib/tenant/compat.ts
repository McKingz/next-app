/**
 * Tenant Compatibility Layer
 * Provides organization-first API while maintaining backward compatibility with school-based code
 */

import type { OrganizationType } from './types';

/**
 * Get active organization ID from user profile
 * Primary method - use this for new code
 */
export function getActiveOrganizationId(profile: any): string | null {
  if (!profile) return null;
  
  // Try organization_id first (new standard)
  if (profile.organization_id) {
    return profile.organization_id;
  }
  
  // Fallback to preschool_id for legacy compatibility
  if (profile.preschool_id) {
    return profile.preschool_id;
  }
  
  // Try alternate field names
  if (profile.organizationId) {
    return profile.organizationId;
  }
  
  if (profile.preschoolId) {
    return profile.preschoolId;
  }
  
  return null;
}

/**
 * Require organization ID or throw error
 * Use this when organization context is mandatory
 */
export function requireOrganizationId(profile: any): string {
  const orgId = getActiveOrganizationId(profile);
  
  if (!orgId) {
    throw new Error('No organization assigned to current user');
  }
  
  return orgId;
}

/**
 * Ensure query is properly tenant-scoped
 * Throws error if organizationId is missing for non-super-admin users
 */
export function ensureTenantScope(organizationId: string | null, userRole?: string): string {
  if (userRole === 'super_admin' || userRole === 'superadmin') {
    // Super admins can operate without tenant scope in some cases
    if (!organizationId) {
      throw new Error('Organization ID required even for super admin operations');
    }
  }
  
  if (!organizationId) {
    throw new Error('Organization ID is required for this operation');
  }
  
  return organizationId;
}

/**
 * Get organization type from profile or organization data
 */
export function getOrganizationType(
  profile: any,
  organizationData?: any
): OrganizationType {
  // Try organization data first
  if (organizationData?.type) {
    return organizationData.type as OrganizationType;
  }
  
  // Try profile metadata
  if (profile?.organization_type) {
    return profile.organization_type as OrganizationType;
  }
  
  // Default to preschool for backward compatibility
  return 'preschool';
}

/**
 * Check if organization ID is valid (UUID format)
 */
export function isValidOrganizationId(id: string | null | undefined): boolean {
  if (!id) return false;
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

// ============================================================================
// DEPRECATED: Legacy school-based API
// These functions are kept for backward compatibility but should not be used in new code
// ============================================================================

/**
 * @deprecated Use getActiveOrganizationId instead
 */
export function getActiveSchoolId(profile: any): string | null {
  return getActiveOrganizationId(profile);
}

/**
 * @deprecated Use requireOrganizationId instead
 */
export function requireSchoolId(profile: any): string {
  return requireOrganizationId(profile);
}

/**
 * @deprecated Use ensureTenantScope instead
 */
export function ensureSchoolScope(schoolId: string | null, userRole?: string): string {
  return ensureTenantScope(schoolId, userRole);
}

// ============================================================================
// Database field mapping helpers
// ============================================================================

/**
 * Get the appropriate database field name for organization ID filtering
 * Helps with gradual migration from preschool_id to organization_id
 */
export function getOrganizationIdFieldName(
  tableName?: string,
  preferLegacy: boolean = false
): 'organization_id' | 'preschool_id' {
  // For now, most tables still use preschool_id
  // As we migrate tables, we can add logic here to determine the correct field
  
  if (preferLegacy) {
    return 'preschool_id';
  }
  
  // Tables that have been migrated to use organization_id
  const migratedTables = new Set([
    'organizations',
    'organization_roles',
    'users',
    // Add more tables as they are migrated
  ]);
  
  if (tableName && migratedTables.has(tableName)) {
    return 'organization_id';
  }
  
  // Default to preschool_id for backward compatibility
  return 'preschool_id';
}

/**
 * Create a filter object with the appropriate organization ID field
 * Abstracts away the difference between preschool_id and organization_id
 */
export function createOrganizationFilter(
  organizationId: string,
  tableName?: string
): Record<string, string> {
  const fieldName = getOrganizationIdFieldName(tableName);
  return { [fieldName]: organizationId };
}

/**
 * Get organization ID from various possible sources
 * Useful when dealing with API responses or database rows
 */
export function extractOrganizationId(data: any): string | null {
  if (!data) return null;
  
  return (
    data.organization_id ||
    data.organizationId ||
    data.preschool_id ||
    data.preschoolId ||
    data.school_id ||
    data.schoolId ||
    null
  );
}

/**
 * Normalize an object to use organization_id consistently
 * Useful for API responses and data transformation
 */
export function normalizeOrganizationId<T extends Record<string, any>>(data: T): T & { organization_id: string } {
  const orgId = extractOrganizationId(data);
  
  if (!orgId) {
    throw new Error('Cannot normalize object without organization identifier');
  }
  
  return {
    ...data,
    organization_id: orgId,
  };
}

/**
 * Create a backward-compatible object with both organization_id and schoolId
 * Useful during migration period
 */
export function createCompatibleOrganizationObject(organizationId: string): {
  organization_id: string;
  organizationId: string;
  /** @deprecated */ school_id: string;
  /** @deprecated */ schoolId: string;
  /** @deprecated */ preschool_id: string;
  /** @deprecated */ preschoolId: string;
} {
  return {
    organization_id: organizationId,
    organizationId: organizationId,
    school_id: organizationId,
    schoolId: organizationId,
    preschool_id: organizationId,
    preschoolId: organizationId,
  };
}
