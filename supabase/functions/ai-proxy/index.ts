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
import { callOpenAI } from './ai-client/openai-client.ts'

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
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Log startup configuration (once)
console.log('[ai-proxy] Edge function starting up...')
console.log('[ai-proxy] Configuration check:', {
  hasAnthropicKey: !!ANTHROPIC_API_KEY,
  hasOpenAIKey: !!OPENAI_API_KEY,
  hasSupabaseUrl: !!SUPABASE_URL,
  hasServiceRoleKey: !!SUPABASE_SERVICE_ROLE_KEY,
  anthropicKeyLength: ANTHROPIC_API_KEY?.length || 0,
  openaiKeyLength: OPENAI_API_KEY?.length || 0
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
    if (!ANTHROPIC_API_KEY && !OPENAI_API_KEY) {
      console.error(`[ai-proxy:${requestId}] CRITICAL: No AI providers configured (missing ANTHROPIC_API_KEY and OPENAI_API_KEY)`)
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

    // Get AI configuration (using hardcoded fallback for now)
    const hasImages = !!(payload.images && payload.images.length > 0)
    console.log(`[ai-proxy:${requestId}] Model selection:`, { service_type, tier, hasImages })
    
    let configuredProvider: string
    let model: string
    
    // Temporarily use hardcoded logic (database config disabled due to permissions)
    model = selectModelForTier(tier, hasImages)
    configuredProvider = prefer_openai ? 'openai' : 'claude'
    
    console.log(`[ai-proxy:${requestId}] Final provider/model:`, { provider: configuredProvider, model, hasImages })

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
      // Determine which AI provider to use (prefer_openai overrides config)
      const useOpenAI = prefer_openai 
        ? (prefer_openai && OPENAI_API_KEY)
        : (configuredProvider === 'openai' && OPENAI_API_KEY);
      
      if (useOpenAI) {
        console.log(`[ai-proxy:${requestId}] Using OpenAI as primary provider (prefer_openai=true)`);

        // Map Claude model to OpenAI model (use gpt-4o for tool-calling reliability, gpt-4o-mini for chat)
        // Use gpt-4o when tools are explicitly requested for better tool-calling reliability
        const needsReliableToolCalling = tool_choice && tool_choice.type === 'tool';
        const openaiModel = needsReliableToolCalling ? 'gpt-4o' : (hasImages ? 'gpt-4o-mini' : 'gpt-4o-mini');

        console.log(`[ai-proxy:${requestId}] OpenAI model selection:`, {
          model: openaiModel,
          reason: needsReliableToolCalling ? 'forced tool call' : 'standard',
          hasImages,
          hasToolChoice: !!tool_choice
        });

        // For general chat, disable complex server tools to avoid schema incompatibilities with OpenAI
        const toolsForOpenAI = service_type === 'dash_conversation' ? undefined : tools;

        // Log tool availability
        if (toolsForOpenAI) {
          console.log(`[ai-proxy:${requestId}] Providing ${toolsForOpenAI.length} tools to OpenAI:`, toolsForOpenAI.map(t => t.name));
        } else {
          console.log(`[ai-proxy:${requestId}] No tools provided to OpenAI (service_type: ${service_type})`);
        }

        const result = await callOpenAI({
          apiKey: OPENAI_API_KEY,
          model: openaiModel as any,
          prompt: redactedText,
          images: payload.images,
          conversationHistory: payload.conversationHistory,
          tools: toolsForOpenAI,
          tool_choice
        });
        
        console.log(`[ai-proxy:${requestId}] OpenAI request succeeded`, {
          hasToolCalls: !!(result.tool_calls && result.tool_calls.length > 0),
          toolCallCount: result.tool_calls?.length || 0,
          hasContent: !!result.content,
          contentLength: result.content?.length || 0
        });

        // Check if tool was forced but not used
        if (tool_choice && tool_choice.type === 'tool' && (!result.tool_calls || result.tool_calls.length === 0)) {
          console.error(`[ai-proxy:${requestId}] CRITICAL: Tool '${tool_choice.name}' was forced but OpenAI did not call it`);
          console.error(`[ai-proxy:${requestId}] OpenAI response:`, {
            content: result.content?.substring(0, 500),
            model: result.model,
            tokensIn: result.tokensIn,
            tokensOut: result.tokensOut
          });

          // Return a clear error to the client
          return createErrorResponse(
            'tool_not_called',
            `AI did not use the required tool '${tool_choice.name}'. The AI may be experiencing issues with structured outputs. Please try again.`,
            500
          );
        }

        // Handle tool calls if present
        if (result.tool_calls && result.tool_calls.length > 0) {
          console.log(`[ai-proxy:${requestId}] OpenAI returned ${result.tool_calls.length} tool calls`);
          
          // Convert OpenAI tool_calls to Claude format for tool handler
          const tool_use = result.tool_calls.map((tc: any) => ({
            id: tc.id,
            name: tc.name,
            input: tc.arguments
          }));
          
          // Create aiResult compatible with handleToolExecution
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
          metadata: { ...metadata, scope, tier, has_images: hasImages, image_count: payload.images?.length || 0, redaction_count: redactionCount, provider: 'openai' }
        });
        
        // Return response
        return createSuccessResponse({
          content: result.content,
          usage: { tokens_in: result.tokensIn, tokens_out: result.tokensOut, cost: result.cost },
          provider: 'openai'
        });
      }
      
      // Use Claude (default)
      // Use request queue to prevent rate limiting from concurrent requests
      console.log(`[ai-proxy:${requestId}] Enqueuing request to AI service (Claude). Queue status before:`, aiRequestQueue.getStatus());
      
      const result = await aiRequestQueue.enqueue(() => callClaude({
        apiKey: ANTHROPIC_API_KEY!,
        model: model as any,
        prompt: redactedText,
        images: payload.images,
        conversationHistory: payload.conversationHistory, // Pass conversation history
        stream,
        tools,
        tool_choice,
        maxTokens: hasImages ? 1536 : 4096
      }));

      console.log(`[ai-proxy:${requestId}] Request completed. Queue status after:`, aiRequestQueue.getStatus());

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
      console.error('[ai-proxy] Claude API error:', aiError)
      console.error('[ai-proxy] Error details:', {
        message: (aiError as Error).message,
        stack: (aiError as Error).stack,
        model,
        hasTools: !!tools,
        toolCount: tools?.length || 0,
        promptLength: redactedText.length,
        hasImages
      })

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
        metadata: { ...metadata, scope, error: (aiError as Error).message, error_stack: (aiError as Error).stack, redaction_count: redactionCount }
      })

      // Handle rate limit errors - try OpenAI fallback if available
      if (isRateLimitError(aiError)) {
        const retryMs = getRetryAfter(aiError);
        const retrySeconds = Math.ceil(retryMs / 1000);
        console.warn(`[ai-proxy:${requestId}] Rate limit hit. Retry after ${retrySeconds}s`);
        console.warn(`[ai-proxy:${requestId}] Queue status:`, aiRequestQueue.getStatus());
        
        // Try OpenAI as fallback if configured
        if (OPENAI_API_KEY && !stream && !tools) {
          console.log(`[ai-proxy:${requestId}] Attempting OpenAI fallback...`);
          
          try {
            // Map Claude model to OpenAI model
            const openaiModel = model.includes('haiku') ? 'gpt-3.5-turbo' : 
                               hasImages ? 'gpt-4-turbo' : 'gpt-4';
            
            const fallbackResult = await callOpenAI({
              apiKey: OPENAI_API_KEY,
              model: openaiModel as any,
              prompt: redactedText,
              images: payload.images,
              conversationHistory: payload.conversationHistory
            });
            
            console.log(`[ai-proxy:${requestId}] OpenAI fallback succeeded`);
            
            // Log usage with fallback indicator
            await logUsage(supabase, {
              userId: user.id,
              organizationId,
              serviceType: service_type,
              model: `${fallbackResult.model} (fallback)`,
              status: 'success',
              tokensIn: fallbackResult.tokensIn,
              tokensOut: fallbackResult.tokensOut,
              cost: fallbackResult.cost,
              processingTimeMs: Date.now() - startTime,
              inputText: redactedText,
              outputText: fallbackResult.content,
              metadata: { 
                ...metadata, 
                scope, 
                tier, 
                has_images: hasImages, 
                image_count: payload.images?.length || 0, 
                redaction_count: redactionCount,
                fallback_provider: 'openai',
                original_error: 'anthropic_rate_limit'
              }
            });
            
            // Return fallback response
            return createSuccessResponse({
              content: fallbackResult.content,
              usage: { 
                tokens_in: fallbackResult.tokensIn, 
                tokens_out: fallbackResult.tokensOut, 
                cost: fallbackResult.cost 
              },
              fallback: true,
              fallback_provider: 'openai'
            });
            
          } catch (fallbackError) {
            console.error(`[ai-proxy:${requestId}] OpenAI fallback also failed:`, fallbackError);
            // Continue to return rate limit error below
          }
        } else {
          if (!OPENAI_API_KEY) {
            console.log(`[ai-proxy:${requestId}] No OpenAI fallback available (API key not configured)`);
          } else if (stream) {
            console.log(`[ai-proxy:${requestId}] OpenAI fallback not available for streaming requests`);
          }
        }

        // Special case: tools were requested. Try OpenAI fallback by generating a compatible JSON exam
        if (OPENAI_API_KEY && tools && !stream) {
          try {
            console.log(`[ai-proxy:${requestId}] Attempting OpenAI fallback for tool-calling request...`)

            // Choose OpenAI model (text-only generation)
            const openaiModel = hasImages ? 'gpt-4-turbo' : 'gpt-4'

            // Build strict JSON output instruction so client can parse it as tool_result
            const gradeHint = (metadata as any)?.grade || 'Grade'
            const subjectHint = (metadata as any)?.subject || 'General'
            const strictInstruction = [
              `You must output ONLY a single JSON object with this exact shape:`,
              '{',
              '  "title": string,',
              '  "grade": string,',
              '  "subject": string,',
              '  "instructions": string[],',
              '  "sections": [ {',
              '    "title": string,',
              '    "questions": [ {',
              '      "id": string,',
              '      "number": string | number,',
              '      "text": string,',
              '      "type": "multiple_choice" | "short_answer" | "essay" | "numeric",',
              '      "marks": number,',
              '      "options"?: string[],',
              '      "correctAnswer"?: string',
              '    } ]',
              '  } ],',
              '  "totalMarks": number,',
              '  "hasMemo": false',
              '}',
              '',
              `Constraints:`,
              `- Grade: ${gradeHint}`,
              `- Subject: ${subjectHint}`,
              `- The sum of all question marks MUST equal the specified totalMarks.`,
              `- Provide at least 20 questions for Grade 4 and above.`,
              `- No references to external images/diagrams.`,
              `- Return ONLY JSON (no Markdown, no prose).`
            ].join('\n')

            const promptForOpenAI = `${redactedText}\n\n${strictInstruction}`

            const fallbackResult = await callOpenAI({
              apiKey: OPENAI_API_KEY,
              model: openaiModel as any,
              prompt: promptForOpenAI,
              images: payload.images,
              conversationHistory: payload.conversationHistory
            })

            // Try to parse JSON
            let examObj: any = null
            try {
              examObj = JSON.parse(fallbackResult.content)
            } catch {
              const match = fallbackResult.content.match(/\{[\s\S]*\}$/)
              if (match) {
                try { examObj = JSON.parse(match[0]) } catch {}
              }
            }

            if (examObj && examObj.sections) {
              console.log(`[ai-proxy:${requestId}] OpenAI tool-fallback produced JSON exam; returning as tool_results`)

              // Log usage with fallback indicator
              await logUsage(supabase, {
                userId: user.id,
                organizationId,
                serviceType: service_type,
                model: `${fallbackResult.model} (fallback)`,
                status: 'success',
                tokensIn: fallbackResult.tokensIn,
                tokensOut: fallbackResult.tokensOut,
                cost: fallbackResult.cost,
                processingTimeMs: Date.now() - startTime,
                inputText: redactedText,
                outputText: '[tool_result: openai_fallback] ',
                metadata: { 
                  ...metadata, scope, tier, has_images: hasImages, image_count: payload.images?.length || 0,
                  redaction_count: redactionCount, fallback_provider: 'openai', original_error: 'anthropic_rate_limit',
                }
              })

              // Wrap as a synthetic tool_result so existing clients can parse it
              const toolResults = [
                {
                  type: 'tool_result',
                  tool_use_id: 'openai_fallback_generate_caps_exam',
                  content: JSON.stringify({ success: true, data: examObj })
                }
              ]

              return createSuccessResponse({
                content: '',
                tool_results: toolResults,
                usage: { tokens_in: fallbackResult.tokensIn, tokens_out: fallbackResult.tokensOut, cost: fallbackResult.cost },
                fallback: true,
                fallback_provider: 'openai'
              })
            }

            console.warn(`[ai-proxy:${requestId}] OpenAI tool-fallback returned non-JSON or invalid schema`)
          } catch (fallbackToolError) {
            console.error(`[ai-proxy:${requestId}] OpenAI tool-fallback failed:`, fallbackToolError)
            // fall through to return 429 below
          }
        }
        
        // Return rate limit error if fallback didn't work
        return new Response(JSON.stringify({
          success: false,
          error: { 
            code: 'rate_limit', 
            message: `Rate limit exceeded. Please retry in ${retrySeconds} seconds.`,
            retry_after: retrySeconds,
            queue_status: aiRequestQueue.getStatus() // Include queue info for debugging
          }
        }), {
          status: 429,
          headers: { 
            ...getCorsHeaders(), 
            'Content-Type': 'application/json', 
            'Retry-After': String(retrySeconds)
          }
        });
      }

      // Return more specific error
      const errorMessage = (aiError as Error).message
      if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
        return createErrorResponse('timeout', 'Request timed out. Please try again with a simpler request.', 504)
      }
      if (errorMessage.includes('API key')) {
        return createErrorResponse('configuration_error', 'AI service configuration error', 500)
      }

      return createErrorResponse('ai_service_error', `AI service error: ${errorMessage.substring(0, 100)}`, 503)
    }

  } catch (error) {
    console.error(`[ai-proxy:${requestId}] Unhandled error:`, error)
    console.error(`[ai-proxy:${requestId}] Error stack:`, (error as Error).stack)
    return createErrorResponse('internal_error', `Internal server error: ${(error as Error).message}`, 500)
  }
})

console.log('[ai-proxy] Edge function ready and listening for requests')
