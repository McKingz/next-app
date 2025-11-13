-- Fix ambiguous column references in create_organization RPC
-- The issue: variables named 'id', 'name', etc. conflict with table columns
-- Solution: Use explicit table qualification and different variable names

CREATE OR REPLACE FUNCTION public.create_organization(
  p_name TEXT,
  p_type TEXT DEFAULT 'preschool',
  p_phone TEXT DEFAULT NULL,
  p_status TEXT DEFAULT 'active'
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  type TEXT,
  phone TEXT,
  status TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id UUID;
  v_user_role TEXT;
  v_new_org RECORD;
BEGIN
  -- Get the authenticated user ID
  v_user_id := auth.uid();

  -- Ensure user is authenticated
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  -- Get user's role from profiles table
  SELECT profiles.role INTO v_user_role
  FROM public.profiles
  WHERE profiles.id = v_user_id;

  -- Only principals and superadmins can create organizations
  IF v_user_role NOT IN ('principal', 'superadmin') THEN
    RAISE EXCEPTION 'Only principals and superadmins can create organizations'
      USING ERRCODE = '42501';
  END IF;

  -- Validate organization name
  IF p_name IS NULL OR TRIM(p_name) = '' THEN
    RAISE EXCEPTION 'Organization name is required' USING ERRCODE = '22023';
  END IF;

  -- Validate organization type (expanded to include all valid types)
  IF p_type NOT IN (
    'preschool',
    'daycare',
    'primary_school',
    'skills',
    'tertiary',
    'org',
    'other'
  ) THEN
    RAISE EXCEPTION 'Invalid organization type' USING ERRCODE = '22023';
  END IF;

  -- Validate status
  IF p_status NOT IN ('active', 'inactive', 'pending') THEN
    RAISE EXCEPTION 'Invalid organization status' USING ERRCODE = '22023';
  END IF;

  -- Insert the new organization and return the record
  INSERT INTO public.organizations (
    name,
    type,
    phone,
    status,
    created_by
  )
  VALUES (
    TRIM(p_name),
    p_type,
    p_phone,
    p_status,
    v_user_id
  )
  RETURNING
    organizations.id,
    organizations.name,
    organizations.type,
    organizations.phone,
    organizations.status,
    organizations.created_by,
    organizations.created_at
  INTO v_new_org;

  -- Update the creator's profile to link to this organization
  -- This establishes the tenant relationship
  UPDATE public.profiles
  SET preschool_id = v_new_org.id
  WHERE profiles.id = v_user_id;

  -- Return the created organization by assigning to output variables
  id := v_new_org.id;
  name := v_new_org.name;
  type := v_new_org.type;
  phone := v_new_org.phone;
  status := v_new_org.status;
  created_by := v_new_org.created_by;
  created_at := v_new_org.created_at;

  RETURN NEXT;

END;
$$;

-- Update comment
COMMENT ON FUNCTION public.create_organization IS
'Server-side function to create a new organization. Only principals and superadmins '
'can create organizations. Automatically links the creator to the new organization. '
'Supports types: preschool, daycare, primary_school, skills, tertiary, org, other.';
