import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
    })

    const {
      detected_language,
      traits,
      session_id,
    }: { detected_language?: string; traits?: Record<string, unknown>; session_id?: string } = await req.json()

    // Get authed user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    // Resolve preschool_id from profiles
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('preschool_id')
      .eq('id', user.id)
      .maybeSingle()

    if (profileErr || !profile?.preschool_id) {
      return new Response(JSON.stringify({ error: 'Profile or preschool not found' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const preschool_id = profile.preschool_id

    // Upsert dash_user_contexts
    const { error: upsertErr } = await supabase.from('dash_user_contexts').upsert(
      {
        user_id: user.id,
        preschool_id,
        preferred_language: detected_language || null,
        traits: traits || {},
        last_seen: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

    if (upsertErr) {
      throw upsertErr
    }

    // Optional: track instance heartbeat
    if (session_id) {
      await supabase.from('dash_agent_instances').insert({
        user_id: user.id,
        preschool_id,
        session_id,
        settings: {},
        last_active: new Date().toISOString(),
      }).select().single().catch(() => null)
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  } catch (e) {
    console.error('dash-context-sync error:', e)
    return new Response(JSON.stringify({ error: 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
})
