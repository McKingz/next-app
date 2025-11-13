import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// PayFast ITN Webhook Handler
// Purpose: Accept PayFast ITN (server-to-server) callbacks, verify signature,
// process payments, and activate subscriptions
// Security: Deployed with --no-verify-jwt so PayFast can post without auth

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper function to compute MD5 hash
async function md5Hash(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('MD5', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Helper function to validate ITN with PayFast
async function validateWithPayFast(rawBody: string, isSandbox: boolean): Promise<boolean> {
  const validateUrl = isSandbox 
    ? 'https://sandbox.payfast.co.za/eng/query/validate'
    : 'https://www.payfast.co.za/eng/query/validate';

  try {
    const response = await fetch(validateUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: rawBody,
    });
    
    const responseText = await response.text();
    return responseText.trim() === 'VALID';
  } catch (error) {
    console.error('PayFast validation error:', error);
    return false;
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const PAYFAST_PASSPHRASE = Deno.env.get("PAYFAST_PASSPHRASE") || "";
    const PAYFAST_MERCHANT_ID = Deno.env.get("PAYFAST_MERCHANT_ID") || "";
    const PAYFAST_MODE = (Deno.env.get("PAYFAST_MODE") || "sandbox").toLowerCase();
    
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { 
      auth: { persistSession: false } 
    });

    // PayFast sends application/x-www-form-urlencoded
    const rawBody = await req.text();
    const params = new URLSearchParams(rawBody);

    // Extract key parameters
    const payload: Record<string, string> = {};
    for (const [k, v] of params.entries()) {
      payload[k] = v;
    }

    const {
      merchant_id,
      merchant_key,
      m_payment_id,
      pf_payment_id,
      payment_status,
      amount_gross,
      signature,
      ...otherFields
    } = payload;

    console.log('PayFast ITN received:', {
      merchant_id,
      m_payment_id,
      pf_payment_id,
      payment_status,
      amount_gross
    });

    // Basic validation
    if (!m_payment_id) {
      console.error('Missing m_payment_id in ITN');
      return new Response("Missing m_payment_id", { status: 400, headers: corsHeaders });
    }

    if (merchant_id !== PAYFAST_MERCHANT_ID) {
      console.error(`Merchant ID mismatch. Expected: ${PAYFAST_MERCHANT_ID}, Got: ${merchant_id}`);
      return new Response("Invalid merchant_id", { status: 400, headers: corsHeaders });
    }

    // Signature verification
    let signatureValid = false;
    if (signature && PAYFAST_PASSPHRASE) {
      try {
        // Per PayFast docs (Custom Integration):
        // - concatenate non-blank vars (excluding 'signature') in the order received
        // - URL encode values (RFC1738: spaces as '+', uppercase percent-hex)
        // - append &passphrase=...
        function encodeRFC1738(v: string) {
          return encodeURIComponent(v)
            .replace(/%20/g, '+')
            .replace(/%[0-9a-f]{2}/g, (m) => m.toUpperCase());
        }

        const orderedPairs: string[] = [];
        // Maintain original POST order using URLSearchParams iteration
        for (const [k, v] of params.entries()) {
          if (k === 'signature') continue;
          if (v !== '') orderedPairs.push(`${k}=${encodeRFC1738(v)}`);
        }
        const queryString = orderedPairs.join('&');
        const signatureString = `${queryString}&passphrase=${encodeRFC1738(PAYFAST_PASSPHRASE)}`;

        // Compute MD5 hash
        const computedSignature = await md5Hash(signatureString);
        signatureValid = signature.toLowerCase() === computedSignature.toLowerCase();

        if (!signatureValid) {
          console.error('Signature verification failed:', {
            provided: signature,
            computed: computedSignature,
            signatureString: signatureString.replace(PAYFAST_PASSPHRASE, 'REDACTED')
          });
        }
      } catch (error) {
        console.error('Error computing signature:', error);
      }
    }

    // Validate with PayFast (optional but recommended)
    const isValidWithPayFast = await validateWithPayFast(rawBody, PAYFAST_MODE === 'sandbox');

    // Log the ITN for audit purposes
    const { error: logError } = await supabase.from("payfast_itn_logs").insert({
      merchant_id,
      merchant_key,
      return_url: payload.return_url || null,
      cancel_url: payload.cancel_url || null,
      notify_url: payload.notify_url || null,
      name_first: payload.name_first || null,
      name_last: payload.name_last || null,
      email_address: payload.email_address || null,
      m_payment_id,
      amount: amount_gross ? parseFloat(amount_gross) : null,
      item_name: payload.item_name || null,
      item_description: payload.item_description || null,
      payment_status,
      pf_payment_id,
      signature,
      raw_post_data: rawBody,
      ip_address: req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') || null,
      is_valid: signatureValid && isValidWithPayFast,
      processing_notes: `Signature: ${signatureValid ? 'Valid' : 'Invalid'}, PayFast: ${isValidWithPayFast ? 'Valid' : 'Invalid'}`,
      related_payment_id: m_payment_id,
    });

    if (logError) {
      console.error("payfast_itn_logs insert error:", logError);
    }

    // Only process payment if validation passes
    // In sandbox mode, be lenient with signature validation (PayFast sandbox can be unreliable)
    const isSandbox = PAYFAST_MODE === 'sandbox';
    
    if (!isSandbox && !signatureValid && PAYFAST_PASSPHRASE) {
      console.warn('Skipping payment processing due to invalid signature (production mode)');
      return new Response("Signature invalid", { status: 400, headers: corsHeaders });
    }

    // In sandbox mode, warn but don't reject on signature failure
    if (isSandbox && !signatureValid && PAYFAST_PASSPHRASE) {
      console.warn('⚠️ Sandbox mode: Signature invalid but continuing (sandbox testing)');
    }

    if (!isSandbox && !isValidWithPayFast) {
      console.warn('Skipping payment processing - PayFast validation failed (production mode)');
      return new Response("PayFast validation failed", { status: 400, headers: corsHeaders });
    }
    
    // In sandbox mode, warn but don't reject on PayFast validation failure
    if (isSandbox && !isValidWithPayFast) {
      console.warn('⚠️ Sandbox mode: PayFast validation failed but continuing (sandbox testing)');
    }

    // Check for idempotency - prevent double processing
    const { data: existingTx, error: txLookupError } = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('id', m_payment_id)
      .maybeSingle();

    if (txLookupError) {
      console.error('Error looking up transaction:', txLookupError);
      return new Response("Database error", { status: 500, headers: corsHeaders });
    }

    if (!existingTx) {
      console.error('Transaction not found:', m_payment_id);
      return new Response("Transaction not found", { status: 404, headers: corsHeaders });
    }

    // If already processed, return success but don't process again
    if (existingTx.status === 'completed' && payment_status === 'COMPLETE') {
      console.log('Transaction already processed, skipping:', m_payment_id);
      return new Response("Already processed", { status: 200, headers: corsHeaders });
    }

    // Update transaction status
    const newStatus = payment_status === 'COMPLETE' ? 'completed' : 
                     payment_status === 'CANCELLED' ? 'cancelled' :
                     payment_status === 'FAILED' ? 'failed' : 'pending';

    const { error: updateError } = await supabase
      .from('payment_transactions')
      .update({ 
        status: newStatus,
        payfast_payment_id: pf_payment_id,
        completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', m_payment_id);

    if (updateError) {
      console.error('Error updating transaction:', updateError);
      return new Response("Failed to update transaction", { status: 500, headers: corsHeaders });
    }

    // Process successful payment
    if (newStatus === 'completed') {
      console.log('Processing successful payment:', m_payment_id);
      
      // Extract custom data from PayFast
      const planTier = payload.custom_str1 || '';
      const scope = payload.custom_str2 || '';
      const ownerId = payload.custom_str3 || '';
      const customData = payload.custom_str4 || '{}';
      
      let billing = 'monthly';
      let seats = 1;
      
      try {
        const parsed = JSON.parse(customData);
        billing = parsed.billing || 'monthly';
        seats = parsed.seats || 1;
      } catch (e) {
        console.warn('Error parsing custom_str4:', e);
      }

      // Get plan details
      const { data: plan } = await supabase
        .from('subscription_plans')
        .select('id, tier, name, max_teachers')
        .eq('tier', planTier)
        .eq('is_active', true)
        .maybeSingle();

      if (!plan) {
        console.error('Plan not found:', planTier);
        return new Response("Plan not found", { status: 400, headers: corsHeaders });
      }

      // Process school subscription
      if (scope === 'school' && existingTx.school_id) {
        const startDate = new Date();
        const endDate = new Date(startDate);
        
        if (billing === 'annual') {
          endDate.setFullYear(endDate.getFullYear() + 1);
        } else {
          endDate.setMonth(endDate.getMonth() + 1);
        }

        const subscriptionData = {
          school_id: existingTx.school_id,
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
            price_paid: existingTx.amount,
            transaction_id: m_payment_id,
            pf_payment_id,
            activated_by_payment: true
          }
        };

        // Try to update existing subscription first
        const { data: existing } = await supabase
          .from('subscriptions')
          .select('id')
          .eq('owner_type', 'school')
          .eq('school_id', existingTx.school_id)
          .maybeSingle();

        if (existing) {
          await supabase
            .from('subscriptions')
            .update(subscriptionData)
            .eq('id', existing.id);
        } else {
          await supabase
            .from('subscriptions')
            .insert(subscriptionData);
        }

        // Update preschool subscription tier (legacy)
        await supabase
          .from('preschools')
          .update({ subscription_tier: plan.tier })
          .eq('id', existingTx.school_id);
        
        // CRITICAL: Also update organizations.plan_tier for new RBAC system
        await supabase
          .from('organizations')
          .update({ plan_tier: plan.tier })
          .eq('id', existingTx.school_id);

        // Send email notification (sandbox & production)
        try {
          const { data: schoolData } = await supabase
            .from('preschools')
            .select('name, contact_email')
            .eq('id', existingTx.school_id)
            .single();
          
          if (schoolData?.contact_email) {
            const emailSubject = `✅ Subscription Activated - ${plan.name}`;
            const emailBody = `
              <h2>Payment Successful!</h2>
              <p>Your subscription to <strong>${plan.name}</strong> has been activated.</p>
              <h3>Subscription Details:</h3>
              <ul>
                <li><strong>School:</strong> ${schoolData.name}</li>
                <li><strong>Plan:</strong> ${plan.name} (${plan.tier})</li>
                <li><strong>Billing:</strong> ${billing}</li>
                <li><strong>Amount:</strong> R${amount_gross}</li>
                <li><strong>Transaction ID:</strong> ${m_payment_id}</li>
                <li><strong>PayFast ID:</strong> ${pf_payment_id}</li>
                <li><strong>Start Date:</strong> ${new Date().toLocaleDateString('en-ZA')}</li>
                <li><strong>End Date:</strong> ${new Date(subscriptionData.end_date).toLocaleDateString('en-ZA')}</li>
              </ul>
              <p>Thank you for choosing EduDash Pro!</p>
              <p style="color: #666; font-size: 0.9em;">Mode: ${PAYFAST_MODE}</p>
            `;
            
            // Queue email via notifications-dispatcher
            await supabase.from('notification_queue').insert({
              notification_type: 'email',
              recipient: schoolData.contact_email,
              subject: emailSubject,
              body: emailBody,
              metadata: {
                payment_id: m_payment_id,
                pf_payment_id,
                plan_tier: plan.tier,
                school_id: existingTx.school_id,
                mode: PAYFAST_MODE
              }
            });
            
            console.log('Email notification queued:', schoolData.contact_email);
          }
        } catch (emailError) {
          console.error('Failed to queue email notification:', emailError);
          // Don't fail the webhook if email fails
        }
        
        console.log('School subscription activated:', {
          school_id: existingTx.school_id,
          plan_tier: plan.tier,
          billing,
          updated_tables: ['subscriptions', 'preschools', 'organizations'],
          email_queued: true
        });
      }
      
      // Process user subscription - create a personal school for the user
      else if (scope === 'user' && ownerId) {
        console.log('Processing user subscription - creating personal school');
        
        // For user subscriptions, we need to create a personal school
        // or find the user's existing school
        let userSchoolId = null;
        
        // Check if user already has a school
        const { data: existingSchool } = await supabase
          .from('preschools')
          .select('id')
          .eq('owner_user_id', ownerId)
          .eq('is_personal', true)
          .maybeSingle();
        
        if (existingSchool) {
          userSchoolId = existingSchool.id;
        } else {
          // Create a personal school for the user
          const personalSchool = {
            name: `Personal Account - ${ownerId}`,
            is_personal: true,
            owner_user_id: ownerId,
            subscription_tier: plan.tier,
            metadata: {
              created_by_payment: true,
              payment_id: m_payment_id
            }
          };
          
          const { data: newSchool, error: schoolError } = await supabase
            .from('preschools')
            .insert([personalSchool])
            .select('id')
            .single();
          
          if (schoolError) {
            console.error('Error creating personal school:', schoolError);
            return new Response("Failed to create personal school", { status: 500, headers: corsHeaders });
          }
          
          userSchoolId = newSchool.id;
        }
        
        const startDate = new Date();
        const endDate = new Date(startDate);
        
        if (billing === 'annual') {
          endDate.setFullYear(endDate.getFullYear() + 1);
        } else {
          endDate.setMonth(endDate.getMonth() + 1);
        }

        const subscriptionData = {
          school_id: userSchoolId,
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
            price_paid: existingTx.amount,
            transaction_id: m_payment_id,
            pf_payment_id,
            activated_by_payment: true,
            owner_user_id: ownerId
          }
        };

        // Try to update existing user subscription first
        const { data: existing } = await supabase
          .from('subscriptions')
          .select('id')
          .eq('owner_type', 'user')
          .eq('school_id', userSchoolId)
          .maybeSingle();

        if (existing) {
          const { error: updateError } = await supabase
            .from('subscriptions')
            .update(subscriptionData)
            .eq('id', existing.id);
            
          if (updateError) {
            console.error('Error updating user subscription:', updateError);
          }
        } else {
          const { error: insertError } = await supabase
            .from('subscriptions')
            .insert([subscriptionData]);
            
          if (insertError) {
            console.error('Error creating user subscription:', insertError);
          }
        }
        
        // Update preschool subscription tier (legacy)
        await supabase
          .from('preschools')
          .update({ subscription_tier: plan.tier })
          .eq('id', userSchoolId);
        
        // CRITICAL: Also update organizations.plan_tier for new RBAC system
        await supabase
          .from('organizations')
          .update({ plan_tier: plan.tier })
          .eq('id', userSchoolId);

        // Send email notification for user subscription
        try {
          const emailAddress = payload.email_address;
          
          if (emailAddress) {
            const emailSubject = `✅ Personal Subscription Activated - ${plan.name}`;
            const emailBody = `
              <h2>Payment Successful!</h2>
              <p>Your personal subscription to <strong>${plan.name}</strong> has been activated.</p>
              <h3>Subscription Details:</h3>
              <ul>
                <li><strong>Plan:</strong> ${plan.name} (${plan.tier})</li>
                <li><strong>Billing:</strong> ${billing}</li>
                <li><strong>Amount:</strong> R${amount_gross}</li>
                <li><strong>Transaction ID:</strong> ${m_payment_id}</li>
                <li><strong>PayFast ID:</strong> ${pf_payment_id}</li>
                <li><strong>Start Date:</strong> ${new Date().toLocaleDateString('en-ZA')}</li>
                <li><strong>End Date:</strong> ${new Date(subscriptionData.end_date).toLocaleDateString('en-ZA')}</li>
              </ul>
              <p>Thank you for choosing EduDash Pro!</p>
              <p style="color: #666; font-size: 0.9em;">Mode: ${PAYFAST_MODE}</p>
            `;
            
            // Queue email via notifications-dispatcher
            await supabase.from('notification_queue').insert({
              notification_type: 'email',
              recipient: emailAddress,
              subject: emailSubject,
              body: emailBody,
              metadata: {
                payment_id: m_payment_id,
                pf_payment_id,
                plan_tier: plan.tier,
                user_id: ownerId,
                mode: PAYFAST_MODE
              }
            });
            
            console.log('Email notification queued:', emailAddress);
          }
        } catch (emailError) {
          console.error('Failed to queue email notification:', emailError);
          // Don't fail the webhook if email fails
        }
        
        console.log('User subscription activated:', {
          user_id: ownerId,
          school_id: userSchoolId,
          plan_tier: plan.tier,
          billing,
          updated_tables: ['subscriptions', 'preschools', 'organizations'],
          email_queued: true
        });
      }

      // Handle invoice status update
      const invoiceNumber = (existingTx.metadata as any)?.invoice_number;
      if (invoiceNumber) {
        await supabase
          .from('billing_invoices')
          .update({ 
            status: 'paid', 
            paid_at: new Date().toISOString() 
          })
          .eq('invoice_number', invoiceNumber)
          .eq('school_id', existingTx.school_id);
      }
    }
    
    // Handle failed/cancelled payments
    else if (newStatus === 'cancelled' || newStatus === 'failed') {
      if (existingTx.school_id) {
        const invoiceNumber = (existingTx.metadata as any)?.invoice_number;
        if (invoiceNumber) {
          await supabase
            .from('billing_invoices')
            .update({ status: newStatus })
            .eq('invoice_number', invoiceNumber)
            .eq('school_id', existingTx.school_id);
        }
      }
      
      console.log('Payment failed/cancelled:', {
        m_payment_id,
        status: newStatus,
        payment_status
      });
    }

    console.log('PayFast ITN processed successfully:', {
      m_payment_id,
      status: newStatus,
      pf_payment_id
    });

    // Return 200 quickly so PayFast stops retrying
    return new Response("OK", { status: 200, headers: corsHeaders });
    
  } catch (e) {
    console.error("PayFast webhook handler error:", e);
    return new Response("Server error", { status: 500, headers: corsHeaders });
  }
});