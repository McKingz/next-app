-- Teachers RLS policies: enable visibility across same preschool for teachers,
-- and tenant-scoped read for principals/admins/superadmins.
-- Also includes teacher self-access regardless of FK variant.

BEGIN;

-- Ensure RLS is enabled on teachers
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;

-- Drop existing SELECT policy if present to avoid duplicates
DROP POLICY IF EXISTS teachers_read_access ON public.teachers;

-- Helper function: map auth.users.id (JWT sub) -> public.users.id
-- Used when teachers.user_id references public.users(id)
CREATE SCHEMA IF NOT EXISTS app_auth;

CREATE OR REPLACE FUNCTION app_auth.public_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT u.id
  FROM public.users u
  WHERE u.auth_user_id = app_auth.user_id()
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION app_auth.public_user_id() TO authenticated;

-- SELECT policy
-- Allows:
-- 1) Principals/Admins/Superadmins to read teachers in their tenant (preschool)
-- 2) Teachers to read all teachers in their own preschool for communication
-- 3) Teacher self-access (both FK variants)
CREATE POLICY teachers_read_access
ON public.teachers
FOR SELECT
USING (
  -- Tenant-scoped access for principal-level and above (role level >= 3)
  (
    (
      app_auth.has_role_level(3)
      OR lower(app_auth.role()) IN ('admin', 'superadmin')
    )
    AND preschool_id = coalesce(
      nullif(
        (
          (
            current_setting('request.jwt.claims', TRUE)::jsonb
          ) ->> 'preschool_id'
        ),
        ''
      )::uuid,
      nullif(
        (
          (
            current_setting('request.jwt.claims', TRUE)::jsonb
          ) ->> 'organization_id'
        ),
        ''
      )::uuid,
      app_auth.org_id()
    )
  )
  OR
  -- Teachers can see each other within the same preschool
  (
    app_auth.is_teacher()
    AND preschool_id = coalesce(
      nullif(
        (
          (
            current_setting('request.jwt.claims', TRUE)::jsonb
          ) ->> 'preschool_id'
        ),
        ''
      )::uuid,
      nullif(
        (
          (
            current_setting('request.jwt.claims', TRUE)::jsonb
          ) ->> 'organization_id'
        ),
        ''
      )::uuid,
      app_auth.org_id()
    )
  )
  OR
  -- Teacher self-access, regardless of FK target table
  (
    user_id = app_auth.user_id()
    OR user_id = app_auth.public_user_id()
  )
);

COMMIT;
