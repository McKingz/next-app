-- ============================================================================
-- MIGRATION: Fix All Missing Functions Referenced in Grants
-- ============================================================================

-- This migration creates all the functions that are referenced in GRANT statements
-- but may not exist yet, preventing migration conflicts

-- ============================================================================
-- MISSING FUNCTION: superadmin_request_user_deletion
-- ============================================================================

CREATE OR REPLACE FUNCTION superadmin_request_user_deletion(
  target_user_id UUID,
  deletion_type DELETION_TYPE_ENUM,
  reason TEXT,
  scheduled_date TIMESTAMPTZ DEFAULT now() + INTERVAL '7 days'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  request_id UUID;
BEGIN
  -- Check if current user is superadmin
  IF NOT is_superadmin() THEN
    RAISE EXCEPTION 'Access denied: Superadmin privileges required';
  END IF;

  -- Validate target user exists
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = target_user_id) THEN
    RAISE EXCEPTION 'Target user not found: %', target_user_id;
  END IF;

  -- Create deletion request
  INSERT INTO superadmin_user_deletion_requests (
    admin_user_id,
    target_user_id,
    deletion_type,
    reason,
    scheduled_date,
    status
  ) VALUES (
    auth.uid(),
    target_user_id,
    deletion_type,
    reason,
    scheduled_date,
    'pending'
  ) RETURNING id INTO request_id;

  -- Log the action
  PERFORM log_superadmin_action(
    'user_deletion_requested'::superadmin_action_enum,
    json_build_object(
      'target_user_id', target_user_id,
      'deletion_type', deletion_type,
      'scheduled_date', scheduled_date,
      'request_id', request_id
    )::jsonb
  );

  RETURN json_build_object(
    'success', true,
    'request_id', request_id,
    'message', 'Deletion request created successfully'
  );
END;
$$;

-- ============================================================================
-- MISSING FUNCTION: superadmin_suspend_user  
-- ============================================================================

CREATE OR REPLACE FUNCTION superadmin_suspend_user(
  target_user_id UUID,
  suspension_type SUSPENSION_STATUS_ENUM,
  reason TEXT,
  duration_days INTEGER DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  expires_at TIMESTAMPTZ;
BEGIN
  -- Check if current user is superadmin
  IF NOT is_superadmin() THEN
    RAISE EXCEPTION 'Access denied: Superadmin privileges required';
  END IF;

  -- Calculate expiration if duration provided
  IF duration_days IS NOT NULL THEN
    expires_at := NOW() + (duration_days || ' days')::INTERVAL;
  END IF;

  -- Update user suspension status
  UPDATE public.users 
  SET 
    suspension_status = suspension_type,
    suspension_reason = reason,
    suspended_at = NOW(),
    suspension_expires_at = expires_at,
    is_active = CASE WHEN suspension_type = 'suspended' THEN false ELSE is_active END
  WHERE auth_user_id = target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target user not found: %', target_user_id;
  END IF;

  -- Log the action
  PERFORM log_superadmin_action(
    'user_suspended'::superadmin_action_enum,
    json_build_object(
      'target_user_id', target_user_id,
      'suspension_type', suspension_type,
      'duration_days', duration_days,
      'expires_at', expires_at
    )::jsonb
  );

  RETURN json_build_object(
    'success', true,
    'message', format('User %s successfully', suspension_type::text),
    'expires_at', expires_at
  );
END;
$$;

-- ============================================================================
-- MISSING FUNCTION: superadmin_update_user_role
-- ============================================================================

CREATE OR REPLACE FUNCTION superadmin_update_user_role(
  target_user_id UUID,
  new_role TEXT,
  reason TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  old_role TEXT;
  user_email TEXT;
BEGIN
  -- Check if current user is superadmin
  IF NOT is_superadmin() THEN
    RAISE EXCEPTION 'Access denied: Superadmin privileges required';
  END IF;

  -- Get current role and email
  SELECT role, email INTO old_role, user_email
  FROM public.users 
  WHERE auth_user_id = target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target user not found: %', target_user_id;
  END IF;

  -- Update user role
  UPDATE public.users 
  SET 
    role = new_role,
    updated_at = NOW()
  WHERE auth_user_id = target_user_id;

  -- Log the action
  PERFORM log_superadmin_action(
    'user_role_updated'::superadmin_action_enum,
    json_build_object(
      'target_user_id', target_user_id,
      'old_role', old_role,
      'new_role', new_role,
      'user_email', user_email,
      'reason', reason
    )::jsonb
  );

  RETURN json_build_object(
    'success', true,
    'message', format('User role updated from %s to %s', old_role::text, new_role::text),
    'old_role', old_role,
    'new_role', new_role
  );
END;
$$;

-- ============================================================================
-- FUNCTION GRANTS FOR ALL MISSING FUNCTIONS
-- ============================================================================

-- Grant execute permissions to authenticated users (will be checked by functions internally)
GRANT EXECUTE ON FUNCTION superadmin_request_user_deletion(
  UUID, DELETION_TYPE_ENUM, TEXT, TIMESTAMPTZ
) TO authenticated;
GRANT EXECUTE ON FUNCTION superadmin_suspend_user(UUID, SUSPENSION_STATUS_ENUM, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION superadmin_update_user_role(UUID, TEXT, TEXT) TO authenticated;

-- ============================================================================
-- LOG MIGRATION COMPLETION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Migration 20250919195300_fix_all_missing_functions.sql completed successfully';
  RAISE NOTICE 'Created missing functions: superadmin_request_user_deletion, superadmin_suspend_user, superadmin_update_user_role';
  RAISE NOTICE 'All function grants should now resolve correctly';
END $$;
