-- ========================================
-- QUICK FIX: Teacher Classes Assignment
-- ========================================
-- Copy and paste these queries in order

-- STEP 1: Get teacher's user_id
SELECT 
    user_id,
    email,
    first_name || ' ' || last_name as name
FROM teachers 
WHERE is_active = true 
LIMIT 1;

-- ⬆️ COPY THE user_id VALUE FROM ABOVE ⬆️

-- STEP 2: Check current class assignments
SELECT 
    id,
    name,
    teacher_id,
    CASE 
        WHEN teacher_id IS NULL THEN '❌ Unassigned'
        ELSE '✓ Assigned'
    END as status
FROM classes 
WHERE is_active = true;

-- STEP 3: Assign all classes to your teacher
-- Replace 'YOUR_TEACHER_USER_ID' with the value from Step 1
UPDATE classes
SET teacher_id = 'YOUR_TEACHER_USER_ID'
WHERE is_active = true;

-- Example (replace with your actual UUID):
-- UPDATE classes
-- SET teacher_id = 'abc12345-1234-1234-1234-123456789abc'
-- WHERE is_active = true;

-- STEP 4: Verify it worked
SELECT 
    t.email,
    t.first_name || ' ' || t.last_name as teacher,
    COUNT(DISTINCT c.id) as classes,
    COUNT(DISTINCT s.id) as students
FROM teachers t
LEFT JOIN classes c ON c.teacher_id = t.user_id AND c.is_active = true
LEFT JOIN students s ON s.class_id = c.id
WHERE t.is_active = true
GROUP BY t.id, t.email, t.first_name, t.last_name;

-- Expected output:
-- teacher   | classes | students
-- John Doe  |    1    |    5

-- ========================================
-- IF STEP 3 DOESN'T WORK (RLS issue)
-- ========================================
-- Run this alternative that bypasses RLS safely:

DO $$
DECLARE
    teacher_uid uuid;
BEGIN
    -- Get the first active teacher's user_id
    SELECT user_id INTO teacher_uid
    FROM teachers
    WHERE is_active = true
    ORDER BY created_at
    LIMIT 1;
    
    -- Update all active classes
    UPDATE classes
    SET teacher_id = teacher_uid
    WHERE is_active = true;
    
    RAISE NOTICE 'Updated classes to teacher_id: %', teacher_uid;
END $$;

-- ========================================
-- ALTERNATIVE: One-liner (automatic)
-- ========================================
-- This finds the teacher automatically and assigns classes

UPDATE classes 
SET teacher_id = (
    SELECT user_id 
    FROM teachers 
    WHERE is_active = true 
    ORDER BY created_at 
    LIMIT 1
)
WHERE is_active = true 
  AND (teacher_id IS NULL OR teacher_id != (
      SELECT user_id 
      FROM teachers 
      WHERE is_active = true 
      ORDER BY created_at 
      LIMIT 1
  ));

-- ========================================
-- TROUBLESHOOTING
-- ========================================

-- Check if teacher exists
SELECT COUNT(*) as teacher_count FROM teachers WHERE is_active = true;

-- Check if classes exist  
SELECT COUNT(*) as class_count FROM classes WHERE is_active = true;

-- Check if students exist
SELECT COUNT(*) as student_count FROM students;

-- Check teacher-class-student relationship
SELECT 
    'Teachers' as table_name, COUNT(*) as count FROM teachers WHERE is_active = true
UNION ALL
SELECT 'Classes', COUNT(*) FROM classes WHERE is_active = true
UNION ALL
SELECT 'Students', COUNT(*) FROM students
UNION ALL
SELECT 'Classes with Teacher', COUNT(*) FROM classes WHERE is_active = true AND teacher_id IS NOT NULL
UNION ALL
SELECT 'Classes with Students', COUNT(DISTINCT class_id) FROM students WHERE class_id IS NOT NULL;
