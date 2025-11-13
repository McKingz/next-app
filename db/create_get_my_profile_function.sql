-- Create get_my_profile RPC function
-- This function is used by fetchEnhancedUserProfile to get the current user's profile

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
    SELECT * INTO user_profile
    FROM profiles
    WHERE id = current_user_id;
    
    -- Return the profile (will be null if not found)
    RETURN user_profile;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;

-- Create debug function that bypasses RLS (for testing only)
CREATE OR REPLACE FUNCTION public.debug_get_profile_direct(target_auth_id uuid)
RETURNS profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_profile profiles;
BEGIN
    -- Only allow in development/testing
    -- In production, this should be restricted or removed
    
    -- Get the profile directly (bypasses RLS)
    SELECT * INTO user_profile
    FROM profiles
    WHERE id = target_auth_id OR auth_user_id = target_auth_id;
    
    -- Return the profile
    RETURN user_profile;
END;
$$;

-- Grant execute permissions for debug function
GRANT EXECUTE ON FUNCTION public.debug_get_profile_direct(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.debug_get_profile_direct(uuid) TO service_role;
