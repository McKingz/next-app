-- Migration: Fix assigned_by mapping in rpc_assign_teacher_seat
-- Created: 2025-09-21 09:23:50

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

  -- Assign the seat
  INSERT INTO public.subscription_seats (
    subscription_id,
    user_id,
    assigned_at,
    assigned_by
  ) VALUES (
    v_subscription_id,
    v_target_user_db_id,
    NOW(),
    v_assigned_by_db_id
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
