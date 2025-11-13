/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * AI Quota Allocation System for Schools
 * 
 * Manages how schools allocate AI usage among their staff:
 * - Preschools (Pro+): Principals allocate quotas to teachers
 * - K-12 Schools (Enterprise): Admins manage department/teacher allocations
 * - Individual users: Direct personal quotas
 * 
 * Complies with WARP.md organizational rules and pricing tiers.
 */

import { assertSupabase } from '@/lib/supabase';
import { track } from '@/lib/analytics';
import { reportError } from '@/lib/monitoring';
import { getOrgType, canUseAllocation, normalizeTier, type OrgType, type Tier } from '@/lib/subscriptionRules';
import type { AIQuotaFeature } from './limits';
import { 
  getSchoolAISubscriptionDirect, 
  getTeacherAllocationsDirect, 
  canManageAllocationsDirect,
  allocateAIQuotasDirect,
  getOptimalAllocationSuggestionsDirect
} from './allocation-direct';

export interface SchoolAISubscription {
  preschool_id: string;
  subscription_tier: Tier;
  org_type: OrgType;
  
  // Total quotas purchased by the school
  total_quotas: Record<AIQuotaFeature, number>;
  
  // Quotas already allocated to staff
  allocated_quotas: Record<AIQuotaFeature, number>;
  
  // Quotas available for allocation
  available_quotas: Record<AIQuotaFeature, number>;
  
  // Usage across all staff this month
  total_usage: Record<AIQuotaFeature, number>;
  
  // Admin settings
  allow_teacher_self_allocation: boolean;
  default_teacher_quotas: Record<AIQuotaFeature, number>;
  max_individual_quota: Record<AIQuotaFeature, number>;
  
  // Billing cycle
  current_period_start: string;
  current_period_end: string;
  
  // Metadata
  created_at: string;
  updated_at: string;
  updated_by: string;
}

export interface TeacherAIAllocation {
  id: string;
  preschool_id: string;
  user_id: string;
  teacher_name: string;
  teacher_email: string;
  role: string;
  
  // Allocated quotas for this teacher
  allocated_quotas: Record<AIQuotaFeature, number>;
  
  // Used quotas this period
  used_quotas: Record<AIQuotaFeature, number>;
  
  // Remaining quotas
  remaining_quotas: Record<AIQuotaFeature, number>;
  
  // Allocation metadata
  allocated_by: string; // principal/admin user_id
  allocated_at: string;
  allocation_reason?: string;
  
  // Status
  is_active: boolean;
  is_suspended: boolean;
  suspension_reason?: string;
  
  // Auto-allocation rules
  auto_renew: boolean;
  priority_level: 'low' | 'normal' | 'high'; // For when quotas run low
}

export interface AllocationRequest {
  teacher_id: string;
  requested_quotas: Partial<Record<AIQuotaFeature, number>>;
  justification: string;
  urgency: 'low' | 'normal' | 'high';
  auto_approve_similar?: boolean;
}

export interface AllocationHistory {
  id: string;
  preschool_id: string;
  teacher_id: string;
  action: 'allocate' | 'revoke' | 'increase' | 'decrease' | 'suspend' | 'reactivate';
  quotas_changed: Partial<Record<AIQuotaFeature, number>>;
  previous_quotas: Record<AIQuotaFeature, number>;
  new_quotas: Record<AIQuotaFeature, number>;
  performed_by: string;
  reason: string;
  created_at: string;
}

/**
 * Get school AI subscription details including allocation capacity
 */
export async function getSchoolAISubscription(preschoolId: string): Promise<SchoolAISubscription | null> {
  try {
    const client = assertSupabase();
    
    // Try Edge Function first
    try {
      const { data, error } = await client.functions.invoke('ai-usage', {
        body: {
          action: 'school_subscription_details',
          preschool_id: preschoolId,
        },
      });

      if (!error && data) {
        const funcResult = data as SchoolAISubscription;
        const funcTier = normalizeTier(funcResult.subscription_tier as unknown as string);

        // Cross-check with direct DB join to avoid legacy tier mismatches (e.g., preschools.subscription_tier)
        try {
          const directResult = await getSchoolAISubscriptionDirect(preschoolId);
          const directTier = normalizeTier(String(directResult?.subscription_tier || ''));

          if (directResult && directTier && funcTier !== directTier) {
            console.warn('[AI-Quota] Tier mismatch detected. Using direct database tier result to avoid legacy fallback', {
              preschool_id: preschoolId,
              function_tier: funcTier,
              direct_tier: directTier,
            });
            return directResult;
          }
        } catch (crossCheckErr) {
          // ignore debug noise
        }

        // If no mismatch or direct not available, return function result
        return { ...funcResult, subscription_tier: funcTier as any };
      }
    } catch (functionError) {
      // function not available; will use direct fallback
    }
    
    // Fallback to direct database implementation
    const directOnly = await getSchoolAISubscriptionDirect(preschoolId);
    return directOnly;
    
  } catch (error) {
    console.warn('Both function and direct approaches failed, trying direct as final fallback');
    try {
      return await getSchoolAISubscriptionDirect(preschoolId);
    } catch (fallbackError) {
      reportError(error instanceof Error ? error : new Error('Unknown error'), {
        context: 'getSchoolAISubscription',
        preschool_id: preschoolId,
      });
      return null;
    }
  }
}

/**
 * Get all teacher allocations for a school
 */
export async function getTeacherAllocations(preschoolId: string): Promise<TeacherAIAllocation[]> {
  try {
    const client = assertSupabase();
    
    // Try Edge Function first
    try {
      const { data, error } = await client.functions.invoke('ai-usage', {
        body: {
          action: 'teacher_allocations',
          preschool_id: preschoolId,
        },
      });

      if (!error && data?.allocations) {
        return data.allocations;
      }
    } catch (functionError) {
      // function not available; will use direct fallback
    }
    
    // Fallback to direct database implementation
    return await getTeacherAllocationsDirect(preschoolId);
    
  } catch (error) {
    console.warn('Teacher allocations function failed, trying direct fallback');
    try {
      return await getTeacherAllocationsDirect(preschoolId);
    } catch (fallbackError) {
      reportError(error instanceof Error ? error : new Error('Unknown error'), {
        context: 'getTeacherAllocations',
        preschool_id: preschoolId,
      });
      return [];
    }
  }
}

/**
 * Allocate AI quotas to a teacher (Principal/Admin only)
 */
export async function allocateAIQuotas(
  preschoolId: string,
  teacherId: string,
  quotas: Partial<Record<AIQuotaFeature, number>>,
  options: {
    reason?: string;
    auto_renew?: boolean;
    priority_level?: 'low' | 'normal' | 'high';
  } = {}
): Promise<{ success: boolean; error?: string; allocation?: TeacherAIAllocation }> {
  try {
    const client = assertSupabase();
    
    // Get current user for audit trail
    const { data: { user } } = await client.auth.getUser();
    if (!user) {
      throw new Error('Authentication required');
    }
    
    // Verify user can manage allocations
    const orgType = await getOrgType();
    const canAllocate = await canManageAllocations(user.id, preschoolId);
    
    if (!canAllocate) {
      throw new Error('Insufficient permissions to manage AI allocations');
    }
    
    // Track allocation attempt
    track('edudash.ai.allocation.attempt', {
      preschool_id: preschoolId,
      teacher_id: teacherId,
      allocated_by: user.id,
      quotas: Object.keys(quotas),
      org_type: orgType,
    });
    
    // Try Edge Function first
    try {
      const { data, error } = await client.functions.invoke('ai-usage', {
        body: {
          action: 'allocate_teacher_quotas',
          preschool_id: preschoolId,
          teacher_id: teacherId,
          quotas,
          allocated_by: user.id,
          reason: options.reason || 'Quota allocation by admin',
          auto_renew: options.auto_renew || false,
          priority_level: options.priority_level || 'normal',
        },
      });

      if (!error && data) {
        track('edudash.ai.allocation.success', {
          preschool_id: preschoolId,
          teacher_id: teacherId,
          allocated_by: user.id,
          quotas_allocated: data.allocation.allocated_quotas,
        });
        return { success: true, allocation: data.allocation };
      }
    } catch (functionError) {
      console.log('Edge function not available for allocation, using direct fallback');
    }
    
    // Fallback to direct implementation
    const fallbackResult = await allocateAIQuotasDirect(preschoolId, teacherId, quotas, options);
    
    if (fallbackResult.success) {
      track('edudash.ai.allocation.success', {
        preschool_id: preschoolId,
        teacher_id: teacherId,
        allocated_by: user.id,
        quotas_allocated: quotas,
        method: 'direct_fallback',
      });
    } else {
      track('edudash.ai.allocation.failed', {
        preschool_id: preschoolId,
        teacher_id: teacherId,
        error: fallbackResult.error,
        method: 'direct_fallback',
      });
    }

    return fallbackResult;
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    track('edudash.ai.allocation.error', {
      preschool_id: preschoolId,
      teacher_id: teacherId,
      error: errorMessage,
    });

    reportError(error instanceof Error ? error : new Error(errorMessage), {
      context: 'allocateAIQuotas',
      preschool_id: preschoolId,
      teacher_id: teacherId,
    });

    return { success: false, error: errorMessage };
  }
}

/**
 * Request AI quota allocation (Teacher self-service if enabled)
 */
export async function requestAIQuotas(
  preschoolId: string,
  request: AllocationRequest
): Promise<{ success: boolean; error?: string; request_id?: string }> {
  try {
    const client = assertSupabase();
    
    const { data: { user } } = await client.auth.getUser();
    if (!user) {
      throw new Error('Authentication required');
    }
    
    // Check if school allows teacher self-allocation
    const subscription = await getSchoolAISubscription(preschoolId);
    if (!subscription?.allow_teacher_self_allocation) {
      return { 
        success: false, 
        error: 'Self-allocation not enabled. Please contact your administrator.' 
      };
    }
    
    track('edudash.ai.allocation.request', {
      preschool_id: preschoolId,
      requested_by: user.id,
      teacher_id: request.teacher_id,
      urgency: request.urgency,
    });
    
    const { data, error } = await client.functions.invoke('ai-usage', {
      body: {
        action: 'request_teacher_quotas',
        preschool_id: preschoolId,
        ...request,
        requested_by: user.id,
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, request_id: data.request_id };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    reportError(error instanceof Error ? error : new Error(errorMessage), {
      context: 'requestAIQuotas',
      preschool_id: preschoolId,
      request,
    });

    return { success: false, error: errorMessage };
  }
}

/**
 * Get teacher's current AI allocation
 * Enhanced to work with both Edge Function and direct database fallback
 */
export async function getTeacherAllocation(
  preschoolId: string,
  userId?: string
): Promise<TeacherAIAllocation | null> {
  try {
    const client = assertSupabase();
    
    let targetUserId = userId;
    if (!targetUserId) {
      const { data: { user } } = await client.auth.getUser();
      targetUserId = user?.id;
    }
    
    if (!targetUserId) {
      throw new Error('User ID required');
    }
    
    // Try Edge Function first
    try {
      const { data, error } = await client.functions.invoke('ai-usage', {
        body: {
          action: 'get_teacher_allocation',
          preschool_id: preschoolId,
          user_id: targetUserId,
        },
      });

      if (!error && data?.allocation) {
        return data.allocation;
      }
    } catch (functionError) {
      console.log('Edge function not available for teacher allocation, using direct fallback');
    }
    
    // Fallback to direct database implementation
    // Get all teacher allocations and find the one for this user
    const allAllocations = await getTeacherAllocationsDirect(preschoolId);
    const userAllocation = allAllocations.find(allocation => allocation.user_id === targetUserId);
    
    return userAllocation || null;
    
  } catch (error) {
    console.warn('Failed to get teacher allocation:', error);
    return null;
  }
}

/**
 * Check if user can manage AI allocations for the school
 */
export async function canManageAllocations(userId: string, preschoolId: string): Promise<boolean> {
  try {
    const client = assertSupabase();
    
    // Determine if userId is auth.users.id (UUID v4) or public.users.id
    // Most calls from client use auth.users.id, but some may use public.users.id
    let publicUserId = userId;
    let profile = null;
    
    // First try direct lookup assuming userId is public.users.id
    try {
      const { data: directProfile } = await client
        .from('users')
        .select('id, role, preschool_id, organization_id')
        .eq('id', userId)
        .single();
      
      if (directProfile) {
        profile = directProfile;
        publicUserId = directProfile.id;
      }
    } catch (directError) {
      // If direct lookup fails, try auth_user_id mapping
      try {
        const { data: mappedProfile } = await client
          .from('users')
          .select('id, role, preschool_id, organization_id')
          .eq('auth_user_id', userId)
          .single();
        
        if (mappedProfile) {
          profile = mappedProfile;
          publicUserId = mappedProfile.id;
        }
      } catch (mappingError) {
        console.warn('Both direct and auth_user_id lookups failed:', { directError, mappingError });
      }
    }

    if (!profile) {
      console.warn('User profile not found for allocation check:', { userId, preschoolId });
      return false;
    }

    // Validate school scope - check both preschool_id and organization_id
    const userSchoolId = profile.preschool_id || profile.organization_id;
    if (!userSchoolId || userSchoolId !== preschoolId) {
      console.warn('School scope mismatch:', { userSchoolId, preschoolId, userId });
      return false;
    }

    // Normalize role and check permissions (matching roleUtils logic)
    const normalizedRole = (profile.role || '').toLowerCase().trim();
    const canManage = ['principal', 'principal_admin', 'super_admin', 'superadmin'].includes(normalizedRole);
    
    console.log('canManageAllocations check:', { 
      userId, 
      publicUserId, 
      role: profile.role, 
      normalizedRole, 
      userSchoolId, 
      preschoolId, 
      canManage 
    });
    
    return canManage;
    
  } catch (error) {
    console.error('canManageAllocations check failed:', error);
    return false;
  }
}

/**
 * Get allocation history for audit trail
 */
export async function getAllocationHistory(
  preschoolId: string,
  options: {
    teacher_id?: string;
    limit?: number;
    offset?: number;
    action?: string;
  } = {}
): Promise<{ history: AllocationHistory[]; total: number }> {
  try {
    const client = assertSupabase();
    
    const { data, error } = await client.functions.invoke('ai-usage', {
      body: {
        action: 'allocation_history',
        preschool_id: preschoolId,
        ...options,
      },
    });

    if (error) {
      throw new Error(error.message || 'Failed to fetch allocation history');
    }

    return { history: data?.history || [], total: data?.total || 0 };
    
  } catch (error) {
    reportError(error instanceof Error ? error : new Error('Unknown error'), {
      context: 'getAllocationHistory',
      preschool_id: preschoolId,
      options,
    });
    
    return { history: [], total: 0 };
  }
}

/**
 * Calculate optimal allocation suggestions based on usage patterns
 */
export async function getOptimalAllocationSuggestions(
  preschoolId: string
): Promise<{
  suggestions: Array<{
    teacher_id: string;
    teacher_name: string;
    current_quotas: Record<AIQuotaFeature, number>;
    suggested_quotas: Record<AIQuotaFeature, number>;
    reasoning: string;
    priority: 'low' | 'medium' | 'high';
    potential_savings: number;
  }>;
  school_summary: {
    total_quota_utilization: number;
    underused_quotas: number;
    overdemand_teachers: number;
    optimization_potential: number;
  };
}> {
  try {
    const client = assertSupabase();
    
    // Try Edge Function first
    try {
      const { data, error } = await client.functions.invoke('ai-insights', {
        body: {
          scope: 'school_allocation',
          preschool_id: preschoolId,
          analysis_type: 'optimal_allocation',
        },
      });

      if (!error && data) {
        track('edudash.ai.allocation.optimization_viewed', {
          preschool_id: preschoolId,
          suggestions_count: data.suggestions?.length || 0,
          utilization: data.school_summary?.total_quota_utilization,
          method: 'edge_function',
        });

        return data;
      }
    } catch (functionError) {
      console.log('AI insights Edge Function not available, using direct database fallback');
    }
    
    // Fallback to direct database implementation
    const fallbackResult = await getOptimalAllocationSuggestionsDirect(preschoolId);
    
    track('edudash.ai.allocation.optimization_viewed', {
      preschool_id: preschoolId,
      suggestions_count: fallbackResult.suggestions?.length || 0,
      utilization: fallbackResult.school_summary?.total_quota_utilization,
      method: 'direct_fallback',
    });
    
    return fallbackResult;
    
  } catch (error) {
    console.warn('Both function and direct approaches failed for AI insights, trying direct as final fallback');
    try {
      return await getOptimalAllocationSuggestionsDirect(preschoolId);
    } catch (fallbackError) {
      reportError(error instanceof Error ? error : new Error('Unknown error'), {
        context: 'getOptimalAllocationSuggestions',
        preschool_id: preschoolId,
      });
      
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
  }
}

/**
 * Bulk allocation operations for efficient management
 */
export async function bulkAllocateQuotas(
  preschoolId: string,
  allocations: Array<{
    teacher_id: string;
    quotas: Partial<Record<AIQuotaFeature, number>>;
    reason?: string;
  }>
): Promise<{
  success: boolean;
  results: Array<{ teacher_id: string; success: boolean; error?: string }>;
  summary: { successful: number; failed: number; total_allocated: Record<AIQuotaFeature, number> };
}> {
  const results: Array<{ teacher_id: string; success: boolean; error?: string }> = [];
  const totalAllocated: Record<string, number> = {};
  let successful = 0;
  
  for (const allocation of allocations) {
    const result = await allocateAIQuotas(preschoolId, allocation.teacher_id, allocation.quotas, {
      reason: allocation.reason || 'Bulk allocation',
    });
    
    results.push({
      teacher_id: allocation.teacher_id,
      success: result.success,
      error: result.error,
    });
    
    if (result.success) {
      successful++;
      // Accumulate allocated quotas
      Object.entries(allocation.quotas).forEach(([service, amount]) => {
        if (amount) {
          totalAllocated[service] = (totalAllocated[service] || 0) + amount;
        }
      });
    }
  }
  
  track('edudash.ai.allocation.bulk_operation', {
    preschool_id: preschoolId,
    total_teachers: allocations.length,
    successful,
    failed: allocations.length - successful,
  });
  
  return {
    success: successful > 0,
    results,
    summary: {
      successful,
      failed: allocations.length - successful,
      total_allocated: totalAllocated as Record<AIQuotaFeature, number>,
    },
  };
}