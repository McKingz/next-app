/**
 * DEPRECATION NOTICE:
 * This batch transcription Edge Function is now LEGACY and maintained only for fallback.
 * 
 * PREFERRED APPROACH: Use real-time streaming transcription via WebSocket/WebRTC.
 * - Faster user experience (transcription as you speak)
 * - Lower latency for AI responses
 * - Better language detection
 * 
 * This function remains as a graceful fallback when streaming is unavailable or fails.
 * See: hooks/useRealtimeVoice.ts and hooks/useVoiceController.ts for streaming implementation.
 */

/**
 * [TESTING MODE - 2025-01-16]
 * OpenAI Whisper-1 temporarily disabled to validate Deepgram Nova-2 performance.
 * Current routing:
 * - SA languages (zu, af, xh) → Azure Speech Service
 * - English → Deepgram Nova-2 only (no Whisper fallback)
 * 
 * TODO: Re-enable Whisper as fallback after Deepgram validation complete
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

// Environment variables
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const DEEPGRAM_API_KEY = Deno.env.get('DEEPGRAM_API_KEY')
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
const AZURE_SPEECH_KEY = Deno.env.get('AZURE_SPEECH_KEY')
const AZURE_SPEECH_REGION = Deno.env.get('AZURE_SPEECH_REGION')
const TRANSCRIPTION_PROVIDER = Deno.env.get('TRANSCRIPTION_PROVIDER') || 'auto' // 'azure', 'openai', 'deepgram', or 'auto'
const OPENAI_TRANSCRIPTION_MODEL = Deno.env.get('OPENAI_TRANSCRIPTION_MODEL') || 'whisper-1'

// Create Supabase client with service role for bypassing RLS
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

interface TranscriptionRequest {
  voice_note_id?: string
  storage_path?: string
  language?: string // 'en', 'af', 'zu', 'st'
  model?: string
  trigger_source?: 'manual' | 'storage_event' | 'database_trigger'
}

interface TranscriptionResponse {
  transcript: string
  language?: string
  confidence?: number
  word_count?: number
  duration?: number
}

/**
 * Get signed URL for audio file from Supabase Storage
 */
async function getAudioFileUrl(storagePath: string): Promise<string> {
  // Determine bucket based on path
  let bucket = 'voice-notes'
  if (storagePath.includes('homework-submissions')) {
    bucket = 'homework-submissions'
  } else if (storagePath.includes('message-media')) {
    bucket = 'message-media'
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(storagePath, 3600) // 1 hour expiry

  if (error) {
    throw new Error(`Failed to get signed URL: ${error.message}`)
  }

  return data.signedUrl
}

/**
 * Transcribe audio using Deepgram API
 */
async function transcribeWithDeepgram(audioUrl: string, language?: string): Promise<TranscriptionResponse> {
  if (!DEEPGRAM_API_KEY) {
    throw new Error('Deepgram API key not configured')
  }

  // Map language codes to Deepgram language models
  const languageMap: { [key: string]: string } = {
    'en': 'en-US',
    'af': 'en-US', // Fallback to English for Afrikaans
    'zu': 'en-US', // Fallback to English for isiZulu
    'st': 'en-US'  // Fallback to English for Sesotho
  }

  const deepgramLanguage = language ? (languageMap[language] || 'en-US') : 'en-US'

  console.log('Transcribing with Deepgram:', { audioUrl, language: deepgramLanguage })

  const response = await fetch('https://api.deepgram.com/v1/listen', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${DEEPGRAM_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: audioUrl,
      options: {
        model: 'nova-2',
        language: deepgramLanguage,
        smart_format: true,
        punctuate: true,
        paragraphs: false,
        utterances: false,
        diarize: false,
        detect_language: language ? false : true, // Auto-detect if no language specified
        keywords: ['homework', 'school', 'teacher', 'student', 'parent', 'class'],
        profanity_filter: true,
        redact: ['pci', 'numbers', 'ssn'],
      }
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('Deepgram API error:', error)
    throw new Error(`Deepgram API error: ${response.status} ${error}`)
  }

  const result = await response.json()
  console.log('Deepgram result:', result)

  const transcript = result.results?.channels?.[0]?.alternatives?.[0]?.transcript || ''
  const confidence = result.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0
  const detectedLanguage = result.results?.channels?.[0]?.detected_language
  const wordCount = result.results?.channels?.[0]?.alternatives?.[0]?.words?.length || 0

  return {
    transcript,
    language: detectedLanguage || language,
    confidence,
    word_count: wordCount
  }
}

/**
 * Transcribe audio using Azure Speech Services (Best for Afrikaans, isiZulu, isiXhosa)
 */
async function transcribeWithAzure(audioUrl: string, language?: string): Promise<TranscriptionResponse> {
  if (!AZURE_SPEECH_KEY || !AZURE_SPEECH_REGION) {
    throw new Error('Azure Speech API key or region not configured')
  }

  // Map language codes to Azure language codes
  const languageMap: { [key: string]: string } = {
    'en': 'en-ZA',  // English South Africa
    'af': 'af-ZA',  // Afrikaans South Africa
    'zu': 'zu-ZA',  // isiZulu South Africa
    'xh': 'xh-ZA',  // isiXhosa South Africa
    'st': 'en-ZA'   // Sesotho -> fallback to English SA
  }

  const azureLanguage = language ? (languageMap[language] || 'en-ZA') : 'en-ZA'

  console.log('Transcribing with Azure Speech:', { audioUrl, language: azureLanguage })

  // Download audio file first
  const audioResponse = await fetch(audioUrl)
  if (!audioResponse.ok) {
    throw new Error(`Failed to download audio file: ${audioResponse.status}`)
  }

  const audioBlob = await audioResponse.blob()
  const audioBuffer = await audioBlob.arrayBuffer()

  // Call Azure Speech-to-Text API
  const response = await fetch(
    `https://${AZURE_SPEECH_REGION}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${azureLanguage}`,
    {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': AZURE_SPEECH_KEY,
        'Content-Type': 'audio/wav', // Azure accepts various formats
      },
      body: audioBuffer,
    }
  )

  if (!response.ok) {
    const error = await response.text()
    console.error('Azure Speech API error:', error)
    throw new Error(`Azure Speech API error: ${response.status} ${error}`)
  }

  const result = await response.json()
  console.log('Azure Speech result:', result)

  // Azure returns: { RecognitionStatus, DisplayText, Offset, Duration, NBest: [{Confidence, Lexical, ITN, MaskedITN, Display}] }
  const transcript = result.DisplayText || ''
  const confidence = result.NBest?.[0]?.Confidence || 0
  const wordCount = transcript.split(/\s+/).filter(word => word.length > 0).length

  return {
    transcript,
    language: azureLanguage,
    confidence,
    word_count: wordCount
  }
}

/**
 * Transcribe audio using OpenAI Whisper API
 */
async function transcribeWithOpenAI(audioUrl: string, language?: string): Promise<TranscriptionResponse> {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured')
  }

  console.log('Transcribing with OpenAI Whisper:', { audioUrl, language })

  // Download audio file first
  const audioResponse = await fetch(audioUrl)
  if (!audioResponse.ok) {
    throw new Error(`Failed to download audio file: ${audioResponse.status}`)
  }

  const audioBlob = await audioResponse.blob()
  const formData = new FormData()
  
  // Create a file from blob
  formData.append('file', audioBlob, 'audio.m4a')
  formData.append('model', OPENAI_TRANSCRIPTION_MODEL)
  
  if (language) {
    // Map our language codes to OpenAI language codes
    const languageMap: { [key: string]: string } = {
      'en': 'en',
      'af': 'af', // Whisper supports Afrikaans
      'zu': 'zu', // Whisper has some support for Zulu
      'st': 'en'  // Fallback to English for Sesotho
    }
    formData.append('language', languageMap[language] || 'en')
  }

  formData.append('response_format', 'json')

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: formData,
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('OpenAI API error:', error)
    throw new Error(`OpenAI API error: ${response.status} ${error}`)
  }

  const result = await response.json()
  console.log('OpenAI result:', result)

  const transcript = result.text || ''
  const wordCount = transcript.split(/\s+/).filter(word => word.length > 0).length

  return {
    transcript,
    language: language || 'en', // OpenAI doesn't return detected language in basic response
    word_count: wordCount
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
 * Update voice note with transcription results
 */
async function updateVoiceNoteTranscription(voiceNoteId: string, transcription: TranscriptionResponse) {
  console.log('Updating voice note transcription:', { voiceNoteId, transcription })

  const { data, error } = await supabase
    .from('voice_notes')
    .update({
      transcript: transcription.transcript,
      language: transcription.language || 'en',
      // Store additional metadata in a JSONB field if available
      metadata: {
        confidence: transcription.confidence,
        word_count: transcription.word_count,
        transcribed_at: new Date().toISOString(),
        provider: TRANSCRIPTION_PROVIDER
      }
    })
    .eq('id', voiceNoteId)
    .select()
    .single()

  if (error) {
    console.error('Error updating voice note:', error)
    throw new Error(`Failed to update voice note: ${error.message}`)
  }

  console.log('Voice note updated successfully:', data.id)
  return data
}

/**
 * Create engagement event for transcription completion
 */
async function trackTranscriptionEvent(voiceNote: any, transcription: TranscriptionResponse) {
  if (!voiceNote.preschool_id || !voiceNote.created_by) {
    return
  }

  try {
    await supabase
      .from('parent_engagement_events')
      .insert({
        preschool_id: voiceNote.preschool_id,
        parent_id: voiceNote.created_by,
        student_id: voiceNote.created_for_student_id,
        event_type: 'voice_note_transcribed',
        metadata: {
          voice_note_id: voiceNote.id,
          transcript_length: transcription.transcript.length,
          word_count: transcription.word_count,
          language: transcription.language,
          provider: TRANSCRIPTION_PROVIDER
        }
      })

    // Also log usage for quota tracking
    await supabase.from('ai_usage_logs').insert({
      preschool_id: voiceNote.preschool_id,
      user_id: voiceNote.created_by,
      feature: 'transcription',
      tier: 'batch',
      provider: TRANSCRIPTION_PROVIDER,
      metadata: {
        voice_note_id: voiceNote.id,
        transcript_length: transcription.transcript.length,
        word_count: transcription.word_count,
        language: transcription.language,
        session_id: `batch_transcription_${Date.now()}`,
      },
      created_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error tracking transcription event:', error)
  }
}

/**
 * Main transcription handler
 */
async function transcribeAudio(request: Request): Promise<Response> {
  try {
    const transcriptionRequest: TranscriptionRequest = await request.json()
    console.log('Processing transcription request:', transcriptionRequest)

    let voiceNote: any
    let audioUrl: string

    // Check transcription quota before processing
    if (transcriptionRequest.voice_note_id) {
      // Get voice note to check user
      const { data: voiceNoteData } = await supabase
        .from('voice_notes')
        .select('created_by, preschool_id')
        .eq('id', transcriptionRequest.voice_note_id)
        .maybeSingle()
      
      if (voiceNoteData?.created_by) {
        const quotaCheck = await checkTranscriptionQuota(voiceNoteData.created_by, voiceNoteData.preschool_id)
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
      }
    }

    // Get voice note information
    if (transcriptionRequest.voice_note_id) {
      const { data, error } = await supabase
        .from('voice_notes')
        .select('*')
        .eq('id', transcriptionRequest.voice_note_id)
        .maybeSingle()

      if (error) {
        return new Response(JSON.stringify({ error: `Voice note query error: ${error.message}` }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      
      if (!data) {
        return new Response(JSON.stringify({ error: 'Voice note not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      voiceNote = data
      audioUrl = await getAudioFileUrl(voiceNote.storage_path)
      
    } else if (transcriptionRequest.storage_path) {
      audioUrl = await getAudioFileUrl(transcriptionRequest.storage_path)
      
      // Try to find the voice note by storage path
      const { data } = await supabase
        .from('voice_notes')
        .select('*')
        .eq('storage_path', transcriptionRequest.storage_path)
        .maybeSingle()
      
      voiceNote = data // May be null if this is just a file transcription
      
    } else {
      return new Response(JSON.stringify({ error: 'voice_note_id or storage_path is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Determine language for transcription
    const language = transcriptionRequest.language || voiceNote?.language

    // [TEST MODE] Whisper-1 disabled - Azure for SA languages, Deepgram for English only
    console.log('[TEST MODE] Whisper-1 disabled - Azure for SA languages, Deepgram for English only')
    
    // Perform transcription based on language and provider availability
    let transcription: TranscriptionResponse
    let providerUsed = TRANSCRIPTION_PROVIDER
    let usedFallback = false

    try {
      // SMART ROUTING: Use Azure for SA languages (af, zu, xh) as they have best support
      const saLanguages = ['af', 'zu', 'xh']
      const useAzure = (TRANSCRIPTION_PROVIDER === 'auto' || TRANSCRIPTION_PROVIDER === 'azure' || TRANSCRIPTION_PROVIDER === 'deepgram') && 
                       saLanguages.includes(language || '') && 
                       AZURE_SPEECH_KEY && 
                       AZURE_SPEECH_REGION

      if (useAzure) {
        console.log(`Using Azure Speech for SA language: ${language}`)
        transcription = await transcribeWithAzure(audioUrl, language)
        providerUsed = 'azure'
      } else if (TRANSCRIPTION_PROVIDER === 'deepgram' && DEEPGRAM_API_KEY) {
        console.log('Using Deepgram for English transcription')
        transcription = await transcribeWithDeepgram(audioUrl, language)
        providerUsed = 'deepgram'
      } else {
        // Auto-select: Azure for SA languages, Deepgram for everything else
        if (AZURE_SPEECH_KEY && saLanguages.includes(language || '')) {
          console.log('Auto-selecting Azure for SA language')
          transcription = await transcribeWithAzure(audioUrl, language)
          providerUsed = 'azure'
        } else if (DEEPGRAM_API_KEY) {
          console.log('Auto-selecting Deepgram for English')
          transcription = await transcribeWithDeepgram(audioUrl, language)
          providerUsed = 'deepgram'
        } else {
          throw new Error('No transcription provider configured. Please set AZURE_SPEECH_KEY or DEEPGRAM_API_KEY.')
        }
      }
    } catch (primaryError) {
      console.error(`[TEST MODE] Primary transcription provider (${providerUsed}) failed:`, primaryError)
      
      // [DISABLED FOR TESTING] Whisper fallback commented out
      // Intelligent fallback: Azure <-> Deepgram only (no Whisper)
      try {
        if (providerUsed === 'azure' && DEEPGRAM_API_KEY) {
          console.log('[TEST MODE] Azure failed, falling back to Deepgram')
          transcription = await transcribeWithDeepgram(audioUrl, language)
          providerUsed = 'deepgram'
          usedFallback = true
        } else if (providerUsed === 'deepgram' && AZURE_SPEECH_KEY && AZURE_SPEECH_REGION) {
          console.log('[TEST MODE] Deepgram failed, falling back to Azure')
          transcription = await transcribeWithAzure(audioUrl, language)
          providerUsed = 'azure'
          usedFallback = true
        } else {
          console.error('[TEST MODE] No fallback available, Whisper-1 is disabled')
          throw primaryError
        }
      } catch (fallbackError) {
        console.error('[TEST MODE] Fallback transcription provider also failed:', fallbackError)
        throw primaryError
      }
    }

    // Update voice note if we have one
    if (voiceNote && transcriptionRequest.voice_note_id) {
      voiceNote = await updateVoiceNoteTranscription(transcriptionRequest.voice_note_id, transcription)
      
      // Track engagement event
      await trackTranscriptionEvent(voiceNote, transcription)
    }

    return new Response(JSON.stringify({
      success: true,
      voice_note_id: voiceNote?.id,
      transcript: transcription.transcript,
      language: transcription.language,
      word_count: transcription.word_count,
      confidence: transcription.confidence,
      provider: providerUsed,
      used_fallback: usedFallback
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error transcribing audio:', error)
    return new Response(JSON.stringify({ 
      error: 'Failed to transcribe audio',
      details: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * Handle database trigger for new voice notes
 */
async function handleVoiceNoteTrigger(request: Request): Promise<Response> {
  try {
    const { record, old_record, type } = await request.json()
    
    // Only process INSERT events for new voice notes
    if (type !== 'INSERT' || !record.id || record.transcript) {
      return new Response(JSON.stringify({ success: true, skipped: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('Processing voice note trigger for:', record.id)

    // Construct transcription request from database record
    const transcriptionRequest: TranscriptionRequest = {
      voice_note_id: record.id,
      language: record.language,
      trigger_source: 'database_trigger'
    }

    // Process the transcription request
    return await transcribeAudio(new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transcriptionRequest)
    }))

  } catch (error) {
    console.error('Error processing voice note trigger:', error)
    return new Response(JSON.stringify({ 
      error: 'Failed to process trigger',
      details: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * Handle Supabase Storage webhook for new audio files
 */
async function handleStorageEvent(request: Request): Promise<Response> {
  try {
    const { record, eventType } = await request.json()
    
    // Only process INSERT events for audio files
    if (eventType !== 'INSERT' || !record.name || !record.bucket_id) {
      return new Response(JSON.stringify({ success: true, skipped: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Check if this is an audio file
    const audioExtensions = ['.mp3', '.m4a', '.wav', '.webm', '.ogg', '.aac']
    const isAudioFile = audioExtensions.some(ext => record.name.toLowerCase().endsWith(ext))
    
    if (!isAudioFile) {
      return new Response(JSON.stringify({ success: true, skipped: 'Not an audio file' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('Processing storage event for audio file:', record.name)

    // Construct transcription request from storage event
    const transcriptionRequest: TranscriptionRequest = {
      storage_path: record.name,
      trigger_source: 'storage_event'
    }

    // Process the transcription request
    return await transcribeAudio(new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transcriptionRequest)
    }))

  } catch (error) {
    console.error('Error processing storage event:', error)
    return new Response(JSON.stringify({ 
      error: 'Failed to process storage event',
      details: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * Main request handler
 */
async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url)
  
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  // Handle different endpoints
  if (url.pathname.includes('trigger')) {
    return await handleVoiceNoteTrigger(request)
  } else if (url.pathname.includes('storage-event')) {
    return await handleStorageEvent(request)
  } else {
    return await transcribeAudio(request)
  }
}

// Serve the function
serve(handleRequest)