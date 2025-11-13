-- Migration: Authentication helpers and concurrency utilities for seat management
-- Created: 2025-09-21
-- Purpose: Provide secure helper functions for role detection and advisory locking
-- WARP.md compliance: SECURITY DEFINER utilities, safe for RPC usage

-- ====================================================================
-- PART 1: SERVICE ROLE DETECTION HELPER
-- ====================================================================

-- Helper function to detect if current call is from service_role
-- Used by RPCs to allow administrative operations
CREATE OR REPLACE FUNCTION public.util_is_service_role()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', TRUE)::jsonb->>'role') = 'service_role',
    FALSE
  )
$$;

-- ====================================================================
-- PART 2: PRINCIPAL SCHOOL DETECTION HELPER
-- ====================================================================

-- Helper function to get caller's preschool_id if they are a principal
-- Returns NULL if caller is not a principal or not authenticated
CREATE OR REPLACE FUNCTION public.util_caller_principal_school()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT p.preschool_id
  FROM public.profiles p
  WHERE p.id = auth.uid() AND p.role = 'principal'
$$;

-- ====================================================================
-- PART 3: ADVISORY LOCK HELPER
-- ====================================================================

-- Helper function to acquire per-school advisory lock for concurrency control
-- Returns TRUE if lock was acquired, FALSE if already held
-- Lock is automatically released at end of transaction
CREATE OR REPLACE FUNCTION public.util_acquire_school_lock(p_school uuid)
RETURNS boolean
LANGUAGE sql
VOLATILE
SECURITY DEFINER
AS $$
  SELECT pg_try_advisory_xact_lock(hashtext(p_school::text))
$$;

-- ====================================================================
-- PART 4: CALLER SCHOOL DETECTION HELPER
-- ====================================================================

-- Helper to get caller's school regardless of role (for limits queries)
CREATE OR REPLACE FUNCTION public.util_caller_school()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT p.preschool_id
  FROM public.profiles p
  WHERE p.id = auth.uid()
$$;

-- ====================================================================
-- PART 5: FUNCTION COMMENTS AND SECURITY
-- ====================================================================

-- Add comprehensive comments
COMMENT ON FUNCTION public.util_is_service_role() IS 'Detects if current call is from service_role (for admin operations)';
COMMENT ON FUNCTION public.util_caller_principal_school() IS 'Returns preschool_id if caller is a principal, NULL otherwise';
COMMENT ON FUNCTION public.util_acquire_school_lock(
  uuid
) IS 'Acquires advisory lock per school for concurrency control';
COMMENT ON FUNCTION public.util_caller_school() IS 'Returns caller preschool_id regardless of role';

-- Grant execution to authenticated users (needed for SECURITY DEFINER RPCs)
GRANT EXECUTE ON FUNCTION public.util_is_service_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.util_caller_principal_school() TO authenticated;
GRANT EXECUTE ON FUNCTION public.util_acquire_school_lock(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.util_caller_school() TO authenticated;

-- Also grant to service_role for admin operations
GRANT EXECUTE ON FUNCTION public.util_is_service_role() TO service_role;
GRANT EXECUTE ON FUNCTION public.util_caller_principal_school() TO service_role;
GRANT EXECUTE ON FUNCTION public.util_acquire_school_lock(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.util_caller_school() TO service_role;

-- ====================================================================
-- PART 6: VERIFICATION AND LOGGING
-- ====================================================================

-- Log migration completion
INSERT INTO public.config_kv (key, value, description, is_public)
VALUES (
  'seat_auth_helpers_20250921',
  jsonb_build_object(
    'completed_at', now(),
    'functions_created', ARRAY[
      'util_is_service_role',
      'util_caller_principal_school',
      'util_acquire_school_lock',
      'util_caller_school'
    ],
    'security_model', 'SECURITY DEFINER helpers for seat management RPCs',
    'grants', 'authenticated and service_role'
  ),
  'Seat management auth helpers completion log',
  FALSE
) ON CONFLICT (key) DO UPDATE SET
  value = excluded.value,
  updated_at = now();

SELECT 'SEAT AUTH AND LOCK HELPERS CREATED' AS status;

-- Test the functions (basic smoke test)
SELECT
  'util_is_service_role' AS function_name,
  public.util_is_service_role()::text AS result
UNION ALL
SELECT
  'util_caller_principal_school' AS function_name,
  coalesce(public.util_caller_principal_school()::text, 'NULL') AS result
UNION ALL
SELECT
  'util_caller_school' AS function_name,
  coalesce(public.util_caller_school()::text, 'NULL') AS result;
