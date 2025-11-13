-- Harden activity_logs SELECT policies to prevent cross-tenant leakage
-- Date: 2025-10-27

BEGIN;

-- Remove permissive/legacy SELECT policies
DROP POLICY IF EXISTS activity_logs_simple_access ON public.activity_logs;
DROP POLICY IF EXISTS activity_logs_tenant_read ON public.activity_logs;
DROP POLICY IF EXISTS activity_logs_org_scoped_select ON public.activity_logs;

-- Recreate a single strict SELECT policy
CREATE POLICY activity_logs_org_scoped_select
ON public.activity_logs
FOR SELECT
TO authenticated
USING (
  public.is_super_admin() OR
  (organization_id IS NOT NULL AND organization_id = public.get_user_organization_id())
);

-- Optional cleanup: consolidate service role duplicates (keep canonical one)
DROP POLICY IF EXISTS activity_logs_service_access ON public.activity_logs;
DROP POLICY IF EXISTS activity_logs_service_role ON public.activity_logs;
-- Ensure canonical service bypass exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='activity_logs' AND policyname='service_role_full_access'
  ) THEN
    CREATE POLICY service_role_full_access ON public.activity_logs FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
  END IF;
END $$;

-- Refresh cache
NOTIFY pgrst, 'reload schema';

COMMIT;