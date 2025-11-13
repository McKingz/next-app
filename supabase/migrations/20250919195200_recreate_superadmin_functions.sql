-- Recreate Superadmin Functions Migration
-- Date: 2025-09-19
-- Purpose: Safely recreate superadmin RPC functions with correct signatures
-- WARP.md Compliance: Supabase migration, production-safe, forward-only
-- Authority: Fix function signature conflicts

BEGIN;

-- ============================================================================
-- PART 1: SAFELY DROP EXISTING FUNCTIONS IF THEY EXIST
-- ============================================================================

-- Drop functions that may have signature conflicts
DROP FUNCTION IF EXISTS superadmin_reactivate_user(UUID, TEXT);
DROP FUNCTION IF EXISTS superadmin_suspend_user(UUID, ESCALATION_LEVEL_ENUM, TEXT, INTEGER);
DROP FUNCTION IF EXISTS superadmin_request_user_deletion(UUID, DELETION_TYPE_ENUM, TEXT, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS superadmin_bulk_suspend_users(UUID [], ESCALATION_LEVEL_ENUM, TEXT, INTEGER);
DROP FUNCTION IF EXISTS create_superadmin_notification(
  NOTIFICATION_TYPE_ENUM, SEVERITY_ENUM, TEXT, TEXT, NOTIFICATION_SOURCE_ENUM, UUID [], JSONB
);
DROP FUNCTION IF EXISTS log_superadmin_action(SUPERADMIN_ACTION_ENUM, JSONB);
DROP FUNCTION IF EXISTS get_superadmin_dashboard_data();
DROP FUNCTION IF EXISTS test_superadmin_system();

-- ============================================================================
-- PART 2: RECREATE CORE PERMISSION VALIDATION FUNCTIONS
-- ============================================================================

-- Function to check if current user is superadmin
CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users 
    WHERE auth_user_id = auth.uid() 
    AND role = 'super_admin' 
    AND is_active = true
  );
$$;

-- Function to check superadmin by user ID
CREATE OR REPLACE FUNCTION is_superadmin_by_id(user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_user_id = user_id
    AND role = 'super_admin'
    AND is_active = true
  );
$$;

-- ============================================================================
-- PART 3: RECREATE USER MANAGEMENT FUNCTIONS
-- ============================================================================

-- Function to reactivate suspended user (simplified)
CREATE OR REPLACE FUNCTION superadmin_reactivate_user(
  target_user_id UUID,
  reason TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if current user is superadmin
  IF NOT is_superadmin() THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Access denied: Superadmin privileges required'
    );
  END IF;

  -- Reactivate user (using basic approach for compatibility)
  UPDATE public.users
  SET
    is_active = true,
    updated_at = NOW()
  WHERE auth_user_id = target_user_id;

  RETURN json_build_object(
    'success', true,
    'message', 'User reactivated successfully',
    'target_user_id', target_user_id,
    'reason', reason
  );
END;
$$;

-- Function to suspend user (simplified for compatibility)
CREATE OR REPLACE FUNCTION superadmin_suspend_user(
  target_user_id UUID,
  reason TEXT DEFAULT 'Administrative action'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if current user is superadmin
  IF NOT is_superadmin() THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Access denied: Superadmin privileges required'
    );
  END IF;

  -- Suspend user (using basic approach for compatibility)
  UPDATE public.users 
  SET 
    is_active = false,
    updated_at = NOW()
  WHERE auth_user_id = target_user_id
  AND role != 'super_admin'; -- Prevent suspending other superadmins

  IF FOUND THEN
    RETURN json_build_object(
      'success', true,
      'message', 'User suspended successfully',
      'target_user_id', target_user_id,
      'reason', reason
    );
  ELSE
    RETURN json_build_object(
      'success', false,
      'error', 'User not found or cannot be suspended'
    );
  END IF;
END;
$$;

-- ============================================================================
-- PART 4: DASHBOARD AND UTILITY FUNCTIONS
-- ============================================================================

-- Function to get basic superadmin dashboard data
CREATE OR REPLACE FUNCTION get_superadmin_dashboard_data()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
  user_stats JSON;
BEGIN
  -- Check if current user is superadmin
  IF NOT is_superadmin() THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Access denied: Superadmin privileges required'
    );
  END IF;

  -- Get user statistics
  SELECT json_build_object(
    'total_users', COUNT(*),
    'active_users', COUNT(*) FILTER (WHERE is_active = true),
    'inactive_users', COUNT(*) FILTER (WHERE is_active = false),
    'superadmins', COUNT(*) FILTER (WHERE role = 'super_admin' AND is_active = true),
    'principals', COUNT(*) FILTER (WHERE role IN ('principal', 'principal_admin') AND is_active = true),
    'teachers', COUNT(*) FILTER (WHERE role = 'teacher' AND is_active = true),
    'parents', COUNT(*) FILTER (WHERE role = 'parent' AND is_active = true)
  ) INTO user_stats
  FROM public.users;

  -- Build result
  result := json_build_object(
    'success', true,
    'data', json_build_object(
      'user_stats', user_stats,
      'generated_at', NOW()
    )
  );

  RETURN result;
END;
$$;

-- Function to test superadmin system functionality
CREATE OR REPLACE FUNCTION test_superadmin_system()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
  superadmin_count INTEGER;
  current_user_role TEXT;
BEGIN
  -- Get superadmin count
  SELECT COUNT(*) INTO superadmin_count
  FROM public.users 
  WHERE role = 'super_admin' AND is_active = true;

  -- Get current user role
  SELECT role INTO current_user_role
  FROM public.users 
  WHERE auth_user_id = auth.uid();

  result := json_build_object(
    'test_suite', 'Superadmin System Test',
    'run_at', NOW(),
    'superadmin_count', superadmin_count,
    'current_user_role', current_user_role,
    'current_user_id', auth.uid(),
    'is_superadmin', is_superadmin(),
    'system_status', CASE 
      WHEN superadmin_count > 0 THEN 'operational'
      ELSE 'no_superadmins'
    END
  );

  RETURN result;
END;
$$;

-- Function to get all superadmin users
CREATE OR REPLACE FUNCTION get_superadmin_users()
RETURNS TABLE (
  id UUID,
  auth_user_id UUID,
  email TEXT,
  name TEXT,
  role TEXT,
  is_active BOOLEAN,
  updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    u.id,
    u.auth_user_id,
    u.email,
    COALESCE(u.name, u.first_name || ' ' || u.last_name, u.email) as name,
    u.role::text,
    u.is_active,
    u.updated_at,
    u.created_at
  FROM public.users u
  WHERE u.role = 'super_admin'
  ORDER BY u.created_at DESC;
$$;

-- ============================================================================
-- PART 5: GRANT PERMISSIONS
-- ============================================================================

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION is_superadmin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_superadmin_by_id(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_superadmin_dashboard_data() TO authenticated;
GRANT EXECUTE ON FUNCTION test_superadmin_system() TO authenticated;
GRANT EXECUTE ON FUNCTION get_superadmin_users() TO authenticated;
GRANT EXECUTE ON FUNCTION superadmin_reactivate_user(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION superadmin_suspend_user(UUID, TEXT) TO authenticated;

-- ============================================================================
-- PART 6: COMPLETION LOGGING
-- ============================================================================

-- Log migration completion
INSERT INTO public.config_kv (key, value, description, is_public)
VALUES (
  'superadmin_functions_fix_20250919195200',
  json_build_object(
    'version', '1.0.0',
    'completed_at', now()::TEXT,
    'functions_recreated', 7,
    'migration_file', '20250919195200_recreate_superadmin_functions.sql'
  ),
  'Superadmin functions recreation migration completion log',
  FALSE
) ON CONFLICT (key) DO UPDATE SET
  value = excluded.value,
  updated_at = now();

SELECT 'SUPERADMIN FUNCTIONS RECREATED' AS status;

COMMIT;
