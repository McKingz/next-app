-- IMMEDIATE FIX: Grant trial to current user (ebarksy)
-- Run this in your Supabase SQL Editor NOW

-- Grant 7-day trial to ebarksy and any recent users without trials
UPDATE profiles
SET 
    subscription_tier = 'basic',
    trial_ends_at = NOW() + INTERVAL '7 days',
    trial_granted_at = NOW(),
    updated_at = NOW()
WHERE (subscription_tier IS NULL OR subscription_tier = 'free' OR subscription_tier = '')
  AND role = 'parent'
  AND created_at > NOW() - INTERVAL '2 days';

-- Verify the fix worked
SELECT 
    email,
    first_name,
    subscription_tier,
    TO_CHAR(trial_ends_at, 'YYYY-MM-DD HH24:MI:SS') as trial_expires,
    ROUND(EXTRACT(EPOCH FROM (trial_ends_at - NOW())) / 86400, 1) as days_remaining,
    CASE 
        WHEN trial_ends_at IS NULL THEN '❌ No trial'
        WHEN trial_ends_at > NOW() THEN '✅ Trial Active'
        ELSE '⚠️ Expired'
    END as status
FROM profiles
WHERE created_at > NOW() - INTERVAL '2 days'
ORDER BY created_at DESC;
