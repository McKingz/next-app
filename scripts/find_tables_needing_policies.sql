-- Find Tables Needing RLS Policies
-- Purpose: Identify all tables with RLS enabled but no policies

\echo '==========================================';
\echo 'TABLES WITH RLS BUT NO POLICIES';
\echo '==========================================';

-- Get all tables with RLS enabled but no policies
WITH rls_tables AS (
    SELECT 
        schemaname,
        tablename,
        rowsecurity as rls_enabled
    FROM pg_tables pt
    WHERE pt.schemaname = 'public'
    AND pt.rowsecurity = true
),
tables_with_policies AS (
    SELECT DISTINCT
        schemaname,
        tablename
    FROM pg_policies
    WHERE schemaname = 'public'
)
SELECT 
    rt.tablename,
    rt.rls_enabled,
    CASE 
        WHEN twp.tablename IS NULL THEN 'NEEDS POLICIES ⚠️'
        ELSE 'HAS POLICIES ✓'
    END as policy_status,
    -- Try to identify tenant/organization columns
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_schema = 'public' 
                     AND table_name = rt.tablename 
                     AND column_name = 'organization_id') THEN 'organization_id'
        WHEN EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_schema = 'public' 
                     AND table_name = rt.tablename 
                     AND column_name = 'preschool_id') THEN 'preschool_id'
        WHEN EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_schema = 'public' 
                     AND table_name = rt.tablename 
                     AND column_name = 'school_id') THEN 'school_id'
        ELSE 'NO_TENANT_COLUMN'
    END as tenant_column,
    -- Check for user relationship columns
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_schema = 'public' 
                     AND table_name = rt.tablename 
                     AND column_name = 'user_id') THEN 'user_id'
        WHEN EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_schema = 'public' 
                     AND table_name = rt.tablename 
                     AND column_name = 'student_id') THEN 'student_id'
        WHEN EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_schema = 'public' 
                     AND table_name = rt.tablename 
                     AND column_name = 'teacher_id') THEN 'teacher_id'
        WHEN EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_schema = 'public' 
                     AND table_name = rt.tablename 
                     AND column_name = 'parent_id') THEN 'parent_id'
        ELSE 'NO_USER_COLUMN'
    END as user_column
FROM rls_tables rt
LEFT JOIN tables_with_policies twp ON rt.tablename = twp.tablename
WHERE twp.tablename IS NULL  -- Only tables without policies
ORDER BY rt.tablename;

\echo '';
\echo 'SUMMARY OF TABLES NEEDING POLICIES';
\echo '==========================================';

-- Summary by tenant column type
WITH rls_tables AS (
    SELECT 
        schemaname,
        tablename,
        rowsecurity as rls_enabled
    FROM pg_tables pt
    WHERE pt.schemaname = 'public'
    AND pt.rowsecurity = true
),
tables_with_policies AS (
    SELECT DISTINCT
        schemaname,
        tablename
    FROM pg_policies
    WHERE schemaname = 'public'
),
tables_needing_policies AS (
    SELECT 
        rt.tablename,
        CASE 
            WHEN EXISTS (SELECT 1 FROM information_schema.columns 
                         WHERE table_schema = 'public' 
                         AND table_name = rt.tablename 
                         AND column_name = 'organization_id') THEN 'organization_id'
            WHEN EXISTS (SELECT 1 FROM information_schema.columns 
                         WHERE table_schema = 'public' 
                         AND table_name = rt.tablename 
                         AND column_name = 'preschool_id') THEN 'preschool_id'
            WHEN EXISTS (SELECT 1 FROM information_schema.columns 
                         WHERE table_schema = 'public' 
                         AND table_name = rt.tablename 
                         AND column_name = 'school_id') THEN 'school_id'
            ELSE 'NO_TENANT_COLUMN'
        END as tenant_column
    FROM rls_tables rt
    LEFT JOIN tables_with_policies twp ON rt.tablename = twp.tablename
    WHERE twp.tablename IS NULL
)
SELECT 
    tenant_column,
    COUNT(*) as table_count,
    CASE 
        WHEN tenant_column = 'NO_TENANT_COLUMN' THEN 'COMPLEX - Needs Analysis'
        ELSE 'CAN_CREATE_STANDARD_POLICIES'
    END as recommendation
FROM tables_needing_policies
GROUP BY tenant_column
ORDER BY table_count DESC;