-- Superadmin User Management System - Phase 1: Enums and Types
-- Date: 2025-09-19
-- Purpose: Create comprehensive enum types for superadmin user management system
-- WARP.md Compliance: Supabase migration, production-safe, forward-only
-- Authority: SUPERADMIN_DASHBOARD_UPGRADE_PLAN.md

BEGIN;

-- ============================================================================
-- PART 1: CORE ENUMS FOR USER MANAGEMENT
-- ============================================================================

-- User deletion types
DO $$ BEGIN
    CREATE TYPE deletion_type_enum AS ENUM ('soft', 'hard', 'gdpr_compliance');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Deletion request status
DO $$ BEGIN
    CREATE TYPE deletion_status_enum AS ENUM ('pending', 'in_progress', 'completed', 'failed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- User escalation levels for suspensions
DO $$ BEGIN
    CREATE TYPE escalation_level_enum AS ENUM ('warning', 'suspension', 'termination');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Risk assessment levels
DO $$ BEGIN
    CREATE TYPE risk_level_enum AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- User suspension status
DO $$ BEGIN
    CREATE TYPE suspension_status_enum AS ENUM ('active', 'warning', 'suspended', 'terminated');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- PART 2: NOTIFICATION SYSTEM ENUMS
-- ============================================================================

-- Notification types
DO $$ BEGIN
    CREATE TYPE notification_type_enum AS ENUM (
      'system_error',
      'payment_issue', 
      'abuse_report',
      'support_urgent',
      'security_alert',
      'compliance_warning',
      'subscription_event',
      'user_behavior'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Notification sources
DO $$ BEGIN
    CREATE TYPE notification_source_enum AS ENUM (
      'error_monitoring',
      'payment_gateway',
      'user_reports',
      'support_system',
      'security_scanner',
      'compliance_engine',
      'analytics_engine'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Notification status
DO $$ BEGIN
    CREATE TYPE notification_status_enum AS ENUM ('unread', 'read', 'acknowledged', 'resolved');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Severity levels
DO $$ BEGIN
    CREATE TYPE severity_enum AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Delivery methods
DO $$ BEGIN
    CREATE TYPE delivery_method_enum AS ENUM ('in_app', 'email', 'sms', 'push', 'webhook');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Delivery status
DO $$ BEGIN
    CREATE TYPE delivery_status_enum AS ENUM ('pending', 'sent', 'delivered', 'failed', 'bounced');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- PART 3: ADMIN ROLE SYSTEM ENUMS
-- ============================================================================

-- Admin role levels (hierarchical)
DO $$ BEGIN
    CREATE TYPE admin_role_level_enum AS ENUM (
      'super_admin',      -- Level 1: Full system access
      'platform_admin',   -- Level 2: User management, platform config  
      'regional_admin',    -- Level 3: Geographic/tenant specific
      'support_admin',     -- Level 4: User support, limited access
      'content_moderator'  -- Level 5: Content review only
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Admin permission scopes
DO $$ BEGIN
    CREATE TYPE admin_scope_enum AS ENUM (
      'global',
      'regional', 
      'tenant',
      'limited'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Session termination reasons
DO $$ BEGIN
    CREATE TYPE session_termination_enum AS ENUM (
      'logout',
      'timeout', 
      'forced',
      'security_breach',
      'policy_violation'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- PART 4: COMPLIANCE AND REPORTING ENUMS
-- ============================================================================

-- Compliance report types
DO $$ BEGIN
    CREATE TYPE compliance_report_type_enum AS ENUM (
      'gdpr_audit',
      'popia_audit', 
      'security_audit',
      'access_review',
      'data_retention',
      'breach_report'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Report generation status
DO $$ BEGIN
    CREATE TYPE report_status_enum AS ENUM ('generating', 'completed', 'failed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- PART 5: SUPERADMIN ACTION TRACKING
-- ============================================================================

-- Comprehensive superadmin actions for audit trail
DO $$ BEGIN
    CREATE TYPE superadmin_action_enum AS ENUM (
      -- User Management
      'user_created',
      'user_updated', 
      'user_suspended',
      'user_reactivated',
      'user_deleted',
      'user_impersonated',
      'password_reset',
      'role_changed',
      'profile_updated',
      'account_locked',
      'account_unlocked',
      
      -- Bulk Operations
      'bulk_suspend',
      'bulk_reactivate', 
      'bulk_delete',
      'bulk_role_change',
      'bulk_notification',
      
      -- Admin Management
      'admin_created',
      'admin_promoted',
      'admin_demoted',
      'admin_permissions_updated',
      'admin_session_terminated',
      
      -- System Operations
      'system_config_updated',
      'feature_flag_toggled',
      'maintenance_mode_toggled',
      'backup_initiated',
      'data_export_requested',
      
      -- Security Actions
      'security_policy_updated',
      'ip_restriction_added',
      'ip_restriction_removed',
      'audit_log_accessed',
      'compliance_report_generated'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- PART 6: UTILITY FUNCTIONS
-- ============================================================================

-- Function to convert numeric risk score to risk level enum
CREATE OR REPLACE FUNCTION validate_risk_score(score INTEGER)
RETURNS RISK_LEVEL_ENUM
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  CASE 
    WHEN score >= 0 AND score <= 25 THEN
      RETURN 'low'::risk_level_enum;
    WHEN score > 25 AND score <= 50 THEN  
      RETURN 'medium'::risk_level_enum;
    WHEN score > 50 AND score <= 75 THEN
      RETURN 'high'::risk_level_enum;
    WHEN score > 75 AND score <= 100 THEN
      RETURN 'critical'::risk_level_enum;
    ELSE
      -- Default to medium for invalid scores
      RETURN 'medium'::risk_level_enum;
  END CASE;
END;
$$;

-- Function to get UI color for risk levels
CREATE OR REPLACE FUNCTION get_risk_color(risk_level RISK_LEVEL_ENUM)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  CASE risk_level
    WHEN 'low' THEN
      RETURN '#10b981';      -- Green
    WHEN 'medium' THEN
      RETURN '#f59e0b';      -- Amber  
    WHEN 'high' THEN
      RETURN '#ef4444';      -- Red
    WHEN 'critical' THEN
      RETURN '#dc2626';      -- Dark red
    ELSE
      RETURN '#6b7280';      -- Gray (fallback)
  END CASE;
END;
$$;

-- ============================================================================
-- PART 7: COMPLETION LOGGING
-- ============================================================================

-- Log migration completion
INSERT INTO public.config_kv (key, value, description, is_public)
VALUES (
  'superadmin_enums_migration_20250919190000',
  json_build_object(
    'version', '1.0.0',
    'completed_at', now()::TEXT,
    'enums_created', 15,
    'functions_created', 2,
    'migration_file', '20250919190000_superadmin_user_management_enums.sql'
  ),
  'Superadmin user management enums migration completion log',
  FALSE
) ON CONFLICT (key) DO UPDATE SET
  value = excluded.value,
  updated_at = now();

SELECT 'SUPERADMIN ENUMS MIGRATION COMPLETED' AS status;

COMMIT;
