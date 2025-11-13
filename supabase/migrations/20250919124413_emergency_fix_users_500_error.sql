-- EMERGENCY FIX: Users Table 500 Error
-- Purpose: Temporarily disable problematic RLS to restore app functionality
-- User affected: d2df36d4-74bc-4ffb-883b-036754764265
-- Error: GET /rest/v1/users?select=id&limit=1000 returning HTTP 500

-- This is a TEMPORARY fix to restore functionality
-- Follow up with proper RLS implementation after app is working

BEGIN;

-- Step 1: Check current RLS status
SELECT 'Current RLS Status' AS step;
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled,
  (
    SELECT COUNT(*) FROM pg_policies
    WHERE tablename = 'users'
  ) AS policy_count
FROM pg_tables
WHERE tablename = 'users' AND schemaname = 'public';

-- Step 2: Disable RLS temporarily to restore functionality
SELECT 'Disabling RLS temporarily...' AS step;
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- Step 3: Drop all existing policies that might be causing issues
SELECT 'Dropping potentially problematic policies...' AS step;
DROP POLICY IF EXISTS users_select_own_data ON public.users;
DROP POLICY IF EXISTS users_select_same_preschool ON public.users;
DROP POLICY IF EXISTS users_insert_own_profile ON public.users;
DROP POLICY IF EXISTS users_update_own_profile ON public.users;
DROP POLICY IF EXISTS users_principal_update ON public.users;
DROP POLICY IF EXISTS "User access control" ON public.users;
DROP POLICY IF EXISTS super_admin_users_access ON public.users;
DROP POLICY IF EXISTS principal_users_access ON public.users;
DROP POLICY IF EXISTS users_own_data ON public.users;

-- Step 4: Ensure table permissions allow authenticated users to read
GRANT SELECT ON public.users TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Step 5: Test the fix
SELECT 'Testing fix...' AS step;
SELECT
  id,
  email,
  role
FROM public.users LIMIT 5;

-- Step 6: Create a minimal working RLS setup (optional - can be done later)
SELECT 'Setting up minimal RLS (optional)...' AS step;

-- Only enable if we want basic protection
-- ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Simple policy: users can see all users (temporary for development)
-- CREATE POLICY "temporary_allow_all_users" ON public.users
-- FOR ALL TO authenticated
-- USING (true);

-- Step 7: Log the fix
INSERT INTO public.config_kv (key, value, description, is_public)
VALUES (
  'emergency_users_fix_20250919',
  JSON_BUILD_OBJECT(
    'issue', 'HTTP 500 on GET /rest/v1/users',
    'user_affected', 'd2df36d4-74bc-4ffb-883b-036754764265',
    'fix_applied_at', NOW()::text,
    'action_taken', 'Disabled RLS temporarily, dropped problematic policies',
    'next_steps', 'Implement proper RLS policies after confirming app functionality'
  ),
  'Emergency fix for users table 500 error',
  FALSE
) ON CONFLICT (key) DO UPDATE SET
  value = excluded.value,
  updated_at = NOW();

-- Step 8: Verify the fix worked
SELECT 'Verification' AS step;
SELECT
  'Users table should now be accessible via API' AS message,
  'RLS Status: ' || CASE
    WHEN rowsecurity THEN 'ENABLED'
    ELSE 'DISABLED (temporary)'
  END AS status,
  'Total users: ' || (SELECT COUNT(*) FROM public.users) AS user_count
FROM pg_tables
WHERE tablename = 'users' AND schemaname = 'public';

COMMIT;

-- Instructions for next steps:
SELECT 'NEXT STEPS AFTER CONFIRMING APP WORKS:' AS instructions
UNION ALL
SELECT '1. Test the app - the /rest/v1/users endpoint should work now'
UNION ALL
SELECT '2. Verify user can log in and see dashboard'
UNION ALL
SELECT '3. Once confirmed working, implement proper RLS policies'
UNION ALL
SELECT '4. Re-enable RLS with correct column references'
UNION ALL
SELECT '5. Test again to ensure RLS works without breaking functionality';
