-- Test Superadmin Dashboard Functionality
-- Verify all functions are working correctly

-- Test 1: Check if superadmin users exist
SELECT 'SUPERADMIN_USERS_TEST' as test_name, 
  COUNT(*) as superadmin_count,
  CASE 
    WHEN COUNT(*) > 0 THEN 'PASS'
    ELSE 'FAIL - No superadmins found'
  END as status
FROM public.users 
WHERE role = 'super_admin' AND is_active = true;

-- Test 2: List all superadmin users
SELECT 'SUPERADMIN_LIST' as test_name, * FROM get_superadmin_users();

-- Test 3: Test superadmin system
SELECT 'SYSTEM_TEST' as test_name, test_superadmin_system() as result;

-- Test 4: Check user table structure for required columns
SELECT 'USER_TABLE_STRUCTURE' as test_name,
  COUNT(*) as total_columns,
  COUNT(*) FILTER (WHERE column_name IN ('auth_user_id', 'avatar_url', 'is_active', 'role')) as required_columns,
  CASE 
    WHEN COUNT(*) FILTER (WHERE column_name IN ('auth_user_id', 'avatar_url', 'is_active', 'role')) = 4 
    THEN 'PASS'
    ELSE 'FAIL - Missing required columns'
  END as status
FROM information_schema.columns 
WHERE table_name = 'users' AND table_schema = 'public';

-- Test 5: Check if the specific user from logs exists
SELECT 'SPECIFIC_USER_TEST' as test_name,
  id,
  email,
  role,
  is_active,
  auth_user_id,
  CASE 
    WHEN role = 'super_admin' AND is_active = true THEN 'PASS - User is active superadmin'
    WHEN role = 'super_admin' AND is_active != true THEN 'INACTIVE - User is superadmin but inactive'
    WHEN role != 'super_admin' THEN 'NOT_SUPERADMIN - User exists but not superadmin'
    ELSE 'UNKNOWN'
  END as status
FROM public.users 
WHERE auth_user_id = 'd2df36d4-74bc-4ffb-883b-036754764265'::uuid;

-- Test 6: Verify RLS policies are working
SELECT 'RLS_POLICIES_TEST' as test_name,
  COUNT(*) as policy_count,
  CASE 
    WHEN COUNT(*) >= 5 THEN 'PASS - RLS policies exist'
    ELSE 'FAIL - Missing RLS policies'
  END as status
FROM pg_policies 
WHERE tablename = 'users' AND schemaname = 'public';