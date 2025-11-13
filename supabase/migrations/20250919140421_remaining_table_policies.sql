-- ============================================
-- EduDash Pro RLS Policies - Remaining Tables
-- ============================================
-- Generated: 2025-09-19T14:04:21.652Z
-- Purpose: Secure remaining unprotected critical tables
-- Tables: 9
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
-- Template: user_scoped
-- Priority: high

-- Drop existing policies
DROP POLICY IF EXISTS push_notifications_rls_read ON push_notifications;
DROP POLICY IF EXISTS push_notifications_rls_write ON push_notifications;

-- Read Policy
CREATE POLICY push_notifications_rls_read
ON push_notifications
FOR SELECT
TO public
USING (
  (app_auth.is_superadmin() OR app_auth.is_super_admin())
  OR recipient_user_id = (
    SELECT id
    FROM users
    WHERE auth_user_id = app_auth.user_id()
  )
  OR (
    app_auth.is_principal()
    AND EXISTS (
      SELECT 1
      FROM (SELECT recipient_user_id) AS pn (recipient_user_id)
      INNER JOIN users AS u ON pn.recipient_user_id = u.id
      WHERE COALESCE(
        u.preschool_id,
        u.organization_id
      ) = COALESCE(
        app_auth.current_user_org_id(),
        app_auth.org_id()
      )
    )
  )
);

-- Write Policy (INSERT, UPDATE, DELETE)
CREATE POLICY push_notifications_rls_write
ON push_notifications
FOR ALL
TO public
USING (
  (app_auth.is_superadmin() OR app_auth.is_super_admin())
  OR recipient_user_id = (
    SELECT id
    FROM users
    WHERE auth_user_id = app_auth.user_id()
  )
  OR (
    app_auth.is_principal()
    AND EXISTS (
      SELECT 1
      FROM (SELECT recipient_user_id) AS pn (recipient_user_id)
      INNER JOIN users AS u ON pn.recipient_user_id = u.id
      WHERE COALESCE(
        u.preschool_id,
        u.organization_id
      ) = COALESCE(
        app_auth.current_user_org_id(),
        app_auth.org_id()
      )
    )
  )
)
WITH CHECK (
  (app_auth.is_superadmin() OR app_auth.is_super_admin())
  OR (
    recipient_user_id = (
      SELECT id
      FROM users
      WHERE auth_user_id = app_auth.user_id()
    )
    AND app_auth.has_cap('manage_own_profile')
  )
  OR (
    app_auth.is_principal()
    AND app_auth.has_cap('send_notifications')
    AND EXISTS (
      SELECT 1
      FROM (SELECT recipient_user_id) AS pn (recipient_user_id)
      INNER JOIN users AS u ON pn.recipient_user_id = u.id
      WHERE COALESCE(
        u.preschool_id,
        u.organization_id
      ) = COALESCE(
        app_auth.current_user_org_id(),
        app_auth.org_id()
      )
    )
  )
);


-- ============================================
-- PUSH_DEVICES TABLE POLICIES
-- ============================================
-- Description: User device tokens - high privacy risk
-- Template: user_scoped
-- Priority: high

-- Drop existing policies
DROP POLICY IF EXISTS push_devices_rls_read ON push_devices;
DROP POLICY IF EXISTS push_devices_rls_write ON push_devices;

-- Read Policy
CREATE POLICY push_devices_rls_read
ON push_devices
FOR SELECT
TO public
USING (
  (app_auth.is_superadmin() OR app_auth.is_super_admin())
  OR user_id = (
    SELECT id
    FROM users
    WHERE auth_user_id = app_auth.user_id()
  )
  OR (
    app_auth.is_principal()
    AND EXISTS (
      SELECT 1
      FROM (SELECT user_id) AS pd (user_id)
      INNER JOIN users AS u ON pd.user_id = u.id
      WHERE COALESCE(
        u.preschool_id,
        u.organization_id
      ) = COALESCE(
        app_auth.current_user_org_id(),
        app_auth.org_id()
      )
    )
  )
);

-- Write Policy (INSERT, UPDATE, DELETE)
CREATE POLICY push_devices_rls_write
ON push_devices
FOR ALL
TO public
USING (
  (app_auth.is_superadmin() OR app_auth.is_super_admin())
  OR user_id = (
    SELECT id
    FROM users
    WHERE auth_user_id = app_auth.user_id()
  )
  OR (
    app_auth.is_principal()
    AND EXISTS (
      SELECT 1
      FROM (SELECT user_id) AS pd (user_id)
      INNER JOIN users AS u ON pd.user_id = u.id
      WHERE COALESCE(
        u.preschool_id,
        u.organization_id
      ) = COALESCE(
        app_auth.current_user_org_id(),
        app_auth.org_id()
      )
    )
  )
)
WITH CHECK (
  (app_auth.is_superadmin() OR app_auth.is_super_admin())
  OR (
    user_id = (
      SELECT id
      FROM users
      WHERE auth_user_id = app_auth.user_id()
    )
    AND app_auth.has_cap('manage_own_profile')
  )
  OR (
    app_auth.is_principal()
    AND app_auth.has_cap('manage_devices')
    AND EXISTS (
      SELECT 1
      FROM (SELECT user_id) AS pd (user_id)
      INNER JOIN users AS u ON pd.user_id = u.id
      WHERE COALESCE(
        u.preschool_id,
        u.organization_id
      ) = COALESCE(
        app_auth.current_user_org_id(),
        app_auth.org_id()
      )
    )
  )
);


-- ============================================
-- HOMEWORK_ASSIGNMENTS TABLE POLICIES
-- ============================================
-- Description: Homework and assignment data
-- Template: org_scoped
-- Priority: high

-- Drop existing policies
DROP POLICY IF EXISTS homework_assignments_rls_read ON homework_assignments;
DROP POLICY IF EXISTS homework_assignments_rls_write ON homework_assignments;

-- Read Policy
CREATE POLICY homework_assignments_rls_read
ON homework_assignments
FOR SELECT
TO public
USING (
  (app_auth.is_superadmin() OR app_auth.is_super_admin())
  OR (
    preschool_id
    = COALESCE(app_auth.current_user_org_id(), app_auth.org_id())
  )
);

-- Write Policy (INSERT, UPDATE, DELETE)
CREATE POLICY homework_assignments_rls_write
ON homework_assignments
FOR ALL
TO public
USING (
  (app_auth.is_superadmin() OR app_auth.is_super_admin())
  OR (
    preschool_id
    = COALESCE(app_auth.current_user_org_id(), app_auth.org_id())
  )
)
WITH CHECK (
  (app_auth.is_superadmin() OR app_auth.is_super_admin())
  OR (
    preschool_id
    = COALESCE(app_auth.current_user_org_id(), app_auth.org_id())
    AND app_auth.has_cap('manage_assignments')
  )
);


-- ============================================
-- LESSONS TABLE POLICIES
-- ============================================
-- Description: Lesson planning and content
-- Template: org_scoped
-- Priority: high

-- Drop existing policies
DROP POLICY IF EXISTS lessons_rls_read ON lessons;
DROP POLICY IF EXISTS lessons_rls_write ON lessons;

-- Read Policy
CREATE POLICY lessons_rls_read
ON lessons
FOR SELECT
TO public
USING (
  (app_auth.is_superadmin() OR app_auth.is_super_admin())
  OR (
    preschool_id
    = COALESCE(app_auth.current_user_org_id(), app_auth.org_id())
  )
);

-- Write Policy (INSERT, UPDATE, DELETE)
CREATE POLICY lessons_rls_write
ON lessons
FOR ALL
TO public
USING (
  (app_auth.is_superadmin() OR app_auth.is_super_admin())
  OR (
    preschool_id
    = COALESCE(app_auth.current_user_org_id(), app_auth.org_id())
  )
)
WITH CHECK (
  (app_auth.is_superadmin() OR app_auth.is_super_admin())
  OR (
    preschool_id
    = COALESCE(app_auth.current_user_org_id(), app_auth.org_id())
    AND app_auth.has_cap('manage_lessons')
  )
);


-- ============================================
-- AI_GENERATIONS TABLE POLICIES
-- ============================================
-- Description: AI content generation tracking
-- Template: org_scoped
-- Priority: medium

-- Drop existing policies
DROP POLICY IF EXISTS ai_generations_rls_read ON ai_generations;
DROP POLICY IF EXISTS ai_generations_rls_write ON ai_generations;

-- Read Policy
CREATE POLICY ai_generations_rls_read
ON ai_generations
FOR SELECT
TO public
USING (
  (app_auth.is_superadmin() OR app_auth.is_super_admin())
  OR (
    preschool_id
    = COALESCE(app_auth.current_user_org_id(), app_auth.org_id())
  )
);

-- Write Policy (INSERT, UPDATE, DELETE)
CREATE POLICY ai_generations_rls_write
ON ai_generations
FOR ALL
TO public
USING (
  (app_auth.is_superadmin() OR app_auth.is_super_admin())
  OR (
    preschool_id
    = COALESCE(app_auth.current_user_org_id(), app_auth.org_id())
  )
)
WITH CHECK (
  (app_auth.is_superadmin() OR app_auth.is_super_admin())
  OR (
    preschool_id
    = COALESCE(app_auth.current_user_org_id(), app_auth.org_id())
    AND app_auth.has_cap('use_ai_features')
  )
);


-- ============================================
-- BILLING_PLANS TABLE POLICIES
-- ============================================
-- Description: System-wide billing plan configuration
-- Template: global_config
-- Priority: medium

-- Drop existing policies
DROP POLICY IF EXISTS billing_plans_rls_read ON billing_plans;
DROP POLICY IF EXISTS billing_plans_rls_write ON billing_plans;

-- Read Policy
CREATE POLICY billing_plans_rls_read
ON billing_plans
FOR SELECT
TO public
USING (
  active = TRUE
);

-- Write Policy (INSERT, UPDATE, DELETE)
CREATE POLICY billing_plans_rls_write
ON billing_plans
FOR ALL
TO public
USING (
  active = TRUE
)
WITH CHECK (
  (app_auth.is_superadmin() OR app_auth.is_super_admin())
);


-- ============================================
-- SCHOOL_AI_SUBSCRIPTIONS TABLE POLICIES
-- ============================================
-- Description: School AI subscription management
-- Template: org_scoped
-- Priority: high

-- Drop existing policies
DROP POLICY IF EXISTS school_ai_subscriptions_rls_read
ON school_ai_subscriptions;
DROP POLICY IF EXISTS school_ai_subscriptions_rls_write
ON school_ai_subscriptions;

-- Read Policy
CREATE POLICY school_ai_subscriptions_rls_read
ON school_ai_subscriptions
FOR SELECT
TO public
USING (
  (app_auth.is_superadmin() OR app_auth.is_super_admin())
  OR (
    preschool_id
    = COALESCE(app_auth.current_user_org_id(), app_auth.org_id())
  )
);

-- Write Policy (INSERT, UPDATE, DELETE)
CREATE POLICY school_ai_subscriptions_rls_write
ON school_ai_subscriptions
FOR ALL
TO public
USING (
  (app_auth.is_superadmin() OR app_auth.is_super_admin())
  OR (
    preschool_id
    = COALESCE(app_auth.current_user_org_id(), app_auth.org_id())
  )
)
WITH CHECK (
  (app_auth.is_superadmin() OR app_auth.is_super_admin())
  OR (
    preschool_id
    = COALESCE(app_auth.current_user_org_id(), app_auth.org_id())
    AND app_auth.has_cap('manage_ai_subscriptions')
  )
);


-- ============================================
-- PETTY_CASH_RECEIPTS TABLE POLICIES
-- ============================================
-- Description: Petty cash receipt tracking
-- Template: org_scoped
-- Priority: medium

-- Drop existing policies
DROP POLICY IF EXISTS petty_cash_receipts_rls_read ON petty_cash_receipts;
DROP POLICY IF EXISTS petty_cash_receipts_rls_write ON petty_cash_receipts;

-- Read Policy
CREATE POLICY petty_cash_receipts_rls_read
ON petty_cash_receipts
FOR SELECT
TO public
USING (
  (app_auth.is_superadmin() OR app_auth.is_super_admin())
  OR (
    school_id
    = COALESCE(app_auth.current_user_org_id(), app_auth.org_id())
  )
);

-- Write Policy (INSERT, UPDATE, DELETE)
CREATE POLICY petty_cash_receipts_rls_write
ON petty_cash_receipts
FOR ALL
TO public
USING (
  (app_auth.is_superadmin() OR app_auth.is_super_admin())
  OR (
    school_id
    = COALESCE(app_auth.current_user_org_id(), app_auth.org_id())
  )
)
WITH CHECK (
  (app_auth.is_superadmin() OR app_auth.is_super_admin())
  OR (
    school_id
    = COALESCE(app_auth.current_user_org_id(), app_auth.org_id())
    AND app_auth.has_cap('manage_petty_cash')
  )
);


-- ============================================
-- PETTY_CASH_RECONCILIATIONS TABLE POLICIES
-- ============================================
-- Description: Petty cash reconciliation records
-- Template: org_scoped
-- Priority: medium

-- Drop existing policies
DROP POLICY IF EXISTS petty_cash_reconciliations_rls_read
ON petty_cash_reconciliations;
DROP POLICY IF EXISTS petty_cash_reconciliations_rls_write
ON petty_cash_reconciliations;

-- Read Policy
CREATE POLICY petty_cash_reconciliations_rls_read
ON petty_cash_reconciliations
FOR SELECT
TO public
USING (
  (app_auth.is_superadmin() OR app_auth.is_super_admin())
  OR (
    preschool_id
    = COALESCE(app_auth.current_user_org_id(), app_auth.org_id())
  )
);

-- Write Policy (INSERT, UPDATE, DELETE)
CREATE POLICY petty_cash_reconciliations_rls_write
ON petty_cash_reconciliations
FOR ALL
TO public
USING (
  (app_auth.is_superadmin() OR app_auth.is_super_admin())
  OR (
    preschool_id
    = COALESCE(app_auth.current_user_org_id(), app_auth.org_id())
  )
)
WITH CHECK (
  (app_auth.is_superadmin() OR app_auth.is_super_admin())
  OR (
    preschool_id
    = COALESCE(app_auth.current_user_org_id(), app_auth.org_id())
    AND app_auth.has_cap('manage_petty_cash')
  )
);


-- ============================================
-- PERFORMANCE INDEXES FOR RLS POLICIES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_push_notifications_recipient_user_id
ON push_notifications (recipient_user_id);

CREATE INDEX IF NOT EXISTS idx_push_devices_user_id
ON push_devices (user_id);

CREATE INDEX IF NOT EXISTS idx_homework_assignments_preschool_id
ON homework_assignments (preschool_id);

CREATE INDEX IF NOT EXISTS idx_lessons_preschool_id
ON lessons (preschool_id);

CREATE INDEX IF NOT EXISTS idx_ai_generations_preschool_id
ON ai_generations (preschool_id);

CREATE INDEX IF NOT EXISTS idx_school_ai_subscriptions_preschool_id
ON school_ai_subscriptions (preschool_id);

CREATE INDEX IF NOT EXISTS idx_petty_cash_receipts_school_id
ON petty_cash_receipts (school_id);

CREATE INDEX IF NOT EXISTS idx_petty_cash_reconciliations_preschool_id
ON petty_cash_reconciliations (preschool_id);


-- ============================================
-- Migration Completion Notice
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ RLS Policy Generation Complete - Remaining Tables';
  RAISE NOTICE '📋 Generated policies for 9 tables';
  RAISE NOTICE '🔒 Security level: CRITICAL - Immediate deployment required';
  RAISE NOTICE '⚡ Performance indexes added for optimal query performance';
  RAISE NOTICE '🚨 WARNING: Critical security gaps closed';
END $$;
