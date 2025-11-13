-- Enhance invitation code validation to return school information
-- Date: 2025-10-26
-- Purpose: Return school name and meaningful details for better UX

-- Drop existing function first (return type changed from record to jsonb)
DROP FUNCTION IF EXISTS public.validate_invitation_code(text, text) CASCADE;

CREATE OR REPLACE FUNCTION public.validate_invitation_code(
  p_code text,
  p_email text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation public.school_invitation_codes%rowtype;
  v_school_name text;
  v_result jsonb;
BEGIN
  -- Find the invitation code
  SELECT * INTO v_invitation
  FROM public.school_invitation_codes
  WHERE code = p_code;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Invalid or expired invitation code'
    );
  END IF;

  -- Get school name
  SELECT name INTO v_school_name
  FROM public.preschools
  WHERE id = v_invitation.preschool_id;

  -- Build response with school details
  v_result := jsonb_build_object(
    'valid', true,
    'invitation_type', v_invitation.invitation_type,
    'is_active', v_invitation.is_active,
    'current_uses', COALESCE(v_invitation.current_uses, 0),
    'max_uses', v_invitation.max_uses,
    'expires_at', v_invitation.expires_at,
    'school_name', COALESCE(v_school_name, 'Unknown School'),
    'school_id', v_invitation.preschool_id
  );

  -- Add validation status messages
  IF NOT COALESCE(v_invitation.is_active, false) THEN
    v_result := jsonb_set(v_result, '{valid}', 'false'::jsonb);
    v_result := jsonb_set(v_result, '{error}', '"This invitation code is no longer active"'::jsonb);
    RETURN v_result;
  END IF;

  IF v_invitation.expires_at IS NOT NULL AND v_invitation.expires_at <= now() THEN
    v_result := jsonb_set(v_result, '{valid}', 'false'::jsonb);
    v_result := jsonb_set(v_result, '{error}', '"This invitation code has expired"'::jsonb);
    RETURN v_result;
  END IF;

  IF v_invitation.max_uses IS NOT NULL AND v_invitation.max_uses > 0
     AND COALESCE(v_invitation.current_uses, 0) >= v_invitation.max_uses THEN
    v_result := jsonb_set(v_result, '{valid}', 'false'::jsonb);
    v_result := jsonb_set(v_result, '{error}', '"This invitation code has reached its maximum uses"'::jsonb);
    RETURN v_result;
  END IF;

  RETURN v_result;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.validate_invitation_code(text, text) TO authenticated;

COMMENT ON FUNCTION public.validate_invitation_code(text, text) IS 
'Validates an invitation code and returns school information for better UX. Returns JSON with school_name, validation status, and error messages if applicable.';
