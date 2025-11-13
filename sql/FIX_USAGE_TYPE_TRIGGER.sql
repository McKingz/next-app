-- ================================================
-- FIX: usage_type Not Saving to Profiles Table
-- ================================================
-- Run this in Supabase SQL Editor
-- ================================================

-- Update the trigger function to include usage_type
CREATE OR REPLACE FUNCTION create_profile_for_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    first_name,
    last_name,
    role,
    usage_type,  -- ADDED: Save usage_type from signup
    phone,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    COALESCE(NEW.raw_user_meta_data->>'role', 'parent'),
    NEW.raw_user_meta_data->>'usage_type',  -- ADDED: Get from auth metadata
    NEW.raw_user_meta_data->>'phone',
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix existing user (davecon12martin@outlook.com)
UPDATE profiles
SET usage_type = 'k12_school'
WHERE email = 'davecon12martin@outlook.com'
AND usage_type IS NULL;

-- Verify the fix
SELECT 
  email,
  preschool_id,
  usage_type,
  is_trial,
  trial_end_date
FROM profiles
WHERE email = 'davecon12martin@outlook.com';

SELECT '? Trigger updated and user fixed!' as status;
