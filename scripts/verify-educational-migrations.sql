-- Educational Migrations Verification Script
-- Purpose: Verify all educational tables, functions, and policies are properly created

-- Check if all educational tables exist
SELECT 'Table Check' as test_type, 
       schemaname, 
       tablename, 
       CASE WHEN tablename IS NOT NULL THEN 'EXISTS' ELSE 'MISSING' END as status
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN (
    'courses', 
    'enrollments', 
    'assignments', 
    'submissions', 
    'grades',
    'groups',
    'student_groups',
    'course_join_requests',
    'assignment_access',
    'gradebook_entries',
    'course_grades',
    'student_progress',
    'scheduled_tasks'
)
ORDER BY tablename;

-- Check if all educational functions exist
SELECT 'Function Check' as test_type,
       proname as function_name,
       'EXISTS' as status
FROM pg_proc 
WHERE proname IN (
    'generate_course_join_code',
    'update_updated_at_column',
    'calculate_grade_percentage',
    'percentage_to_letter_grade',
    'apply_late_penalty',
    'letter_grade_to_gpa',
    'get_course_enrollment_stats',
    'get_course_grade_stats',
    'get_student_course_progress',
    'is_course_enrollment_full',
    'get_available_enrollment_slots',
    'validate_course_join_code',
    'assignment_accepts_submissions',
    'get_submission_attempt_count',
    'can_student_submit',
    'is_submission_late',
    'get_user_organization_id',
    'get_user_role',
    'user_has_role',
    'user_has_any_role',
    'same_organization_as_user',
    'can_access_course',
    'can_access_assignment',
    'can_access_submission',
    'can_access_grade',
    'get_course_enrollment_count',
    'get_course_assignment_count',
    'get_assignment_submission_count',
    'get_assignment_grade_count',
    'is_valid_join_code',
    'can_student_enroll_in_course',
    'update_gradebook_entry'
)
ORDER BY proname;

-- Check if all educational indexes exist
SELECT 'Index Check' as test_type,
       indexname,
       tablename,
       'EXISTS' as status
FROM pg_indexes 
WHERE schemaname = 'public'
AND indexname LIKE 'idx_%'
AND tablename IN (
    'courses', 
    'enrollments', 
    'assignments', 
    'submissions', 
    'grades',
    'groups',
    'student_groups',
    'course_join_requests',
    'assignment_access',
    'gradebook_entries',
    'course_grades',
    'student_progress',
    'scheduled_tasks'
)
ORDER BY tablename, indexname;

-- Check if all educational triggers exist
SELECT 'Trigger Check' as test_type,
       trigger_name,
       event_object_table as table_name,
       'EXISTS' as status
FROM information_schema.triggers
WHERE event_object_schema = 'public'
AND event_object_table IN (
    'courses', 
    'enrollments', 
    'assignments', 
    'submissions', 
    'grades',
    'groups',
    'gradebook_entries',
    'scheduled_tasks'
)
ORDER BY event_object_table, trigger_name;

-- Check storage buckets
SELECT 'Storage Bucket Check' as test_type,
       id as bucket_name,
       'EXISTS' as status,
       public,
       file_size_limit,
       array_length(allowed_mime_types, 1) as mime_type_count
FROM storage.buckets
WHERE id IN (
    'assignment-attachments',
    'submission-files', 
    'grade-documents',
    'course-resources'
)
ORDER BY id;

-- Check RLS policies on educational tables
SELECT 'RLS Policy Check' as test_type,
       schemaname,
       tablename,
       rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN (
    'courses', 
    'enrollments', 
    'assignments', 
    'submissions', 
    'grades',
    'groups',
    'student_groups',
    'course_join_requests',
    'assignment_access',
    'gradebook_entries',
    'course_grades',
    'student_progress',
    'scheduled_tasks'
)
ORDER BY tablename;

-- Check storage RLS policies
SELECT 'Storage RLS Policy Check' as test_type,
       policyname as policy_name,
       'EXISTS' as status,
       cmd as command_type
FROM pg_policies 
WHERE schemaname = 'storage'
AND tablename = 'objects'
AND policyname LIKE '%assignment_attachments%'
   OR policyname LIKE '%submission_files%'
   OR policyname LIKE '%grade_documents%'
   OR policyname LIKE '%course_resources%'
ORDER BY policyname;

-- Verify table relationships with foreign key constraints
SELECT 'Foreign Key Check' as test_type,
       tc.table_name,
       kcu.column_name,
       ccu.table_name AS foreign_table_name,
       ccu.column_name AS foreign_column_name,
       'EXISTS' as status
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_schema = 'public'
AND tc.table_name IN (
    'courses', 
    'enrollments', 
    'assignments', 
    'submissions', 
    'grades',
    'groups',
    'student_groups',
    'course_join_requests',
    'assignment_access',
    'gradebook_entries',
    'course_grades',
    'student_progress',
    'scheduled_tasks'
)
ORDER BY tc.table_name, kcu.column_name;

-- Test basic function calls (these should not error)
SELECT 'Function Test' as test_type,
       'calculate_grade_percentage' as function_name,
       calculate_grade_percentage(85.5, 100.0) as result;

SELECT 'Function Test' as test_type,
       'percentage_to_letter_grade' as function_name,
       percentage_to_letter_grade(92.5) as result;

SELECT 'Function Test' as test_type,
       'apply_late_penalty' as function_name,
       apply_late_penalty(90.0, 10.0, true) as result;

SELECT 'Function Test' as test_type,
       'letter_grade_to_gpa' as function_name,
       letter_grade_to_gpa('A-') as result;