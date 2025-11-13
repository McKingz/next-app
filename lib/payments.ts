import { assertSupabase } from '@/lib/supabase'

/**
 * Input for creating a checkout session
 */
export type CheckoutInput = {
  scope: 'school' | 'user'
  schoolId?: string
  userId?: string
  planTier: string
  billing: 'monthly' | 'annual'
  seats?: number
  return_url?: string
  cancel_url?: string
}

/**
 * Response from checkout creation
 */
export type CheckoutResponse = {
  redirect_url?: string
  error?: string
}

/**
 * Create a checkout session for a subscription plan
 * @param input - Checkout parameters
 * @returns Promise with redirect URL or error
 */
export async function createCheckout(input: CheckoutInput): Promise<CheckoutResponse> {
  // This calls our serverless function which will:
  // 1) Lookup pricing from subscription_plans table
  // 2) Create billing_invoices and payment_transactions
  // 3) Create a PayFast payment request and return a redirect URL
  // 4) Handle enterprise tier by rejecting with "contact_sales_required"
  
  try {
    const { data, error } = await assertSupabase().functions.invoke('payments-create-checkout', {
      body: input as any,
    })
    
    if (error) {
      return {
        error: error.message || 'Failed to start checkout'
      }
    }
    
    return data || { error: 'No response from checkout service' }
    
  } catch (e: any) {
    return {
      error: e?.message || 'Failed to start checkout'
    }
  }
}
