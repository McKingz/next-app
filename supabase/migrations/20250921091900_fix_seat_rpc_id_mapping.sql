-- Migration: Fix seat RPC functions to handle ID mapping correctly
-- Created: 2025-09-21 09:19:00
-- Purpose: Update RPC functions to map between profiles.id (auth user ID) and users.id (database ID)

-- ====================================================================
-- UPDATE ASSIGN TEACHER SEAT RPC
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

  -- Get the corresponding users.id for the target auth user ID (needed for seat operations)
  SELECT id INTO v_target_user_db_id
  FROM public.users
  WHERE auth_user_id = target_user_id;
  
  IF v_target_user_db_id IS NULL THEN
    RAISE EXCEPTION 'Cannot find user record for target user ID';
  END IF;
  
  -- Check for duplicate active seat using the mapped user ID
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
-- UPDATE REVOKE TEACHER SEAT RPC
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
-- GRANT PERMISSIONS
-- ====================================================================

-- Grant execution to authenticated users and service_role
GRANT EXECUTE ON FUNCTION public.rpc_assign_teacher_seat(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_revoke_teacher_seat(uuid) TO authenticated, service_role;

-- ====================================================================
-- COMPLETION LOG
-- ====================================================================

SELECT 'SEAT RPC ID MAPPING FIXED' AS status;
