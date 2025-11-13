-- Test Data and Configuration Seed Script
-- Date: 2025-09-21
-- Purpose: Create test data for development and testing purposes
-- This script is IDEMPOTENT - safe to run multiple times

BEGIN;

-- ====================================================================
-- PART 1: FEATURE FLAGS CONFIGURATION
-- ====================================================================

-- Set up feature flags for the platform
INSERT INTO feature_flags (
    flag_name,
    is_enabled,
    description,
    target_users,
    metadata
) VALUES 
-- Core Features
('ai_features_enabled', true, 'Enable AI-powered features across the platform', '[]'::jsonb, 
 jsonb_build_object('category', 'ai', 'stability', 'stable', 'default_for_new_users', true)),

('two_factor_auth_required', true, 'Require 2FA for specific user roles', 
 jsonb_build_array('super_admin', 'principal'), 
 jsonb_build_object('category', 'security', 'enforce_for_roles', jsonb_build_array('super_admin', 'principal'))),

('mobile_app_access', true, 'Allow access to mobile applications', '[]'::jsonb,
 jsonb_build_object('category', 'access', 'platform', 'mobile')),

-- Educational Features
('gradebook_enabled', true, 'Enable gradebook functionality for teachers', '[]'::jsonb,
 jsonb_build_object('category', 'education', 'user_types', jsonb_build_array('teacher', 'principal'))),

('assignment_submissions', true, 'Allow students to submit assignments', '[]'::jsonb,
 jsonb_build_object('category', 'education', 'user_types', jsonb_build_array('student', 'teacher'))),

('course_analytics', true, 'Enable course performance analytics', '[]'::jsonb,
 jsonb_build_object('category', 'analytics', 'user_types', jsonb_build_array('teacher', 'principal', 'super_admin'))),

-- AI-Specific Features
('ai_homework_help', true, 'AI-powered homework assistance', '[]'::jsonb,
 jsonb_build_object('category', 'ai', 'quota_applies', true, 'tier_restricted', true)),

('ai_lesson_planning', true, 'AI-assisted lesson plan generation', '[]'::jsonb,
 jsonb_build_object('category', 'ai', 'quota_applies', true, 'user_types', jsonb_build_array('teacher'))),

('ai_grading_assistance', true, 'AI-powered grading and feedback', '[]'::jsonb,
 jsonb_build_object('category', 'ai', 'quota_applies', true, 'user_types', jsonb_build_array('teacher'))),

-- Beta Features
('beta_advanced_analytics', false, 'Advanced analytics dashboard (beta)', '[]'::jsonb,
 jsonb_build_object('category', 'analytics', 'stability', 'beta', 'requires_opt_in', true))

ON CONFLICT (flag_name) DO UPDATE SET
    description = EXCLUDED.description,
    metadata = EXCLUDED.metadata,
    updated_at = now();

-- ====================================================================
-- PART 2: TEST ORGANIZATIONS AND SCHOOLS
-- ====================================================================

-- Create test organization (only if it doesn't exist)
INSERT INTO organizations (
    name,
    domain,
    subscription_tier,
    is_active,
    metadata
) VALUES (
    'Test School District',
    'testschool.edu',
    'premium',
    true,
    jsonb_build_object(
        'type', 'test_organization',
        'created_for', 'development_and_testing',
        'location', 'Test City, Test Province',
        'student_count', 500,
        'teacher_count', 30
    )
) ON CONFLICT (domain) DO NOTHING;

-- ====================================================================
-- PART 3: TEST USER ACCOUNTS (FOR DEVELOPMENT)
-- ====================================================================

-- Note: These are placeholder entries for development
-- Actual users should be created through Supabase Auth first

-- Create test profiles for common scenarios
INSERT INTO profiles (
    id,
    email,
    role,
    first_name,
    last_name,
    capabilities,
    metadata
) VALUES 
-- Test Principal
(
    '00000000-0000-0000-0000-000000000001'::uuid,
    'test.principal@testschool.edu',
    'principal',
    'Test',
    'Principal',
    jsonb_build_array(
        'access_mobile_app',
        'manage_school',
        'view_all_classes',
        'manage_teachers',
        'view_reports',
        'manage_students'
    ),
    jsonb_build_object('test_account', true, 'auto_created', true)
),
-- Test Teacher
(
    '00000000-0000-0000-0000-000000000002'::uuid,
    'test.teacher@testschool.edu',
    'teacher',
    'Test',
    'Teacher',
    jsonb_build_array(
        'access_mobile_app',
        'manage_classes',
        'create_assignments',
        'grade_assignments',
        'view_student_progress'
    ),
    jsonb_build_object('test_account', true, 'auto_created', true)
),
-- Test Student
(
    '00000000-0000-0000-0000-000000000003'::uuid,
    'test.student@testschool.edu',
    'student',
    'Test',
    'Student',
    jsonb_build_array(
        'access_mobile_app',
        'view_assignments',
        'submit_assignments',
        'view_grades'
    ),
    jsonb_build_object('test_account', true, 'auto_created', true)
)
ON CONFLICT (id) DO UPDATE SET
    capabilities = EXCLUDED.capabilities,
    metadata = EXCLUDED.metadata || jsonb_build_object('updated', now());

-- ====================================================================
-- PART 4: ASSIGN AI TIERS TO TEST USERS
-- ====================================================================

-- Assign appropriate AI tiers to test users
INSERT INTO user_ai_tiers (user_id, tier, assigned_reason, metadata)
VALUES 
('00000000-0000-0000-0000-000000000001'::uuid, 'premium', 'Test principal account - needs premium features', 
 jsonb_build_object('test_account', true, 'assigned_during', 'seed_script')),
('00000000-0000-0000-0000-000000000002'::uuid, 'starter', 'Test teacher account - basic AI features', 
 jsonb_build_object('test_account', true, 'assigned_during', 'seed_script')),
('00000000-0000-0000-0000-000000000003'::uuid, 'free', 'Test student account - limited features', 
 jsonb_build_object('test_account', true, 'assigned_during', 'seed_script'))
ON CONFLICT (user_id) DO UPDATE SET
    metadata = EXCLUDED.metadata || jsonb_build_object('tier_updated', now());

-- ====================================================================
-- PART 5: SAMPLE COURSES AND EDUCATIONAL CONTENT
-- ====================================================================

-- Create sample courses
INSERT INTO courses (
    title,
    description,
    instructor_id,
    subject,
    grade_level,
    is_active,
    metadata
) VALUES 
(
    'Introduction to Mathematics',
    'Basic mathematics concepts for grade 10 students',
    '00000000-0000-0000-0000-000000000002'::uuid,
    'Mathematics',
    '10',
    true,
    jsonb_build_object(
        'test_course', true,
        'duration_weeks', 16,
        'max_students', 30,
        'curriculum_aligned', true
    )
),
(
    'English Language Arts',
    'Comprehensive English language and literature course',
    '00000000-0000-0000-0000-000000000002'::uuid,
    'English',
    '10',
    true,
    jsonb_build_object(
        'test_course', true,
        'duration_weeks', 16,
        'max_students', 25,
        'includes_creative_writing', true
    )
),
(
    'Basic Computer Science',
    'Introduction to programming and computer concepts',
    '00000000-0000-0000-0000-000000000002'::uuid,
    'Computer Science',
    '11',
    true,
    jsonb_build_object(
        'test_course', true,
        'duration_weeks', 12,
        'max_students', 20,
        'requires_laptop', true
    )
)
ON CONFLICT DO NOTHING;

-- ====================================================================
-- PART 6: SAMPLE ENROLLMENTS
-- ====================================================================

-- Enroll test student in courses
INSERT INTO enrollments (student_id, course_id, enrollment_status, metadata)
SELECT 
    '00000000-0000-0000-0000-000000000003'::uuid,
    c.id,
    'active',
    jsonb_build_object('test_enrollment', true, 'auto_enrolled', true)
FROM courses c
WHERE c.instructor_id = '00000000-0000-0000-0000-000000000002'::uuid
ON CONFLICT (student_id, course_id) DO NOTHING;

-- ====================================================================
-- PART 7: SAMPLE ASSIGNMENTS
-- ====================================================================

-- Create sample assignments
INSERT INTO assignments (
    course_id,
    title,
    description,
    due_date,
    total_points,
    assignment_type,
    metadata
)
SELECT 
    c.id,
    'Week 1: ' || c.subject || ' Basics',
    'Introduction assignment covering fundamental concepts in ' || c.subject,
    (now() + interval '1 week')::date,
    100,
    'homework',
    jsonb_build_object(
        'test_assignment', true,
        'difficulty_level', 'beginner',
        'estimated_time_minutes', 60
    )
FROM courses c
WHERE c.instructor_id = '00000000-0000-0000-0000-000000000002'::uuid
ON CONFLICT DO NOTHING;

-- ====================================================================
-- PART 8: OPTIMIZATION AND CLEANUP
-- ====================================================================

-- Update table statistics for better query performance
ANALYZE profiles;
ANALYZE courses;
ANALYZE enrollments;
ANALYZE assignments;
ANALYZE feature_flags;

-- ====================================================================
-- PART 9: CONFIGURATION SUMMARY
-- ====================================================================

DO $$
DECLARE
    feature_count INTEGER;
    course_count INTEGER;
    enrollment_count INTEGER;
    assignment_count INTEGER;
    profile_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO feature_count FROM feature_flags WHERE is_enabled = true;
    SELECT COUNT(*) INTO course_count FROM courses WHERE is_active = true;
    SELECT COUNT(*) INTO enrollment_count FROM enrollments WHERE enrollment_status = 'active';
    SELECT COUNT(*) INTO assignment_count FROM assignments;
    SELECT COUNT(*) INTO profile_count FROM profiles WHERE metadata->>'test_account' = 'true';
    
    RAISE NOTICE '';
    RAISE NOTICE '==================================================';
    RAISE NOTICE 'TEST DATA AND CONFIGURATION SEEDED SUCCESSFULLY';
    RAISE NOTICE '==================================================';
    RAISE NOTICE 'Active Feature Flags: %', feature_count;
    RAISE NOTICE 'Test User Profiles: %', profile_count;
    RAISE NOTICE 'Active Courses: %', course_count;
    RAISE NOTICE 'Active Enrollments: %', enrollment_count;
    RAISE NOTICE 'Sample Assignments: %', assignment_count;
    RAISE NOTICE '';
    RAISE NOTICE 'TEST ACCOUNTS CREATED:';
    RAISE NOTICE '• test.principal@testschool.edu (Principal, Premium AI)';
    RAISE NOTICE '• test.teacher@testschool.edu (Teacher, Starter AI)';
    RAISE NOTICE '• test.student@testschool.edu (Student, Free AI)';
    RAISE NOTICE '';
    RAISE NOTICE 'NOTE: Test accounts must be created in Supabase Auth';
    RAISE NOTICE 'with matching UUIDs for full functionality.';
    RAISE NOTICE '==================================================';
END $$;

COMMIT;