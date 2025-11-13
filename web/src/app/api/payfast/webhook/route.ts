import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PAYFAST_MERCHANT_ID = process.env.PAYFAST_MERCHANT_ID || '';
const PAYFAST_MERCHANT_KEY = process.env.PAYFAST_MERCHANT_KEY || '';
const PAYFAST_PASSPHRASE = process.env.PAYFAST_PASSPHRASE || '';

function generateSignature(data: Record<string, any>, passPhrase: string = '') {
  let pfOutput = '';
  for (let key in data) {
    if (data.hasOwnProperty(key) && key !== 'signature') {
      if (data[key] !== '') {
        pfOutput += `${key}=${encodeURIComponent(data[key].toString().trim()).replace(/%20/g, '+')}&`;
      }
    }
  }
  let getString = pfOutput.slice(0, -1);
  if (passPhrase !== '') {
    getString += `&passphrase=${encodeURIComponent(passPhrase.trim()).replace(/%20/g, '+')}`;
  }
  return crypto.createHash('md5').update(getString).digest('hex');
}

export async function POST(request: NextRequest) {
  try {
    // Parse form data from PayFast
    const formData = await request.formData();
    const data: Record<string, any> = {};
    
    formData.forEach((value, key) => {
      data[key] = value.toString();
    });

    console.log('[PayFast Webhook] Received data:', data);

    // Verify signature
    const receivedSignature = data.signature;
    delete data.signature;
    const calculatedSignature = generateSignature(data, PAYFAST_PASSPHRASE);

    if (receivedSignature !== calculatedSignature) {
      console.error('[PayFast Webhook] Invalid signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    // Verify merchant details
    if (data.merchant_id !== PAYFAST_MERCHANT_ID) {
      console.error('[PayFast Webhook] Invalid merchant ID');
      return NextResponse.json({ error: 'Invalid merchant' }, { status: 400 });
    }

    const user_id = data.custom_str1;
    const tier = data.custom_str2;
    const payment_status = data.payment_status;

    console.log('[PayFast Webhook] Processing payment:', { user_id, tier, payment_status });

    // Handle payment success
    if (payment_status === 'COMPLETE') {
      // Update user tier in user_ai_usage table
      const { error: usageError } = await supabaseAdmin
        .from('user_ai_usage')
        .upsert({
          user_id,
          current_tier: tier,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id'
        });

      if (usageError) {
        console.error('[PayFast Webhook] Failed to update user tier:', usageError);
      } else {
        console.log('[PayFast Webhook] Successfully updated user tier to:', tier);
      }

      // Log the payment in subscriptions table (create if doesn't exist)
      const { error: subError } = await supabaseAdmin
        .from('subscriptions')
        .insert({
          user_id,
          tier,
          status: 'active',
          payment_method: 'payfast',
          amount: parseFloat(data.amount_gross),
          payment_id: data.m_payment_id,
          pf_payment_id: data.pf_payment_id,
          subscription_start: new Date().toISOString(),
          metadata: data,
        });

      if (subError && subError.code !== '42P01') { // Ignore table doesn't exist error
        console.error('[PayFast Webhook] Failed to log subscription:', subError);
      }

      return NextResponse.json({ success: true, message: 'Payment processed' });
    }

    // Handle payment cancellation or failure
    if (payment_status === 'CANCELLED' || payment_status === 'FAILED') {
      console.log('[PayFast Webhook] Payment cancelled or failed:', payment_status);
      return NextResponse.json({ success: true, message: 'Payment status recorded' });
    }

    return NextResponse.json({ success: true, message: 'Webhook received' });

  } catch (error) {
    console.error('[PayFast Webhook] Error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
