-- Test Users API Compatibility
-- Verify that all expected columns exist for the API call

-- Check users table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check if RLS is enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'users' AND schemaname = 'public';

-- Check RLS policies
SELECT 
  policyname,
  cmd,
  permissive,
  roles
FROM pg_policies 
WHERE tablename = 'users' AND schemaname = 'public';

-- Test the exact columns requested by the API
-- This simulates the API call: users?select=id,email,role,first_name,last_name,avatar_url,created_at,last_login_at,preschool_id,is_active
SELECT 'API_COMPATIBILITY_TEST' as test_type,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'users' AND table_schema = 'public'
      AND column_name IN ('id', 'email', 'role', 'first_name', 'last_name', 
                         'avatar_url', 'created_at', 'last_login_at', 
                         'preschool_id', 'is_active')
      GROUP BY table_name
      HAVING COUNT(*) = 10
    ) 
    THEN 'PASS - All API columns exist'
    ELSE 'FAIL - Missing API columns'
  END as result;