-- Adjust teachers RLS policies to include DB role fallback (users table)
-- This avoids dependency on JWT 'role' claim being present

BEGIN;

-- Recreate SELECT policy with DB role fallback
DROP POLICY IF EXISTS teachers_read_access ON public.teachers;

CREATE POLICY teachers_read_access
ON public.teachers
FOR SELECT
USING (
  -- Admin/principal level (JWT-based)
  (
    (
      app_auth.has_role_level(3)
      OR lower(app_auth.role()) IN ('admin', 'superadmin')
    )
    AND preschool_id = coalesce(
      nullif(((current_setting('request.jwt.claims', TRUE)::jsonb) ->> 'preschool_id'), '')::uuid,
      nullif(((current_setting('request.jwt.claims', TRUE)::jsonb) ->> 'organization_id'), '')::uuid,
      app_auth.org_id()
    )
  )
  OR
  -- Admin/principal level (DB fallback via users)
  EXISTS (
    SELECT 1
    FROM public.users AS u
    WHERE
      (u.id = auth.uid() OR u.auth_user_id = auth.uid())
      AND coalesce(u.is_active, TRUE) IS TRUE
      AND lower(u.role) IN (
        'principal', 'principal_admin', 'admin', 'superadmin'
      )
      AND u.preschool_id IS NOT DISTINCT FROM public.teachers.preschool_id
  )
  OR
  -- Teachers in same preschool (JWT-based)
  (
    app_auth.is_teacher()
    AND preschool_id = coalesce(
      nullif(((current_setting('request.jwt.claims', TRUE)::jsonb) ->> 'preschool_id'), '')::uuid,
      nullif(((current_setting('request.jwt.claims', TRUE)::jsonb) ->> 'organization_id'), '')::uuid,
      app_auth.org_id()
    )
  )
  OR
  -- Teachers in same preschool (DB fallback via users)
  EXISTS (
    SELECT 1
    FROM public.users AS u2
    WHERE
      (u2.id = auth.uid() OR u2.auth_user_id = auth.uid())
      AND lower(u2.role) = 'teacher'
      AND u2.preschool_id IS NOT DISTINCT FROM public.teachers.preschool_id
  )
  OR
  -- Teacher self-access
  (
    user_id = app_auth.user_id()
    OR user_id = app_auth.public_user_id()
  )
);

-- Recreate INSERT policy with DB role fallback
DROP POLICY IF EXISTS teachers_insert_access ON public.teachers;

CREATE POLICY teachers_insert_access
ON public.teachers
FOR INSERT
WITH CHECK (
  -- Admin/principal level (JWT-based)
  (
    (
      app_auth.has_role_level(3)
      OR lower(app_auth.role()) IN ('admin', 'superadmin')
    )
    AND preschool_id = coalesce(
      nullif(((current_setting('request.jwt.claims', TRUE)::jsonb) ->> 'preschool_id'), '')::uuid,
      nullif(((current_setting('request.jwt.claims', TRUE)::jsonb) ->> 'organization_id'), '')::uuid,
      app_auth.org_id()
    )
  )
  OR
  -- Admin/principal level (DB fallback)
  EXISTS (
    SELECT 1
    FROM public.users AS u
    WHERE
      (u.id = auth.uid() OR u.auth_user_id = auth.uid())
      AND coalesce(u.is_active, TRUE) IS TRUE
      AND lower(u.role) IN (
        'principal', 'principal_admin', 'admin', 'superadmin'
      )
      AND u.preschool_id IS NOT DISTINCT FROM public.teachers.preschool_id
  )
  OR
  -- Teacher self-create within tenant
  (
    (
      app_auth.is_teacher()
      OR EXISTS (
        SELECT 1 FROM public.users AS ut
        WHERE
          (ut.id = auth.uid() OR ut.auth_user_id = auth.uid())
          AND lower(ut.role) = 'teacher'
      )
    )
    AND (
      user_id = app_auth.user_id() OR user_id = app_auth.public_user_id()
    )
    AND preschool_id = coalesce(
      nullif(((current_setting('request.jwt.claims', TRUE)::jsonb) ->> 'preschool_id'), '')::uuid,
      nullif(((current_setting('request.jwt.claims', TRUE)::jsonb) ->> 'organization_id'), '')::uuid,
      app_auth.org_id()
    )
  )
);

-- Recreate UPDATE policy with DB role fallback
DROP POLICY IF EXISTS teachers_update_access ON public.teachers;

CREATE POLICY teachers_update_access
ON public.teachers
FOR UPDATE
USING (
  -- Admin/principal level (JWT-based)
  (
    (
      app_auth.has_role_level(3)
      OR lower(app_auth.role()) IN ('admin', 'superadmin')
    )
    AND preschool_id = coalesce(
      nullif(((current_setting('request.jwt.claims', TRUE)::jsonb) ->> 'preschool_id'), '')::uuid,
      nullif(((current_setting('request.jwt.claims', TRUE)::jsonb) ->> 'organization_id'), '')::uuid,
      app_auth.org_id()
    )
  )
  OR
  -- Admin/principal level (DB fallback)
  EXISTS (
    SELECT 1
    FROM public.users AS u
    WHERE
      (u.id = auth.uid() OR u.auth_user_id = auth.uid())
      AND coalesce(u.is_active, TRUE) IS TRUE
      AND lower(u.role) IN (
        'principal', 'principal_admin', 'admin', 'superadmin'
      )
      AND u.preschool_id IS NOT DISTINCT FROM public.teachers.preschool_id
  )
  OR
  -- Teacher self-edit within tenant
  (
    (
      app_auth.is_teacher()
      OR EXISTS (
        SELECT 1 FROM public.users AS ut
        WHERE
          (ut.id = auth.uid() OR ut.auth_user_id = auth.uid())
          AND lower(ut.role) = 'teacher'
      )
    )
    AND (
      user_id = app_auth.user_id() OR user_id = app_auth.public_user_id()
    )
    AND preschool_id = coalesce(
      nullif(((current_setting('request.jwt.claims', TRUE)::jsonb) ->> 'preschool_id'), '')::uuid,
      nullif(((current_setting('request.jwt.claims', TRUE)::jsonb) ->> 'organization_id'), '')::uuid,
      app_auth.org_id()
    )
  )
)
WITH CHECK (
  -- Ensure resulting rows remain within tenant constraints
  preschool_id = coalesce(
    nullif(((current_setting('request.jwt.claims', TRUE)::jsonb) ->> 'preschool_id'), '')::uuid,
    nullif(((current_setting('request.jwt.claims', TRUE)::jsonb) ->> 'organization_id'), '')::uuid,
    app_auth.org_id()
  )
);

COMMIT;
