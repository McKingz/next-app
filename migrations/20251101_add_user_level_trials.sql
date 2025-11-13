-- ============================================
-- USER-LEVEL 7-DAY FREE TRIALS
-- ============================================
-- Purpose: Give independent parents 7-day Premium trial
-- Date: 2025-11-01
-- 
-- This allows independent users (homeschool, supplemental, exploring)
-- to try Premium features for 7 days without linking to an organization.

-- ============================================
-- PART 1: Add Trial Columns to Profiles
-- ============================================

-- Add user-level trial tracking
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_trial BOOLEAN DEFAULT FALSE;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS trial_end_date TIMESTAMP WITH TIME ZONE;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS trial_plan_tier TEXT DEFAULT 'premium';

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMP WITH TIME ZONE;

-- Add index for trial queries
CREATE INDEX IF NOT EXISTS idx_profiles_trial_status 
ON profiles(is_trial, trial_end_date) 
WHERE is_trial = TRUE;

COMMENT ON COLUMN profiles.is_trial IS 
  'Whether user is currently in a free trial period (user-level trial for independent parents)';

COMMENT ON COLUMN profiles.trial_end_date IS 
  'When the user trial expires. NULL if no trial or trial ended.';

COMMENT ON COLUMN profiles.trial_plan_tier IS 
  'Which tier the user gets during trial (default: premium)';

COMMENT ON COLUMN profiles.trial_started_at IS 
  'When the user trial began. Used for analytics and trial management.';

-- ============================================
-- PART 2: RPC Function to Start User Trial
-- ============================================

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
  -- Use provided user_id or current auth user
  user_id := COALESCE(target_user_id, auth.uid());
  
  IF user_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'No user ID provided'
    );
  END IF;
  
  -- Get user profile
  SELECT * INTO user_profile
  FROM profiles
  WHERE id = user_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'User profile not found'
    );
  END IF;
  
  -- Check if already on trial
  IF user_profile.is_trial AND user_profile.trial_end_date > NOW() THEN
    RETURN json_build_object(
      'success', false,
      'error', 'User already has an active trial',
      'trial_end_date', user_profile.trial_end_date
    );
  END IF;
  
  -- Start trial
  UPDATE profiles
  SET 
    is_trial = TRUE,
    trial_end_date = NOW() + make_interval(days => trial_days),
    trial_plan_tier = plan_tier,
    trial_started_at = NOW(),
    updated_at = NOW()
  WHERE id = user_id;
  
  -- Return success
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

COMMENT ON FUNCTION start_user_trial IS 
  'Starts a 7-day Premium trial for independent users. Can only be used once per user.';

-- ============================================
-- PART 3: RPC Function to Get Trial Status
-- ============================================

CREATE OR REPLACE FUNCTION get_my_trial_status()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_profile RECORD;
  org_subscription RECORD;
  result json;
  days_left INTEGER;
BEGIN
  -- Get current user's profile
  SELECT * INTO user_profile
  FROM profiles
  WHERE id = auth.uid();
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'is_trial', false,
      'message', 'User profile not found'
    );
  END IF;
  
  -- Check if user is linked to an organization
  IF user_profile.preschool_id IS NOT NULL THEN
    -- Organization-level trial (existing logic)
    SELECT * INTO org_subscription
    FROM subscriptions
    WHERE preschool_id = user_profile.preschool_id
    LIMIT 1;
    
    IF FOUND AND org_subscription.is_trial THEN
      -- Calculate days remaining
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
  
  -- Check for user-level trial (independent users)
  IF user_profile.is_trial THEN
    -- Check if trial is still active
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
      -- Trial expired - mark as ended
      UPDATE profiles
      SET is_trial = FALSE
      WHERE id = auth.uid();
      
      RETURN json_build_object(
        'is_trial', false,
        'trial_expired', true,
        'message', 'Trial period ended'
      );
    END IF;
  END IF;
  
  -- No active trial
  RETURN json_build_object(
    'is_trial', false,
    'message', 'No active trial'
  );
END;
$$;

COMMENT ON FUNCTION get_my_trial_status IS 
  'Returns trial status for current user. Checks both organization-level and user-level trials.';

-- ============================================
-- PART 4: Grant Permissions
-- ============================================

-- Allow authenticated users to check their trial status
GRANT EXECUTE ON FUNCTION get_my_trial_status() TO authenticated;

-- Allow authenticated users to start their own trial
GRANT EXECUTE ON FUNCTION start_user_trial(UUID, INTEGER, TEXT) TO authenticated;

-- ============================================
-- PART 5: Auto-Start Trials for Existing Independent Users
-- ============================================

-- OPTIONAL: Uncomment to give existing independent users a 7-day trial
/*
UPDATE profiles
SET 
  is_trial = TRUE,
  trial_end_date = NOW() + INTERVAL '7 days',
  trial_plan_tier = 'premium',
  trial_started_at = NOW(),
  updated_at = NOW()
WHERE 
  role = 'parent'
  AND preschool_id IS NULL
  AND usage_type IN ('independent', 'homeschool', 'supplemental', 'exploring')
  AND is_trial = FALSE
  AND created_at > NOW() - INTERVAL '30 days'; -- Only recent users
*/

-- ============================================
-- PART 6: Create Cron Job to Expire Trials
-- ============================================

CREATE OR REPLACE FUNCTION expire_user_trials()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  -- Mark expired user trials as inactive
  UPDATE profiles
  SET 
    is_trial = FALSE,
    updated_at = NOW()
  WHERE 
    is_trial = TRUE
    AND trial_end_date <= NOW();
  
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  
  RETURN expired_count;
END;
$$;

COMMENT ON FUNCTION expire_user_trials IS 
  'Marks expired user trials as inactive. Should be run daily via cron job.';

-- Grant to service_role for cron execution
GRANT EXECUTE ON FUNCTION expire_user_trials() TO service_role;

-- ============================================
-- PART 7: Helper Function - Check if User Has Premium Access
-- ============================================

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
  
  -- Get user profile
  SELECT * INTO user_profile
  FROM profiles
  WHERE id = target_user_id;
  
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
      -- Check if on trial or paid plan
      IF org_subscription.is_trial AND org_subscription.trial_end_date > NOW() THEN
        RETURN TRUE;
      END IF;
      
      IF org_subscription.plan_tier IN ('premium', 'professional', 'enterprise') THEN
        RETURN TRUE;
      END IF;
    END IF;
  END IF;
  
  -- No premium access
  RETURN FALSE;
END;
$$;

COMMENT ON FUNCTION has_premium_access IS 
  'Returns true if user has premium access (via trial or paid subscription)';

GRANT EXECUTE ON FUNCTION has_premium_access(UUID) TO authenticated;

-- ============================================
-- PART 8: Migration Log
-- ============================================

-- Log this migration (simplified - no dependency on migration_logs table structure)
DO $$
BEGIN
  RAISE NOTICE '? Migration 20251101_add_user_level_trials completed successfully';
END $$;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

-- Summary:
-- ? Added trial columns to profiles table
-- ? Created start_user_trial() function
-- ? Updated get_my_trial_status() function
-- ? Created expire_user_trials() cron function
-- ? Created has_premium_access() helper function
-- ? Granted necessary permissions
-- ? Logged migration

-- Next Steps:
-- 1. Update signup flow to call start_user_trial()
-- 2. Test trial banner displays correctly
-- 3. Implement feature gating based on has_premium_access()
