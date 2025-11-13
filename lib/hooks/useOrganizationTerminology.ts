/**
 * useOrganizationTerminology Hook
 * Provides type-aware terminology for UI components based on organization type
 */

import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  getTerminologyWithFallback,
  getRoleDisplayName,
  getRolePluralName,
} from '../tenant/terminology';
import type { OrganizationType, TerminologyMap } from '../tenant/types';

export interface OrganizationTerminology extends TerminologyMap {
  // Helper methods
  getRoleLabel: (role: string) => string;
  getRoleLabelPlural: (role: string) => string;
  orgType: OrganizationType;
}

/**
 * Hook to access organization-specific terminology
 * Automatically adapts labels based on the current organization type
 * 
 * @example
 * ```tsx
 * const { terminology } = useOrganizationTerminology();
 * 
 * <Text>Add a new {terminology.member}</Text>
 * // Preschool: "Add a new Student"
 * // Sports Club: "Add a new Athlete"
 * // Corporate: "Add a new Employee"
 * ```
 */
export function useOrganizationTerminology() {
  const { profile } = useAuth();
  
  const terminology = useMemo((): OrganizationTerminology => {
    // Get organization type from profile membership
    // TODO: Add organization_type to organization_membership structure
    // For now, default to 'preschool' for backward compatibility
    const orgType = 'preschool' as OrganizationType;
    
    // Get terminology map for this org type
    const terms = getTerminologyWithFallback(orgType);
    
    // Add helper methods
    return {
      ...terms,
      getRoleLabel: (role: string) => getRoleDisplayName(role, orgType),
      getRoleLabelPlural: (role: string) => getRolePluralName(role, orgType),
      orgType,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.organization_membership?.organization_id]);
  
  return { terminology };
}

/**
 * Hook to get a specific terminology label
 * Useful when you only need one label
 * 
 * @example
 * ```tsx
 * const memberLabel = useTermLabel('member');
 * // Returns: "Student", "Athlete", "Employee", etc.
 * ```
 */
export function useTermLabel(key: keyof TerminologyMap): string {
  const { terminology } = useOrganizationTerminology();
  return terminology[key];
}

/**
 * Hook to get role-specific display name
 * 
 * @example
 * ```tsx
 * const teacherLabel = useRoleLabel('teacher');
 * // Preschool: "Teacher"
 * // Sports Club: "Coach"
 * // Corporate: "Trainer"
 * ```
 */
export function useRoleLabel(role: string): string {
  const { terminology } = useOrganizationTerminology();
  return terminology.getRoleLabel(role);
}

/**
 * Hook to check organization type
 * 
 * @example
 * ```tsx
 * const { isPreschool, isCorporate } = useOrgType();
 * if (isPreschool) {
 *   // Render preschool-specific UI
 * }
 * ```
 */
export function useOrgType() {
  const { terminology } = useOrganizationTerminology();
  
  return useMemo(() => ({
    orgType: terminology.orgType,
    isPreschool: terminology.orgType === 'preschool',
    isK12: terminology.orgType === 'k12_school',
    isUniversity: terminology.orgType === 'university',
    isCorporate: terminology.orgType === 'corporate',
    isSportsClub: terminology.orgType === 'sports_club',
    isCommunityOrg: terminology.orgType === 'community_org',
    isTrainingCenter: terminology.orgType === 'training_center',
    isTutoringCenter: terminology.orgType === 'tutoring_center',
  }), [terminology.orgType]);
}
