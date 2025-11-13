-- ========================================
-- QUICK FIX: Run this in Supabase SQL Editor NOW
-- ========================================
-- This fixes seat revocation to work with any ID type

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
  IF NOT v_is_service AND v_school IS NULL THEN
    RAISE EXCEPTION 'Only principals can revoke teacher seats';
  END IF;

  IF v_is_service AND v_school IS NULL THEN
    SELECT preschool_id INTO v_school FROM public.profiles WHERE id = target_user_id;
  END IF;
  
  IF v_school IS NULL THEN
    RAISE EXCEPTION 'Cannot determine school for operation';
  END IF;

  IF NOT public.util_acquire_school_lock(v_school) THEN
    RAISE EXCEPTION 'Seat update in progress; please retry';
  END IF;

  SELECT id INTO v_subscription_id
  FROM public.subscriptions
  WHERE school_id = v_school AND status = 'active'
  ORDER BY created_at DESC LIMIT 1;
  
  IF v_subscription_id IS NULL THEN
    RAISE EXCEPTION 'No active subscription found for school';
  END IF;

  -- Try auth.users.id first
  SELECT id INTO v_target_user_db_id FROM public.users WHERE auth_user_id = target_user_id;
  
  -- Try users.id directly as fallback
  IF v_target_user_db_id IS NULL THEN
    SELECT id INTO v_target_user_db_id FROM public.users WHERE id = target_user_id;
  END IF;
  
  -- Try teachers table as last resort
  IF v_target_user_db_id IS NULL THEN
    SELECT user_id INTO v_target_user_db_id FROM public.teachers 
    WHERE id = target_user_id OR user_id = target_user_id OR auth_user_id = target_user_id;
  END IF;
  
  IF v_target_user_db_id IS NULL THEN
    RAISE EXCEPTION 'Cannot find user record for ID: %', target_user_id;
  END IF;

  UPDATE public.subscription_seats
  SET revoked_at = NOW(), revoked_by = COALESCE(auth.uid(), target_user_id)
  WHERE subscription_id = v_subscription_id
    AND user_id = v_target_user_db_id
    AND preschool_id = v_school
    AND revoked_at IS NULL;
  
  GET DIAGNOSTICS v_updated_rows = ROW_COUNT;

  IF v_updated_rows = 0 THEN
    RETURN jsonb_build_object('status', 'no_active_seat');
  END IF;
  
  UPDATE public.subscriptions 
  SET seats_used = (SELECT COUNT(*) FROM public.subscription_seats 
                    WHERE subscription_id = v_subscription_id AND revoked_at IS NULL),
      updated_at = NOW()
  WHERE id = v_subscription_id;

  RETURN jsonb_build_object('status', 'revoked');
END;
$$;
