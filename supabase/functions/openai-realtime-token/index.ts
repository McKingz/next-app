import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// This Edge Function mints ephemeral client secrets for OpenAI Realtime API
// Never expose your OPENAI_API_KEY to clients; only return the ephemeral client_secret

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!
const OPENAI_REALTIME_MODEL = Deno.env.get("OPENAI_REALTIME_MODEL") || "gpt-4o-realtime-preview"

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  try {
    // Optional: authorize caller (e.g., check Supabase Auth JWT)
    // const auth = req.headers.get('Authorization')
    // TODO: Validate auth token if required by your app

    const body = await req.json().catch(() => ({}))
    const { instructions } = body || {}

    const r = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        // Required by OpenAI Realtime API
        'OpenAI-Beta': 'realtime=v1',
      },
      body: JSON.stringify({
        model: OPENAI_REALTIME_MODEL,
        // Enable server-side VAD so you get natural turn-taking
        turn_detection: { type: 'server_vad' },
        // Request audio/text modalities so you can receive transcripts and/or TTS
        modalities: ['audio', 'text'],
        // Voice is only relevant if you request audio outputs
        voice: 'alloy',
        // Tune behavior for transcription-first experiences
        instructions: instructions || 'Transcribe user speech and emit partial transcripts quickly.'
      })
    })

    if (!r.ok) {
      const err = await r.text()
      return new Response(JSON.stringify({ error: 'OpenAI session error', details: err }), {
        status: r.status,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const session = await r.json()
    // Return provider-agnostic shape expected by the app
    const model = session.model || OPENAI_REALTIME_MODEL
    const token = session?.client_secret?.value || session?.client_secret || ''
    const url = `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`

    return new Response(JSON.stringify({
      token,
      url,
      model,
      expiresIn: 55 * 60, // seconds (ephemeral)
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: 'Failed to create realtime session', details: e?.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
