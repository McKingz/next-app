-- =============================================================
-- 2025-10-07: Fix organizations RLS (clean set) and ensure columns
-- Context: Client inserts organizations with { name, type, phone, status, created_by }
-- Problem: Legacy policy "organizations_member_access" required id = current_org,
--          blocking INSERT because new id ≠ current org id.
-- Actions:
--  - Ensure columns created_by/type/status exist (idempotent)
--  - Drop legacy conflicting policy
--  - Recreate clean, minimal per-command RLS policies
-- =============================================================

BEGIN;

-- Ensure required columns exist on organizations
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS type text,
  ADD COLUMN IF NOT EXISTS status text;

-- Add FK for created_by -> profiles(id) if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'organizations_created_by_fkey'
      AND table_name = 'organizations'
      AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.organizations
      ADD CONSTRAINT organizations_created_by_fkey
      FOREIGN KEY (created_by)
      REFERENCES public.profiles(id)
      ON UPDATE CASCADE
      ON DELETE SET NULL;
  END IF;
END$$;

-- Enable RLS (idempotent)
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Drop conflicting legacy policy from earlier migration
DROP POLICY IF EXISTS organizations_member_access ON public.organizations;

-- Drop previous versions of the new policies (if any) to avoid duplicates
DROP POLICY IF EXISTS organizations_select_self_or_superadmin ON public.organizations;
DROP POLICY IF EXISTS organizations_insert_own ON public.organizations;
DROP POLICY IF EXISTS organizations_update_admins ON public.organizations;
DROP POLICY IF EXISTS organizations_delete_superadmin ON public.organizations;
DROP POLICY IF EXISTS organizations_service_role_full ON public.organizations;

-- Read: user can read their org; superadmin can read all
CREATE POLICY organizations_select_self_or_superadmin
ON public.organizations
FOR SELECT
TO authenticated
USING (
  app_auth.is_superadmin() OR app_auth.has_org_access(id)
);

-- Insert: allow creating an org only if user sets created_by = auth.uid()
CREATE POLICY organizations_insert_own
ON public.organizations
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
);

-- Update: principals can manage their org; superadmin full access
CREATE POLICY organizations_update_admins
ON public.organizations
FOR UPDATE
TO authenticated
USING (
  app_auth.is_superadmin() OR (app_auth.is_principal() AND app_auth.has_org_access(id))
)
WITH CHECK (
  app_auth.is_superadmin() OR (app_auth.is_principal() AND app_auth.has_org_access(id))
);

-- Delete: restrict to superadmin
CREATE POLICY organizations_delete_superadmin
ON public.organizations
FOR DELETE
TO authenticated
USING (app_auth.is_superadmin());

-- Service role: full access
CREATE POLICY organizations_service_role_full
ON public.organizations
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

COMMIT;