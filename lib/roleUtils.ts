/**
 * Role utility functions for consistent role checking across the application
 */

export type UserRole = 'parent' | 'teacher' | 'principal' | 'principal_admin' | 'super_admin';

/**
 * Check if a user has super admin privileges
 * Handles all possible super admin role variants for maximum compatibility
 */
export function isSuperAdmin(role?: string | null): boolean {
  if (!role) return false;
  const normalizedRole = String(role).trim().toLowerCase();
  
  // Check for all possible super admin role variants
  return normalizedRole === 'super_admin' || 
         normalizedRole === 'superadmin' ||
         normalizedRole === 'super-admin' ||
         normalizedRole === 'admin' ||
         normalizedRole === 'platform_admin';
}

/**
 * Check if a user has principal-level privileges (principal or super admin)
 */
export function isPrincipalOrAbove(role?: string | null): boolean {
  if (!role) return false;
  const normalizedRole = String(role).trim().toLowerCase();
  
  return isSuperAdmin(role) ||
         normalizedRole === 'principal' ||
         normalizedRole === 'principal_admin';
}

/**
 * Check if a user has teacher-level privileges or above
 */
export function isTeacherOrAbove(role?: string | null): boolean {
  if (!role) return false;
  const normalizedRole = String(role).trim().toLowerCase();
  
  return isPrincipalOrAbove(role) ||
         normalizedRole === 'teacher';
}

/**
 * Get a human-readable display name for a role
 */
export function getRoleDisplayName(role?: string | null): string {
  if (!role) return 'Unknown';
  
  const normalizedRole = String(role).trim().toLowerCase();
  
  switch (normalizedRole) {
    case 'super_admin':
    case 'superadmin':
    case 'super-admin':
    case 'admin':
    case 'platform_admin':
      return 'Super Admin';
    case 'principal':
      return 'Principal';
    case 'principal_admin':
      return 'Principal Admin';
    case 'teacher':
      return 'Teacher';
    case 'parent':
      return 'Parent';
    default:
      return role.charAt(0).toUpperCase() + role.slice(1);
  }
}

/**
 * Normalize role value to the standard format used in the system
 */
export function normalizeRole(role?: string | null): UserRole | null {
  if (!role) return null;
  
  const normalizedRole = String(role).trim().toLowerCase();
  
  if (isSuperAdmin(role)) return 'super_admin';
  if (normalizedRole === 'principal') return 'principal';
  if (normalizedRole === 'principal_admin') return 'principal_admin';
  if (normalizedRole === 'teacher') return 'teacher';
  if (normalizedRole === 'parent') return 'parent';
  
  return null;
}

/**
 * Roles that can manage AI quota allocations
 */
export const PRINCIPAL_ROLES = new Set(['principal', 'principal_admin', 'super_admin']);

/**
 * Check if a user role can manage AI quota allocations
 */
export function canManageAllocationsRole(role?: string | null): boolean {
  if (!role) return false;
  const normalizedRole = String(role).trim().toLowerCase();
  return PRINCIPAL_ROLES.has(normalizedRole as UserRole) || isSuperAdmin(role);
}

/**
 * Check if a user is a teacher
 */
export function isTeacher(role?: string | null): boolean {
  if (!role) return false;
  const normalizedRole = String(role).trim().toLowerCase();
  return normalizedRole === 'teacher';
}

/**
 * Derive canonical preschool ID from enhanced profile
 * Handles different profile structures for scope resolution
 */
export function derivePreschoolId(profile: any | null | undefined): string | null {
  if (!profile) return null;
  
  // Try different possible field names based on your schema
  return profile.preschool_id || 
         profile.preschoolId || 
         profile.organization_id || 
         profile.organizationId || 
         profile.school_id ||
         profile.schoolId ||
         null;
}

/**
 * Get allocation scope for a profile
 */
export function getAllocationScope(profile: any | null | undefined) {
  const preschoolId = derivePreschoolId(profile);
  return { preschoolId };
}
