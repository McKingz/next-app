-- Fix use_invitation_code to handle re-joining same school gracefully
-- Date: 2025-10-26
-- Purpose: Allow users to re-use same school code without 409 errors (idempotent)

CREATE OR REPLACE FUNCTION public.use_invitation_code(
  p_code text,
  p_auth_user_id uuid,
  p_name text,
  p_phone text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_invitation public.school_invitation_codes%rowtype;
  v_user_id uuid;
  v_profile_email text;
  v_auth_email text;
  v_full_name text := p_name;
  v_first text;
  v_last text;
  v_existing_user_preschool_id uuid;
BEGIN
  -- Lock and load the invitation row to prevent race conditions on concurrent redemption
  SELECT * INTO v_invitation
  FROM public.school_invitation_codes
  WHERE code = p_code
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired invitation code';
  END IF;

  -- Basic validations
  IF COALESCE(v_invitation.is_active, false) = false THEN
    RAISE EXCEPTION 'Invitation code is inactive';
  END IF;

  IF v_invitation.expires_at IS NOT NULL AND v_invitation.expires_at <= now() THEN
    RAISE EXCEPTION 'Invitation code has expired';
  END IF;

  IF v_invitation.max_uses IS NOT NULL AND v_invitation.max_uses > 0
     AND COALESCE(v_invitation.current_uses, 0) >= v_invitation.max_uses THEN
    RAISE EXCEPTION 'Invitation code has reached its maximum number of uses';
  END IF;

  IF v_invitation.invitation_type <> 'parent' THEN
    RAISE EXCEPTION 'Unsupported invitation type: %', v_invitation.invitation_type;
  END IF;

  -- Check if user already exists and is linked to a DIFFERENT school
  SELECT preschool_id INTO v_existing_user_preschool_id
  FROM public.users
  WHERE auth_user_id = p_auth_user_id;

  IF FOUND AND v_existing_user_preschool_id IS NOT NULL 
     AND v_existing_user_preschool_id <> v_invitation.preschool_id THEN
    RAISE EXCEPTION 'You are already linked to a different school. Please contact support to change schools.';
  END IF;

  -- If user is already linked to THIS school, just return success (idempotent)
  IF FOUND AND v_existing_user_preschool_id = v_invitation.preschool_id THEN
    -- Get the existing user_id
    SELECT id INTO v_user_id FROM public.users WHERE auth_user_id = p_auth_user_id;
    RETURN v_user_id;
  END IF;

  -- Determine an email for the user (prefer profiles.email, then auth.users.email)
  SELECT email INTO v_profile_email FROM public.profiles WHERE id = p_auth_user_id;
  SELECT email INTO v_auth_email FROM auth.users WHERE id = p_auth_user_id;

  -- Derive name parts; fallback to email local part if needed
  IF v_full_name IS NULL OR btrim(v_full_name) = '' THEN
    v_full_name := COALESCE(split_part(COALESCE(v_profile_email, v_auth_email), '@', 1), 'Parent');
  END IF;
  v_first := btrim(split_part(v_full_name, ' ', 1));
  IF position(' ' in v_full_name) > 0 THEN
    v_last := btrim(substr(v_full_name, position(' ' in v_full_name) + 1));
  ELSE
    v_last := NULL;
  END IF;

  -- Upsert into domain users table keyed by auth_user_id
  INSERT INTO public.users (
    auth_user_id, email, name, phone, role, preschool_id, organization_id, is_active, first_name, last_name, created_at, updated_at
  ) VALUES (
    p_auth_user_id,
    COALESCE(v_profile_email, v_auth_email),
    v_full_name,
    p_phone,
    'parent',
    v_invitation.preschool_id,
    v_invitation.preschool_id,
    true,
    COALESCE(NULLIF(v_first, ''), v_full_name),
    NULLIF(v_last, ''),
    now(),
    now()
  )
  ON CONFLICT (auth_user_id) DO UPDATE
    SET email = COALESCE(EXCLUDED.email, public.users.email),
        name = COALESCE(EXCLUDED.name, public.users.name),
        phone = COALESCE(EXCLUDED.phone, public.users.phone),
        role = 'parent',
        preschool_id = EXCLUDED.preschool_id,
        organization_id = EXCLUDED.organization_id,
        is_active = true,
        updated_at = now()
  RETURNING id INTO v_user_id;

  -- Reflect linkage on profiles as well (non-destructive for existing roles)
  UPDATE public.profiles p
     SET preschool_id = v_invitation.preschool_id,
         role = CASE WHEN p.role IS NULL OR p.role = 'parent' THEN 'parent' ELSE p.role END,
         phone = COALESCE(p.phone, p_phone),
         updated_at = now()
   WHERE p.id = p_auth_user_id;

  -- Mark the invitation as used and increment counters (only if this is first use by this user)
  UPDATE public.school_invitation_codes sic
     SET current_uses = COALESCE(sic.current_uses, 0) + 1,
         used_at = now(),
         used_by = v_user_id,
         is_active = CASE
                       WHEN sic.max_uses IS NOT NULL AND sic.max_uses > 0 AND COALESCE(sic.current_uses, 0) + 1 >= sic.max_uses
                       THEN false
                       ELSE sic.is_active
                     END,
         updated_at = now()
   WHERE sic.id = v_invitation.id
     AND NOT EXISTS (
       SELECT 1 FROM public.users u 
       WHERE u.auth_user_id = p_auth_user_id 
       AND u.created_at < now() - interval '1 minute'
     );

  RETURN v_user_id;
END;
$$;

-- Ensure callable by authenticated clients
GRANT EXECUTE ON FUNCTION public.use_invitation_code(text, uuid, text, text) TO authenticated;

COMMENT ON FUNCTION public.use_invitation_code(text, uuid, text, text) IS 
'Idempotent function to redeem invitation codes. Allows re-joining same school without errors. Prevents switching between schools without admin approval.';
