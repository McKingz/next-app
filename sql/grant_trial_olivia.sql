-- Grant 7-day premium trial to oliviamakunyane@gmail.com
-- Run this via: npx supabase db execute --file sql/grant_trial_olivia.sql

UPDATE profiles
SET 
  is_trial = true,
  trial_plan_tier = 'premium',
  trial_end_date = NOW() + INTERVAL '7 days',
  subscription_tier = 'premium',
  updated_at = NOW()
WHERE email = 'oliviamakunyane@gmail.com';

-- Verify the update
SELECT 
  id,
  email,
  role,
  is_trial,
  trial_plan_tier,
  trial_end_date,
  subscription_tier,
  created_at,
  updated_at
FROM profiles
WHERE email = 'oliviamakunyane@gmail.com';
