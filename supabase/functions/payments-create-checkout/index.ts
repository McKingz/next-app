// deno-lint-ignore-file no-explicit-any
// Supabase Edge Function: payments-create-checkout
// Creates invoice + transaction and returns a PayFast redirect URL (stub)

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

interface CheckoutInput {
  scope: 'school' | 'user';
  schoolId?: string;
  userId?: string;
  planTier: string;
  billing: 'monthly' | 'annual';
  seats?: number;
  return_url?: string;
  cancel_url?: string;
  email_address?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    // CORS headers for all responses
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Content-Type': 'application/json',
    };

    // Validate authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), { 
        status: 401,
        headers: corsHeaders 
      });
    }
    
    const input = (await req.json()) as CheckoutInput;
    
    // Reject enterprise tier - must go through sales
    if (input.planTier.toLowerCase() === 'enterprise') {
      return new Response(JSON.stringify({ error: 'contact_sales_required' }), { 
        status: 400,
        headers: corsHeaders 
      });
    }

    // Resolve plan price from public.subscription_plans
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: 'Server config missing' }), { 
        status: 500,
        headers: corsHeaders 
      });
    }

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const s = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: plan } = await s
      .from('subscription_plans')
      .select('id, tier, name, price_monthly, price_annual')
      .eq('tier', input.planTier)
      .eq('is_active', true)
      .maybeSingle();

    if (!plan) {
      return new Response(JSON.stringify({ error: 'Plan not found' }), { 
        status: 400,
        headers: corsHeaders 
      });
    }

    // Prices in DB are stored in cents; convert to ZAR for PayFast and DB records
    const amountCents = (input.billing === 'annual' ? (plan.price_annual || 0) : (plan.price_monthly || 0));
    const amountZAR = (amountCents || 0) / 100;

    // Insert a payment_transactions row (pending)
    const txId = crypto.randomUUID();
    // Try to get current school subscription id for invoice (if exists)
    let subscriptionId: string | null = null;
    if (input.scope === 'school' && input.schoolId) {
      const { data: sub } = await s
        .from('subscriptions')
        .select('id')
        .eq('owner_type', 'school')
        .eq('school_id', input.schoolId)
        .maybeSingle();
      subscriptionId = sub?.id ?? null;
    }

    // Create invoice
    const invoiceId = crypto.randomUUID();
    const invoiceNumber = `INV-${txId.substring(0, 8)}`;
    await s.from('billing_invoices').insert({
      id: invoiceId,
      school_id: input.schoolId || null,
      subscription_id: subscriptionId,
      invoice_number: invoiceNumber,
      amount: amountZAR,
      currency: 'ZAR',
      status: 'pending',
      due_date: new Date().toISOString(),
      invoice_data: { plan_tier: plan.tier, billing: input.billing, seats: input.seats || 1 },
    } as any);

    const { error: txErr } = await s.from('payment_transactions').insert({
      id: txId,
      school_id: input.schoolId || null,
      subscription_plan_id: String(plan.id),
      amount: amountZAR,
      currency: 'ZAR',
      status: 'pending',
      metadata: { scope: input.scope, billing: input.billing, seats: input.seats || 1, invoice_number: invoiceNumber },
    } as any);
    if (txErr) {
      return new Response(JSON.stringify({ error: txErr.message }), { 
        status: 400,
        headers: corsHeaders 
      });
    }

    // Build PayFast redirect URL (GET). For production, prefer POSTing a form.
    const mode = (Deno.env.get('PAYFAST_MODE') || 'sandbox').toLowerCase();
    const base = mode === 'live' ? 'https://www.payfast.co.za/eng/process' : 'https://sandbox.payfast.co.za/eng/process';

    // Construct webhook URLs - ensure they use the correct Supabase URL
    const webhookBaseUrl = SUPABASE_URL.replace(/\/$/, ''); // Remove trailing slash if present
    const notifyUrl = Deno.env.get('PAYFAST_NOTIFY_URL') || `${webhookBaseUrl}/functions/v1/payfast-webhook`;
    const returnUrl = input.return_url || Deno.env.get('PAYFAST_RETURN_URL') || `${webhookBaseUrl}/functions/v1/payments-webhook`;
    const cancelUrl = input.cancel_url || Deno.env.get('PAYFAST_CANCEL_URL') || `${webhookBaseUrl}/functions/v1/payments-webhook`;

    console.log('PayFast webhook URLs:', { notifyUrl, returnUrl, cancelUrl, mode });

    const params: Record<string,string> = {
      merchant_id: Deno.env.get('PAYFAST_MERCHANT_ID') || '',
      merchant_key: Deno.env.get('PAYFAST_MERCHANT_KEY') || '',
      return_url: returnUrl,
      cancel_url: cancelUrl,
      notify_url: notifyUrl,
      m_payment_id: txId,
      amount: amountZAR.toFixed(2),
      item_name: `EduDash Pro - ${plan.name} (${input.billing})`,
      email_confirmation: '1',
      email_address: input.email_address || (input.scope === 'user' ? Deno.env.get('PAYFAST_TEST_EMAIL') || '' : ''),
      custom_str1: input.planTier,
      custom_str2: input.scope,
      custom_str3: input.schoolId || input.userId || '',
      custom_str4: JSON.stringify({ billing: input.billing, seats: input.seats || 1 }),
    };

    // When a PayFast passphrase is configured, we must sign the request parameters
    // Per docs: concatenate non-blank vars in the order they appear, URL-encode (RFC1738: spaces as '+', uppercase hex),
    // append &passphrase=..., then MD5 the resultant string.
    function encodeRFC1738(v: string) {
      return encodeURIComponent(v)
        .replace(/%20/g, '+')
        .replace(/%[0-9a-f]{2}/g, (m) => m.toUpperCase());
    }

    try {
      const passphrase = (Deno.env.get('PAYFAST_PASSPHRASE') || '').trim();
      if (passphrase) {
        const orderedQs = Object.entries(params)
          .filter(([, v]) => v !== undefined && v !== null && String(v).length > 0)
          .map(([k, v]) => `${k}=${encodeRFC1738(String(v))}`)
          .join('&');
        const signatureBase = `${orderedQs}&passphrase=${encodeRFC1738(passphrase)}`;
        const { createHash } = await import('https://deno.land/std@0.208.0/hash/md5.ts');
        const md5 = createHash();
        md5.update(signatureBase);
        const signature = md5.toString();
        params.signature = signature;
      }
    } catch (_e) {
      // Do not fail checkout if signature generation fails; webhook will still validate server-side
    }

    const url = new URL(base);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const redirect_url = url.toString();

    return new Response(JSON.stringify({ redirect_url }), { 
      status: 200, 
      headers: corsHeaders 
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e?.message || 'Failed to create checkout' }), { 
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Content-Type': 'application/json',
      }
    });
  }
});
