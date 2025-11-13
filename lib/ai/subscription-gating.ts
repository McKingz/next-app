import { SupabaseClient } from '@supabase/supabase-js'
import { 
  AIModelId, 
  SubscriptionTier, 
  canAccessModel, 
  getModelsForTier, 
  getDefaultModelForTier,
  getTierQuotas,
  TIER_HIERARCHY
} from './models'

export interface UserSubscriptionContext {
  userId: string
  organizationId: string | null
  tier: SubscriptionTier
  role: string | null
}

export interface ModelAccessResult {
  allowed: boolean
  reason?: 'tier_restriction' | 'quota_exceeded' | 'rate_limit_exceeded' | 'unauthorized'
  availableModels?: AIModelId[]
  currentUsage?: {
    used: number
    limit: number
    resetDate?: Date
  }
}

/**
 * Get user's subscription context from database
 */
export async function getUserSubscriptionContext(
  supabase: SupabaseClient,
  userId: string
): Promise<UserSubscriptionContext | null> {
  try {
    // Get user profile and organization
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, organization_id, preschool_id, role')
      .eq('id', userId)
      .maybeSingle()

    if (!profile) return null

    const organizationId = profile.organization_id || profile.preschool_id
    if (!organizationId) {
      // Individual user - default to free tier
      return {
        userId,
        organizationId: null,
        tier: 'free',
        role: profile.role
      }
    }

    // Get organization's subscription tier
    const tier = await getOrganizationTier(supabase, organizationId)
    
    return {
      userId,
      organizationId,
      tier,
      role: profile.role
    }
  } catch (error) {
    console.error('Error fetching user subscription context:', error)
    return null
  }
}

/**
 * Get organization's subscription tier from database
 */
async function getOrganizationTier(
  supabase: SupabaseClient, 
  organizationId: string
): Promise<SubscriptionTier> {
  try {
    // Check subscriptions table first (new schema)
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select(`
        status,
        subscription_plans!inner(tier)
      `)
      .eq('school_id', organizationId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const planObj = (subscription as any)?.subscription_plans;
    const planTier = Array.isArray(planObj) ? planObj[0]?.tier : planObj?.tier;
    if (planTier) {
      return planTier as SubscriptionTier
    }

    // Fallback to legacy fields
    const { data: org } = await supabase
      .from('organizations')
      .select('plan_tier')
      .eq('id', organizationId)
      .maybeSingle()

    if (org?.plan_tier) {
      return normalizeToNewTier(org.plan_tier)
    }

    const { data: school } = await supabase
      .from('preschools')
      .select('subscription_tier')
      .eq('id', organizationId)
      .maybeSingle()

    if (school?.subscription_tier) {
      return normalizeToNewTier(school.subscription_tier)
    }

    // Default to free tier
    return 'free'
  } catch (error) {
    console.error('Error fetching organization tier:', error)
    return 'free'
  }
}

/**
 * Normalize legacy tier names to new tier system
 */
function normalizeToNewTier(legacyTier: string): SubscriptionTier {
  const tier = legacyTier.toLowerCase()
  
  // Map legacy tiers to new system
  switch (tier) {
    case 'parent_starter':
    case 'starter':
      return 'starter'
    case 'parent_plus':
    case 'premium':
    case 'pro':
      return 'premium'
    case 'enterprise':
      return 'enterprise'
    default:
      return 'free'
  }
}

/**
 * Check if user can access a specific AI model
 */
export async function checkModelAccess(
  supabase: SupabaseClient,
  userId: string,
  modelId: AIModelId,
  feature: string = 'ai_requests'
): Promise<ModelAccessResult> {
  try {
    const context = await getUserSubscriptionContext(supabase, userId)
    if (!context) {
      return {
        allowed: false,
        reason: 'unauthorized'
      }
    }

    // Check tier-based model access
    if (!canAccessModel(context.tier, modelId)) {
      return {
        allowed: false,
        reason: 'tier_restriction',
        availableModels: getModelsForTier(context.tier).map(m => m.id)
      }
    }

    // Check quota limits
    const quotaResult = await checkQuotaLimits(supabase, context, feature)
    if (!quotaResult.allowed) {
      return quotaResult
    }

    return { allowed: true }
  } catch (error) {
    console.error('Error checking model access:', error)
    return {
      allowed: false,
      reason: 'unauthorized'
    }
  }
}

/**
 * Check quota and rate limits for organization
 */
async function checkQuotaLimits(
  supabase: SupabaseClient,
  context: UserSubscriptionContext,
  feature: string
): Promise<ModelAccessResult> {
  try {
    if (!context.organizationId) {
      // Individual users get basic free tier limits
      return { allowed: true }
    }

    const quotas = getTierQuotas(context.tier)
    
    // If unlimited (-1), allow access
    if (quotas.ai_requests === -1) {
      return { allowed: true }
    }

    // Check monthly usage
    const monthStart = new Date()
    monthStart.setUTCDate(1)
    monthStart.setUTCHours(0, 0, 0, 0)
    
    const { count } = await supabase
      .from('ai_usage_logs')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', context.organizationId)
      .eq('service_type', feature)
      .gte('created_at', monthStart.toISOString())

    const used = Number(count || 0)
    const limit = quotas.ai_requests

    if (used >= limit) {
      const resetDate = new Date(monthStart)
      resetDate.setUTCMonth(resetDate.getUTCMonth() + 1)
      
      return {
        allowed: false,
        reason: 'quota_exceeded',
        currentUsage: {
          used,
          limit,
          resetDate
        }
      }
    }

    return {
      allowed: true,
      currentUsage: {
        used,
        limit
      }
    }
  } catch (error) {
    console.error('Error checking quota limits:', error)
    return { allowed: true } // Fail open for now
  }
}

/**
 * Get available models for user based on their subscription
 */
export async function getAvailableModelsForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<AIModelId[]> {
  try {
    const context = await getUserSubscriptionContext(supabase, userId)
    if (!context) return ['claude-3-haiku'] // fallback

    return getModelsForTier(context.tier).map(m => m.id)
  } catch (error) {
    console.error('Error getting available models for user:', error)
    return ['claude-3-haiku'] // fallback
  }
}

/**
 * Get default model for user based on their subscription
 */
export async function getDefaultModelForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<AIModelId> {
  try {
    const context = await getUserSubscriptionContext(supabase, userId)
    if (!context) return 'claude-3-haiku' // fallback

    return getDefaultModelForTier(context.tier)
  } catch (error) {
    console.error('Error getting default model for user:', error)
    return 'claude-3-haiku' // fallback
  }
}

/**
 * Principal override - principals can allocate AI quotas regardless of tier
 * Based on business rule from user context
 */
export function isPrincipalOverride(context: UserSubscriptionContext): boolean {
  return context.role === 'principal' || context.role === 'principal_admin'
}