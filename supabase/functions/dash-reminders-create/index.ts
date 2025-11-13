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
      title,
      schedule_at,
      payload,
    }: { title: string; schedule_at: string; payload?: Record<string, unknown> } = await req.json()

    if (!title || !schedule_at) {
      return new Response(JSON.stringify({ error: 'Missing title or schedule_at' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    // Get authed user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
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

    const scheduleDate = new Date(schedule_at)
    if (isNaN(scheduleDate.getTime())) {
      return new Response(JSON.stringify({ error: 'Invalid schedule_at' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const { data: inserted, error: insErr } = await supabase
      .from('dash_reminders')
      .insert({
        user_id: user.id,
        preschool_id: profile.preschool_id,
        title,
        payload: payload || {},
        schedule_at: scheduleDate.toISOString(),
        status: 'active',
      })
      .select('id')
      .single()

    if (insErr) throw insErr

    return new Response(JSON.stringify({ success: true, id: inserted?.id }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  } catch (e) {
    console.error('dash-reminders-create error:', e)
    return new Response(JSON.stringify({ error: 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
})
