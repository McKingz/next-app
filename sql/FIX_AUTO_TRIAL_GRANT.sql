-- ============================================================================
-- AUTO-GRANT 7-DAY TRIAL TO NEW PARENT USERS
-- ============================================================================
-- This adds a trigger to automatically grant trials when new users sign up
-- ============================================================================

-- Step 1: Update the profile creation function to also grant trial
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
        last_login_at,
        -- ✨ AUTOMATICALLY GRANT 7-DAY TRIAL ✨
        is_trial,
        trial_end_date,
        trial_plan_tier,
        trial_started_at
    ) VALUES (
        NEW.id,
        NEW.email,
        user_role::text,
        user_first_name,
        user_last_name,
        user_phone,
        NOW(),
        NOW(),
        NOW(),
        -- ✨ Trial fields ✨
        TRUE,  -- is_trial
        NOW() + INTERVAL '7 days',  -- trial_end_date
        'premium',  -- trial_plan_tier
        NOW()  -- trial_started_at
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        role = COALESCE(profiles.role, EXCLUDED.role),
        updated_at = NOW(),
        -- Grant trial if user doesn't have one
        is_trial = CASE 
            WHEN profiles.is_trial IS NULL OR profiles.is_trial = FALSE 
            THEN TRUE 
            ELSE profiles.is_trial 
        END,
        trial_end_date = CASE 
            WHEN profiles.trial_end_date IS NULL 
            THEN NOW() + INTERVAL '7 days' 
            ELSE profiles.trial_end_date 
        END,
        trial_plan_tier = COALESCE(profiles.trial_plan_tier, 'premium'),
        trial_started_at = COALESCE(profiles.trial_started_at, NOW());

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't block user creation
        RAISE WARNING 'Failed to create profile for new user %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$;

-- Step 2: Ensure the trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created_profiles ON auth.users;

CREATE TRIGGER on_auth_user_created_profiles
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.create_profile_for_new_user();

-- Step 3: Grant trial to existing users who don't have one
UPDATE public.profiles
SET 
    is_trial = TRUE,
    trial_end_date = NOW() + INTERVAL '7 days',
    trial_plan_tier = 'premium',
    trial_started_at = NOW(),
    updated_at = NOW()
WHERE 
    role = 'parent' 
    AND (is_trial IS NULL OR is_trial = FALSE)
    AND (trial_end_date IS NULL OR trial_end_date < NOW())
    AND preschool_id IS NULL  -- Only standalone parents without organization
    AND created_at > NOW() - INTERVAL '30 days';  -- Only recent signups (last 30 days)

-- Step 4: Verify the fix
SELECT 
    'Users granted trial' as action,
    COUNT(*) as count
FROM profiles
WHERE is_trial = TRUE AND trial_started_at > NOW() - INTERVAL '1 minute';

-- ============================================================================
-- DONE!
-- ============================================================================
SELECT '✅ Auto-trial grant enabled! New users will automatically get 7-day trials.' as status;
