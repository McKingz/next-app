-- Migration: assign_all_teachers_to_subscription RPC
-- Created: 2025-09-21
-- Purpose: Allow principals to bulk-assign all teachers in a school to a subscription's seats
-- WARP.md compliance: SECURITY DEFINER, search_path pinned, no direct RLS bypass outside function

-- Drop if exists to keep idempotent
DROP FUNCTION IF EXISTS public.assign_all_teachers_to_subscription(uuid, uuid);

CREATE OR REPLACE FUNCTION public.assign_all_teachers_to_subscription(
  p_subscription_id uuid,
  p_school_id uuid
)
RETURNS TABLE (
  user_id uuid,
  assigned boolean,
  reason text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub record;
  v_current_used integer;
  v_teacher_id uuid;
BEGIN
  -- Load subscription
  SELECT * INTO v_sub FROM public.subscriptions WHERE id = p_subscription_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription not found';
  END IF;

  -- Iterate all teacher ids for the school from profiles (preferred)
  FOR v_teacher_id IN
    SELECT p.id
    FROM public.profiles p
    WHERE p.preschool_id = p_school_id
      AND p.role = 'teacher'
  LOOP
    -- Skip if already has active seat
    IF EXISTS (
      SELECT 1 FROM public.subscription_seats s
      WHERE s.subscription_id = p_subscription_id AND s.user_id = v_teacher_id AND s.is_active = true
    ) THEN
      user_id := v_teacher_id; assigned := false; reason := 'already_assigned'; RETURN NEXT;
      CONTINUE;
    END IF;

    -- Capacity check
    SELECT COUNT(*) INTO v_current_used FROM public.subscription_seats s
      WHERE s.subscription_id = p_subscription_id AND s.is_active = true;

    IF COALESCE(v_current_used, 0) >= COALESCE(v_sub.seats_total, 0) THEN
      user_id := v_teacher_id; assigned := false; reason := 'no_capacity'; RETURN NEXT;
      CONTINUE;
    END IF;

    -- Assign
    INSERT INTO public.subscription_seats (subscription_id, user_id, assigned_by)
    VALUES (p_subscription_id, v_teacher_id, (SELECT id FROM public.users WHERE auth_user_id = auth.uid()))
    ON CONFLICT DO NOTHING;

    -- Recount seats_used
    UPDATE public.subscriptions s
      SET seats_used = (
        SELECT COUNT(*) FROM public.subscription_seats ss
        WHERE ss.subscription_id = p_subscription_id AND ss.is_active = true
      ),
      updated_at = now()
    WHERE s.id = p_subscription_id;

    user_id := v_teacher_id; assigned := true; reason := NULL; RETURN NEXT;
  END LOOP;

  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_all_teachers_to_subscription(uuid, uuid) TO authenticated;
