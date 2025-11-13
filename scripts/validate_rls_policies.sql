-- RLS Policy Validation Test Script
-- Purpose: Validate that RLS policies are working correctly after migration
-- Date: 2025-09-21

\echo '==========================================';
\echo 'RLS POLICY VALIDATION TEST';
\echo '==========================================';

-- Check if RLS is enabled on critical tables
\echo '';
\echo '1. CHECKING RLS STATUS ON CRITICAL TABLES';
\echo '==========================================';

SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    CASE 
        WHEN rowsecurity THEN 'RLS ENABLED ✓'
        ELSE 'RLS DISABLED ✗'
    END as status
FROM pg_tables pt
JOIN pg_class pc ON pc.relname = pt.tablename
WHERE schemaname = 'public'
AND tablename IN (
    'profiles', 'preschools', 'groups', 'organization_members', 
    'seats', 'student_groups', 'user_profiles', 'admin_users', 
    'superadmin_notification_rules'
)
ORDER BY tablename;

-- Check policies exist for critical tables
\echo '';
\echo '2. CHECKING POLICIES ON CRITICAL TABLES';
\echo '==========================================';

SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    CASE 
        WHEN policyname IS NOT NULL THEN 'POLICY EXISTS ✓'
        ELSE 'NO POLICY ✗'
    END as status
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN (
    'profiles', 'preschools', 'groups', 'organization_members', 
    'seats', 'student_groups', 'user_profiles', 'admin_users', 
    'superadmin_notification_rules', 'student_parent_relationships',
    'notifications', 'messages', 'events'
)
ORDER BY tablename, policyname;

-- Count policies per table
\echo '';
\echo '3. POLICY COUNT BY TABLE';
\echo '==========================================';

SELECT 
    tablename,
    COUNT(policyname) as policy_count,
    CASE 
        WHEN COUNT(policyname) > 0 THEN 'HAS POLICIES ✓'
        ELSE 'NO POLICIES ✗'
    END as status
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN (
    'profiles', 'preschools', 'groups', 'organization_members', 
    'seats', 'student_groups', 'user_profiles', 'admin_users', 
    'superadmin_notification_rules', 'student_parent_relationships',
    'notifications', 'messages', 'events'
)
GROUP BY tablename
ORDER BY tablename;

-- Check for tables with RLS enabled but no policies (potential security risk)
\echo '';
\echo '4. TABLES WITH RLS BUT NO POLICIES (SECURITY RISK)';
\echo '==========================================';

SELECT DISTINCT
    pt.tablename,
    pc.rowsecurity as rls_enabled,
    COALESCE(pp.policy_count, 0) as policy_count,
    CASE 
        WHEN pc.rowsecurity AND COALESCE(pp.policy_count, 0) = 0 THEN 'SECURITY RISK ⚠️'
        WHEN pc.rowsecurity AND COALESCE(pp.policy_count, 0) > 0 THEN 'SECURED ✓'
        WHEN NOT pc.rowsecurity THEN 'NO RLS ✗'
    END as security_status
FROM pg_tables pt
JOIN pg_class pc ON pc.relname = pt.tablename
LEFT JOIN (
    SELECT tablename, COUNT(*) as policy_count
    FROM pg_policies 
    WHERE schemaname = 'public'
    GROUP BY tablename
) pp ON pp.tablename = pt.tablename
WHERE pt.schemaname = 'public'
AND pc.rowsecurity = true
ORDER BY policy_count, pt.tablename;

-- Summary statistics
\echo '';
\echo '5. SECURITY SUMMARY STATISTICS';
\echo '==========================================';

WITH security_stats AS (
    SELECT 
        COUNT(*) as total_tables,
        SUM(CASE WHEN pc.rowsecurity THEN 1 ELSE 0 END) as tables_with_rls,
        SUM(CASE WHEN pc.rowsecurity AND COALESCE(pp.policy_count, 0) = 0 THEN 1 ELSE 0 END) as rls_no_policies,
        SUM(CASE WHEN pc.rowsecurity AND COALESCE(pp.policy_count, 0) > 0 THEN 1 ELSE 0 END) as rls_with_policies,
        SUM(CASE WHEN NOT pc.rowsecurity THEN 1 ELSE 0 END) as no_rls
    FROM pg_tables pt
    JOIN pg_class pc ON pc.relname = pt.tablename
    LEFT JOIN (
        SELECT tablename, COUNT(*) as policy_count
        FROM pg_policies 
        WHERE schemaname = 'public'
        GROUP BY tablename
    ) pp ON pp.tablename = pt.tablename
    WHERE pt.schemaname = 'public'
)
SELECT 
    total_tables,
    tables_with_rls,
    rls_with_policies as "secured_tables",
    rls_no_policies as "at_risk_tables",
    no_rls as "unprotected_tables",
    ROUND((rls_with_policies::float / total_tables::float) * 100, 1) as "percent_secured"
FROM security_stats;

-- Check permissions on critical tables
\echo '';
\echo '6. TABLE PERMISSIONS FOR authenticated ROLE';
\echo '==========================================';

SELECT 
    table_name,
    privilege_type,
    grantee
FROM information_schema.table_privileges
WHERE table_schema = 'public'
AND grantee IN ('authenticated', 'anon', 'service_role')
AND table_name IN (
    'profiles', 'preschools', 'groups', 'organization_members', 
    'seats', 'student_groups', 'user_profiles', 'admin_users'
)
ORDER BY table_name, grantee, privilege_type;

\echo '';
\echo '==========================================';
\echo 'RLS VALIDATION TEST COMPLETE';
\echo '==========================================';