import { assertSupabase } from '@/lib/supabase'

export type OrgType = 'preschool' | 'k12' | 'individual'
export type Tier = 'free' | 'starter' | 'premium' | 'enterprise'
// Legacy tier names kept for backward compatibility during migration only
export type LegacyTier = 'parent_starter' | 'parent_plus' | 'private_teacher' | 'pro' | 'basic'

/**
 * Determine organization type for the current user.
 * Priority:
 * - user_metadata.org_type if present ('preschool' | 'k12')
 * - If profile.preschool_id exists -> 'preschool'
 * - Else 'individual'
 */
export async function getOrgType(): Promise<OrgType> {
  try {
    const { data: userRes } = await assertSupabase().auth.getUser()
    const orgTypeMeta = ((userRes?.user?.user_metadata as any)?.org_type || '').toLowerCase()
    if (orgTypeMeta === 'k12' || orgTypeMeta === 'school') return 'k12'
    if (orgTypeMeta === 'preschool' || orgTypeMeta === 'pre_school') return 'preschool'

    // Fallback: infer from profile record
    if (userRes?.user?.id) {
      const { data: prof } = await assertSupabase()
        .from('profiles')
        .select('id, preschool_id')
        .eq('id', userRes.user.id)
        .maybeSingle()
      if (prof && (prof as any).preschool_id) return 'preschool'
    }
    return 'individual'
  } catch {
    return 'individual'
  }
}

/**
 * Normalize legacy tier names to new tier system
 * Maps old tier names to production tiers: free, starter, premium, enterprise
 */
export function normalizeTier(tier: string): Tier {
  const normalized = tier.toLowerCase()
  switch (normalized) {
    case 'parent_starter':
    case 'starter':
      return 'starter'
    case 'parent_plus':
    case 'basic':
    case 'pro':
    case 'premium':
      return 'premium'
    case 'enterprise':
      return 'enterprise'
    default:
      return 'free'
  }
}

/**
 * Plan gating for organization-managed AI allocations.
 * - Preschools: available starting from Starter plan (2 seats minimum per business rule)
 * - K-12 Schools: available starting from Premium plan
 * - Individuals: not applicable
 * - Principals: always allowed regardless of tier (core management capability)
 */
export async function canUseAllocation(tier: Tier | LegacyTier, orgType: OrgType): Promise<boolean> {
  // Normalize tier
  const normalizedTier = normalizeTier(tier)
  
  // Check if user is a principal or principal_admin - they should always have access
  try {
    const { data } = await assertSupabase().auth.getUser()
    const userRole = (data?.user?.user_metadata as any)?.role
    if (userRole === 'principal' || userRole === 'principal_admin') {
      return true
    }
  } catch {
    // Continue with tier-based checks if role check fails
  }

  if (orgType === 'preschool') {
    return normalizedTier === 'starter' || normalizedTier === 'premium' || normalizedTier === 'enterprise'
  }
  if (orgType === 'k12') {
    return normalizedTier === 'premium' || normalizedTier === 'enterprise'
  }
  return false
}

/**
 * Model selection UI available from Premium and Enterprise tiers.
 * Starter tier gets one upgraded model, Premium+ gets all models.
 */
export function canSelectModels(tier: Tier | LegacyTier): boolean {
  const normalizedTier = normalizeTier(tier)
  return normalizedTier === 'premium' || normalizedTier === 'enterprise'
}

/**
 * Get AI quota limits based on subscription tier
 */
export function getAIQuotaLimits(tier: Tier | LegacyTier) {
  const normalizedTier = normalizeTier(tier)
  
  switch (normalizedTier) {
    case 'free':
      return { monthly: 50, rpm: 5, models: ['claude-3-haiku'] }
    case 'starter': 
      return { monthly: 500, rpm: 15, models: ['claude-3-haiku', 'claude-3-sonnet'] }
    case 'premium':
      return { monthly: 2500, rpm: 30, models: ['claude-3-haiku', 'claude-3-sonnet', 'claude-3-opus'] }
    case 'enterprise':
      return { monthly: -1, rpm: 60, models: ['claude-3-haiku', 'claude-3-sonnet', 'claude-3-opus'] } // -1 = unlimited
    default:
      return { monthly: 50, rpm: 5, models: ['claude-3-haiku'] }
  }
}

