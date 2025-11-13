-- CLEAN SLATE RLS RESET - Users and Students Tables Only
-- Purpose: Remove all existing RLS policies on users and students tables
-- Goal: Start fresh with incremental policy implementation
-- Compliance: Maintains WARP.md Non-negotiables while allowing systematic rebuild

BEGIN;

-- ============================================================================
-- SECTION 1: DROP ALL EXISTING POLICIES ON USERS TABLE
-- ============================================================================

-- Drop all known policies on users table
DROP POLICY IF EXISTS users_select_own_data ON public.users;
DROP POLICY IF EXISTS users_select_same_preschool ON public.users;
DROP POLICY IF EXISTS users_insert_own_profile ON public.users;
DROP POLICY IF EXISTS users_update_own_profile ON public.users;
DROP POLICY IF EXISTS users_principal_update ON public.users;
DROP POLICY IF EXISTS "User access control" ON public.users;
DROP POLICY IF EXISTS super_admin_users_access ON public.users;
DROP POLICY IF EXISTS principal_users_access ON public.users;
DROP POLICY IF EXISTS users_own_data ON public.users;
DROP POLICY IF EXISTS superadmin_service_role_access ON public.users;
DROP POLICY IF EXISTS users_rls_read ON public.users;
DROP POLICY IF EXISTS users_rls_write ON public.users;
DROP POLICY IF EXISTS users_table_access ON public.users;

-- Drop any other policies that might exist
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'users' 
        AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.users', policy_record.policyname);
        RAISE NOTICE 'Dropped policy: %', policy_record.policyname;
    END LOOP;
END;
$$;

-- ============================================================================
-- SECTION 2: DROP ALL EXISTING POLICIES ON STUDENTS TABLE
-- ============================================================================

-- Drop all known policies on students table
DROP POLICY IF EXISTS students_select_same_preschool ON public.students;
DROP POLICY IF EXISTS students_insert_same_preschool ON public.students;
DROP POLICY IF EXISTS students_update_same_preschool ON public.students;
DROP POLICY IF EXISTS students_delete_same_preschool ON public.students;
DROP POLICY IF EXISTS superadmin_service_role_access ON public.students;
DROP POLICY IF EXISTS students_rls_read ON public.students;
DROP POLICY IF EXISTS students_rls_write ON public.students;
DROP POLICY IF EXISTS students_table_access ON public.students;

-- Drop any other policies that might exist on students
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'students' 
        AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.students', policy_record.policyname);
        RAISE NOTICE 'Dropped policy: %', policy_record.policyname;
    END LOOP;
END;
$$;

-- ============================================================================
-- SECTION 3: DISABLE RLS TEMPORARILY FOR TESTING
-- ============================================================================

-- Temporarily disable RLS to ensure tables are accessible during rebuild
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.students DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SECTION 4: ENSURE BASIC PERMISSIONS ARE IN PLACE
-- ============================================================================

-- Grant basic permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.students TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- ============================================================================
-- SECTION 5: VERIFICATION AND STATUS
-- ============================================================================

-- Verify all policies have been removed
DO $$
DECLARE
    users_policy_count integer;
    students_policy_count integer;
BEGIN
    SELECT COUNT(*) INTO users_policy_count 
    FROM pg_policies 
    WHERE tablename = 'users' AND schemaname = 'public';
    
    SELECT COUNT(*) INTO students_policy_count 
    FROM pg_policies 
    WHERE tablename = 'students' AND schemaname = 'public';
    
    RAISE NOTICE '✅ Clean Slate RLS Reset Complete';
    RAISE NOTICE '📊 Users table policies remaining: %', users_policy_count;
    RAISE NOTICE '📊 Students table policies remaining: %', students_policy_count;
    RAISE NOTICE '🔓 RLS Status: DISABLED (temporary for systematic rebuild)';
    RAISE NOTICE '✅ Basic permissions granted to authenticated role';
    RAISE NOTICE '';
    RAISE NOTICE '📋 NEXT STEPS:';
    RAISE NOTICE '1. Test basic table access works';
    RAISE NOTICE '2. Create foundation functions for tenant isolation';
    RAISE NOTICE '3. Implement SELECT policy first';
    RAISE NOTICE '4. Test and verify before adding next policy';
    RAISE NOTICE '5. Incrementally add INSERT, UPDATE, DELETE policies';
END;
$$;

-- ============================================================================
-- SECTION 6: LOG THE RESET ACTION
-- ============================================================================

-- Log this action for audit trail
INSERT INTO public.config_kv (key, value, description, is_public)
VALUES (
  'clean_slate_rls_reset_20250919',
  json_build_object(
    'action', 'Clean slate RLS policy reset',
    'tables_affected', json_build_array('users', 'students'),
    'policies_removed', 'ALL existing policies',
    'rls_status', 'DISABLED temporarily',
    'reset_timestamp', now()::text,
    'reason', 'Systematic incremental policy implementation',
    'next_phase', 'Foundation functions and SELECT policies'
  ),
  'Clean slate reset of RLS policies for systematic rebuild',
  FALSE
) ON CONFLICT (key) DO UPDATE SET
  value = excluded.value,
  updated_at = now();

COMMIT;

-- Final verification query
SELECT
  'Clean Slate Reset Complete' AS status,
  'Users and Students tables ready for incremental RLS implementation' AS message,
  now() AS reset_timestamp;
