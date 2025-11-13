// Supabase Edge Function: ai-usage
// Purpose: handle AI usage queries and logging
// NOTE: Placeholder implementation. Wire to your billing/limits once DB is ready.
// To deploy:
//   supabase functions deploy ai-usage
// To test locally:
//   supabase functions serve --env-file ./supabase/.env

import { serve } from "https://deno.land/std@0.177.0/http/server.ts"

serve(async (req: Request) => {
  try {
    const { method } = req
    if (method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
    }

    const body = await req.json().catch(() => ({})) as any
    const action = body?.action || 'monthly'

    // Minimal stubbed response to unblock client usage
    if (action === 'monthly' || action === 'get' || !action) {
      return new Response(JSON.stringify({
        monthly: {
          lesson_generation: 0,
          grading_assistance: 0,
          homework_help: 0,
        }
      }), { headers: { 'content-type': 'application/json' } })
    }

    if (action === 'log') {
      // Accept logs best-effort in placeholder
      return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400 })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500 })
  }
})

