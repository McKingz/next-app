-- ============================================================================
-- STANDALONE USERS SYSTEM - Clean Architecture
-- ============================================================================
-- Creates a separate table for individual users (parents, teachers, students)
-- who use the app privately without being part of any organization/school.
-- 
-- This keeps preschools table clean for actual schools only.
-- ============================================================================

-- Step 1: Create standalone_users table
CREATE TABLE IF NOT EXISTS standalone_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
    
    -- User type
    user_type TEXT NOT NULL CHECK (user_type IN ('parent', 'teacher', 'tutor', 'student', 'homeschool')),
    
    -- Trial & Subscription (user-level, not org-level)
    subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'starter', 'plus', 'premium', 'pro')),
    is_trial BOOLEAN DEFAULT FALSE,
    trial_end_date TIMESTAMPTZ,
    trial_started_at TIMESTAMPTZ,
    subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('active', 'cancelled', 'expired', 'suspended')),
    
    -- Usage tracking
    usage_type TEXT DEFAULT 'standalone' CHECK (usage_type IN ('standalone', 'freelance', 'homeschool')),
    
    -- Metadata
    onboarding_completed BOOLEAN DEFAULT FALSE,
    preferences JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_standalone_users_user_id ON standalone_users(user_id);
CREATE INDEX IF NOT EXISTS idx_standalone_users_profile_id ON standalone_users(profile_id);
CREATE INDEX IF NOT EXISTS idx_standalone_users_type ON standalone_users(user_type);
CREATE INDEX IF NOT EXISTS idx_standalone_users_trial ON standalone_users(is_trial, trial_end_date) WHERE is_trial = TRUE;

-- Step 3: Add updated_at trigger
CREATE OR REPLACE FUNCTION update_standalone_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS standalone_users_updated_at ON standalone_users;
CREATE TRIGGER standalone_users_updated_at
    BEFORE UPDATE ON standalone_users
    FOR EACH ROW
    EXECUTE FUNCTION update_standalone_users_updated_at();

-- Step 4: Update profiles table to make preschool_id optional
ALTER TABLE profiles 
ALTER COLUMN preschool_id DROP NOT NULL;

-- Add a computed column to easily check if user is standalone
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS is_standalone BOOLEAN GENERATED ALWAYS AS (
    preschool_id IS NULL
) STORED;

CREATE INDEX IF NOT EXISTS idx_profiles_is_standalone ON profiles(is_standalone) WHERE is_standalone = TRUE;

-- Step 5: Update profile creation trigger for standalone users
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
    new_profile_id uuid;
BEGIN
    user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'parent');
    user_first_name := COALESCE(NEW.raw_user_meta_data->>'first_name', split_part(NEW.email, '@', 1));
    user_last_name := COALESCE(NEW.raw_user_meta_data->>'last_name', '');
    user_phone := NEW.raw_user_meta_data->>'phone';

    -- Create profile (WITHOUT preschool_id for standalone users)
    INSERT INTO public.profiles (
        id,
        email,
        role,
        first_name,
        last_name,
        phone,
        preschool_id,  -- Will be NULL for standalone users
        usage_type,
        created_at,
        updated_at,
        last_login_at,
        -- Auto-grant 7-day trial
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
        NULL,  -- No preschool for standalone users
        'standalone',  -- Usage type
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
        -- Grant trial if they don't have one
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
        trial_started_at = COALESCE(profiles.trial_started_at, NOW())
    RETURNING id INTO new_profile_id;

    -- Create standalone_users record for individual users
    INSERT INTO public.standalone_users (
        user_id,
        profile_id,
        user_type,
        subscription_tier,
        is_trial,
        trial_end_date,
        trial_started_at,
        usage_type,
        onboarding_completed
    ) VALUES (
        NEW.id,
        new_profile_id,
        user_role,
        'free',
        TRUE,
        NOW() + INTERVAL '7 days',
        NOW(),
        'standalone',
        FALSE
    )
    ON CONFLICT (user_id) DO UPDATE SET
        updated_at = NOW();

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Failed to create profile for new user %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$;

-- Step 6: Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created_profiles ON auth.users;
CREATE TRIGGER on_auth_user_created_profiles
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.create_profile_for_new_user();

-- Step 7: Migrate existing standalone users
INSERT INTO standalone_users (
    user_id,
    profile_id,
    user_type,
    subscription_tier,
    is_trial,
    trial_end_date,
    trial_started_at,
    usage_type
)
SELECT 
    p.id,
    p.id,
    p.role,
    'free',
    COALESCE(p.is_trial, FALSE),
    p.trial_end_date,
    p.trial_started_at,
    COALESCE(p.usage_type, 'standalone')
FROM profiles p
WHERE p.preschool_id IS NULL
  AND p.role IN ('parent', 'teacher', 'student')
  AND p.created_at > NOW() - INTERVAL '90 days'
ON CONFLICT (user_id) DO NOTHING;

-- Step 8: Grant trials to existing standalone users who don't have one
UPDATE standalone_users
SET 
    is_trial = TRUE,
    trial_end_date = NOW() + INTERVAL '7 days',
    trial_started_at = NOW(),
    updated_at = NOW()
WHERE 
    (is_trial IS NULL OR is_trial = FALSE)
    AND (trial_end_date IS NULL OR trial_end_date < NOW())
    AND created_at > NOW() - INTERVAL '30 days';

-- Also update profiles table
UPDATE profiles p
SET 
    is_trial = TRUE,
    trial_end_date = NOW() + INTERVAL '7 days',
    trial_plan_tier = 'premium',
    trial_started_at = NOW(),
    updated_at = NOW()
FROM standalone_users su
WHERE p.id = su.profile_id
  AND (p.is_trial IS NULL OR p.is_trial = FALSE)
  AND (p.trial_end_date IS NULL OR p.trial_end_date < NOW());

-- Step 9: Helper functions
CREATE OR REPLACE FUNCTION is_user_standalone(user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    is_standalone BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM standalone_users WHERE standalone_users.user_id = $1
    ) INTO is_standalone;
    
    RETURN is_standalone;
END;
$$;

CREATE OR REPLACE FUNCTION get_user_subscription_info(user_id UUID)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result json;
    standalone_record standalone_users%ROWTYPE;
BEGIN
    -- Check if standalone user
    SELECT * INTO standalone_record
    FROM standalone_users
    WHERE standalone_users.user_id = $1;
    
    IF FOUND THEN
        -- Standalone user - return user-level subscription
        SELECT json_build_object(
            'is_standalone', true,
            'subscription_tier', standalone_record.subscription_tier,
            'is_trial', standalone_record.is_trial,
            'trial_end_date', standalone_record.trial_end_date,
            'subscription_status', standalone_record.subscription_status,
            'user_type', standalone_record.user_type
        ) INTO result;
    ELSE
        -- Organization user - check org subscription
        SELECT json_build_object(
            'is_standalone', false,
            'subscription_tier', 'Check organization subscription',
            'message', 'User is part of an organization'
        ) INTO result;
    END IF;
    
    RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION link_user_to_school(
    user_id UUID,
    school_id UUID
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result json;
BEGIN
    -- Update profile to link to school
    UPDATE profiles
    SET 
        preschool_id = school_id,
        usage_type = 'school_linked',
        updated_at = NOW()
    WHERE id = user_id;
    
    -- Remove from standalone_users (they're now org-based)
    DELETE FROM standalone_users WHERE standalone_users.user_id = $1;
    
    SELECT json_build_object(
        'success', true,
        'user_id', user_id,
        'school_id', school_id,
        'message', 'User linked to school and removed from standalone'
    ) INTO result;
    
    RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION unlink_user_from_school(user_id UUID)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_profile profiles%ROWTYPE;
    result json;
BEGIN
    -- Get user profile
    SELECT * INTO user_profile FROM profiles WHERE id = user_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'User not found');
    END IF;
    
    -- Update profile to remove school
    UPDATE profiles
    SET 
        preschool_id = NULL,
        usage_type = 'standalone',
        updated_at = NOW()
    WHERE id = user_id;
    
    -- Add back to standalone_users
    INSERT INTO standalone_users (
        user_id,
        profile_id,
        user_type,
        subscription_tier,
        usage_type
    ) VALUES (
        user_id,
        user_id,
        user_profile.role,
        'free',
        'standalone'
    )
    ON CONFLICT (user_id) DO UPDATE SET
        updated_at = NOW();
    
    SELECT json_build_object(
        'success', true,
        'user_id', user_id,
        'message', 'User unlinked from school and moved to standalone'
    ) INTO result;
    
    RETURN result;
END;
$$;

-- Step 10: Grant permissions
GRANT SELECT, INSERT, UPDATE ON standalone_users TO authenticated;
GRANT EXECUTE ON FUNCTION is_user_standalone(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_subscription_info(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION link_user_to_school(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION unlink_user_from_school(UUID) TO authenticated;

-- Step 11: Enable RLS
ALTER TABLE standalone_users ENABLE ROW LEVEL SECURITY;

-- Users can only see their own standalone record
CREATE POLICY standalone_users_select_own
    ON standalone_users
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY standalone_users_update_own
    ON standalone_users
    FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid());

-- Step 12: Verify the setup
SELECT 
    '✅ Standalone users table created' as status,
    COUNT(*) as total_standalone_users
FROM standalone_users;

SELECT 
    '✅ Standalone users by type' as status,
    user_type,
    COUNT(*) as count
FROM standalone_users
GROUP BY user_type;

SELECT 
    '✅ Active trials' as status,
    COUNT(*) as count
FROM standalone_users
WHERE is_trial = TRUE AND trial_end_date > NOW();

-- ============================================================================
-- DONE!
-- ============================================================================
SELECT '✅ Standalone users system created! Clean separation from organizations.' as result;
