-- ========================================
-- Diagnose Seat Revocation Issue
-- ========================================
-- This script helps identify which ID type the RPC expects

-- ========================================
-- STEP 1: Check all teacher IDs
-- ========================================
SELECT 
    t.id as teachers_table_id,
    t.user_id as public_users_id,
    t.auth_user_id as auth_users_id,
    t.email,
    t.first_name || ' ' || t.last_name as teacher_name,
    u.id as confirmed_public_users_id,
    u.auth_user_id as confirmed_auth_id,
    CASE 
        WHEN t.user_id = u.id THEN '✓ Match'
        ELSE '✗ Mismatch!'
    END as id_validation
FROM teachers t
LEFT JOIN users u ON u.id = t.user_id
WHERE t.is_active = true
ORDER BY t.created_at DESC;

-- ========================================
-- STEP 2: Check current seat assignments
-- ========================================
SELECT 
    ss.id as seat_id,
    ss.user_id as seat_user_id_expects_public_users_id,
    ss.assigned_at,
    ss.revoked_at,
    ss.preschool_id,
    u.email,
    u.id as public_users_id,
    u.auth_user_id as auth_users_id,
    t.id as teachers_table_id,
    CASE 
        WHEN ss.revoked_at IS NULL THEN '🟢 Active'
        ELSE '🔴 Revoked'
    END as status
FROM subscription_seats ss
JOIN users u ON u.id = ss.user_id
LEFT JOIN teachers t ON t.user_id = u.id
ORDER BY ss.assigned_at DESC
LIMIT 10;

-- ========================================
-- STEP 3: Check RPC function signature
-- ========================================
-- Shows what the RPC function expects
SELECT 
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments,
    pg_get_function_result(p.oid) as return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'rpc_revoke_teacher_seat'
  AND n.nspname = 'public';

-- ========================================
-- STEP 4: Test what ID type is expected
-- ========================================
-- Check the RPC function source code
SELECT 
    p.proname,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'rpc_revoke_teacher_seat'
  AND n.nspname = 'public';

-- ========================================
-- STEP 5: Identify which ID to use for your teacher
-- ========================================
-- Replace 'teacher@example.com' with actual teacher email
SELECT 
    'Use this ID for revocation →' as instruction,
    t.user_id as CORRECT_ID_FOR_REVOKE_RPC,
    t.email,
    t.first_name || ' ' || t.last_name as name,
    '---' as separator,
    'Other IDs (do not use):' as note,
    t.id as teachers_table_id_DO_NOT_USE,
    t.auth_user_id as auth_id_DO_NOT_USE
FROM teachers t
WHERE t.email = 'teacher@example.com'  -- REPLACE WITH YOUR TEACHER EMAIL
  AND t.is_active = true;

-- ========================================
-- STEP 6: Test revocation manually (SAFE TEST)
-- ========================================
-- First, get the correct ID from Step 5
-- Then test if the RPC works:

-- UNCOMMENT AND REPLACE WITH ACTUAL ID FROM STEP 5:
-- SELECT public.rpc_revoke_teacher_seat('PASTE_public_users_id_HERE'::uuid);

-- ========================================
-- STEP 7: Verify revocation worked
-- ========================================
-- Check if seat was actually revoked
SELECT 
    u.email,
    ss.assigned_at,
    ss.revoked_at,
    ss.revoked_by,
    CASE 
        WHEN ss.revoked_at IS NULL THEN '🟢 Still Active'
        ELSE '🔴 Successfully Revoked'
    END as status,
    NOW() - ss.revoked_at as time_since_revocation
FROM subscription_seats ss
JOIN users u ON u.id = ss.user_id
WHERE u.email = 'teacher@example.com'  -- REPLACE WITH YOUR TEACHER EMAIL
ORDER BY ss.assigned_at DESC
LIMIT 1;

-- ========================================
-- TROUBLESHOOTING QUERIES
-- ========================================

-- If revocation fails with "Cannot find user record":
-- This means the ID type is wrong or doesn't exist
SELECT 
    'Checking if ID exists in different tables' as check_type,
    EXISTS(SELECT 1 FROM teachers WHERE id = 'PASTE_ID_HERE'::uuid) as exists_in_teachers,
    EXISTS(SELECT 1 FROM users WHERE id = 'PASTE_ID_HERE'::uuid) as exists_in_public_users,
    EXISTS(SELECT 1 FROM auth.users WHERE id = 'PASTE_ID_HERE'::uuid) as exists_in_auth_users;

-- If revocation fails with "Permission denied":
-- Check current user's role
SELECT 
    u.email,
    u.role,
    u.preschool_id,
    auth.uid() as current_auth_user_id
FROM users u
WHERE u.auth_user_id = auth.uid();

-- ========================================
-- EXPECTED FLOW
-- ========================================
/*
CORRECT:
1. UI passes `teacher.teacherUserId` (which is `teachers.user_id` = `users.id`)
2. RPC receives `target_user_id` 
3. RPC looks up: SELECT id FROM users WHERE auth_user_id = target_user_id
4. ERROR! Because we passed `users.id` but RPC expects `auth.users.id`

WAIT... Let me check the RPC code more carefully...

Looking at the migration (20250921195500_fix_seat_assignment_preschool_id.sql):
```sql
SELECT id INTO v_target_user_db_id
FROM public.users
WHERE auth_user_id = target_user_id;  -- ← This expects auth.users.id!
```

So the RPC expects `auth.users.id` (from Supabase Auth)
But the UI is passing `users.id` (from public.users table)

SOLUTION:
Either:
A. Change UI to pass `teacher.authUserId` instead of `teacher.teacherUserId`
B. Update RPC to handle both ID types
C. Update RPC to expect `users.id` directly
*/

-- ========================================
-- RECOMMENDED FIX
-- ========================================
-- Check if we should pass auth_user_id or user_id
SELECT 
    'Based on RPC function, we need:' as analysis,
    t.auth_user_id as ID_TO_PASS_TO_RPC,
    t.user_id as CURRENT_ID_BEING_PASSED,
    'Switch from teacher.teacherUserId to teacher.authUserId in UI' as fix_needed
FROM teachers t
WHERE t.email = 'teacher@example.com'
  AND t.is_active = true;
