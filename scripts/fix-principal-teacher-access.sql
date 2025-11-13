-- Fix Principal Access to Teachers in Users Table
-- Date: 2025-09-19
-- Purpose: Fix RLS policies to allow principals to load/manage teachers in their school
-- Issue: Principal getting 400 error when trying to PATCH /users

BEGIN;

-- ============================================================================
-- PART 1: CHECK CURRENT RLS STATUS AND POLICIES
-- ============================================================================

-- Display current RLS status for users table
SELECT 
  schemaname, 
  tablename, 
  rowsecurity as rls_enabled,
  forcerowsecurity as force_rls
FROM pg_tables 
WHERE tablename = 'users' AND schemaname = 'public';

-- Display current policies on users table
SELECT 
  policyname,
  cmd,
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'users'
ORDER BY cmd, policyname;

-- ============================================================================
-- PART 2: ENSURE USERS TABLE HAS REQUIRED COLUMNS
-- ============================================================================

-- Add missing columns if they don't exist
DO $$
BEGIN
  -- Add auth_user_id if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' 
    AND column_name = 'auth_user_id' 
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.users ADD COLUMN auth_user_id uuid REFERENCES auth.users(id);
    RAISE NOTICE 'Added auth_user_id column to users table';
  END IF;

  -- Add organization_id if missing (might be called preschool_id in some schemas)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' 
    AND column_name = 'organization_id' 
    AND table_schema = 'public'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' 
    AND column_name = 'preschool_id' 
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.users ADD COLUMN organization_id uuid;
    RAISE NOTICE 'Added organization_id column to users table';
  END IF;

  -- Add is_active if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' 
    AND column_name = 'is_active' 
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.users ADD COLUMN is_active boolean DEFAULT true;
    RAISE NOTICE 'Added is_active column to users table';
  END IF;
END $$;

-- ============================================================================
-- PART 3: ENABLE RLS AND DROP PROBLEMATIC POLICIES
-- ============================================================================

-- Enable RLS on users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies that might be too restrictive
DROP POLICY IF EXISTS "users_select_own_data" ON public.users;
DROP POLICY IF EXISTS "users_select_same_preschool" ON public.users;
DROP POLICY IF EXISTS "users_select_same_organization" ON public.users;
DROP POLICY IF EXISTS "users_insert_own_profile" ON public.users;
DROP POLICY IF EXISTS "users_update_own_profile" ON public.users;
DROP POLICY IF EXISTS "users_principal_update" ON public.users;
DROP POLICY IF EXISTS "principal_users_access" ON public.users;
DROP POLICY IF EXISTS "superadmin_users_access" ON public.users;

-- ============================================================================
-- PART 4: CREATE COMPREHENSIVE RLS POLICIES FOR USERS TABLE
-- ============================================================================

-- Policy 1: Super admin can do everything
CREATE POLICY "superadmin_full_access"
ON public.users FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users su
    WHERE su.auth_user_id = auth.uid()
    AND su.role = 'super_admin'
    AND su.is_active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users su
    WHERE su.auth_user_id = auth.uid()
    AND su.role = 'super_admin'
    AND su.is_active = true
  )
);

-- Policy 2: Users can view and update their own data
CREATE POLICY "users_own_data"
ON public.users FOR ALL
TO authenticated
USING (auth_user_id = auth.uid())
WITH CHECK (auth_user_id = auth.uid());

-- Policy 3: Principals can view and update users in their organization
CREATE POLICY "principal_school_access"
ON public.users FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users principal
    WHERE principal.auth_user_id = auth.uid()
    AND principal.role IN ('principal', 'principal_admin')
    AND principal.is_active = true
    AND (
      -- Match by organization_id
      (principal.organization_id IS NOT NULL 
       AND users.organization_id = principal.organization_id)
      OR
      -- Match by preschool_id (if using preschool schema)
      (principal.preschool_id IS NOT NULL 
       AND users.preschool_id = principal.preschool_id)
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users principal
    WHERE principal.auth_user_id = auth.uid()
    AND principal.role IN ('principal', 'principal_admin')
    AND principal.is_active = true
    AND (
      -- Match by organization_id
      (principal.organization_id IS NOT NULL 
       AND users.organization_id = principal.organization_id)
      OR
      -- Match by preschool_id
      (principal.preschool_id IS NOT NULL 
       AND users.preschool_id = principal.preschool_id)
    )
  )
);

-- Policy 4: Teachers can view users in their organization (read-only for colleagues)
CREATE POLICY "teacher_school_view"
ON public.users FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users teacher
    WHERE teacher.auth_user_id = auth.uid()
    AND teacher.role = 'teacher'
    AND teacher.is_active = true
    AND (
      -- Match by organization_id
      (teacher.organization_id IS NOT NULL 
       AND users.organization_id = teacher.organization_id)
      OR
      -- Match by preschool_id
      (teacher.preschool_id IS NOT NULL 
       AND users.preschool_id = teacher.preschool_id)
    )
  )
);

-- ============================================================================
-- PART 5: CREATE HELPER FUNCTION FOR ORGANIZATION MATCHING
-- ============================================================================

-- Function to get current user's organization ID (handles both org and preschool schemas)
CREATE OR REPLACE FUNCTION public.get_current_user_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    organization_id,
    preschool_id
  )
  FROM public.users 
  WHERE auth_user_id = auth.uid()
  AND is_active = true
  LIMIT 1;
$$;

-- Function to check if user can manage another user
CREATE OR REPLACE FUNCTION public.can_manage_user(target_auth_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users current_user, public.users target_user
    WHERE current_user.auth_user_id = auth.uid()
    AND target_user.auth_user_id = target_auth_user_id
    AND current_user.is_active = true
    AND (
      -- Super admin can manage anyone
      current_user.role = 'super_admin'
      OR
      -- Self management
      current_user.auth_user_id = target_user.auth_user_id
      OR
      -- Principal can manage users in their organization
      (
        current_user.role IN ('principal', 'principal_admin')
        AND (
          (current_user.organization_id IS NOT NULL 
           AND target_user.organization_id = current_user.organization_id)
          OR
          (current_user.preschool_id IS NOT NULL 
           AND target_user.preschool_id = current_user.preschool_id)
        )
      )
    )
  );
$$;

-- ============================================================================
-- PART 6: GRANT PERMISSIONS
-- ============================================================================

-- Grant basic permissions to authenticated users
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_user_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_user(uuid) TO authenticated;

-- Grant usage on sequences if they exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name LIKE '%users%id%seq%') THEN
    GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
  END IF;
END $$;

-- ============================================================================
-- PART 7: CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

-- Index on auth_user_id for fast auth lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_auth_user_id
ON public.users (auth_user_id);

-- Index on organization_id for tenant isolation
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_organization_id
ON public.users (organization_id) WHERE organization_id IS NOT NULL;

-- Index on preschool_id for tenant isolation (if using preschool schema)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_preschool_id
ON public.users (preschool_id) WHERE preschool_id IS NOT NULL;

-- Index on role for role-based queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role_active
ON public.users (role, is_active) WHERE is_active = true;

-- ============================================================================
-- PART 8: VERIFICATION QUERIES
-- ============================================================================

-- Test current user can see their own profile
SELECT 'Testing own profile access...' as test_description;
SELECT 
  id,
  email,
  role,
  COALESCE(organization_id::text, preschool_id::text, 'No org') as org_id,
  is_active
FROM public.users 
WHERE auth_user_id = auth.uid()
LIMIT 1;

-- Test organization matching function
SELECT 'Testing organization ID function...' as test_description;
SELECT public.get_current_user_org_id() as current_user_org_id;

-- Count users in same organization (for principals)
SELECT 'Testing organization user count...' as test_description;
SELECT COUNT(*) as users_in_org
FROM public.users 
WHERE COALESCE(organization_id, preschool_id) = public.get_current_user_org_id();

-- Display final policy status
SELECT 'Final RLS policy status:' as status;
SELECT 
  policyname,
  cmd,
  permissive
FROM pg_policies 
WHERE tablename = 'users'
ORDER BY cmd, policyname;

COMMIT;

-- ============================================================================
-- USAGE NOTES:
-- ============================================================================

/*
This fix addresses the principal access issue by:

1. Ensuring the users table has proper columns (auth_user_id, organization_id/preschool_id, is_active)
2. Creating comprehensive RLS policies that allow:
   - Super admins: Full access to all users
   - Users: Access to their own data
   - Principals: Full access to users in their organization/preschool
   - Teachers: Read access to users in their organization/preschool
3. Adding helper functions for organization matching
4. Adding performance indexes

Key features:
- Handles both organization_id and preschool_id schemas
- Provides both read and write access for principals
- Maintains security by requiring active users and proper role matching
- Includes verification queries to test the setup

To apply this fix:
1. Run this SQL script against your Supabase database
2. Test principal access by trying to fetch teachers in their school
3. Monitor the RLS policies to ensure they're working correctly
*/