-- Migration: Safe Fix Subscription Plans Table
-- Created: 2025-01-17 19:32:00
-- Description: Update subscription_plans safely without violating foreign keys
-- Strategy: Update existing plans, deactivate unused ones, add quotas

-- =============================================================================
-- 1. FIRST, DEACTIVATE ALL EXISTING PLANS (safe approach)
-- =============================================================================

-- Mark all current plans as inactive first
UPDATE public.subscription_plans SET is_active = FALSE;

-- =============================================================================
-- 2. UPDATE THE 6 ACTIVE PLANS WITH CORRECT DATA
-- =============================================================================

-- Update Free Plan
UPDATE public.subscription_plans
SET
  name = 'Free',
  price_monthly = 0.00,
  price_annual = 0.00,
  features
  = '["Basic lessons", "Up to 50 students", "Parent-teacher messaging", "Mobile app access", "Ads on non-learning pages"]'::jsonb,
  ai_quota_monthly = 10,
  max_students = 50,
  max_teachers = 1,
  is_active = TRUE,
  tier = 'free',
  currency = 'ZAR',
  updated_at = now()
WHERE id = '7045bf4d-12fa-443b-89f8-5d7d835eebdb';

-- Update Starter Plan
UPDATE public.subscription_plans
SET
  name = 'Starter',
  price_monthly = 49.00,
  price_annual = 490.00,
  features
  = '["5 AI lessons per day", "Up to 100 students", "Advanced progress tracking", "Parent-teacher messaging", "No ads"]'::jsonb,
  ai_quota_monthly = 50,
  max_students = 100,
  max_teachers = 2,
  is_active = TRUE,
  tier = 'starter',
  currency = 'ZAR',
  updated_at = now()
WHERE id = '611b4a1a-0a32-4961-b31a-72759d193843';

-- Update Basic Plan
UPDATE public.subscription_plans
SET
  name = 'Basic',
  price_monthly = 299.00,
  price_annual = 2990.00,
  features
  = '["Advanced AI lesson generation", "Up to 200 students", "Advanced analytics & insights", "AI homework grading", "Priority support"]'::jsonb,
  ai_quota_monthly = 150,
  max_students = 200,
  max_teachers = 4,
  is_active = TRUE,
  tier = 'basic',
  currency = 'ZAR',
  updated_at = now()
WHERE id = '54cf2955-c4bb-4bf7-8d8d-18d097f3e2f8';

-- Update Premium Plan
UPDATE public.subscription_plans
SET
  name = 'Premium',
  price_monthly = 499.00,
  price_annual = 4990.00,
  features
  = '["Unlimited AI lesson generation", "Up to 400 students", "Advanced analytics & insights", "AI homework grading", "Custom school branding", "Priority support"]'::jsonb,
  ai_quota_monthly = 300,
  max_students = 400,
  max_teachers = 8,
  is_active = TRUE,
  tier = 'premium',
  currency = 'ZAR',
  updated_at = now()
WHERE id = 'ec24e5d4-6445-4be1-a789-0cdf9f1aa910';

-- Update Pro Plan
UPDATE public.subscription_plans
SET
  name = 'Pro',
  price_monthly = 899.00,
  price_annual = 8990.00,
  features
  = '["Unlimited AI lesson generation", "Up to 800 students", "Advanced analytics & insights", "AI homework grading", "Custom school branding", "Advanced teacher management", "AI-powered insights", "Priority support"]'::jsonb,
  ai_quota_monthly = 500,
  max_students = 800,
  max_teachers = 12,
  is_active = TRUE,
  tier = 'pro',
  currency = 'ZAR',
  updated_at = now()
WHERE id = '6a68726d-d0dc-4423-9ea3-665ce75d4136';

-- Update Enterprise Plan
UPDATE public.subscription_plans
SET
  name = 'Enterprise',
  price_monthly = 1999.00,
  price_annual = 19990.00,
  features
  = '["Unlimited everything", "Up to 2000 students", "Multi-school management", "Advanced AI tutoring", "Predictive analytics", "Enterprise security", "Dedicated support", "Custom integrations"]'::jsonb,
  ai_quota_monthly = 1000,
  max_students = 2000,
  max_teachers = 50,
  is_active = TRUE,
  tier = 'enterprise',
  currency = 'ZAR',
  updated_at = now()
WHERE id = 'd3398e33-9c8b-4573-b2d1-735eda6391da';

-- =============================================================================
-- 3. REMOVE THE REDUNDANT BILLING_PLANS TABLE (IF IT EXISTS)
-- =============================================================================

DROP TABLE IF EXISTS public.billing_plans CASCADE;

-- =============================================================================
-- 4. CREATE SUBSCRIPTION USAGE TRACKING TABLE
-- =============================================================================

-- Create a table to track subscription usage and quotas
CREATE TABLE IF NOT EXISTS public.subscription_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.subscriptions (id) ON DELETE CASCADE,
  usage_type text NOT NULL CHECK (usage_type IN ('ai_generations', 'students', 'teachers', 'storage')),
  current_usage integer NOT NULL DEFAULT 0,
  quota_limit integer, -- NULL means unlimited
  period_start timestamptz NOT NULL DEFAULT date_trunc('month', now()),
  period_end timestamptz NOT NULL DEFAULT (date_trunc('month', now()) + interval '1 month'),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Ensure one record per subscription per usage type per period
  UNIQUE (subscription_id, usage_type, period_start)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_subscription_usage_subscription_type
ON public.subscription_usage (subscription_id, usage_type);

CREATE INDEX IF NOT EXISTS idx_subscription_usage_period
ON public.subscription_usage (period_start, period_end);

-- Enable RLS
ALTER TABLE public.subscription_usage ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for subscription usage
CREATE POLICY "Users can view their subscription usage"
ON public.subscription_usage FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.subscriptions AS s
    INNER JOIN public.profiles AS p ON p.auth_user_id = auth.uid()
    WHERE
      s.id = subscription_id
      AND (p.role = 'superadmin' OR s.school_id = p.preschool_id)
  )
);

-- =============================================================================
-- 5. CREATE QUOTA MANAGEMENT FUNCTIONS
-- =============================================================================

-- Function to check if a subscription has quota available
CREATE OR REPLACE FUNCTION public.check_subscription_quota(
  p_subscription_id uuid,
  p_usage_type text,
  p_requested_amount integer DEFAULT 1
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_usage integer;
    v_quota_limit integer;
    v_plan_quota integer;
BEGIN
    -- Get current usage for this period
    SELECT current_usage, quota_limit INTO v_current_usage, v_quota_limit
    FROM public.subscription_usage
    WHERE subscription_id = p_subscription_id
    AND usage_type = p_usage_type
    AND period_start <= now()
    AND period_end > now();
    
    -- If no usage record exists, create one based on the plan
    IF v_current_usage IS NULL THEN
        -- Get quota from subscription plan
        SELECT 
            CASE p_usage_type
                WHEN 'ai_generations' THEN sp.ai_quota_monthly
                WHEN 'students' THEN sp.max_students
                WHEN 'teachers' THEN sp.max_teachers
                ELSE NULL
            END
        INTO v_plan_quota
        FROM public.subscriptions s
        JOIN public.subscription_plans sp ON sp.id = s.plan_id
        WHERE s.id = p_subscription_id;
        
        -- Create usage record
        INSERT INTO public.subscription_usage (
            subscription_id, usage_type, current_usage, quota_limit
        ) VALUES (
            p_subscription_id, p_usage_type, 0, v_plan_quota
        );
        
        v_current_usage := 0;
        v_quota_limit := v_plan_quota;
    END IF;
    
    -- Check if there's enough quota (NULL quota_limit means unlimited)
    IF v_quota_limit IS NULL THEN
        RETURN true;
    END IF;
    
    RETURN (v_current_usage + p_requested_amount) <= v_quota_limit;
END;
$$;

-- Function to increment subscription usage
CREATE OR REPLACE FUNCTION public.increment_subscription_usage(
  p_subscription_id uuid,
  p_usage_type text,
  p_amount integer DEFAULT 1
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_has_quota boolean;
BEGIN
    -- Check if quota is available
    SELECT public.check_subscription_quota(p_subscription_id, p_usage_type, p_amount)
    INTO v_has_quota;
    
    IF NOT v_has_quota THEN
        RETURN false;
    END IF;
    
    -- Increment usage
    UPDATE public.subscription_usage
    SET 
        current_usage = current_usage + p_amount,
        updated_at = now()
    WHERE subscription_id = p_subscription_id
    AND usage_type = p_usage_type
    AND period_start <= now()
    AND period_end > now();
    
    RETURN true;
END;
$$;

-- Function to reset monthly quotas (to be called by cron job)
CREATE OR REPLACE FUNCTION public.reset_monthly_quotas()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Reset usage for the new month
    UPDATE public.subscription_usage
    SET current_usage = 0,
        period_start = date_trunc('month', now()),
        period_end = date_trunc('month', now()) + interval '1 month',
        updated_at = now()
    WHERE period_end <= now();
END;
$$;

-- =============================================================================
-- 6. CREATE UPDATE TRIGGER FOR SUBSCRIPTION_USAGE
-- =============================================================================

-- Add updated_at trigger to subscription_usage
CREATE TRIGGER handle_updated_at
BEFORE UPDATE ON public.subscription_usage
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================================================
-- 7. VERIFY THE UPDATED PLANS
-- =============================================================================

-- Display the updated subscription plans for verification
DO $$
DECLARE
    plan_record RECORD;
    inactive_count integer;
BEGIN
    RAISE NOTICE '=============================================================================';
    RAISE NOTICE 'UPDATED SUBSCRIPTION PLANS (SAFE UPDATE APPROACH)';
    RAISE NOTICE '=============================================================================';
    
    -- Show active plans
    RAISE NOTICE 'ACTIVE PLANS:';
    FOR plan_record IN 
        SELECT name, price_monthly, price_annual, ai_quota_monthly, max_teachers, max_students, tier, id
        FROM public.subscription_plans 
        WHERE is_active = true
        ORDER BY price_monthly 
    LOOP
        RAISE NOTICE '✅ % (%) - Monthly: R% | Annual: R% | AI Quota: %/month | % teachers, % students | ID: %', 
            plan_record.name,
            plan_record.tier,
            plan_record.price_monthly,
            plan_record.price_annual,
            COALESCE(plan_record.ai_quota_monthly::text, 'unlimited'),
            plan_record.max_teachers,
            plan_record.max_students,
            plan_record.id;
    END LOOP;
    
    -- Count inactive plans
    SELECT count(*) INTO inactive_count 
    FROM public.subscription_plans 
    WHERE is_active = false;
    
    RAISE NOTICE '';
    RAISE NOTICE 'INACTIVE PLANS: % (preserved for foreign key integrity)', inactive_count;
    
    RAISE NOTICE '=============================================================================';
    RAISE NOTICE 'Subscription plans updated safely with quotas and usage tracking!';
    RAISE NOTICE '=============================================================================';
END $$;
