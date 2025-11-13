-- Fix: Auto-grant trial to new users on signup
-- IMPORTANT: Run add_subscription_columns.sql FIRST!
-- This updates the trigger to automatically grant a 7-day trial

-- First, ensure the columns exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'profiles' 
        AND column_name = 'subscription_tier'
    ) THEN
        RAISE EXCEPTION 'subscription_tier column missing! Run add_subscription_columns.sql first';
    END IF;
END $$;

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
        'basic',  -- Grant Basic tier for trial
        NOW() + INTERVAL '7 days',  -- 7-day trial
        NOW(),
        NOW(),
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        role = COALESCE(profiles.role, EXCLUDED.role),
        -- Only grant trial if they don't have one already
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
        -- Log error but don't block user creation
        RAISE WARNING 'Failed to create profile for new user %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$;

-- Grant trial to the newly registered user (ebarksy)
-- Get user ID first and update their profile
DO $$
DECLARE
    new_user_id UUID;
BEGIN
    -- Find the new user by checking recent signups
    SELECT id INTO new_user_id
    FROM auth.users
    WHERE email LIKE '%barksy%'
      OR raw_user_meta_data->>'first_name' ILIKE '%barksy%'
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF new_user_id IS NOT NULL THEN
        -- Grant them a 7-day trial
        UPDATE profiles
        SET 
            subscription_tier = 'basic',
            trial_ends_at = NOW() + INTERVAL '7 days',
            trial_granted_at = NOW(),
            updated_at = NOW()
        WHERE id = new_user_id
          AND (subscription_tier IS NULL OR subscription_tier = 'free');
        
        RAISE NOTICE 'Granted 7-day trial to user %', new_user_id;
    ELSE
        RAISE NOTICE 'Could not find new user';
    END IF;
END $$;

-- Also grant trials to any other recent users without one
UPDATE profiles
SET 
    subscription_tier = 'basic',
    trial_ends_at = NOW() + INTERVAL '7 days',
    trial_granted_at = NOW(),
    updated_at = NOW()
WHERE (subscription_tier IS NULL OR subscription_tier = 'free')
  AND trial_ends_at IS NULL
  AND created_at > NOW() - INTERVAL '1 day'
  AND role = 'parent';

-- Verify the changes
SELECT 
    email,
    subscription_tier,
    trial_ends_at,
    trial_granted_at,
    CASE 
        WHEN trial_ends_at IS NULL THEN '❌ No trial'
        WHEN trial_ends_at > NOW() THEN '✅ Active trial'
        ELSE '⚠️ Trial expired'
    END as trial_status,
    EXTRACT(DAY FROM (trial_ends_at - NOW())) as days_remaining
FROM profiles
WHERE created_at > NOW() - INTERVAL '1 day'
ORDER BY created_at DESC
LIMIT 5;
