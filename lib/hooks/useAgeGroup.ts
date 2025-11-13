/**
 * useAgeGroup Hook
 * 
 * Provides age-aware functionality for dynamic dashboards
 * Computes age group from date of birth: child (0-12), teen (13-17), adult (18+)
 * 
 * Part of Multi-Organization Dashboard System (Phase 1)
 * See: /home/king/Desktop/MULTI_ORG_DASHBOARD_IMPLEMENTATION_PLAN.md
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { assertSupabase } from '@/lib/supabase';

export type AgeGroup = 'child' | 'teen' | 'adult';

export interface AgeGroupData {
  ageGroup: AgeGroup | null;
  isMinor: boolean;
  isChild: boolean;
  isTeen: boolean;
  isAdult: boolean;
  guardianProfileId: string | null;
  dateOfBirth: string | null;
}

/**
 * Client-side age group computation (fallback if DB doesn't have it yet)
 * Matches server-side logic in compute_age_group() function
 */
function computeAgeGroupLocal(dob: string | null): AgeGroup | null {
  if (!dob) return null;
  
  const birthDate = new Date(dob);
  const today = new Date();
  
  // Calculate age in years
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  // Adjust if birthday hasn't occurred this year yet
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  // Classify into age groups (same thresholds as DB)
  if (age <= 12) return 'child';
  if (age <= 17) return 'teen';
  return 'adult';
}

/**
 * Hook to get age group information for a profile
 * 
 * @param profileId - The profile ID to check age for
 * @returns Age group data including computed group, minor status, and guardian link
 * 
 * @example
 * ```tsx
 * const { ageGroup, isMinor, isChild, isTeen, isAdult } = useAgeGroup(user.id);
 * 
 * if (isChild) {
 *   // Show guardian-only features
 * } else if (isTeen) {
 *   // Show teen features with safety controls
 * } else if (isAdult) {
 *   // Show full features
 * }
 * ```
 */
export function useAgeGroup(profileId: string | null | undefined): AgeGroupData {
  const { data, isLoading } = useQuery({
    queryKey: ['profile-age-group', profileId],
    queryFn: async () => {
      if (!profileId) return null;
      
      const supabase = assertSupabase();
      const { data, error } = await supabase
        .from('profiles')
        .select('id, date_of_birth, age_group, guardian_profile_id')
        .eq('id', profileId)
        .single();
      
      if (error) {
        console.warn('useAgeGroup: Failed to fetch profile', error);
        return null;
      }
      
      return data;
    },
    enabled: !!profileId,
    staleTime: 5 * 60 * 1000, // 5 minutes (age doesn't change often)
    gcTime: 30 * 60 * 1000, // 30 minutes cache
  });

  return useMemo(() => {
    // Prefer server-computed age_group, fall back to client computation
    const ageGroup = data?.age_group || computeAgeGroupLocal(data?.date_of_birth || null);
    
    const isChild = ageGroup === 'child';
    const isTeen = ageGroup === 'teen';
    const isAdult = ageGroup === 'adult';
    const isMinor = isChild || isTeen;
    
    return {
      ageGroup,
      isMinor,
      isChild,
      isTeen,
      isAdult,
      guardianProfileId: data?.guardian_profile_id || null,
      dateOfBirth: data?.date_of_birth || null,
    };
  }, [data]);
}

/**
 * Hook to check if current user is a minor
 * Shorthand for checking age group
 * 
 * @param profileId - The profile ID to check
 * @returns Boolean indicating if user is under 18
 */
export function useIsMinor(profileId: string | null | undefined): boolean {
  const { isMinor } = useAgeGroup(profileId);
  return isMinor;
}

/**
 * Hook to get guardian profile ID for a minor
 * Returns null if user is adult or no guardian linked
 * 
 * @param profileId - The profile ID to check
 * @returns Guardian profile ID or null
 */
export function useGuardianProfileId(profileId: string | null | undefined): string | null {
  const { guardianProfileId } = useAgeGroup(profileId);
  return guardianProfileId;
}
