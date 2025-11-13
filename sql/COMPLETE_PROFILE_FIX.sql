-- COMPREHENSIVE FIX: Add columns, update trigger, and backfill profiles
-- Run this in Supabase SQL Editor

-- =====================================================
-- STEP 1: Add missing columns to profiles table
-- =====================================================

-- Add subscription_tier column
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'profiles' 
        AND column_name = 'subscription_tier'
    ) THEN
        ALTER TABLE public.profiles 
        ADD COLUMN subscription_tier TEXT DEFAULT 'free';
        RAISE NOTICE '✅ Added subscription_tier column';
    ELSE
        RAISE NOTICE 'ℹ️  subscription_tier column already exists';
    END IF;
END $$;

-- Add trial_ends_at column
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'profiles' 
        AND column_name = 'trial_ends_at'
    ) THEN
        ALTER TABLE public.profiles 
        ADD COLUMN trial_ends_at TIMESTAMPTZ;
        RAISE NOTICE '✅ Added trial_ends_at column';
    ELSE
        RAISE NOTICE 'ℹ️  trial_ends_at column already exists';
    END IF;
END $$;

-- Add trial_granted_at column
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'profiles' 
        AND column_name = 'trial_granted_at'
    ) THEN
        ALTER TABLE public.profiles 
        ADD COLUMN trial_granted_at TIMESTAMPTZ;
        RAISE NOTICE '✅ Added trial_granted_at column';
    ELSE
        RAISE NOTICE 'ℹ️  trial_granted_at column already exists';
    END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_profiles_trial_ends_at 
ON public.profiles(trial_ends_at) 
WHERE trial_ends_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_subscription_tier 
ON public.profiles(subscription_tier);

-- =====================================================
-- STEP 2: Update trigger to include trial on signup
-- =====================================================

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

    -- Insert profile record with 7-day trial
    INSERT INTO public.profiles (
        id,
        email,
        role,
        first_name,
        last_name,
        phone,
        subscription_tier,
        trial_ends_at,
        trial_granted_at,
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
        'basic',  -- Grant Basic tier for 7-day trial
        NOW() + INTERVAL '7 days',
        NOW(),
        NOW(),
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        role = COALESCE(profiles.role, EXCLUDED.role),
        first_name = COALESCE(profiles.first_name, EXCLUDED.first_name),
        last_name = COALESCE(profiles.last_name, EXCLUDED.last_name),
        -- Only grant trial if they don't have one
        subscription_tier = CASE 
            WHEN profiles.subscription_tier IS NULL OR profiles.subscription_tier = 'free'
            THEN 'basic'
            ELSE profiles.subscription_tier
        END,
        trial_ends_at = CASE 
            WHEN profiles.trial_ends_at IS NULL 
            THEN NOW() + INTERVAL '7 days'
            ELSE profiles.trial_ends_at
        END,
        trial_granted_at = CASE 
            WHEN profiles.trial_granted_at IS NULL 
            THEN NOW()
            ELSE profiles.trial_granted_at
        END,
        updated_at = NOW();

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Failed to create profile for new user %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created_profiles ON auth.users;
CREATE TRIGGER on_auth_user_created_profiles
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.create_profile_for_new_user();

-- =====================================================
-- STEP 3: Backfill profiles for existing auth users
-- =====================================================

-- Create profiles for users who don't have them yet
INSERT INTO public.profiles (
    id,
    email,
    role,
    first_name,
    last_name,
    phone,
    subscription_tier,
    trial_ends_at,
    trial_granted_at,
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
    u.raw_user_meta_data->>'phone',
    'basic',  -- Grant trial to all new profiles
    NOW() + INTERVAL '7 days',
    NOW(),
    u.created_at,
    NOW(),
    u.last_sign_in_at
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
  AND u.deleted_at IS NULL
  AND u.email IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- Get count of users backfilled
DO $$
DECLARE
    backfilled_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO backfilled_count
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    WHERE p.id IS NULL AND u.deleted_at IS NULL;
    
    IF backfilled_count = 0 THEN
        RAISE NOTICE '✅ All auth users now have profiles!';
    ELSE
        RAISE NOTICE '⚠️  Still missing % profiles', backfilled_count;
    END IF;
END $$;

-- =====================================================
-- STEP 4: Verification
-- =====================================================

-- Show column check
SELECT 
    '📋 Column Check' as status,
    column_name,
    data_type,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'profiles'
  AND column_name IN ('subscription_tier', 'trial_ends_at', 'trial_granted_at')
ORDER BY column_name;

-- Compare auth.users vs profiles counts
SELECT 
    '📊 User Count Check' as status,
    (SELECT COUNT(*) FROM auth.users WHERE deleted_at IS NULL) as auth_users,
    (SELECT COUNT(*) FROM profiles) as profiles,
    (SELECT COUNT(*) FROM auth.users u LEFT JOIN profiles p ON u.id = p.id WHERE p.id IS NULL AND u.deleted_at IS NULL) as missing_profiles;

-- Show recent users with their trial status
SELECT 
    '👥 Recent Users' as status,
    email,
    first_name,
    subscription_tier,
    TO_CHAR(trial_ends_at, 'YYYY-MM-DD HH24:MI') as trial_expires,
    ROUND(EXTRACT(EPOCH FROM (trial_ends_at - NOW())) / 86400, 1) as days_left,
    CASE 
        WHEN trial_ends_at IS NULL THEN '❌ No trial'
        WHEN trial_ends_at > NOW() THEN '✅ Active'
        ELSE '⚠️ Expired'
    END as trial_status
FROM public.profiles
WHERE created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 10;

-- Final summary
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ FIX COMPLETE!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'All auth users should now have profiles with 7-day trials';
    RAISE NOTICE 'New signups will automatically get profiles with trials';
    RAISE NOTICE '';
END $$;
