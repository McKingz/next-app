-- Migration: Robust seat management RPCs for subscription_seats table
-- Created: 2025-09-21
-- Purpose: Create secure SECURITY DEFINER RPCs for seat assignment/revocation
-- WARP.md compliance: All operations via RPCs, no direct table access

-- ====================================================================
-- PART 1: DROP EXISTING FUNCTIONS (clean slate)
-- ====================================================================

DROP FUNCTION IF EXISTS public.rpc_assign_teacher_seat(uuid);
DROP FUNCTION IF EXISTS public.rpc_revoke_teacher_seat(uuid);
DROP FUNCTION IF EXISTS public.rpc_teacher_seat_limits();
DROP FUNCTION IF EXISTS public.rpc_list_teacher_seats();

-- ====================================================================
-- PART 2: ASSIGN TEACHER SEAT RPC
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

  -- Verify target is teacher in same school
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

  -- Get the corresponding users.id for the target auth user ID (needed for seat checks)
  SELECT id INTO v_target_user_db_id
  FROM public.users
  WHERE auth_user_id = target_user_id;
  
  IF v_target_user_db_id IS NULL THEN
    RAISE EXCEPTION 'Cannot find user record for target user ID';
  END IF;
  
  -- Check for duplicate active seat
  PERFORM 1 
  FROM public.subscription_seats
  WHERE subscription_id = v_subscription_id 
    AND user_id = v_target_user_db_id 
    AND (revoked_at IS NULL);
    
  IF FOUND THEN
    RETURN jsonb_build_object('status', 'already_assigned');
  END IF;

  -- Get plan limit from subscription_plans via max_teachers
  SELECT sp.max_teachers INTO v_limit
  FROM public.subscriptions s
  INNER JOIN public.subscription_plans sp ON sp.id = s.plan_id
  WHERE s.id = v_subscription_id;
  
  -- Check capacity if limit exists
  IF v_limit IS NOT NULL THEN
    SELECT COUNT(*) INTO v_used
    FROM public.subscription_seats
    WHERE subscription_id = v_subscription_id 
      AND (revoked_at IS NULL);

    IF v_used >= v_limit THEN
      RAISE EXCEPTION 'No teacher seats available for this plan (used: %, limit: %)', v_used, v_limit;
    END IF;
  END IF;

  -- Assign the seat using the users.id (database ID)
  INSERT INTO public.subscription_seats (
    subscription_id, 
    user_id, 
    assigned_at,
    assigned_by
  )
  VALUES (
    v_subscription_id, 
    v_target_user_db_id, 
    NOW(),
    COALESCE(auth.uid(), target_user_id)
  );
  
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

  RETURN jsonb_build_object('status', 'assigned');
END;
$$;

-- ====================================================================
-- PART 3: REVOKE TEACHER SEAT RPC
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
  UPDATE public.subscription_seats
  SET 
    revoked_at = NOW(),
    revoked_by = COALESCE(auth.uid(), target_user_id)
  WHERE subscription_id = v_subscription_id
    AND user_id = v_target_user_db_id
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
-- PART 4: GET SEAT LIMITS RPC (for UI display)
-- ====================================================================

CREATE OR REPLACE FUNCTION public.rpc_teacher_seat_limits()
RETURNS TABLE ("limit" int, used int, available int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school uuid := public.util_caller_principal_school();
  v_subscription_id uuid;
  v_limit int;
  v_used int;
BEGIN
  -- Allow teachers to query for their school too
  IF v_school IS NULL AND NOT public.util_is_service_role() THEN
    SELECT preschool_id INTO v_school 
    FROM public.profiles 
    WHERE id = auth.uid();
  END IF;

  IF v_school IS NULL THEN
    RAISE EXCEPTION 'Cannot determine preschool for caller';
  END IF;

  -- Get active subscription and its plan limit
  SELECT s.id, sp.max_teachers 
  INTO v_subscription_id, v_limit
  FROM public.subscriptions s
  INNER JOIN public.subscription_plans sp ON sp.id = s.plan_id
  WHERE s.school_id = v_school
    AND s.status = 'active'
  ORDER BY s.created_at DESC
  LIMIT 1;
  
  -- If no subscription, return zeros
  IF v_subscription_id IS NULL THEN
    RETURN QUERY SELECT NULL::int, 0, 0;
    RETURN;
  END IF;

  -- Count active seats
  SELECT COUNT(*) INTO v_used
  FROM public.subscription_seats
  WHERE subscription_id = v_subscription_id 
    AND (revoked_at IS NULL);

  RETURN QUERY
  SELECT 
    v_limit,
    v_used,
    CASE 
      WHEN v_limit IS NULL THEN NULL
      ELSE GREATEST(v_limit - v_used, 0)
    END AS available;
END;
$$;

-- ====================================================================
-- PART 5: LIST SEATS RPC (for management UI)
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
      ORDER BY ss.assigned_at DESC;
    END IF;
    
    RETURN;
  END IF;

  -- Teachers see only their own seats
  RETURN QUERY
  SELECT 
    ss.user_id,
    ss.assigned_at, 
    ss.revoked_at,
    ss.assigned_by,
    ss.revoked_by
  FROM public.subscription_seats ss
  WHERE ss.user_id = v_caller
  ORDER BY ss.assigned_at DESC;
END;
$$;

-- ====================================================================
-- PART 6: GRANT PERMISSIONS
-- ====================================================================

-- Grant execution to authenticated users and service_role
GRANT EXECUTE ON FUNCTION public.rpc_assign_teacher_seat(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_revoke_teacher_seat(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_teacher_seat_limits() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_list_teacher_seats() TO authenticated, service_role;

-- ====================================================================
-- PART 7: FUNCTION COMMENTS
-- ====================================================================

COMMENT ON FUNCTION public.rpc_assign_teacher_seat(uuid) IS
'Assigns a teacher seat to a user. Principals only. Enforces plan limits and same-school validation.';

COMMENT ON FUNCTION public.rpc_revoke_teacher_seat(uuid) IS
'Revokes a teacher seat from a user. Principals only. Soft delete via revoked_at timestamp.';

COMMENT ON FUNCTION public.rpc_teacher_seat_limits() IS
'Returns seat limits for callers school: limit, used, available. For UI display.';

COMMENT ON FUNCTION public.rpc_list_teacher_seats() IS
'Lists teacher seats. Principals see all school seats, teachers see own seats only.';

-- ====================================================================
-- PART 8: VERIFICATION AND LOGGING
-- ====================================================================

-- Log migration completion
INSERT INTO public.config_kv (key, value, description, is_public)
VALUES (
  'seat_management_rpcs_20250921',
  jsonb_build_object(
    'completed_at', now(),
    'functions_created', ARRAY[
      'rpc_assign_teacher_seat',
      'rpc_revoke_teacher_seat',
      'rpc_teacher_seat_limits',
      'rpc_list_teacher_seats'
    ],
    'table_used', 'subscription_seats',
    'security_model', 'SECURITY DEFINER RPCs with principal authorization',
    'plan_limit_source', 'subscription_plans.max_teachers'
  ),
  'Seat management RPCs completion log',
  FALSE
) ON CONFLICT (key) DO UPDATE SET
  value = excluded.value,
  updated_at = now();

SELECT 'SEAT MANAGEMENT RPCS CREATED' AS status;
