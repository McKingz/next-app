-- =============================================================
-- 2025-10-07: Ensure org creation works for principals (clean insert policy)
-- Drops any leftover conflicting policies and adds a permissive INSERT policy
-- =============================================================

BEGIN;

-- Make sure RLS is enabled
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Drop potentially conflicting legacy policies
DROP POLICY IF EXISTS organizations_member_access ON public.organizations;
DROP POLICY IF EXISTS organizations_rls_write ON public.organizations;
DROP POLICY IF EXISTS organizations_rls_read ON public.organizations;

-- Add permissive INSERT policy for principals and superadmins
CREATE POLICY organizations_insert_principal
ON public.organizations
FOR INSERT
TO authenticated
WITH CHECK (
  app_auth.is_superadmin() OR app_auth.is_principal()
);

COMMIT;