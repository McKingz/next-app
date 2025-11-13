// Supabase Edge Function: send-email
// Sends emails via Resend with proper security and validation
// Requires RESEND_API_KEY in Supabase secrets

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'noreply@edudashpro.com';
const ENVIRONMENT = Deno.env.get('ENVIRONMENT') || 'production';

// Rate limiting: max emails per hour per organization
const RATE_LIMIT_PER_HOUR = 50;

interface EmailRequest {
  to: string | string[];
  subject: string;
  body: string; // HTML or plain text
  reply_to?: string;
  cc?: string[];
  bcc?: string[];
  is_html?: boolean;
  confirmed?: boolean; // User must explicitly confirm
}

interface EmailResponse {
  success: boolean;
  message_id?: string;
  error?: string;
  rate_limit?: {
    used: number;
    limit: number;
    remaining: number;
  };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user profile and organization
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, organization_id, preschool_id, role')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return new Response(
        JSON.stringify({ success: false, error: 'Profile not found' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const orgId = profile.organization_id || profile.preschool_id;

    // Only principals, admins, and superadmins can send emails
    const allowedRoles = ['principal', 'principal_admin', 'superadmin', 'teacher'];
    if (!allowedRoles.includes(profile.role)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Insufficient permissions. Only principals and teachers can send emails.' 
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: EmailRequest = await req.json();

    // Validate required fields
    if (!body.to || !body.subject || !body.body) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: to, subject, body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Security: Require explicit confirmation for email sending
    if (!body.confirmed) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Email sending requires explicit user confirmation. Set confirmed: true' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check rate limit
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: emailsSentThisHour } = await supabase
      .from('email_logs')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .gte('created_at', hourAgo);

    const used = emailsSentThisHour || 0;
    
    if (used >= RATE_LIMIT_PER_HOUR) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Rate limit exceeded',
          rate_limit: {
            used,
            limit: RATE_LIMIT_PER_HOUR,
            remaining: 0
          }
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // In development/testing, log but don't actually send
    if (ENVIRONMENT === 'development' || !RESEND_API_KEY) {
      console.log('[send-email] TEST MODE: Would send email:', {
        to: body.to,
        subject: body.subject,
        from: FROM_EMAIL,
      });

      // Log to database
      await supabase.from('email_logs').insert({
        organization_id: orgId,
        user_id: user.id,
        recipient: Array.isArray(body.to) ? body.to.join(',') : body.to,
        subject: body.subject,
        status: 'test_mode',
        metadata: { environment: 'development' }
      });

      return new Response(
        JSON.stringify({ 
          success: true, 
          message_id: 'test-mode-' + Date.now(),
          warning: 'TEST MODE: Email not actually sent',
          rate_limit: {
            used: used + 1,
            limit: RATE_LIMIT_PER_HOUR,
            remaining: RATE_LIMIT_PER_HOUR - used - 1
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send email via Resend
    const emailPayload = {
      from: FROM_EMAIL,
      to: Array.isArray(body.to) ? body.to : [body.to],
      subject: body.subject,
      ...(body.is_html !== false ? { html: body.body } : { text: body.body }),
      ...(body.reply_to && { reply_to: body.reply_to }),
      ...(body.cc && body.cc.length > 0 && { cc: body.cc }),
      ...(body.bcc && body.bcc.length > 0 && { bcc: body.bcc }),
    };

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify(emailPayload),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error('[send-email] Resend API error:', resendData);
      
      // Log failed attempt
      await supabase.from('email_logs').insert({
        organization_id: orgId,
        user_id: user.id,
        recipient: Array.isArray(body.to) ? body.to.join(',') : body.to,
        subject: body.subject,
        status: 'failed',
        error_message: resendData.message || 'Unknown error',
        metadata: { resend_error: resendData }
      });

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: resendData.message || 'Failed to send email' 
        }),
        { status: resendResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log successful send
    await supabase.from('email_logs').insert({
      organization_id: orgId,
      user_id: user.id,
      recipient: Array.isArray(body.to) ? body.to.join(',') : body.to,
      subject: body.subject,
      status: 'sent',
      message_id: resendData.id,
      metadata: { resend_response: resendData }
    });

    const response: EmailResponse = {
      success: true,
      message_id: resendData.id,
      rate_limit: {
        used: used + 1,
        limit: RATE_LIMIT_PER_HOUR,
        remaining: RATE_LIMIT_PER_HOUR - used - 1
      }
    };

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[send-email] Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
