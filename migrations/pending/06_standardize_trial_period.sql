-- ================================================================
-- Standardize Trial Period to 7 Days
-- ================================================================
-- Creates a single source of truth for trial duration
-- and updates all trial-related functions
-- Created: 2025-10-31
-- ================================================================

-- ================================================================
-- 1. Create configuration table for trial settings
-- ================================================================

CREATE TABLE IF NOT EXISTS public.system_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert trial configuration
INSERT INTO public.system_config (key, value, description)
VALUES 
  ('trial_settings', 
   '{"duration_days": 7, "grace_period_days": 1, "auto_convert_to": "free"}'::jsonb,
   'Trial subscription settings')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value, updated_at = NOW();

COMMENT ON TABLE public.system_config IS 'System-wide configuration settings';

-- ================================================================
-- 2. Create helper function to get trial duration
-- ================================================================

CREATE OR REPLACE FUNCTION public.get_trial_duration_days()
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
  SELECT (value->>'duration_days')::INTEGER 
  FROM public.system_config 
  WHERE key = 'trial_settings';
$$;

COMMENT ON FUNCTION public.get_trial_duration_days IS 'Returns the configured trial duration in days';

-- ================================================================
-- 3. Update create_trial_subscription function
-- ================================================================

-- Drop all existing versions of the function to avoid conflicts
DROP FUNCTION IF EXISTS public.create_trial_subscription() CASCADE;
DROP FUNCTION IF EXISTS public.create_trial_subscription(UUID) CASCADE;

-- Create the new version with clear signature
CREATE OR REPLACE FUNCTION public.create_trial_subscription(p_school_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  starter_plan_id UUID;
  trial_days INTEGER;
  grace_days INTEGER;
  subscription_id UUID;
BEGIN
  -- Get trial configuration
  SELECT 
    (value->>'duration_days')::INTEGER,
    (value->>'grace_period_days')::INTEGER
  INTO trial_days, grace_days
  FROM public.system_config
  WHERE key = 'trial_settings';
  
  -- Default to 7 days if config not found
  trial_days := COALESCE(trial_days, 7);
  grace_days := COALESCE(grace_days, 1);

  -- Get starter plan
  SELECT id INTO starter_plan_id
  FROM public.subscription_plans
  WHERE tier = 'starter'
  LIMIT 1;

  IF starter_plan_id IS NULL THEN
    RAISE EXCEPTION 'Starter plan not found';
  END IF;

  -- Create trial subscription
  INSERT INTO public.subscriptions (
    school_id,
    plan_id,
    status,
    start_date,
    trial_end_date,
    next_billing_date,
    created_at
  ) VALUES (
    p_school_id,
    starter_plan_id,
    'trialing',
    NOW(),
    NOW() + (trial_days || ' days')::INTERVAL,
    NOW() + ((trial_days + grace_days) || ' days')::INTERVAL,
    NOW()
  )
  RETURNING id INTO subscription_id;

  RETURN subscription_id;
END;
$$;

COMMENT ON FUNCTION public.create_trial_subscription IS 'Creates a trial subscription using configured duration';

-- ================================================================
-- 3b. Create trigger function for automatic trial creation
-- ================================================================

CREATE OR REPLACE FUNCTION public.create_trial_subscription_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create trial subscription for new preschool
  PERFORM create_trial_subscription(NEW.id);
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.create_trial_subscription_trigger IS 'Trigger function to auto-create trial subscriptions for new preschools';

-- Recreate trigger if it was dropped by CASCADE
DROP TRIGGER IF EXISTS trigger_create_trial_subscription ON preschools;
CREATE TRIGGER trigger_create_trial_subscription
  AFTER INSERT ON preschools
  FOR EACH ROW
  EXECUTE FUNCTION create_trial_subscription_trigger();

-- ================================================================
-- 4. Create function to check if trial is active
-- ================================================================

-- Drop existing versions
DROP FUNCTION IF EXISTS public.is_trial_active(UUID) CASCADE;

CREATE OR REPLACE FUNCTION public.is_trial_active(p_school_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.subscriptions
    WHERE school_id = p_school_id
    AND status = 'trialing'
    AND trial_end_date > NOW()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_trial_active(UUID) TO authenticated;

-- ================================================================
-- 5. Create function to get trial days remaining
-- ================================================================

-- Drop existing version
DROP FUNCTION IF EXISTS public.get_trial_days_remaining(UUID) CASCADE;

CREATE OR REPLACE FUNCTION public.get_trial_days_remaining(p_school_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
  SELECT 
    GREATEST(0, EXTRACT(DAY FROM (trial_end_date - NOW()))::INTEGER)
  FROM public.subscriptions
  WHERE school_id = p_school_id
  AND status = 'trialing'
  AND trial_end_date > NOW()
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_trial_days_remaining(UUID) TO authenticated;

-- ================================================================
-- 6. Update user subscriptions function (for parents)
-- ================================================================

-- Drop existing version if any
DROP FUNCTION IF EXISTS public.create_user_trial_subscription(UUID) CASCADE;

-- Create the user trial subscription function
CREATE OR REPLACE FUNCTION public.create_user_trial_subscription(p_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  starter_plan_id UUID;
  trial_days INTEGER;
  grace_days INTEGER;
  subscription_id UUID;
BEGIN
  -- Get trial configuration
  SELECT 
    (value->>'duration_days')::INTEGER,
    (value->>'grace_period_days')::INTEGER
  INTO trial_days, grace_days
  FROM public.system_config
  WHERE key = 'trial_settings';
  
  trial_days := COALESCE(trial_days, 7);
  grace_days := COALESCE(grace_days, 1);

  -- Get parent starter plan
  SELECT id INTO starter_plan_id
  FROM public.subscription_plans
  WHERE name = 'Parent Starter'
  LIMIT 1;

  IF starter_plan_id IS NULL THEN
    -- Fallback to any starter plan
    SELECT id INTO starter_plan_id
    FROM public.subscription_plans
    WHERE tier = 'starter'
    LIMIT 1;
  END IF;

  IF starter_plan_id IS NULL THEN
    RAISE EXCEPTION 'No starter plan found';
  END IF;

  -- Create trial subscription (if user_subscriptions table exists)
  BEGIN
    INSERT INTO public.user_subscriptions (
      user_id,
      subscription_plan_id,
      status,
      trial_start_date,
      trial_end_date,
      next_billing_date,
      auto_renew,
      created_at
    ) VALUES (
      p_user_id,
      starter_plan_id,
      'trial',
      NOW(),
      NOW() + (trial_days || ' days')::INTERVAL,
      NOW() + ((trial_days + grace_days) || ' days')::INTERVAL,
      false,
      NOW()
    )
    RETURNING id INTO subscription_id;
  EXCEPTION WHEN undefined_table THEN
    -- Table doesn't exist yet, return null
    RETURN NULL;
  END;

  RETURN subscription_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_user_trial_subscription(UUID) TO authenticated;

-- ================================================================
-- 7. Add trial_end_date to user_subscriptions if it doesn't exist
-- ================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_subscriptions') THEN
    -- Add trial_end_date column if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'user_subscriptions' 
      AND column_name = 'trial_end_date'
    ) THEN
      ALTER TABLE public.user_subscriptions 
      ADD COLUMN trial_end_date TIMESTAMPTZ;
      
      RAISE NOTICE 'Added trial_end_date column to user_subscriptions';
    END IF;
    
    -- Add trial_start_date column if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'user_subscriptions' 
      AND column_name = 'trial_start_date'
    ) THEN
      ALTER TABLE public.user_subscriptions 
      ADD COLUMN trial_start_date TIMESTAMPTZ;
      
      RAISE NOTICE 'Added trial_start_date column to user_subscriptions';
    END IF;
  END IF;
END $$;

-- ================================================================
-- VERIFICATION
-- ================================================================

DO $$
DECLARE
  trial_days INTEGER;
BEGIN
  SELECT get_trial_duration_days() INTO trial_days;
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ Trial period standardization complete!';
  RAISE NOTICE '   - Configured trial duration: % days', trial_days;
  RAISE NOTICE '   - Helper functions created';
  RAISE NOTICE '   - User subscriptions updated';
  RAISE NOTICE '';
  RAISE NOTICE '📝 To change trial duration:';
  RAISE NOTICE '   UPDATE system_config SET value = jsonb_set(value, ''{duration_days}'', ''14'') WHERE key = ''trial_settings'';';
END $$;
