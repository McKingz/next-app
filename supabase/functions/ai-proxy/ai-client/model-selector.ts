/**
 * Model Selection Logic
 * 
 * Selects appropriate AI model based on:
 * - Subscription tier
 * - Features required (vision, etc.)
 * - Cost optimization
 * - Provider preferences and availability
 * 
 * WARP.md Compliance: Single Responsibility (model selection only)
 */

import type { ClaudeModel, GLMModel, OpenAIModel, SubscriptionTier } from '../types.ts'
import type { AIModelId, VersionedAIModelId } from '../../../../lib/ai/models'
import { canAccessModel, getDefaultModelForTier, simplifyToVersioned } from '../../../../lib/ai/models'

/**
 * Tier-based model selection
 * 
 * Rules:
 * - Vision (images) requires Sonnet 3.5
 * - Vision available to Basic tier (R299) and above
 * - Pro/Enterprise tiers get Sonnet for better quality
 * - Free/Starter tiers get Haiku for cost efficiency
 * 
 * @param tier - User's subscription tier
 * @param hasImages - Whether request includes images
 * @returns Claude model to use
 * @throws Error if tier doesn't support requested features
 */
export function selectModelForTier(
  tier: SubscriptionTier,
  hasImages: boolean = false
): ClaudeModel {
  // Vision requests: prefer faster model to avoid timeouts
  if (hasImages) {
    // Use Haiku for image analysis to improve latency and reduce timeouts
    return 'claude-3-haiku-20240307'
  }

  // For text-only, use Haiku for lower tiers, Sonnet 3.7 for premium
  if (['pro', 'enterprise', 'premium'].includes(tier)) {
    return 'claude-3-sonnet-4-20250514'
  }

  return 'claude-3-haiku-20240307'
}

/**
 * Get model capabilities
 * 
 * Returns what features a model supports
 */
export function getModelCapabilities(model: ClaudeModel): {
  vision: boolean
  maxTokens: number
  costTier: 'low' | 'high'
  description: string
} {
  switch (model) {
    case 'claude-3-haiku-20240307':
      return {
        vision: true,
        maxTokens: 4096,
        costTier: 'low',
        description: 'Fast, cost-effective model with basic vision support'
      }
    case 'claude-3-sonnet-4-20250514':
      return {
        vision: true,
        maxTokens: 8192,
        costTier: 'high',
        description: 'Latest Claude Sonnet 3.7 with vision support and superior reasoning'
      }
    case 'claude-3-5-sonnet-20241022':
      return {
        vision: true,
        maxTokens: 8192,
        costTier: 'high',
        description: 'Claude Sonnet 3.5 (legacy)'
      }
    default:
      // Fallback for unknown or unsupported models
      return {
        vision: false,
        maxTokens: 4096,
        costTier: 'low',
        description: 'Unknown model - using default capabilities'
      }
  }
}

/**
 * Check if tier supports vision features
 */
export function tierSupportsVision(tier: SubscriptionTier): boolean {
  return ['basic', 'premium', 'pro', 'enterprise'].includes(tier)
}

/**
 * Get recommended model for service type
 * 
 * Some services benefit from better models regardless of tier
 */
export function getRecommendedModelForService(
  serviceType: string,
  tier: SubscriptionTier,
  hasImages: boolean = false
): ClaudeModel {
  // Vision always requires Sonnet
  if (hasImages) {
    return selectModelForTier(tier, true)
  }

  // Complex services that benefit from Sonnet
  const complexServices = [
    'lesson_generation',
    'grading_assistance',
    'progress_analysis',
    'insights'
  ]

  // Pro/Enterprise/Premium always get Sonnet 3.7 for complex services
  if (['pro', 'enterprise', 'premium'].includes(tier) && complexServices.includes(serviceType)) {
    return 'claude-3-sonnet-4-20250514'
  }

  // Default selection
  return selectModelForTier(tier, hasImages)
}

/**
 * Validate model selection
 * 
 * Ensures model is compatible with tier and features
 */
export function validateModelSelection(
  model: ClaudeModel,
  tier: SubscriptionTier,
  hasImages: boolean
): { valid: boolean; error?: string } {
  // Haiku supports basic vision; allow it

  // Check tier access for Sonnet
  if ((model === 'claude-3-sonnet-4-20250514' || model === 'claude-3-5-sonnet-20241022') && hasImages) {
    if (!tierSupportsVision(tier)) {
      return {
        valid: false,
        error: 'Your subscription tier does not support vision features'
      }
    }
  }

  return { valid: true }
}

/**
 * Select GLM model based on tier and requirements
 */
export function selectGLMModelForTier(
  tier: SubscriptionTier,
  hasImages: boolean = false,
  preferLatest: boolean = true
): GLMModel | null {
  // GLM models are only available for Premium+ tiers
  if (!['premium', 'pro', 'enterprise'].includes(tier)) {
    return null
  }

  // Both GLM-4.6 and GLM-4-Plus support vision
  if (hasImages) {
    return preferLatest ? 'glm-4.6' : 'glm-4-plus'
  }

  // For text-only, prefer latest model for premium tiers
  if (preferLatest && ['premium', 'pro', 'enterprise'].includes(tier)) {
    return 'glm-4.6'
  }

  // Default to GLM-4-Plus for cost efficiency
  return 'glm-4-plus'
}

/**
 * Get provider fallback chain
 * 
 * Returns ordered list of models to try in order
 */
export function getProviderFallbackChain(
  tier: SubscriptionTier,
  hasImages: boolean = false,
  preferOpenAI: boolean = false
): Array<{ provider: 'claude' | 'glm' | 'openai'; model: ClaudeModel | GLMModel | OpenAIModel }> {
  const chain: Array<{ provider: 'claude' | 'glm' | 'openai'; model: ClaudeModel | GLMModel | OpenAIModel }> = []

  // If OpenAI is explicitly preferred, start with it
  if (preferOpenAI && !hasImages) {
    chain.push({ provider: 'openai', model: 'gpt-4o-mini' as OpenAIModel })
  }

  // Primary: Claude (best for education)
  const claudeModel = selectModelForTier(tier, hasImages)
  chain.push({ provider: 'claude', model: claudeModel })

  // Secondary: GLM (good vision capabilities)
  const glmModel = selectGLMModelForTier(tier, hasImages, true)
  if (glmModel) {
    chain.push({ provider: 'glm', model: glmModel })
  }

  // Tertiary: OpenAI (last resort)
  if (!preferOpenAI) {
    chain.push({ provider: 'openai', model: (hasImages ? 'gpt-4o' : 'gpt-4o-mini') as OpenAIModel })
  }

  return chain
}

/**
 * Get fallback model if primary fails
 * 
 * Useful for error recovery
 */
export function getFallbackModel(
  primaryModel: ClaudeModel,
  tier: SubscriptionTier
): ClaudeModel {
  // If Sonnet fails, try Haiku (text-only)
  if (primaryModel === 'claude-3-sonnet-4-20250514' || primaryModel === 'claude-3-5-sonnet-20241022') {
    return 'claude-3-haiku-20240307'
  }

  // Haiku is already the fallback
  return primaryModel
}

/**
 * Check if tier supports GLM models
 */
export function tierSupportsGLM(tier: SubscriptionTier): boolean {
  return ['premium', 'pro', 'enterprise'].includes(tier)
}

/**
 * Get GLM model capabilities
 */
export function getGLMModelCapabilities(model: GLMModel): {
  vision: boolean
  maxTokens: number
  costTier: 'medium' | 'high'
  description: string
} {
  switch (model) {
    case 'glm-4.6':
      return {
        vision: true,
        maxTokens: 8192,
        costTier: 'high',
        description: 'Latest GLM model with superior reasoning and vision capabilities'
      }
    case 'glm-4-plus':
      return {
        vision: true,
        maxTokens: 8192,
        costTier: 'medium',
        description: 'Advanced GLM model with strong multimodal capabilities'
      }
  }
}

/**
 * Estimate token count (rough approximation)
 * 
 * Used for quota checking before API call
 */
export function estimateTokenCount(text: string): number {
  // Rough estimate: ~4 characters per token
  return Math.ceil(text.length / 4)
}

/**
 * Check if request exceeds model's max tokens
 */
export function exceedsMaxTokens(
  model: ClaudeModel,
  estimatedTokens: number
): boolean {
  const capabilities = getModelCapabilities(model)
  return estimatedTokens > capabilities.maxTokens
}
