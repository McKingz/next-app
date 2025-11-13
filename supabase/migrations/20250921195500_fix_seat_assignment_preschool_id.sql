-- Migration: Fix preschool_id constraint violation in seat assignment RPC
-- Created: 2025-09-21 19:55:00
-- Purpose: Update rpc_assign_teacher_seat to include preschool_id in INSERT statement

-- ====================================================================
-- FIX ASSIGN TEACHER SEAT RPC
-- ====================================================================

CREATE OR REPLACE FUNCTION public.rpc_assign_teacher_seat(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_service boolean := public.util_is_service_role();
  v_school uuid := public.util_caller_principal_school();
  v_subscription_id uuid;
  v_limit int;
  v_used int;
  v_target_user_db_id uuid;
  v_assigned_by_db_id uuid;
BEGIN
  -- Authorization check
  IF NOT v_is_service AND v_school IS NULL THEN
    RAISE EXCEPTION 'Only principals can assign teacher seats';
  END IF;

  -- Service role path: infer school from target user
  IF v_is_service AND v_school IS NULL THEN
    SELECT preschool_id INTO v_school 
    FROM public.profiles 
    WHERE id = target_user_id;
    
    IF v_school IS NULL THEN
      RAISE EXCEPTION 'Cannot infer preschool for target user';
    END IF;
  END IF;

  -- Acquire advisory lock for concurrency control
  IF NOT public.util_acquire_school_lock(v_school) THEN
    RAISE EXCEPTION 'Seat assignment in progress; please retry';
  END IF;

  -- Verify target is teacher in same school (profiles.id is auth user id)
  PERFORM 1 
  FROM public.profiles
  WHERE id = target_user_id 
    AND preschool_id = v_school 
    AND role = 'teacher';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target must be a teacher in the same preschool';
  END IF;

  -- Get active subscription for the school
  SELECT id INTO v_subscription_id
  FROM public.subscriptions
  WHERE school_id = v_school
    AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;
  IF v_subscription_id IS NULL THEN
    RAISE EXCEPTION 'No active subscription found for school';
  END IF;

  -- Map target auth user id (profiles.id) -> users.id for subscription_seats.user_id
  SELECT id INTO v_target_user_db_id
  FROM public.users
  WHERE auth_user_id = target_user_id;
  IF v_target_user_db_id IS NULL THEN
    RAISE EXCEPTION 'Cannot find user record for target user ID';
  END IF;

  -- Prevent duplicate active seat for this user and subscription
  PERFORM 1
  FROM public.subscription_seats
  WHERE subscription_id = v_subscription_id
    AND user_id = v_target_user_db_id
    AND revoked_at IS NULL;
  IF FOUND THEN
    RETURN jsonb_build_object('status', 'already_assigned');
  END IF;

  -- Capacity check based on plan limit
  SELECT sp.max_teachers INTO v_limit
  FROM public.subscriptions s
  JOIN public.subscription_plans sp ON sp.id = s.plan_id
  WHERE s.id = v_subscription_id;

  IF v_limit IS NOT NULL THEN
    SELECT COUNT(*) INTO v_used
    FROM public.subscription_seats
    WHERE subscription_id = v_subscription_id
      AND revoked_at IS NULL;

    IF v_used >= v_limit THEN
      RAISE EXCEPTION 'No teacher seats available for this plan (used: %, limit: %)', v_used, v_limit;
    END IF;
  END IF;

  -- Map caller auth uid -> users.id for assigned_by (FK references users.id on some schemas)
  SELECT id INTO v_assigned_by_db_id
  FROM public.users
  WHERE auth_user_id = auth.uid();
  -- If not found (edge case), allow NULL to avoid FK violation

  -- Assign the seat - INCLUDING preschool_id to fix constraint violation
  INSERT INTO public.subscription_seats (
    subscription_id,
    user_id,
    assigned_at,
    assigned_by,
    preschool_id  -- THIS WAS MISSING AND CAUSING THE ERROR
  ) VALUES (
    v_subscription_id,
    v_target_user_db_id,
    NOW(),
    v_assigned_by_db_id,
    v_school  -- Use the school ID we already have
  );

  -- Update seats_used counter
  UPDATE public.subscriptions
  SET seats_used = (
    SELECT COUNT(*)
    FROM public.subscription_seats
    WHERE subscription_id = v_subscription_id
      AND revoked_at IS NULL
  ),
  updated_at = NOW()
  WHERE id = v_subscription_id;

  RETURN jsonb_build_object('status', 'assigned');
END;
$$;

-- ====================================================================
-- UPDATE REVOKE FUNCTION TO INCLUDE PRESCHOOL_ID IN QUERIES
-- ====================================================================

CREATE OR REPLACE FUNCTION public.rpc_revoke_teacher_seat(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_service boolean := public.util_is_service_role();
  v_school uuid := public.util_caller_principal_school();
  v_subscription_id uuid;
  v_updated_rows int;
  v_target_user_db_id uuid;
BEGIN
  -- Authorization check
  IF NOT v_is_service AND v_school IS NULL THEN
    RAISE EXCEPTION 'Only principals can revoke teacher seats';
  END IF;

  -- Service role path: infer school from target user
  IF v_is_service AND v_school IS NULL THEN
    SELECT preschool_id INTO v_school 
    FROM public.profiles 
    WHERE id = target_user_id;
  END IF;
  
  IF v_school IS NULL THEN
    RAISE EXCEPTION 'Cannot determine school for operation';
  END IF;

  -- Acquire advisory lock for concurrency control
  IF NOT public.util_acquire_school_lock(v_school) THEN
    RAISE EXCEPTION 'Seat update in progress; please retry';
  END IF;

  -- Get active subscription for the school
  SELECT id INTO v_subscription_id
  FROM public.subscriptions
  WHERE school_id = v_school
    AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_subscription_id IS NULL THEN
    RAISE EXCEPTION 'No active subscription found for school';
  END IF;

  -- Get the corresponding users.id for the target auth user ID
  SELECT id INTO v_target_user_db_id
  FROM public.users
  WHERE auth_user_id = target_user_id;
  
  IF v_target_user_db_id IS NULL THEN
    RAISE EXCEPTION 'Cannot find user record for target user ID';
  END IF;

  -- Revoke the seat (soft delete via revoked_at timestamp)
  -- Now also checking preschool_id for extra safety
  UPDATE public.subscription_seats
  SET 
    revoked_at = NOW(),
    revoked_by = COALESCE(auth.uid(), target_user_id)
  WHERE subscription_id = v_subscription_id
    AND user_id = v_target_user_db_id
    AND preschool_id = v_school  -- Added for consistency
    AND revoked_at IS NULL;
  
  GET DIAGNOSTICS v_updated_rows = ROW_COUNT;

  IF v_updated_rows = 0 THEN
    RETURN jsonb_build_object('status', 'no_active_seat');
  END IF;
  
  -- Update seats_used counter in subscriptions table
  UPDATE public.subscriptions 
  SET 
    seats_used = (
      SELECT COUNT(*) 
      FROM public.subscription_seats 
      WHERE subscription_id = v_subscription_id 
        AND (revoked_at IS NULL)
    ),
    updated_at = NOW()
  WHERE id = v_subscription_id;

  RETURN jsonb_build_object('status', 'revoked');
END;
$$;

-- ====================================================================
-- UPDATE LIST SEATS FUNCTION TO INCLUDE PRESCHOOL_ID
-- ====================================================================

CREATE OR REPLACE FUNCTION public.rpc_list_teacher_seats()
RETURNS TABLE (
  user_id uuid,
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
        ss.user_id,
        ss.assigned_at, 
        ss.revoked_at,
        ss.assigned_by,
        ss.revoked_by
      FROM public.subscription_seats ss
      WHERE ss.subscription_id = v_subscription_id
        AND ss.preschool_id = v_school  -- Added for consistency
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
      ss.user_id,
      ss.assigned_at, 
      ss.revoked_at,
      ss.assigned_by,
      ss.revoked_by
    FROM public.subscription_seats ss
    WHERE ss.user_id = v_teacher_user_db_id
    ORDER BY ss.assigned_at DESC;
  END;
END;
$$;

-- ====================================================================
-- GRANT PERMISSIONS
-- ====================================================================

-- Maintain existing permissions
GRANT EXECUTE ON FUNCTION public.rpc_assign_teacher_seat(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_revoke_teacher_seat(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_teacher_seat_limits() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_list_teacher_seats() TO authenticated, service_role;

-- ====================================================================
-- MIGRATION LOG
-- ====================================================================

-- Log migration completion
INSERT INTO public.config_kv (key, value, description, is_public)
VALUES (
  'seat_management_preschool_id_fix_20250921',
  jsonb_build_object(
    'completed_at', now(),
    'issue_fixed', 'null value in column "preschool_id" violates not-null constraint',
    'functions_updated', ARRAY[
      'rpc_assign_teacher_seat',
      'rpc_revoke_teacher_seat',
      'rpc_list_teacher_seats'
    ],
    'changes_made', ARRAY[
      'Added preschool_id to INSERT statement in rpc_assign_teacher_seat',
      'Added preschool_id check to UPDATE in rpc_revoke_teacher_seat',
      'Added preschool_id filter to SELECT in rpc_list_teacher_seats'
    ]
  ),
  'Fix for subscription seats preschool_id constraint violation',
  FALSE
) ON CONFLICT (key) DO UPDATE SET
  value = excluded.value,
  updated_at = now();

-- ====================================================================
-- SUCCESS MESSAGE
-- ====================================================================

SELECT 'SEAT ASSIGNMENT PRESCHOOL_ID CONSTRAINT FIXED' AS status;
