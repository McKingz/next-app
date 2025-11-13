-- Add missing capabilities column to fix authentication issues
-- Date: 2025-09-17
-- WARP.md Compliance: Forward-only migration, production-safe

BEGIN;

-- Add capabilities column to profiles if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'profiles' 
        AND column_name = 'capabilities'
    ) THEN
        ALTER TABLE profiles ADD COLUMN capabilities jsonb DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- Add capabilities column to users table if it exists (for backward compatibility)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'users' 
            AND column_name = 'capabilities'
        ) THEN
            ALTER TABLE users ADD COLUMN capabilities jsonb DEFAULT '[]'::jsonb;
        END IF;
    END IF;
END $$;

-- Update existing profiles to have capabilities if they don't
UPDATE profiles
SET
  capabilities = CASE
    WHEN LOWER(role) = 'super_admin'
      THEN
        '["access_mobile_app", "view_all_organizations", "manage_organizations", "view_billing", "manage_subscriptions", "access_admin_tools"]'::jsonb
    WHEN LOWER(role) IN ('principal_admin', 'principal')
      THEN
        '["access_mobile_app", "view_school_metrics", "manage_teachers", "manage_students", "access_principal_hub", "generate_reports"]'::jsonb
    WHEN LOWER(role) = 'teacher'
      THEN
        '["access_mobile_app", "manage_classes", "create_assignments", "grade_assignments", "view_class_analytics"]'::jsonb
    ELSE
      '["access_mobile_app", "view_child_progress", "communicate_with_teachers", "access_homework_help"]'::jsonb
  END,
  updated_at = NOW()
WHERE capabilities IS NULL OR capabilities = '[]'::jsonb;

COMMIT;
