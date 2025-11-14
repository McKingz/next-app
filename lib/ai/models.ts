export type AIModelId = 'claude-3-haiku' | 'claude-3-sonnet' | 'claude-3-opus' | 'glm-4.6' | 'glm-4-plus'
export type SubscriptionTier = 'free' | 'starter' | 'basic' | 'premium' | 'pro' | 'enterprise'

// Versioned model IDs for API clients (backward compatibility)
export type VersionedAIModelId = 
  | 'claude-3-haiku-20240307'
  | 'claude-3-5-sonnet-20241022' 
  | 'claude-3-sonnet-4-20250514'
  | 'glm-4.6'
  | 'glm-4-plus'
  | 'gpt-4' 
  | 'gpt-4-turbo' 
  | 'gpt-3.5-turbo' 
  | 'gpt-4o' 
  | 'gpt-4o-mini'

export type AIModelInfo = {
  id: AIModelId
  name: string
  provider: 'claude' | 'openai' | 'glm' | 'custom'
  relativeCost: number // configurable weight for pricing/cost hints (1x, 5x, 20x)
  notes?: string
  minTier: SubscriptionTier // Minimum subscription tier required
  displayName: string // User-friendly display name
  description: string // Detailed description for UI
}

// Central place to tune model weights for UI hints and rough cost estimates
export const MODEL_WEIGHTS: Record<AIModelId, number> = {
  'claude-3-haiku': 1,
  'claude-3-sonnet': 5, // ~5x haiku
  'claude-3-opus': 20,  // ~20x haiku
  'glm-4.6': 12, // Cost weight relative to Claude models
  'glm-4-plus': 8, // Cost weight relative to Claude models
}

// Tier hierarchy for access checks
export const TIER_HIERARCHY: Record<SubscriptionTier, number> = {
  'free': 1,
  'starter': 2,
  'basic': 3,
  'premium': 4,
  'pro': 5,
  'enterprise': 6,
}

// Monthly quota limits by tier (number of AI requests)
export const TIER_QUOTAS: Record<SubscriptionTier, { ai_requests: number; priority_support: boolean; rpm_limit: number }> = {
  'free': { ai_requests: 50, priority_support: false, rpm_limit: 5 },
  'starter': { ai_requests: 500, priority_support: false, rpm_limit: 15 },
  'basic': { ai_requests: 1500, priority_support: false, rpm_limit: 20 },
  'premium': { ai_requests: 2500, priority_support: true, rpm_limit: 30 },
  'pro': { ai_requests: 5000, priority_support: true, rpm_limit: 45 },
  'enterprise': { ai_requests: -1, priority_support: true, rpm_limit: 60 }, // -1 = unlimited
}

export function getDefaultModels(): AIModelInfo[] {
  return [
    {
      id: 'claude-3-haiku',
      name: 'Claude 3 Haiku',
      displayName: 'Dash Fast',
      provider: 'claude',
      relativeCost: MODEL_WEIGHTS['claude-3-haiku'],
      minTier: 'free',
      description: 'Lightning-fast responses for quick questions and basic lesson planning',
      notes: 'Available on all plans'
    },
    {
      id: 'claude-3-sonnet',
      name: 'Claude 3 Sonnet',
      displayName: 'Dash Smart',
      provider: 'claude',
      relativeCost: MODEL_WEIGHTS['claude-3-sonnet'],
      minTier: 'starter',
      description: 'Balanced intelligence for comprehensive lesson generation and detailed feedback',
      notes: 'Starter plan and above'
    },
    {
      id: 'claude-3-opus',
      name: 'Claude 3 Opus',
      displayName: 'Dash Expert',
      provider: 'claude',
      relativeCost: MODEL_WEIGHTS['claude-3-opus'],
      minTier: 'premium',
      description: 'Maximum intelligence for complex educational content and advanced grading',
      notes: 'Premium and Enterprise only'
    },
    {
      id: 'glm-4.6',
      name: 'GLM-4.6',
      displayName: 'Dash Vision Pro',
      provider: 'glm',
      relativeCost: MODEL_WEIGHTS['glm-4.6'],
      minTier: 'premium',
      description: 'Latest GLM model with superior reasoning and vision capabilities',
      notes: 'Premium and Enterprise only'
    },
    {
      id: 'glm-4-plus',
      name: 'GLM-4-Plus',
      displayName: 'Dash Vision',
      provider: 'glm',
      relativeCost: MODEL_WEIGHTS['glm-4-plus'],
      minTier: 'premium',
      description: 'Advanced GLM model with strong multimodal capabilities',
      notes: 'Premium and Enterprise only'
    },
  ]
}

/**
 * Check if a user's tier allows access to a specific model
 */
export function canAccessModel(userTier: SubscriptionTier, modelId: AIModelId): boolean {
  const model = getDefaultModels().find(m => m.id === modelId)
  if (!model) return false
  
  return TIER_HIERARCHY[userTier] >= TIER_HIERARCHY[model.minTier]
}

/**
 * Get all models available to a specific tier
 */
export function getModelsForTier(tier: SubscriptionTier): AIModelInfo[] {
  return getDefaultModels().filter(model => canAccessModel(tier, model.id))
}

/**
 * Get the default/recommended model for a tier
 */
export function getDefaultModelForTier(tier: SubscriptionTier): AIModelId {
  const availableModels = getModelsForTier(tier)
  if (availableModels.length === 0) return 'claude-3-haiku' // fallback
  
  // Return the highest tier model available (last in filtered array)
  return availableModels[availableModels.length - 1].id
}

/**
 * Check quota limits for a tier
 */
export function getTierQuotas(tier: SubscriptionTier) {
  return TIER_QUOTAS[tier]
}

// Model mapping utilities for API compatibility
export function simplifyToVersioned(modelId: AIModelId): VersionedAIModelId {
  switch (modelId) {
    case 'claude-3-haiku':
      return 'claude-3-haiku-20240307'
    case 'claude-3-sonnet':
      return 'claude-3-5-sonnet-20241022'
    case 'claude-3-opus':
      return 'claude-3-sonnet-4-20250514' // Note: This maps to Sonnet 3.7, but keeping for compatibility
    case 'glm-4.6':
    case 'glm-4-plus':
      return modelId // GLM models use same format
    default:
      throw new Error(`Unknown model ID: ${modelId}`)
  }
}

export function versionedToSimplified(modelId: VersionedAIModelId): AIModelId {
  switch (modelId) {
    case 'claude-3-haiku-20240307':
      return 'claude-3-haiku'
    case 'claude-3-5-sonnet-20241022':
      return 'claude-3-sonnet'
    case 'claude-3-sonnet-4-20250514':
      return 'claude-3-opus' // Note: This maps from Sonnet 3.7 to Opus for compatibility
    case 'glm-4.6':
    case 'glm-4-plus':
      return modelId // GLM models use same format
    default:
      throw new Error(`Unknown versioned model ID: ${modelId}`)
  }
}

export function getAPIClientModel(modelId: AIModelId, provider: 'claude' | 'openai' | 'glm'): string {
  // GLM models use same format
  if (provider === 'glm') {
    return modelId
  }
  
  // Map Claude models to versioned IDs
  if (provider === 'claude') {
    return simplifyToVersioned(modelId)
  }
  
  // Map OpenAI models (these aren't in our system yet, but prepare for future use)
  if (provider === 'openai') {
    const openaiModels: Record<string, string> = {
      'gpt-4': 'gpt-4',
      'gpt-4-turbo': 'gpt-4-turbo',
      'gpt-3.5-turbo': 'gpt-3.5-turbo',
      'gpt-4o': 'gpt-4o',
      'gpt-4o-mini': 'gpt-4o-mini'
    }
    return openaiModels[modelId] || modelId
  }
  
  throw new Error(`Unknown provider: ${provider}`)
}
