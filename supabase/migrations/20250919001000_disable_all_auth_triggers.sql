-- Completely disable all auth triggers to test signup
-- This will help isolate whether the issue is with triggers or something else

-- Drop ALL triggers on auth.users table
DROP TRIGGER IF EXISTS on_auth_user_created_minimal ON auth.users CASCADE;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users CASCADE;
DROP TRIGGER IF EXISTS on_auth_user_created_simple ON auth.users CASCADE;
DROP TRIGGER IF EXISTS handle_new_user ON auth.users CASCADE;

-- Drop the associated functions as well
DROP FUNCTION IF EXISTS public.handle_new_auth_user_minimal() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.handle_auth_user_created() CASCADE;
DROP FUNCTION IF EXISTS public.sync_user_profile() CASCADE;

-- Test that auth.users is accessible and healthy
DO $$
BEGIN
    -- Simple test to make sure we can interact with auth.users
    PERFORM count(*) FROM auth.users;
    RAISE NOTICE 'Auth users table is accessible, count check passed';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error accessing auth.users: %', SQLERRM;
END $$;

SELECT 'All auth triggers disabled - ready for isolated testing' AS status;
