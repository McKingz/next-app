import { logger } from '@/lib/logger';
/**
 * AI TanStack Query Hooks
 * 
 * Mobile-first React Query hooks for AI features with proper caching
 * and AsyncStorage persistence. Complies with WARP.md performance requirements.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/contexts/AuthContext';
import { 
  getUserLimits, 
  getOrgLimits, 
  getSchoolUsageSummary, 
  getRecentUsage, 
  getQuotaStatus, 
  postAIRequest,
  getAIInsights,
  extractAPIError,
} from '@/lib/ai/api';
import type { AIQuotaFeature } from '@/lib/ai/limits';
import { track } from '@/lib/analytics';
import { Alert } from 'react-native';
import { router } from 'expo-router';

// Cache keys factory with scope and preschool_id
const createAIQueryKeys = {
  userLimits: (userId: string) => ['ai', 'user-limits', userId] as const,
  orgLimits: (preschoolId: string) => ['ai', 'org-limits', preschoolId] as const,
  schoolUsage: (preschoolId: string) => ['ai', 'school-usage', preschoolId] as const,
  recentUsage: (params: any) => ['ai', 'recent-usage', params] as const,
  quotaStatus: (userId: string, serviceType: AIQuotaFeature) => ['ai', 'quota-status', userId, serviceType] as const,
  insights: (scope: string, context?: any) => ['ai', 'insights', scope, context] as const,
};

// AsyncStorage cache keys
const CACHE_KEYS = {
  USER_LIMITS: '@edudash_ai_user_limits_',
  ORG_LIMITS: '@edudash_ai_org_limits_',
  SCHOOL_USAGE: '@edudash_ai_school_usage_',
  INSIGHTS: '@edudash_ai_insights_',
} as const;

/**
 * Hook for user AI limits and quotas
 * Cached for 60s, persisted to AsyncStorage
 */
export function useAIUserLimits(userId?: string) {
  const { user } = useAuth();
  const effectiveUserId = userId || user?.id;
  
  return useQuery({
    queryKey: createAIQueryKeys.userLimits(effectiveUserId || ''),
    queryFn: () => {
      if (!effectiveUserId) {
        throw new Error('User ID required for AI limits');
      }
      return getUserLimits(effectiveUserId);
    },
    enabled: !!effectiveUserId,
    staleTime: 60 * 1000, // 60 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

/**
 * Hook for organization AI limits
 */
export function useAIOrgLimits(preschoolId?: string) {
  const { profile } = useAuth();
  const effectivePreschoolId = preschoolId || (profile as any)?.organization_id;
  
  return useQuery({
    queryKey: createAIQueryKeys.orgLimits(effectivePreschoolId || ''),
    queryFn: () => {
      if (!effectivePreschoolId) {
        throw new Error('Preschool ID required for org limits');
      }
      return getOrgLimits(effectivePreschoolId);
    },
    enabled: !!effectivePreschoolId,
    staleTime: 60 * 1000, // 60 seconds  
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
    
  });
}

/**
 * Hook for school usage summary with trends
 */
export function useAISchoolUsageSummary(preschoolId?: string) {
  const { profile } = useAuth();
  const effectivePreschoolId = preschoolId || (profile as any)?.organization_id;
  
  return useQuery({
    queryKey: createAIQueryKeys.schoolUsage(effectivePreschoolId || ''),
    queryFn: () => {
      if (!effectivePreschoolId) {
        throw new Error('Preschool ID required for school usage');
      }
      return getSchoolUsageSummary(effectivePreschoolId);
    },
    enabled: !!effectivePreschoolId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
    
  });
}

/**
 * Hook for recent AI usage logs
 */
export function useAIRecentUsage(params: {
  scope?: 'user' | 'school';
  user_id?: string;
  preschool_id?: string;
  limit?: number;
  service_type?: AIQuotaFeature;
}) {
  const { user, profile } = useAuth();
  
  // Auto-fill missing params based on auth context
  const effectiveParams = {
    ...params,
    user_id: params.user_id || (params.scope === 'user' ? user?.id : undefined),
    preschool_id: params.preschool_id || (profile as any)?.organization_id,
    limit: params.limit || 20,
  };
  
  return useQuery({
    queryKey: createAIQueryKeys.recentUsage(effectiveParams),
    queryFn: () => getRecentUsage(effectiveParams),
    enabled: !!(effectiveParams.user_id || effectiveParams.preschool_id),
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });
}

/**
 * Hook for AI quota status with guard helpers
 */
export function useAIQuota(serviceType: AIQuotaFeature, userId?: string) {
  const { user } = useAuth();
  const effectiveUserId = userId || user?.id;
  
  const query = useQuery({
    queryKey: createAIQueryKeys.quotaStatus(effectiveUserId || '', serviceType),
    queryFn: () => {
      if (!effectiveUserId) {
        throw new Error('User ID required for quota status');
      }
      return getQuotaStatus(effectiveUserId, serviceType);
    },
    enabled: !!effectiveUserId && !!serviceType,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 2 * 60 * 1000, // 2 minutes
    retry: 2,
  });
  
  // Helper functions for quota guards
  const canUse = (requestedUnits = 1): boolean => {
    return (query.data?.remaining || 0) >= requestedUnits;
  };
  
  const getReason = (): 'quota_exceeded' | 'loading' | 'error' | null => {
    if (query.isLoading) return 'loading';
    if (query.isError) return 'error';
    if (!canUse()) return 'quota_exceeded';
    return null;
  };
  
  const getUpgradeOptions = () => {
    return query.data?.upgrade_suggestions || [];
  };
  
  return {
    ...query,
    canUse,
    getReason,
    getUpgradeOptions,
  };
}

/**
 * Hook for AI insights with caching by scope and day
 */
export function useAIInsights(
  scope: 'teacher' | 'principal' | 'parent',
  options?: {
    period_days?: number;
    context?: Record<string, any>;
  }
) {
  const cacheKey = `${scope}_${JSON.stringify(options || {})}`;
  
  return useQuery({
    queryKey: createAIQueryKeys.insights(scope, options),
    queryFn: () => getAIInsights(scope, options),
    enabled: !!scope,
    staleTime: 30 * 60 * 1000, // 30 minutes - insights don't change frequently
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(2000 * 2 ** attemptIndex, 10000),
  });
}

/**
 * Mutation hook for AI requests with quota checking
 */
export function useAIRequest() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: postAIRequest,
    
    onSuccess: (data, variables) => {
      // Invalidate relevant caches after successful AI usage
      queryClient.invalidateQueries({
        queryKey: ['ai', 'user-limits'],
      });
      
      queryClient.invalidateQueries({
        queryKey: ['ai', 'quota-status', undefined, variables.service_type],
      });
      
      queryClient.invalidateQueries({
        queryKey: ['ai', 'recent-usage'],
      });
      
      track('edudash.ai.request.succeeded', {
        service_type: variables.service_type,
        duration_ms: 0,
        tokens_used: data.usage?.tokens_in + data.usage?.tokens_out || 0,
        cost_cents: 0,
      } as any);
    },
    
    onError: (error, variables) => {
      const errorInfo = extractAPIError(error);
      
      track('edudash.ai.request.failed', {
        service_type: variables.service_type,
        error_code: errorInfo.code,
        duration_ms: 0,
        retry_count: 0,
      } as any);
      
      // Handle quota exceeded with upgrade prompt
      if (errorInfo.isQuotaExceeded) {
        track('edudash.ai.quota.blocked', {
          service_type: variables.service_type,
          quota_used: 0,
          quota_limit: 0,
          user_tier: errorInfo.quotaInfo?.service_type || 'unknown',
          upgrade_shown: true,
        } as any);
        
        Alert.alert(
          'AI Usage Limit Reached',
          `You've used all your ${variables.service_type.replace('_', ' ')} quota for this month. Upgrade to continue using AI features.`,
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Upgrade', 
              onPress: () => {
                track('edudash.ai.upsell.shown', {
                  trigger: 'quota_exceeded',
                  current_tier: 'free',
                  target_tier: 'pro',
                  quota_percentage: 100,
                });
                router.push('/pricing');
              } 
            },
          ]
        );
      }
    },
  });
}

/**
 * Helper hook to clear AI caches (useful for logout)
 */
export function useAICacheClear() {
  const queryClient = useQueryClient();
  
  return {
    clearAll: async () => {
      // Clear React Query cache
      queryClient.removeQueries({ queryKey: ['ai'] });
      
      // Clear AsyncStorage cache
      try {
        const keys = await AsyncStorage.getAllKeys();
        const aiKeys = keys.filter(key => 
          key.startsWith('@edudash_ai_')
        );
        if (aiKeys.length > 0) {
          await AsyncStorage.multiRemove(aiKeys);
        }
      } catch (error) {
        logger.warn('Failed to clear AI cache from AsyncStorage:', error);
      }
    },
    
    clearUser: async (userId: string) => {
      // Clear user-specific caches
      queryClient.removeQueries({ 
        queryKey: ['ai', 'user-limits', userId] 
      });
      
      try {
        await AsyncStorage.removeItem(CACHE_KEYS.USER_LIMITS + userId);
      } catch (error) {
        logger.warn('Failed to clear user AI cache:', error);
      }
    },
  };
}