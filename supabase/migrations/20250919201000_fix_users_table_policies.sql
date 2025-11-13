-- Fix Users Table RLS Policies
-- Date: 2025-09-19
-- Purpose: Fix issues caused by previous principal fix migration
-- Issue: Previous migration may have broken user access with restrictive policies
-- WARP.md Compliance: Forward-only migration, production-safe

BEGIN;

-- ============================================================================
-- PART 1: ANALYZE AND FIX DATA CONSISTENCY ISSUES
-- ============================================================================

-- Ensure auth_user_id is populated correctly if it was added
UPDATE public.users
SET auth_user_id = id
WHERE
  auth_user_id IS NULL
  AND id IS NOT NULL;

-- Ensure is_active has proper values
UPDATE public.users
SET is_active = COALESCE(is_active, TRUE)
WHERE is_active IS NULL;

-- ============================================================================
-- PART 2: DROP PROBLEMATIC POLICIES AND RECREATE SAFER ONES
-- ============================================================================

-- Drop all existing policies
DROP POLICY IF EXISTS superadmin_full_access ON public.users;
DROP POLICY IF EXISTS users_own_data ON public.users;
DROP POLICY IF EXISTS principal_school_access ON public.users;
DROP POLICY IF EXISTS teacher_school_view ON public.users;

-- ============================================================================
-- PART 3: CREATE ROBUST, FLEXIBLE RLS POLICIES
-- ============================================================================

-- Policy 1: Superadmin full access (with multiple auth methods)
CREATE POLICY users_superadmin_access
ON public.users FOR ALL
TO authenticated
USING (
  -- Check via JWT claims
  (
    LOWER(COALESCE((CURRENT_SETTING('request.jwt.claims', TRUE)::jsonb ->> 'role'), '')) IN (
      'super_admin', 'superadmin'
    )
  )
  OR
  -- Check via database (multiple ID matching methods)
  EXISTS (
    SELECT 1 FROM public.users AS su
    WHERE (
      su.id = auth.uid()
      OR su.auth_user_id = auth.uid()
    )
    AND LOWER(su.role) IN ('super_admin', 'superadmin')
    AND COALESCE(su.is_active, TRUE) = TRUE
  )
)
WITH CHECK (
  -- Same check for modifications
  (
    LOWER(COALESCE((CURRENT_SETTING('request.jwt.claims', TRUE)::jsonb ->> 'role'), '')) IN (
      'super_admin', 'superadmin'
    )
  )
  OR
  EXISTS (
    SELECT 1 FROM public.users AS su
    WHERE (
      su.id = auth.uid()
      OR su.auth_user_id = auth.uid()
    )
    AND LOWER(su.role) IN ('super_admin', 'superadmin')
    AND COALESCE(su.is_active, TRUE) = TRUE
  )
);

-- Policy 2: Users can access their own data (flexible ID matching)
CREATE POLICY users_own_profile_access
ON public.users FOR ALL
TO authenticated
USING (
  id = auth.uid()
  OR auth_user_id = auth.uid()
)
WITH CHECK (
  id = auth.uid()
  OR auth_user_id = auth.uid()
);

-- Policy 3: Principals can manage users in their organization (with fallbacks)
CREATE POLICY users_principal_management
ON public.users FOR ALL
TO authenticated
USING (
  -- JWT-based check
  (
    LOWER(COALESCE((CURRENT_SETTING('request.jwt.claims', TRUE)::jsonb ->> 'role'), '')) IN (
      'principal', 'principal_admin'
    )
    AND (
      -- Organization ID from JWT
      COALESCE(
        NULLIF(((CURRENT_SETTING('request.jwt.claims', TRUE)::jsonb) ->> 'organization_id'), '')::uuid,
        NULLIF(((CURRENT_SETTING('request.jwt.claims', TRUE)::jsonb) ->> 'preschool_id'), '')::uuid
      ) = COALESCE(users.organization_id, users.preschool_id)
    )
  )
  OR
  -- Database fallback check
  EXISTS (
    SELECT 1 FROM public.users AS principal
    WHERE (
      principal.id = auth.uid()
      OR principal.auth_user_id = auth.uid()
    )
    AND LOWER(principal.role) IN ('principal', 'principal_admin')
    AND COALESCE(principal.is_active, TRUE) = TRUE
    AND (
      -- Organization ID match
      (
        principal.organization_id IS NOT NULL
        AND users.organization_id = principal.organization_id
      )
      OR
      -- Preschool ID match
      (
        principal.preschool_id IS NOT NULL
        AND users.preschool_id = principal.preschool_id
      )
      OR
      -- Flexible org/preschool matching
      (
        COALESCE(principal.organization_id, principal.preschool_id) IS NOT NULL
        AND COALESCE(users.organization_id, users.preschool_id)
        = COALESCE(principal.organization_id, principal.preschool_id)
      )
    )
  )
)
WITH CHECK (
  -- Same logic for modifications
  (
    LOWER(COALESCE((CURRENT_SETTING('request.jwt.claims', TRUE)::jsonb ->> 'role'), '')) IN (
      'principal', 'principal_admin'
    )
    AND (
      COALESCE(
        NULLIF(((CURRENT_SETTING('request.jwt.claims', TRUE)::jsonb) ->> 'organization_id'), '')::uuid,
        NULLIF(((CURRENT_SETTING('request.jwt.claims', TRUE)::jsonb) ->> 'preschool_id'), '')::uuid
      ) = COALESCE(users.organization_id, users.preschool_id)
    )
  )
  OR
  EXISTS (
    SELECT 1 FROM public.users AS principal
    WHERE (
      principal.id = auth.uid()
      OR principal.auth_user_id = auth.uid()
    )
    AND LOWER(principal.role) IN ('principal', 'principal_admin')
    AND COALESCE(principal.is_active, TRUE) = TRUE
    AND (
      (
        principal.organization_id IS NOT NULL
        AND users.organization_id = principal.organization_id
      )
      OR
      (
        principal.preschool_id IS NOT NULL
        AND users.preschool_id = principal.preschool_id
      )
      OR
      (
        COALESCE(principal.organization_id, principal.preschool_id) IS NOT NULL
        AND COALESCE(users.organization_id, users.preschool_id)
        = COALESCE(principal.organization_id, principal.preschool_id)
      )
    )
  )
);

-- Policy 4: Teachers can view colleagues in their organization
CREATE POLICY users_teacher_view_colleagues
ON public.users FOR SELECT
TO authenticated
USING (
  -- JWT-based check  
  (
    LOWER(COALESCE((CURRENT_SETTING('request.jwt.claims', TRUE)::jsonb ->> 'role'), '')) = 'teacher'
    AND (
      COALESCE(
        NULLIF(((CURRENT_SETTING('request.jwt.claims', TRUE)::jsonb) ->> 'organization_id'), '')::uuid,
        NULLIF(((CURRENT_SETTING('request.jwt.claims', TRUE)::jsonb) ->> 'preschool_id'), '')::uuid
      ) = COALESCE(users.organization_id, users.preschool_id)
    )
  )
  OR
  -- Database fallback check
  EXISTS (
    SELECT 1 FROM public.users AS teacher
    WHERE (
      teacher.id = auth.uid()
      OR teacher.auth_user_id = auth.uid()
    )
    AND LOWER(teacher.role) = 'teacher'
    AND COALESCE(teacher.is_active, TRUE) = TRUE
    AND (
      (
        teacher.organization_id IS NOT NULL
        AND users.organization_id = teacher.organization_id
      )
      OR
      (
        teacher.preschool_id IS NOT NULL
        AND users.preschool_id = teacher.preschool_id
      )
      OR
      (
        COALESCE(teacher.organization_id, teacher.preschool_id) IS NOT NULL
        AND COALESCE(users.organization_id, users.preschool_id)
        = COALESCE(teacher.organization_id, teacher.preschool_id)
      )
    )
  )
);

-- ============================================================================
-- PART 4: ENSURE PROPER PERMISSIONS AND INDEXES
-- ============================================================================

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;

-- Ensure indexes exist for performance (only create if missing)
CREATE INDEX IF NOT EXISTS idx_users_auth_lookup
ON public.users (auth_user_id) WHERE auth_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_id_lookup
ON public.users (id) WHERE id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_org_lookup
ON public.users (organization_id, preschool_id) WHERE organization_id IS NOT NULL OR preschool_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_role_active_lookup
ON public.users (role, is_active) WHERE COALESCE(is_active, TRUE) = TRUE;

-- ============================================================================
-- PART 5: CREATE A SAFER USER ACCESS FUNCTION
-- ============================================================================

-- Update the helper function to be more robust
CREATE OR REPLACE FUNCTION public.get_current_user_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT coalesce(
    organization_id,
    preschool_id
  )
  FROM public.users 
  WHERE (
    id = auth.uid() 
    OR auth_user_id = auth.uid()
  )
  AND coalesce(is_active, true) = true
  ORDER BY 
    CASE WHEN id = auth.uid() THEN 1 ELSE 2 END
  LIMIT 1;
$$;

-- Update the management function to be more robust
CREATE OR REPLACE FUNCTION public.can_manage_user(target_auth_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users cu, public.users tu
    WHERE (
      cu.id = auth.uid() OR 
      cu.auth_user_id = auth.uid()
    )
    AND (
      tu.id = target_auth_user_id OR
      tu.auth_user_id = target_auth_user_id
    )
    AND coalesce(cu.is_active, true) = true
    AND (
      -- Super admin can manage anyone
      lower(cu.role) IN ('super_admin', 'superadmin')
      OR
      -- Self management
      (cu.id = tu.id OR cu.auth_user_id = tu.auth_user_id)
      OR
      -- Principal can manage users in their organization
      (
        lower(cu.role) IN ('principal', 'principal_admin')
        AND (
          (cu.organization_id IS NOT NULL 
           AND tu.organization_id = cu.organization_id)
          OR
          (cu.preschool_id IS NOT NULL 
           AND tu.preschool_id = cu.preschool_id)
          OR
          (coalesce(cu.organization_id, cu.preschool_id) IS NOT NULL 
           AND coalesce(tu.organization_id, tu.preschool_id) = coalesce(cu.organization_id, cu.preschool_id))
        )
      )
    )
  );
$$;

-- Grant permissions on functions
GRANT EXECUTE ON FUNCTION public.get_current_user_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_user(uuid) TO authenticated;

-- ============================================================================
-- PART 6: LOG THE FIX
-- ============================================================================

-- Log the fix
INSERT INTO public.config_kv (key, value, description, is_public)
VALUES (
  'users_table_policies_fix_20250919201000',
  JSON_BUILD_OBJECT(
    'version', '1.0.0',
    'completed_at', NOW()::text,
    'issue_fixed', 'Fixed restrictive RLS policies on users table',
    'policies_fixed', 4,
    'auth_methods', 'JWT + Database fallback',
    'id_matching', 'Flexible (id or auth_user_id)'
  ),
  'Users table RLS policies fix completion log',
  FALSE
) ON CONFLICT (key) DO UPDATE SET
  value = excluded.value,
  updated_at = NOW();

SELECT 'USERS TABLE POLICIES FIXED - MORE ROBUST ACCESS CONTROL' AS status;

COMMIT;
