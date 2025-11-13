-- Helper function to set user role to principal
-- This is useful for onboarding flows where users need to create organizations

CREATE OR REPLACE FUNCTION public.set_user_as_principal(
  p_user_id UUID
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_role TEXT;
  v_result JSONB;
BEGIN
  -- Check if user exists
  SELECT role INTO v_current_role
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_current_role IS NULL THEN
    RAISE EXCEPTION 'User not found' USING ERRCODE = '22023';
  END IF;

  -- Update role to principal if not already
  IF v_current_role != 'principal' AND v_current_role != 'superadmin' THEN
    UPDATE public.profiles
    SET role = 'principal'
    WHERE id = p_user_id;

    v_result := jsonb_build_object(
      'success', TRUE,
      'message', 'Role updated to principal',
      'previous_role', v_current_role,
      'new_role', 'principal'
    );
  ELSE
    v_result := jsonb_build_object(
      'success', TRUE,
      'message', 'User already has elevated role',
      'current_role', v_current_role
    );
  END IF;

  RETURN v_result;
END;
$$;

-- Grant execute to authenticated users (so they can set themselves)
GRANT EXECUTE ON FUNCTION public.set_user_as_principal(UUID) TO authenticated;

COMMENT ON FUNCTION public.set_user_as_principal IS
'Set a user role to principal. Used during onboarding to enable organization creation.';
