-- =====================================================================
-- 14-Day Free Trial Implementation
-- =====================================================================
-- This migration implements automatic 14-day free trials for new schools
-- with soft downgrade to free tier after expiration.
--
-- Features:
-- - Auto-create trial subscription on school registration
-- - Check trial status function
-- - Auto-downgrade expired trials to free tier
-- - Trial expiration notifications
-- =====================================================================

-- =====================================================================
-- PART 1: Helper Functions
-- =====================================================================

-- Function to check if a subscription is in trial period
CREATE OR REPLACE FUNCTION is_trial_active(subscription_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  sub_record subscriptions%ROWTYPE;
BEGIN
  SELECT * INTO sub_record 
  FROM subscriptions 
  WHERE id = subscription_id;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Check if status is trialing and trial hasn't expired
  RETURN sub_record.status = 'trialing' 
    AND sub_record.trial_end_date IS NOT NULL 
    AND sub_record.trial_end_date > NOW();
END;
$$;

-- Function to get days remaining in trial
CREATE OR REPLACE FUNCTION trial_days_remaining(subscription_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  sub_record subscriptions%ROWTYPE;
BEGIN
  SELECT * INTO sub_record 
  FROM subscriptions 
  WHERE id = subscription_id;
  
  IF NOT FOUND OR sub_record.trial_end_date IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Calculate days remaining (floor to get full days)
  RETURN GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (sub_record.trial_end_date - NOW())) / 86400)::integer);
END;
$$;

-- =====================================================================
-- PART 2: Trigger to Auto-Create Trial Subscription
-- =====================================================================

-- Function to create trial subscription for new schools
CREATE OR REPLACE FUNCTION create_trial_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  starter_plan_id uuid;
  free_plan_id uuid;
BEGIN
  -- Get starter plan ID (default trial plan)
  SELECT id INTO starter_plan_id
  FROM subscription_plans
  WHERE tier = 'starter'
  LIMIT 1;
  
  -- Get free plan ID (fallback)
  SELECT id INTO free_plan_id
  FROM subscription_plans
  WHERE tier = 'free'
  LIMIT 1;
  
  -- Create trial subscription if no subscription exists
  IF NOT EXISTS (
    SELECT 1 FROM subscriptions WHERE school_id = NEW.id
  ) THEN
    INSERT INTO subscriptions (
      school_id,
      plan_id,
      status,
      start_date,
      trial_end_date,
      next_billing_date,
      seats_total,
      seats_used
    ) VALUES (
      NEW.id,
      COALESCE(starter_plan_id, free_plan_id), -- Use starter or fallback to free
      'trialing',
      NOW(),
      NOW() + INTERVAL '14 days', -- 14-day trial
      NOW() + INTERVAL '15 days', -- Billing starts after trial
      10, -- Default seat allocation
      0
    );
    
    RAISE NOTICE 'Created 14-day trial subscription for school %', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on preschools table
DROP TRIGGER IF EXISTS trigger_create_trial_subscription ON preschools;
CREATE TRIGGER trigger_create_trial_subscription
  AFTER INSERT ON preschools
  FOR EACH ROW
  EXECUTE FUNCTION create_trial_subscription();

-- =====================================================================
-- PART 3: Trial Expiration Handler
-- =====================================================================

-- Function to handle expired trials (downgrade to free tier)
CREATE OR REPLACE FUNCTION handle_expired_trials()
RETURNS TABLE (
  school_id uuid,
  school_name text,
  action_taken text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  free_plan_id uuid;
  expired_sub_record RECORD;
BEGIN
  -- Get free plan ID
  SELECT id INTO free_plan_id
  FROM subscription_plans
  WHERE tier = 'free'
  LIMIT 1;
  
  IF free_plan_id IS NULL THEN
    RAISE EXCEPTION 'Free plan not found. Cannot downgrade expired trials.';
  END IF;
  
  -- Find and downgrade all expired trials
  FOR expired_sub_record IN
    SELECT 
      s.id as subscription_id,
      s.school_id,
      p.name as school_name,
      s.trial_end_date
    FROM subscriptions s
    INNER JOIN preschools p ON s.school_id = p.id
    WHERE 
      s.status = 'trialing'
      AND s.trial_end_date IS NOT NULL
      AND s.trial_end_date < NOW()
  LOOP
    -- Downgrade to free tier
    UPDATE subscriptions
    SET 
      plan_id = free_plan_id,
      status = 'active', -- Active on free tier
      trial_end_date = NULL, -- Clear trial date
      next_billing_date = NULL, -- Free tier has no billing
      updated_at = NOW()
    WHERE id = expired_sub_record.subscription_id;
    
    -- Return result for notification
    school_id := expired_sub_record.school_id;
    school_name := expired_sub_record.school_name;
    action_taken := 'Downgraded to Free tier';
    RETURN NEXT;
    
    RAISE NOTICE 'Downgraded expired trial for school % (%) to free tier', 
      expired_sub_record.school_name, expired_sub_record.school_id;
  END LOOP;
  
  RETURN;
END;
$$;

-- =====================================================================
-- PART 4: Trial Notification Helper
-- =====================================================================

-- Function to get schools needing trial expiration warnings
CREATE OR REPLACE FUNCTION get_trials_expiring_soon(days_threshold integer DEFAULT 3)
RETURNS TABLE (
  school_id uuid,
  school_name text,
  principal_email text,
  trial_end_date timestamptz,
  days_remaining integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.school_id,
    p.name as school_name,
    prof.email as principal_email,
    s.trial_end_date,
    trial_days_remaining(s.id) as days_remaining
  FROM subscriptions s
  INNER JOIN preschools p ON s.school_id = p.id
  LEFT JOIN profiles prof ON prof.preschool_id = p.id AND prof.role = 'principal'
  WHERE 
    s.status = 'trialing'
    AND s.trial_end_date IS NOT NULL
    AND s.trial_end_date > NOW()
    AND s.trial_end_date <= (NOW() + make_interval(days => days_threshold))
  ORDER BY s.trial_end_date ASC;
END;
$$;

-- =====================================================================
-- PART 5: RPC Functions for Client Access
-- =====================================================================

-- RPC: Get current user's trial status
CREATE OR REPLACE FUNCTION get_my_trial_status()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_preschool_id uuid;
  result json;
BEGIN
  -- Get user's preschool ID
  SELECT preschool_id INTO user_preschool_id
  FROM profiles
  WHERE id = auth.uid();
  
  IF user_preschool_id IS NULL THEN
    RETURN json_build_object(
      'is_trial', false,
      'message', 'No school associated with account'
    );
  END IF;
  
  -- Get subscription info
  SELECT json_build_object(
    'is_trial', s.status = 'trialing',
    'trial_end_date', s.trial_end_date,
    'days_remaining', trial_days_remaining(s.id),
    'plan_tier', sp.tier,
    'plan_name', sp.name
  ) INTO result
  FROM subscriptions s
  INNER JOIN subscription_plans sp ON s.plan_id = sp.id
  WHERE s.school_id = user_preschool_id
  LIMIT 1;
  
  RETURN COALESCE(result, json_build_object(
    'is_trial', false,
    'message', 'No subscription found'
  ));
END;
$$;

-- =====================================================================
-- PART 6: Comments and Documentation
-- =====================================================================

COMMENT ON FUNCTION is_trial_active(uuid) IS 
  'Checks if a subscription is currently in an active trial period';

COMMENT ON FUNCTION trial_days_remaining(uuid) IS 
  'Returns the number of days remaining in a trial period (0 if expired or no trial)';

COMMENT ON FUNCTION handle_expired_trials() IS 
  'Automatically downgrades expired trial subscriptions to free tier. Should be called daily via cron job.';

COMMENT ON FUNCTION get_trials_expiring_soon(integer) IS 
  'Returns list of schools with trials expiring within X days (default 3). Used for sending reminder emails.';

COMMENT ON FUNCTION get_my_trial_status() IS 
  'Returns the current user''s trial status including days remaining. Safe for client-side RPC calls.';

-- =====================================================================
-- PART 7: Grant Permissions
-- =====================================================================

-- Allow authenticated users to check their own trial status
GRANT EXECUTE ON FUNCTION get_my_trial_status() TO authenticated;

-- Restrict admin functions to service role only
REVOKE EXECUTE ON FUNCTION handle_expired_trials() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_trials_expiring_soon(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION handle_expired_trials() TO service_role;
GRANT EXECUTE ON FUNCTION get_trials_expiring_soon(integer) TO service_role;
