-- Fix Principal Access to Teachers in Users Table
-- Date: 2025-09-19  
-- Purpose: Fix RLS policies to allow principals to load/manage teachers in their school
-- Issue: Principal getting 400 error when trying to PATCH /users
-- WARP.md Compliance: Forward-only migration, production-safe

BEGIN;

-- ============================================================================
-- PART 1: ENSURE USERS TABLE HAS REQUIRED COLUMNS
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
-- PART 2: ENABLE RLS AND DROP PROBLEMATIC POLICIES
-- ============================================================================

-- Enable RLS on users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies that might be too restrictive
DROP POLICY IF EXISTS users_select_own_data ON public.users;
DROP POLICY IF EXISTS users_select_same_preschool ON public.users;
DROP POLICY IF EXISTS users_select_same_organization ON public.users;
DROP POLICY IF EXISTS users_insert_own_profile ON public.users;
DROP POLICY IF EXISTS users_update_own_profile ON public.users;
DROP POLICY IF EXISTS users_principal_update ON public.users;
DROP POLICY IF EXISTS principal_users_access ON public.users;
DROP POLICY IF EXISTS superadmin_users_access ON public.users;
DROP POLICY IF EXISTS superadmin_full_access ON public.users;
DROP POLICY IF EXISTS users_own_data ON public.users;
DROP POLICY IF EXISTS principal_school_access ON public.users;
DROP POLICY IF EXISTS teacher_school_view ON public.users;

-- ============================================================================
-- PART 3: CREATE COMPREHENSIVE RLS POLICIES FOR USERS TABLE
-- ============================================================================

-- Policy 1: Super admin can do everything
CREATE POLICY superadmin_full_access
ON public.users FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users AS su
    WHERE
      su.auth_user_id = auth.uid()
      AND su.role IN ('super_admin', 'superadmin')
      AND COALESCE(su.is_active, TRUE) = TRUE
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users AS su
    WHERE
      su.auth_user_id = auth.uid()
      AND su.role IN ('super_admin', 'superadmin')
      AND COALESCE(su.is_active, TRUE) = TRUE
  )
);

-- Policy 2: Users can view and update their own data
CREATE POLICY users_own_data
ON public.users FOR ALL
TO authenticated
USING (auth_user_id = auth.uid())
WITH CHECK (auth_user_id = auth.uid());

-- Policy 3: Principals can view and update users in their organization
CREATE POLICY principal_school_access
ON public.users FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users AS principal
    WHERE
      principal.auth_user_id = auth.uid()
      AND principal.role IN ('principal', 'principal_admin')
      AND COALESCE(principal.is_active, TRUE) = TRUE
      AND (
      -- Match by organization_id
        (
          principal.organization_id IS NOT NULL
          AND users.organization_id = principal.organization_id
        )
        OR
        -- Match by preschool_id (if using preschool schema)
        (
          COALESCE(principal.preschool_id, principal.organization_id) IS NOT NULL
          AND COALESCE(users.preschool_id, users.organization_id)
          = COALESCE(principal.preschool_id, principal.organization_id)
        )
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users AS principal
    WHERE
      principal.auth_user_id = auth.uid()
      AND principal.role IN ('principal', 'principal_admin')
      AND COALESCE(principal.is_active, TRUE) = TRUE
      AND (
      -- Match by organization_id
        (
          principal.organization_id IS NOT NULL
          AND users.organization_id = principal.organization_id
        )
        OR
        -- Match by preschool_id
        (
          COALESCE(principal.preschool_id, principal.organization_id) IS NOT NULL
          AND COALESCE(users.preschool_id, users.organization_id)
          = COALESCE(principal.preschool_id, principal.organization_id)
        )
      )
  )
);

-- Policy 4: Teachers can view users in their organization (read-only for colleagues)
CREATE POLICY teacher_school_view
ON public.users FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users AS teacher
    WHERE
      teacher.auth_user_id = auth.uid()
      AND teacher.role = 'teacher'
      AND COALESCE(teacher.is_active, TRUE) = TRUE
      AND (
      -- Match by organization_id
        (
          teacher.organization_id IS NOT NULL
          AND users.organization_id = teacher.organization_id
        )
        OR
        -- Match by preschool_id
        (
          COALESCE(teacher.preschool_id, teacher.organization_id) IS NOT NULL
          AND COALESCE(users.preschool_id, users.organization_id)
          = COALESCE(teacher.preschool_id, teacher.organization_id)
        )
      )
  )
);

-- ============================================================================
-- PART 4: CREATE HELPER FUNCTIONS FOR ORGANIZATION MATCHING
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
  AND COALESCE(is_active, true) = true
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
    SELECT 1 FROM public.users cu, public.users tu
    WHERE cu.auth_user_id = auth.uid()
    AND tu.auth_user_id = target_auth_user_id
    AND COALESCE(cu.is_active, true) = true
    AND (
      -- Super admin can manage anyone
      cu.role IN ('super_admin', 'superadmin')
      OR
      -- Self management
      cu.auth_user_id = tu.auth_user_id
      OR
      -- Principal can manage users in their organization
      (
        cu.role IN ('principal', 'principal_admin')
        AND (
          (cu.organization_id IS NOT NULL 
           AND tu.organization_id = cu.organization_id)
          OR
          (COALESCE(cu.preschool_id, cu.organization_id) IS NOT NULL 
           AND COALESCE(tu.preschool_id, tu.organization_id) = COALESCE(cu.preschool_id, cu.organization_id))
        )
      )
    )
  );
$$;

-- ============================================================================
-- PART 5: GRANT PERMISSIONS
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
-- PART 6: CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

-- Index on auth_user_id for fast auth lookups
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id_v2
ON public.users (auth_user_id) WHERE auth_user_id IS NOT NULL;

-- Index on organization_id for tenant isolation
CREATE INDEX IF NOT EXISTS idx_users_organization_id_v2
ON public.users (organization_id) WHERE organization_id IS NOT NULL;

-- Index on preschool_id for tenant isolation (if using preschool schema)
CREATE INDEX IF NOT EXISTS idx_users_preschool_id_v2
ON public.users (preschool_id) WHERE preschool_id IS NOT NULL;

-- Index on role for role-based queries
CREATE INDEX IF NOT EXISTS idx_users_role_active_v2
ON public.users (role, is_active) WHERE COALESCE(is_active, TRUE) = TRUE;

-- ============================================================================
-- PART 7: LOG COMPLETION
-- ============================================================================

-- Log migration completion
INSERT INTO public.config_kv (key, value, description, is_public)
VALUES (
  'principal_teacher_access_fix_20250919200000',
  JSON_BUILD_OBJECT(
    'version', '1.0.0',
    'completed_at', NOW()::text,
    'policies_created', 4,
    'functions_created', 2,
    'indexes_created', 4,
    'issue_fixed', 'Principal 400 error accessing teachers'
  ),
  'Principal teacher access RLS policy fix completion log',
  FALSE
) ON CONFLICT (key) DO UPDATE SET
  value = excluded.value,
  updated_at = NOW();

SELECT 'PRINCIPAL TEACHER ACCESS FIXED' AS status;

COMMIT;
