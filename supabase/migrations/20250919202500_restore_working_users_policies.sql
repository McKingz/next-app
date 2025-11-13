-- Restore Working Users Table Policies
-- Date: 2025-09-19
-- Purpose: Restore the working users policies that correctly show user counts
-- Issue: Latest migration broke user counts (showing 0 instead of actual users)
-- WARP.md Compliance: Forward-only migration, production-safe

BEGIN;

-- ============================================================================
-- PART 1: DROP THE PROBLEMATIC POLICIES
-- ============================================================================

-- Drop the policies that broke user counting
DROP POLICY IF EXISTS users_superadmin_access ON public.users;
DROP POLICY IF EXISTS users_own_profile_access ON public.users;
DROP POLICY IF EXISTS users_principal_management ON public.users;
DROP POLICY IF EXISTS users_teacher_view_colleagues ON public.users;

-- ============================================================================
-- PART 2: RESTORE THE WORKING POLICIES USING app_auth FUNCTIONS
-- ============================================================================

-- Policy 1: Superadmin can access all users
CREATE POLICY users_superadmin_full_access
ON public.users FOR ALL
TO authenticated
USING (
  app_auth.is_superadmin()
)
WITH CHECK (
  app_auth.is_superadmin()
);

-- Policy 2: Users can access their own profile
CREATE POLICY users_own_profile
ON public.users FOR ALL
TO authenticated
USING (
  id = app_auth.current_user_id()
  OR id = auth.uid()
  OR auth_user_id = auth.uid()
)
WITH CHECK (
  id = app_auth.current_user_id()
  OR id = auth.uid()
  OR auth_user_id = auth.uid()
);

-- Policy 3: Principal can manage users in their organization (WORKING VERSION)
CREATE POLICY users_principal_organization_access
ON public.users FOR ALL
TO authenticated
USING (
  app_auth.is_superadmin()
  OR id = app_auth.current_user_id()
  OR id = auth.uid()
  OR auth_user_id = auth.uid()
  OR (
    app_auth.is_principal()
    AND COALESCE(preschool_id, organization_id)
    = COALESCE(app_auth.current_user_org_id(), app_auth.org_id())
  )
  OR (
    app_auth.is_teacher()
    AND role IN ('student', 'parent')
    AND COALESCE(preschool_id, organization_id)
    = COALESCE(app_auth.current_user_org_id(), app_auth.org_id())
  )
  OR (
    app_auth.is_parent()
    AND role = 'teacher'
    AND COALESCE(preschool_id, organization_id)
    = COALESCE(app_auth.current_user_org_id(), app_auth.org_id())
  )
)
WITH CHECK (
  app_auth.is_superadmin()
  OR id = app_auth.current_user_id()
  OR id = auth.uid()
  OR auth_user_id = auth.uid()
  OR (
    app_auth.is_principal()
    AND COALESCE(preschool_id, organization_id)
    = COALESCE(app_auth.current_user_org_id(), app_auth.org_id())
  )
);

-- Policy 4: Teachers can view colleagues in their organization
CREATE POLICY users_teacher_colleague_view
ON public.users FOR SELECT
TO authenticated
USING (
  app_auth.is_superadmin()
  OR id = app_auth.current_user_id()
  OR id = auth.uid()
  OR auth_user_id = auth.uid()
  OR (
    app_auth.is_teacher()
    AND COALESCE(preschool_id, organization_id)
    = COALESCE(app_auth.current_user_org_id(), app_auth.org_id())
  )
  OR (
    app_auth.is_principal()
    AND COALESCE(preschool_id, organization_id)
    = COALESCE(app_auth.current_user_org_id(), app_auth.org_id())
  )
);

-- ============================================================================
-- PART 3: ENSURE app_auth SCHEMA AND FUNCTIONS EXIST
-- ============================================================================

-- Create app_auth schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS app_auth;

-- Create or replace all app_auth functions
CREATE OR REPLACE FUNCTION app_auth.is_superadmin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $func$
    SELECT EXISTS (
        SELECT 1 FROM public.users 
        WHERE (id = auth.uid() OR auth_user_id = auth.uid())
        AND lower(role) IN ('super_admin', 'superadmin')
        AND COALESCE(is_active, true) = true
    )
    OR lower(COALESCE((current_setting('request.jwt.claims', true)::jsonb ->> 'role'), '')) IN ('super_admin', 'superadmin');
$func$;

CREATE OR REPLACE FUNCTION app_auth.is_principal()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $func$
    SELECT EXISTS (
        SELECT 1 FROM public.users 
        WHERE (id = auth.uid() OR auth_user_id = auth.uid())
        AND lower(role) IN ('principal', 'principal_admin')
        AND COALESCE(is_active, true) = true
    )
    OR lower(COALESCE((current_setting('request.jwt.claims', true)::jsonb ->> 'role'), '')) IN ('principal', 'principal_admin');
$func$;

CREATE OR REPLACE FUNCTION app_auth.is_teacher()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $func$
    SELECT EXISTS (
        SELECT 1 FROM public.users 
        WHERE (id = auth.uid() OR auth_user_id = auth.uid())
        AND lower(role) = 'teacher'
        AND COALESCE(is_active, true) = true
    )
    OR lower(COALESCE((current_setting('request.jwt.claims', true)::jsonb ->> 'role'), '')) = 'teacher';
$func$;

CREATE OR REPLACE FUNCTION app_auth.is_parent()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $func$
    SELECT EXISTS (
        SELECT 1 FROM public.users 
        WHERE (id = auth.uid() OR auth_user_id = auth.uid())
        AND lower(role) = 'parent'
        AND COALESCE(is_active, true) = true
    )
    OR lower(COALESCE((current_setting('request.jwt.claims', true)::jsonb ->> 'role'), '')) = 'parent';
$func$;

CREATE OR REPLACE FUNCTION app_auth.current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $func$
    SELECT id FROM public.users 
    WHERE (id = auth.uid() OR auth_user_id = auth.uid())
    AND COALESCE(is_active, true) = true
    ORDER BY CASE WHEN id = auth.uid() THEN 1 ELSE 2 END
    LIMIT 1;
$func$;

CREATE OR REPLACE FUNCTION app_auth.current_user_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $func$
    SELECT COALESCE(organization_id, preschool_id) FROM public.users 
    WHERE (id = auth.uid() OR auth_user_id = auth.uid())
    AND COALESCE(is_active, true) = true
    ORDER BY CASE WHEN id = auth.uid() THEN 1 ELSE 2 END
    LIMIT 1;
$func$;

CREATE OR REPLACE FUNCTION app_auth.org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $func$
    SELECT COALESCE(
        nullif(((current_setting('request.jwt.claims', true)::jsonb) ->> 'organization_id'), '')::uuid,
        nullif(((current_setting('request.jwt.claims', true)::jsonb) ->> 'preschool_id'), '')::uuid,
        (SELECT COALESCE(organization_id, preschool_id) FROM public.users 
         WHERE (id = auth.uid() OR auth_user_id = auth.uid())
         AND COALESCE(is_active, true) = true
         ORDER BY CASE WHEN id = auth.uid() THEN 1 ELSE 2 END
         LIMIT 1)
    );
$func$;

-- ============================================================================
-- PART 4: ENSURE PERMISSIONS ARE CORRECT
-- ============================================================================

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;

-- Ensure app_auth functions are accessible
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app_auth TO authenticated;

-- ============================================================================
-- PART 5: LOG THE RESTORATION
-- ============================================================================

-- Log the restoration
INSERT INTO public.config_kv (key, value, description, is_public)
VALUES (
  'users_policies_restoration_20250919202500',
  JSON_BUILD_OBJECT(
    'version', '1.0.0',
    'completed_at', NOW()::text,
    'issue_fixed', 'Restored working users table policies with app_auth functions',
    'user_counts_restored', TRUE,
    'superadmin_access', 'Full access restored',
    'principal_access', 'Organization-scoped access restored'
  ),
  'Users table policies restoration to working state',
  FALSE
) ON CONFLICT (key) DO UPDATE SET
  value = excluded.value,
  updated_at = NOW();

SELECT 'USERS TABLE POLICIES RESTORED - USER COUNTS SHOULD NOW WORK' AS status;

COMMIT;
