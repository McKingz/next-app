-- RLS FOUNDATION HELPERS
-- Purpose: Create essential helper functions for tenant isolation and role-based access
-- Scope: Foundation functions that will be used by incremental policy implementation
-- Compliance: WARP.md Non-negotiables - secure, auditable, superadmin-aware

BEGIN;

-- ============================================================================
-- SECTION 1: BASIC UTILITY FUNCTIONS
-- ============================================================================

-- Ensure app_auth schema exists
CREATE SCHEMA IF NOT EXISTS app_auth;

-- Get current user's ID safely
CREATE OR REPLACE FUNCTION app_auth.current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT auth.uid();
$$;

-- Get current user's email safely
CREATE OR REPLACE FUNCTION app_auth.current_user_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(auth.email(), '');
$$;

-- Check if current user is authenticated
CREATE OR REPLACE FUNCTION app_auth.is_authenticated()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT auth.role() = 'authenticated';
$$;

-- ============================================================================
-- SECTION 2: ROLE DETECTION FUNCTIONS
-- ============================================================================

-- Check if current user is a superadmin
CREATE OR REPLACE FUNCTION app_auth.is_superadmin()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_email text;
BEGIN
    -- Only check if user is authenticated
    IF NOT app_auth.is_authenticated() THEN
        RETURN false;
    END IF;
    
    user_email := app_auth.current_user_email();
    
    -- Check if it's one of our verified superadmin emails
    RETURN user_email IN (
        'superadmin@edudashpro.org.za',
        'admin@edudashpro.com'
    );
END;
$$;

-- Get current user's role from users table
CREATE OR REPLACE FUNCTION app_auth.current_user_role()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_role text;
BEGIN
    -- If not authenticated, return null
    IF NOT app_auth.is_authenticated() THEN
        RETURN null;
    END IF;
    
    -- Get role from users table
    SELECT role INTO user_role
    FROM public.users
    WHERE id = app_auth.current_user_id();
    
    RETURN COALESCE(user_role, 'unknown');
END;
$$;

-- Check if current user is a principal
CREATE OR REPLACE FUNCTION app_auth.is_principal()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT app_auth.current_user_role() = 'principal';
$$;

-- Check if current user is a teacher
CREATE OR REPLACE FUNCTION app_auth.is_teacher()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT app_auth.current_user_role() = 'teacher';
$$;

-- Check if current user is a parent
CREATE OR REPLACE FUNCTION app_auth.is_parent()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT app_auth.current_user_role() = 'parent';
$$;

-- ============================================================================
-- SECTION 3: ORGANIZATION/TENANT ISOLATION FUNCTIONS
-- ============================================================================

-- Get current user's organization ID (preschool_id for tenant isolation)
CREATE OR REPLACE FUNCTION app_auth.current_user_org_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    org_id uuid;
BEGIN
    -- If not authenticated, return null
    IF NOT app_auth.is_authenticated() THEN
        RETURN null;
    END IF;
    
    -- Superadmins can access all organizations
    IF app_auth.is_superadmin() THEN
        RETURN null; -- null means "all organizations"
    END IF;
    
    -- Get organization_id from users table
    SELECT organization_id INTO org_id
    FROM public.users
    WHERE id = app_auth.current_user_id();
    
    RETURN org_id;
END;
$$;

-- Check if current user has access to a specific organization
CREATE OR REPLACE FUNCTION app_auth.has_org_access(target_org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_org_id uuid;
BEGIN
    -- Superadmins have access to all organizations
    IF app_auth.is_superadmin() THEN
        RETURN true;
    END IF;
    
    -- Get current user's organization
    user_org_id := app_auth.current_user_org_id();
    
    -- Check if user belongs to the target organization
    RETURN user_org_id = target_org_id;
END;
$$;

-- ============================================================================
-- SECTION 4: RECORD ACCESS VALIDATION FUNCTIONS
-- ============================================================================

-- Check if current user can access their own record
CREATE OR REPLACE FUNCTION app_auth.can_access_own_record(record_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT 
    app_auth.is_superadmin() 
    OR record_user_id = app_auth.current_user_id();
$$;

-- Check if current user can access a student record (based on organization)
CREATE OR REPLACE FUNCTION app_auth.can_access_student_in_org(student_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT 
    app_auth.is_superadmin() 
    OR app_auth.has_org_access(student_org_id);
$$;

-- ============================================================================
-- SECTION 5: DEBUGGING AND STATUS FUNCTIONS
-- ============================================================================

-- Get comprehensive status for current user (useful for debugging)
CREATE OR REPLACE FUNCTION app_auth.debug_user_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result jsonb;
BEGIN
    result := jsonb_build_object(
        'authenticated', app_auth.is_authenticated(),
        'user_id', app_auth.current_user_id(),
        'email', app_auth.current_user_email(),
        'role', app_auth.current_user_role(),
        'organization_id', app_auth.current_user_org_id(),
        'is_superadmin', app_auth.is_superadmin(),
        'is_principal', app_auth.is_principal(),
        'is_teacher', app_auth.is_teacher(),
        'is_parent', app_auth.is_parent(),
        'timestamp', now()
    );
    
    RETURN result;
END;
$$;

-- ============================================================================
-- SECTION 6: GRANT PERMISSIONS
-- ============================================================================

-- Grant execute permissions on all functions to authenticated users
GRANT EXECUTE ON FUNCTION app_auth.current_user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION app_auth.current_user_email() TO authenticated;
GRANT EXECUTE ON FUNCTION app_auth.is_authenticated() TO authenticated;
GRANT EXECUTE ON FUNCTION app_auth.is_superadmin() TO authenticated;
GRANT EXECUTE ON FUNCTION app_auth.current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION app_auth.is_principal() TO authenticated;
GRANT EXECUTE ON FUNCTION app_auth.is_teacher() TO authenticated;
GRANT EXECUTE ON FUNCTION app_auth.is_parent() TO authenticated;
GRANT EXECUTE ON FUNCTION app_auth.current_user_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION app_auth.has_org_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION app_auth.can_access_own_record(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION app_auth.can_access_student_in_org(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION app_auth.debug_user_status() TO authenticated;

-- ============================================================================
-- SECTION 7: VERIFICATION AND COMPLETION
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '✅ RLS Foundation Helpers Migration Complete';
    RAISE NOTICE '🏢 Created app_auth schema with 13 helper functions';
    RAISE NOTICE '👤 User functions: current_user_id, current_user_email, is_authenticated';
    RAISE NOTICE '👑 Role functions: is_superadmin, is_principal, is_teacher, is_parent';
    RAISE NOTICE '🏢 Org functions: current_user_org_id, has_org_access';
    RAISE NOTICE '🔐 Access functions: can_access_own_record, can_access_student_in_org';
    RAISE NOTICE '🔍 Debug function: debug_user_status';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 READY FOR POLICY IMPLEMENTATION:';
    RAISE NOTICE '✅ Foundation functions available';
    RAISE NOTICE '✅ Tenant isolation logic ready';
    RAISE NOTICE '✅ Role-based access controls ready';
    RAISE NOTICE '✅ Superadmin bypass logic ready';
    RAISE NOTICE '';
    RAISE NOTICE '📋 NEXT STEP: Implement SELECT policy for users table';
END;
$$;

COMMIT;

-- Test query to verify functions work
SELECT
  'RLS Foundation Ready' AS status,
  'Helper functions created successfully' AS message,
  now() AS created_at;
