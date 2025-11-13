-- ========================================
-- Fix Teacher Names in Database
-- ========================================
-- This script checks for and fixes teachers with missing names

-- Step 1: Check current state of teachers
SELECT 
    id,
    email,
    first_name,
    last_name,
    CASE 
        WHEN first_name IS NULL OR first_name = '' THEN 'Missing first_name'
        WHEN last_name IS NULL OR last_name = '' THEN 'Missing last_name'
        ELSE 'OK'
    END as name_status,
    is_active,
    preschool_id
FROM teachers
WHERE is_active = true
ORDER BY created_at DESC;

-- Step 2: Fix teachers with missing names
-- This will extract name from email and set proper first/last names
UPDATE teachers
SET 
    first_name = CASE 
        WHEN first_name IS NULL OR first_name = '' THEN 
            INITCAP(split_part(split_part(email, '@', 1), '.', 1))
        ELSE first_name
    END,
    last_name = CASE 
        WHEN last_name IS NULL OR last_name = '' THEN 
            CASE 
                WHEN split_part(split_part(email, '@', 1), '.', 2) != '' THEN
                    INITCAP(split_part(split_part(email, '@', 1), '.', 2))
                ELSE 'Teacher'
            END
        ELSE last_name
    END
WHERE is_active = true
  AND (first_name IS NULL OR first_name = '' OR last_name IS NULL OR last_name = '');

-- Step 3: Verify the fix
SELECT 
    id,
    email,
    first_name,
    last_name,
    first_name || ' ' || last_name as full_name,
    is_active
FROM teachers
WHERE is_active = true
ORDER BY created_at DESC;

-- ========================================
-- Alternative: Set specific names manually
-- ========================================
-- If you know the actual teacher names, use this instead:

-- UPDATE teachers
-- SET 
--     first_name = 'John',
--     last_name = 'Doe'
-- WHERE email = 'teacher@example.com';

-- ========================================
-- Explanation:
-- ========================================
-- The script tries to extract names from email addresses
-- For example: john.doe@school.com becomes "John" "Doe"
-- If email doesn't have dots, it uses "Teacher" as last name
