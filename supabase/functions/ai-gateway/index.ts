// Supabase Edge Function: ai-gateway (Deno)
// Wires AI actions to Anthropic Claude with tier-based model access control.
// Configure environment variable ANTHROPIC_API_KEY in your Supabase project.
// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// AI Model tiers and access control
type AIModelId = 'claude-3-haiku' | 'claude-3-sonnet' | 'claude-3-opus'
type SubscriptionTier = 'free' | 'starter' | 'premium' | 'enterprise'

const TIER_HIERARCHY: Record<SubscriptionTier, number> = {
  'free': 1,
  'starter': 2, 
  'premium': 3,
  'enterprise': 4,
}

const MODEL_TIER_REQUIREMENTS: Record<AIModelId, SubscriptionTier> = {
  'claude-3-haiku': 'free',
  'claude-3-sonnet': 'starter', 
  'claude-3-opus': 'premium',
}

const TIER_QUOTAS: Record<SubscriptionTier, { ai_requests: number; rpm_limit: number }> = {
  'free': { ai_requests: 50, rpm_limit: 5 },
  'starter': { ai_requests: 500, rpm_limit: 15 },
  'premium': { ai_requests: 2500, rpm_limit: 30 },
  'enterprise': { ai_requests: -1, rpm_limit: 60 }, // -1 = unlimited
}

// Development mode bypass (set DEVELOPMENT_MODE=true in Edge Function secrets)
const isDevelopmentMode = (globalThis as any).Deno?.env?.get("DEVELOPMENT_MODE") === 'true';
if (isDevelopmentMode) {
  console.log('[AI Gateway] Development mode active - using relaxed rate limits');
  TIER_QUOTAS['free'] = { ai_requests: 10000, rpm_limit: 100 };
}

function canAccessModel(userTier: SubscriptionTier, modelId: string): boolean {
  const normalizedModel = normalizeModelId(modelId)
  if (!normalizedModel) return false
  const requiredTier = MODEL_TIER_REQUIREMENTS[normalizedModel]
  return TIER_HIERARCHY[userTier] >= TIER_HIERARCHY[requiredTier]
}

function normalizeModelId(modelId: string): AIModelId | null {
  // Handle various Claude model name formats
  if (!modelId) return null;
  const id = modelId.toLowerCase();
  if (id.includes('haiku')) return 'claude-3-haiku'
  if (id.includes('sonnet')) return 'claude-3-sonnet' 
  if (id.includes('opus')) return 'claude-3-opus'
  return null
}

// Map any "family" id to an official, versioned Anthropic model id
function toOfficialModelId(modelId: string): string {
  // If already a versioned model ID, return as-is
  if (modelId.includes('20')) return modelId;
  
  const norm = normalizeModelId(modelId) || 'claude-3-sonnet';
  switch (norm) {
    case 'claude-3-haiku':
      return 'claude-3-haiku-20240307';
    case 'claude-3-opus':
      return 'claude-3-opus-20240229';
    case 'claude-3-sonnet':
    default:
      return 'claude-3-5-sonnet-20241022';
  }
}

function getDefaultModelForTier(tier: SubscriptionTier): string {
  switch (tier) {
    case 'enterprise':
    case 'premium': return 'claude-3-5-sonnet-20241022'
    case 'starter': return 'claude-3-5-sonnet-20241022' 
    case 'free':
    default: return 'claude-3-haiku-20240307'
  }
}

function normalizeTier(legacyTier: string): SubscriptionTier {
  const tier = legacyTier.toLowerCase()
  switch (tier) {
    case 'parent_starter':
    case 'starter': return 'starter'
    case 'parent_plus':
    case 'premium':
    case 'pro': return 'premium'
    case 'enterprise': return 'enterprise'
    default: return 'free'
  }
}

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
} as const;

function json(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), { ...init, headers: { ...JSON_HEADERS, ...(init.headers || {}) } });
}

function sseHeaders(extra: HeadersInit = {}) {
  return {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "Access-Control-Allow-Origin": "*",
    ...extra,
  } as HeadersInit;
}

function encodeSSE(data: any) {
  return `data: ${typeof data === "string" ? data : JSON.stringify(data)}\n\n`;
}

async function callClaudeMessages(apiKey: string, payload: Record<string, any>, stream = false) {
  const url = "https://api.anthropic.com/v1/messages";
  const body = { ...payload, stream };
  
  // Add tool support if tools are provided
  if (payload.tools && Array.isArray(payload.tools) && payload.tools.length > 0) {
    body.tools = payload.tools;
    body.tool_choice = payload.tool_choice || { type: "auto" };
  }
  
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });
  return res;
}

function smartStyle(): string {
  return (
    "You are a smart, professional colleague.\n" +
    "- Mirror the language of the user's last message.\n" +
    "- Keep answers concise (1–3 sentences) unless more detail is explicitly requested.\n" +
    "- Be non‑theatrical: no stage directions, no roleplay, no emojis, no filler like ‘let me’.\n" +
    "- State actionable facts directly and avoid unnecessary preamble."
  );
}

function toSystemPrompt(kind: "lesson_generation" | "homework_help" | "grading_assistance" | "general_assistance"): string {
  if (kind === "lesson_generation") {
    return (
      "You are an expert educational curriculum planner. Create structured, age-appropriate lessons with objectives, activities, and assessment." +
      "\n\n" + smartStyle()
    );
  }
  if (kind === "homework_help") {
    return (
      "You are a child-safe educational assistant. Provide step-by-step explanations and encourage understanding; do not give only final answers." +
      "\n\n" + smartStyle()
    );
  }
  if (kind === "general_assistance") {
    return (
      "You are Dash, an AI Teaching Assistant specialized in early childhood education and preschool management. Provide concise, practical, and actionable advice for educators. Focus on specific solutions rather than generic educational advice." +
      "\n\n" + smartStyle()
    );
  }
  return (
    "You are an AI grading assistant. Provide constructive feedback and a concise score when appropriate." +
    "\n\n" + smartStyle()
  );
}

function buildMessagesFromInputs(kind: string, body: any) {
  if (kind === "lesson_generation") {
    const topic = body.topic || "General Topic";
    const subject = body.subject || "General Studies";
    const gradeLevel = body.gradeLevel || 3;
    const duration = body.duration || 45;
    const objectives = Array.isArray(body.objectives) ? body.objectives : (Array.isArray(body.learningObjectives) ? body.learningObjectives : []);
    const userContent = `Generate a ${duration} minute lesson for Grade ${gradeLevel} on ${topic} (${subject}). Include:
- Clear learning objectives (${objectives.join(", ") || "derive reasonable objectives"})
- Warm-up, core activities, and closure
- Assessment ideas
Use plain language and bullet points where helpful.`;
    return [{ role: "user", content: userContent }];
  }
  if (kind === "homework_help") {
    const q = body.question || "Explain this concept.";
    const ctx = body.context ? `Context: ${body.context}\n` : "";
    const gradeLevel = body.gradeLevel || body.grade || null;
    const gradeContext = gradeLevel ? `This is for a Grade ${gradeLevel} student. ` : "";
    const userContent = `${ctx}${gradeContext}Provide a step-by-step explanation for: ${q}. Use age-appropriate language and examples. Avoid giving only the final answer; emphasize understanding and learning.`;
    return [{ role: "user", content: userContent }];
  }
  if (kind === "general_assistance") {
    // Handle messages array format from DashAIAssistant
    if (Array.isArray(body.messages)) {
      return body.messages.filter((msg: any) => msg.role !== 'system');
    }
    // Fallback for simple text input
    const userContent = body.content || body.question || "How can I help you with your educational needs?";
    return [{ role: "user", content: userContent }];
  }
  // grading_assistance
  const rubric = Array.isArray(body.rubric) ? body.rubric.join(", ") : "accuracy, completeness, clarity";
  const gradeLevel = body.gradeLevel ? String(body.gradeLevel) : "N/A";
  const userContent = `Student submission (Grade ${gradeLevel}):\n${body.submission || ""}\n\nEvaluate against rubric: ${rubric}. Provide brief constructive feedback and a score (0-100).`;
  return [{ role: "user", content: userContent }];
}

function extractTextFromClaudeMessage(message: any): string {
  if (!message) return "";
  const blocks = Array.isArray(message.content) ? message.content : [];
  const parts = blocks
    .filter((b: any) => b && b.type === "text")
    .map((b: any) => String(b.text || ""));
  return parts.join("\n");
}

serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "*";

  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      },
    });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const action = String(body.action || "");
  const apiKey = (globalThis as any).Deno?.env?.get("ANTHROPIC_API_KEY") || "";
  const modelDefault = (globalThis as any).Deno?.env?.get("ANTHROPIC_MODEL_DEFAULT") || "claude-3-5-sonnet-20241022";

  // Create Supabase client with caller's JWT for RLS-aware operations
  const SUPABASE_URL = (globalThis as any).Deno?.env?.get("SUPABASE_URL") || '';
  const SUPABASE_ANON_KEY = (globalThis as any).Deno?.env?.get("SUPABASE_ANON_KEY") || '';
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
  });

  // Resolve auth context
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;
  if (!user) {
    return json({ error: 'unauthorized' }, { status: 401 });
  }

  // Authenticated health check (moved after auth)
  if (action === 'health') {
    return json({ status: 'ok', timestamp: new Date().toISOString(), hasApiKey: Boolean(apiKey), userId: user.id });
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, organization_id, preschool_id')
    .eq('id', user.id)
    .maybeSingle();
  const orgId = (profile && (profile.organization_id || profile.preschool_id)) || body.organization_id || null;

  async function getUserTier(organizationId: string | null): Promise<SubscriptionTier> {
    if (!organizationId) return 'free';
    
    // Check new subscriptions table first
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select(`status, subscription_plans!inner(tier)`)
      .eq('school_id', organizationId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    
    if (subscription?.subscription_plans?.[0]?.tier) {
      return normalizeTier(subscription.subscription_plans[0].tier)
    }
    
    // Fallback to legacy fields
    const { data: org } = await supabase.from('organizations').select('plan_tier').eq('id', organizationId).maybeSingle();
    if (org && (org as any).plan_tier) {
      return normalizeTier(String((org as any).plan_tier))
    }
    
    const { data: school } = await supabase.from('preschools').select('subscription_tier').eq('id', organizationId).maybeSingle();
    if (school && (school as any).subscription_tier) {
      return normalizeTier(String((school as any).subscription_tier))
    }
    
    return 'free';
  }

  async function enforceQuotaAndModelAccess(
    organizationId: string | null, 
    feature: string, 
    requestedModel: string
  ): Promise<{ allowed: boolean; used?: number; limit?: number; reason?: string; tier?: SubscriptionTier }> {
    try {
      const userTier = await getUserTier(organizationId);
      
      // Check if user's tier allows access to requested model
      if (!canAccessModel(userTier, requestedModel)) {
        return { 
          allowed: false, 
          reason: 'model_tier_restriction', 
          tier: userTier 
        };
      }
      
      if (!organizationId) {
        // Individual users get basic limits based on their tier
        return { allowed: true, tier: userTier };
      }
      
      const quotas = TIER_QUOTAS[userTier];
      
      // Enterprise tier has unlimited requests
      if (quotas.ai_requests === -1) {
        return { allowed: true, tier: userTier };
      }
      
      // Check monthly usage
      const monthStart = new Date();
      monthStart.setUTCDate(1); 
      monthStart.setUTCHours(0,0,0,0);
      
      const { count } = await supabase
        .from('ai_usage_logs')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('service_type', feature)
        .gte('created_at', monthStart.toISOString());
      
      const used = Number(count || 0);
      const limit = quotas.ai_requests;
      
      return { 
        allowed: used < limit, 
        used, 
        limit, 
        tier: userTier,
        reason: used >= limit ? 'quota_exceeded' : undefined
      };
    } catch (error) {
      console.error('Error in quota/model enforcement:', error);
      return { allowed: true };
    }
  }

  async function ensureServiceId(model: string): Promise<string | null> {
    // Map model names to the UUIDs we created in the migration
    const modelUuidMap: Record<string, string> = {
      'claude-3-haiku-20240307': 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      'claude-3-5-sonnet-20241022': 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
      'claude-3-opus-20240229': 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33'
    };
    
    const id = modelUuidMap[model];
    if (id) {
      return id; // Return known UUID for this model
    }
    
    // For unknown models, try to find existing service or create new one
    try {
      const { data: existingService } = await supabase
        .from('ai_services')
        .select('id')
        .eq('model_version', model)
        .eq('provider', 'anthropic')
        .single();
        
      if (existingService) {
        return existingService.id;
      }
      
      // Create new service with generated UUID
      const newId = crypto.randomUUID();
      await supabase.from('ai_services').insert({
        id: newId,
        name: `Claude (${model})`,
        provider: 'anthropic',
        model_version: model,
        input_cost_per_1k_tokens: 0.003, // Default pricing
        output_cost_per_1k_tokens: 0.015,
        is_active: true,
        is_available: true
      } as any);
      return newId;
    } catch (error) {
      console.error('Error ensuring service ID:', error);
      return modelUuidMap['claude-3-5-sonnet-20241022']; // Fallback to Sonnet UUID
    }
  }

  async function logUsage(params: { serviceType: string; model: string; system?: string; input?: string; output?: string; inputTokens?: number | null; outputTokens?: number | null; totalCost?: number | null; status: string }) {
    try {
      if (!orgId || !user) return;
      const serviceId = await ensureServiceId(params.model);
      await supabase.from('ai_usage_logs').insert({
        ai_service_id: serviceId,
        ai_model_used: params.model,
        system_prompt: params.system || null,
        input_text: params.input || null,
        output_text: params.output || null,
        input_tokens: params.inputTokens ?? null,
        output_tokens: params.outputTokens ?? null,
        total_cost: params.totalCost ?? null,
        organization_id: orgId,
        preschool_id: null,
        service_type: params.serviceType,
        status: params.status,
        user_id: user.id,
      } as any);
    } catch {
      // swallow logging errors
    }
  }

  const feature = action === 'grading_assistance_stream' ? 'grading_assistance' : action;
  
  // Determine model to use (with tier-appropriate fallback)
  const userTier = await getUserTier(orgId);
  const requestedModel = body.model || modelDefault;
  const modelFamily = canAccessModel(userTier, requestedModel) 
    ? requestedModel 
    : getDefaultModelForTier(userTier);
  // Always map to an official versioned model id before calling provider
  const modelToUse = toOfficialModelId(modelFamily);
  
  // Quota and model access enforcement
  const gate = await enforceQuotaAndModelAccess(orgId, feature, modelToUse);
  if (!gate.allowed) {
    if (gate.reason === 'model_tier_restriction') {
      return json({ 
        error: 'model_access_denied', 
        message: `Your ${gate.tier} plan doesn't include access to this AI model. Please upgrade for more advanced models.`,
        tier: gate.tier,
        available_model: getDefaultModelForTier(gate.tier!)
      }, { status: 403 });
    }
    return json({ 
      error: 'quota_exceeded', 
      used: gate.used, 
      limit: gate.limit,
      message: `Monthly AI request limit reached. Used ${gate.used}/${gate.limit} requests.`
    }, { status: 429 });
  }

  // STREAMING: grading_assistance_stream OR general_assistance with stream=true
  const shouldStream = (action === "grading_assistance_stream") || (action === "general_assistance" && body.stream === true);
  
  if (shouldStream) {
    if (!apiKey) {
      // Fall back to mock streaming if no key configured
      const stream = new ReadableStream({
        start(controller) {
          const chunks = [
            { type: "delta", text: "Analyzing submission..." },
            { type: "delta", text: "Comparing against rubric..." },
            { type: "delta", text: "Scoring and generating feedback..." },
          ];
          let i = 0;
          const push = () => {
            if (i < chunks.length) {
              controller.enqueue(new TextEncoder().encode(encodeSSE(chunks[i])));
              i++;
              setTimeout(push, 400);
            } else {
              const summary = { type: "final", score: 85, feedback: "Good attempt. Review counting sequence and verify missing numbers." };
              controller.enqueue(new TextEncoder().encode(encodeSSE(summary)));
              controller.enqueue(new TextEncoder().encode(encodeSSE("[DONE]")));
              controller.close();
            }
          };
          push();
        },
      });
      return new Response(stream, { headers: sseHeaders({ "Access-Control-Allow-Origin": origin }) });
    }

    // Determine action type for streaming (grading vs general assistance)
    const streamActionType = action === "grading_assistance_stream" ? "grading_assistance" : "general_assistance";
    const messages = buildMessagesFromInputs(streamActionType, body);
    const system = body.system || toSystemPrompt(streamActionType);
    const model = modelToUse; // Use tier-enforced model
    
    // Add tool support for general_assistance streaming if provided
    const claudeStreamParams: Record<string, any> = {
      model,
      system,
      max_tokens: body.maxTokens || body.max_tokens || (action === "grading_assistance_stream" ? 1000 : 1500),
      temperature: body.temperature || 0.4,
      messages,
    };
    
    if (body.tools && Array.isArray(body.tools) && body.tools.length > 0) {
      claudeStreamParams.tools = body.tools;
      claudeStreamParams.tool_choice = body.tool_choice || { type: "auto" };
    }

    const res = await callClaudeMessages(apiKey, claudeStreamParams, true);

    if (!res.ok || !res.body) {
      return json({ error: `Claude stream error: ${res.status}` }, { status: 500 });
    }

    const reader = (res.body as ReadableStream<Uint8Array>).getReader();
    const streamModel = toOfficialModelId(body.model || modelDefault);
    const streamSystem = toSystemPrompt('grading_assistance');
    const textDecoder = new TextDecoder("utf-8");

    let accumulated = "";
    const stream = new ReadableStream({
      async pull(controller) {
        const { value, done } = await reader.read();
        if (done) {
          // Emit a final summary event with accumulated text
          controller.enqueue(new TextEncoder().encode(encodeSSE({ type: "final", feedback: accumulated })));
          // Log usage with appropriate service type
          const logServiceType = action === "grading_assistance_stream" ? 'grading_assistance' : 'general_assistance';
          const logInput = action === "grading_assistance_stream" ? (body.submission || '') : JSON.stringify(body.messages || body.content || '');
          try { await logUsage({ serviceType: logServiceType, model: streamModel, system: streamSystem, input: logInput, output: accumulated, inputTokens: null, outputTokens: null, totalCost: null, status: 'success' }); } catch { /* Intentional: non-fatal */ }
          controller.enqueue(new TextEncoder().encode(encodeSSE("[DONE]")));
          controller.close();
          return;
        }
        const chunkText = textDecoder.decode(value);
        // Anthropic SSE format: lines with event:, data: {json}
        const lines = chunkText.split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const evt = JSON.parse(payload);
            // content_block_delta events contain text deltas
            if (evt.type === "content_block_delta" && evt.delta && evt.delta.type === "text_delta") {
              const t = String(evt.delta.text || "");
              accumulated += t;
              controller.enqueue(new TextEncoder().encode(encodeSSE({ type: "delta", text: t })));
            }
          } catch {
            // ignore malformed lines
          }
        }
      },
      cancel() {
        try { reader.cancel(); } catch { /* Intentional: non-fatal */ }
      },
    });

    return new Response(stream, { headers: sseHeaders({ "Access-Control-Allow-Origin": origin }) });
  }

  // Non-streaming handlers
  if (action === "lesson_generation" || action === "homework_help" || action === "grading_assistance" || action === "general_assistance" || action === "chat") {
    if (!apiKey) {
      // Fallback mock if no key
      let content = "";
      if (action === "lesson_generation") {
        content = `Generated lesson on ${body.topic || 'Topic'} for Grade ${body.gradeLevel || 'N'}. Include objectives and activities.`;
      } else if (action === "homework_help") {
        content = `Step-by-step explanation for: ${body.question || 'your question'}. Focus on understanding, not just final answer.`;
      } else if (action === "general_assistance" || action === "chat") {
        content = `I'm here to help with your educational needs. Whether it's lesson planning, student management, or administrative tasks, let me know what you'd like to work on.`;
      } else {
        content = `Automated feedback: solid effort. Suggested improvements around ${(body.rubric && body.rubric[0]) || 'criteria'}.`;
      }
      return json({ content, usage: { input_tokens: 200, output_tokens: 600 }, cost: 0 });
    }

    const kind = (action === "chat" ? "general_assistance" : action) as "lesson_generation" | "homework_help" | "grading_assistance" | "general_assistance";
    let messages = buildMessagesFromInputs(kind, body);

    // If client is returning tool results for a prior tool_use, construct proper messages
    if (Array.isArray(body.tool_results) && body.assistant_raw_content) {
      try {
        const base = Array.isArray(body.messages)
          ? (body.messages as any[]).filter((m) => m && m.role !== 'system')
          : messages;

        const assistantBlocks = Array.isArray(body.assistant_raw_content)
          ? body.assistant_raw_content
          : [{ type: 'text', text: String(body.assistant_raw_content || '') }];

        const toolResultBlocks = (body.tool_results as any[]).map((tr) => ({
          type: 'tool_result',
          tool_use_id: tr.tool_use_id,
          content: tr.content,
          is_error: Boolean(tr.is_error),
        }));

        messages = [
          ...base,
          { role: 'assistant', content: assistantBlocks },
          { role: 'user', content: toolResultBlocks },
        ];
      } catch {
        // fall back to original messages
      }
    }

    const system = body.system || toSystemPrompt(kind);
    const model = modelToUse; // Use tier-enforced model

    const claudeParams: Record<string, any> = {
      model,
      system,
      max_tokens: body.maxTokens || body.max_tokens || 1500,
      temperature: body.temperature || 0.6,
      messages,
    };
    
    // Add tool support if provided
    if (body.tools && Array.isArray(body.tools) && body.tools.length > 0) {
      claudeParams.tools = body.tools;
      claudeParams.tool_choice = body.tool_choice || { type: "auto" };
    }

    const res = await callClaudeMessages(apiKey, claudeParams, false);

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      try { await logUsage({ serviceType: feature, model, system, input: JSON.stringify(messages), output: errText, inputTokens: null, outputTokens: null, totalCost: null, status: 'provider_error' }); } catch { /* Intentional: non-fatal */ }
      // Graceful fallback: return a basic, safe message instead of 500
      console.error('[AI Gateway] Provider error - status:', res.status, 'action:', action);
      console.error('[AI Gateway] Anthropic error details:', errText);
      console.error('[AI Gateway] Request had tools:', body.tools ? body.tools.length : 0);
      const fallback = action === 'lesson_generation'
        ? `Generated lesson on ${body.topic || 'Topic'} for Grade ${body.gradeLevel || 'N'}. Include objectives and activities.`
        : action === 'homework_help'
          ? `Step-by-step explanation for: ${body.question || 'your question'}. Focus on understanding.`
          : action === 'general_assistance' || action === 'chat'
            ? `I'm here to help! I encountered a temporary issue connecting to my AI service. Please try your request again, or ask me something else I can help with.`
            : `I encountered an issue processing your request. Please try again or rephrase your question.`;
      return json({ content: fallback, usage: null, cost: null, provider_error: { status: res.status, details: errText } });
    }

    const data = await res.json();
    const content = extractTextFromClaudeMessage(data);
    
    // Extract tool calls from response if present
    const toolCalls = [];
    if (data.content && Array.isArray(data.content)) {
      for (const block of data.content) {
        if (block.type === 'tool_use') {
          toolCalls.push({
            id: block.id,
            name: block.name,
            input: block.input
          });
        }
      }
    }
    
    // If AI only returned tool calls with no text content, this is expected
    // The client (DashAIAssistant) will handle tool execution and get final response
    if (toolCalls.length > 0 && !content.trim()) {
      console.log('[AI Gateway] AI returned tool calls only, client will execute and get final response');
    }
    
    try {
      const usage = (data && (data.usage || null)) || null;
      await logUsage({ serviceType: feature, model, system, input: JSON.stringify(messages), output: content, inputTokens: usage?.input_tokens ?? null, outputTokens: usage?.output_tokens ?? null, totalCost: null, status: 'success' });
    } catch { /* Intentional: non-fatal */ }
    
    return json({ 
      content, 
      usage: data.usage || null, 
      cost: null,
      stop_reason: data.stop_reason,
      tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
      raw_content: data.content // Include full content array for debugging
    });
  }

  return json({ error: "Unknown action" }, { status: 400 });
});
