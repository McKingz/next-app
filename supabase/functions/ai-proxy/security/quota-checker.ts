/**
 * Quota Checker Service
 * 
 * Enforces AI usage quotas based on subscription tier.
 * Checks BEFORE calling AI to prevent overage charges.
 */

import type { QuotaCheckResult } from '../types.ts'

/**
 * Check if user has quota remaining for the requested service
 */
export async function checkQuota(
  supabaseAdmin: any,
  userId: string,
  organizationId: string | null,
  serviceType: string,
  effectiveTier?: string // Optional: pass pre-calculated tier (for trials)
): Promise<QuotaCheckResult> {
  try {
    console.log('[Quota] Checking quota:', { userId, organizationId, serviceType })

    // Get user's current usage for this month
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    console.log('[Quota] Querying ai_usage_logs from:', startOfMonth.toISOString())
    const { data: usageData, error: usageError } = await supabaseAdmin
      .from('ai_usage_logs')
      .select('id')
      .eq('user_id', userId)
      .eq('service_type', serviceType)
      .gte('created_at', startOfMonth.toISOString())
      .eq('status', 'success')

    if (usageError) {
      console.error('[Quota] Error querying usage:', usageError)
      return { allowed: false, error: usageError.message }
    }

    console.log('[Quota] Usage query result:', { count: usageData?.length || 0 })
    const used = usageData?.length || 0

    // Default quotas by tier
    const defaultQuotas: Record<string, Record<string, number>> = {
      free: {
        lesson_generation: 5,
        grading_assistance: 5,
        homework_help: 15,
        dash_conversation: 50
      },
      basic: {
        lesson_generation: 20,
        grading_assistance: 20,
        homework_help: 50,
        dash_conversation: 200
      },
      premium: {
        lesson_generation: 100,
        grading_assistance: 100,
        homework_help: 300,
        dash_conversation: 1000
      },
      pro: {
        lesson_generation: 100,
        grading_assistance: 100,
        homework_help: 300,
        dash_conversation: 1000
      },
      enterprise: {
        lesson_generation: -1, // unlimited
        grading_assistance: -1,
        homework_help: -1,
        dash_conversation: -1
      }
    }

    // Get subscription tier (use provided tier or fetch from org)
    let tier = effectiveTier || 'free'
    
    // Only fetch from org if tier not provided
    if (!effectiveTier && organizationId) {
      const { data: orgData } = await supabaseAdmin
        .from('preschools')
        .select('subscription_tier')
        .eq('id', organizationId)
        .single()

      if (orgData?.subscription_tier) {
        tier = orgData.subscription_tier.toLowerCase()
      }
    }
    
    console.log('[Quota] Using tier:', tier, effectiveTier ? '(provided)' : '(from org or default)')

    // Get quota limit for this tier and service
    const tierLimits = defaultQuotas[tier] || defaultQuotas.free
    const limit = tierLimits[serviceType] || 10

    // -1 means unlimited (enterprise tier)
    if (limit === -1) {
      return {
        allowed: true,
        quotaInfo: {
          used,
          limit: -1,
          remaining: -1,
          tier,
        },
      }
    }

    // Check if quota exceeded
    const allowed = used < limit

    return {
      allowed,
      quotaInfo: {
        used,
        limit,
        remaining: Math.max(0, limit - used),
        tier,
      },
      ...(allowed ? {} : { error: `Quota exceeded for ${serviceType}. Used ${used}/${limit} this month.` }),
    }
  } catch (error) {
    console.error('Quota check error:', error)
    return {
      allowed: false,
      error: error instanceof Error ? error.message : 'Unknown quota check error',
    }
  }
}

/**
 * Log AI usage to database
 */
export async function logUsage(
  supabaseAdmin: any,
  params: {
    userId: string
    organizationId: string | null
    serviceType: string
    model: string
    status: 'success' | 'error'
    tokensIn: number
    tokensOut: number
    cost: number
    processingTimeMs: number
    inputText?: string
    outputText?: string
    errorMessage?: string
    metadata?: Record<string, any>
  }
): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from('ai_usage_logs').insert({
      ai_service_id: null, // Not using ai_services table currently
      user_id: params.userId,
      preschool_id: params.organizationId,
      organization_id: params.organizationId,
      service_type: params.serviceType,
      ai_model_used: params.model,
      status: params.status,
      input_tokens: params.tokensIn,
      output_tokens: params.tokensOut,
      total_cost: params.cost,
      processing_time_ms: params.processingTimeMs, // Correct column name from schema
      input_text: params.inputText,
      output_text: params.outputText,
      error_message: params.errorMessage,
      metadata: params.metadata // Re-enabled after schema fix
    })
    
    if (error) {
      console.error('[quota-checker] Failed to log usage:', error)
    }
  } catch (error) {
    console.error('[quota-checker] Failed to log AI usage:', error)
    // Don't throw - logging failure shouldn't break the request
  }
}

/**
 * Get usage statistics for a user
 */
export async function getUsageStats(
  supabaseAdmin: any,
  userId: string,
  serviceType?: string,
  startDate?: Date,
  endDate?: Date
): Promise<{
  totalCalls: number
  successfulCalls: number
  failedCalls: number
  totalTokens: number
  totalCost: number
}> {

  let query = supabaseAdmin
    .from('ai_usage_logs')
    .select('status, tokens_used, estimated_cost')
    .eq('user_id', userId)

  if (serviceType) {
    query = query.eq('service_type', serviceType)
  }
  if (startDate) {
    query = query.gte('created_at', startDate.toISOString())
  }
  if (endDate) {
    query = query.lte('created_at', endDate.toISOString())
  }

  const { data, error } = await query

  if (error || !data) {
    return {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      totalTokens: 0,
      totalCost: 0,
    }
  }

  return {
    totalCalls: data.length,
    successfulCalls: data.filter((d: any) => d.status === 'success').length,
    failedCalls: data.filter((d: any) => d.status === 'error').length,
    totalTokens: data.reduce((sum: number, d: any) => sum + (d.tokens_used || 0), 0),
    totalCost: data.reduce((sum: number, d: any) => sum + (d.estimated_cost || 0), 0),
  }
}
