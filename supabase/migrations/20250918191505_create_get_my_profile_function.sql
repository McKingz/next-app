-- Create get_my_profile RPC function
-- This function is used by fetchEnhancedUserProfile to get the current user's profile

-- First, drop the function if it already exists
DROP FUNCTION IF EXISTS public.get_my_profile();

-- Create the get_my_profile function
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_user_id uuid;
    user_profile profiles;
BEGIN
    -- Get the current authenticated user ID
    current_user_id := auth.uid();
    
    -- Return null if no authenticated user
    IF current_user_id IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Get the user's profile
    -- First try to match by profile.id (which should equal auth.users.id)
    SELECT * INTO user_profile
    FROM profiles
    WHERE id = current_user_id;
    
    -- If not found, try auth_user_id column (fallback for older records)
    IF user_profile IS NULL THEN
        SELECT * INTO user_profile
        FROM profiles
        WHERE auth_user_id = current_user_id;
    END IF;
    
    -- Return the profile (will be null if not found)
    RETURN user_profile;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;

-- Also create a debug function that bypasses RLS (for development/testing)
DROP FUNCTION IF EXISTS public.debug_get_profile_direct(uuid);

CREATE OR REPLACE FUNCTION public.debug_get_profile_direct(target_auth_id uuid)
RETURNS profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_profile profiles;
BEGIN
    -- Get the profile directly (bypasses RLS)
    -- First try profile.id
    SELECT * INTO user_profile
    FROM profiles
    WHERE id = target_auth_id;
    
    -- If not found, try auth_user_id
    IF user_profile IS NULL THEN
        SELECT * INTO user_profile
        FROM profiles
        WHERE auth_user_id = target_auth_id;
    END IF;
    
    -- Return the profile
    RETURN user_profile;
END;
$$;

-- Grant execute permissions for debug function
GRANT EXECUTE ON FUNCTION public.debug_get_profile_direct(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.debug_get_profile_direct(uuid) TO service_role;

-- Add a comment explaining the function
COMMENT ON FUNCTION public.get_my_profile() IS 'Returns the profile of the currently authenticated user. Used by fetchEnhancedUserProfile in the app.';
COMMENT ON FUNCTION public.debug_get_profile_direct(
  uuid
) IS 'Debug function to get any user profile directly. For development/testing only.';
