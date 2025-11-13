/**
 * useFeatureFlags Hook
 * 
 * Provides feature flag access for dynamic dashboard composition
 * Merges org-specific flags from database with environment-based global flags
 * 
 * Part of Multi-Organization Dashboard System (Phase 2)
 * See: /home/king/Desktop/MULTI_ORG_DASHBOARD_IMPLEMENTATION_PLAN.md
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { assertSupabase } from '@/lib/supabase';
import type { AgeGroup } from './useAgeGroup';
import type { OrganizationType } from '@/lib/types/organization';

export interface FeatureFlagContext {
  orgType: OrganizationType | string;
  role: string;
  ageGroup?: AgeGroup | null;
}

export interface FeatureFlags {
  isEnabled: (featureKey: string) => boolean;
  isDisabled: (featureKey: string) => boolean;
  getAllFlags: () => Record<string, boolean>;
}

/**
 * Global feature flags from environment variables
 * Format: EXPO_PUBLIC_FEATURE_<FEATURE_NAME>=true|false
 */
function getGlobalFlags(): Record<string, boolean> {
  const flags: Record<string, boolean> = {};
  
  // Master kill switch for dynamic dashboards
  const dynamicDashEnabled = process.env.EXPO_PUBLIC_ENABLE_DYNAMIC_DASH !== 'false';
  flags['dynamic_dashboards'] = dynamicDashEnabled;
  
  // Add other global flags as needed
  // Example: flags['beta_features'] = process.env.EXPO_PUBLIC_ENABLE_BETA === 'true';
  
  return flags;
}

/**
 * Hook to access feature flags for the current context
 * 
 * @param context - Organization type, role, and optional age group
 * @returns Feature flag utilities
 * 
 * @example
 * ```tsx
 * const { orgType } = useOrganization();
 * const { ageGroup } = useAgeGroup(user.id);
 * const flags = useFeatureFlags({ 
 *   orgType, 
 *   role: 'student', 
 *   ageGroup 
 * });
 * 
 * if (flags.isEnabled('chat_messaging')) {
 *   // Show chat feature
 * }
 * ```
 */
export function useFeatureFlags(context: FeatureFlagContext): FeatureFlags {
  const { orgType, role, ageGroup } = context;
  
  // Fetch org-specific feature flags from database
  const { data: dbFlags } = useQuery({
    queryKey: ['feature-flags', orgType, role, ageGroup],
    queryFn: async () => {
      const supabase = assertSupabase();
      
      // Query for both age-specific and age-agnostic flags
      const { data, error } = await supabase
        .from('org_dashboard_features')
        .select('feature_key, enabled')
        .eq('org_type', orgType)
        .eq('role', role)
        .or(`age_group.eq.${ageGroup},age_group.is.null`);
      
      if (error) {
        console.warn('useFeatureFlags: Failed to fetch flags', error);
        return [];
      }
      
      return data || [];
    },
    enabled: !!orgType && !!role,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });

  return useMemo(() => {
    const globalFlags = getGlobalFlags();
    
    // Convert DB flags array to object
    const dbFlagsMap: Record<string, boolean> = {};
    if (dbFlags) {
      for (const flag of dbFlags) {
        // Prefer age-specific flags over age-agnostic ones
        if (!(flag.feature_key in dbFlagsMap)) {
          dbFlagsMap[flag.feature_key] = flag.enabled;
        }
      }
    }
    
    // Merge: global flags override db flags for kill switches
    const mergedFlags = { ...dbFlagsMap, ...globalFlags };
    
    return {
      isEnabled: (featureKey: string): boolean => {
        // If dynamic dashboards are disabled globally, only basic features allowed
        if (!globalFlags['dynamic_dashboards']) {
          const basicFeatures = ['announcements', 'schedule_timetable'];
          if (!basicFeatures.includes(featureKey)) {
            return false;
          }
        }
        
        // Default to true if not specified (permissive by default)
        return mergedFlags[featureKey] !== false;
      },
      
      isDisabled: (featureKey: string): boolean => {
        return mergedFlags[featureKey] === false;
      },
      
      getAllFlags: (): Record<string, boolean> => {
        return { ...mergedFlags };
      },
    };
  }, [dbFlags]);
}

/**
 * Hook to check if a specific feature is enabled
 * Shorthand for single feature checks
 * 
 * @param featureKey - The feature to check
 * @param context - Organization/role/age context
 * @returns Boolean indicating if feature is enabled
 */
export function useIsFeatureEnabled(
  featureKey: string,
  context: FeatureFlagContext
): boolean {
  const flags = useFeatureFlags(context);
  return flags.isEnabled(featureKey);
}
