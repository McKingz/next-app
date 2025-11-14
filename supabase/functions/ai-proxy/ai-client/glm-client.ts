/**
 * GLM Client Integration
 *
 * Handles communication with Zhipu AI GLM models (GLM-4.6, GLM-4-Plus)
 * Supports multimodal requests (text + images) with proper error handling
 */

import type { GLMModel } from '../types.ts'

export interface GLMModelConfig {
  apiKey: string
  model: GLMModel
  prompt: string
  images?: Array<{ data: string; media_type: string }>
  stream?: boolean
  conversationHistory?: Array<{ role: string; content: any }>
  maxTokens?: number
  temperature?: number
}

export interface GLMResponse {
  content: string
  tokensIn: number
  tokensOut: number
  cost: number
  model: string
  tool_use?: Array<{ id: string; name: string; input: Record<string, any> }>
}

export interface GLMError {
  code: string
  message: string
  type: string
}

// Cost per million tokens (approximate, will vary by region)
export const GLM_COSTS: Record<GLMModel, { input: number; output: number }> = {
  'glm-4.6': { input: 0.015, output: 0.06 },    // ~$0.015 input, $0.06 output per 1M tokens
  'glm-4-plus': { input: 0.01, output: 0.04 },    // ~$0.01 input, $0.04 output per 1M tokens
}

/**
 * Call GLM API with proper error handling and fallback support
 */
export async function callGLM(config: GLMModelConfig): Promise<GLMResponse> {
  const { apiKey, model, prompt, images, conversationHistory, maxTokens = 4096, temperature = 0.7 } = config

  console.log(`[glm-client] Calling ${model} with`, {
    promptLength: prompt.length,
    hasImages: !!(images && images.length > 0),
    hasHistory: !!(conversationHistory && conversationHistory.length > 0),
    maxTokens
  })

  // Build messages array
  const messages: any[] = []

  // Add conversation history if provided
  if (conversationHistory && conversationHistory.length > 0) {
    messages.push(...conversationHistory)
  }

  // Add current prompt
  if (images && images.length > 0) {
    // Multimodal message with images
    const content: any[] = [
      { type: 'text', text: prompt }
    ]

    for (const image of images) {
      content.push({
        type: 'image_url',
        image_url: {
          url: `data:${image.media_type};base64,${image.data}`
        }
      })
    }

    messages.push({
      role: 'user',
      content
    })
  } else {
    // Text-only message
    messages.push({
      role: 'user',
      content: prompt
    })
  }

  try {
    const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        max_tokens: maxTokens,
        temperature: temperature,
        stream: false // TODO: Add streaming support later
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error(`[glm-client] API error:`, {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      })

      // Handle specific GLM error codes
      if (response.status === 429) {
        const errorMessage = errorData?.error?.message || 'Rate limit exceeded'
        if (errorMessage.includes('balance') || errorMessage.includes('Insufficient balance')) {
          throw new Error(`GLM_BALANCE_DEPLETED: ${errorMessage}`)
        }
        throw new Error(`GLM_RATE_LIMIT: ${errorMessage}`)
      }

      if (response.status === 401) {
        throw new Error(`GLM_AUTH_ERROR: Invalid API key`)
      }

      if (response.status === 400) {
        throw new Error(`GLM_BAD_REQUEST: ${errorData?.error?.message || 'Invalid request'}`)
      }

      throw new Error(`GLM_API_ERROR: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    
    if (!data.choices || data.choices.length === 0) {
      throw new Error('GLM_NO_RESPONSE: No response from GLM API')
    }

    const choice = data.choices[0]
    const content = choice.message?.content || ''

    if (!content) {
      throw new Error('GLM_EMPTY_RESPONSE: Empty content in GLM response')
    }

    // Calculate token usage and cost
    const tokensIn = data.usage?.prompt_tokens || 0
    const tokensOut = data.usage?.completion_tokens || 0
    const cost = calculateGLMCost(model, tokensIn, tokensOut)

    console.log(`[glm-client] Success:`, {
      model,
      tokensIn,
      tokensOut,
      cost,
      contentLength: content.length
    })

    return {
      content,
      tokensIn,
      tokensOut,
      cost,
      model,
      tool_use: choice.message?.tool_calls ? choice.message.tool_calls.map((tc: any) => ({
        id: tc.id,
        name: tc.function.name,
        input: JSON.parse(tc.function.arguments)
      })) : undefined
    }

  } catch (error) {
    console.error('[glm-client] Error calling GLM:', error)

    // Re-throw with context
    if (error instanceof Error) {
      throw error
    }
    
    throw new Error(`GLM_UNKNOWN_ERROR: ${error}`)
  }
}

/**
 * Calculate GLM API cost based on token usage
 */
export function calculateGLMCost(model: GLMModel, tokensIn: number, tokensOut: number): number {
  const costs = GLM_COSTS[model]
  const inputCost = (tokensIn / 1000000) * costs.input
  const outputCost = (tokensOut / 1000000) * costs.output
  return inputCost + outputCost
}

/**
 * Check if error is related to depleted balance
 */
export function isGLMBalanceError(error: any): boolean {
  if (!error || typeof error !== 'object') return false
  
  const message = error.message || ''
  return message.includes('GLM_BALANCE_DEPLETED') || 
         message.includes('Insufficient balance') ||
         message.includes('no resource package')
}

/**
 * Check if error is rate limit related
 */
export function isGLMRateLimitError(error: any): boolean {
  if (!error || typeof error !== 'object') return false
  
  const message = error.message || ''
  return message.includes('GLM_RATE_LIMIT') || message.includes('rate limit')
}

/**
 * Get retry delay for rate limit errors
 */
export function getGLMRetryDelay(error: any): number {
  if (!error || typeof error !== 'object') return 5000 // Default 5 seconds
  
  // Try to extract retry-after from GLM error
  const message = error.message || ''
  const retryMatch = message.match(/retry after (\d+)/i)
  if (retryMatch) {
    return parseInt(retryMatch[1]) * 1000
  }
  
  // Default delays
  if (message.includes('GLM_RATE_LIMIT')) return 30000 // 30 seconds for rate limit
  return 5000 // 5 seconds default
}

/**
 * Estimate token count for GLM (rough approximation)
 */
export function estimateGLMTokens(text: string): number {
  // Rough estimate: ~4 characters per token (similar to most models)
  return Math.ceil(text.length / 4)
}

/**
 * Check if model supports vision capabilities
 */
export function GLMModelSupportsVision(model: GLMModel): boolean {
  // Both GLM-4.6 and GLM-4-Plus support vision
  return true
}

/**
 * Get model capabilities
 */
export function getGLMModelCapabilities(model: GLMModel): {
  vision: boolean
  maxTokens: number
  costTier: 'low' | 'medium' | 'high'
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
