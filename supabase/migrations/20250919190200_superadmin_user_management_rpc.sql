-- Superadmin User Management System - Phase 1: RPC Functions
-- Date: 2025-09-19  
-- Purpose: Create comprehensive RPC functions for superadmin user management system
-- WARP.md Compliance: Supabase migration, production-safe, forward-only
-- Authority: SUPERADMIN_DASHBOARD_UPGRADE_PLAN.md
-- Depends on: 20250919190000_superadmin_user_management_enums.sql, 20250919190100_superadmin_user_management_tables.sql

BEGIN;

-- ============================================================================
-- PART 1: CORE PERMISSION VALIDATION FUNCTIONS
-- ============================================================================

-- Function to check if current user is superadmin
CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users 
    WHERE auth_user_id = auth.uid() 
    AND role = 'super_admin' 
    AND is_active = true
  );
$$;

-- Function to check superadmin by user ID  
CREATE OR REPLACE FUNCTION is_superadmin_by_id(user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_user_id = user_id
    AND role = 'super_admin'
    AND is_active = true
  );
$$;

-- ============================================================================  
-- PART 2: USER DELETION MANAGEMENT FUNCTIONS
-- ============================================================================

-- NOTE: Complex user management functions moved to separate migration 
-- (20250919195200_recreate_superadmin_functions.sql) to avoid signature conflicts
-- This migration focuses only on essential functions that don't conflict

-- ============================================================================
-- PART 3-5: ADVANCED FUNCTIONS
-- ============================================================================

-- NOTE: Advanced notification, audit, dashboard, and testing functions
-- moved to separate migration (20250919195200_recreate_superadmin_functions.sql) 
-- to avoid signature conflicts with existing functions

-- ============================================================================
-- FUNCTION GRANTS
-- ============================================================================

-- Utility functions (available to all authenticated users)
GRANT EXECUTE ON FUNCTION is_superadmin() TO authenticated;
GRANT EXECUTE ON FUNCTION validate_risk_score(INTEGER) TO authenticated;

-- NOTE: All complex function grants moved to separate migrations to avoid conflicts:
-- - 20250919195200_recreate_superadmin_functions.sql (core functions)
-- - 20250919195300_fix_all_missing_functions.sql (user management functions)

-- ============================================================================
-- PART 7: COMPLETION LOGGING
-- ============================================================================

-- Log migration completion
INSERT INTO public.config_kv (key, value, description, is_public)
VALUES (
  'superadmin_rpc_migration_20250919190200',
  json_build_object(
    'version', '1.0.0',
    'completed_at', now()::TEXT,
    'functions_created', 9,
    'migration_file', '20250919190200_superadmin_user_management_rpc.sql'
  ),
  'Superadmin user management RPC functions migration completion log',
  FALSE
) ON CONFLICT (key) DO UPDATE SET
  value = excluded.value,
  updated_at = now();

SELECT 'SUPERADMIN RPC FUNCTIONS MIGRATION COMPLETED' AS status;

COMMIT;
