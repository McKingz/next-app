-- Manual Fix for Young Eagles Teacher AI Access
-- Apply this in Supabase Dashboard SQL Editor
-- https://supabase.com/dashboard/project/lvvvjywrmpcqrpvuptdi/sql/new

-- Step 1: Upgrade organization to Pro plan
UPDATE organizations 
SET plan_tier = 'pro'
WHERE id = 'bd5fe69c-8bee-445d-811d-a6db37f0e49b';

-- Step 2: Check if teacher exists in users table (find auth_user_id from profiles)
-- Then create membership using that ID

-- First, let's find the auth_user_id
SELECT 
  p.id as profile_id,
  p.email,
  u.id as user_id_if_exists,
  p.organization_id
FROM profiles p
LEFT JOIN users u ON u.auth_user_id = p.id
WHERE p.id = 'd699bb7d-7b9e-4a2f-9bf3-72e2d1fe7e64';

-- If user_id_if_exists is NULL, we need to create a users record first
-- Otherwise, use that user_id in the INSERT below

-- Step 3: Create organization membership (ONLY if you have the correct user_id from above)
-- Replace 'USER_ID_FROM_ABOVE_QUERY' with the actual user_id
INSERT INTO organization_members (
  id,
  organization_id,
  user_id,
  role,
  seat_status
) VALUES (
  gen_random_uuid(),
  'bd5fe69c-8bee-445d-811d-a6db37f0e49b',
  'USER_ID_FROM_ABOVE_QUERY', -- << REPLACE THIS
  'teacher',
  'active'
)
ON CONFLICT (organization_id, user_id) 
DO UPDATE SET seat_status = 'active';
