-- 2025-10-08: RLS policies for school_invitation_codes
-- Purpose: allow principals in a school to create and manage invitation codes
-- Notes:
--  - Uses current_preschool_id() which reads from JWT claims and falls back to users/profiles
--  - Includes a profiles fallback in policies for extra robustness
--  - Keeps superadmin bypass via app_auth.is_superadmin()

BEGIN;

-- Ensure RLS is enabled
ALTER TABLE IF EXISTS public.school_invitation_codes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid duplicates
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'school_invitation_codes' 
      AND policyname = 'school_invite_codes_select_same_school'
  ) THEN
    DROP POLICY "school_invite_codes_select_same_school" ON public.school_invitation_codes;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'school_invitation_codes' 
      AND policyname = 'school_invite_codes_insert_by_principal'
  ) THEN
    DROP POLICY "school_invite_codes_insert_by_principal" ON public.school_invitation_codes;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'school_invitation_codes' 
      AND policyname = 'school_invite_codes_update_by_principal'
  ) THEN
    DROP POLICY "school_invite_codes_update_by_principal" ON public.school_invitation_codes;
  END IF;
END$$;

-- Shared check expression: same preschool as current user
-- Uses COALESCE(current_preschool_id(), profiles fallback) to be resilient when JWT claims are missing
CREATE POLICY "school_invite_codes_select_same_school"
ON public.school_invitation_codes FOR SELECT TO authenticated
USING (
  app_auth.is_superadmin() OR 
  preschool_id = COALESCE(
    current_preschool_id(),
    (SELECT p.preschool_id FROM public.profiles p WHERE p.id = auth.uid())
  )
);

CREATE POLICY "school_invite_codes_insert_by_principal"
ON public.school_invitation_codes FOR INSERT TO authenticated
WITH CHECK (
  app_auth.is_superadmin() OR (
    (
      preschool_id = COALESCE(
        current_preschool_id(),
        (SELECT p.preschool_id FROM public.profiles p WHERE p.id = auth.uid())
      )
    )
    AND current_user_role() IN ('principal','principal_admin','admin')
  )
);

CREATE POLICY "school_invite_codes_update_by_principal"
ON public.school_invitation_codes FOR UPDATE TO authenticated
USING (
  app_auth.is_superadmin() OR (
    preschool_id = COALESCE(
      current_preschool_id(),
      (SELECT p.preschool_id FROM public.profiles p WHERE p.id = auth.uid())
    )
    AND current_user_role() IN ('principal','principal_admin','admin')
  )
)
WITH CHECK (
  app_auth.is_superadmin() OR (
    preschool_id = COALESCE(
      current_preschool_id(),
      (SELECT p.preschool_id FROM public.profiles p WHERE p.id = auth.uid())
    )
    AND current_user_role() IN ('principal','principal_admin','admin')
  )
);

-- Grant basic privileges to authenticated users (RLS still governs access)
GRANT SELECT, INSERT, UPDATE ON public.school_invitation_codes TO authenticated;

COMMIT;