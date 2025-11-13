import type { SupabaseClient } from '@supabase/supabase-js';

export interface UpdateSubscriptionPlanArgs {
  subscriptionId: string;
  newPlanId: string;
  billingFrequency?: 'monthly' | 'annual' | null;
  seatsTotal?: number | null;
  reason?: string | null;
  metadata?: Record<string, any>;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  tier: string;
  price_monthly: number;
  price_annual: number;
  max_teachers: number;
  max_students: number;
  is_active: boolean;
}

/**
 * Update an existing subscription's plan and related metadata
 */
export async function adminUpdateSubscriptionPlan(
  supabase: SupabaseClient,
  args: UpdateSubscriptionPlanArgs
): Promise<string> {
  const { data, error } = await supabase.rpc('admin_update_subscription_plan', {
    p_subscription_id: args.subscriptionId,
    p_new_plan_id: args.newPlanId,
    p_billing_frequency: args.billingFrequency || null,
    p_seats_total: args.seatsTotal || null,
    p_reason: args.reason || null,
    p_metadata: args.metadata || { /* TODO: Implement */ }
  });

  if (error) throw error;
  return data; // uuid
}

/**
 * List all active subscription plans
 */
export async function listActivePlans(supabase: SupabaseClient): Promise<SubscriptionPlan[]> {
  const { data, error } = await supabase.rpc('public_list_plans');
  
  if (error) throw error;
  return data || [];
}

/**
 * Create a new school subscription (reuses existing RPC)
 */
export async function adminCreateSchoolSubscription(
  supabase: SupabaseClient,
  args: {
    schoolId: string;
    planId: string;
    billingFrequency: 'monthly' | 'annual';
    seatsTotal?: number;
  }
): Promise<string> {
  const { data, error } = await supabase.rpc('admin_create_school_subscription', {
    p_school_id: args.schoolId,
    p_plan_id: args.planId,
    p_billing_frequency: args.billingFrequency,
    p_seats_total: args.seatsTotal || 1
  });

  if (error) throw error;
  return data;
}