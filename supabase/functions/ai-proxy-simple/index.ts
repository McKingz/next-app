/**
 * Simplified AI Proxy - No quota checks, minimal logging
 * Use this version while setting up the full system
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const ANTHROPIC_API_KEY = Deno.env.get('SERVER_ANTHROPIC_API_KEY') || Deno.env.get('ANTHROPIC_API_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('[ai-proxy-simple] Request received')

    // Check API key
    if (!ANTHROPIC_API_KEY) {
      console.error('[ai-proxy-simple] ANTHROPIC_API_KEY not set!')
      return new Response(
        JSON.stringify({
          error: 'SERVER_ANTHROPIC_API_KEY or ANTHROPIC_API_KEY not configured. Please set it in Supabase Edge Function environment variables.'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request
    const body = await req.json()
    console.log('[ai-proxy-simple] Request body:', JSON.stringify(body, null, 2))
    
    // Handle both simple and complex payload structures
    const payload = body?.payload || body
    const prompt = payload?.prompt || 'Hello'

    // Get current date for time-aware responses
    const currentDate = new Date().toLocaleDateString('en-ZA', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    const currentDateShort = new Date().toISOString().split('T')[0];  // YYYY-MM-DD

    console.log('[ai-proxy-simple] Calling Claude API with prompt:', prompt)

    // Call Claude API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-7-sonnet-20250219',
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: `You are a helpful South African educational AI assistant specializing in CAPS curriculum.

**CURRENT DATE**: ${currentDate} (${currentDateShort})

**2025 NSC EXAM SCHEDULE (Official DBE Dates)**:
- Grade 12 Computer Applications Tech P1 & P2: 28 October 2025
- Grade 12 English/Afrikaans Home Language P1: 31 October 2025
- Grade 12 English/Afrikaans Home Language P2: 6 November 2025
- Grade 12 Mathematics P1: 7 November 2025
- Grade 12 Physical Sciences P1: 10 November 2025
- Grade 12 Life Sciences P1: 11 November 2025
- Grade 12 Mathematics P2: 12 November 2025
- Grade 12 Physical Sciences P2: 17 November 2025
- Grade 12 Life Sciences P2: 18 November 2025

When asked about exam dates, ALWAYS use the official dates above and reference the current date.

Context: ${payload?.context || 'general_question'}
Language: ${payload?.metadata?.language || 'en-ZA'}

User question: ${prompt}

Provide a clear, helpful response appropriate for the educational context.`
        }]
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[ai-proxy-simple] Claude API error:', errorText)
      throw new Error(`Claude API error: ${response.status} ${errorText}`)
    }

    const data = await response.json()
    console.log('[ai-proxy-simple] Claude API success')

    // Extract text content
    const content = data.content?.[0]?.text || 'No response from AI'

    return new Response(
      JSON.stringify({
        content,
        usage: data.usage,
        model: data.model
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[ai-proxy-simple] Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    const errorDetails = String(error)
    
    return new Response(
      JSON.stringify({
        error: errorMessage,
        details: errorDetails
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
