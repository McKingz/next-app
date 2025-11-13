-- COMPLETE FIX FOR AUTHENTICATION ISSUES
-- Date: 2025-09-17
-- Purpose: Add missing capabilities column and fix user authentication
-- 
-- INSTRUCTIONS:
-- 1. Copy this entire SQL and run it in Supabase Dashboard > SQL Editor
-- 2. Deploy the ai-proxy function using: npx supabase functions deploy ai-proxy
-- 3. Test the app to verify authentication works
--
-- This addresses the error: column users.capabilities does not exist

BEGIN;

-- ============================================================================
-- PART 1: ENSURE CORE TABLES EXIST WITH REQUIRED COLUMNS
-- ============================================================================

-- Create profiles table if it doesn't exist (user profiles)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  first_name text,
  last_name text,
  avatar_url text,
  role text NOT NULL DEFAULT 'parent' CHECK (role IN ('super_admin', 'principal_admin', 'principal', 'teacher', 'parent')),
  preschool_id uuid,
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
        
        -- Also add missing columns to users table that might be needed
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'users' 
            AND column_name = 'seat_status'
        ) THEN
            ALTER TABLE users ADD COLUMN seat_status text DEFAULT 'active' CHECK (seat_status IN ('active', 'inactive', 'pending'));
        END IF;
        
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'users' 
            AND column_name = 'last_login_at'
        ) THEN
            ALTER TABLE users ADD COLUMN last_login_at timestamptz;
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
    SELECT COALESCE(preschool_id, organization_id::uuid)
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

DROP POLICY IF EXISTS profiles_insert_own ON profiles;
CREATE POLICY profiles_insert_own 
  ON profiles FOR INSERT 
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
            capabilities = CASE 
                WHEN profiles.capabilities IS NULL OR profiles.capabilities = '[]'::jsonb 
                THEN EXCLUDED.capabilities 
                ELSE profiles.capabilities 
            END,
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
    SET capabilities = update_user_capabilities.capabilities,
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
    )
    ON CONFLICT (id) DO NOTHING;
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

-- Create profiles for existing auth.users that don't have them
INSERT INTO profiles (id, email, role, capabilities)
SELECT 
    au.id,
    au.email,
    'parent',
    '["access_mobile_app", "view_child_progress", "communicate_with_teachers", "access_homework_help"]'::jsonb
FROM auth.users au
LEFT JOIN profiles p ON p.id = au.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- Update existing profiles to have capabilities if they don't
UPDATE profiles 
SET capabilities = CASE 
    WHEN LOWER(role) = 'super_admin' THEN 
        '["access_mobile_app", "view_all_organizations", "manage_organizations", "view_billing", "manage_subscriptions", "access_admin_tools"]'::jsonb
    WHEN LOWER(role) IN ('principal_admin', 'principal') THEN 
        '["access_mobile_app", "view_school_metrics", "manage_teachers", "manage_students", "access_principal_hub", "generate_reports"]'::jsonb
    WHEN LOWER(role) = 'teacher' THEN 
        '["access_mobile_app", "manage_classes", "create_assignments", "grade_assignments", "view_class_analytics"]'::jsonb
    ELSE 
        '["access_mobile_app", "view_child_progress", "communicate_with_teachers", "access_homework_help"]'::jsonb
END,
updated_at = now()
WHERE capabilities IS NULL OR capabilities = '[]'::jsonb;

-- Sync capabilities to users table if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
    ) THEN
        UPDATE users u
        SET capabilities = p.capabilities,
            seat_status = COALESCE(u.seat_status, 'active'),
            updated_at = now()
        FROM profiles p
        WHERE u.id = p.id
        AND (u.capabilities IS NULL OR u.capabilities = '[]'::jsonb);
    END IF;
END $$;

-- ============================================================================
-- PART 6: INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_preschool_id ON profiles(preschool_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_capabilities ON profiles USING GIN(capabilities);

-- ============================================================================
-- PART 7: PERMISSIONS
-- ============================================================================

-- Grant permissions to authenticated users
GRANT SELECT, UPDATE ON profiles TO authenticated;
GRANT INSERT ON profiles TO authenticated;
GRANT EXECUTE ON FUNCTION get_or_create_user_profile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_capabilities(uuid, text, text) TO authenticated;

-- Grant to service role for server operations
GRANT ALL ON profiles TO service_role;

-- ============================================================================
-- PART 8: LOG COMPLETION
-- ============================================================================

-- Log migration completion
DO $$
BEGIN
    -- Create config_kv table if it doesn't exist
    CREATE TABLE IF NOT EXISTS config_kv (
        key text PRIMARY KEY,
        value jsonb NOT NULL,
        description text,
        is_public boolean DEFAULT false,
        preschool_id uuid,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
    );

    INSERT INTO config_kv (key, value, description, is_public)
    VALUES (
        'migration_20250917_fix_authentication_complete',
        jsonb_build_object(
            'version', '1.0.0',
            'completed_at', now()::text,
            'capabilities_added', true,
            'profiles_created', (SELECT COUNT(*) FROM profiles),
            'profiles_updated', (SELECT COUNT(*) FROM profiles WHERE capabilities IS NOT NULL),
            'auth_fixed', true
        ),
        'Complete fix for missing capabilities column and authentication issues',
        false
    ) ON CONFLICT (key) DO UPDATE SET 
        value = EXCLUDED.value,
        updated_at = now();
END $$;

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES (Run these to verify the fix worked)
-- ============================================================================

-- Check profiles table structure
-- SELECT column_name, data_type, is_nullable, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'profiles' AND table_schema = 'public'
-- ORDER BY ordinal_position;

-- Check that all profiles have capabilities
-- SELECT COUNT(*) as total_profiles, 
--        COUNT(capabilities) as profiles_with_capabilities,
--        COUNT(*) - COUNT(capabilities) as missing_capabilities
-- FROM profiles;

-- Check sample capabilities
-- SELECT id, email, role, capabilities 
-- FROM profiles 
-- LIMIT 5;