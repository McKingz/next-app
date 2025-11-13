/**
 * AI Proxy Edge Function - Refactored
 * 
 * Thin orchestration layer (≤200 lines)
 * 
 * Flow:
 * 1. Validate auth → 2. Check quota → 3. Redact PII → 4. Select model
 * 5. Call Claude → 6. Handle tools/streaming → 7. Log usage → 8. Return
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

// Security
import { validateAuth } from './security/auth-validator.ts'
import { checkQuota, logUsage } from './security/quota-checker.ts'
import { redactPII } from './security/pii-redactor.ts'

// AI Client
import { selectModelForTier } from './ai-client/model-selector.ts'
import { callClaude } from './ai-client/anthropic-client.ts'

// Tools
import { getToolsForRole } from './tools/tool-registry.ts'

// Utilities
import { getCorsHeaders, handlePreflight, createErrorResponse, createSuccessResponse } from './utils/cors.ts'
import { createStreamingResponse } from './utils/streaming-handler.ts'
import { handleToolExecution } from './utils/tool-handler.ts'

import type { AIProxyRequest, ToolContext } from './types.ts'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req: Request): Promise<Response> => {
  // Handle CORS
  if (req.method === 'OPTIONS') return handlePreflight()
  if (req.method !== 'POST') {
    return createErrorResponse('method_not_allowed', 'Only POST requests allowed', 405)
  }

  try {
    // Parse and validate request
    const body: AIProxyRequest = await req.json()
    const { scope, payload, metadata = {}, stream = false, enable_tools = false } = body
    
    const VALID_TYPES = ['lesson_generation', 'homework_help', 'grading_assistance', 'general', 'dash_conversation', 'conversation']
    const service_type = body.service_type && VALID_TYPES.includes(body.service_type as string) 
      ? body.service_type 
      : 'dash_conversation'

    if (!scope || !service_type || !payload?.prompt) {
      return createErrorResponse('invalid_request', 'Missing required fields', 400)
    }

    // Initialize Supabase
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Authenticate
    const auth = await validateAuth(req.headers.get('Authorization'), supabase)
    if (!auth.valid || !auth.user) {
      return createErrorResponse('unauthorized', 'Authentication failed', 401)
    }

    // Extract context
    const { user, profile } = auth
    const organizationId = profile?.organization_id || profile?.preschool_id || null
    const tier = (profile?.subscription_tier?.toLowerCase() || 'free') as any
    const role = profile?.role || metadata.role || scope
    const hasOrganization = !!organizationId
    const isGuest = !user.email_confirmed_at
    const startTime = Date.now()

    // Check quota
    const quota = await checkQuota(supabase, user.id, organizationId, service_type)
    if (!quota.allowed) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'quota_exceeded', message: 'AI quota exceeded', quota_info: quota.quotaInfo }
      }), {
        status: 429,
        headers: { ...getCorsHeaders(), 'Content-Type': 'application/json', 'Retry-After': '3600' }
      })
    }

    // Redact PII
    const { redactedText, redactionCount } = redactPII(payload.prompt)

    // Select model
    const hasImages = !!(payload.images && payload.images.length > 0)
    let model: string
    try {
      model = selectModelForTier(tier, hasImages)
    } catch (error) {
      return createErrorResponse('tier_restriction', (error as Error).message, 403)
    }

    // Load tools if enabled
    const tools = enable_tools ? getToolsForRole(role, tier) : undefined
    if (tools) console.log(`[ai-proxy] Loaded ${tools.length} tools`)

    // Build tool context
    const toolContext: ToolContext = {
      supabaseAdmin: supabase,
      userId: user.id,
      organizationId,
      role,
      tier,
      hasOrganization,
      isGuest
    }

    try {
      // Call Claude
      const result = await callClaude({
        apiKey: ANTHROPIC_API_KEY!,
        model: model as any,
        prompt: redactedText,
        images: payload.images,
        stream,
        tools
      })

      // Handle streaming
      if (stream && result.response) {
        return createStreamingResponse(result.response, result.model, {
          supabaseAdmin: supabase,
          userId: user.id,
          organizationId,
          serviceType: service_type,
          inputText: redactedText,
          metadata,
          scope,
          tier,
          hasImages,
          imageCount: payload.images?.length || 0,
          redactionCount,
          startTime
        })
      }

      // Handle tool use
      if (result.tool_use && result.tool_use.length > 0) {
        return handleToolExecution(result, toolContext, {
          apiKey: ANTHROPIC_API_KEY!,
          originalPrompt: redactedText,
          tier,
          hasImages,
          images: payload.images,
          availableTools: tools
        }, {
          supabaseAdmin: supabase,
          userId: user.id,
          organizationId,
          serviceType: service_type,
          metadata,
          scope,
          redactionCount,
          startTime
        })
      }

      // Log usage
      await logUsage(supabase, {
        userId: user.id,
        organizationId,
        serviceType: service_type,
        model: result.model,
        status: 'success',
        tokensIn: result.tokensIn,
        tokensOut: result.tokensOut,
        cost: result.cost,
        processingTimeMs: Date.now() - startTime,
        inputText: redactedText,
        outputText: result.content,
        metadata: { ...metadata, scope, tier, has_images: hasImages, image_count: payload.images?.length || 0, redaction_count: redactionCount }
      })

      // Return response
      return createSuccessResponse({
        content: result.content,
        usage: { tokens_in: result.tokensIn, tokens_out: result.tokensOut, cost: result.cost }
      })

    } catch (aiError) {
      // Log error
      await logUsage(supabase, {
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
        metadata: { ...metadata, scope, error: (aiError as Error).message, redaction_count: redactionCount }
      })

      return createErrorResponse('ai_service_error', 'AI service unavailable', 503)
    }

  } catch (error) {
    console.error('[ai-proxy] Error:', error)
    return createErrorResponse('internal_error', 'Internal server error', 500)
  }
})
