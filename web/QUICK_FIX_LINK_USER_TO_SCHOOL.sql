-- Quick Fix: Link User to School
-- Run this in Supabase SQL Editor

-- Option 1: Link to first available school
UPDATE profiles 
SET preschool_id = (
  SELECT id FROM preschools ORDER BY created_at DESC LIMIT 1
)
WHERE email = 'davecon12martin@outlook.com'
AND preschool_id IS NULL;

-- Option 2: Create a test school and link user
DO $$
DECLARE
  new_school_id UUID;
  user_id UUID;
BEGIN
  -- Get user ID
  SELECT id INTO user_id FROM profiles WHERE email = 'davecon12martin@outlook.com';
  
  -- Check if school exists, if not create one
  SELECT id INTO new_school_id FROM preschools WHERE name = 'Test School';
  
  IF new_school_id IS NULL THEN
    -- Create test school
    INSERT INTO preschools (name, address, contact_email, contact_phone, subscription_tier)
    VALUES (
      'Test School',
      '123 Test St, Johannesburg',
      'admin@testschool.co.za',
      '+27123456789',
      'free'
    )
    RETURNING id INTO new_school_id;
  END IF;
  
  -- Link user to school
  UPDATE profiles 
  SET preschool_id = new_school_id
  WHERE id = user_id;
  
  RAISE NOTICE 'User linked to school: %', new_school_id;
END $$;

-- Verify the update
SELECT 
  id,
  email,
  first_name,
  last_name,
  role,
  preschool_id,
  (SELECT name FROM preschools WHERE id = profiles.preschool_id) as school_name
FROM profiles 
WHERE email = 'davecon12martin@outlook.com';
