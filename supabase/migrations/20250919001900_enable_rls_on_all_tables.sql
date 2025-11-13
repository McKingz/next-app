-- ============================================
-- Enable RLS on All Important Tables
-- ============================================
-- This migration ensures RLS is actually ENABLED on all critical tables
-- Date: 2025-09-19
-- ============================================

-- First, check current RLS status
SELECT
  'Current RLS Status Check' AS section,
  pt.tablename,
  CASE WHEN pc.relrowsecurity THEN 'RLS ENABLED ✅' ELSE 'RLS DISABLED ❌' END AS rls_status
FROM pg_tables AS pt
INNER JOIN pg_class AS pc ON pt.tablename = pc.relname
INNER JOIN pg_namespace AS pn ON pc.relnamespace = pn.oid
WHERE
  pt.schemaname = 'public'
  AND pn.nspname = 'public'
ORDER BY pt.tablename;

-- Enable RLS on all critical tables
DO $$
DECLARE
  table_name_var TEXT;
  tables_to_secure TEXT[] := ARRAY[
    'preschools', 'users', 'profiles', 'classes', 'subscriptions',
    'homework_assignments', 'lessons', 'lesson_activities', 'activity_attempts',
    'billing_plans', 'billing_invoices', 'payment_transactions',
    'subscription_usage', 'subscription_seats',
    'ai_generations', 'messages', 'conversations', 'announcements',
    'petty_cash_transactions', 'petty_cash_accounts', 'financial_transactions',
    'config_kv', 'assignments', 'assignment_submissions', 'assignment_grades',
    'resources', 'resource_reviews', 'resource_categories',
    'events', 'event_invitations', 'meeting_rooms', 'meeting_sessions',
    'push_devices', 'push_device_tokens', 'organizations', 'organization_members',
    'students', 'teachers', 'parents', 'notification_templates'
  ];
BEGIN
  -- Loop through each table and enable RLS if it exists
  FOREACH table_name_var IN ARRAY tables_to_secure
  LOOP
    -- Check if table exists
    IF EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = table_name_var
    ) THEN
      -- Enable RLS on the table
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name_var);
      RAISE NOTICE '✅ Enabled RLS on table: %', table_name_var;
    ELSE
      RAISE NOTICE '⚠️ Table % does not exist, skipping', table_name_var;
    END IF;
  END LOOP;
END $$;

-- Create essential RLS policies for tables that might be missing them
DO $$
BEGIN
  -- Users tenant isolation (should already exist)
  BEGIN
    DROP POLICY IF EXISTS "users_tenant_isolation" ON users;
    CREATE POLICY "users_tenant_isolation" ON users FOR ALL
    USING (organization_id = current_preschool_id() OR id = auth.uid());
    RAISE NOTICE 'Created/updated users tenant isolation policy';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Users policy skipped: %', SQLERRM;
  END;

  -- Preschools access policy
  BEGIN
    DROP POLICY IF EXISTS "preschools_tenant_isolation" ON preschools;
    CREATE POLICY "preschools_tenant_isolation" ON preschools FOR ALL
    USING (id = current_preschool_id());
    RAISE NOTICE 'Created/updated preschools tenant isolation policy';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Preschools policy skipped: %', SQLERRM;
  END;

  -- Classes tenant isolation
  BEGIN
    DROP POLICY IF EXISTS "classes_tenant_isolation" ON classes;
    CREATE POLICY "classes_tenant_isolation" ON classes FOR ALL
    USING (preschool_id = current_preschool_id());
    RAISE NOTICE 'Created/updated classes tenant isolation policy';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Classes policy skipped: %', SQLERRM;
  END;

  -- Lessons tenant isolation
  BEGIN
    DROP POLICY IF EXISTS "lessons_tenant_isolation" ON lessons;
    CREATE POLICY "lessons_tenant_isolation" ON lessons FOR ALL
    USING (preschool_id = current_preschool_id());
    RAISE NOTICE 'Created/updated lessons tenant isolation policy';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Lessons policy skipped: %', SQLERRM;
  END;

  -- Homework assignments tenant isolation
  BEGIN
    DROP POLICY IF EXISTS "homework_assignments_tenant_isolation" ON homework_assignments;
    CREATE POLICY "homework_assignments_tenant_isolation" ON homework_assignments FOR ALL
    USING (preschool_id = current_preschool_id());
    RAISE NOTICE 'Created/updated homework assignments tenant isolation policy';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Homework assignments policy skipped: %', SQLERRM;
  END;

  -- AI generations tenant isolation
  BEGIN
    DROP POLICY IF EXISTS "ai_generations_tenant_isolation" ON ai_generations;
    CREATE POLICY "ai_generations_tenant_isolation" ON ai_generations FOR ALL
    USING (preschool_id = current_preschool_id());
    RAISE NOTICE 'Created/updated AI generations tenant isolation policy';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'AI generations policy skipped: %', SQLERRM;
  END;

  -- Billing plans public read (already exists)
  BEGIN
    DROP POLICY IF EXISTS "billing_plans_public_read" ON billing_plans;
    CREATE POLICY "billing_plans_public_read" ON billing_plans FOR SELECT
    USING (active = true);
    RAISE NOTICE 'Created/updated billing plans public read policy';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Billing plans policy skipped: %', SQLERRM;
  END;

  -- Config KV policies
  BEGIN
    DROP POLICY IF EXISTS "config_kv_public_read" ON config_kv;
    CREATE POLICY "config_kv_public_read" ON config_kv FOR SELECT
    USING (is_public = true AND preschool_id IS NULL);
    RAISE NOTICE 'Created/updated config KV public read policy';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Config KV public policy skipped: %', SQLERRM;
  END;

  BEGIN
    DROP POLICY IF EXISTS "config_kv_tenant_isolation" ON config_kv;
    CREATE POLICY "config_kv_tenant_isolation" ON config_kv FOR ALL
    USING (
      preschool_id = current_preschool_id() OR 
      preschool_id IS NULL OR
      is_public = true
    );
    RAISE NOTICE 'Created/updated config KV tenant isolation policy';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Config KV tenant policy skipped: %', SQLERRM;
  END;

  -- Announcements tenant isolation
  BEGIN
    DROP POLICY IF EXISTS "announcements_tenant_isolation" ON announcements;
    CREATE POLICY "announcements_tenant_isolation" ON announcements FOR ALL
    USING (preschool_id = current_preschool_id());
    RAISE NOTICE 'Created/updated announcements tenant isolation policy';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Announcements policy skipped: %', SQLERRM;
  END;

  -- Petty cash transactions tenant isolation
  BEGIN
    DROP POLICY IF EXISTS "petty_cash_transactions_tenant_isolation" ON petty_cash_transactions;
    CREATE POLICY "petty_cash_transactions_tenant_isolation" ON petty_cash_transactions FOR ALL
    USING (preschool_id = current_preschool_id());
    RAISE NOTICE 'Created/updated petty cash transactions tenant isolation policy';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Petty cash transactions policy skipped: %', SQLERRM;
  END;

  -- Financial transactions tenant isolation
  BEGIN
    DROP POLICY IF EXISTS "financial_transactions_tenant_isolation" ON financial_transactions;
    CREATE POLICY "financial_transactions_tenant_isolation" ON financial_transactions FOR ALL
    USING (preschool_id = current_preschool_id());
    RAISE NOTICE 'Created/updated financial transactions tenant isolation policy';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Financial transactions policy skipped: %', SQLERRM;
  END;

  -- Organizations access
  BEGIN
    DROP POLICY IF EXISTS "organizations_member_access" ON organizations;
    CREATE POLICY "organizations_member_access" ON organizations FOR ALL
    USING (id = current_preschool_id());
    RAISE NOTICE 'Created/updated organizations member access policy';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Organizations policy skipped: %', SQLERRM;
  END;

END $$;

-- Final status check - show which tables now have RLS enabled
WITH pp AS (
  SELECT
    tablename,
    COUNT(*) AS policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
  GROUP BY tablename
)

SELECT
  'FINAL RLS STATUS' AS section,
  pt.tablename,
  CASE WHEN pc.relrowsecurity THEN '✅ ENABLED' ELSE '❌ DISABLED' END AS rls_status,
  COALESCE(pp.policy_count, 0) AS policy_count
FROM pg_tables AS pt
INNER JOIN pg_class AS pc ON pt.tablename = pc.relname
INNER JOIN pg_namespace AS pn ON pc.relnamespace = pn.oid
LEFT JOIN pp ON pt.tablename = pp.tablename
WHERE
  pt.schemaname = 'public'
  AND pn.nspname = 'public'
ORDER BY rls_status DESC, pt.tablename ASC;

-- Summary
WITH pp AS (
  SELECT
    tablename,
    COUNT(*) AS policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
  GROUP BY tablename
)

SELECT
  '🎯 RLS ENABLEMENT COMPLETE' AS status,
  COUNT(CASE WHEN pc.relrowsecurity THEN 1 END) AS tables_with_rls_enabled,
  COUNT(*) AS total_public_tables,
  COALESCE(SUM(pp.policy_count), 0) AS total_policies
FROM pg_tables AS pt
INNER JOIN pg_class AS pc ON pt.tablename = pc.relname
INNER JOIN pg_namespace AS pn ON pc.relnamespace = pn.oid
LEFT JOIN pp ON pt.tablename = pp.tablename
WHERE
  pt.schemaname = 'public'
  AND pn.nspname = 'public';
