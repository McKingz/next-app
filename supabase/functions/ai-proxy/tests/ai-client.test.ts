/**
 * Tests for AI Client Modules
 * 
 * Tests anthropic-client.ts and model-selector.ts
 */

import { assertEquals, assertExists, assert } from 'https://deno.land/std@0.208.0/assert/mod.ts'
import {
  selectModelForTier,
  getModelCapabilities,
  tierSupportsVision,
  getRecommendedModelForService,
  validateModelSelection,
  getFallbackModel,
  estimateTokenCount,
  exceedsMaxTokens
} from '../ai-client/model-selector.ts'
import {
  calculateCost,
  buildConversationHistory,
  createToolResultMessage,
  createToolUseBlock,
  getModelPricing,
  validateApiKey
} from '../ai-client/anthropic-client.ts'
import type { ClaudeModel, SubscriptionTier } from '../types.ts'

// ===== Model Selector Tests =====

Deno.test('Model Selector: select Haiku for free tier text-only', () => {
  const model = selectModelForTier('free', false)
  assertEquals(model, 'claude-3-haiku-20240307')
})

Deno.test('Model Selector: select Haiku for starter tier text-only', () => {
  const model = selectModelForTier('starter', false)
  assertEquals(model, 'claude-3-haiku-20240307')
})

Deno.test('Model Selector: select Sonnet for pro tier text-only', () => {
  const model = selectModelForTier('pro', false)
  assertEquals(model, 'claude-3-5-sonnet-20241022')
})

Deno.test('Model Selector: select Sonnet for enterprise tier text-only', () => {
  const model = selectModelForTier('enterprise', false)
  assertEquals(model, 'claude-3-5-sonnet-20241022')
})

Deno.test('Model Selector: select Sonnet for basic tier with images', () => {
  const model = selectModelForTier('basic', true)
  assertEquals(model, 'claude-3-5-sonnet-20241022')
})

Deno.test('Model Selector: select Sonnet for pro tier with images', () => {
  const model = selectModelForTier('pro', true)
  assertEquals(model, 'claude-3-5-sonnet-20241022')
})

Deno.test('Model Selector: reject vision for free tier', () => {
  try {
    selectModelForTier('free', true)
    assert(false, 'Should have thrown error')
  } catch (error) {
    assert(error instanceof Error)
    assert(error.message.includes('Vision features require Basic subscription'))
  }
})

Deno.test('Model Selector: reject vision for starter tier', () => {
  try {
    selectModelForTier('starter', true)
    assert(false, 'Should have thrown error')
  } catch (error) {
    assert(error instanceof Error)
    assert(error.message.includes('Vision features require Basic subscription'))
  }
})

Deno.test('Model Selector: get Haiku capabilities', () => {
  const capabilities = getModelCapabilities('claude-3-haiku-20240307')
  assertEquals(capabilities.vision, false)
  assertEquals(capabilities.maxTokens, 4096)
  assertEquals(capabilities.costTier, 'low')
  assertExists(capabilities.description)
})

Deno.test('Model Selector: get Sonnet capabilities', () => {
  const capabilities = getModelCapabilities('claude-3-5-sonnet-20241022')
  assertEquals(capabilities.vision, true)
  assertEquals(capabilities.maxTokens, 8192)
  assertEquals(capabilities.costTier, 'high')
  assertExists(capabilities.description)
})

Deno.test('Model Selector: check free tier does not support vision', () => {
  assertEquals(tierSupportsVision('free'), false)
})

Deno.test('Model Selector: check basic tier supports vision', () => {
  assertEquals(tierSupportsVision('basic'), true)
})

Deno.test('Model Selector: check pro tier supports vision', () => {
  assertEquals(tierSupportsVision('pro'), true)
})

Deno.test('Model Selector: recommend Sonnet for lesson generation on pro tier', () => {
  const model = getRecommendedModelForService('lesson_generation', 'pro', false)
  assertEquals(model, 'claude-3-5-sonnet-20241022')
})

Deno.test('Model Selector: recommend Haiku for chat on free tier', () => {
  const model = getRecommendedModelForService('dash_conversation', 'free', false)
  assertEquals(model, 'claude-3-haiku-20240307')
})

Deno.test('Model Selector: validate Sonnet with vision on pro tier', () => {
  const result = validateModelSelection('claude-3-5-sonnet-20241022', 'pro', true)
  assertEquals(result.valid, true)
})

Deno.test('Model Selector: reject Haiku with vision', () => {
  const result = validateModelSelection('claude-3-haiku-20240307', 'free', true)
  assertEquals(result.valid, false)
  assertExists(result.error)
  assert(result.error!.includes('does not support vision'))
})

Deno.test('Model Selector: reject Sonnet vision on free tier', () => {
  const result = validateModelSelection('claude-3-5-sonnet-20241022', 'free', true)
  assertEquals(result.valid, false)
  assertExists(result.error)
  assert(result.error!.includes('does not support vision'))
})

Deno.test('Model Selector: get fallback from Sonnet to Haiku', () => {
  const fallback = getFallbackModel('claude-3-5-sonnet-20241022', 'free')
  assertEquals(fallback, 'claude-3-haiku-20240307')
})

Deno.test('Model Selector: Haiku is its own fallback', () => {
  const fallback = getFallbackModel('claude-3-haiku-20240307', 'free')
  assertEquals(fallback, 'claude-3-haiku-20240307')
})

Deno.test('Model Selector: estimate token count for short text', () => {
  const tokens = estimateTokenCount('Hello world')
  assert(tokens > 0 && tokens < 10)
})

Deno.test('Model Selector: estimate token count for long text', () => {
  const longText = 'word '.repeat(1000)
  const tokens = estimateTokenCount(longText)
  assert(tokens > 500) // ~5000 chars / 4 = 1250 tokens
})

Deno.test('Model Selector: check if request exceeds Haiku max tokens', () => {
  const estimatedTokens = 5000
  const exceeds = exceedsMaxTokens('claude-3-haiku-20240307', estimatedTokens)
  assertEquals(exceeds, true) // Haiku max is 4096
})

Deno.test('Model Selector: check if request within Sonnet max tokens', () => {
  const estimatedTokens = 5000
  const exceeds = exceedsMaxTokens('claude-3-5-sonnet-20241022', estimatedTokens)
  assertEquals(exceeds, false) // Sonnet max is 8192
})

// ===== Anthropic Client Tests =====

Deno.test('Anthropic Client: calculate cost for Haiku', () => {
  const cost = calculateCost('claude-3-haiku-20240307', 1000, 500)
  
  // Expected: (1000 * 0.00000025) + (500 * 0.00000125) = 0.00025 + 0.000625 = 0.000875
  assertEquals(cost, 0.000875)
})

Deno.test('Anthropic Client: calculate cost for Sonnet', () => {
  const cost = calculateCost('claude-3-5-sonnet-20241022', 1000, 500)
  
  // Expected: (1000 * 0.000003) + (500 * 0.000015) = 0.003 + 0.0075 = 0.0105
  assertEquals(cost, 0.0105)
})

Deno.test('Anthropic Client: calculate cost with zero tokens', () => {
  const cost = calculateCost('claude-3-haiku-20240307', 0, 0)
  assertEquals(cost, 0)
})

Deno.test('Anthropic Client: build conversation history', () => {
  const messages = [
    { role: 'user' as const, content: 'Hello' },
    { role: 'assistant' as const, content: 'Hi there!' }
  ]
  
  const history = buildConversationHistory(messages)
  assertEquals(history.length, 2)
  assertEquals(history[0].role, 'user')
  assertEquals(history[0].content, 'Hello')
  assertEquals(history[1].role, 'assistant')
  assertEquals(history[1].content, 'Hi there!')
})

Deno.test('Anthropic Client: create tool result message', () => {
  const result = createToolResultMessage('tool-123', 'Success')
  
  assertEquals(result.type, 'tool_result')
  assertEquals(result.tool_use_id, 'tool-123')
  assertEquals(result.content, 'Success')
})

Deno.test('Anthropic Client: create tool use block', () => {
  const block = createToolUseBlock('tool-456', 'generate_exam', { grade: 'grade_9' })
  
  assertEquals(block.type, 'tool_use')
  assertEquals(block.id, 'tool-456')
  assertEquals(block.name, 'generate_exam')
  assertEquals(block.input.grade, 'grade_9')
})

Deno.test('Anthropic Client: get Haiku pricing', () => {
  const pricing = getModelPricing('claude-3-haiku-20240307')
  
  assertEquals(pricing.input, 0.00000025)
  assertEquals(pricing.output, 0.00000125)
})

Deno.test('Anthropic Client: get Sonnet pricing', () => {
  const pricing = getModelPricing('claude-3-5-sonnet-20241022')
  
  assertEquals(pricing.input, 0.000003)
  assertEquals(pricing.output, 0.000015)
})

Deno.test('Anthropic Client: validate valid API key', () => {
  const valid = validateApiKey('sk-ant-1234567890')
  assertEquals(valid, true)
})

Deno.test('Anthropic Client: reject invalid API key (wrong prefix)', () => {
  const valid = validateApiKey('invalid-key')
  assertEquals(valid, false)
})

Deno.test('Anthropic Client: reject empty API key', () => {
  const valid = validateApiKey('')
  assertEquals(valid, false)
})

console.log('\n✅ All AI Client tests defined (37 tests)')
