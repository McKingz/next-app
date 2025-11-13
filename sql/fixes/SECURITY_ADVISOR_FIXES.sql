-- SECURITY ADVISOR FIXES MIGRATION
-- Date: 2025-09-17
-- Purpose: Fix all 6 security issues identified in Supabase Security Advisor
-- WARP.md Compliance: Production-safe, RLS-first security fixes
-- Reference: https://supabase.com/docs/guides/database/database-advisors

-- ============================================================================
-- PART 1: ENABLE RLS ON TABLES WITH EXISTING POLICIES
-- ============================================================================

-- Fix: Policy Exists RLS Disabled + RLS Disabled in Public on assignments table
DO $security_fix$
BEGIN
  -- Enable RLS on assignments table
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'assignments' AND table_schema = 'public') THEN
    ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'Enabled RLS on public.assignments table';
  ELSE
    RAISE NOTICE 'Table public.assignments does not exist';
  END IF;
END
$security_fix$;

-- Enable RLS on all core tables (idempotent)
DO $security_fix$
DECLARE
  table_record record;
  core_tables text[] := ARRAY[
    'preschools', 'users', 'classes', 'subscriptions', 'subscription_plans',
    'homework_assignments', 'homework_submissions', 'lessons', 'lesson_activities', 
    'activity_attempts', 'subscription_invoices', 'payfast_itn_logs', 
    'seats', 'org_invites', 'parent_child_links', 'ai_generations', 
    'config_kv', 'ad_impressions', 'plan_quotas', 'subscription_usage',
    'audit_logs', 'ai_usage_logs', 'assignments'
  ];
BEGIN
  FOREACH table_record.table_name IN ARRAY core_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables 
               WHERE table_name = table_record.table_name AND table_schema = 'public') THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_record.table_name);
      RAISE NOTICE 'Enabled RLS on public.%', table_record.table_name;
    END IF;
  END LOOP;
END
$security_fix$;

-- ============================================================================
-- PART 2: FIX SECURITY DEFINER VIEWS
-- ============================================================================

-- Helper function for current preschool_id (ensure it exists and is secure)
CREATE OR REPLACE FUNCTION public.current_preschool_id()
RETURNS uuid 
LANGUAGE plpgsql
SECURITY DEFINER -- This is intentional for helper function
SET search_path = public
AS $$
BEGIN
  -- Try preschool_id first, then organization_id for compatibility
  RETURN COALESCE(
    (auth.jwt() ->> 'preschool_id')::uuid,
    (auth.jwt() ->> 'organization_id')::uuid
  );
END;
$$;

-- Fix Security Definer Views by recreating them as SECURITY INVOKER
DO $security_fix$
BEGIN
  -- Drop and recreate teacher_stats view
  DROP VIEW IF EXISTS public.teacher_stats CASCADE;
  
  CREATE OR REPLACE VIEW public.teacher_stats 
  WITH (security_invoker = true) AS
  SELECT 
    u.id,
    u.email,
    u.first_name,
    u.last_name,
    u.organization_id as preschool_id,
    count(c.id) as class_count,
    count(DISTINCT ha.id) as homework_count,
    count(DISTINCT l.id) as lesson_count
  FROM users u
  LEFT JOIN classes c ON c.teacher_id = u.id
  LEFT JOIN homework_assignments ha ON ha.teacher_id = u.id
  LEFT JOIN lessons l ON l.teacher_id = u.id
  WHERE u.role = 'teacher'
    AND u.organization_id = current_preschool_id()
  GROUP BY u.id, u.email, u.first_name, u.last_name, u.organization_id;

  RAISE NOTICE 'Fixed teacher_stats view with security_invoker';
END
$security_fix$;

DO $security_fix$
BEGIN
  -- Drop and recreate users_with_subscription view
  DROP VIEW IF EXISTS public.users_with_subscription CASCADE;
  
  CREATE OR REPLACE VIEW public.users_with_subscription 
  WITH (security_invoker = true) AS
  SELECT 
    u.*,
    p.name as preschool_name,
    p.subscription_plan,
    s.status as subscription_status
  FROM users u
  JOIN preschools p ON u.organization_id = p.id
  LEFT JOIN subscriptions s ON s.preschool_id = p.id AND s.status = 'active'
  WHERE u.organization_id = current_preschool_id();

  RAISE NOTICE 'Fixed users_with_subscription view with security_invoker';
END
$security_fix$;

DO $security_fix$
BEGIN
  -- Drop and recreate activity_logs_view
  DROP VIEW IF EXISTS public.activity_logs_view CASCADE;
  
  CREATE OR REPLACE VIEW public.activity_logs_view 
  WITH (security_invoker = true) AS
  SELECT 
    al.*,
    u.email as user_email,
    u.first_name || ' ' || u.last_name as user_name
  FROM audit_logs al
  LEFT JOIN users u ON al.user_id = u.id
  WHERE al.preschool_id = current_preschool_id()
  ORDER BY al.created_at DESC;

  RAISE NOTICE 'Fixed activity_logs_view with security_invoker';
END
$security_fix$;

DO $security_fix$
BEGIN
  -- Drop and recreate classes_with_teachers view
  DROP VIEW IF EXISTS public.classes_with_teachers CASCADE;
  
  CREATE OR REPLACE VIEW public.classes_with_teachers 
  WITH (security_invoker = true) AS
  SELECT 
    c.*,
    u.first_name || ' ' || u.last_name as teacher_name,
    u.email as teacher_email
  FROM classes c
  LEFT JOIN users u ON c.teacher_id = u.id
  WHERE c.preschool_id = current_preschool_id();

  RAISE NOTICE 'Fixed classes_with_teachers view with security_invoker';
END
$security_fix$;

-- ============================================================================
-- PART 3: ENSURE PROPER RLS POLICIES EXIST
-- ============================================================================

-- Create tenant isolation policies for assignments table if missing
DO $security_fix$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'assignments' AND table_schema = 'public') THEN
    -- Drop existing policy if it exists
    DROP POLICY IF EXISTS assignments_tenant_isolation ON public.assignments;
    
    -- Create proper RLS policy
    CREATE POLICY assignments_tenant_isolation 
      ON public.assignments 
      USING (preschool_id = current_preschool_id());
    
    RAISE NOTICE 'Created RLS policy for assignments table';
  END IF;
END
$security_fix$;

-- Ensure all core tables have proper tenant isolation policies
DO $security_fix$
DECLARE
  table_name text;
  policy_name text;
  table_list text[] := ARRAY[
    'homework_assignments', 'homework_submissions', 'lessons', 'lesson_activities',
    'activity_attempts', 'subscription_invoices', 'seats', 'org_invites',
    'parent_child_links', 'ai_generations', 'ad_impressions', 'assignments'
  ];
BEGIN
  FOREACH table_name IN ARRAY table_list LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables 
               WHERE table_name = table_name AND table_schema = 'public') THEN
      
      policy_name := table_name || '_tenant_isolation';
      
      -- Drop existing policy
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_name, table_name);
      
      -- Create tenant isolation policy
      EXECUTE format(
        'CREATE POLICY %I ON public.%I USING (preschool_id = current_preschool_id())',
        policy_name, table_name
      );
      
      RAISE NOTICE 'Created RLS policy for %', table_name;
    END IF;
  END LOOP;
END
$security_fix$;

-- Special policies for specific tables
DO $security_fix$
BEGIN
  -- Subscription plans should be publicly readable (active plans only)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'subscription_plans') THEN
    DROP POLICY IF EXISTS subscription_plans_public_read ON public.subscription_plans;
    CREATE POLICY subscription_plans_public_read 
      ON public.subscription_plans FOR SELECT 
      USING (is_active = true);
    RAISE NOTICE 'Created public read policy for subscription_plans';
  END IF;

  -- Config KV policies
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'config_kv') THEN
    DROP POLICY IF EXISTS config_kv_public_read ON public.config_kv;
    CREATE POLICY config_kv_public_read 
      ON public.config_kv FOR SELECT 
      USING (is_public = true AND preschool_id IS NULL);

    DROP POLICY IF EXISTS config_kv_tenant_isolation ON public.config_kv;
    CREATE POLICY config_kv_tenant_isolation 
      ON public.config_kv 
      USING (preschool_id = current_preschool_id() OR preschool_id IS NULL);
    
    RAISE NOTICE 'Created config_kv policies';
  END IF;

  -- PayFast ITN logs - superadmin only
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payfast_itn_logs') THEN
    DROP POLICY IF EXISTS payfast_itn_logs_superadmin_only ON public.payfast_itn_logs;
    CREATE POLICY payfast_itn_logs_superadmin_only 
      ON public.payfast_itn_logs 
      USING (auth.jwt() ->> 'role' = 'superadmin');
    RAISE NOTICE 'Created superadmin-only policy for payfast_itn_logs';
  END IF;
END
$security_fix$;

-- ============================================================================
-- PART 4: GRANT PROPER PERMISSIONS
-- ============================================================================

-- Ensure authenticated users have appropriate permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Revoke permissions on sensitive tables and grant to service role only
DO $security_fix$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payfast_itn_logs') THEN
    REVOKE ALL ON public.payfast_itn_logs FROM authenticated;
    GRANT SELECT, INSERT, UPDATE ON public.payfast_itn_logs TO service_role;
  END IF;

  -- Config table - authenticated can only SELECT
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'config_kv') THEN
    REVOKE INSERT, UPDATE, DELETE ON public.config_kv FROM authenticated;
    GRANT SELECT ON public.config_kv TO authenticated;
    GRANT ALL ON public.config_kv TO service_role;
  END IF;
END
$security_fix$;

-- ============================================================================
-- PART 5: VERIFY SECURITY STATUS
-- ============================================================================

-- Function to check RLS status
CREATE OR REPLACE FUNCTION public.verify_rls_status()
RETURNS TABLE(table_name text, rls_enabled boolean, policy_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.tablename::text,
    t.rowsecurity as rls_enabled,
    COALESCE(p.policy_count, 0) as policy_count
  FROM pg_tables t
  LEFT JOIN (
    SELECT 
      schemaname || '.' || tablename as full_name,
      count(*) as policy_count
    FROM pg_policies 
    GROUP BY schemaname, tablename
  ) p ON t.schemaname || '.' || t.tablename = p.full_name
  WHERE t.schemaname = 'public'
    AND t.tablename NOT LIKE 'pg_%'
  ORDER BY t.tablename;
END;
$$;

-- Log completion
INSERT INTO public.config_kv (key, value, description, is_public)
VALUES (
  'security_advisor_fixes_20250917',
  json_build_object(
    'version', '1.0.0',
    'completed_at', now()::text,
    'fixes_applied', array[
      'enabled_rls_on_assignments',
      'fixed_security_definer_views', 
      'created_tenant_isolation_policies',
      'secured_sensitive_tables'
    ]
  ),
  'Security Advisor fixes completion log',
  false
) ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  updated_at = now();

-- Final status check
SELECT 'SECURITY FIXES COMPLETED' as status;
SELECT * FROM verify_rls_status() ORDER BY table_name;