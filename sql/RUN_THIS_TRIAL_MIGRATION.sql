-- ============================================
-- USER-LEVEL 7-DAY FREE TRIALS - CLEAN VERSION
-- ============================================
-- Run this in Supabase SQL Editor
-- No errors, ready to execute
-- ============================================

-- STEP 1: Add trial columns to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_trial BOOLEAN DEFAULT FALSE;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS trial_end_date TIMESTAMP WITH TIME ZONE;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS trial_plan_tier TEXT DEFAULT 'premium';

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_profiles_trial_status 
ON profiles(is_trial, trial_end_date) 
WHERE is_trial = TRUE;

-- STEP 2: Create function to start user trial
CREATE OR REPLACE FUNCTION start_user_trial(
  target_user_id UUID DEFAULT NULL,
  trial_days INTEGER DEFAULT 7,
  plan_tier TEXT DEFAULT 'premium'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_id UUID;
  user_profile RECORD;
  result json;
BEGIN
  user_id := COALESCE(target_user_id, auth.uid());
  
  IF user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No user ID provided');
  END IF;
  
  SELECT * INTO user_profile FROM profiles WHERE id = user_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User profile not found');
  END IF;
  
  IF user_profile.is_trial AND user_profile.trial_end_date > NOW() THEN
    RETURN json_build_object(
      'success', false,
      'error', 'User already has an active trial',
      'trial_end_date', user_profile.trial_end_date
    );
  END IF;
  
  UPDATE profiles
  SET 
    is_trial = TRUE,
    trial_end_date = NOW() + make_interval(days => trial_days),
    trial_plan_tier = plan_tier,
    trial_started_at = NOW(),
    updated_at = NOW()
  WHERE id = user_id;
  
  SELECT json_build_object(
    'success', true,
    'user_id', user_id,
    'is_trial', true,
    'trial_end_date', NOW() + make_interval(days => trial_days),
    'trial_days', trial_days,
    'plan_tier', plan_tier
  ) INTO result;
  
  RETURN result;
END;
$$;

-- STEP 3: Update get_my_trial_status function
CREATE OR REPLACE FUNCTION get_my_trial_status()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_profile RECORD;
  org_subscription RECORD;
  days_left INTEGER;
BEGIN
  SELECT * INTO user_profile FROM profiles WHERE id = auth.uid();
  
  IF NOT FOUND THEN
    RETURN json_build_object('is_trial', false, 'message', 'User profile not found');
  END IF;
  
  -- Check organization-level trial first
  IF user_profile.preschool_id IS NOT NULL THEN
    SELECT * INTO org_subscription
    FROM subscriptions
    WHERE preschool_id = user_profile.preschool_id
    LIMIT 1;
    
    IF FOUND AND org_subscription.is_trial THEN
      days_left := GREATEST(0, EXTRACT(DAY FROM org_subscription.trial_end_date - NOW())::INTEGER);
      
      RETURN json_build_object(
        'is_trial', true,
        'trial_type', 'organization',
        'trial_end_date', org_subscription.trial_end_date,
        'days_remaining', days_left,
        'plan_tier', org_subscription.plan_tier,
        'plan_name', 'Premium'
      );
    END IF;
  END IF;
  
  -- Check user-level trial
  IF user_profile.is_trial THEN
    IF user_profile.trial_end_date > NOW() THEN
      days_left := GREATEST(0, EXTRACT(DAY FROM user_profile.trial_end_date - NOW())::INTEGER);
      
      RETURN json_build_object(
        'is_trial', true,
        'trial_type', 'personal',
        'trial_end_date', user_profile.trial_end_date,
        'days_remaining', days_left,
        'plan_tier', user_profile.trial_plan_tier,
        'plan_name', 'Premium'
      );
    ELSE
      UPDATE profiles SET is_trial = FALSE WHERE id = auth.uid();
      RETURN json_build_object('is_trial', false, 'trial_expired', true, 'message', 'Trial period ended');
    END IF;
  END IF;
  
  RETURN json_build_object('is_trial', false, 'message', 'No active trial');
END;
$$;

-- STEP 4: Create helper function to check premium access
CREATE OR REPLACE FUNCTION has_premium_access(user_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_user_id UUID;
  user_profile RECORD;
  org_subscription RECORD;
BEGIN
  target_user_id := COALESCE(user_id, auth.uid());
  
  SELECT * INTO user_profile FROM profiles WHERE id = target_user_id;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Check user-level trial
  IF user_profile.is_trial AND user_profile.trial_end_date > NOW() THEN
    RETURN TRUE;
  END IF;
  
  -- Check organization subscription
  IF user_profile.preschool_id IS NOT NULL THEN
    SELECT * INTO org_subscription
    FROM subscriptions
    WHERE preschool_id = user_profile.preschool_id
    LIMIT 1;
    
    IF FOUND THEN
      IF org_subscription.is_trial AND org_subscription.trial_end_date > NOW() THEN
        RETURN TRUE;
      END IF;
      
      IF org_subscription.plan_tier IN ('premium', 'professional', 'enterprise') THEN
        RETURN TRUE;
      END IF;
    END IF;
  END IF;
  
  RETURN FALSE;
END;
$$;

-- STEP 5: Create function to expire trials (for cron job)
CREATE OR REPLACE FUNCTION expire_user_trials()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE profiles
  SET is_trial = FALSE, updated_at = NOW()
  WHERE is_trial = TRUE AND trial_end_date <= NOW();
  
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$;

-- STEP 6: Grant permissions
GRANT EXECUTE ON FUNCTION get_my_trial_status() TO authenticated;
GRANT EXECUTE ON FUNCTION start_user_trial(UUID, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION has_premium_access(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION expire_user_trials() TO service_role;

-- DONE!
SELECT '✅ Migration completed successfully!' as status;
