/**
 * Shared Types for AI Proxy
 * 
 * Centralized type definitions for all AI proxy modules.
 */

export interface AIProxyRequest {
  scope: 'teacher' | 'principal' | 'parent'
  service_type: 'lesson_generation' | 'grading_assistance' | 'homework_help' | 'progress_analysis' | 'insights' | 'transcription' | 'dash_conversation' | 'conversation' | 'general'
  payload: {
    prompt?: string
    context?: string
    audio_url?: string  // For transcription requests
    images?: Array<{
      data: string  // base64-encoded image
      media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
    }>
    conversationHistory?: Array<{
      role: 'user' | 'assistant'
      content: string | Array<{
        type: 'text' | 'image'
        text?: string
        source?: {
          type: 'base64'
          media_type: string
          data: string
        }
      }>
    }>
    metadata?: Record<string, any>
  }
  stream?: boolean  // Enable Server-Sent Events streaming
  enable_tools?: boolean  // Enable agentic tool calling
  tool_choice?: any
  prefer_openai?: boolean  // Prefer OpenAI as primary provider (bypasses Claude)
  metadata?: {
    student_id?: string
    class_id?: string
    subject?: string
    role?: string  // User role for tool access control
    [key: string]: any
  }
}

export interface QuotaCheckResult {
  allowed: boolean
  quotaInfo?: {
    used: number
    limit: number
    remaining: number
    tier: string
  }
  error?: string
}

export interface PIIRedactionResult {
  redactedText: string
  redactionCount: number
}

export interface ValidationResult {
  success: boolean
  error?: string
  warnings?: string[]
}

export interface ExamQuestion {
  number: number
  question: string
  marks: number
  diagram?: {
    type: 'bar' | 'line' | 'pie' | 'mermaid' | 'svg' | 'image'
    data: any
    config?: any
  }
  images?: Array<{
    url: string
    caption?: string
    alt?: string
  }>
}

export interface ExamValidationResult extends ValidationResult {
  questions?: ExamQuestion[]
  totalMarks?: number
}

export interface ToolDefinition {
  name: string
  description: string
  input_schema: {
    type: 'object'
    properties: Record<string, any>
    required: string[]
  }
}

export interface ToolExecutionResult {
  success: boolean
  result?: any
  error?: string
}

export interface ModelConfig {
  name: string
  maxTokens: number
  temperature: number
  topP: number
}

// ===== AI Client Types =====

export type ClaudeModel = 'claude-3-haiku-20240307' | 'claude-3-5-sonnet-20241022' | 'claude-sonnet-4-20250514'
export type SubscriptionTier = 'free' | 'starter' | 'basic' | 'premium' | 'pro' | 'enterprise'

export interface ClaudeTool {
  name: string
  description: string
  input_schema: {
    type: 'object'
    properties: Record<string, any>
    required: string[]
  }
}

export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: any
}

export interface AnthropicClientConfig {
  apiKey: string
  model: ClaudeModel
  prompt: string
  images?: Array<{ data: string; media_type: string }>
  stream?: boolean
  tools?: ClaudeTool[]
  tool_choice?: { type: 'auto' | 'any' | 'tool'; name?: string }
  conversationHistory?: Array<{ role: string; content: any }>
  systemPrompt?: string
  maxTokens?: number
}

export interface AnthropicResponse {
  content: string
  tokensIn: number
  tokensOut: number
  cost: number
  model: string
  response?: Response  // Raw response for streaming
  tool_use?: Array<{ id: string; name: string; input: Record<string, any> }>
}

export interface StreamingResponse {
  fullContent: string
  tokensIn: number
  tokensOut: number
}

// Tool context for execution
export interface ToolContext {
  supabaseAdmin: any
  userId: string
  organizationId: string | null
  role: string
  tier: string
  hasOrganization: boolean
  isGuest: boolean
}
