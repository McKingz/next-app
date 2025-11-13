// Supabase Edge Function: delete-account
// Allows an authenticated user to permanently delete their EduDash Pro account.
// This function sanitises profile data, removes device/session records, and deletes the auth user.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

interface DeleteAccountPayload {
  confirm?: boolean;
  reason?: string;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }

  try {
    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: req.headers.get('Authorization') || '',
        },
      },
    });

    const { data: { user }, error: authError } = await authClient.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    let body: DeleteAccountPayload = {};
    if (req.method === 'POST' || req.method === 'DELETE') {
      try {
        body = await req.json();
      } catch (_) {
        body = {};
      }
    }

    if (!body.confirm) {
      return new Response(
        JSON.stringify({ success: false, error: 'Confirmation required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const userId = user.id;
    const now = new Date().toISOString();

    const deletionTargets: Array<{ table: string; filters: Record<string, string> }> = [
      { table: 'push_device_tokens', filters: { user_id: userId } },
      { table: 'ai_usage_logs', filters: { user_id: userId } },
      { table: 'parent_link_requests', filters: { parent_auth_id: userId } },
      { table: 'parent_link_requests', filters: { approved_by: userId } },
    ];

    for (const target of deletionTargets) {
      let query = adminClient.from(target.table).delete();
      for (const [column, value] of Object.entries(target.filters)) {
        query = query.eq(column, value);
      }
      const { error: deleteError } = await query;
      if (deleteError) {
        // Ignore missing table errors but log everything else for observability
        const message = deleteError?.message || '';
        if (!message.includes('relation') && !message.includes('does not exist')) {
          console.warn(`[delete-account] Failed to clean table ${target.table}`, deleteError);
        }
      }
    }

    // Scrub profile data (retain row for relational integrity but remove PII)
    const profileUpdate = await adminClient
      .from('profiles')
      .update({
        is_active: false,
        first_name: null,
        last_name: null,
        email: null,
        phone: null,
        phone_secondary: null,
        organization_id: null,
        preschool_id: null,
        tenant_slug: null,
        updated_at: now,
      })
      .eq('id', userId);

    if (profileUpdate.error) {
      console.error('[delete-account] Failed to update profile', profileUpdate.error);
      throw profileUpdate.error;
    }

    // Scrub internal users table entry if present
    const { data: internalUser } = await adminClient
      .from('users')
      .select('id')
      .eq('auth_user_id', userId)
      .maybeSingle();

    const internalUserId = internalUser?.id || null;

    if (internalUser) {
      const userUpdate = await adminClient
        .from('users')
        .update({
          is_active: false,
          phone: null,
          postal_code: null,
          profile_picture_url: null,
          notes: 'Account deleted at ' + now,
          updated_at: now,
        })
        .eq('id', internalUser.id);

      if (userUpdate.error) {
        console.error('[delete-account] Failed to update users entry', userUpdate.error);
        throw userUpdate.error;
      }
    }

    // Optional: log deletion request metadata (best-effort, ignore errors)
    try {
      await adminClient.from('audit_logs').insert({
        user_id: internalUserId,
        action: 'account_deleted',
        resource_id: userId,
        resource_type: 'user',
        new_values: { reason: body.reason || null },
        created_at: now,
      });
    } catch (logError) {
      console.warn('[delete-account] audit log insert failed', logError);
    }

    // Finally delete the auth user (revokes sessions and access tokens)
    const deleteUserResponse = await adminClient.auth.admin.deleteUser(userId);
    if (deleteUserResponse.error) {
      console.error('[delete-account] Failed to delete auth user', deleteUserResponse.error);
      throw deleteUserResponse.error;
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('[delete-account] Unexpected error', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
