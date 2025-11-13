import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const PAYFAST_MERCHANT_ID = process.env.PAYFAST_MERCHANT_ID || '';
const PAYFAST_MERCHANT_KEY = process.env.PAYFAST_MERCHANT_KEY || '';
const PAYFAST_PASSPHRASE = process.env.PAYFAST_PASSPHRASE || '';
const PAYFAST_URL = process.env.NEXT_PUBLIC_PAYFAST_URL || 'https://sandbox.payfast.co.za/eng/process';

function generateSignature(data: Record<string, any>, passPhrase: string = '') {
  // Create parameter string
  let pfOutput = '';
  for (let key in data) {
    if (data.hasOwnProperty(key)) {
      if (data[key] !== '') {
        pfOutput += `${key}=${encodeURIComponent(data[key].toString().trim()).replace(/%20/g, '+')}&`;
      }
    }
  }

  // Remove last ampersand
  let getString = pfOutput.slice(0, -1);
  if (passPhrase !== '') {
    getString += `&passphrase=${encodeURIComponent(passPhrase.trim()).replace(/%20/g, '+')}`;
  }

  return crypto.createHash('md5').update(getString).digest('hex');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, tier, amount, email } = body;

    if (!user_id || !tier || !amount || !email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Create unique payment reference
    const paymentId = `EDP_${tier}_${user_id.slice(0, 8)}_${Date.now()}`;

    // Prepare PayFast data
    const payFastData: Record<string, any> = {
      // Merchant details
      merchant_id: PAYFAST_MERCHANT_ID,
      merchant_key: PAYFAST_MERCHANT_KEY,
      return_url: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/parent/upgrade/success`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/parent/upgrade/cancel`,
      notify_url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/payfast/webhook`,
      
      // Buyer details
      name_first: email.split('@')[0],
      email_address: email,
      
      // Transaction details
      m_payment_id: paymentId,
      amount: amount.toFixed(2),
      item_name: `EduDash Pro ${tier.charAt(0).toUpperCase() + tier.slice(1)} Subscription`,
      item_description: `Monthly subscription to EduDash Pro ${tier} plan`,
      
      // Subscription details (recurring)
      subscription_type: '1', // 1 = Subscription
      recurring_amount: amount.toFixed(2),
      frequency: '3', // 3 = Monthly
      cycles: '0', // 0 = Until cancelled
      
      // Custom fields for our reference
      custom_str1: user_id,
      custom_str2: tier,
    };

    // Generate signature
    const signature = generateSignature(payFastData, PAYFAST_PASSPHRASE);
    payFastData.signature = signature;

    // Create payment URL with query parameters
    const paymentUrl = `${PAYFAST_URL}?${new URLSearchParams(payFastData).toString()}`;

    return NextResponse.json({
      success: true,
      payment_url: paymentUrl,
      payment_id: paymentId,
    });

  } catch (error) {
    console.error('PayFast create payment error:', error);
    return NextResponse.json(
      { error: 'Failed to create payment' },
      { status: 500 }
    );
  }
}
