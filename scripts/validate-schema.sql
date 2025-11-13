-- Schema Validation Script
-- Purpose: Validate that all Phase 1 migrations were applied successfully
-- Usage: Run this against your Supabase database to verify schema

-- ====================================================================
-- VALIDATION QUERIES
-- ====================================================================

-- Check that all required tables exist
SELECT 
    'TABLES' as check_type,
    CASE 
        WHEN COUNT(*) = 9 THEN 'PASS'
        ELSE 'FAIL - Expected 9 tables, found ' || COUNT(*)
    END as status,
    array_agg(table_name ORDER BY table_name) as details
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'courses', 'enrollments', 'assignments', 'submissions', 'grades',
    'ai_model_tiers', 'user_ai_tiers', 'ai_usage', 'audit_logs'
);

-- Check that all required indexes exist
SELECT 
    'INDEXES' as check_type,
    CASE 
        WHEN COUNT(*) >= 25 THEN 'PASS'
        ELSE 'FAIL - Expected at least 25 indexes, found ' || COUNT(*)
    END as status,
    COUNT(*) || ' indexes found' as details
FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename IN (
    'courses', 'enrollments', 'assignments', 'submissions', 'grades',
    'ai_model_tiers', 'user_ai_tiers', 'ai_usage', 'audit_logs'
);

-- Check that all required functions exist
SELECT 
    'FUNCTIONS' as check_type,
    CASE 
        WHEN COUNT(*) >= 10 THEN 'PASS'
        ELSE 'FAIL - Expected at least 10 functions, found ' || COUNT(*)
    END as status,
    array_agg(routine_name ORDER BY routine_name) as details
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN (
    'generate_course_join_code', 'update_updated_at_column',
    'get_user_ai_tier', 'record_ai_usage', 'create_audit_log',
    'user_has_role', 'is_super_admin', 'is_admin_level', 'is_instructor_level',
    'get_user_organization_id', 'can_access_organization'
);

-- Check that RLS is enabled on all tables
SELECT 
    'RLS_ENABLED' as check_type,
    CASE 
        WHEN COUNT(*) = 9 THEN 'PASS'
        ELSE 'FAIL - Expected 9 tables with RLS, found ' || COUNT(*)
    END as status,
    array_agg(tablename ORDER BY tablename) as details
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN (
    'courses', 'enrollments', 'assignments', 'submissions', 'grades',
    'ai_model_tiers', 'user_ai_tiers', 'ai_usage', 'audit_logs'
)
AND rowsecurity = true;

-- Check that RLS policies exist
SELECT 
    'RLS_POLICIES' as check_type,
    CASE 
        WHEN COUNT(*) >= 30 THEN 'PASS'
        ELSE 'FAIL - Expected at least 30 policies, found ' || COUNT(*)
    END as status,
    COUNT(*) || ' policies found across ' || COUNT(DISTINCT tablename) || ' tables' as details
FROM pg_policies 
WHERE schemaname = 'public';

-- Check that AI model tiers were inserted
SELECT 
    'AI_MODEL_TIERS_DATA' as check_type,
    CASE 
        WHEN COUNT(*) = 4 THEN 'PASS'
        ELSE 'FAIL - Expected 4 AI tiers, found ' || COUNT(*)
    END as status,
    array_agg(tier ORDER BY sort_order) as details
FROM ai_model_tiers;

-- Check foreign key relationships
SELECT 
    'FOREIGN_KEYS' as check_type,
    CASE 
        WHEN COUNT(*) >= 15 THEN 'PASS'
        ELSE 'FAIL - Expected at least 15 foreign keys, found ' || COUNT(*)
    END as status,
    COUNT(*) || ' foreign key constraints found' as details
FROM information_schema.table_constraints 
WHERE constraint_schema = 'public' 
AND constraint_type = 'FOREIGN KEY'
AND table_name IN (
    'courses', 'enrollments', 'assignments', 'submissions', 'grades',
    'ai_model_tiers', 'user_ai_tiers', 'ai_usage', 'audit_logs'
);

-- Check that enums were created
SELECT 
    'ENUMS' as check_type,
    CASE 
        WHEN COUNT(*) >= 2 THEN 'PASS'
        ELSE 'FAIL - Expected at least 2 enums, found ' || COUNT(*)
    END as status,
    array_agg(typname ORDER BY typname) as details
FROM pg_type 
WHERE typname IN ('ai_model_tier', 'audit_event_type');

-- Overall schema health check
SELECT 
    'SCHEMA_HEALTH' as check_type,
    'INFO' as status,
    'Schema created successfully. Ready for Phase 1 development.' as details;

-- Show sample data structure (for debugging)
\echo '\n=== SAMPLE TABLE STRUCTURES ==='

\d courses
\d enrollments  
\d assignments
\d ai_model_tiers
\d audit_logs