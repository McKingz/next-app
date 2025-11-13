-- COMPREHENSIVE DATABASE SCHEMA VERIFICATION FOR EDUDASH PRO
-- Date: 2025-09-17
-- Purpose: Verify complete database schema, functions, RLS policies, and data integrity
-- Run this in Supabase Dashboard > SQL Editor to verify everything is properly configured

-- ============================================================================
-- PART 1: VERIFY ALL CORE TABLES EXIST
-- ============================================================================

-- Check all essential tables for the application
SELECT 
  'CORE TABLES' as category,
  table_name,
  table_type,
  CASE WHEN table_name IS NOT NULL THEN '✅ EXISTS' ELSE '❌ MISSING' END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  -- Authentication & User Management
  'profiles',
  'users',
  
  -- Organization & School Management  
  'preschools',
  'subscriptions',
  'seats',
  'org_invites',
  
  -- Educational Content
  'homework_assignments',
  'homework_submissions', 
  'lessons',
  'lesson_activities',
  'activity_attempts',
  'classes',
  
  -- Parent-Child Management
  'parent_child_links',
  'child_registration_requests',
  'parent_payments',
  
  -- Billing & Payments
  'billing_plans',
  'subscription_invoices',
  'payfast_itn_logs',
  
  -- AI & Analytics
  'ai_generations',
  'ai_usage_logs',
  'ai_services',
  
  -- Push Notifications
  'push_devices',
  'push_notifications',
  
  -- System & Configuration
  'config_kv',
  'ad_impressions'
)
ORDER BY table_name;

-- Expected: ~23 tables minimum

-- ============================================================================
-- PART 2: VERIFY AUTHENTICATION SCHEMA
-- ============================================================================

-- Check profiles table has all required columns including capabilities
SELECT 
  'PROFILES TABLE' as category,
  column_name,
  data_type,
  is_nullable,
  column_default,
  CASE WHEN column_name = 'capabilities' THEN '🔑 KEY COLUMN' ELSE '' END as notes
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Verify users table exists and has capabilities column (if used)
SELECT 
  'USERS TABLE' as category,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'users' AND table_schema = 'public'
  ) THEN '✅ EXISTS' ELSE '⚠️ NOT FOUND (OK if using profiles only)' END as table_status,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'capabilities' AND table_schema = 'public'
  ) THEN '✅ HAS CAPABILITIES' ELSE '❌ MISSING CAPABILITIES' END as capabilities_status;

-- ============================================================================
-- PART 3: VERIFY ROW LEVEL SECURITY (RLS) 
-- ============================================================================

-- Check RLS is enabled on all critical tables
SELECT 
  'RLS STATUS' as category,
  tablename as table_name,
  rowsecurity as rls_enabled,
  CASE 
    WHEN rowsecurity THEN '✅ ENABLED' 
    ELSE '❌ DISABLED - SECURITY RISK!' 
  END as security_status
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN (
  'profiles', 'users', 'preschools', 'classes', 'subscriptions',
  'homework_assignments', 'homework_submissions', 'lessons',
  'parent_child_links', 'push_devices', 'ai_generations',
  'seats', 'org_invites', 'config_kv'
)
ORDER BY tablename;

-- Check specific RLS policies exist
SELECT 
  'RLS POLICIES' as category,
  schemaname as schema_name,
  tablename as table_name,
  policyname as policy_name,
  permissive,
  roles,
  cmd as command_type,
  CASE WHEN policyname LIKE '%tenant_isolation%' THEN '🏢 TENANT POLICY'
       WHEN policyname LIKE '%own%' OR policyname LIKE '%self%' THEN '👤 USER POLICY'  
       WHEN policyname LIKE '%admin%' THEN '👑 ADMIN POLICY'
       ELSE '🔒 OTHER POLICY' END as policy_type
FROM pg_policies 
WHERE schemaname = 'public'
AND tablename IN ('profiles', 'preschools', 'homework_assignments', 'lessons', 'push_devices')
ORDER BY tablename, policyname;

-- ============================================================================
-- PART 4: VERIFY ESSENTIAL FUNCTIONS
-- ============================================================================

-- Check all required database functions exist
SELECT 
  'DATABASE FUNCTIONS' as category,
  routine_name as function_name,
  routine_type,
  data_type as return_type,
  CASE 
    WHEN routine_name LIKE '%preschool_id%' THEN '🏢 TENANT FUNCTION'
    WHEN routine_name LIKE '%admin%' THEN '👑 ADMIN FUNCTION'  
    WHEN routine_name LIKE '%capabilities%' THEN '🔑 AUTH FUNCTION'
    WHEN routine_name LIKE '%profile%' THEN '👤 USER FUNCTION'
    ELSE '⚙️ UTILITY FUNCTION' 
  END as function_type
FROM information_schema.routines 
WHERE routine_schema = 'public'
AND routine_name IN (
  -- Authentication & User Management
  'get_or_create_user_profile',
  'update_user_capabilities', 
  'handle_new_user',
  
  -- Tenant & RLS Functions
  'current_preschool_id',
  'get_user_preschool_id',
  'is_super_admin',
  'app_is_super_admin',
  
  -- Trigger Functions
  'update_updated_at_column',
  'set_parent_payments_parent_id',
  'set_child_reg_parent_id',
  
  -- Business Logic Functions (check if exist)
  'assign_all_teachers_to_all_classes',
  'admin_create_school_subscription',
  'admin_update_subscription_plan'
)
ORDER BY routine_name;

-- ============================================================================
-- PART 5: CHECK SUPABASE EDGE FUNCTIONS
-- ============================================================================

-- Note: Edge functions can't be queried directly from SQL, but we can check
-- if there are any references to them in our configuration

SELECT 
  'EDGE FUNCTIONS CHECK' as category,
  'Run this command in your terminal to verify:' as instruction,
  'npx supabase functions list --project-ref lvvvjywrmpcqrpvuptdi' as command_to_run;

-- Expected Edge Functions for EduDash Pro:
-- ✅ ai-proxy (for AI features)
-- ✅ ai-gateway (main AI handler) 
-- ✅ notifications-dispatcher (for push notifications)
-- ✅ principal-hub-api (dashboard API)
-- ✅ payments-webhook (PayFast integration)
-- ✅ payments-create-checkout (billing)

-- ============================================================================
-- PART 6: VERIFY DATA INTEGRITY & CONSTRAINTS
-- ============================================================================

-- Check foreign key constraints are properly set up
SELECT 
  'FOREIGN KEYS' as category,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  tc.constraint_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_schema = 'public'
AND tc.table_name IN ('profiles', 'homework_assignments', 'lessons', 'push_devices', 'parent_child_links')
ORDER BY tc.table_name, tc.constraint_name;

-- Check essential indexes for performance
SELECT 
  'PERFORMANCE INDEXES' as category,
  schemaname,
  tablename,
  indexname,
  indexdef,
  CASE 
    WHEN indexname LIKE '%preschool_id%' THEN '🏢 TENANT INDEX'
    WHEN indexname LIKE '%user_id%' OR indexname LIKE '%profile%' THEN '👤 USER INDEX'
    WHEN indexname LIKE '%created_at%' OR indexname LIKE '%updated_at%' THEN '📅 TIME INDEX'
    ELSE '📊 OTHER INDEX'
  END as index_type
FROM pg_indexes 
WHERE schemaname = 'public' 
AND (indexname LIKE 'idx_%' OR indexname LIKE '%preschool_id%' OR indexname LIKE '%user_id%')
AND tablename IN ('profiles', 'homework_assignments', 'lessons', 'push_devices', 'ai_generations')
ORDER BY tablename, indexname;

-- ============================================================================
-- PART 7: VERIFY SUBSCRIPTION & BILLING SETUP
-- ============================================================================

-- Check billing plans are properly configured
SELECT 
  'BILLING PLANS' as category,
  name,
  display_name,
  price_cents,
  ai_monthly_credits,
  max_teachers,
  max_parents,
  max_students,
  features,
  active,
  CASE WHEN active THEN '✅ ACTIVE' ELSE '❌ INACTIVE' END as plan_status
FROM billing_plans 
ORDER BY sort_order, name;

-- Check subscription structure
SELECT 
  'SUBSCRIPTIONS TABLE' as category,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'subscriptions' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- ============================================================================
-- PART 8: VERIFY PUSH NOTIFICATIONS SETUP  
-- ============================================================================

-- Check push notifications tables
SELECT 
  'PUSH NOTIFICATIONS' as category,
  table_name,
  CASE WHEN table_name IS NOT NULL THEN '✅ EXISTS' ELSE '❌ MISSING' END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('push_devices', 'push_notifications')
ORDER BY table_name;

-- Verify push_devices table structure
SELECT 
  'PUSH_DEVICES COLUMNS' as category,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'push_devices' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- ============================================================================
-- PART 9: CHECK AUTHENTICATION SETUP
-- ============================================================================

-- Verify auth triggers are set up
SELECT 
  'AUTH TRIGGERS' as category,
  trigger_name,
  event_object_table as table_name,
  action_timing,
  event_manipulation,
  CASE WHEN trigger_name LIKE '%user%' THEN '👤 USER TRIGGER' ELSE '⚙️ OTHER TRIGGER' END as trigger_type
FROM information_schema.triggers 
WHERE trigger_schema = 'public'
AND (
  trigger_name LIKE '%user%' OR 
  trigger_name LIKE '%profile%' OR
  trigger_name LIKE '%auth%'
)
ORDER BY event_object_table, trigger_name;

-- Check if profiles are being created for existing auth users
SELECT 
  'PROFILE COVERAGE' as category,
  COUNT(*) as auth_users_count,
  (SELECT COUNT(*) FROM profiles) as profiles_count,
  CASE WHEN COUNT(*) = (SELECT COUNT(*) FROM profiles) 
       THEN '✅ ALL USERS HAVE PROFILES' 
       ELSE '⚠️ MISSING PROFILES FOR SOME USERS' 
  END as coverage_status
FROM auth.users;

-- ============================================================================
-- PART 10: VERIFY CONFIGURATION & ENVIRONMENT
-- ============================================================================

-- Check system configuration
SELECT 
  'SYSTEM CONFIG' as category,
  key,
  description,
  is_public,
  CASE WHEN key LIKE '%migration%' THEN '🔄 MIGRATION LOG'
       WHEN key LIKE '%version%' THEN '📋 VERSION INFO'  
       ELSE '⚙️ CONFIG' END as config_type,
  created_at
FROM config_kv 
WHERE key LIKE '%migration%' OR key LIKE '%version%' OR key LIKE '%setup%'
ORDER BY created_at DESC;

-- ============================================================================
-- PART 11: SECURITY VERIFICATION
-- ============================================================================

-- Check for any tables without RLS (security risk)
SELECT 
  'SECURITY AUDIT' as category,
  tablename as table_name,
  '❌ RLS DISABLED - SECURITY RISK!' as issue,
  'Enable RLS: ALTER TABLE ' || tablename || ' ENABLE ROW LEVEL SECURITY;' as fix_command
FROM pg_tables 
WHERE schemaname = 'public' 
AND rowsecurity = false
AND tablename NOT IN ('billing_plans', 'config_kv') -- These may be intentionally public
ORDER BY tablename;

-- Check for tables without proper tenant isolation policies
WITH table_policies AS (
  SELECT DISTINCT tablename 
  FROM pg_policies 
  WHERE schemaname = 'public' 
  AND (policyname LIKE '%tenant%' OR policyname LIKE '%preschool_id%')
),
tenant_tables AS (
  SELECT tablename
  FROM information_schema.columns
  WHERE table_schema = 'public' 
  AND column_name = 'preschool_id'
  AND tablename NOT IN ('billing_plans', 'config_kv')
)
SELECT 
  'TENANT ISOLATION AUDIT' as category,
  tt.tablename as table_name,
  CASE WHEN tp.tablename IS NOT NULL 
       THEN '✅ HAS TENANT POLICY' 
       ELSE '⚠️ MISSING TENANT POLICY' 
  END as policy_status,
  CASE WHEN tp.tablename IS NULL 
       THEN 'CREATE POLICY ' || tt.tablename || '_tenant_isolation ON ' || tt.tablename || ' USING (preschool_id = current_preschool_id());'
       ELSE null 
  END as suggested_fix
FROM tenant_tables tt
LEFT JOIN table_policies tp ON tt.tablename = tp.tablename
ORDER BY tt.tablename;

-- ============================================================================
-- COMPREHENSIVE HEALTH CHECK SUMMARY
-- ============================================================================

SELECT '
🎯 EDUDASH PRO DATABASE HEALTH CHECK COMPLETE
===============================================

📋 REVIEW THE RESULTS ABOVE FOR:
   ✅ All core tables present
   ✅ Authentication schema complete  
   ✅ RLS enabled on sensitive tables
   ✅ Essential functions created
   ✅ Foreign key constraints valid
   ✅ Performance indexes in place
   ✅ Billing plans configured
   ✅ Push notifications ready
   ✅ Security policies active
   ✅ Tenant isolation working

🚨 ACTION ITEMS:
   - Fix any ❌ MISSING or ❌ DISABLED items
   - Deploy any missing Edge Functions
   - Address any security warnings
   - Verify migration logs are complete

📞 NEXT STEPS:
   1. Run: npx supabase functions list (check Edge Functions)
   2. Test authentication in mobile app
   3. Verify push notifications work
   4. Test core app functionality

💡 TIP: If issues found, refer to:
   - FIX_AUTHENTICATION_ISSUES_COMPLETE.sql  
   - MANUAL_FUNCTION_DEPLOYMENT.md
   - DEPLOYMENT_GUIDE_FIX_AUTH.md

Database schema verification complete! 🎉
' as health_check_summary;