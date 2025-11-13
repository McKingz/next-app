-- ========================================
-- Teacher Data Verification Script
-- ========================================
-- Run this in Supabase SQL Editor to verify teacher data is properly set up
-- Replace [YOUR_PRESCHOOL_ID] with your actual preschool ID

-- ========================================
-- 1. Get your preschool ID (if you don't know it)
-- ========================================
SELECT 
    id as preschool_id,
    name as preschool_name,
    max_students as capacity
FROM preschools
ORDER BY created_at DESC
LIMIT 5;

-- ========================================
-- 2. Check teachers table for active teachers
-- ========================================
SELECT 
    t.id,
    t.user_id,
    t.email,
    t.first_name,
    t.last_name,
    t.phone,
    t.is_active,
    t.subject_specialization,
    t.preschool_id,
    p.name as preschool_name,
    t.created_at
FROM teachers t
LEFT JOIN preschools p ON p.id = t.preschool_id
WHERE t.is_active = true
ORDER BY t.created_at DESC;

-- ========================================
-- 3. Check if teachers have classes assigned
-- ========================================
SELECT 
    t.email as teacher_email,
    t.first_name || ' ' || t.last_name as teacher_name,
    COUNT(DISTINCT c.id) as classes_count,
    COUNT(DISTINCT s.id) as students_count
FROM teachers t
LEFT JOIN classes c ON c.teacher_id = t.user_id AND c.is_active = true
LEFT JOIN students s ON s.class_id = c.id
WHERE t.is_active = true
GROUP BY t.id, t.email, t.first_name, t.last_name
ORDER BY classes_count DESC, students_count DESC;

-- ========================================
-- 4. Detailed view of teacher-class-student relationships
-- ========================================
SELECT 
    t.email as teacher_email,
    t.first_name || ' ' || t.last_name as teacher_name,
    c.name as class_name,
    c.age_group,
    c.is_active as class_active,
    COUNT(s.id) as student_count
FROM teachers t
LEFT JOIN classes c ON c.teacher_id = t.user_id
LEFT JOIN students s ON s.class_id = c.id
WHERE t.is_active = true
GROUP BY t.id, t.email, t.first_name, t.last_name, c.id, c.name, c.age_group, c.is_active
ORDER BY t.email, c.name;

-- ========================================
-- 5. Check for data quality issues
-- ========================================
-- Teachers with missing names
SELECT 
    'Missing first_name or last_name' as issue,
    id,
    email,
    first_name,
    last_name,
    preschool_id
FROM teachers
WHERE is_active = true 
  AND (first_name IS NULL OR last_name IS NULL OR first_name = '' OR last_name = '');

-- Teachers with no classes
SELECT 
    'No classes assigned' as issue,
    t.id,
    t.email,
    t.first_name || ' ' || t.last_name as teacher_name
FROM teachers t
LEFT JOIN classes c ON c.teacher_id = t.user_id AND c.is_active = true
WHERE t.is_active = true
  AND c.id IS NULL;

-- Teachers with mismatched user_id
SELECT 
    'Invalid or missing user_id' as issue,
    t.id,
    t.email,
    t.user_id,
    t.first_name || ' ' || t.last_name as teacher_name
FROM teachers t
WHERE t.is_active = true
  AND (t.user_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM auth.users au WHERE au.id = t.user_id
  ));

-- ========================================
-- 6. Summary statistics
-- ========================================
WITH teacher_stats AS (
  SELECT 
    p.name as preschool_name,
    COUNT(DISTINCT t.id) as total_teachers,
    COUNT(DISTINCT CASE WHEN c.id IS NOT NULL THEN t.id END) as teachers_with_classes,
    COUNT(DISTINCT c.id) as total_classes,
    COUNT(DISTINCT s.id) as total_students
  FROM preschools p
  LEFT JOIN teachers t ON t.preschool_id = p.id AND t.is_active = true
  LEFT JOIN classes c ON c.teacher_id = t.user_id AND c.is_active = true
  LEFT JOIN students s ON s.class_id = c.id
  GROUP BY p.id, p.name
)
SELECT 
  preschool_name,
  total_teachers,
  teachers_with_classes,
  (total_teachers - teachers_with_classes) as teachers_without_classes,
  total_classes,
  total_students,
  CASE 
    WHEN total_teachers > 0 THEN ROUND((total_students::numeric / total_teachers), 1)
    ELSE 0 
  END as avg_students_per_teacher
FROM teacher_stats
ORDER BY total_teachers DESC;

-- ========================================
-- 7. RLS Policy Check (for principals)
-- ========================================
-- Run this to verify RLS policies allow principals to view teachers
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE tablename IN ('teachers', 'classes', 'students')
ORDER BY tablename, policyname;
