-- Backfill teachers from users (idempotent and safe)
-- Purpose: populate public.teachers from public.users where role = 'teacher'
-- Notes:
-- - Adapts to FK target at runtime:
--   - If teachers.user_id references auth.users(id), use users.auth_user_id
--   - If teachers.user_id references public.users(id), use users.id
-- - Coalesces preschool_id from users.preschool_id or users.organization_id
-- - Treats NULL users.is_active as TRUE (active)
-- - Only inserts rows that don't already exist (user_id unique semantics)
-- - Also backfills missing teacher fields from users where applicable

BEGIN;

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
        -- Case 1: teachers.user_id -> auth.users.id (use users.auth_user_id)
        INSERT INTO public.teachers (
            user_id,
            first_name,
            last_name,
            email,
            phone,
            preschool_id,
            is_active,
            subject_specialization,
            created_at,
            updated_at
        )
        SELECT
            u.auth_user_id AS user_id,
            u.first_name,
            u.last_name,
            u.email,
            u.phone,
            COALESCE(u.preschool_id, u.organization_id) AS preschool_id,
            COALESCE(u.is_active, TRUE) AS is_active,
            NULL::text AS subject_specialization,
            COALESCE(u.created_at, NOW()) AS created_at,
            NOW() AS updated_at
        FROM public.users AS u
        WHERE
            u.role = 'teacher'
            AND COALESCE(u.is_active, TRUE) IS TRUE
            AND u.auth_user_id IS NOT NULL
            AND NOT EXISTS (
                SELECT 1
                FROM public.teachers AS t
                WHERE
                    t.user_id = u.auth_user_id
            );

        -- Backfill missing teacher details for existing rows (join via auth_user_id)
        UPDATE public.teachers AS t
        SET
            preschool_id = COALESCE(t.preschool_id, u.preschool_id, u.organization_id),
            first_name = COALESCE(t.first_name, u.first_name),
            last_name = COALESCE(t.last_name, u.last_name),
            email = COALESCE(t.email, u.email),
            phone = COALESCE(t.phone, u.phone),
            is_active = COALESCE(t.is_active, COALESCE(u.is_active, TRUE)),
            updated_at = NOW()
        FROM public.users AS u
        WHERE
            u.auth_user_id = t.user_id
            AND (
                t.preschool_id IS NULL
                OR t.first_name IS NULL
                OR t.last_name IS NULL
                OR t.email IS NULL
                OR t.phone IS NULL
                OR t.is_active IS NULL
            );
    ELSE
        -- Case 2 (default): teachers.user_id -> public.users.id (use users.id)
        INSERT INTO public.teachers (
            user_id,
            first_name,
            last_name,
            email,
            phone,
            preschool_id,
            is_active,
            subject_specialization,
            created_at,
            updated_at
        )
        SELECT
            u.id AS user_id,
            u.first_name,
            u.last_name,
            u.email,
            u.phone,
            COALESCE(u.preschool_id, u.organization_id) AS preschool_id,
            COALESCE(u.is_active, TRUE) AS is_active,
            NULL::text AS subject_specialization,
            COALESCE(u.created_at, NOW()) AS created_at,
            NOW() AS updated_at
        FROM public.users AS u
        WHERE
            u.role = 'teacher'
            AND COALESCE(u.is_active, TRUE) IS TRUE
            AND NOT EXISTS (
                SELECT 1
                FROM public.teachers AS t
                WHERE
                    t.user_id = u.id
            );

        -- Backfill missing teacher details for existing rows (join via users.id)
        UPDATE public.teachers AS t
        SET
            preschool_id = COALESCE(t.preschool_id, u.preschool_id, u.organization_id),
            first_name = COALESCE(t.first_name, u.first_name),
            last_name = COALESCE(t.last_name, u.last_name),
            email = COALESCE(t.email, u.email),
            phone = COALESCE(t.phone, u.phone),
            is_active = COALESCE(t.is_active, COALESCE(u.is_active, TRUE)),
            updated_at = NOW()
        FROM public.users AS u
        WHERE
            u.id = t.user_id
            AND (
                t.preschool_id IS NULL
                OR t.first_name IS NULL
                OR t.last_name IS NULL
                OR t.email IS NULL
                OR t.phone IS NULL
                OR t.is_active IS NULL
            );
    END IF;
END
$$;

COMMIT;
