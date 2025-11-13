-- Create Teachers Dimension and Sync Functions
-- Date: 2025-09-19
-- Purpose: Maintain a first-class teachers table
-- populated from users where role = 'teacher'
-- Compliance: WARP.md (migrations only, RLS enabled,
-- tenant isolation, least privilege)

-- 1) Table: teachers
CREATE TABLE IF NOT EXISTS public.teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.users (id) ON DELETE CASCADE,
  auth_user_id uuid REFERENCES auth.users (id) ON DELETE CASCADE,
  preschool_id uuid REFERENCES public.preschools (id) ON DELETE SET NULL,
  full_name text,
  email text,
  role text NOT NULL DEFAULT 'teacher' CHECK (role = 'teacher'),
  is_active boolean NOT NULL DEFAULT TRUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2) Updated-at trigger (reuse if helper exists)
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS handle_updated_at_teachers ON public.teachers;
CREATE TRIGGER handle_updated_at_teachers
BEFORE UPDATE ON public.teachers
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 3) Sync trigger function: users → teachers
CREATE OR REPLACE FUNCTION public.sync_teacher_from_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_preschool_id uuid;
  v_full_name text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Remove teacher row when user is deleted
    DELETE FROM public.teachers WHERE user_id = OLD.id;
    RETURN OLD;
  END IF;

  -- Compute tenant and display name from NEW
  v_preschool_id := COALESCE(NEW.preschool_id, NEW.organization_id);
  v_full_name := TRIM(BOTH FROM COALESCE(CONCAT(NEW.first_name, ' ', NEW.last_name), NEW.name, NEW.email));

  IF TG_OP = 'INSERT' THEN
    IF NEW.role = 'teacher' THEN
      INSERT INTO public.teachers (user_id, auth_user_id, preschool_id, full_name, email, role, is_active, created_at, updated_at)
      VALUES (NEW.id, NEW.auth_user_id, v_preschool_id, v_full_name, NEW.email, 'teacher', COALESCE(NEW.is_active, true), now(), now())
      ON CONFLICT (user_id) DO UPDATE SET
        auth_user_id = EXCLUDED.auth_user_id,
        preschool_id = EXCLUDED.preschool_id,
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        is_active = EXCLUDED.is_active,
        updated_at = now();
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.role = 'teacher' THEN
      INSERT INTO public.teachers (user_id, auth_user_id, preschool_id, full_name, email, role, is_active, created_at, updated_at)
      VALUES (NEW.id, NEW.auth_user_id, v_preschool_id, v_full_name, NEW.email, 'teacher', COALESCE(NEW.is_active, true), now(), now())
      ON CONFLICT (user_id) DO UPDATE SET
        auth_user_id = EXCLUDED.auth_user_id,
        preschool_id = EXCLUDED.preschool_id,
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        is_active = EXCLUDED.is_active,
        updated_at = now();
    ELSE
      -- Role changed away from teacher –
      DELETE FROM public.teachers WHERE user_id = NEW.id;
    END IF;
    RETURN NEW;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 4) Triggers on users to keep teachers in sync
DROP TRIGGER IF EXISTS trg_sync_teacher_from_user_ins ON public.users;
CREATE TRIGGER trg_sync_teacher_from_user_ins
AFTER INSERT ON public.users
FOR EACH ROW EXECUTE FUNCTION public.sync_teacher_from_user();

DROP TRIGGER IF EXISTS trg_sync_teacher_from_user_upd ON public.users;
CREATE TRIGGER trg_sync_teacher_from_user_upd
AFTER UPDATE OF role,
organization_id,
preschool_id,
is_active,
email,
name,
first_name,
last_name ON public.users
FOR EACH ROW EXECUTE FUNCTION public.sync_teacher_from_user();

DROP TRIGGER IF EXISTS trg_sync_teacher_from_user_del ON public.users;
CREATE TRIGGER trg_sync_teacher_from_user_del
AFTER DELETE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.sync_teacher_from_user();

-- 5) Bulk refresh function to (re)populate teachers from users
CREATE OR REPLACE FUNCTION public.refresh_teachers_dimension()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  upserted integer := 0;
BEGIN
  -- Upsert all current teachers from users
  WITH up AS (
    INSERT INTO public.teachers (user_id, auth_user_id, preschool_id, full_name, email, role, is_active, created_at, updated_at)
    SELECT u.id, u.auth_user_id, COALESCE(u.preschool_id, u.organization_id) AS preschool_id,
           TRIM(BOTH FROM COALESCE(CONCAT(u.first_name, ' ', u.last_name), u.name, u.email)) AS full_name,
           u.email, 'teacher', COALESCE(u.is_active, true), now(), now()
    FROM public.users u
    WHERE u.role = 'teacher'
    ON CONFLICT (user_id) DO UPDATE SET
      auth_user_id = EXCLUDED.auth_user_id,
      preschool_id = EXCLUDED.preschool_id,
      full_name = EXCLUDED.full_name,
      email = EXCLUDED.email,
      is_active = EXCLUDED.is_active,
      updated_at = now()
    RETURNING 1
  )
  SELECT COUNT(*) INTO upserted FROM up;

  -- Remove stale teacher rows where user no longer a teacher
  DELETE FROM public.teachers t
  WHERE NOT EXISTS (
    SELECT 1 FROM public.users u WHERE u.id = t.user_id AND u.role = 'teacher'
  );

  RETURN upserted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_teachers_dimension() TO authenticated;

-- 6) Indexes
CREATE INDEX IF NOT EXISTS idx_teachers_preschool_id ON public.teachers (
  preschool_id
);
CREATE INDEX IF NOT EXISTS idx_teachers_user_id ON public.teachers (user_id);

-- 7) Enable RLS and add safe policies using app_auth helpers
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;

-- Read: superadmin OR same-tenant OR self
DROP POLICY IF EXISTS teachers_rls_read ON public.teachers;
CREATE POLICY teachers_rls_read
ON public.teachers
FOR SELECT
TO authenticated
USING (
  app_auth.is_superadmin()
  OR (preschool_id IS NOT DISTINCT FROM app_auth.current_user_org_id())
  OR user_id IS NOT DISTINCT FROM app_auth.current_user_id()
);

-- Write: superadmin OR principal in same tenant with capability
DROP POLICY IF EXISTS teachers_rls_write ON public.teachers;
CREATE POLICY teachers_rls_write
ON public.teachers
FOR ALL
TO authenticated
USING (
  app_auth.is_superadmin()
  OR (
    preschool_id IS NOT DISTINCT FROM app_auth.current_user_org_id()
    AND app_auth.is_principal()
    AND app_auth.has_cap('manage_teachers')
  )
)
WITH CHECK (
  app_auth.is_superadmin()
  OR (
    preschool_id IS NOT DISTINCT FROM app_auth.current_user_org_id()
    AND app_auth.is_principal()
    AND app_auth.has_cap('manage_teachers')
  )
);

-- 8) Completion notice
DO $$
BEGIN
  RAISE NOTICE '✅ Teachers dimension created and synchronized with users.role = teacher';
  RAISE NOTICE '🔒 RLS enabled with tenant isolation and role-aware write policies';
  RAISE NOTICE '🔁 Triggers installed: users → teachers (insert/update/delete)';
  RAISE NOTICE '🧰 Use SELECT public.refresh_teachers_dimension() to (re)populate existing data';
END $$;
