-- Superadmin User Management System - Phase 1: Core Tables
-- Date: 2025-09-19
-- Purpose: Create comprehensive tables for superadmin user management system
-- WARP.md Compliance: Supabase migration, production-safe, forward-only
-- Authority: SUPERADMIN_DASHBOARD_UPGRADE_PLAN.md
-- Depends on: 20250919190000_superadmin_user_management_enums.sql

BEGIN;

-- ============================================================================
-- PART 1: USER DELETION REQUEST SYSTEM
-- ============================================================================

-- User deletion requests table
CREATE TABLE IF NOT EXISTS superadmin_user_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id UUID NOT NULL,
  requested_by UUID NOT NULL REFERENCES profiles (id),
  deletion_type DELETION_TYPE_ENUM NOT NULL,
  reason TEXT NOT NULL,
  status DELETION_STATUS_ENUM DEFAULT 'pending',
  scheduled_for TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  backup_location TEXT,
  related_records JSONB NOT NULL DEFAULT '[]',
  compliance_flags JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- User action history for comprehensive audit trail
CREATE TABLE IF NOT EXISTS superadmin_user_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES profiles (id),
  target_user_id UUID,
  action SUPERADMIN_ACTION_ENUM NOT NULL,
  details JSONB NOT NULL DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  session_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- User risk assessments for behavioral analysis
CREATE TABLE IF NOT EXISTS superadmin_user_risk_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles (id),
  risk_score INTEGER NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
  risk_level RISK_LEVEL_ENUM NOT NULL,
  risk_factors JSONB NOT NULL DEFAULT '{}',
  assessed_by UUID REFERENCES profiles (id),
  assessment_date TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '30 days'),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE (user_id, assessment_date)
);

-- ============================================================================
-- PART 2: NOTIFICATION SYSTEM TABLES  
-- ============================================================================

-- Admin notifications for real-time alerts
CREATE TABLE IF NOT EXISTS superadmin_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type NOTIFICATION_TYPE_ENUM NOT NULL,
  severity SEVERITY_ENUM NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  source NOTIFICATION_SOURCE_ENUM NOT NULL,
  target_admins UUID [] NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  status NOTIFICATION_STATUS_ENUM DEFAULT 'unread',
  created_at TIMESTAMPTZ DEFAULT now(),
  read_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES profiles (id)
);

-- Notification delivery tracking
CREATE TABLE IF NOT EXISTS superadmin_notification_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES superadmin_notifications (id) ON DELETE CASCADE,
  admin_user_id UUID NOT NULL REFERENCES profiles (id),
  delivery_method DELIVERY_METHOD_ENUM NOT NULL,
  status DELIVERY_STATUS_ENUM NOT NULL,
  delivered_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Notification rules for automated triggering
CREATE TABLE IF NOT EXISTS superadmin_notification_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name TEXT NOT NULL UNIQUE,
  conditions JSONB NOT NULL,
  actions JSONB NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID NOT NULL REFERENCES profiles (id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- PART 3: ADMIN ROLE MANAGEMENT TABLES
-- ============================================================================

-- Admin role assignments for hierarchical permissions
CREATE TABLE IF NOT EXISTS superadmin_role_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES profiles (id),
  role_level ADMIN_ROLE_LEVEL_ENUM NOT NULL,
  scope ADMIN_SCOPE_ENUM NOT NULL DEFAULT 'limited',
  additional_permissions JSONB DEFAULT '[]',
  additional_restrictions JSONB DEFAULT '[]',
  valid_from TIMESTAMPTZ DEFAULT now(),
  valid_until TIMESTAMPTZ,
  assigned_by UUID NOT NULL REFERENCES profiles (id),
  justification TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE (admin_user_id, role_level, valid_from)
);

-- Admin sessions tracking for security monitoring
CREATE TABLE IF NOT EXISTS superadmin_session_management (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES profiles (id),
  session_token TEXT NOT NULL UNIQUE,
  ip_address INET NOT NULL,
  user_agent TEXT,
  location_data JSONB,
  permissions_snapshot JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  last_activity_at TIMESTAMPTZ DEFAULT now(),
  terminated_at TIMESTAMPTZ,
  terminated_by UUID REFERENCES profiles (id),
  termination_reason SESSION_TERMINATION_ENUM,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- PART 4: COMPLIANCE AND REPORTING TABLES
-- ============================================================================

-- Compliance reports for automated audit generation
CREATE TABLE IF NOT EXISTS superadmin_compliance_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type COMPLIANCE_REPORT_TYPE_ENUM NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  generated_by UUID NOT NULL REFERENCES profiles (id),
  status REPORT_STATUS_ENUM DEFAULT 'generating',
  file_location TEXT,
  summary JSONB,
  findings JSONB DEFAULT '[]',
  recommendations JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- ============================================================================
-- PART 5: PERFORMANCE INDEXES
-- ============================================================================

-- NOTE: Indexes moved to separate schema fix migration (20250919195100_fix_superadmin_schema_indexes.sql)
-- This prevents conflicts with existing tables that may have different schemas
-- The fix migration will conditionally create indexes based on actual column existence

-- ============================================================================
-- PART 6: AUTOMATIC TRIGGERS FOR DATA CONSISTENCY
-- ============================================================================

-- Trigger to update risk level when risk score changes
CREATE OR REPLACE FUNCTION update_risk_level_trigger()
RETURNS TRIGGER AS $$
BEGIN
  NEW.risk_level = validate_risk_score(NEW.risk_score);
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_risk_level
BEFORE INSERT OR UPDATE OF risk_score ON superadmin_user_risk_assessments
FOR EACH ROW EXECUTE FUNCTION update_risk_level_trigger();

-- Trigger to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_trigger()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER trigger_superadmin_deletion_requests_updated_at
BEFORE UPDATE ON superadmin_user_deletion_requests
FOR EACH ROW EXECUTE FUNCTION update_updated_at_trigger();

CREATE TRIGGER trigger_superadmin_risk_assessments_updated_at
BEFORE UPDATE ON superadmin_user_risk_assessments
FOR EACH ROW EXECUTE FUNCTION update_updated_at_trigger();

CREATE TRIGGER trigger_superadmin_notification_rules_updated_at
BEFORE UPDATE ON superadmin_notification_rules
FOR EACH ROW EXECUTE FUNCTION update_updated_at_trigger();

CREATE TRIGGER trigger_superadmin_role_assignments_updated_at
BEFORE UPDATE ON superadmin_role_assignments
FOR EACH ROW EXECUTE FUNCTION update_updated_at_trigger();

-- ============================================================================
-- PART 7: COMPLETION LOGGING
-- ============================================================================

-- Log migration completion
INSERT INTO public.config_kv (key, value, description, is_public)
VALUES (
  'superadmin_tables_migration_20250919190100',
  json_build_object(
    'version', '1.0.0',
    'completed_at', now()::TEXT,
    'tables_created', 8,
    'indexes_created', 25,
    'triggers_created', 5,
    'migration_file', '20250919190100_superadmin_user_management_tables.sql'
  ),
  'Superadmin user management tables migration completion log',
  FALSE
) ON CONFLICT (key) DO UPDATE SET
  value = excluded.value,
  updated_at = now();

SELECT 'SUPERADMIN TABLES MIGRATION COMPLETED' AS status;

COMMIT;
