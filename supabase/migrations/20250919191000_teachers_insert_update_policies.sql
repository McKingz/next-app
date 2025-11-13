-- Teachers INSERT/UPDATE RLS policies to enable profile management
-- Principals/Admins/Superadmins: insert/update within their preschool
-- Teachers: insert self row (if missing) and update own profile
-- within preschool

BEGIN;

-- Ensure RLS is enabled (safe if already enabled)
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if present to avoid duplicates
DROP POLICY IF EXISTS teachers_insert_access ON public.teachers;
DROP POLICY IF EXISTS teachers_update_access ON public.teachers;

-- INSERT policy
CREATE POLICY teachers_insert_access
ON public.teachers
FOR INSERT
WITH CHECK (
  -- Admin/principal level can create teachers in their tenant
  (
    (
      app_auth.has_role_level(3)
      OR lower(app_auth.role()) IN ('admin', 'superadmin')
    )
    AND preschool_id = coalesce(
      nullif(
        (
          (current_setting('request.jwt.claims', TRUE)::jsonb)
        ) ->> 'preschool_id',
        ''
      )::uuid,
      nullif(
        (
          (current_setting('request.jwt.claims', TRUE)::jsonb)
        ) ->> 'organization_id',
        ''
      )::uuid,
      app_auth.org_id()
    )
  )
  OR
  -- Teachers may create their own teacher row (self) in their tenant
  (
    app_auth.is_teacher()
    AND (
      user_id = app_auth.user_id()
      OR user_id = app_auth.public_user_id()
    )
    AND preschool_id = coalesce(
      nullif(
        (
          (current_setting('request.jwt.claims', TRUE)::jsonb)
        ) ->> 'preschool_id',
        ''
      )::uuid,
      nullif(
        (
          (current_setting('request.jwt.claims', TRUE)::jsonb)
        ) ->> 'organization_id',
        ''
      )::uuid,
      app_auth.org_id()
    )
  )
);

-- UPDATE policy
CREATE POLICY teachers_update_access
ON public.teachers
FOR UPDATE
USING (
  -- Admin/principal level can edit teachers in their tenant
  (
    (
      app_auth.has_role_level(3)
      OR lower(app_auth.role()) IN ('admin', 'superadmin')
    )
    AND preschool_id = coalesce(
      nullif(
        (
          (current_setting('request.jwt.claims', TRUE)::jsonb)
        ) ->> 'preschool_id',
        ''
      )::uuid,
      nullif(
        (
          (current_setting('request.jwt.claims', TRUE)::jsonb)
        ) ->> 'organization_id',
        ''
      )::uuid,
      app_auth.org_id()
    )
  )
  OR
  -- Teachers may edit their own teacher row in their tenant
  (
    app_auth.is_teacher()
    AND (
      user_id = app_auth.user_id()
      OR user_id = app_auth.public_user_id()
    )
    AND preschool_id = coalesce(
      nullif(
        (
          (current_setting('request.jwt.claims', TRUE)::jsonb)
        ) ->> 'preschool_id',
        ''
      )::uuid,
      nullif(
        (
          (current_setting('request.jwt.claims', TRUE)::jsonb)
        ) ->> 'organization_id',
        ''
      )::uuid,
      app_auth.org_id()
    )
  )
)
WITH CHECK (
  -- Ensure updated rows remain within proper tenant and role constraints
  (
    (
      app_auth.has_role_level(3)
      OR lower(app_auth.role()) IN ('admin', 'superadmin')
    )
    AND preschool_id = coalesce(
      nullif(
        (
          (current_setting('request.jwt.claims', TRUE)::jsonb)
        ) ->> 'preschool_id',
        ''
      )::uuid,
      nullif(
        (
          (current_setting('request.jwt.claims', TRUE)::jsonb)
        ) ->> 'organization_id',
        ''
      )::uuid,
      app_auth.org_id()
    )
  )
  OR
  (
    app_auth.is_teacher()
    AND (
      user_id = app_auth.user_id()
      OR user_id = app_auth.public_user_id()
    )
    AND preschool_id = coalesce(
      nullif(
        (
          (current_setting('request.jwt.claims', TRUE)::jsonb)
        ) ->> 'preschool_id',
        ''
      )::uuid,
      nullif(
        (
          (current_setting('request.jwt.claims', TRUE)::jsonb)
        ) ->> 'organization_id',
        ''
      )::uuid,
      app_auth.org_id()
    )
  )
);

COMMIT;
