/**
 * [TESTING MODE - 2025-01-16]
 * OpenAI Whisper-1 temporarily disabled to validate Deepgram Nova-2 performance.
 * Current routing:
 * - All languages → Deepgram Nova-2 only (no Whisper fallback)
 * 
 * TODO: Re-enable Whisper as fallback after Deepgram validation complete
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

// Environment variables
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
const DEEPGRAM_API_KEY = Deno.env.get('DEEPGRAM_API_KEY')
const OPENAI_MODEL = Deno.env.get('OPENAI_TRANSCRIPTION_MODEL') || 'whisper-1'

// Rate limiting - max chunks per session
const MAX_CHUNKS_PER_SESSION = 120 // Increased for 500ms chunks
const MAX_CHUNK_SIZE_MB = 1 // Reduced for smaller chunks

// Request timeout for faster fail
const TRANSCRIPTION_TIMEOUT_MS = 3000 // 3 second timeout

// Session tracking for rate limiting (in-memory, resets on function restart)
const sessionChunkCounts = new Map<string, number>()

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

/**
 * Validate JWT and extract user context
 */
async function validateAuth(authHeader: string | null): Promise<{ userId: string; preschoolId?: string } | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  try {
    const token = authHeader.replace('Bearer ', '')
    const { data, error } = await supabase.auth.getUser(token)
    
    if (error || !data.user) {
      console.error('Auth validation failed:', error)
      return null
    }

    // Get user's preschool context from user metadata or query
    const preschoolId = data.user.user_metadata?.preschool_id || 
                       data.user.app_metadata?.preschool_id

    return {
      userId: data.user.id,
      preschoolId
    }
  } catch (error) {
    console.error('Auth error:', error)
    return null
  }
}

/**
 * Transcribe audio chunk using OpenAI Whisper
 */
async function transcribeWithWhisper(audioFile: File, language: string = 'en'): Promise<{ transcript: string; error?: string }> {
  if (!OPENAI_API_KEY) {
    return { transcript: '', error: 'OpenAI API key not configured' }
  }

  try {
    const formData = new FormData()
    formData.append('file', audioFile)
    formData.append('model', OPENAI_MODEL)
    formData.append('language', language)
    formData.append('response_format', 'json')

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Whisper API error:', response.status, errorText)
      throw new Error(`Whisper API error: ${response.status}`)
    }

    const result = await response.json()
    return { transcript: result.text || '' }
  } catch (error: any) {
    console.error('Whisper transcription failed:', error)
    return { transcript: '', error: error.message }
  }
}

/**
 * Transcribe audio chunk using Deepgram Nova-2 (optimized for speed)
 */
async function transcribeWithDeepgram(audioFile: File, language: string = 'en'): Promise<{ transcript: string; error?: string }> {
  if (!DEEPGRAM_API_KEY) {
    return { transcript: '', error: 'Deepgram API key not configured' }
  }

  try {
    const buffer = await audioFile.arrayBuffer()
    
    // Use Nova-2 model with optimizations for speed
    const params = new URLSearchParams({
      model: 'nova-2',
      language: language,
      punctuate: 'true',
      smart_format: 'true',
      tier: 'enhanced', // Faster processing
    })
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TRANSCRIPTION_TIMEOUT_MS)
    
    const response = await fetch(`https://api.deepgram.com/v1/listen?${params}`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${DEEPGRAM_API_KEY}`,
        'Content-Type': audioFile.type || 'audio/webm',
      },
      body: buffer,
      signal: controller.signal,
    })
    
    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Deepgram API error:', response.status, errorText)
      throw new Error(`Deepgram API error: ${response.status}`)
    }

    const result = await response.json()
    const transcript = result.results?.channels?.[0]?.alternatives?.[0]?.transcript || ''
    return { transcript }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error('Deepgram transcription timeout')
      return { transcript: '', error: 'Transcription timeout' }
    }
    console.error('Deepgram transcription failed:', error)
    return { transcript: '', error: error.message }
  }
}

/**
 * Check transcription quota for user
 */
async function checkTranscriptionQuota(userId: string, preschoolId?: string): Promise<{ allowed: boolean; reason?: string; remaining?: number }> {
  try {
    const { data, error } = await supabase.functions.invoke('ai-usage', {
      body: { action: 'check_quota', feature: 'transcription', userId, preschoolId }
    })
    
    if (error) {
      console.warn('Quota check failed, allowing by default:', error)
      return { allowed: true }
    }
    
    return data || { allowed: true }
  } catch (error) {
    console.warn('Quota check error, allowing by default:', error)
    return { allowed: true }
  }
}

/**
 * Log usage to ai_usage_logs table
 */
async function logUsage(
  userId: string,
  preschoolId: string | undefined,
  chunkIndex: number,
  provider: string,
  latencyMs: number,
  success: boolean
) {
  try {
    await supabase.from('ai_usage_logs').insert({
      preschool_id: preschoolId,
      user_id: userId,
      feature: 'transcription',
      tier: 'chunk',
      provider,
      metadata: {
        chunk_index: chunkIndex,
        latency_ms: latencyMs,
        success,
        session_id: `transcription_${Date.now()}`,
      },
      created_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Failed to log usage:', error)
    // Don't fail the request if logging fails
  }
}

/**
 * Main request handler
 */
serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const startTime = Date.now()
  let userId: string | undefined
  let preschoolId: string | undefined
  let provider = 'whisper'

  try {
    // Validate authentication
    const authHeader = req.headers.get('Authorization')
    const authContext = await validateAuth(authHeader)
    
    if (!authContext) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    userId = authContext.userId
    preschoolId = authContext.preschoolId

    // Check transcription quota before processing
    const quotaCheck = await checkTranscriptionQuota(userId, preschoolId)
    if (!quotaCheck.allowed) {
      return new Response(JSON.stringify({ 
        error: 'Transcription quota exceeded',
        reason: quotaCheck.reason,
        remaining: quotaCheck.remaining || 0
      }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Parse multipart form data
    const formData = await req.formData()
    const audioFile = formData.get('audio') as File
    const sessionId = formData.get('session_id') as string
    const chunkIndexStr = formData.get('chunk_index') as string
    const language = (formData.get('language') as string) || 'en'
    
    if (!audioFile || !sessionId || !chunkIndexStr) {
      return new Response(JSON.stringify({ error: 'Missing required fields: audio, session_id, chunk_index' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const chunkIndex = parseInt(chunkIndexStr)
    if (isNaN(chunkIndex) || chunkIndex < 0) {
      return new Response(JSON.stringify({ error: 'Invalid chunk_index' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Check file size (2MB limit)
    if (audioFile.size > MAX_CHUNK_SIZE_MB * 1024 * 1024) {
      return new Response(JSON.stringify({ 
        error: 'Chunk too large',
        max_size_mb: MAX_CHUNK_SIZE_MB
      }), {
        status: 413,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Rate limiting per session
    const currentCount = sessionChunkCounts.get(sessionId) || 0
    if (currentCount >= MAX_CHUNKS_PER_SESSION) {
      return new Response(JSON.stringify({ 
        error: 'Too many chunks',
        max_chunks: MAX_CHUNKS_PER_SESSION
      }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    sessionChunkCounts.set(sessionId, currentCount + 1)

    // [TEST MODE] Whisper-1 disabled - using Deepgram Nova-2 only
    console.log('[TEST MODE] Whisper-1 disabled - using Deepgram Nova-2 only')
    
    let result: { transcript: string; error?: string }
    let usedFallback = false

    if (DEEPGRAM_API_KEY) {
      // Use Deepgram as primary (much faster)
      result = await transcribeWithDeepgram(audioFile, language)
      provider = 'deepgram'
      
      // [DISABLED FOR TESTING] Whisper fallback commented out
      // if (result.error && OPENAI_API_KEY) {
      //   console.log(`Chunk ${chunkIndex}: Deepgram failed, trying Whisper fallback`)
      //   result = await transcribeWithWhisper(audioFile, language)
      //   provider = 'whisper'
      //   usedFallback = true
      // }
      
      // If Deepgram fails, return explicit error (no fallback during testing)
      if (result.error) {
        console.error(`[TEST MODE] Deepgram failed for chunk ${chunkIndex}, no fallback available`)
      }
    } else {
      return new Response(JSON.stringify({ 
        error: 'Deepgram API key not configured',
        details: 'Whisper-1 is currently disabled for testing'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const latency = Date.now() - startTime

    // Log usage
    if (userId) {
      await logUsage(userId, preschoolId, chunkIndex, provider, latency, !result.error)
    }

    // Return error if both providers failed
    if (result.error) {
      return new Response(JSON.stringify({ 
        error: 'Transcription failed',
        details: result.error,
        chunk_index: chunkIndex
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Success response
    return new Response(JSON.stringify({
      transcript: result.transcript,
      chunk_index: chunkIndex,
      session_id: sessionId,
      language,
      latency_ms: latency,
      provider,
      used_fallback: usedFallback
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('Chunk transcription error:', error)
    
    const latency = Date.now() - startTime
    if (userId) {
      await logUsage(userId, preschoolId, -1, provider, latency, false)
    }

    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
