-- ============================================
-- ACTIVATE 7-DAY TRIAL FOR davecon12martin@outlook.com
-- ============================================
-- Run this in Supabase SQL Editor
-- ============================================

-- Step 1: Verify user exists
SELECT 
  u.id,
  u.email,
  p.role,
  p.usage_type,
  p.is_trial,
  p.trial_end_date
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
WHERE u.email = 'davecon12martin@outlook.com';

-- Step 2: Start 7-day Premium trial
SELECT start_user_trial(
  (SELECT id FROM auth.users WHERE email = 'davecon12martin@outlook.com'),
  7,
  'premium'
);

-- Step 3: Verify trial was activated
SELECT 
  u.email,
  p.is_trial,
  p.trial_end_date,
  p.trial_plan_tier,
  EXTRACT(DAY FROM p.trial_end_date - NOW()) as days_remaining
FROM auth.users u
JOIN profiles p ON p.id = u.id
WHERE u.email = 'davecon12martin@outlook.com';

-- ============================================
-- EXPECTED RESULTS
-- ============================================
-- Step 1: Shows current user status (should show is_trial = false or null)
-- Step 2: Returns success JSON with trial details
-- Step 3: Shows is_trial = true, days_remaining = 7
