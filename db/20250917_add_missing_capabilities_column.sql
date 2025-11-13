-- Add missing capabilities column and fix authentication issues
-- Date: 2025-09-17
-- WARP.md Compliance: Forward-only migration, production-safe

BEGIN;

-- ============================================================================
-- PART 1: ENSURE CORE TABLES EXIST WITH REQUIRED COLUMNS
-- ============================================================================

-- Create profiles table if it doesn't exist (user profiles)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email text,
  first_name text,
  last_name text,
  avatar_url text,
  role text NOT NULL DEFAULT 'parent' CHECK (
    role IN ('super_admin', 'principal_admin', 'principal', 'teacher', 'parent')
  ),
  preschool_id uuid REFERENCES preschools (id) ON DELETE SET NULL,
  capabilities jsonb DEFAULT '[]'::jsonb,
  seat_status text DEFAULT 'active' CHECK (seat_status IN ('active', 'inactive', 'pending')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_login_at timestamptz
);

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

-- ============================================================================
-- PART 2: ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on profiles table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Helper functions for RLS policies
CREATE OR REPLACE FUNCTION get_user_preschool_id(user_id uuid)
RETURNS uuid AS $$
BEGIN
  RETURN (
    SELECT preschool_id 
    FROM profiles 
    WHERE id = user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_super_admin(user_id uuid DEFAULT auth.uid())
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM profiles 
    WHERE id = user_id 
    AND role = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Profiles table policies
DROP POLICY IF EXISTS profiles_own_profile ON profiles;
CREATE POLICY profiles_own_profile
ON profiles FOR SELECT
USING (id = auth.uid());

DROP POLICY IF EXISTS profiles_same_preschool ON profiles;
CREATE POLICY profiles_same_preschool
ON profiles FOR SELECT
USING (
  preschool_id = get_user_preschool_id(auth.uid())
  AND preschool_id IS NOT NULL
);

DROP POLICY IF EXISTS profiles_super_admin_access ON profiles;
CREATE POLICY profiles_super_admin_access
ON profiles FOR ALL
USING (is_super_admin());

DROP POLICY IF EXISTS profiles_update_own ON profiles;
CREATE POLICY profiles_update_own
ON profiles FOR UPDATE
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- ============================================================================
-- PART 3: ESSENTIAL FUNCTIONS FOR USER MANAGEMENT
-- ============================================================================

-- Function to get or create user profile
CREATE OR REPLACE FUNCTION get_or_create_user_profile(user_id uuid)
RETURNS jsonb AS $$
DECLARE
    profile_data jsonb;
    user_email text;
BEGIN
    -- Try to get existing profile
    SELECT to_jsonb(p.*) INTO profile_data
    FROM profiles p
    WHERE p.id = user_id;
    
    -- If no profile exists, create one
    IF profile_data IS NULL THEN
        -- Get email from auth.users
        SELECT email INTO user_email
        FROM auth.users
        WHERE id = user_id;
        
        -- Insert new profile with default values
        INSERT INTO profiles (
            id, 
            email, 
            role, 
            capabilities,
            seat_status,
            created_at,
            updated_at
        ) VALUES (
            user_id,
            COALESCE(user_email, ''),
            'parent',
            '["access_mobile_app", "view_child_progress", "communicate_with_teachers", "access_homework_help"]'::jsonb,
            'active',
            now(),
            now()
        )
        ON CONFLICT (id) DO UPDATE SET
            email = COALESCE(EXCLUDED.email, profiles.email),
            updated_at = now();
            
        -- Get the newly created/updated profile
        SELECT to_jsonb(p.*) INTO profile_data
        FROM profiles p
        WHERE p.id = user_id;
    END IF;
    
    RETURN profile_data;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update user capabilities based on role
CREATE OR REPLACE FUNCTION update_user_capabilities(
  user_id uuid,
  user_role text DEFAULT NULL,
  plan_tier text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
    capabilities jsonb;
BEGIN
    -- Determine role
    IF user_role IS NULL THEN
        SELECT role INTO user_role
        FROM profiles
        WHERE id = user_id;
    END IF;
    
    -- Set base capabilities based on role
    CASE LOWER(COALESCE(user_role, 'parent'))
        WHEN 'super_admin' THEN
            capabilities := '["access_mobile_app", "view_all_organizations", "manage_organizations", "view_billing", "manage_subscriptions", "access_admin_tools"]'::jsonb;
        WHEN 'principal_admin', 'principal' THEN
            capabilities := '["access_mobile_app", "view_school_metrics", "manage_teachers", "manage_students", "access_principal_hub", "generate_reports"]'::jsonb;
        WHEN 'teacher' THEN
            capabilities := '["access_mobile_app", "manage_classes", "create_assignments", "grade_assignments", "view_class_analytics"]'::jsonb;
        ELSE
            capabilities := '["access_mobile_app", "view_child_progress", "communicate_with_teachers", "access_homework_help"]'::jsonb;
    END CASE;
    
    -- Add tier-specific capabilities
    IF plan_tier IN ('premium', 'enterprise') THEN
        capabilities := capabilities || '["ai_lesson_generation", "advanced_analytics"]'::jsonb;
    END IF;
    
    IF plan_tier = 'enterprise' THEN
        capabilities := capabilities || '["ai_grading_assistance", "bulk_operations", "custom_reports", "sso_access", "priority_support"]'::jsonb;
    END IF;
    
    -- Update the user's capabilities
    UPDATE profiles
    SET capabilities = capabilities,
        updated_at = now()
    WHERE id = user_id;
    
    RETURN capabilities;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PART 4: TRIGGER TO AUTO-CREATE PROFILES
-- ============================================================================

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO profiles (id, email, role, capabilities)
    VALUES (
        NEW.id,
        NEW.email,
        'parent',
        '["access_mobile_app", "view_child_progress", "communicate_with_teachers", "access_homework_help"]'::jsonb
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create profile on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- PART 5: DATA MIGRATION - UPDATE EXISTING PROFILES
-- ============================================================================

-- Update existing profiles to have capabilities if they don't
UPDATE profiles
SET
  capabilities = CASE
    WHEN lower(role) = 'super_admin'
      THEN
        '["access_mobile_app", "view_all_organizations", "manage_organizations", "view_billing", "manage_subscriptions", "access_admin_tools"]'::jsonb
    WHEN lower(role) IN ('principal_admin', 'principal')
      THEN
        '["access_mobile_app", "view_school_metrics", "manage_teachers", "manage_students", "access_principal_hub", "generate_reports"]'::jsonb
    WHEN lower(role) = 'teacher'
      THEN
        '["access_mobile_app", "manage_classes", "create_assignments", "grade_assignments", "view_class_analytics"]'::jsonb
    ELSE
      '["access_mobile_app", "view_child_progress", "communicate_with_teachers", "access_homework_help"]'::jsonb
  END,
  updated_at = now()
WHERE capabilities IS NULL OR capabilities = '[]'::jsonb;

-- ============================================================================
-- PART 6: INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles (role);
CREATE INDEX IF NOT EXISTS idx_profiles_preschool_id ON profiles (preschool_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles (email);

-- ============================================================================
-- PART 7: PERMISSIONS
-- ============================================================================

-- Grant permissions to authenticated users
GRANT SELECT, UPDATE ON profiles TO authenticated;
GRANT EXECUTE ON FUNCTION get_or_create_user_profile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_capabilities(uuid, text, text) TO authenticated;

-- ============================================================================
-- PART 8: LOG COMPLETION
-- ============================================================================

-- Log migration completion in config_kv if table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'config_kv') THEN
        INSERT INTO config_kv (key, value, description, is_public)
        VALUES (
            'migration_20250917_add_missing_capabilities',
            jsonb_build_object(
                'version', '1.0.0',
                'completed_at', now()::text,
                'capabilities_added', true,
                'profiles_updated', (SELECT COUNT(*) FROM profiles WHERE capabilities IS NOT NULL)
            ),
            'Migration to add missing capabilities column and fix authentication',
            false
        ) ON CONFLICT (key) DO UPDATE SET 
            value = EXCLUDED.value,
            updated_at = now();
    END IF;
END $$;

COMMIT;
