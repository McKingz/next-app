/**
 * Authentication Validator
 * 
 * Validates JWT tokens and extracts user context.
 */

export interface UserContext {
  userId: string
  organizationId: string | null
  role: string
  email?: string
}

/**
 * Validate JWT and extract user context
 * 
 * @param authHeader - Authorization header with Bearer token
 * @param supabaseAdmin - Supabase admin client
 * @returns Validation result with user and profile data
 */
export async function validateAuth(
  authHeader: string | null,
  supabaseAdmin: any
): Promise<{ valid: boolean; user?: any; profile?: any; error?: string }> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { valid: false, error: 'Missing or invalid Authorization header' }
  }

  try {
    const token = authHeader.replace('Bearer ', '')

    // Verify JWT and get user
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)

    if (error || !user) {
      return { valid: false, error: 'Invalid or expired token' }
    }

    // Get profile data with organization info and subscription tier
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('organization_id, preschool_id, role, subscription_tier, trial_ends_at')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      console.error('Profile query error:', profileError)
    }

    // Profile is optional for some use cases
    return {
      valid: true,
      user,
      profile: profile || null
    }
  } catch (error) {
    console.error('Auth validation error:', error)
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Authentication failed',
    }
  }
}

/**
 * Check if user has required role for operation
 */
export function hasRole(
  userContext: UserContext,
  requiredRoles: string[]
): boolean {
  return requiredRoles.includes(userContext.role)
}

/**
 * Check if user belongs to organization (tenant isolation)
 */
export function belongsToOrganization(
  userContext: UserContext,
  organizationId: string
): boolean {
  return userContext.organizationId === organizationId
}
