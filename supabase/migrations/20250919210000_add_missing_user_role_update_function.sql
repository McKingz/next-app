-- Add Missing User Role Update Function Migration
-- Date: 2025-09-19
-- Purpose: Add the superadmin_update_user_role function that is called by the UI
-- WARP.md Compliance: Supabase migration, production-safe, forward-only
-- Authority: Fix missing RPC function called by user management UI

BEGIN;

-- ============================================================================
-- PART 1: USER ROLE UPDATE FUNCTION
-- ============================================================================

-- Function to update user role (called by UI but was missing)
CREATE OR REPLACE FUNCTION superadmin_update_user_role(
  target_user_id UUID,
  new_role TEXT,
  reason TEXT DEFAULT 'Administrative role change'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_user RECORD;
  old_role TEXT;
BEGIN
  -- Check if current user is superadmin
  IF NOT is_superadmin() THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Access denied: Superadmin privileges required'
    );
  END IF;

  -- Validate new role
  IF new_role NOT IN ('principal', 'teacher', 'parent', 'super_admin') THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Invalid role. Must be: principal, teacher, parent, or super_admin'
    );
  END IF;

  -- Get target user info and current role
  SELECT * INTO target_user
  FROM public.users
  WHERE auth_user_id = target_user_id;

  -- Check if user exists
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'User not found'
    );
  END IF;

  old_role := target_user.role;

  -- Prevent changing role from/to superadmin unless current user is superadmin
  IF (old_role = 'super_admin' OR new_role = 'super_admin') AND NOT is_superadmin() THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Cannot change superadmin role'
    );
  END IF;

  -- Update the user role
  UPDATE public.users
  SET 
    role = new_role::text,
    updated_at = NOW()
  WHERE auth_user_id = target_user_id;

  -- Log the role change
  INSERT INTO error_logs (level, message, source, details)
  VALUES (
    'info',
    'User role updated by superadmin',
    'user_management',
    json_build_object(
      'target_user_id', target_user_id,
      'target_email', target_user.email,
      'old_role', old_role,
      'new_role', new_role,
      'reason', reason,
      'admin_user_id', auth.uid()
    )
  );

  RETURN json_build_object(
    'success', true,
    'message', 'User role updated successfully',
    'target_user_id', target_user_id,
    'old_role', old_role,
    'new_role', new_role,
    'reason', reason
  );
END;
$$;

-- ============================================================================
-- PART 2: GRANT PERMISSIONS
-- ============================================================================

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION superadmin_update_user_role(UUID, TEXT, TEXT) TO authenticated;

-- ============================================================================
-- PART 3: COMPLETION LOGGING
-- ============================================================================

-- Log migration completion
INSERT INTO public.config_kv (key, value, description, is_public)
VALUES (
  'missing_user_role_update_20250919210000',
  json_build_object(
    'version', '1.0.0',
    'completed_at', now()::TEXT,
    'functions_created', 1,
    'migration_file', '20250919210000_add_missing_user_role_update_function.sql'
  ),
  'Missing user role update function migration completion log',
  FALSE
) ON CONFLICT (key) DO UPDATE SET
  value = excluded.value,
  updated_at = now();

SELECT 'MISSING USER ROLE UPDATE FUNCTION ADDED' AS status;

COMMIT;
