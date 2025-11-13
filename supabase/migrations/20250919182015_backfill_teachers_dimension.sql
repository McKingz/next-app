-- ============================================
-- Backfill teachers dimension from users (role='teacher')
-- Adapts to FK target (public.users vs auth.users) via pg_catalog detection
-- ============================================
-- Generated: 2025-09-19T18:20:15Z

-- Ensure unique index on teachers.user_id for idempotency
CREATE UNIQUE INDEX IF NOT EXISTS ux_teachers_user_id
ON public.teachers (user_id);

-- Adaptive backfill based on FK target
DO $$
DECLARE
    ref_schema text;
    ref_table  text;
BEGIN
    -- Detect the referenced table for teachers_user_id_fkey
    SELECT ns.nspname AS schema_name, r.relname AS table_name
    INTO ref_schema, ref_table
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace tn ON t.relnamespace = tn.oid
    JOIN pg_class r ON c.confrelid = r.oid
    JOIN pg_namespace ns ON r.relnamespace = ns.oid
    WHERE tn.nspname = 'public'
      AND t.relname = 'teachers'
      AND c.conname = 'teachers_user_id_fkey'
    LIMIT 1;

    IF ref_schema = 'auth' AND ref_table = 'users' THEN
        -- Case: teachers.user_id -> auth.users(id); use users.auth_user_id
        INSERT INTO public.teachers (
            user_id,
            preschool_id,
            email,
            first_name,
            last_name,
            is_active,
            created_at,
            updated_at
        )
        SELECT
            u.auth_user_id::uuid AS user_id,
            COALESCE(u.preschool_id, u.organization_id) AS preschool_id,
            u.email,
            COALESCE(u.first_name, split_part(u.name, ' ', 1)) AS first_name,
            NULLIF(btrim(substring(u.name FROM position(' ' IN u.name) + 1)), '') AS last_name,
            COALESCE(u.is_active, TRUE) AS is_active,
            NOW(),
            NOW()
        FROM public.users AS u
        LEFT JOIN public.teachers AS t
            ON t.user_id = u.auth_user_id::uuid
        WHERE u.role = 'teacher'
            AND COALESCE(u.is_active, TRUE) IS TRUE
            AND u.auth_user_id IS NOT NULL
            AND t.user_id IS NULL;
    ELSE
        -- Default: teachers.user_id -> public.users(id); use users.id
        INSERT INTO public.teachers (
            user_id,
            preschool_id,
            email,
            first_name,
            last_name,
            is_active,
            created_at,
            updated_at
        )
        SELECT
            u.id AS user_id,
            COALESCE(u.preschool_id, u.organization_id) AS preschool_id,
            u.email,
            COALESCE(u.first_name, split_part(u.name, ' ', 1)) AS first_name,
            NULLIF(btrim(substring(u.name FROM position(' ' IN u.name) + 1)), '') AS last_name,
            COALESCE(u.is_active, TRUE) AS is_active,
            NOW(),
            NOW()
        FROM public.users AS u
        LEFT JOIN public.teachers AS t
            ON t.user_id = u.id
        WHERE u.role = 'teacher'
            AND COALESCE(u.is_active, TRUE) IS TRUE
            AND t.user_id IS NULL;
    END IF;
END $$;

-- Completion notice
DO $$
BEGIN
    RAISE NOTICE '✅ Backfill of teachers dimension complete';
END $$;
