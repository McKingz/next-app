-- Remote Database Table Inspection
-- Purpose: Check actual table structure before creating RLS policies

\echo '==========================================';
\echo 'INSPECTING REMOTE DATABASE STRUCTURE';
\echo '==========================================';

-- Check which critical tables actually exist
\echo '';
\echo '1. CHECKING IF CRITICAL TABLES EXIST';
\echo '==========================================';

SELECT 
    table_name,
    CASE 
        WHEN table_name IS NOT NULL THEN 'EXISTS ✓'
        ELSE 'MISSING ✗'
    END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'profiles', 'preschools', 'groups', 'organization_members', 
    'seats', 'student_groups', 'user_profiles', 'admin_users', 
    'superadmin_notification_rules', 'subscription_seats'
)
ORDER BY table_name;

-- Check columns in profiles table  
\echo '';
\echo '2. PROFILES TABLE STRUCTURE';
\echo '==========================================';

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'profiles'
ORDER BY ordinal_position;

-- Check columns in groups table
\echo '';
\echo '3. GROUPS TABLE STRUCTURE';  
\echo '==========================================';

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'groups'
ORDER BY ordinal_position;

-- Check columns in user_profiles table if it exists
\echo '';
\echo '4. USER_PROFILES TABLE STRUCTURE (if exists)';
\echo '==========================================';

SELECT 
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles')
         THEN 'TABLE EXISTS'
         ELSE 'TABLE DOES NOT EXIST'
    END as table_status;

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'user_profiles'
ORDER BY ordinal_position;

-- Check columns in admin_users table if it exists
\echo '';
\echo '5. ADMIN_USERS TABLE STRUCTURE (if exists)';
\echo '==========================================';

SELECT 
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admin_users')
         THEN 'TABLE EXISTS'
         ELSE 'TABLE DOES NOT EXIST'
    END as table_status;

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'admin_users'
ORDER BY ordinal_position;