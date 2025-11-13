-- =============================================
-- activity_logs RLS tightening for tenant isolation
-- Date: 2025-10-27
-- Purpose: Remove permissive debug/select policies and enforce strict org/user scoping
-- =============================================

BEGIN;

-- Ensure RLS is enabled
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Drop overly permissive/temporary policies if they exist
DROP POLICY IF EXISTS temp_anon_debug_access ON public.activity_logs;
DROP POLICY IF EXISTS authenticated_read_access ON public.activity_logs;

-- Strict SELECT policy: allow
-- - super admins, OR
-- - users reading logs from their own organization, OR
-- - users reading their own user-scoped logs
CREATE POLICY activity_logs_org_scoped_select
ON public.activity_logs
FOR SELECT
TO authenticated
USING (
  public.is_super_admin() OR
  (organization_id IS NOT NULL AND organization_id = public.get_user_organization_id()) OR
  (user_id IS NOT NULL AND user_id = auth.uid())
);

-- Optional: keep service role bypass if not already present (idempotent behavior)
-- This ensures backend/service functions aren’t blocked by RLS
DROP POLICY IF EXISTS service_role_full_access ON public.activity_logs;
CREATE POLICY service_role_full_access
ON public.activity_logs
FOR ALL
TO service_role
USING (TRUE)
WITH CHECK (TRUE);

-- Verify policies
SELECT
  'activity_logs policies after update' AS info,
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'activity_logs'
ORDER BY policyname;

-- Reload PostgREST cache
NOTIFY pgrst, 'reload schema';

COMMIT;
