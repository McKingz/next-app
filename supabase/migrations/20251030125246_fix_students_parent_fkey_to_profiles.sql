-- Fix students.parent_id foreign key to reference profiles instead of users
-- Date: 2025-10-30 12:52:46
-- Issue: Foreign key constraint references deprecated users table
-- Context: Child registration approval failing with FK constraint violation

BEGIN;

-- Step 1: Drop the old foreign key constraints FIRST
ALTER TABLE students 
DROP CONSTRAINT IF EXISTS students_parent_id_fkey;

ALTER TABLE students 
DROP CONSTRAINT IF EXISTS students_guardian_id_fkey;

-- Step 2: Migrate orphaned parent_id values from users.id to profiles.id (auth_user_id)
UPDATE students s
SET parent_id = u.auth_user_id
FROM users u
WHERE s.parent_id = u.id
  AND s.parent_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = s.parent_id);

-- Step 3: Migrate orphaned guardian_id values from users.id to profiles.id (auth_user_id)
UPDATE students s
SET guardian_id = u.auth_user_id
FROM users u
WHERE s.guardian_id = u.id
  AND s.guardian_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = s.guardian_id);

-- Step 4: Create new foreign key constraints referencing profiles table
ALTER TABLE students
ADD CONSTRAINT students_parent_id_fkey 
FOREIGN KEY (parent_id) 
REFERENCES profiles(id) 
ON DELETE SET NULL;

ALTER TABLE students
ADD CONSTRAINT students_guardian_id_fkey 
FOREIGN KEY (guardian_id) 
REFERENCES profiles(id) 
ON DELETE SET NULL;

-- Add comment
COMMENT ON CONSTRAINT students_parent_id_fkey ON students IS
'References profiles table (profiles-first architecture). Parent ID must exist in profiles.id (which equals auth.uid())';

COMMENT ON CONSTRAINT students_guardian_id_fkey ON students IS
'References profiles table (profiles-first architecture). Guardian ID must exist in profiles.id (which equals auth.uid())';

COMMIT;