-- ENABLE RLS ON CRITICAL TABLES
-- Purpose: Enable RLS on users, students, organizations, and classes tables before applying policies
-- Phase: Critical tables preparation
-- Compliance: WARP.md Non-negotiable #4 - Security Controls

BEGIN;

-- ============================================================================
-- SECTION 1: ENABLE RLS ON CRITICAL TABLES
-- ============================================================================

-- Enable RLS on users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Enable RLS on students table  
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- Enable RLS on organizations table
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Enable RLS on classes table
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SECTION 2: VERIFICATION
-- ============================================================================

-- Verify RLS is enabled on all critical tables
DO $$
DECLARE
    rls_status RECORD;
BEGIN
    RAISE NOTICE '✅ RLS Enable Status for Critical Tables:';
    
    FOR rls_status IN 
        SELECT 
            schemaname,
            tablename,
            rowsecurity as rls_enabled,
            (SELECT COUNT(*) FROM pg_policies WHERE tablename = t.tablename) as policy_count
        FROM pg_tables t 
        WHERE schemaname = 'public' 
        AND tablename IN ('users', 'students', 'organizations', 'classes')
        ORDER BY tablename
    LOOP
        RAISE NOTICE '📊 Table: % | RLS: % | Policies: %', 
            rls_status.tablename, 
            CASE WHEN rls_status.rls_enabled THEN 'ENABLED' ELSE 'DISABLED' END,
            rls_status.policy_count;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '🎯 READY FOR POLICY APPLICATION';
    RAISE NOTICE '📋 Next step: Apply critical RLS policies';
END;
$$;

-- ============================================================================
-- SECTION 3: LOG THE ACTION
-- ============================================================================

-- Log this action for audit trail
INSERT INTO public.config_kv (key, value, description, is_public)
VALUES (
  'rls_enabled_critical_tables_20250919',
  json_build_object(
    'action', 'Enable RLS on critical tables',
    'tables_affected', json_build_array('users', 'students', 'organizations', 'classes'),
    'rls_status', 'ENABLED',
    'enabled_timestamp', now()::text,
    'reason', 'Preparation for critical RLS policy implementation',
    'next_phase', 'Apply generated RLS policies'
  ),
  'RLS enabled on critical tables for policy implementation',
  FALSE
) ON CONFLICT (key) DO UPDATE SET
  value = excluded.value,
  updated_at = now();

COMMIT;

-- Final status message
SELECT
  'RLS Enabled on Critical Tables' AS status,
  'Ready for policy application' AS message,
  now() AS enabled_at;
