-- ============================================
-- ACTIVATE 7-DAY TRIALS FOR ALL EXISTING PARENTS
-- ============================================
-- Run this AFTER running the main trial migration
-- This will give all existing parents a 7-day Premium trial
-- ============================================

-- STEP 1: Check how many parents will get trials
SELECT 
  COUNT(*) as total_parents,
  COUNT(*) FILTER (WHERE preschool_id IS NULL) as independent_parents,
  COUNT(*) FILTER (WHERE preschool_id IS NOT NULL) as org_linked_parents,
  COUNT(*) FILTER (WHERE is_trial = TRUE) as already_on_trial
FROM profiles
WHERE role = 'parent';

-- ============================================
-- STEP 2: Activate trials for INDEPENDENT parents only
-- ============================================
-- (Organization-linked parents get org-level trials, not personal trials)

UPDATE profiles
SET 
  is_trial = TRUE,
  trial_end_date = NOW() + INTERVAL '7 days',
  trial_plan_tier = 'premium',
  trial_started_at = NOW(),
  updated_at = NOW()
WHERE 
  role = 'parent'
  AND preschool_id IS NULL  -- Only independent parents
  AND (is_trial = FALSE OR is_trial IS NULL)  -- Don't override existing trials
  AND usage_type IN ('independent', 'homeschool', 'supplemental', 'exploring');

-- Get count of affected users
SELECT COUNT(*) as trials_activated
FROM profiles
WHERE 
  role = 'parent'
  AND preschool_id IS NULL
  AND is_trial = TRUE
  AND trial_started_at >= NOW() - INTERVAL '1 minute';

-- ============================================
-- STEP 3: Verify trials were activated
-- ============================================

SELECT 
  u.email,
  p.usage_type,
  p.is_trial,
  p.trial_end_date,
  EXTRACT(DAY FROM p.trial_end_date - NOW()) as days_remaining,
  p.trial_started_at
FROM profiles p
JOIN auth.users u ON u.id = p.id
WHERE 
  p.role = 'parent'
  AND p.preschool_id IS NULL
  AND p.is_trial = TRUE
ORDER BY p.trial_started_at DESC
LIMIT 10;

-- ============================================
-- OPTIONAL: Activate for ALL parents (including org-linked)
-- ============================================
-- WARNING: This gives PERSONAL trials even to org-linked users
-- Only use if you want to give EVERYONE a personal trial
-- (Commented out by default)

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
  AND (is_trial = FALSE OR is_trial IS NULL);

-- Count all activated
SELECT COUNT(*) as all_trials_activated
FROM profiles
WHERE role = 'parent' AND is_trial = TRUE;
*/

-- ============================================
-- STEP 4: Check specific user
-- ============================================

-- Example: Check davecon12martin@outlook.com
SELECT 
  u.email,
  p.usage_type,
  p.preschool_id,
  p.is_trial,
  p.trial_end_date,
  CASE 
    WHEN p.trial_end_date IS NOT NULL 
    THEN EXTRACT(DAY FROM p.trial_end_date - NOW())
    ELSE NULL
  END as days_remaining
FROM auth.users u
JOIN profiles p ON p.id = u.id
WHERE u.email = 'davecon12martin@outlook.com';

-- ============================================
-- SUMMARY
-- ============================================

-- This script:
-- ? Activates 7-day trials for all independent parents
-- ? Skips users who already have trials
-- ? Skips organization-linked parents (they get org trials)
-- ? Sets trial_end_date = NOW() + 7 days
-- ? Sets trial_plan_tier = 'premium'
-- ? Logs trial_started_at for analytics

-- Next Steps:
-- 1. Run STEP 2 to activate trials
-- 2. Run STEP 3 to verify
-- 3. Users will see trial banner on next login
