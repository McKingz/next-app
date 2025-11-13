-- Debug function to diagnose organization creation issues
-- Returns detailed information about user state and system configuration

CREATE OR REPLACE FUNCTION public.debug_organization_creation()
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id UUID;
  v_profile RECORD;
  v_org_columns TEXT[];
  v_result JSONB;
BEGIN
  -- Get authenticated user
  v_user_id := auth.uid();

  -- Gather profile information
  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = v_user_id;

  -- Get organizations table columns
  SELECT array_agg(column_name) INTO v_org_columns
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'organizations';

  -- Build result
  v_result := jsonb_build_object(
    'user_id', v_user_id,
    'authenticated', v_user_id IS NOT NULL,
    'profile', jsonb_build_object(
      'exists', v_profile.id IS NOT NULL,
      'email', v_profile.email,
      'role', v_profile.role,
      'first_name', v_profile.first_name,
      'last_name', v_profile.last_name,
      'preschool_id', v_profile.preschool_id,
      'organization_id', (row_to_json(v_profile)::jsonb)->>'organization_id'
    ),
    'permissions', jsonb_build_object(
      'can_create_org', v_profile.role IN ('principal', 'superadmin'),
      'role_check', v_profile.role || ' (expected: principal or superadmin)'
    ),
    'organizations_table', jsonb_build_object(
      'columns', v_org_columns,
      'has_created_by', 'created_by' = ANY(v_org_columns),
      'has_type', 'type' = ANY(v_org_columns),
      'has_status', 'status' = ANY(v_org_columns)
    ),
    'rpc_function', jsonb_build_object(
      'exists', EXISTS(
        SELECT 1
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.proname = 'create_organization'
      )
    )
  );

  RETURN v_result;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.debug_organization_creation() TO authenticated;

COMMENT ON FUNCTION public.debug_organization_creation IS
'Debug function to diagnose organization creation issues. Returns user state and system configuration.';
