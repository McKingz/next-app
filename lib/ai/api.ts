/**
 * AI API Client Services
 * 
 * Secure wrapper for server-side AI functions.
 * All AI calls go through Supabase Edge Functions - no client-side AI keys.
 * Complies with WARP.md security requirements.
 */

import { assertSupabase } from '@/lib/supabase';
import { track } from '@/lib/analytics';
import { reportError } from '@/lib/monitoring';
import type { AIQuotaFeature } from './limits';

// Types for API responses
export interface AIUserLimitsResponse {
  quotas: Record<AIQuotaFeature, number>;
  used: Record<AIQuotaFeature, number>;
  remaining: Record<AIQuotaFeature, number>;
  reset_at: string;
  tier: string;
  preschool_id: string;
}

export interface AIOrgLimitsResponse {
  organization_id: string;
  quotas: Record<AIQuotaFeature, number>;
  used: Record<AIQuotaFeature, number>;
  remaining: Record<AIQuotaFeature, number>;
  reset_at: string;
  tier: string;
}

export interface AISchoolUsageSummaryResponse {
  preschool_id: string;
  totals: Record<AIQuotaFeature, number>;
  trend_last_7d: Record<AIQuotaFeature, number>;
  top_users: Array<{
    user_id: string;
    user_name: string;
    total_usage: number;
    breakdown: Record<AIQuotaFeature, number>;
  }>;
  peak_usage_day: string;
  generated_at: string;
}

export interface AIRecentUsageResponse {
  usage_logs: Array<{
    id: string;
    created_at: string;
    service_type: AIQuotaFeature;
    status: 'success' | 'error' | 'rate_limited' | 'quota_exceeded';
    input_tokens?: number;
    output_tokens?: number;
    total_cost?: number;
    metadata?: Record<string, any>;
  }>;
  total_count: number;
  has_more: boolean;
}

export interface AIQuotaStatusResponse {
  service_type: AIQuotaFeature;
  used: number;
  limit: number;
  remaining: number;
  reset_at: string;
  upgrade_suggestions?: Array<{
    tier: string;
    limit: number;
    cost_per_month: number;
    features: string[];
  }>;
}

export interface AIRequestResponse {
  success: boolean;
  content?: string;
  usage?: {
    tokens_in: number;
    tokens_out: number;
    cost: number;
    usage_id: string;
  };
  error?: {
    code: string;
    message: string;
    quota_info?: AIQuotaStatusResponse;
  };
}

export interface AIInsightsResponse {
  title: string;
  bullets: string[];
  cta?: {
    text: string;
    action: string;
  };
  confidence: number;
  generated_at: string;
  scope: 'teacher' | 'principal' | 'parent';
  period_days: number;
}

/**
 * Get user AI limits and current usage
 */
export async function getUserLimits(userId: string): Promise<AIUserLimitsResponse> {
  const startTime = Date.now();
  
  try {
    const client = assertSupabase();
    
    const { data, error } = await client.functions.invoke('ai-usage', {
      body: {
        action: 'user_limits',
        user_id: userId,
      },
    });

    if (error) {
      throw new Error(error.message || 'Failed to fetch user limits');
    }

    if (!data) {
      throw new Error('No data received from limits service');
    }

    // Track successful API call
    track('edudash.ai.api.user_limits_success', {
      user_id: userId,
      duration_ms: Date.now() - startTime,
    });

    return data;
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Track failed API call
    track('edudash.ai.api.user_limits_failed', {
      user_id: userId,
      error: errorMessage,
      duration_ms: Date.now() - startTime,
    });

    // Report to monitoring
    reportError(error instanceof Error ? error : new Error(errorMessage), {
      context: 'getUserLimits',
      user_id: userId,
    });

    throw error;
  }
}

/**
 * Get organization/school AI limits and usage
 */
export async function getOrgLimits(preschoolId: string): Promise<AIOrgLimitsResponse> {
  const startTime = Date.now();
  
  try {
    const client = assertSupabase();
    
    const { data, error } = await client.functions.invoke('ai-usage', {
      body: {
        action: 'org_limits',
        preschool_id: preschoolId,
      },
    });

    if (error) {
      throw new Error(error.message || 'Failed to fetch organization limits');
    }

    if (!data) {
      throw new Error('No data received from org limits service');
    }

    track('edudash.ai.api.org_limits_success', {
      preschool_id: preschoolId,
      duration_ms: Date.now() - startTime,
    });

    return data;
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    track('edudash.ai.api.org_limits_failed', {
      preschool_id: preschoolId,
      error: errorMessage,
      duration_ms: Date.now() - startTime,
    });

    reportError(error instanceof Error ? error : new Error(errorMessage), {
      context: 'getOrgLimits',
      preschool_id: preschoolId,
    });

    throw error;
  }
}

/**
 * Get school-wide AI usage summary with trends
 */
export async function getSchoolUsageSummary(preschoolId: string): Promise<AISchoolUsageSummaryResponse> {
  const startTime = Date.now();
  
  try {
    const client = assertSupabase();
    
    const { data, error } = await client.functions.invoke('ai-usage', {
      body: {
        action: 'school_usage_summary',
        preschool_id: preschoolId,
      },
    });

    if (error) {
      throw new Error(error.message || 'Failed to fetch school usage summary');
    }

    if (!data) {
      throw new Error('No data received from school usage service');
    }

    track('edudash.ai.api.school_usage_success', {
      preschool_id: preschoolId,
      duration_ms: Date.now() - startTime,
    });

    return data;
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    track('edudash.ai.api.school_usage_failed', {
      preschool_id: preschoolId,
      error: errorMessage,
      duration_ms: Date.now() - startTime,
    });

    reportError(error instanceof Error ? error : new Error(errorMessage), {
      context: 'getSchoolUsageSummary',
      preschool_id: preschoolId,
    });

    throw error;
  }
}

/**
 * Get recent AI usage logs
 */
export async function getRecentUsage(params: {
  scope?: 'user' | 'school';
  user_id?: string;
  preschool_id?: string;
  limit?: number;
  offset?: number;
  service_type?: AIQuotaFeature;
}): Promise<AIRecentUsageResponse> {
  const startTime = Date.now();
  
  try {
    const client = assertSupabase();
    
    const { data, error } = await client.functions.invoke('ai-usage', {
      body: {
        action: 'recent_usage',
        ...params,
      },
    });

    if (error) {
      throw new Error(error.message || 'Failed to fetch recent usage');
    }

    if (!data) {
      throw new Error('No data received from recent usage service');
    }

    track('edudash.ai.api.recent_usage_success', {
      scope: params.scope,
      user_id: params.user_id,
      preschool_id: params.preschool_id,
      service_type: params.service_type,
      duration_ms: Date.now() - startTime,
    });

    return data;
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    track('edudash.ai.api.recent_usage_failed', {
      error: errorMessage,
      duration_ms: Date.now() - startTime,
      ...params,
    });

    reportError(error instanceof Error ? error : new Error(errorMessage), {
      context: 'getRecentUsage',
      params,
    });

    throw error;
  }
}

/**
 * Get quota status for a specific service
 */
export async function getQuotaStatus(
  userId: string, 
  serviceType: AIQuotaFeature
): Promise<AIQuotaStatusResponse> {
  const startTime = Date.now();
  
  try {
    const client = assertSupabase();
    
    const { data, error } = await client.functions.invoke('ai-usage', {
      body: {
        action: 'quota_status',
        user_id: userId,
        service_type: serviceType,
      },
    });

    if (error) {
      throw new Error(error.message || 'Failed to fetch quota status');
    }

    if (!data) {
      throw new Error('No data received from quota service');
    }

    track('edudash.ai.api.quota_status_success', {
      user_id: userId,
      service_type: serviceType,
      remaining: data.remaining,
      duration_ms: Date.now() - startTime,
    });

    return data;
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    track('edudash.ai.api.quota_status_failed', {
      user_id: userId,
      service_type: serviceType,
      error: errorMessage,
      duration_ms: Date.now() - startTime,
    });

    reportError(error instanceof Error ? error : new Error(errorMessage), {
      context: 'getQuotaStatus',
      user_id: userId,
      service_type: serviceType,
    });

    throw error;
  }
}

/**
 * Make AI request through secure server proxy
 * NEVER exposes client-side AI keys per WARP.md requirements
 */
export async function postAIRequest(params: {
  scope: 'teacher' | 'principal' | 'parent';
  service_type: AIQuotaFeature;
  payload: Record<string, any>;
  metadata?: Record<string, any>;
}): Promise<AIRequestResponse> {
  const startTime = Date.now();
  
  try {
    const client = assertSupabase();
    
    // Track request start
    track('edudash.ai.request.started', {
      service_type: params.service_type,
      model: 'unknown',
      quota_remaining: 0,
    } as any);
    
    const { data, error } = await client.functions.invoke('ai-proxy', {
      body: {
        scope: params.scope,
        service_type: params.service_type,
        payload: params.payload,
        metadata: params.metadata,
      },
    });

    if (error) {
      // Track failed request
      track('edudash.ai.request.failed', {
        service_type: params.service_type,
        error_code: error.message?.includes('quota') ? 'quota_exceeded' : 'server_error',
        duration_ms: Date.now() - startTime,
        retry_count: 0,
      } as any);
      
      throw new Error(error.message || 'AI request failed');
    }

    if (!data) {
      throw new Error('No response from AI service');
    }

    // Handle quota exceeded or rate limited responses
    if (!data.success && data.error?.code === 'quota_exceeded') {
      track('edudash.ai.quota.blocked', {
        service_type: params.service_type,
        quota_used: data.error.quota_info?.used,
        quota_limit: data.error.quota_info?.limit,
        user_tier: 'unknown', // Will be filled by hook
        upgrade_shown: false, // Will be updated by UI layer
      });
    }

    // Track successful request
    if (data.success) {
      track('edudash.ai.request.succeeded', {
        service_type: params.service_type,
        duration_ms: Date.now() - startTime,
        tokens_used: data.usage?.tokens_in + data.usage?.tokens_out || 0,
        cost_cents: data.usage?.cost || 0,
      });
    }

    return data;
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    track('edudash.ai.request.failed', {
      service_type: params.service_type,
      error_code: 'client_error',
      duration_ms: Date.now() - startTime,
      retry_count: 0,
    } as any);

    reportError(error instanceof Error ? error : new Error(errorMessage), {
      context: 'postAIRequest',
      service_type: params.service_type,
      scope: params.scope,
    });

    throw error;
  }
}

/**
 * Get AI-generated insights for dashboard
 */
export async function getAIInsights(
  scope: 'teacher' | 'principal' | 'parent',
  options?: {
    period_days?: number;
    context?: Record<string, any>;
  }
): Promise<AIInsightsResponse> {
  const startTime = Date.now();
  
  try {
    const client = assertSupabase();
    
    const { data, error } = await client.functions.invoke('ai-insights', {
      body: {
        scope,
        period_days: options?.period_days || 14,
        context: options?.context,
      },
    });

    if (error) {
      throw new Error(error.message || 'Failed to fetch AI insights');
    }

    if (!data) {
      throw new Error('No insights received from AI service');
    }

    track('edudash.ai.insights.viewed', {
      scope,
      insights_count: data.bullets?.length || 0,
      generated_at: data.generated_at,
      confidence_score: data.confidence,
    });

    return data;
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    track('edudash.ai.api.insights_failed', {
      scope,
      error: errorMessage,
      duration_ms: Date.now() - startTime,
    });

    reportError(error instanceof Error ? error : new Error(errorMessage), {
      context: 'getAIInsights',
      scope,
      options,
    });

    throw error;
  }
}

/**
 * Helper to extract error information for UI display
 */
export function extractAPIError(error: any): {
  message: string;
  code: string;
  isQuotaExceeded: boolean;
  isRateLimited: boolean;
  quotaInfo?: AIQuotaStatusResponse;
} {
  const message = error?.message || 'An unexpected error occurred';
  const code = error?.code || 'unknown_error';
  
  return {
    message,
    code,
    isQuotaExceeded: code === 'quota_exceeded',
    isRateLimited: code === 'rate_limited',
    quotaInfo: error?.quota_info,
  };
}