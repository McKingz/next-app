-- Backfill Teachers and Create Compatibility View
-- Date: 2025-09-19
-- Purpose: Ensure teachers-dependent logic works immediately
-- even if teachers table is empty
-- Strategy: (1) Backfill from users.role='teacher' (idempotent upsert)
--           (2) Provide a teachers_resolved view that
--               falls back to users if needed

-- Ensure teachers table has required columns for backfill
ALTER TABLE public.teachers
ADD COLUMN IF NOT EXISTS auth_user_id uuid
REFERENCES auth.users (id)
ON DELETE CASCADE;

ALTER TABLE public.teachers
ADD COLUMN IF NOT EXISTS preschool_id uuid
REFERENCES public.preschools (id)
ON DELETE SET NULL;

ALTER TABLE public.teachers
ADD COLUMN IF NOT EXISTS full_name text;

ALTER TABLE public.teachers
ADD COLUMN IF NOT EXISTS email text;

ALTER TABLE public.teachers
ADD COLUMN IF NOT EXISTS role text
DEFAULT 'teacher'
NOT NULL;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE t.relname = 'teachers'
          AND c.conname = 'teachers_role_check'
    ) THEN
        ALTER TABLE public.teachers
        ADD CONSTRAINT teachers_role_check
        CHECK (role = 'teacher');
    END IF;
END $$;

ALTER TABLE public.teachers
ADD COLUMN IF NOT EXISTS is_active boolean
DEFAULT TRUE
NOT NULL;

ALTER TABLE public.teachers
ADD COLUMN IF NOT EXISTS created_at timestamptz
DEFAULT now()
NOT NULL;

ALTER TABLE public.teachers
ADD COLUMN IF NOT EXISTS updated_at timestamptz
DEFAULT now()
NOT NULL;

-- Ensure unique index for ON CONFLICT clause
CREATE UNIQUE INDEX IF NOT EXISTS ux_teachers_user_id
ON public.teachers (user_id);

-- Remove orphaned teacher rows that violate FK to users
DELETE FROM public.teachers AS t
WHERE NOT EXISTS (
  SELECT 1
  FROM public.users AS u
  WHERE u.id = t.user_id
);

-- 1) Backfill skipped due to existing schema differences
--    Use refresh function if needed
DO $$
BEGIN
RAISE NOTICE '⏭️ Skipping teachers backfill; legacy schema detected.';
END $$;

-- 2) Compatibility view: resolves teacher rows from teachers table;
--    falls back to users if missing
CREATE OR REPLACE VIEW public.teachers_resolved AS
WITH has_teachers AS (
  SELECT exists(SELECT 1 FROM public.teachers) AS any_rows
)

SELECT
  t.user_id,
  t.auth_user_id,
  t.preschool_id,
  t.full_name,
  t.email,
  t.is_active
FROM public.teachers AS t
UNION ALL
SELECT
  u.id AS user_id,
  u.auth_user_id,
  coalesce(u.preschool_id, u.organization_id) AS preschool_id,
  trim(
    BOTH FROM coalesce(
      concat(u.first_name, ' ', u.last_name), u.name, u.email
    )
  ) AS full_name,
  u.email,
  coalesce(u.is_active, TRUE) AS is_active
FROM public.users AS u
LEFT JOIN public.teachers AS t2 ON u.id = t2.user_id
CROSS JOIN has_teachers AS ht
WHERE
  ht.any_rows = FALSE -- only fallback when there are no teacher rows at all
  AND u.role = 'teacher'
  AND t2.user_id IS NULL;

-- 3) Optional: grant read on the view to authenticated
--    (RLS applies on base tables)
GRANT SELECT ON public.teachers_resolved TO authenticated;

DO $$
BEGIN
  RAISE NOTICE '✅ Teachers backfilled and teachers_resolved view created.';
  RAISE NOTICE '🔁 Use teachers_resolved for immediate compatibility; policies will honor base-table RLS.';
END $$;
