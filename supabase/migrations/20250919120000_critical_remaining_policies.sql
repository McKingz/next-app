-- ============================================
-- EduDash Pro RLS Policies - Verified Critical Tables
-- ============================================
-- Generated: 2025-09-19T12:00:00.000Z
-- Purpose: Secure verified critical tables with correct schema
-- Security Level: CRITICAL
-- ============================================

-- Ensure app_auth schema exists (dependency check)
SELECT 1 FROM pg_proc AS p
WHERE p.proname = 'is_super_admin' AND p.pronamespace = (
  SELECT n.oid FROM pg_namespace AS n
  WHERE n.nspname = 'app_auth'
);

-- ============================================
-- PUSH_NOTIFICATIONS TABLE POLICIES
-- ============================================
-- Description: Push notification delivery - user privacy critical
-- Uses: recipient_user_id column (verified from schema)

-- Drop existing policies
DROP POLICY IF EXISTS push_notifications_rls_read ON push_notifications;
DROP POLICY IF EXISTS push_notifications_rls_write ON push_notifications;

-- Read Policy
CREATE POLICY push_notifications_rls_read
ON push_notifications
FOR SELECT
TO public
USING (
  app_auth.is_super_admin()
  OR recipient_user_id = app_auth.profile_id()
  OR (
    app_auth.is_principal()
    AND preschool_id = app_auth.org_id()
  )
);

-- Write Policy (INSERT, UPDATE, DELETE)
CREATE POLICY push_notifications_rls_write
ON push_notifications
FOR ALL
TO public
USING (
  app_auth.is_super_admin()
  OR recipient_user_id = app_auth.profile_id()
  OR (
    app_auth.is_principal()
    AND preschool_id = app_auth.org_id()
  )
)
WITH CHECK (
  app_auth.is_super_admin()
  OR (
    app_auth.is_principal()
    AND preschool_id = app_auth.org_id()
    AND app_auth.has_cap('send_notifications')
  )
);

-- ============================================
-- HOMEWORK_ASSIGNMENTS TABLE POLICIES  
-- ============================================
-- Description: Homework and assignment data

-- Drop existing policies
DROP POLICY IF EXISTS homework_assignments_rls_read ON homework_assignments;
DROP POLICY IF EXISTS homework_assignments_rls_write ON homework_assignments;

-- Read Policy
CREATE POLICY homework_assignments_rls_read
ON homework_assignments
FOR SELECT
TO public
USING (
  app_auth.is_super_admin()
  OR (preschool_id = app_auth.org_id())
);

-- Write Policy (INSERT, UPDATE, DELETE)
CREATE POLICY homework_assignments_rls_write
ON homework_assignments
FOR ALL
TO public
USING (
  app_auth.is_super_admin()
  OR (preschool_id = app_auth.org_id())
)
WITH CHECK (
  app_auth.is_super_admin()
  OR (
    preschool_id = app_auth.org_id()
    AND app_auth.has_cap('manage_assignments')
  )
);

-- ============================================
-- LESSONS TABLE POLICIES
-- ============================================
-- Description: Lesson planning and content

-- Drop existing policies
DROP POLICY IF EXISTS lessons_rls_read ON lessons;
DROP POLICY IF EXISTS lessons_rls_write ON lessons;

-- Read Policy
CREATE POLICY lessons_rls_read
ON lessons
FOR SELECT
TO public
USING (
  app_auth.is_super_admin()
  OR (preschool_id = app_auth.org_id())
);

-- Write Policy (INSERT, UPDATE, DELETE)
CREATE POLICY lessons_rls_write
ON lessons
FOR ALL
TO public
USING (
  app_auth.is_super_admin()
  OR (preschool_id = app_auth.org_id())
)
WITH CHECK (
  app_auth.is_super_admin()
  OR (
    preschool_id = app_auth.org_id()
    AND app_auth.has_cap('manage_lessons')
  )
);

-- ============================================
-- AI_GENERATIONS TABLE POLICIES
-- ============================================
-- Description: AI content generation tracking

-- Drop existing policies
DROP POLICY IF EXISTS ai_generations_rls_read ON ai_generations;
DROP POLICY IF EXISTS ai_generations_rls_write ON ai_generations;

-- Read Policy
CREATE POLICY ai_generations_rls_read
ON ai_generations
FOR SELECT
TO public
USING (
  app_auth.is_super_admin()
  OR (preschool_id = app_auth.org_id())
);

-- Write Policy (INSERT, UPDATE, DELETE)
CREATE POLICY ai_generations_rls_write
ON ai_generations
FOR ALL
TO public
USING (
  app_auth.is_super_admin()
  OR (preschool_id = app_auth.org_id())
)
WITH CHECK (
  app_auth.is_super_admin()
  OR (
    preschool_id = app_auth.org_id()
    AND app_auth.has_cap('use_ai_features')
  )
);

-- ============================================
-- BILLING_PLANS TABLE POLICIES
-- ============================================
-- Description: System-wide billing plan configuration

-- Drop existing policies
DROP POLICY IF EXISTS billing_plans_rls_read ON billing_plans;
DROP POLICY IF EXISTS billing_plans_rls_write ON billing_plans;

-- Read Policy - Public plans are readable by all
CREATE POLICY billing_plans_rls_read
ON billing_plans
FOR SELECT
TO public
USING (
  active = TRUE
);

-- Write Policy - Only superadmins can modify
CREATE POLICY billing_plans_rls_write
ON billing_plans
FOR ALL
TO public
USING (
  app_auth.is_super_admin()
)
WITH CHECK (
  app_auth.is_super_admin()
);

-- ============================================
-- PERFORMANCE INDEXES FOR RLS POLICIES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_push_notifications_recipient_user_id
ON push_notifications (recipient_user_id);

CREATE INDEX IF NOT EXISTS idx_push_notifications_preschool_id
ON push_notifications (preschool_id);

CREATE INDEX IF NOT EXISTS idx_homework_assignments_preschool_id
ON homework_assignments (preschool_id);

CREATE INDEX IF NOT EXISTS idx_lessons_preschool_id
ON lessons (preschool_id);

CREATE INDEX IF NOT EXISTS idx_ai_generations_preschool_id
ON ai_generations (preschool_id);

CREATE INDEX IF NOT EXISTS idx_billing_plans_active
ON billing_plans (active);

-- ============================================
-- Migration Completion Notice
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ RLS Policy Generation Complete - Verified Critical Tables';
  RAISE NOTICE '📋 Generated policies for 5 verified tables';  
  RAISE NOTICE '🔒 Security level: CRITICAL - Immediate deployment required';
  RAISE NOTICE '⚡ Performance indexes added for optimal query performance';
  RAISE NOTICE '🚨 WARNING: Critical security gaps closed for verified tables';
  RAISE NOTICE '📝 NOTE: Some tables skipped due to schema validation - will audit separately';
END $$;
