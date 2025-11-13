/**
 * AI Quota Allocation Hooks
 * 
 * React Query hooks for managing school AI quota allocations
 * Supports principals allocating quotas to teachers and tracking usage
 * 
 * Complies with WARP.md:
 * - Mobile-first with TanStack Query for server state
 * - Multi-tenant security with preschool_id scoping
 * - No mock data, graceful empty states
 * - Analytics tracking for allocation actions
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { derivePreschoolId, getAllocationScope, canManageAllocationsRole } from '@/lib/roleUtils';
import { track } from '@/lib/analytics';
import { reportError } from '@/lib/monitoring';
import {
  getSchoolAISubscription,
  getTeacherAllocations,
  getTeacherAllocation,
  allocateAIQuotas,
  requestAIQuotas,
  canManageAllocations,
  getAllocationHistory,
  getOptimalAllocationSuggestions,
  bulkAllocateQuotas,
  type SchoolAISubscription,
  type TeacherAIAllocation,
  type AllocationRequest,
  type AllocationHistory,
} from '../allocation';
import type { AIQuotaFeature } from '../limits';

/**
 * Query keys for consistent cache management
 * Scoped by preschool_id for multi-tenant security
 */
export const aiAllocationKeys = {
  all: ['ai-allocation'] as const,
  schoolSubscription: (preschoolId: string) => 
    [...aiAllocationKeys.all, 'school-subscription', preschoolId] as const,
  teacherAllocations: (preschoolId: string) => 
    [...aiAllocationKeys.all, 'teacher-allocations', preschoolId] as const,
  teacherAllocation: (preschoolId: string, userId: string) => 
    [...aiAllocationKeys.all, 'teacher-allocation', preschoolId, userId] as const,
  allocationHistory: (preschoolId: string, teacherId?: string) => 
    [...aiAllocationKeys.all, 'history', preschoolId, teacherId] as const,
  allocationSuggestions: (preschoolId: string) => 
    [...aiAllocationKeys.all, 'suggestions', preschoolId] as const,
  canManageAllocations: (preschoolId: string, userId: string) => 
    [...aiAllocationKeys.all, 'can-manage', preschoolId, userId] as const,
};

/**
 * Hook to get school AI subscription details
 * Returns null for users without allocation permissions
 */
export function useSchoolAISubscription() {
  const { profile, loading: profileLoading } = useAuth();
  const { preschoolId } = getAllocationScope(profile);
  
  return useQuery({
    queryKey: preschoolId 
      ? aiAllocationKeys.schoolSubscription(preschoolId)
      : ['ai-allocation', 'no-school'],
    queryFn: async (): Promise<SchoolAISubscription | null> => {
      if (!preschoolId) {
        return null;
      }
      
      return await getSchoolAISubscription(preschoolId);
    },
    enabled: !profileLoading && !!preschoolId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
    meta: {
      description: 'School AI subscription and quota details',
    },
  });
}

/**
 * Hook to get all teacher allocations for a school
 * Requires principal/admin permissions
 */
export function useTeacherAllocations() {
  const { profile, loading: profileLoading } = useAuth();
  const { preschoolId } = getAllocationScope(profile);
  
  return useQuery({
    queryKey: preschoolId 
      ? aiAllocationKeys.teacherAllocations(preschoolId)
      : ['ai-allocation', 'no-school-allocations'],
    queryFn: async (): Promise<TeacherAIAllocation[]> => {
      if (!preschoolId) {
        return [];
      }
      
      return await getTeacherAllocations(preschoolId);
    },
    enabled: !profileLoading && !!preschoolId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    meta: {
      description: 'All teacher AI allocations for school',
    },
  });
}

/**
 * Hook to get specific teacher's AI allocation
 * Shows current user's allocation by default
 */
export function useTeacherAllocation(userId?: string) {
  const { profile, session, loading: profileLoading } = useAuth();
  const { preschoolId } = getAllocationScope(profile);
  const targetUserId = userId || profile?.id || session?.user?.id;
  
  return useQuery({
    queryKey: preschoolId && targetUserId
      ? aiAllocationKeys.teacherAllocation(preschoolId, targetUserId)
      : ['ai-allocation', 'no-teacher-allocation'],
    queryFn: async (): Promise<TeacherAIAllocation | null> => {
      if (!preschoolId || !targetUserId) {
        return null;
      }
      
      return await getTeacherAllocation(preschoolId, targetUserId);
    },
    enabled: !profileLoading && !!preschoolId && !!targetUserId,
    staleTime: 1 * 60 * 1000, // 1 minute (frequent updates for usage tracking)
    gcTime: 5 * 60 * 1000, // 5 minutes
    meta: {
      description: 'Individual teacher AI allocation',
    },
  });
}

/**
 * Hook to check if current user can manage AI allocations
 * Uses client-side role check as primary method, server check as secondary
 */
export function useCanManageAllocations() {
  const { profile, session, loading: profileLoading } = useAuth();
  const { preschoolId } = getAllocationScope(profile);
  
  return useQuery({
    queryKey: preschoolId && (profile?.id || session?.user?.id)
      ? aiAllocationKeys.canManageAllocations(preschoolId, profile?.id || session?.user?.id || 'unknown')
      : ['ai-allocation', 'no-manage-check'],
    queryFn: async (): Promise<boolean> => {
      // Primary: client-side role check (reliable)
      const clientSideCanManage = canManageAllocationsRole(profile?.role);
      
      if (clientSideCanManage && preschoolId) {
        return true;
      }
      
      // Secondary: server-side check (when available)
      const userId = profile?.id || session?.user?.id;
      if (userId && preschoolId) {
        try {
          return await canManageAllocations(userId, preschoolId);
        } catch (error) {
          console.warn('Server-side canManageAllocations check failed, using client-side result:', error);
          return clientSideCanManage;
        }
      }
      
      return false;
    },
    enabled: !profileLoading && !!(profile?.role || (profile?.id || session?.user?.id)),
    staleTime: 10 * 60 * 1000, // 10 minutes (permissions change infrequently)
    gcTime: 30 * 60 * 1000, // 30 minutes
    meta: {
      description: 'User allocation management permissions (client + server)',
    },
  });
}

/**
 * Hook to get allocation history with pagination
 */
export function useAllocationHistory(options: {
  teacherId?: string;
  limit?: number;
  offset?: number;
  action?: string;
} = {}) {
  const { profile, loading: profileLoading } = useAuth();
  const { preschoolId } = getAllocationScope(profile);
  
  return useQuery({
    queryKey: preschoolId 
      ? [...aiAllocationKeys.allocationHistory(preschoolId, options.teacherId), options]
      : ['ai-allocation', 'no-history'],
    queryFn: async (): Promise<{ history: AllocationHistory[]; total: number }> => {
      if (!preschoolId) {
        return { history: [], total: 0 };
      }
      
      return await getAllocationHistory(preschoolId, options);
    },
    enabled: !profileLoading && !!preschoolId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
    meta: {
      description: 'AI allocation audit history',
    },
  });
}

/**
 * Hook to get optimal allocation suggestions
 * Analyzes usage patterns to recommend quota adjustments
 */
export function useAllocationSuggestions() {
  const { profile, loading: profileLoading } = useAuth();
  const { preschoolId } = getAllocationScope(profile);
  const { data: canManage } = useCanManageAllocations();
  
  return useQuery({
    queryKey: preschoolId 
      ? aiAllocationKeys.allocationSuggestions(preschoolId)
      : ['ai-allocation', 'no-suggestions'],
    queryFn: async () => {
      if (!preschoolId) {
        return {
          suggestions: [],
          school_summary: {
            total_quota_utilization: 0,
            underused_quotas: 0,
            overdemand_teachers: 0,
            optimization_potential: 0,
          },
        };
      }
      
      return await getOptimalAllocationSuggestions(preschoolId);
    },
    enabled: !profileLoading && !!preschoolId && canManage === true,
    staleTime: 15 * 60 * 1000, // 15 minutes (analysis is compute-intensive)
    gcTime: 60 * 60 * 1000, // 1 hour
    meta: {
      description: 'AI quota optimization suggestions',
    },
  });
}

/**
 * Mutation to allocate AI quotas to a teacher
 * Invalidates relevant queries on success
 */
export function useAllocateAIQuotas() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const { preschoolId } = getAllocationScope(profile);
  
  return useMutation({
    mutationFn: async ({
      teacherId,
      quotas,
      options,
    }: {
      teacherId: string;
      quotas: Partial<Record<AIQuotaFeature, number>>;
      options?: {
        reason?: string;
        auto_renew?: boolean;
        priority_level?: 'low' | 'normal' | 'high';
      };
    }) => {
      if (!preschoolId) {
        throw new Error('No school context available');
      }
      
      const result = await allocateAIQuotas(
        preschoolId,
        teacherId,
        quotas,
        options
      );
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to allocate quotas');
      }
      
      return result.allocation;
    },
    onSuccess: (allocation, variables) => {
      if (!preschoolId) return;
      
      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: aiAllocationKeys.schoolSubscription(preschoolId),
      });
      queryClient.invalidateQueries({
        queryKey: aiAllocationKeys.teacherAllocations(preschoolId),
      });
      queryClient.invalidateQueries({
        queryKey: aiAllocationKeys.teacherAllocation(preschoolId, variables.teacherId),
      });
      queryClient.invalidateQueries({
        queryKey: aiAllocationKeys.allocationHistory(preschoolId),
      });
      
      // Track successful allocation
      track('edudash.ai.allocation.ui.success', {
        preschool_id: preschoolId,
        teacher_id: variables.teacherId,
        quotas_allocated: variables.quotas,
        priority_level: variables.options?.priority_level || 'normal',
      });
    },
    onError: (error, variables) => {
      // Track allocation failure
      track('edudash.ai.allocation.ui.failed', {
        preschool_id: preschoolId,
        teacher_id: variables.teacherId,
        error: error.message,
      });
      
      reportError(error instanceof Error ? error : new Error('Allocation failed'), {
        context: 'useAllocateAIQuotas',
        teacher_id: variables.teacherId,
        quotas: variables.quotas,
      });
    },
    meta: {
      description: 'Allocate AI quotas to teacher',
    },
  });
}

/**
 * Mutation for teachers to request AI quota allocation
 * Self-service requests when enabled by school
 */
export function useRequestAIQuotas() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const { preschoolId } = getAllocationScope(profile);
  
  return useMutation({
    mutationFn: async (request: AllocationRequest) => {
      if (!preschoolId) {
        throw new Error('No school context available');
      }
      
      const result = await requestAIQuotas(preschoolId, request);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to request quotas');
      }
      
      return result.request_id;
    },
    onSuccess: (requestId, variables) => {
      // Refresh allocation requests
      queryClient.invalidateQueries({
        queryKey: aiAllocationKeys.all,
        predicate: (query) => {
          const queryKey = query.queryKey;
          return Array.isArray(queryKey) && 
                 queryKey.includes('allocation-requests');
        },
      });
      
      track('edudash.ai.allocation.request.submitted', {
        preschool_id: preschoolId,
        teacher_id: variables.teacher_id,
        urgency: variables.urgency,
        request_id: requestId,
      });
    },
    onError: (error, variables) => {
      track('edudash.ai.allocation.request.failed', {
        preschool_id: preschoolId,
        teacher_id: variables.teacher_id,
        error: error.message,
      });
      
      reportError(error instanceof Error ? error : new Error('Request failed'), {
        context: 'useRequestAIQuotas',
        request: variables,
      });
    },
    meta: {
      description: 'Request AI quota allocation',
    },
  });
}

/**
 * Mutation for bulk allocation operations
 * Efficient for setting up multiple teachers at once
 */
export function useBulkAllocateQuotas() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const { preschoolId } = getAllocationScope(profile);
  
  return useMutation({
    mutationFn: async (allocations: Array<{
      teacher_id: string;
      quotas: Partial<Record<AIQuotaFeature, number>>;
      reason?: string;
    }>) => {
      if (!preschoolId) {
        throw new Error('No school context available');
      }
      
      const result = await bulkAllocateQuotas(preschoolId, allocations);
      
      if (!result.success) {
        throw new Error('Bulk allocation failed');
      }
      
      return result;
    },
    onSuccess: (result) => {
      if (!preschoolId) return;
      
      // Invalidate all allocation-related queries
      queryClient.invalidateQueries({
        queryKey: aiAllocationKeys.schoolSubscription(preschoolId),
      });
      queryClient.invalidateQueries({
        queryKey: aiAllocationKeys.teacherAllocations(preschoolId),
      });
      queryClient.invalidateQueries({
        queryKey: aiAllocationKeys.allocationHistory(preschoolId),
      });
      
      // Invalidate individual teacher allocations
      result.results.forEach((teacherResult) => {
        if (teacherResult.success) {
          queryClient.invalidateQueries({
            queryKey: aiAllocationKeys.teacherAllocation(
              preschoolId, 
              teacherResult.teacher_id
            ),
          });
        }
      });
      
      track('edudash.ai.allocation.bulk.success', {
        preschool_id: preschoolId,
        total_teachers: result.results.length,
        successful: result.summary.successful,
        failed: result.summary.failed,
      });
    },
    onError: (error, variables) => {
      track('edudash.ai.allocation.bulk.failed', {
        preschool_id: preschoolId,
        total_teachers: variables.length,
        error: error.message,
      });
      
      reportError(error instanceof Error ? error : new Error('Bulk allocation failed'), {
        context: 'useBulkAllocateQuotas',
        allocations_count: variables.length,
      });
    },
    meta: {
      description: 'Bulk allocate AI quotas to multiple teachers',
    },
  });
}

/**
 * Combined hook providing all allocation functionality
 * Convenient for pages that need multiple allocation operations
 */
export function useAIAllocationManagement() {
  const schoolSubscription = useSchoolAISubscription();
  const teacherAllocations = useTeacherAllocations();
  const myAllocation = useTeacherAllocation();
  const canManage = useCanManageAllocations();
  const allocationHistory = useAllocationHistory();
  const suggestions = useAllocationSuggestions();
  
  const allocateMutation = useAllocateAIQuotas();
  const requestMutation = useRequestAIQuotas();
  const bulkAllocateMutation = useBulkAllocateQuotas();
  
  return {
    // Data
    schoolSubscription: schoolSubscription.data,
    teacherAllocations: teacherAllocations.data || [],
    myAllocation: myAllocation.data,
    canManageAllocations: canManage.data || false,
    allocationHistory: allocationHistory.data,
    optimizationSuggestions: suggestions.data,
    
    // Loading states
    isLoading: {
      schoolSubscription: schoolSubscription.isLoading,
      teacherAllocations: teacherAllocations.isLoading,
      myAllocation: myAllocation.isLoading,
      permissions: canManage.isLoading,
      history: allocationHistory.isLoading,
      suggestions: suggestions.isLoading,
    },
    
    // Error states
    errors: {
      schoolSubscription: schoolSubscription.error,
      teacherAllocations: teacherAllocations.error,
      myAllocation: myAllocation.error,
      permissions: canManage.error,
      history: allocationHistory.error,
      suggestions: suggestions.error,
    },
    
    // Actions
    allocateQuotas: allocateMutation.mutate,
    requestQuotas: requestMutation.mutate,
    bulkAllocateQuotas: bulkAllocateMutation.mutate,
    
    // Action states
    isAllocating: allocateMutation.isPending,
    isRequesting: requestMutation.isPending,
    isBulkAllocating: bulkAllocateMutation.isPending,
    
    // Refetch functions
    refetch: {
      schoolSubscription: schoolSubscription.refetch,
      teacherAllocations: teacherAllocations.refetch,
      myAllocation: myAllocation.refetch,
      permissions: canManage.refetch,
      history: allocationHistory.refetch,
      suggestions: suggestions.refetch,
    },
  };
}