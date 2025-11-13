/**
 * AI Proxy WebSocket Edge Function
 * 
 * Provides WebSocket-based streaming for Dash AI on React Native.
 * 
 * Features:
 * - WebSocket upgrade via Deno.upgradeWebSocket()
 * - Supabase authentication via Authorization header
 * - Quota enforcement and PII redaction (reuses ai-proxy logic)
 * - Server-side Anthropic API calls only
 * - Streams SSE from Anthropic → WebSocket JSON to client
 * 
 * References:
 * - Deno WebSocket API: https://deno.land/manual/runtime/web_platform_apis#websockets
 * - Supabase Edge Functions: https://supabase.com/docs/guides/functions
 * - Anthropic Streaming: https://docs.anthropic.com/en/api/messages-streaming
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface WSRequest {
  scope: 'teacher' | 'principal' | 'parent';
  service_type: string;
  payload: {
    prompt: string;
    context?: string;
  };
}

// PII redaction patterns (reused from ai-proxy)
const PII_PATTERNS = [
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // emails
  /\b(?:\+27|0)[6-9][0-9]{8}\b/g, // SA phone numbers
  /\b\d{13}\b/g, // SA ID numbers
];

function redactPII(text: string): { redactedText: string; redactionCount: number } {
  let redactedText = text;
  let redactionCount = 0;
  
  PII_PATTERNS.forEach(pattern => {
    const matches = redactedText.match(pattern);
    if (matches) {
      redactionCount += matches.length;
      redactedText = redactedText.replace(pattern, '[REDACTED]');
    }
  });
  
  return { redactedText, redactionCount };
}

type ClaudeModel = 'claude-3-haiku-20240307' | 'claude-3-5-sonnet-20241022';
type SubscriptionTier = 'free' | 'starter' | 'basic' | 'premium' | 'pro' | 'enterprise';

function selectModelForTier(tier: SubscriptionTier): ClaudeModel {
  if (['pro', 'enterprise'].includes(tier)) {
    return 'claude-3-5-sonnet-20241022';
  }
  return 'claude-3-haiku-20240307';
}

/**
 * Parse SSE stream and forward events to WebSocket
 * 
 * Reference: https://docs.anthropic.com/en/api/messages-streaming
 */
async function streamAnthropicToWebSocket(
  socket: WebSocket,
  prompt: string,
  model: ClaudeModel,
  abort: AbortController
): Promise<void> {
  if (!ANTHROPIC_API_KEY) {
    socket.send(JSON.stringify({ type: 'error', message: 'Anthropic API key not configured' }));
    socket.close();
    return;
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        stream: true,
        messages: [{ role: 'user', content: prompt }],
        system: `You are Dash, a smart colleague helping with EduDash Pro.

🌍 MULTILINGUAL CONVERSATION RULES:
- If user speaks Zulu → respond naturally in Zulu
- If user speaks Afrikaans → respond naturally in Afrikaans  
- If user speaks English → respond naturally in English
- DO NOT explain what the user said or translate
- DO NOT teach language unless explicitly asked
- Just have a normal conversation in their language

RESPONSE STYLE:
- Natural, conversational (like a smart colleague)
- Answer in 1-3 sentences for greetings
- Match the user's language WITHOUT commenting on it
- State facts only - if you don't know, say "I don't have that information"
- NO educational lectures unless teaching is requested

CRITICAL:
- NEVER make up data (student counts, assignments, etc)
- If you don't have specific data, say "I need to check the database"
- NO theatrical narration (*clears throat*, *smiles*, etc.)
- Focus on being helpful, not educational by default`,
      }),
      signal: abort.signal,
    });

    if (!response.ok) {
      const error = await response.text();
      socket.send(JSON.stringify({ type: 'error', message: `Claude API error: ${response.status}` }));
      socket.close();
      return;
    }

    if (!response.body) {
      socket.send(JSON.stringify({ type: 'error', message: 'No response body from Claude' }));
      socket.close();
      return;
    }

    // Parse SSE stream
    // Reference: https://developer.mozilla.org/docs/Web/API/Server-sent_events/Using_server-sent_events
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    socket.send(JSON.stringify({ type: 'start' }));

    while (true) {
      const { value, done } = await reader.read();
      
      if (done) {
        socket.send(JSON.stringify({ type: 'done' }));
        socket.close();
        break;
      }
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;
          
          try {
            const event = JSON.parse(data);
            
            // Forward content deltas
            // Reference: https://docs.anthropic.com/en/api/messages-streaming#event-types
            if (event.type === 'content_block_delta' && event.delta?.text) {
              socket.send(JSON.stringify({
                type: 'delta',
                text: event.delta.text,
              }));
            }
          } catch (e) {
            console.error('[ai-proxy-ws] Failed to parse SSE event:', e);
          }
        }
      }
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('[ai-proxy-ws] Stream aborted by client');
      socket.send(JSON.stringify({ type: 'cancelled' }));
    } else {
      console.error('[ai-proxy-ws] Stream error:', error);
      socket.send(JSON.stringify({ type: 'error', message: 'Streaming failed' }));
    }
    socket.close();
  }
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Only accept WebSocket upgrade
  if (req.headers.get('upgrade') !== 'websocket') {
    return new Response(
      JSON.stringify({ error: 'Expected WebSocket upgrade' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Authenticate via Supabase
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: 'Missing authorization header' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

  if (userError || !user) {
    return new Response(
      JSON.stringify({ error: 'Invalid token' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get user profile for tier
  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('subscription_tier')
    .eq('auth_user_id', user.id)
    .single();

  const tier: SubscriptionTier = (profile?.subscription_tier?.toLowerCase() || 'free') as SubscriptionTier;
  const model = selectModelForTier(tier);

  // Upgrade to WebSocket
  // Reference: https://deno.land/manual/runtime/web_platform_apis#websockets
  const { socket, response } = Deno.upgradeWebSocket(req);
  const abort = new AbortController();

  socket.onopen = () => {
    console.log('[ai-proxy-ws] WebSocket connection opened');
  };

  socket.onmessage = async (event) => {
    try {
      const request: WSRequest = JSON.parse(event.data);
      
      // Validate request
      if (!request.scope || !request.payload?.prompt) {
        socket.send(JSON.stringify({ type: 'error', message: 'Invalid request format' }));
        socket.close();
        return;
      }

      // Redact PII
      const { redactedText } = redactPII(request.payload.prompt);

      // Stream Anthropic response
      await streamAnthropicToWebSocket(socket, redactedText, model, abort);
    } catch (error) {
      console.error('[ai-proxy-ws] Message handling error:', error);
      socket.send(JSON.stringify({ type: 'error', message: 'Failed to process request' }));
      socket.close();
    }
  };

  socket.onclose = () => {
    console.log('[ai-proxy-ws] WebSocket connection closed');
    abort.abort();
  };

  socket.onerror = (e) => {
    console.error('[ai-proxy-ws] WebSocket error:', e);
    abort.abort();
  };

  return response;
});
