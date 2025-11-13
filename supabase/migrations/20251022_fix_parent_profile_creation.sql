-- Fix parent profile creation after email confirmation
-- This ensures that when parents confirm their email, they get a proper profile record

-- First, check if profiles table exists (it should)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles') THEN
        RAISE EXCEPTION 'profiles table does not exist';
    END IF;
END $$;

-- Create or replace the function that handles new user profile creation
CREATE OR REPLACE FUNCTION public.create_profile_for_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    user_role text;
    user_first_name text;
    user_last_name text;
    user_phone text;
BEGIN
    -- Extract metadata from the new user
    user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'parent');
    user_first_name := COALESCE(NEW.raw_user_meta_data->>'first_name', split_part(NEW.email, '@', 1));
    user_last_name := COALESCE(NEW.raw_user_meta_data->>'last_name', '');
    user_phone := NEW.raw_user_meta_data->>'phone';

    -- Insert profile record (only if it doesn't exist)
    INSERT INTO public.profiles (
        id,
        email,
        role,
        first_name,
        last_name,
        phone,
        created_at,
        updated_at,
        last_login_at
    ) VALUES (
        NEW.id,
        NEW.email,
        user_role::text,
        user_first_name,
        user_last_name,
        user_phone,
        NOW(),
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        role = COALESCE(profiles.role, EXCLUDED.role),
        updated_at = NOW();

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't block user creation
        RAISE WARNING 'Failed to create profile for new user %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created_profiles ON auth.users;

-- Create trigger on auth.users to create profile
CREATE TRIGGER on_auth_user_created_profiles
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.create_profile_for_new_user();

-- Also update profiles for existing users who might not have them
-- This is a one-time data fix
INSERT INTO public.profiles (
    id,
    email,
    role,
    first_name,
    last_name,
    created_at,
    updated_at,
    last_login_at
)
SELECT 
    u.id,
    u.email,
    COALESCE(u.raw_user_meta_data->>'role', 'parent')::text,
    COALESCE(u.raw_user_meta_data->>'first_name', split_part(u.email, '@', 1)),
    COALESCE(u.raw_user_meta_data->>'last_name', ''),
    u.created_at,
    NOW(),
    u.last_sign_in_at
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
  AND u.deleted_at IS NULL
ON CONFLICT (id) DO NOTHING;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;

-- Log success
SELECT 'Parent profile creation fixed successfully' AS status;
