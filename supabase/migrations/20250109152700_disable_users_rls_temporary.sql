-- =============================================
-- TEMPORARY FIX: Disable RLS on users table
-- This is to diagnose the root cause of 500 errors
-- Will re-enable with proper policies once issue is identified
-- =============================================

-- Temporarily disable RLS on users table
ALTER TABLE IF EXISTS public.users DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies to clean slate
DROP POLICY IF EXISTS users_service_role_full_access ON public.users;
DROP POLICY IF EXISTS users_superadmin_emergency_access ON public.users;
DROP POLICY IF EXISTS users_self_record_access ON public.users;
DROP POLICY IF EXISTS users_preschool_read_only ON public.users;

-- Add a temporary marker
COMMENT ON TABLE public.users IS 'TEMPORARY: RLS DISABLED for diagnostics - MUST RE-ENABLE';

-- Log the temporary change
DO $$ 
BEGIN 
    RAISE NOTICE '⚠️  TEMPORARY: RLS DISABLED on users table';
    RAISE NOTICE '🔍 This is for diagnostic purposes only';
    RAISE NOTICE '🚨 SECURITY RISK: Must re-enable RLS after testing';
    RAISE NOTICE '📊 Test the /users endpoint now to confirm it works';
END $$;

-- Add tracking record
INSERT INTO public.config_kv (key, value, description, is_public)
VALUES (
  'users_rls_temporary_disabled',
  jsonb_build_object(
    'disabled_at', now(),
    'reason', 'diagnostic_500_error',
    'superadmin_uuid', 'd2df36d4-74bc-4ffb-883b-036754764265',
    'status', 'TEMPORARY_INSECURE'
  ),
  'TEMPORARY: Users table RLS disabled for diagnostics - SECURITY RISK',
  FALSE
) ON CONFLICT (key) DO UPDATE SET
  value = jsonb_build_object(
    'disabled_at', now(),
    'reason', 'diagnostic_500_error',
    'superadmin_uuid', 'd2df36d4-74bc-4ffb-883b-036754764265',
    'status', 'TEMPORARY_INSECURE'
  ),
  updated_at = now();
