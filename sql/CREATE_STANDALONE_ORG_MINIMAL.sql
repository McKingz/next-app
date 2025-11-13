-- ============================================================================
-- CREATE DEFAULT ORGANIZATION FOR STANDALONE PARENTS - MINIMAL VERSION
-- ============================================================================
-- Uses minimal columns to avoid constraint violations
-- ============================================================================

-- Step 1: Add is_default_standalone column
ALTER TABLE preschools 
ADD COLUMN IF NOT EXISTS is_default_standalone BOOLEAN DEFAULT FALSE;

-- Step 2: Create the default standalone organization (MINIMAL)
INSERT INTO preschools (
    id,
    name,
    is_active,
    is_default_standalone,
    subscription_tier  -- Must be one of: free, starter, professional, enterprise, parent-starter, parent-plus
) VALUES (
    'e7d4c3b2-a1f0-4e5d-9c8b-7a6f5e4d3c2b'::uuid,
    'EduDash Pro - Standalone Parents',
    true,
    true,
    'free'  -- Use 'free' tier to avoid constraint violation
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    is_default_standalone = true,
    subscription_tier = 'free',
    updated_at = NOW();

-- Step 3: Create index
CREATE INDEX IF NOT EXISTS idx_preschools_default_standalone 
ON preschools(is_default_standalone) 
WHERE is_default_standalone = TRUE;

-- Step 4: Helper function to get default standalone org ID
CREATE OR REPLACE FUNCTION get_default_standalone_org_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    org_id UUID;
BEGIN
    SELECT id INTO org_id
    FROM preschools
    WHERE is_default_standalone = TRUE
    LIMIT 1;
    
    IF org_id IS NULL THEN
        INSERT INTO preschools (
            id,
            name,
            is_active,
            is_default_standalone,
            subscription_tier
        ) VALUES (
            'e7d4c3b2-a1f0-4e5d-9c8b-7a6f5e4d3c2b'::uuid,
            'EduDash Pro - Standalone Parents',
            true,
            true,
            'free'
        )
        ON CONFLICT (id) DO UPDATE SET
            is_default_standalone = true
        RETURNING id INTO org_id;
    END IF;
    
    RETURN org_id;
END;
$$;

-- Step 5: Update profile creation trigger
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
    default_org_id uuid;
BEGIN
    user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'parent');
    user_first_name := COALESCE(NEW.raw_user_meta_data->>'first_name', split_part(NEW.email, '@', 1));
    user_last_name := COALESCE(NEW.raw_user_meta_data->>'last_name', '');
    user_phone := NEW.raw_user_meta_data->>'phone';
    
    -- Get default org for parents
    IF user_role = 'parent' THEN
        default_org_id := get_default_standalone_org_id();
    END IF;

    INSERT INTO public.profiles (
        id,
        email,
        role,
        first_name,
        last_name,
        phone,
        preschool_id,
        usage_type,
        created_at,
        updated_at,
        last_login_at,
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
        default_org_id,
        CASE WHEN user_role = 'parent' AND default_org_id IS NOT NULL THEN 'standalone' ELSE NULL END,
        NOW(),
        NOW(),
        NOW(),
        TRUE,
        NOW() + INTERVAL '7 days',
        'premium',
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        role = COALESCE(profiles.role, EXCLUDED.role),
        updated_at = NOW(),
        preschool_id = CASE 
            WHEN profiles.preschool_id IS NULL AND profiles.role = 'parent' 
            THEN default_org_id
            ELSE profiles.preschool_id
        END,
        usage_type = CASE 
            WHEN profiles.usage_type IS NULL AND profiles.role = 'parent' AND default_org_id IS NOT NULL
            THEN 'standalone'
            ELSE profiles.usage_type
        END,
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
        RAISE WARNING 'Failed to create profile for new user %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$;

-- Step 6: Recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created_profiles ON auth.users;
CREATE TRIGGER on_auth_user_created_profiles
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.create_profile_for_new_user();

-- Step 7: Migrate existing standalone parents
UPDATE public.profiles
SET 
    preschool_id = get_default_standalone_org_id(),
    usage_type = 'standalone',
    updated_at = NOW()
WHERE 
    role = 'parent'
    AND preschool_id IS NULL
    AND created_at > NOW() - INTERVAL '90 days';

-- Step 8: Grant trials to recent users without one
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
    AND created_at > NOW() - INTERVAL '30 days';

-- Step 9: Transfer functions
CREATE OR REPLACE FUNCTION transfer_user_to_school(
    user_id UUID,
    new_school_id UUID
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    old_school_id UUID;
    default_org_id UUID;
BEGIN
    SELECT preschool_id INTO old_school_id FROM profiles WHERE id = user_id;
    default_org_id := get_default_standalone_org_id();
    
    UPDATE profiles
    SET 
        preschool_id = new_school_id,
        usage_type = CASE 
            WHEN new_school_id = default_org_id THEN 'standalone'
            ELSE 'school_linked'
        END,
        updated_at = NOW()
    WHERE id = user_id;
    
    RETURN json_build_object(
        'success', true,
        'user_id', user_id,
        'old_school_id', old_school_id,
        'new_school_id', new_school_id,
        'is_standalone', new_school_id = default_org_id
    );
END;
$$;

CREATE OR REPLACE FUNCTION move_user_to_standalone(user_id UUID)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN transfer_user_to_school(user_id, get_default_standalone_org_id());
END;
$$;

-- Step 10: Grant permissions
GRANT EXECUTE ON FUNCTION get_default_standalone_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION transfer_user_to_school(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION move_user_to_standalone(UUID) TO authenticated;

-- Step 11: Verify
SELECT 
    '✅ Default org' as status,
    id,
    name,
    subscription_tier,
    is_default_standalone
FROM preschools
WHERE is_default_standalone = TRUE;

SELECT 
    '✅ Standalone parents' as status,
    COUNT(*) as count
FROM profiles
WHERE preschool_id = get_default_standalone_org_id();

SELECT 
    '✅ Active trials' as status,
    COUNT(*) as count
FROM profiles
WHERE is_trial = TRUE AND trial_end_date > NOW();

-- ============================================================================
-- DONE!
-- ============================================================================
SELECT '✅ Setup complete! All users auto-assigned to standalone org with trials.' as result;
