-- Fix Superadmin Dashboard Migration  
-- Date: 2025-09-19
-- Purpose: Fix superadmin dashboard user detection and profile functions
-- WARP.md Compliance: Fix authentication and dashboard functionality

BEGIN;

-- ============================================================================
-- PART 1: FIX USER PROFILE DETECTION FUNCTIONS
-- ============================================================================

-- Function to check if user is superadmin by auth.uid()
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users 
    WHERE auth_user_id = auth.uid() 
    AND role = 'super_admin' 
    AND is_active = true
  );
$$;

-- Function to check if user is superadmin by user ID
CREATE OR REPLACE FUNCTION public.is_superadmin_by_id(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users 
    WHERE auth_user_id = user_id 
    AND role = 'super_admin' 
    AND is_active = true
  );
$$;

-- Function to get current user profile with all details
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS TABLE (
  id uuid,
  auth_user_id uuid,
  email text,
  first_name text,
  last_name text,
  name text,
  role text,
  preschool_id uuid,
  organization_id uuid,
  avatar_url text,
  is_active boolean,
  phone text,
  last_login_at timestamptz,
  profile_completed_at timestamptz,
  profile_completion_status text,
  ai_credits_remaining integer,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT 
    u.id,
    u.auth_user_id,
    u.email,
    u.first_name,
    u.last_name,
    u.name,
    u.role,
    u.preschool_id,
    u.organization_id,
    u.avatar_url,
    u.is_active,
    u.phone,
    u.last_login_at,
    u.profile_completed_at,
    u.profile_completion_status,
    u.ai_credits_remaining,
    u.created_at,
    u.updated_at
  FROM public.users u
  WHERE u.auth_user_id = auth.uid()
  AND u.is_active = true;
$$;

-- ============================================================================
-- PART 2: SUPERADMIN DASHBOARD DATA FUNCTIONS
-- ============================================================================

-- Function to get superadmin dashboard data
CREATE OR REPLACE FUNCTION public.get_superadmin_dashboard_data()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
  user_stats json;
  preschool_stats json;
  recent_activity json;
BEGIN
  -- Check if current user is superadmin
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Access denied: Superadmin privileges required';
  END IF;

  -- Get user statistics
  SELECT json_build_object(
    'total_users', COUNT(*),
    'active_users', COUNT(*) FILTER (WHERE is_active = true),
    'inactive_users', COUNT(*) FILTER (WHERE is_active = false),
    'superadmins', COUNT(*) FILTER (WHERE role = 'super_admin' AND is_active = true),
    'principals', COUNT(*) FILTER (WHERE role IN ('principal', 'principal_admin') AND is_active = true),
    'teachers', COUNT(*) FILTER (WHERE role = 'teacher' AND is_active = true),
    'parents', COUNT(*) FILTER (WHERE role = 'parent' AND is_active = true)
  ) INTO user_stats
  FROM public.users;

  -- Get preschool statistics
  SELECT json_build_object(
    'total_preschools', COUNT(*),
    'active_preschools', COUNT(*) FILTER (WHERE is_active = true),
    'setup_completed', COUNT(*) FILTER (WHERE setup_completed = true),
    'pending_setup', COUNT(*) FILTER (WHERE setup_completed = false OR setup_completed IS NULL)
  ) INTO preschool_stats
  FROM public.preschools;

  -- Get recent activity (last 10 users)
  SELECT json_agg(
    json_build_object(
      'id', id,
      'email', email,
      'name', COALESCE(name, first_name || ' ' || last_name, email),
      'role', role,
      'preschool_id', preschool_id,
      'is_active', is_active,
      'last_login_at', last_login_at,
      'created_at', created_at
    )
  ) INTO recent_activity
  FROM (
    SELECT * FROM public.users 
    ORDER BY created_at DESC 
    LIMIT 10
  ) recent_users;

  -- Build final result
  result := json_build_object(
    'user_stats', user_stats,
    'preschool_stats', preschool_stats,
    'recent_activity', recent_activity,
    'generated_at', now()
  );

  RETURN result;
END;
$$;

-- Function to get all superadmin users
CREATE OR REPLACE FUNCTION public.get_superadmin_users()
RETURNS TABLE (
  id uuid,
  auth_user_id uuid,
  email text,
  name text,
  role text,
  is_active boolean,
  last_login_at timestamptz,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    u.id,
    u.auth_user_id,
    u.email,
    COALESCE(u.name, u.first_name || ' ' || u.last_name, u.email) as name,
    u.role,
    u.is_active,
    u.last_login_at,
    u.created_at
  FROM public.users u
  WHERE u.role = 'super_admin'
  ORDER BY u.created_at DESC;
$$;

-- Function to get user by auth_user_id (for profile lookups)
CREATE OR REPLACE FUNCTION public.get_user_by_auth_id(p_auth_user_id uuid)
RETURNS TABLE (
  id uuid,
  auth_user_id uuid,
  email text,
  first_name text,
  last_name text,
  name text,
  role text,
  preschool_id uuid,
  organization_id uuid,
  avatar_url text,
  is_active boolean,
  phone text,
  home_address text,
  home_city text,
  home_postal_code text,
  work_company text,
  work_position text,
  work_address text,
  work_phone text,
  emergency_contact_1_name text,
  emergency_contact_1_phone text,
  emergency_contact_1_relationship text,
  emergency_contact_2_name text,
  emergency_contact_2_phone text,
  emergency_contact_2_relationship text,
  relationship_to_child text,
  pickup_authorized boolean,
  profile_completed_at timestamptz,
  profile_completion_status text,
  ai_credits_remaining integer,
  last_login_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT 
    u.id,
    u.auth_user_id,
    u.email,
    u.first_name,
    u.last_name,
    u.name,
    u.role,
    u.preschool_id,
    u.organization_id,
    u.avatar_url,
    u.is_active,
    u.phone,
    u.home_address,
    u.home_city,
    u.home_postal_code,
    u.work_company,
    u.work_position,
    u.work_address,
    u.work_phone,
    u.emergency_contact_1_name,
    u.emergency_contact_1_phone,
    u.emergency_contact_1_relationship,
    u.emergency_contact_2_name,
    u.emergency_contact_2_phone,
    u.emergency_contact_2_relationship,
    u.relationship_to_child,
    u.pickup_authorized,
    u.profile_completed_at,
    u.profile_completion_status,
    u.ai_credits_remaining,
    u.last_login_at,
    u.created_at,
    u.updated_at
  FROM public.users u
  WHERE u.auth_user_id = p_auth_user_id
  AND u.is_active = true;
$$;

-- ============================================================================
-- PART 3: USER MANAGEMENT FUNCTIONS FOR SUPERADMIN
-- ============================================================================

-- Function to create/promote user to superadmin
CREATE OR REPLACE FUNCTION public.promote_user_to_superadmin(
  target_user_id uuid,
  target_email text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
  user_exists boolean;
BEGIN
  -- Check if current user is superadmin
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Access denied: Superadmin privileges required';
  END IF;

  -- Check if user exists
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE auth_user_id = target_user_id
  ) INTO user_exists;

  IF user_exists THEN
    -- Update existing user
    UPDATE public.users 
    SET 
      role = 'super_admin',
      is_active = true,
      updated_at = now()
    WHERE auth_user_id = target_user_id;
    
    result := json_build_object(
      'success', true,
      'action', 'promoted',
      'message', 'User promoted to superadmin successfully'
    );
  ELSE
    -- Create new user if email provided
    IF target_email IS NOT NULL THEN
      INSERT INTO public.users (
        auth_user_id,
        id,
        email,
        name,
        role,
        is_active,
        created_at,
        updated_at
      ) VALUES (
        target_user_id,
        target_user_id,
        target_email,
        'Super Administrator',
        'super_admin',
        true,
        now(),
        now()
      );
      
      result := json_build_object(
        'success', true,
        'action', 'created',
        'message', 'Superadmin user created successfully'
      );
    ELSE
      result := json_build_object(
        'success', false,
        'error', 'User not found and no email provided for creation'
      );
    END IF;
  END IF;

  RETURN result;
END;
$$;

-- Function to test superadmin system
CREATE OR REPLACE FUNCTION public.test_superadmin_system()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
  superadmin_count integer;
  current_user_role text;
BEGIN
  -- Get superadmin count
  SELECT COUNT(*) INTO superadmin_count
  FROM public.users 
  WHERE role = 'super_admin' AND is_active = true;

  -- Get current user role
  SELECT role INTO current_user_role
  FROM public.users 
  WHERE auth_user_id = auth.uid();

  result := json_build_object(
    'superadmin_count', superadmin_count,
    'current_user_role', current_user_role,
    'current_user_id', auth.uid(),
    'is_superadmin', public.is_superadmin(),
    'test_timestamp', now()
  );

  RETURN result;
END;
$$;

-- ============================================================================
-- PART 4: UPDATE USER PROFILE FUNCTIONS
-- ============================================================================

-- Function to update user last login (called from frontend)
CREATE OR REPLACE FUNCTION public.update_last_login()
RETURNS json
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH updated_user AS (
    UPDATE public.users 
    SET last_login_at = now() 
    WHERE auth_user_id = auth.uid()
    RETURNING id, email, last_login_at
  )
  SELECT json_build_object(
    'success', true,
    'user_id', id,
    'email', email,
    'last_login_at', last_login_at
  )
  FROM updated_user;
$$;

-- ============================================================================
-- PART 5: GRANT PERMISSIONS
-- ============================================================================

-- Grant permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.is_superadmin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_superadmin_by_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_by_auth_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_last_login() TO authenticated;

-- Superadmin-only functions
GRANT EXECUTE ON FUNCTION public.get_superadmin_dashboard_data() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_superadmin_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.promote_user_to_superadmin(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.test_superadmin_system() TO authenticated;

-- ============================================================================
-- PART 6: CREATE/UPDATE SUPERADMIN USER IF NEEDED
-- ============================================================================

-- Create a default superadmin user if none exists
DO $create_superadmin$
DECLARE
  superadmin_count integer;
  default_superadmin_id uuid;
BEGIN
  -- Check if any superadmin exists
  SELECT COUNT(*) INTO superadmin_count
  FROM public.users 
  WHERE role = 'super_admin' AND is_active = true;

  IF superadmin_count = 0 THEN
    -- Get the auth user ID from the log (d2df36d4-74bc-4ffb-883b-036754764265)
    default_superadmin_id := 'd2df36d4-74bc-4ffb-883b-036754764265'::uuid;
    
    -- Create or update the superadmin user
    INSERT INTO public.users (
      auth_user_id,
      id,
      email,
      first_name,
      last_name,
      name,
      role,
      is_active,
      created_at,
      updated_at
    ) VALUES (
      default_superadmin_id,
      default_superadmin_id,
      'superadmin@edudash.pro',
      'Super',
      'Admin',
      'Super Admin',
      'super_admin',
      true,
      now(),
      now()
    ) ON CONFLICT (auth_user_id) DO UPDATE SET
      role = 'super_admin',
      is_active = true,
      updated_at = now();
    
    RAISE NOTICE 'Created/updated default superadmin user';
  END IF;
END
$create_superadmin$;

-- ============================================================================
-- PART 7: LOGGING AND VERIFICATION
-- ============================================================================

-- Log completion
INSERT INTO public.config_kv (key, value, description, is_public)
VALUES (
  'superadmin_dashboard_fixed_20250919',
  json_build_object(
    'version', '1.0.0',
    'completed_at', now()::text,
    'functions_created', ARRAY[
      'is_superadmin',
      'is_superadmin_by_id',
      'get_my_profile',
      'get_superadmin_dashboard_data',
      'get_superadmin_users',
      'get_user_by_auth_id',
      'promote_user_to_superadmin',
      'test_superadmin_system',
      'update_last_login'
    ],
    'total_functions', 9
  ),
  'Superadmin dashboard functions fix completion log',
  FALSE
) ON CONFLICT (key) DO UPDATE SET
  value = excluded.value,
  updated_at = now();

SELECT 'SUPERADMIN DASHBOARD FUNCTIONS FIXED' AS status;

COMMIT;
