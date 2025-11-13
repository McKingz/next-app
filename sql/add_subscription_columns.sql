-- Add subscription_tier and trial columns to profiles table
-- This is required for the trial system to work

-- Add subscription_tier column if it doesn't exist
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
        
        RAISE NOTICE 'Added subscription_tier column to profiles';
    ELSE
        RAISE NOTICE 'subscription_tier column already exists';
    END IF;
END $$;

-- Add trial_ends_at column if it doesn't exist
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
        
        RAISE NOTICE 'Added trial_ends_at column to profiles';
    ELSE
        RAISE NOTICE 'trial_ends_at column already exists';
    END IF;
END $$;

-- Add trial_granted_at column if it doesn't exist
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
        
        RAISE NOTICE 'Added trial_granted_at column to profiles';
    ELSE
        RAISE NOTICE 'trial_granted_at column already exists';
    END IF;
END $$;

-- Create index for faster trial queries
CREATE INDEX IF NOT EXISTS idx_profiles_trial_ends_at 
ON public.profiles(trial_ends_at) 
WHERE trial_ends_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_subscription_tier 
ON public.profiles(subscription_tier);

-- Grant 7-day trial to all recent standalone parents without a trial
UPDATE public.profiles
SET 
    subscription_tier = 'basic',
    trial_ends_at = NOW() + INTERVAL '7 days',
    trial_granted_at = NOW(),
    updated_at = NOW()
WHERE subscription_tier = 'free'
  AND trial_ends_at IS NULL
  AND role = 'parent'
  AND organization_id IS NULL  -- Standalone users only
  AND preschool_id IS NULL
  AND created_at > NOW() - INTERVAL '7 days';

-- Verify the changes
SELECT 
    'Column Check' as check_type,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'profiles'
  AND column_name IN ('subscription_tier', 'trial_ends_at', 'trial_granted_at')
ORDER BY column_name;

-- Show recent users with their trial status
SELECT 
    email,
    first_name,
    subscription_tier,
    TO_CHAR(trial_ends_at, 'YYYY-MM-DD HH24:MI') as trial_expires,
    ROUND(EXTRACT(EPOCH FROM (trial_ends_at - NOW())) / 86400, 1) as days_left,
    CASE 
        WHEN trial_ends_at IS NULL THEN '❌ No trial'
        WHEN trial_ends_at > NOW() THEN '✅ Active'
        ELSE '⚠️ Expired'
    END as status
FROM public.profiles
WHERE created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 10;
