-- Simple fixes for billing and organization structure
-- Date: 2025-09-19

-- Create billing_plans table if it doesn't exist
CREATE TABLE IF NOT EXISTS billing_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  price_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'ZAR',
  ai_monthly_credits integer NOT NULL DEFAULT 0,
  max_teachers integer NOT NULL DEFAULT 1,
  max_parents integer NOT NULL DEFAULT 10,
  max_students integer NOT NULL DEFAULT 20,
  ads_enabled boolean NOT NULL DEFAULT TRUE,
  features jsonb NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT TRUE,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on billing_plans
ALTER TABLE billing_plans ENABLE ROW LEVEL SECURITY;

-- Create public read policy for billing plans
CREATE POLICY billing_plans_public_read
ON billing_plans FOR SELECT
USING (active = TRUE);

-- Add organization_id to users table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE users ADD COLUMN organization_id uuid REFERENCES preschools(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_users_organization_id ON users(organization_id);
    RAISE NOTICE 'Added organization_id to users table';
  END IF;
END $$;

-- Add organization_id to profiles table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN organization_id uuid REFERENCES preschools(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON profiles(organization_id);
    RAISE NOTICE 'Added organization_id to profiles table';
  END IF;
END $$;

-- Update the current_preschool_id function
CREATE OR REPLACE FUNCTION current_preschool_id()
RETURNS uuid AS $$
BEGIN
  RETURN COALESCE(
    (auth.jwt() ->> 'preschool_id')::uuid,
    (auth.jwt() ->> 'organization_id')::uuid,
    (SELECT organization_id FROM users WHERE id = auth.uid() LIMIT 1)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create proper RLS policies with correct column references
DO $$
BEGIN
  -- Users policy
  BEGIN
    DROP POLICY IF EXISTS "users_tenant_isolation" ON users;
    CREATE POLICY "users_tenant_isolation" ON users FOR ALL
    USING (organization_id = current_preschool_id() OR id = auth.uid());
    RAISE NOTICE 'Created users tenant isolation policy';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Failed to create users policy: %', SQLERRM;
  END;

  -- Profiles policy
  BEGIN
    DROP POLICY IF EXISTS "profiles_org_access" ON profiles;
    CREATE POLICY "profiles_org_access" ON profiles FOR ALL
    USING (organization_id = current_preschool_id() OR user_id = auth.uid());
    RAISE NOTICE 'Created profiles organization access policy';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Failed to create profiles policy: %', SQLERRM;
  END;
END $$;

-- Insert default billing plans
INSERT INTO billing_plans (
  name,
  display_name,
  description,
  price_cents,
  ai_monthly_credits,
  max_teachers,
  max_parents,
  max_students,
  ads_enabled,
  features,
  sort_order
)
VALUES
(
  'free', 'Free', 'Get started with basic features', 0, 10, 1, 5, 10, TRUE,
  '{"basic_dashboard": true, "limited_ai": true}', 1
),
(
  'parent_starter', 'Parent Starter', 'Perfect for families', 4900, 50, 1, 10, 20, TRUE,
  '{"parent_portal": true, "homework_help": true}', 2
),
(
  'teacher_pro', 'Teacher Pro', 'Professional tools for educators', 9900, 200, 3, 30, 50, FALSE,
  '{"advanced_analytics": true, "lesson_planning": true}', 3
),
(
  'school_premium', 'School Premium', 'Complete institutional solution', 19900, 500, 10, 100, 200, FALSE,
  '{"multi_class": true, "admin_dashboard": true}', 4
)
ON CONFLICT (name) DO NOTHING;

-- Grant permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION current_preschool_id() TO authenticated, service_role;

SELECT 'Simple fixes applied successfully' AS status;
