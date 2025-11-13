-- POST-MIGRATION VERIFICATION SCRIPT
-- Run these commands in Supabase Dashboard after migration to verify success

-- ============================================================================
-- STEP 1: VERIFY ALL TABLES CREATED
-- ============================================================================

-- Check that all 14 new tables exist
SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'homework_assignments',
  'homework_submissions', 
  'lessons',
  'lesson_activities',
  'activity_attempts',
  'billing_plans',
  'subscription_invoices',
  'payfast_itn_logs',
  'seats',
  'org_invites',
  'parent_child_links',
  'ai_generations',
  'config_kv',
  'ad_impressions'
)
ORDER BY table_name;

-- Should return 14 rows

-- ============================================================================
-- STEP 2: VERIFY RLS POLICIES ACTIVE
-- ============================================================================

-- Check RLS is enabled on all new tables
SELECT 
  schemaname,
  tablename,
  rowsecurity,
  CASE WHEN rowsecurity THEN '✅ ENABLED' ELSE '❌ DISABLED' END as rls_status
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN (
  'homework_assignments',
  'homework_submissions', 
  'lessons',
  'lesson_activities',
  'activity_attempts',
  'billing_plans',
  'subscription_invoices',
  'payfast_itn_logs',
  'seats',
  'org_invites',
  'parent_child_links',
  'ai_generations',
  'config_kv',
  'ad_impressions'
)
ORDER BY tablename;

-- Should show 'ENABLED' for all tables

-- ============================================================================
-- STEP 3: VERIFY DEFAULT DATA INSERTED
-- ============================================================================

-- Check billing plans were created
SELECT 
  name,
  display_name,
  price_cents,
  ai_monthly_credits,
  max_teachers,
  max_parents,
  features,
  active
FROM billing_plans 
ORDER BY sort_order;

-- Should return 4 rows: free, parent_starter, teacher_pro, school_premium

-- ============================================================================
-- STEP 4: VERIFY INDEXES CREATED
-- ============================================================================

-- Check performance indexes exist
SELECT 
  schemaname,
  tablename,
  indexname
FROM pg_indexes 
WHERE schemaname = 'public' 
AND indexname LIKE 'idx_%'
AND tablename IN (
  'homework_assignments',
  'homework_submissions', 
  'lessons',
  'lesson_activities',
  'activity_attempts',
  'subscription_invoices',
  'payfast_itn_logs',
  'ai_generations',
  'parent_child_links'
)
ORDER BY tablename, indexname;

-- Should return multiple index rows

-- ============================================================================
-- STEP 5: VERIFY TRIGGERS CREATED
-- ============================================================================

-- Check updated_at triggers exist
SELECT 
  trigger_name,
  event_object_table,
  action_timing,
  event_manipulation
FROM information_schema.triggers 
WHERE trigger_schema = 'public'
AND trigger_name LIKE 'update_%_updated_at'
ORDER BY event_object_table;

-- Should return multiple trigger rows

-- ============================================================================
-- STEP 6: VERIFY CURRENT_PRESCHOOL_ID FUNCTION
-- ============================================================================

-- Test the RLS helper function exists and works
SELECT current_preschool_id();

-- May return NULL (expected if no JWT token in dashboard context)

-- ============================================================================
-- STEP 7: CHECK MIGRATION LOG
-- ============================================================================

-- Verify migration completion was logged
SELECT 
  key,
  value,
  description,
  created_at
FROM config_kv 
WHERE key = 'migration_20250917_core_business_tables';

-- Should return 1 row with completion timestamp

-- ============================================================================
-- STEP 8: BASIC FUNCTIONALITY TEST
-- ============================================================================

-- Test basic insert/select (will fail due to RLS, but should not error on table structure)
-- This is just to verify table structure is correct

-- Test homework_assignments structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'homework_assignments' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Test lessons structure  
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'lessons' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Test billing_plans structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'billing_plans' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- ============================================================================
-- SUCCESS CRITERIA CHECKLIST
-- ============================================================================

/*
✅ MIGRATION SUCCESS CRITERIA:

1. All 14 tables created successfully
2. RLS enabled on all new tables  
3. All performance indexes created
4. All triggers for updated_at created
5. Default billing plans inserted (4 rows)
6. current_preschool_id() function exists
7. Migration logged in config_kv
8. No errors in table structure validation

If ALL above criteria pass, migration is successful ✅
If ANY criteria fail, investigate and fix before proceeding ❌

Next step: Reset local migrations and sync with remote state
*/