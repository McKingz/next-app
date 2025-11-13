/**
 * AI Proxy Edge Function - Refactored
 * 
 * Thin orchestration layer that coordinates:
 * - Authentication
 * - Quota enforcement
 * - PII redaction
 * - AI model selection
 * - Claude API calls
 * - Tool execution
 * - Usage logging
 * 
 * WARP.md Compliant: ≤200 lines (orchestration only)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

// Import all modules
import { validateAuth } from './security/auth-validator.ts'
import { checkQuota, logUsage } from './security/quota-checker.ts'
import { redactPII } from './security/pii-redactor.ts'
import { getCorsHeaders, handlePreflight, createErrorResponse, createSuccessResponse } from './utils/cors.ts'
import { selectModelForTier } from './ai-client/model-selector.ts'
import { callClaude, processStream, calculateCost } from './ai-client/anthropic-client.ts'
import { getToolsForRole, executeTool } from './tools/tool-registry.ts'
import type { AIProxyRequest, ToolContext } from './types.ts'

// Environment variables
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders()

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handlePreflight()
  }

  if (req.method !== 'POST') {
    return createErrorResponse('method_not_allowed', 'Only POST requests allowed', 405)
  }

  try {
    // Parse request
    const requestBody: AIProxyRequest = await req.json()
    const { scope, payload, metadata = {}, stream = false, enable_tools = false } = requestBody

    // Validate and normalize service_type
    const VALID_SERVICE_TYPES = [
      'lesson_generation',
      'homework_help',
      'grading_assistance',
      'general',
      'dash_conversation',
      'conversation'
    ]
    const rawServiceType = requestBody.service_type
    const service_type = rawServiceType && VALID_SERVICE_TYPES.includes(rawServiceType as string)
      ? rawServiceType
      : 'dash_conversation'

    // Validate request
    if (!scope || !service_type || !payload?.prompt) {
      return createErrorResponse('invalid_request', 'Missing required fields: scope, service_type, or payload.prompt', 400)
    }

    // Initialize Supabase
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Validate authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return createErrorResponse('unauthorized', 'Missing authorization header', 401)
    }

    const authResult = await validateAuth(authHeader, supabaseAdmin)
    if (!authResult.valid || !authResult.user) {
      return createErrorResponse('unauthorized', 'Invalid token', 401)
    }

    const { user, profile } = authResult

    // Extract user context
    const organizationId = profile?.organization_id || profile?.preschool_id || null
    const tier = (profile?.subscription_tier?.toLowerCase() || 'free') as any
    const role = profile?.role || metadata.role || scope
    const hasOrganization = !!organizationId
    const isGuest = !user.email_confirmed_at
    const startTime = Date.now()

    // Check quota BEFORE calling AI
    const quotaCheck = await checkQuota(supabaseAdmin, user.id, organizationId, service_type)
    if (!quotaCheck.allowed) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'quota_exceeded',
            message: 'AI quota exceeded for this service',
            quota_info: quotaCheck.quotaInfo
          }
        }),
        {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '3600' }
        }
      )
    }

    // Redact PII per WARP.md
    const { redactedText, redactionCount } = redactPII(payload.prompt)

    // Select appropriate model
    const hasImages = !!(payload.images && payload.images.length > 0)
    let model: string
    try {
      model = selectModelForTier(tier, hasImages)
    } catch (error) {
      return createErrorResponse('tier_restriction', (error as Error).message, 403)
    }

    // Load tools if requested
    let availableTools: any[] | undefined
    if (enable_tools) {
      availableTools = getToolsForRole(role, tier)
      console.log(`[ai-proxy] Loaded ${availableTools.length} tools for role=${role}, tier=${tier}`)
    }

    // Build tool context for later use
    const toolContext: ToolContext = {
      supabaseAdmin,
      userId: user.id,
      organizationId,
      role,
      tier,
      hasOrganization,
      isGuest
    }

    try {
      // Call Claude API
      const aiResult = await callClaude({
        apiKey: ANTHROPIC_API_KEY!,
        model: model as any,
        prompt: redactedText,
        images: payload.images,
        stream,
        tools: availableTools
      })

      // Handle streaming response
      if (stream && aiResult.response) {
        return handleStreamingResponse(aiResult.response, aiResult.model, supabaseAdmin, user.id, organizationId, service_type, redactedText, metadata, scope, tier, hasImages, payload.images?.length || 0, redactionCount, startTime)
      }

      // Handle tool use
      if (aiResult.tool_use && aiResult.tool_use.length > 0) {
        return await handleToolUse(aiResult, toolContext, redactedText, tier, hasImages, payload.images, availableTools, supabaseAdmin, user.id, organizationId, service_type, metadata, scope, redactionCount, startTime)
      }

      // Log successful usage
      await logUsage(supabaseAdmin, {
        userId: user.id,
        organizationId,
        serviceType: service_type,
        model: aiResult.model,
        status: 'success',
        tokensIn: aiResult.tokensIn,
        tokensOut: aiResult.tokensOut,
        cost: aiResult.cost,
        processingTimeMs: Date.now() - startTime,
        inputText: redactedText,
        outputText: aiResult.content,
        metadata: {
          ...metadata,
          scope,
          tier,
          has_images: hasImages,
          image_count: payload.images?.length || 0,
          redaction_count: redactionCount
        }
      })

      // Return normal response
      return createSuccessResponse({
        content: aiResult.content,
        usage: {
          tokens_in: aiResult.tokensIn,
          tokens_out: aiResult.tokensOut,
          cost: aiResult.cost
        }
      })

    } catch (aiError) {
      // Log error
      await logUsage(supabaseAdmin, {
        userId: user.id,
        organizationId,
        serviceType: service_type,
        model,
        status: 'error',
        tokensIn: 0,
        tokensOut: 0,
        cost: 0,
        processingTimeMs: Date.now() - startTime,
        errorMessage: (aiError as Error).message,
        inputText: redactedText,
        metadata: {
          ...metadata,
          scope,
          error: (aiError as Error).message,
          redaction_count: redactionCount
        }
      })

      return createErrorResponse('ai_service_error', 'AI service temporarily unavailable', 503)
    }

  } catch (error) {
    console.error('[ai-proxy] Error:', error)
    return createErrorResponse('internal_error', 'Internal server error', 500)
  }
})

/**
 * Handle streaming response from Claude
 */
async function handleStreamingResponse(
  response: Response,
  model: string,
  supabaseAdmin: any,
  userId: string,
  organizationId: string | null,
  serviceType: string,
  inputText: string,
  metadata: any,
  scope: string,
  tier: string,
  hasImages: boolean,
  imageCount: number,
  redactionCount: number,
  startTime: number
): Promise<Response> {
  const encoder = new TextEncoder()
  let fullContent = ''
  let tokensIn = 0
  let tokensOut = 0

  const stream = new ReadableStream({
    async start(controller) {
      try {
        await processStream(
          response,
          (text) => {
            fullContent += text
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'content_block_delta',
              delta: { text }
            })}\n\n`))
          },
          () => {
            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            controller.close()
          }
        ).then(async (result) => {
          tokensIn = result.tokensIn
          tokensOut = result.tokensOut

          // Log streaming usage
          await logUsage(supabaseAdmin, {
            userId,
            organizationId,
            serviceType,
            model,
            status: 'success',
            tokensIn,
            tokensOut,
            cost: calculateCost(model as any, tokensIn, tokensOut),
            processingTimeMs: Date.now() - startTime,
            inputText,
            outputText: fullContent,
            metadata: {
              ...metadata,
              scope,
              tier,
              streaming: true,
              has_images: hasImages,
              image_count: imageCount,
              redaction_count: redactionCount
            }
          })
        })
      } catch (error) {
        console.error('[ai-proxy] Streaming error:', error)
        controller.error(error)
      }
    }
  })

  return new Response(stream, {
    status: 200,
    headers: {
      ...getCorsHeaders(),
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  })
}

/**
 * Handle tool use (agentic AI)
 */
async function handleToolUse(
  aiResult: any,
  toolContext: ToolContext,
  originalPrompt: string,
  tier: string,
  hasImages: boolean,
  images: any[] | undefined,
  availableTools: any[] | undefined,
  supabaseAdmin: any,
  userId: string,
  organizationId: string | null,
  serviceType: string,
  metadata: any,
  scope: string,
  redactionCount: number,
  startTime: number
): Promise<Response> {
  console.log(`[ai-proxy] Claude requested ${aiResult.tool_use.length} tool calls`)

  // Execute all tools
  const toolResults = await Promise.all(
    aiResult.tool_use.map(async (toolCall: any) => {
      const result = await executeTool(toolCall.name, toolCall.input, toolContext)
      return {
        type: 'tool_result',
        tool_use_id: toolCall.id,
        content: result.success ? JSON.stringify(result.result) : `Error: ${result.error}`
      }
    })
  )

  // Send tool results back to Claude for final response
  const continuationResult = await callClaude({
    apiKey: ANTHROPIC_API_KEY!,
    model: aiResult.model,
    prompt: originalPrompt,
    images,
    stream: false,
    tools: availableTools,
    conversationHistory: [
      { role: 'user', content: originalPrompt },
      {
        role: 'assistant',
        content: [
          ...(aiResult.content ? [{ type: 'text', text: aiResult.content }] : []),
          ...aiResult.tool_use.map((tu: any) => ({
            type: 'tool_use',
            id: tu.id,
            name: tu.name,
            input: tu.input
          }))
        ]
      },
      {
        role: 'user',
        content: toolResults
      }
    ]
  })

  // Log combined usage
  const totalTokensIn = aiResult.tokensIn + continuationResult.tokensIn
  const totalTokensOut = aiResult.tokensOut + continuationResult.tokensOut
  const totalCost = aiResult.cost + continuationResult.cost

  await logUsage(supabaseAdmin, {
    userId,
    organizationId,
    serviceType,
    model: aiResult.model,
    status: 'success',
    tokensIn: totalTokensIn,
    tokensOut: totalTokensOut,
    cost: totalCost,
    processingTimeMs: Date.now() - startTime,
    inputText: originalPrompt,
    outputText: continuationResult.content,
    metadata: {
      ...metadata,
      scope,
      tier,
      tool_count: toolResults.length,
      redaction_count: redactionCount
    }
  })

  return createSuccessResponse({
    content: continuationResult.content,
    tool_use: aiResult.tool_use,
    tool_results: toolResults,
    usage: {
      tokens_in: totalTokensIn,
      tokens_out: totalTokensOut,
      cost: totalCost
    }
  })
}
