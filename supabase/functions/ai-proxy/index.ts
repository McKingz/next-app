/**
 * AI Proxy Edge Function - Refactored
 * 
 * Thin orchestration layer (≤200 lines)
 * 
 * Flow:
 * 1. Validate auth → 2. Check quota → 3. Redact PII → 4. Select model
 * 5. Call AI (Claude → GLM → OpenAI) → 6. Handle tools/streaming → 7. Log usage → 8. Return
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

// Security
import { validateAuth } from './security/auth-validator.ts'
import { checkQuota, logUsage } from './security/quota-checker.ts'
import { redactPII } from './security/pii-redactor.ts'

// AI Client
import { selectModelForTier, getProviderFallbackChain } from './ai-client/model-selector'
import { callClaude } from './ai-client/anthropic-client'
import { callOpenAI } from './ai-client/openai-client'
import { callGLM, isGLMBalanceError, isGLMRateLimitError, getGLMRetryDelay } from './ai-client/glm-client'

// Model mapping utilities
import type { ClaudeModel, GLMModel, OpenAIModel } from './types'

// Helper function to map model IDs for API calls
function getAPIClientModel(model: ClaudeModel | GLMModel | OpenAIModel, provider: 'claude' | 'glm' | 'openai'): string {
  switch (provider) {
    case 'claude':
      return model // Claude models are already in versioned format
    case 'glm':
      return model // GLM models use same format
    case 'openai':
      return model // OpenAI models use same format
    default:
      throw new Error(`Unknown provider: ${provider}`)
  }
}

// Tools
import { getToolsForRole } from './tools/tool-registry.ts'

// Utilities
import { getCorsHeaders, handlePreflight, createErrorResponse, createSuccessResponse } from './utils/cors.ts'
import { createStreamingResponse } from './utils/streaming-handler.ts'
import { handleToolExecution } from './utils/tool-handler.ts'
import { aiRequestQueue, isRateLimitError, getRetryAfter } from './utils/request-queue.ts'

import type { AIProxyRequest, ToolContext } from './types.ts'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
const GLM_API_KEY = Deno.env.get('GLM_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Log startup configuration (once)
console.log('[ai-proxy] Edge function starting up... v2.1')
console.log('[ai-proxy] Configuration check:', {
  hasAnthropicKey: !!ANTHROPIC_API_KEY,
  hasOpenAIKey: !!OPENAI_API_KEY,
  hasGLMKey: !!GLM_API_KEY,
  hasSupabaseUrl: !!SUPABASE_URL,
  hasServiceRoleKey: !!SUPABASE_SERVICE_ROLE_KEY,
  anthropicKeyLength: ANTHROPIC_API_KEY?.length || 0,
  openaiKeyLength: OPENAI_API_KEY?.length || 0,
  glmKeyLength: GLM_API_KEY?.length || 0
})

serve(async (req: Request): Promise<Response> => {
  const requestId = crypto.randomUUID().substring(0, 8)
  console.log(`[ai-proxy:${requestId}] Incoming ${req.method} request from ${req.headers.get('origin') || 'unknown'}`)
  
  // Handle CORS
  if (req.method === 'OPTIONS') {
    console.log(`[ai-proxy:${requestId}] Handling CORS preflight`)
    return handlePreflight()
  }
  
  // Special endpoint to check queue status (for monitoring)
  if (req.method === 'GET' && req.url.includes('/health')) {
    const queueStatus = aiRequestQueue.getStatus();
    return new Response(JSON.stringify({
      status: 'healthy',
      queue: queueStatus,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { ...getCorsHeaders(), 'Content-Type': 'application/json' }
    });
  }
  
  if (req.method !== 'POST') {
    console.log(`[ai-proxy:${requestId}] Invalid method: ${req.method}`)
    return createErrorResponse('method_not_allowed', 'Only POST requests allowed', 405)
  }

  try {
    // Validate providers: allow OpenAI-only setups too
    if (!ANTHROPIC_API_KEY && !OPENAI_API_KEY && !GLM_API_KEY) {
      console.error(`[ai-proxy:${requestId}] CRITICAL: No AI providers configured`)
      return createErrorResponse('configuration_error', 'AI service is not configured (no providers available)', 500)
    }
    
    console.log(`[ai-proxy:${requestId}] Starting request processing...`)
    // Parse and validate request
    let body: AIProxyRequest
    try {
      body = await req.json()
      console.log(`[ai-proxy:${requestId}] Request parsed:`, {
        scope: body.scope,
        service_type: body.service_type,
        enable_tools: body.enable_tools,
        stream: body.stream,
        hasPayload: !!body.payload,
        promptLength: body.payload?.prompt?.length || 0
      })
    } catch (parseError) {
      console.error(`[ai-proxy:${requestId}] JSON parse error:`, parseError)
      return createErrorResponse('invalid_json', 'Invalid JSON in request body', 400)
    }
    
    const { scope, payload, metadata = {}, stream = false, enable_tools = false, tool_choice, prefer_openai = false } = body
    
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
    console.log(`[ai-proxy:${requestId}] Auth result:`, { valid: auth.valid, hasUser: !!auth.user, hasProfile: !!auth.profile, error: auth.error })
    if (!auth.valid || !auth.user) {
      console.error(`[ai-proxy:${requestId}] Auth failed:`, auth.error)
      return createErrorResponse('unauthorized', 'Authentication failed', 401)
    }

    // Extract context
    const { user, profile } = auth
    console.log(`[ai-proxy:${requestId}] User context:`, { 
      userId: user.id, 
      email: user.email,
      hasProfile: !!profile,
      role: profile?.role,
      orgId: profile?.organization_id || profile?.preschool_id,
      subscriptionTier: profile?.subscription_tier,
      // User-level trial fields
      isTrial: profile?.is_trial,
      trialEndDate: profile?.trial_end_date,
      trialPlanTier: profile?.trial_plan_tier,
      // Org-level trial fields (legacy)
      trialEndsAt: profile?.trial_ends_at
    })
    const organizationId = profile?.organization_id || profile?.preschool_id || null
    
    // Determine effective tier (handle both org-level and user-level trials)
    let tier = (profile?.subscription_tier?.toLowerCase() || 'free') as any
    
    try {
      // Check user-level trial (new system - for independent users)
      if (profile?.is_trial === true && profile?.trial_end_date) {
        const trialEndDate = new Date(profile.trial_end_date)
        const now = new Date()
        const trialExpired = trialEndDate < now
        
        if (trialExpired) {
          console.warn(`[ai-proxy:${requestId}] User trial expired on ${profile.trial_end_date}, using free tier`)
          tier = 'free'
        } else {
          // Active user trial - grant premium access
          const trialTier = (profile?.trial_plan_tier?.toLowerCase() || 'premium') as any
          console.log(`[ai-proxy:${requestId}] Active user trial until ${profile.trial_end_date}, tier: ${trialTier}`)
          tier = trialTier
        }
      }
      // Check org-level trial (legacy system)
      else if (profile?.trial_ends_at) {
        const trialEndDate = new Date(profile.trial_ends_at)
        const now = new Date()
        const trialExpired = trialEndDate < now
        
        if (trialExpired) {
          console.warn(`[ai-proxy:${requestId}] Org trial expired on ${profile.trial_ends_at}, downgrading to free tier`)
          tier = 'free'
        } else {
          // Active org trial - use the tier from profile
          console.log(`[ai-proxy:${requestId}] Active org trial until ${profile.trial_ends_at}`)
        }
      }
    } catch (tierError) {
      console.error(`[ai-proxy:${requestId}] Error determining tier:`, tierError)
      // Fallback to free tier on error
      tier = 'free'
    }
    
    console.log(`[ai-proxy:${requestId}] Effective tier: ${tier}`)
    
    const role = profile?.role || metadata.role || scope
    const hasOrganization = !!organizationId
    const isGuest = !user.email_confirmed_at
    const startTime = Date.now()

    // Check quota (pass tier for trial users)
    console.log(`[ai-proxy:${requestId}] Checking quota for user ${user.id}, service: ${service_type}, tier: ${tier}`)
    const quota = await checkQuota(supabase, user.id, organizationId, service_type, tier)
    console.log(`[ai-proxy:${requestId}] Quota check result:`, { allowed: quota.allowed, quotaInfo: quota.quotaInfo, error: quota.error })
    if (!quota.allowed) {
      console.warn(`[ai-proxy:${requestId}] Quota exceeded for ${service_type}`)
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

    // Get AI configuration
    const hasImages = !!(payload.images && payload.images.length > 0)
    console.log(`[ai-proxy:${requestId}] Model selection:`, { service_type, tier, hasImages, prefer_openai })
    
    // Load tools if enabled
    const tools = enable_tools ? getToolsForRole(role, tier) : undefined
    if (tools) {
      console.log(`[ai-proxy] Loaded ${tools.length} tools for role: ${role}, tier: ${tier}`)
      console.log(`[ai-proxy] Available tools:`, tools.map(t => t.name))
    } else if (enable_tools) {
      console.warn(`[ai-proxy] Tools enabled but none loaded for role: ${role}, tier: ${tier}`)
    }

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
      // Get provider fallback chain - Claude → GLM → OpenAI
      const providerChain = getProviderFallbackChain(tier, hasImages, prefer_openai);
      console.log(`[ai-proxy:${requestId}] Provider fallback chain:`, providerChain.map(p => `${p.provider}:${p.model}`));

      // Try each provider in order until one succeeds
      let lastError: Error | null = null;
      
      for (const provider of providerChain) {
        try {
          console.log(`[ai-proxy:${requestId}] Attempting ${provider.provider} with model ${provider.model}`);
          
          if (provider.provider === 'claude') {
            const claudeModel = selectModelForTier(tier, hasImages);
            const result = await callClaude({
              apiKey: ANTHROPIC_API_KEY!,
              model: claudeModel,
              prompt: redactedText,
              images: payload.images,
              conversationHistory: payload.conversationHistory,
              stream,
              tools,
              tool_choice,
              maxTokens: hasImages ? 1536 : 4096
            });

            console.log(`[ai-proxy:${requestId}] Claude request succeeded`);
            
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

            // Log usage and return success
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
              metadata: { ...metadata, scope, tier, has_images: hasImages, image_count: payload.images?.length || 0, redaction_count: redactionCount, provider: 'claude' }
            });

            return createSuccessResponse({
              content: result.content,
              usage: { tokens_in: result.tokensIn, tokens_out: result.tokensOut, cost: result.cost },
              provider: 'claude'
            });
          }
          
          else if (provider.provider === 'glm') {
            const result = await callGLM({
              apiKey: GLM_API_KEY!,
              model: provider.model as any,
              prompt: redactedText,
              images: payload.images,
              conversationHistory: payload.conversationHistory,
              stream: false, // GLM streaming not implemented yet
              maxTokens: hasImages ? 1536 : 4096
            });

            console.log(`[ai-proxy:${requestId}] GLM request succeeded`);
            
            // Handle tool use if present
            if (result.tool_use && result.tool_use.length > 0) {
              return handleToolExecution(result, toolContext, {
                apiKey: GLM_API_KEY!,
                originalPrompt: redactedText,
                tier,
                hasImages,
                images: payload.images,
                availableTools: tools,
                provider: 'glm'
              }, {
                supabaseAdmin: supabase,
                userId: user.id,
                organizationId,
                serviceType: service_type,
                metadata: { ...metadata, provider: 'glm' },
                scope,
                redactionCount,
                startTime
              })
            }

            // Log usage and return success
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
              metadata: { ...metadata, scope, tier, has_images: hasImages, image_count: payload.images?.length || 0, redaction_count: redactionCount, provider: 'glm' }
            });

            return createSuccessResponse({
              content: result.content,
              usage: { tokens_in: result.tokensIn, tokens_out: result.tokensOut, cost: result.cost },
              provider: 'glm'
            });
          }
          
          else if (provider.provider === 'openai') {
            const needsReliableToolCalling = tool_choice && tool_choice.type === 'tool';
            const openaiModel = getAPIClientModel(provider.model, 'openai');
            const toolsForOpenAI = service_type === 'dash_conversation' ? undefined : tools;

            const result = await callOpenAI({
              apiKey: OPENAI_API_KEY,
              model: openaiModel as any,
              prompt: redactedText,
              images: payload.images,
              conversationHistory: payload.conversationHistory,
              tools: toolsForOpenAI,
              tool_choice
            });
            
            console.log(`[ai-proxy:${requestId}] OpenAI request succeeded`);

            // Handle tool calls if present
            if (result.tool_calls && result.tool_calls.length > 0) {
              const tool_use = result.tool_calls.map((tc: any) => ({
                id: tc.id,
                name: tc.function.name,
                input: JSON.parse(tc.function.arguments)
              }));
              
              const aiResult = {
                content: result.content,
                tool_use,
                tokensIn: result.tokensIn,
                tokensOut: result.tokensOut,
                cost: result.cost,
                model: result.model
              };
              
              return handleToolExecution(aiResult, toolContext, {
                apiKey: OPENAI_API_KEY,
                originalPrompt: redactedText,
                tier,
                hasImages,
                images: payload.images,
                availableTools: tools,
                provider: 'openai'
              }, {
                supabaseAdmin: supabase,
                userId: user.id,
                organizationId,
                serviceType: service_type,
                metadata: { ...metadata, provider: 'openai' },
                scope,
                redactionCount,
                startTime
              });
            }
            
            // Log usage and return success
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
              metadata: { ...metadata, scope, tier, has_images: hasImages, image_count: payload.images?.length || 0, redaction_count: redactionCount, provider: 'openai' }
            });
            
            return createSuccessResponse({
              content: result.content,
              usage: { tokens_in: result.tokensIn, tokens_out: result.tokensOut, cost: result.cost },
              provider: 'openai'
            });
          }
          
        } catch (providerError) {
          console.warn(`[ai-proxy:${requestId}] ${provider.provider} failed:`, providerError);
          lastError = providerError as Error;
          
          // Special handling for GLM balance errors - continue to next provider
          if (provider.provider === 'glm' && isGLMBalanceError(providerError)) {
            console.warn(`[ai-proxy:${requestId}] GLM balance depleted, trying next provider...`);
            continue; // Try next provider in chain
          }
          
          // For other errors, also try next provider
          continue;
        }
      }
      
      // All providers failed, return to last error with fallback logic
      if (lastError) {
        // Log error
        await logUsage(supabase, {
          userId: user.id,
          organizationId,
          serviceType: service_type,
          model: 'unknown',
          status: 'error',
          tokensIn: 0,
          tokensOut: 0,
          cost: 0,
          processingTimeMs: Date.now() - startTime,
          errorMessage: lastError.message,
          inputText: redactedText,
          metadata: { ...metadata, scope, error: lastError.message, error_stack: lastError.stack, redaction_count: redactionCount }
        });

        // Return appropriate error response
        if (lastError.message.includes('GLM_BALANCE_DEPLETED')) {
          return new Response(JSON.stringify({
            success: false,
            error: { 
              code: 'glm_balance_depleted', 
              message: 'GLM balance depleted. Please recharge your Zhipu AI account or try again later.',
              details: lastError.message
            }
          }), {
            status: 429,
            headers: { ...getCorsHeaders(), 'Content-Type': 'application/json' }
          });
        }
        
        if (isRateLimitError(lastError)) {
          const retryMs = getRetryAfter(lastError);
          const retrySeconds = Math.ceil(retryMs / 1000);
          return new Response(JSON.stringify({
            success: false,
            error: { 
              code: 'rate_limit', 
              message: `Rate limit exceeded. Please retry in ${retrySeconds} seconds.`,
              retry_after: retrySeconds
            }
          }), {
            status: 429,
            headers: { ...getCorsHeaders(), 'Content-Type': 'application/json', 'Retry-After': String(retrySeconds) }
          });
        }

        // General error
        return createErrorResponse('ai_service_error', `AI service error: ${lastError.message.substring(0, 100)}`, 503)
      }

    } catch (error) {
      console.error(`[ai-proxy:${requestId}] Unhandled error:`, error)
      console.error(`[ai-proxy:${requestId}] Error stack:`, (error as Error).stack)
      
      // Log unhandled error
      await logUsage(supabase, {
        userId: user.id,
        organizationId,
        serviceType: service_type,
        model: 'unknown',
        status: 'error',
        tokensIn: 0,
        tokensOut: 0,
        cost: 0,
        processingTimeMs: Date.now() - startTime,
        errorMessage: (error as Error).message,
        inputText: redactedText,
        metadata: { ...metadata, scope, error: (error as Error).message, error_stack: (error as Error).stack, redaction_count: redactionCount }
      })
      
      return createErrorResponse('internal_error', `Internal server error: ${(error as Error).message}`, 500)
    }
  } catch (error) {
    console.error(`[ai-proxy:${requestId}] Critical error:`, error)
    return createErrorResponse('internal_error', `Critical server error: ${(error as Error).message}`, 500)
  }
})

console.log('[ai-proxy] Edge function ready and listening for requests')
