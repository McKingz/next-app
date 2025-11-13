-- ========================================
-- Fix Teacher Classes and Students Count
-- ========================================
-- This script diagnoses and fixes the teacher-class-student relationship

-- ========================================
-- STEP 1: Diagnose the Problem
-- ========================================

-- Check teacher's user_id
SELECT 
    t.id as teacher_table_id,
    t.user_id as teacher_user_id,
    t.email,
    t.first_name || ' ' || t.last_name as teacher_name,
    t.is_active
FROM teachers t
WHERE t.is_active = true
ORDER BY t.created_at DESC;

-- Check if there are any classes in the system
SELECT 
    c.id as class_id,
    c.name as class_name,
    c.teacher_id,
    c.age_group,
    c.is_active,
    c.preschool_id,
    COUNT(s.id) as student_count
FROM classes c
LEFT JOIN students s ON s.class_id = c.id
GROUP BY c.id, c.name, c.teacher_id, c.age_group, c.is_active, c.preschool_id
ORDER BY c.created_at DESC;

-- Check if teacher_id matches any user_id from teachers table
SELECT 
    'Teacher' as source,
    t.user_id as id,
    t.email,
    t.first_name || ' ' || t.last_name as name
FROM teachers t
WHERE t.is_active = true

UNION ALL

SELECT 
    'Class Assignment' as source,
    c.teacher_id as id,
    'Class: ' || c.name as email,
    'Assigned to class' as name
FROM classes c
WHERE c.is_active = true AND c.teacher_id IS NOT NULL;

-- ========================================
-- STEP 2: Check the Mismatch
-- ========================================

-- Find classes with no matching teacher
SELECT 
    c.id as class_id,
    c.name as class_name,
    c.teacher_id as assigned_teacher_id,
    c.preschool_id,
    c.is_active,
    CASE 
        WHEN c.teacher_id IS NULL THEN 'No teacher assigned'
        WHEN NOT EXISTS (SELECT 1 FROM teachers t WHERE t.user_id = c.teacher_id) THEN 'Invalid teacher_id'
        ELSE 'OK'
    END as status
FROM classes c
WHERE c.is_active = true
ORDER BY c.created_at DESC;

-- Find teachers with no classes
SELECT 
    t.id,
    t.user_id,
    t.email,
    t.first_name || ' ' || t.last_name as teacher_name,
    COUNT(c.id) as class_count
FROM teachers t
LEFT JOIN classes c ON c.teacher_id = t.user_id AND c.is_active = true
WHERE t.is_active = true
GROUP BY t.id, t.user_id, t.email, t.first_name, t.last_name
HAVING COUNT(c.id) = 0;

-- ========================================
-- STEP 3: Detailed Teacher-Class-Student Breakdown
-- ========================================

SELECT 
    t.email as teacher_email,
    t.first_name || ' ' || t.last_name as teacher_name,
    t.user_id as teacher_user_id,
    c.id as class_id,
    c.name as class_name,
    c.teacher_id as class_teacher_id,
    CASE 
        WHEN t.user_id = c.teacher_id THEN '✓ Match'
        ELSE '✗ Mismatch'
    END as id_match_status,
    COUNT(DISTINCT s.id) as student_count,
    c.is_active as class_active
FROM teachers t
LEFT JOIN classes c ON c.preschool_id = t.preschool_id AND c.is_active = true
LEFT JOIN students s ON s.class_id = c.id
WHERE t.is_active = true
GROUP BY t.id, t.email, t.first_name, t.last_name, t.user_id, 
         c.id, c.name, c.teacher_id, c.is_active
ORDER BY t.email, c.name;

-- ========================================
-- STEP 4A: FIX - Assign Existing Classes to Teacher
-- ========================================
-- If classes exist but are not assigned to any teacher, assign them

-- Preview what will be updated
SELECT 
    c.id as class_id,
    c.name as class_name,
    c.teacher_id as current_teacher_id,
    (SELECT t.user_id FROM teachers t WHERE t.is_active = true ORDER BY t.created_at LIMIT 1) as new_teacher_id,
    (SELECT t.email FROM teachers t WHERE t.is_active = true ORDER BY t.created_at LIMIT 1) as teacher_email
FROM classes c
WHERE c.is_active = true
  AND (c.teacher_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM teachers t WHERE t.user_id = c.teacher_id
  ));

-- UNCOMMENT TO EXECUTE: Assign unassigned classes to the first active teacher
-- UPDATE classes
-- SET teacher_id = (
--     SELECT t.user_id 
--     FROM teachers t 
--     WHERE t.is_active = true 
--     ORDER BY t.created_at 
--     LIMIT 1
-- )
-- WHERE is_active = true
--   AND (teacher_id IS NULL OR NOT EXISTS (
--       SELECT 1 FROM teachers t WHERE t.user_id = classes.teacher_id
--   ));

-- ========================================
-- STEP 4B: FIX - Create Sample Classes (if none exist)
-- ========================================
-- If no classes exist at all, create sample classes

-- Check if classes exist
SELECT COUNT(*) as total_classes FROM classes WHERE is_active = true;

-- UNCOMMENT TO EXECUTE: Create sample classes if none exist
-- WITH teacher_info AS (
--     SELECT 
--         t.user_id,
--         t.preschool_id
--     FROM teachers t
--     WHERE t.is_active = true
--     ORDER BY t.created_at
--     LIMIT 1
-- )
-- INSERT INTO classes (name, age_group, max_students, teacher_id, preschool_id, is_active, created_at)
-- SELECT 
--     'Morning Stars' as name,
--     'toddlers' as age_group,
--     15 as max_students,
--     ti.user_id as teacher_id,
--     ti.preschool_id,
--     true as is_active,
--     NOW() as created_at
-- FROM teacher_info ti
-- WHERE NOT EXISTS (
--     SELECT 1 FROM classes c WHERE c.preschool_id = ti.preschool_id AND c.is_active = true
-- );

-- ========================================
-- STEP 5: Verify the Fix
-- ========================================

-- Final verification: Teacher with classes and students
SELECT 
    t.email as teacher_email,
    t.first_name || ' ' || t.last_name as teacher_name,
    COUNT(DISTINCT c.id) as classes_count,
    COUNT(DISTINCT s.id) as students_count,
    STRING_AGG(DISTINCT c.name, ', ') as class_names
FROM teachers t
LEFT JOIN classes c ON c.teacher_id = t.user_id AND c.is_active = true
LEFT JOIN students s ON s.class_id = c.id
WHERE t.is_active = true
GROUP BY t.id, t.email, t.first_name, t.last_name
ORDER BY classes_count DESC;

-- ========================================
-- QUICK FIX COMMANDS (Copy and uncomment as needed)
-- ========================================

-- Option A: Assign first unassigned class to first teacher
-- UPDATE classes
-- SET teacher_id = (SELECT user_id FROM teachers WHERE is_active = true ORDER BY created_at LIMIT 1)
-- WHERE id = (SELECT id FROM classes WHERE is_active = true AND teacher_id IS NULL ORDER BY created_at LIMIT 1);

-- Option B: Assign ALL unassigned classes to first teacher
-- UPDATE classes
-- SET teacher_id = (SELECT user_id FROM teachers WHERE is_active = true ORDER BY created_at LIMIT 1)
-- WHERE is_active = true AND teacher_id IS NULL;

-- Option C: Assign specific class to specific teacher (replace IDs)
-- UPDATE classes
-- SET teacher_id = 'teacher_user_id_here'
-- WHERE id = 'class_id_here';
