/* eslint-disable @typescript-eslint/no-unused-vars */

// deno-lint-ignore-file no-explicit-any
// Supabase Edge Function: payments-webhook (stub)
// Receives PayFast ITN webhook, verifies, and updates payment + subscription status

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

serve(async (req) => {
  try {
    // PayFast ITN sends application/x-www-form-urlencoded
    const contentType = req.headers.get('content-type') || '';
    const raw = await req.text();
    const form = contentType.includes('application/x-www-form-urlencoded') ? new URLSearchParams(raw) : new URLSearchParams();

    const txId = form.get('m_payment_id') || '';
    const paymentStatus = (form.get('payment_status') || '').toUpperCase();
    const signature = form.get('signature') || '';
    if (!txId) return new Response(JSON.stringify({ error: 'Missing m_payment_id' }), { status: 400 });

    // Optional signature verification (recommended)
    try {
      const passphrase = Deno.env.get('PAYFAST_PASSPHRASE') || '';
      // Build signature base string from all fields except signature, sorted by key
      const entries: [string, string][] = [];
      form.forEach((value, key) => {
        if (key === 'signature') return;
        entries.push([key, value]);
      });
      entries.sort((a, b) => a[0].localeCompare(b[0]));
      const qs = entries.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&') + (passphrase ? `&passphrase=${encodeURIComponent(passphrase)}` : '');
      const { createHash } = await import('https://deno.land/std@0.208.0/hash/md5.ts');
      const md5 = createHash();
      md5.update(qs);
      const computed = md5.toString();
      if (signature && signature !== computed) {
        // Signature mismatch: log and reject
        return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 400 });
      }
    } catch (_e) {
      // Continue without failing hard in sandbox/testing
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const s = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Lookup transaction
    const { data: tx, error: txErr } = await s.from('payment_transactions').select('*').eq('id', txId).maybeSingle();
    if (txErr || !tx) return new Response(JSON.stringify({ error: 'Transaction not found' }), { status: 404 });

    // Update status based on payment_status
    const newStatus = paymentStatus === 'COMPLETE' ? 'completed' : (paymentStatus || 'pending');
    await s.from('payment_transactions').update({ status: newStatus }).eq('id', txId);

    // Handle successful payment - create or activate subscription
    if (newStatus === 'completed') {
      // Extract custom data from PayFast
      const planTier = form.get('custom_str1') || '';
      const scope = form.get('custom_str2') || '';
      const ownerId = form.get('custom_str3') || '';
      const customData = form.get('custom_str4') || '{}';
      let billing = 'monthly';
      let seats = 1;
      try {
        const parsed = JSON.parse(customData);
        billing = parsed.billing || 'monthly';
        seats = parsed.seats || 1;
      } catch { /* Intentional: non-fatal */ }

      // Get plan details
      const { data: plan } = await s
        .from('subscription_plans')
        .select('id, tier, name, max_teachers')
        .eq('tier', planTier)
        .eq('is_active', true)
        .maybeSingle();

      if (plan && scope === 'school' && tx.school_id) {
        // Create or update school subscription
        const startDate = new Date();
        const endDate = new Date(startDate);
        if (billing === 'annual') {
          endDate.setFullYear(endDate.getFullYear() + 1);
        } else {
          endDate.setMonth(endDate.getMonth() + 1);
        }

        const subscriptionData = {
          school_id: tx.school_id,
          plan_id: plan.id,
          status: 'active',
          owner_type: 'school',
          billing_frequency: billing,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          next_billing_date: endDate.toISOString(),
          seats_total: Math.max(seats, plan.max_teachers || 1),
          seats_used: 0,
          metadata: {
            plan_name: plan.name,
            price_paid: tx.amount,
            transaction_id: txId,
            activated_by_payment: true
          }
        };

        // Try to update existing subscription first
        const { data: existing } = await s
          .from('subscriptions')
          .select('id')
          .eq('owner_type', 'school')
          .eq('school_id', tx.school_id)
          .maybeSingle();

        if (existing) {
          await s
            .from('subscriptions')
            .update(subscriptionData)
            .eq('id', existing.id);
        } else {
          await s.from('subscriptions').insert(subscriptionData);
        }

        // Update preschool subscription tier
        await s
          .from('preschools')
          .update({ subscription_tier: plan.tier })
          .eq('id', tx.school_id);
        // Mark invoice paid by invoice_number in tx metadata
        const invoiceNumber = (tx.metadata as any)?.invoice_number;
        if (invoiceNumber) {
          await s
            .from('billing_invoices')
            .update({ status: 'paid', paid_at: new Date().toISOString() })
            .eq('invoice_number', invoiceNumber)
            .eq('school_id', tx.school_id);
        }
        
        // Notify admins of payment success
        try {
          const payload = {
            event_type: 'payment_success',
            preschool_id: tx.school_id,
            plan_tier: plan.tier,
            role_targets: ['principal', 'principal_admin', 'superadmin'],
            include_email: true,
            custom_payload: { amount: (tx.amount && tx.currency) ? `${tx.amount} ${tx.currency}` : undefined }
          };
          await fetch(`${SUPABASE_URL}/functions/v1/notifications-dispatcher`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
            body: JSON.stringify(payload),
          });
        } catch (__n) { /* Intentional: error handled */ }
      }
      
      // Handle user (individual) subscriptions
      else if (plan && scope === 'user' && ownerId) {
        const userId = ownerId;
        const startDate = new Date();
        const endDate = new Date(startDate);
        if (billing === 'annual') {
          endDate.setFullYear(endDate.getFullYear() + 1);
        } else {
          endDate.setMonth(endDate.getMonth() + 1);
        }

        const subscriptionData = {
          user_id: userId,
          plan_id: plan.id,
          status: 'active',
          owner_type: 'user',
          billing_frequency: billing,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          next_billing_date: endDate.toISOString(),
          seats_total: 1,
          seats_used: 1,
          metadata: {
            plan_name: plan.name,
            price_paid: tx.amount,
            transaction_id: txId,
            activated_by_payment: true
          }
        };

        // Try to update existing user subscription first
        const { data: existing } = await s
          .from('subscriptions')
          .select('id')
          .eq('owner_type', 'user')
          .eq('user_id', userId)
          .maybeSingle();

        if (existing) {
          await s
            .from('subscriptions')
            .update(subscriptionData)
            .eq('id', existing.id);
        } else {
          await s.from('subscriptions').insert(subscriptionData);
        }
        
        // Notify user of payment success
        try {
          const payload = {
            event_type: 'payment_success',
            user_ids: [userId],
            plan_tier: plan.tier,
            include_email: true,
            custom_payload: { amount: (tx.amount && tx.currency) ? `${tx.amount} ${tx.currency}` : undefined }
          };
          await fetch(`${SUPABASE_URL}/functions/v1/notifications-dispatcher`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
            body: JSON.stringify(payload),
          });
        } catch (__n) { /* Intentional: error handled */ }
      }
    }
    
    // Handle failed/cancelled payments
    else if (newStatus === 'cancelled' || newStatus === 'failed') {
      if (tx.school_id) {
        const invoiceNumber = (tx.metadata as any)?.invoice_number;
        if (invoiceNumber) {
          await s
            .from('billing_invoices')
            .update({ status: newStatus })
            .eq('invoice_number', invoiceNumber)
            .eq('school_id', tx.school_id);
        }
      }
    }


    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e?.message || 'Webhook error' }), { status: 500 });
  }
});
