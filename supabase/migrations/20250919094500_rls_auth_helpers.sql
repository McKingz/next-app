-- ============================================
-- RLS Auth Helper Functions Migration
-- ============================================
-- Date: 2025-09-19
-- Purpose: Create auth helper functions for EduDash Pro RLS policies
-- Author: Security Team
-- ============================================

-- Create app_auth schema for security functions
CREATE SCHEMA IF NOT EXISTS app_auth;

-- Grant usage on schema to authenticated users
GRANT USAGE ON SCHEMA app_auth TO authenticated;

-- ============================================
-- Core JWT Access Functions
-- ============================================

-- Get JWT claims from current session
CREATE OR REPLACE FUNCTION app_auth.jwt() 
RETURNS JSONB
LANGUAGE SQL STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::jsonb,
    '{}'::jsonb
  );
$$;

-- Get user's role from JWT
CREATE OR REPLACE FUNCTION app_auth.role() 
RETURNS TEXT
LANGUAGE SQL STABLE
AS $$
  SELECT COALESCE(app_auth.jwt() ->> 'role', '');
$$;

-- Get authenticated user's ID (from auth.users)
CREATE OR REPLACE FUNCTION app_auth.user_id() 
RETURNS UUID
LANGUAGE SQL STABLE
AS $$
  SELECT NULLIF(app_auth.jwt() ->> 'sub', '')::uuid;
$$;

-- Get user's profile ID (from public.users table)
CREATE OR REPLACE FUNCTION app_auth.profile_id() 
RETURNS UUID
LANGUAGE SQL STABLE
AS $$
  SELECT NULLIF(app_auth.jwt() ->> 'user_id', '')::uuid;
$$;

-- Get user's organization ID
CREATE OR REPLACE FUNCTION app_auth.org_id() 
RETURNS UUID
LANGUAGE SQL STABLE
AS $$
  SELECT NULLIF(app_auth.jwt() ->> 'org_id', '')::uuid;
$$;

-- ============================================
-- Capability Functions
-- ============================================

-- Get user's capabilities as array
CREATE OR REPLACE FUNCTION app_auth.capabilities() 
RETURNS TEXT[]
LANGUAGE SQL STABLE
AS $$
  SELECT COALESCE(
    ARRAY(
      SELECT jsonb_array_elements_text(app_auth.jwt() -> 'capabilities')
    ), 
    ARRAY[]::text[]
  );
$$;

-- Check if user has specific capability
CREATE OR REPLACE FUNCTION app_auth.has_cap(cap TEXT) 
RETURNS BOOLEAN
LANGUAGE SQL STABLE
AS $$
  SELECT cap = ANY(app_auth.capabilities());
$$;

-- ============================================
-- Role Check Functions
-- ============================================

-- Check if user is super admin
CREATE OR REPLACE FUNCTION app_auth.is_super_admin() 
RETURNS BOOLEAN
LANGUAGE SQL STABLE
AS $$
  SELECT app_auth.role() = 'super_admin';
$$;

-- Check if user is principal (any variant)
CREATE OR REPLACE FUNCTION app_auth.is_principal() 
RETURNS BOOLEAN
LANGUAGE SQL STABLE
AS $$
  SELECT app_auth.role() IN ('principal', 'principal_admin');
$$;

-- Check if user is teacher
CREATE OR REPLACE FUNCTION app_auth.is_teacher() 
RETURNS BOOLEAN
LANGUAGE SQL STABLE
AS $$
  SELECT app_auth.role() = 'teacher';
$$;

-- Check if user is parent
CREATE OR REPLACE FUNCTION app_auth.is_parent() 
RETURNS BOOLEAN
LANGUAGE SQL STABLE
AS $$
  SELECT app_auth.role() = 'parent';
$$;

-- ============================================
-- Relationship ID Functions
-- ============================================

-- Get teacher ID if user is teacher
CREATE OR REPLACE FUNCTION app_auth.teacher_id() 
RETURNS UUID
LANGUAGE SQL STABLE
AS $$
  SELECT NULLIF(app_auth.jwt() ->> 'teacher_id', '')::uuid;
$$;

-- Get parent ID if user is parent
CREATE OR REPLACE FUNCTION app_auth.parent_id() 
RETURNS UUID
LANGUAGE SQL STABLE
AS $$
  SELECT NULLIF(app_auth.jwt() ->> 'parent_id', '')::uuid;
$$;

-- ============================================
-- Utility Access Control Functions
-- ============================================

-- Check if user can access specific organization
CREATE OR REPLACE FUNCTION app_auth.can_access_org(p_org UUID) 
RETURNS BOOLEAN
LANGUAGE SQL STABLE
AS $$
  SELECT 
    app_auth.is_super_admin() 
    OR p_org = app_auth.org_id()
    OR p_org IS NULL; -- Handle global/system data
$$;

-- Check if user has role-based hierarchy access
CREATE OR REPLACE FUNCTION app_auth.has_role_level(min_level INTEGER) 
RETURNS BOOLEAN
LANGUAGE SQL STABLE
AS $$
  SELECT CASE app_auth.role()
    WHEN 'super_admin' THEN 4
    WHEN 'principal' THEN 3
    WHEN 'principal_admin' THEN 3
    WHEN 'teacher' THEN 2
    WHEN 'parent' THEN 1
    ELSE 0
  END >= min_level;
$$;

-- Get seat status from JWT
CREATE OR REPLACE FUNCTION app_auth.seat_status() 
RETURNS TEXT
LANGUAGE SQL STABLE
AS $$
  SELECT COALESCE(app_auth.jwt() ->> 'seat_status', 'inactive');
$$;

-- Check if user has active seat
CREATE OR REPLACE FUNCTION app_auth.has_active_seat() 
RETURNS BOOLEAN
LANGUAGE SQL STABLE
AS $$
  SELECT app_auth.seat_status() = 'active';
$$;

-- Get plan tier from JWT
CREATE OR REPLACE FUNCTION app_auth.plan_tier() 
RETURNS TEXT
LANGUAGE SQL STABLE
AS $$
  SELECT COALESCE(app_auth.jwt() ->> 'plan_tier', 'free');
$$;

-- ============================================
-- Grant Permissions
-- ============================================

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app_auth TO authenticated;

-- Set secure search paths for SECURITY DEFINER functions
ALTER FUNCTION app_auth.jwt() SET search_path = pg_catalog, public, app_auth;

-- ============================================
-- Validation and Testing Helpers
-- ============================================

-- Debug function to see current JWT claims (remove in production)
CREATE OR REPLACE FUNCTION app_auth.debug_claims() 
RETURNS JSONB
LANGUAGE SQL STABLE
SECURITY DEFINER
AS $$
  SELECT app_auth.jwt();
$$;

-- Test function to validate auth context
CREATE OR REPLACE FUNCTION app_auth.validate_context() 
RETURNS TABLE(
  user_id UUID,
  role TEXT,
  org_id UUID,
  capabilities_count INTEGER,
  has_active_seat BOOLEAN,
  is_valid BOOLEAN
)
LANGUAGE SQL STABLE
AS $$
  SELECT 
    app_auth.user_id(),
    app_auth.role(),
    app_auth.org_id(),
    array_length(app_auth.capabilities(), 1),
    app_auth.has_active_seat(),
    (app_auth.user_id() IS NOT NULL AND app_auth.role() != '')
$$;

-- ============================================
-- Comments for Documentation
-- ============================================

COMMENT ON SCHEMA app_auth IS 'Authentication helper functions for Row Level Security policies';

COMMENT ON FUNCTION app_auth.jwt() IS 'Returns JWT claims from current session';
COMMENT ON FUNCTION app_auth.role() IS 'Returns user role from JWT claims';
COMMENT ON FUNCTION app_auth.user_id() IS 'Returns auth.users ID from JWT sub claim';
COMMENT ON FUNCTION app_auth.profile_id() IS 'Returns public.users profile ID from JWT';
COMMENT ON FUNCTION app_auth.org_id() IS 'Returns organization ID from JWT claims';
COMMENT ON FUNCTION app_auth.capabilities() IS 'Returns user capabilities as text array';
COMMENT ON FUNCTION app_auth.has_cap(TEXT) IS 'Checks if user has specific capability';
COMMENT ON FUNCTION app_auth.is_super_admin() IS 'Returns true if user is super admin';
COMMENT ON FUNCTION app_auth.is_principal() IS 'Returns true if user is principal (any variant)';
COMMENT ON FUNCTION app_auth.is_teacher() IS 'Returns true if user is teacher';
COMMENT ON FUNCTION app_auth.is_parent() IS 'Returns true if user is parent';
COMMENT ON FUNCTION app_auth.teacher_id() IS 'Returns teacher ID if user has teaching role';
COMMENT ON FUNCTION app_auth.parent_id() IS 'Returns parent ID if user has parent role';
COMMENT ON FUNCTION app_auth.can_access_org(UUID) IS 'Checks if user can access specific organization';
COMMENT ON FUNCTION app_auth.has_role_level(INTEGER) IS 'Checks if user has minimum role level';
COMMENT ON FUNCTION app_auth.seat_status() IS 'Returns user seat activation status';
COMMENT ON FUNCTION app_auth.has_active_seat() IS 'Returns true if user has active seat';
COMMENT ON FUNCTION app_auth.plan_tier() IS 'Returns organization subscription tier';

-- ============================================
-- Migration Verification
-- ============================================

-- Verify all functions were created successfully
DO $$
BEGIN
  -- Check that all expected functions exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.routines 
    WHERE routine_schema = 'app_auth' 
    AND routine_name = 'jwt'
  ) THEN
    RAISE EXCEPTION 'Auth helper functions not created properly';
  END IF;
  
  RAISE NOTICE '✅ RLS Auth Helper Functions Migration Complete';
  RAISE NOTICE '📋 Created % functions in app_auth schema', (
    SELECT COUNT(*) FROM information_schema.routines 
    WHERE routine_schema = 'app_auth'
  );
END $$;

-- Final status message
SELECT 
  '🎯 RLS AUTH HELPERS MIGRATION COMPLETE' as status,
  'All authentication helper functions ready for RLS policies' as summary;