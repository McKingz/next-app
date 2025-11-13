-- Migration: Fix seat listing to return auth_user_id for proper comparison
-- Created: 2025-09-21 20:20:00
-- Purpose: Update rpc_list_teacher_seats to return auth_user_id instead of users.id

-- First drop the existing function
DROP FUNCTION IF EXISTS public.rpc_list_teacher_seats();

-- Recreate with auth_user_id mapping
CREATE OR REPLACE FUNCTION public.rpc_list_teacher_seats()
RETURNS TABLE (
  user_id uuid,  -- This will now contain auth_user_id for proper comparison
  assigned_at timestamptz,
  revoked_at timestamptz,
  assigned_by uuid,
  revoked_by uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school uuid := public.util_caller_principal_school();
  v_caller uuid := auth.uid();
  v_subscription_id uuid;
BEGIN
  -- Principals see all seats for their school
  IF v_school IS NOT NULL THEN
    -- Get active subscription
    SELECT id INTO v_subscription_id
    FROM public.subscriptions
    WHERE school_id = v_school
      AND status = 'active'
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF v_subscription_id IS NOT NULL THEN
      RETURN QUERY
      SELECT 
        u.auth_user_id as user_id,  -- Return auth_user_id instead of users.id
        ss.assigned_at, 
        ss.revoked_at,
        ss.assigned_by,
        ss.revoked_by
      FROM public.subscription_seats ss
      JOIN public.users u ON u.id = ss.user_id  -- Join to get auth_user_id
      WHERE ss.subscription_id = v_subscription_id
        AND ss.preschool_id = v_school
      ORDER BY ss.assigned_at DESC;
    END IF;
    
    RETURN;
  END IF;

  -- Teachers see only their own seats
  -- First get the teacher's users.id
  DECLARE
    v_teacher_user_db_id uuid;
  BEGIN
    SELECT id INTO v_teacher_user_db_id
    FROM public.users
    WHERE auth_user_id = v_caller;
    
    RETURN QUERY
    SELECT 
      u.auth_user_id as user_id,  -- Return auth_user_id instead of users.id
      ss.assigned_at, 
      ss.revoked_at,
      ss.assigned_by,
      ss.revoked_by
    FROM public.subscription_seats ss
    JOIN public.users u ON u.id = ss.user_id  -- Join to get auth_user_id
    WHERE ss.user_id = v_teacher_user_db_id
    ORDER BY ss.assigned_at DESC;
  END;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.rpc_list_teacher_seats() TO authenticated, service_role;

-- Create a simple view for debugging seat assignments
CREATE OR REPLACE VIEW public.v_active_teacher_seats AS
SELECT
  ss.id AS seat_id,
  ss.subscription_id,
  ss.preschool_id,
  ss.user_id AS users_table_id,
  u.auth_user_id,
  u.email,
  p.first_name,
  p.last_name,
  p.role,
  ss.assigned_at,
  ss.assigned_by,
  s.plan_id,
  s.status AS subscription_status
FROM public.subscription_seats AS ss
INNER JOIN public.users AS u ON ss.user_id = u.id
LEFT JOIN public.profiles AS p ON u.auth_user_id = p.id
LEFT JOIN public.subscriptions AS s ON ss.subscription_id = s.id
WHERE ss.revoked_at IS NULL;

-- Grant select permission on the view
GRANT SELECT ON public.v_active_teacher_seats TO authenticated;

-- ====================================================================
-- MIGRATION LOG
-- ====================================================================

INSERT INTO public.config_kv (key, value, description, is_public)
VALUES (
  'fix_seat_listing_auth_id_20250921',
  jsonb_build_object(
    'completed_at', now(),
    'issue_fixed', 'Teacher seat status not showing as active due to ID mismatch',
    'root_cause', 'rpc_list_teacher_seats was returning users.id but frontend was comparing with auth_user_id',
    'solution', 'Modified function to return auth_user_id as user_id field',
    'changes_made', ARRAY[
      'Dropped and recreated rpc_list_teacher_seats to return auth_user_id',
      'Created v_active_teacher_seats view for debugging',
      'Maintained backward compatibility by keeping same column names'
    ]
  ),
  'Fix for teacher seat ID comparison issue',
  FALSE
) ON CONFLICT (key) DO UPDATE SET
  value = excluded.value,
  updated_at = now();

-- ====================================================================
-- SUCCESS MESSAGE
-- ====================================================================

SELECT 'SEAT LISTING AUTH ID FIXED - Teachers should now see active seat status' AS status;
