import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// RevenueCat Webhook Handler
// Purpose: Handle RevenueCat webhook events and sync subscription status to database
// Security: Deploy with --no-verify-jwt; validate RC authorization token

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper function to parse app_user_id to extract tenant info
function parseAppUserId(appUserId: string): { userId: string; preschoolId?: string } {
  // Expected format: "user_${userId}" or "school_${preschoolId}_${userId}"
  if (appUserId.startsWith('school_')) {
    const parts = appUserId.split('_');
    if (parts.length >= 3) {
      const preschoolId = parts[1];
      const userId = parts.slice(2).join('_'); // Handle compound user IDs
      return { userId, preschoolId };
    }
  } else if (appUserId.startsWith('user_')) {
    const userId = appUserId.substring(5); // Remove 'user_' prefix
    return { userId };
  }
  
  // Fallback - treat as raw user ID
  return { userId: appUserId };
}

// Map RevenueCat product IDs to subscription plan tiers
function mapProductIdToTier(productId: string): string | null {
  const productMap: Record<string, string> = {
    'edudash_starter_monthly': 'starter',
    'edudash_starter_annual': 'starter',
    'edudash_basic_monthly': 'basic',
    'edudash_basic_annual': 'basic',
    'edudash_premium_monthly': 'premium',
    'edudash_premium_annual': 'premium',
    'edudash_pro_monthly': 'pro',
    'edudash_pro_annual': 'pro',
  };
  
  return productMap[productId] || null;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const REVENUECAT_WEBHOOK_TOKEN = Deno.env.get("REVENUECAT_WEBHOOK_TOKEN");
    
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { 
      auth: { persistSession: false } 
    });

    // Verify RevenueCat authorization if token is set
    if (REVENUECAT_WEBHOOK_TOKEN) {
      const authHeader = req.headers.get('Authorization');
      const expectedAuth = `Bearer ${REVENUECAT_WEBHOOK_TOKEN}`;
      
      if (authHeader !== expectedAuth) {
        console.error('RevenueCat webhook: Invalid authorization token');
        return new Response("Unauthorized", { status: 401, headers: corsHeaders });
      }
    }

    const payload = await req.json().catch(() => null);
    if (!payload?.event) return new Response("Bad Request", { status: 400, headers: corsHeaders });

    const event = payload.event;
    const eventId = String(event.id);
    const appUserId = String(event.app_user_id || "");
    const eventType = String(event.type);
    const environment = String(event.environment || "UNKNOWN");
    const productId = String(event.product_id || "");

    console.log('RevenueCat webhook event received:', {
      type: eventType,
      id: eventId,
      app_user_id: appUserId,
      product_id: productId,
      environment
    });

    // Parse app_user_id to get user and preschool info
    const { userId, preschoolId } = parseAppUserId(appUserId);

    // Map product ID to subscription tier
    const planTier = mapProductIdToTier(productId);

    if (!planTier && productId) {
      console.warn(`Unknown product ID: ${productId}`);
    }

    // Get plan details from database
    let plan = null;
    if (planTier) {
      const { data } = await supabase
        .from('subscription_plans')
        .select('id, tier, name, max_teachers')
        .eq('tier', planTier)
        .eq('is_active', true)
        .maybeSingle();
      
      plan = data;
    }

    // Determine billing frequency from product ID
    const isAnnual = productId.includes('annual');
    const billingFrequency = isAnnual ? 'annual' : 'monthly';

    // Handle different event types
    switch (eventType) {
      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
      case 'PRODUCT_CHANGE':
        await handleSubscriptionActivation(supabase, {
          userId,
          preschoolId,
          plan,
          planTier,
          billingFrequency,
          event,
        });
        break;

      case 'CANCELLATION':
      case 'EXPIRATION':
        await handleSubscriptionCancellation(supabase, {
          userId,
          preschoolId,
          event,
        });
        break;

      case 'UNCANCELLATION':
        await handleSubscriptionReactivation(supabase, {
          userId,
          preschoolId,
          plan,
          planTier,
          billingFrequency,
          event,
        });
        break;

      case 'NON_RENEWING_PURCHASE':
        // Handle one-time purchases if needed
        console.log('Non-renewing purchase event:', eventId);
        break;

      case 'SUBSCRIBER_ALIAS':
        // Handle user ID changes/aliases
        console.log('Subscriber alias event:', eventId);
        break;

      default:
        console.warn(`Unhandled RevenueCat event type: ${eventType}`);
        break;
    }

    // Log the webhook event for audit purposes (try to use existing table)
    const logData = {
      event_id: eventId,
      app_user_id: appUserId,
      type: eventType,
      environment,
      raw: payload,
      processed: true,
      processed_at: new Date().toISOString(),
    };

    const { error: insertErr } = await supabase
      .from("revenuecat_webhook_events")
      .insert(logData);

    if (insertErr && !String(insertErr.message || "").includes("duplicate")) {
      console.warn("RevenueCat webhook events log error:", insertErr.message);
      // Don't fail the webhook if logging fails
    }

    return new Response("OK", { status: 200, headers: corsHeaders });

  } catch (e) {
    console.error("RevenueCat webhook handler error:", e);
    return new Response("Server error", { status: 500, headers: corsHeaders });
  }
});

// Helper functions for subscription management
async function handleSubscriptionActivation(
  supabase: any,
  { userId, preschoolId, plan, planTier, billingFrequency, event }: any
) {
  console.log('Activating subscription:', {
    userId,
    preschoolId,
    planTier,
    billingFrequency,
    eventType: event.type
  });

  if (!plan) {
    console.error('No plan found for tier:', planTier);
    return;
  }

  const startDate = new Date();
  const endDate = new Date(event.expiration_at_ms || Date.now() + (billingFrequency === 'annual' ? 365 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000));

  const subscriptionData = {
    plan_id: plan.id,
    status: 'active',
    billing_frequency: billingFrequency,
    start_date: startDate.toISOString(),
    end_date: endDate.toISOString(),
    next_billing_date: endDate.toISOString(),
    metadata: {
      plan_name: plan.name,
      revenuecat_transaction_id: event.transaction_id,
      revenuecat_original_transaction_id: event.original_transaction_id,
      revenuecat_product_id: event.product_id,
      activated_by_revenuecat: true,
      environment: event.environment,
    }
  };

  if (preschoolId) {
    // School subscription
    const schoolSubscriptionData = {
      ...subscriptionData,
      school_id: preschoolId,
      owner_type: 'school',
      seats_total: plan.max_teachers || 1,
      seats_used: 0,
    };

    // Try to update existing subscription first
    const { data: existing } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('owner_type', 'school')
      .eq('school_id', preschoolId)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('subscriptions')
        .update(schoolSubscriptionData)
        .eq('id', existing.id);
    } else {
      await supabase
        .from('subscriptions')
        .insert(schoolSubscriptionData);
    }

    // Update preschool subscription tier
    await supabase
      .from('preschools')
      .update({ subscription_tier: planTier })
      .eq('id', preschoolId);

  } else {
    // Individual user subscription - create a personal school
    console.log('Creating personal school for user subscription:', userId);
    
    // Create a minimal personal school for the user
    const personalSchool = {
      name: `Personal Account`,
      email: `user-${userId}@edudash.example.com`,
      phone: '',
      address: '',
      subscription_tier: planTier,
      is_active: true,
      school_type: 'personal',
      tenant_slug: `user-${userId.slice(-8)}`,
      subscription_status: 'active',
      setup_completed: true,
      max_students: 1,
      max_teachers: 1,
      settings: {
        is_personal_account: true,
        owner_user_id: userId,
        created_by_revenuecat: true,
        revenuecat_app_user_id: `user_${userId}`
      }
    };
    
    const { data: newSchool, error: schoolError } = await supabase
      .from('preschools')
      .insert([personalSchool])
      .select('id')
      .single();
    
    if (schoolError) {
      console.error('Error creating personal school for user:', schoolError);
      return;
    }
    
    const userSchoolId = newSchool.id;
    
    // Create subscription for the personal school
    const userSubscriptionData = {
      ...subscriptionData,
      school_id: userSchoolId,
      owner_type: 'user',
      seats_total: 1,
      seats_used: 1,
      metadata: {
        ...subscriptionData.metadata,
        owner_user_id: userId,
        is_personal_subscription: true
      }
    };

    await supabase
      .from('subscriptions')
      .insert(userSubscriptionData);
      
    console.log('Personal subscription created for user:', userId, 'school:', userSchoolId);
  }
}

async function handleSubscriptionCancellation(
  supabase: any,
  { userId, preschoolId, event }: any
) {
  console.log('Cancelling subscription:', {
    userId,
    preschoolId,
    eventType: event.type
  });

  const updateData = {
    status: event.type === 'EXPIRATION' ? 'expired' : 'cancelled',
    updated_at: new Date().toISOString(),
  };

  if (preschoolId) {
    // Cancel school subscription
    await supabase
      .from('subscriptions')
      .update(updateData)
      .eq('owner_type', 'school')
      .eq('school_id', preschoolId);

    // Reset preschool to free tier
    await supabase
      .from('preschools')
      .update({ subscription_tier: 'free' })
      .eq('id', preschoolId);

  } else {
    // Cancel user subscription (find by personal school)
    const { data: userSchool } = await supabase
      .from('preschools')
      .select('id')
      .eq('school_type', 'personal')
      .eq('settings->>owner_user_id', userId)
      .maybeSingle();
      
    if (userSchool) {
      await supabase
        .from('subscriptions')
        .update(updateData)
        .eq('owner_type', 'user')
        .eq('school_id', userSchool.id);
        
      // Reset personal school to free tier
      await supabase
        .from('preschools')
        .update({ subscription_tier: 'free' })
        .eq('id', userSchool.id);
    }
  }
}

async function handleSubscriptionReactivation(
  supabase: any,
  { userId, preschoolId, plan, planTier, billingFrequency, event }: any
) {
  console.log('Reactivating subscription:', {
    userId,
    preschoolId,
    planTier,
    eventType: event.type
  });

  // Same logic as activation
  await handleSubscriptionActivation(supabase, {
    userId,
    preschoolId,
    plan,
    planTier,
    billingFrequency,
    event,
  });
}
