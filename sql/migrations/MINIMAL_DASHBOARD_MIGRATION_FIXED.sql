-- MINIMAL CORE BUSINESS TABLES MIGRATION (FIXED)
-- Execute this in Supabase Dashboard > SQL Editor
-- Purpose: Add essential business tables without conflicts
-- Date: 2025-09-17

-- First, let's check what tables already exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('preschools', 'users', 'classes', 'subscriptions')
ORDER BY table_name;

-- Only create base tables if they don't exist (using DO blocks for conditional creation)

-- Create preschools table if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'preschools') THEN
    CREATE TABLE preschools (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      email text,
      phone text,
      address text,
      logo_url text,
      domain text,
      billing_email text,
      registration_number text,
      payfast_token text,
      subscription_plan text,
      subscription_plan_id text,
      subscription_end_date timestamptz,
      max_students integer,
      max_teachers integer,
      onboarding_status text DEFAULT 'pending',
      setup_completed boolean DEFAULT false,
      is_active boolean DEFAULT true,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );
    RAISE NOTICE 'Created preschools table';
  ELSE
    RAISE NOTICE 'preschools table already exists';
  END IF;
END $$;

-- Create users table if missing (with organization_id for compatibility)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
    CREATE TABLE users (
      id uuid PRIMARY KEY,
      email text UNIQUE,
      first_name text,
      last_name text,
      role text,
      organization_id uuid REFERENCES preschools(id),
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );
    RAISE NOTICE 'Created users table';
  ELSE
    RAISE NOTICE 'users table already exists';
  END IF;
END $$;

-- Create classes table if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'classes') THEN
    CREATE TABLE classes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      preschool_id uuid NOT NULL REFERENCES preschools(id) ON DELETE CASCADE,
      teacher_id uuid REFERENCES users(id) ON DELETE SET NULL,
      grade_level text,
      is_active boolean DEFAULT true,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );
    RAISE NOTICE 'Created classes table';
  ELSE
    RAISE NOTICE 'classes table already exists';
  END IF;
END $$;

-- Create subscriptions table if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'subscriptions') THEN
    CREATE TABLE subscriptions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      preschool_id uuid NOT NULL REFERENCES preschools(id) ON DELETE CASCADE,
      plan_name text NOT NULL,
      status text NOT NULL DEFAULT 'active',
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );
    RAISE NOTICE 'Created subscriptions table';
  ELSE
    RAISE NOTICE 'subscriptions table already exists';
  END IF;
END $$;

-- Now create the business tables (these should not exist yet)

-- Billing plans table (subscription tiers)
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
  ads_enabled boolean NOT NULL DEFAULT true,
  features jsonb NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Homework assignments table
CREATE TABLE IF NOT EXISTS homework_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  preschool_id uuid NOT NULL REFERENCES preschools(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  class_id uuid REFERENCES classes(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  instructions text,
  due_date timestamptz,
  status text NOT NULL DEFAULT 'active',
  max_score integer DEFAULT 100,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Lessons table
CREATE TABLE IF NOT EXISTS lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  preschool_id uuid NOT NULL REFERENCES preschools(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  class_id uuid REFERENCES classes(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  content jsonb NOT NULL DEFAULT '{}',
  objectives text[],
  age_group text NOT NULL DEFAULT '3-6',
  subject text NOT NULL DEFAULT 'general',
  duration_minutes integer DEFAULT 30,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- AI generations table (enhanced tracking)
CREATE TABLE IF NOT EXISTS ai_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  preschool_id uuid NOT NULL REFERENCES preschools(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feature_type text NOT NULL,
  prompt_tokens integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  total_tokens integer NOT NULL DEFAULT 0,
  cost_cents integer NOT NULL DEFAULT 0,
  model text NOT NULL DEFAULT 'claude-3-sonnet',
  status text NOT NULL DEFAULT 'success',
  error_message text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Key-value configuration store
CREATE TABLE IF NOT EXISTS config_kv (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  description text,
  is_public boolean DEFAULT false,
  preschool_id uuid REFERENCES preschools(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE billing_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE homework_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE config_kv ENABLE ROW LEVEL SECURITY;

-- Helper function (compatible with both preschool_id and organization_id)
CREATE OR REPLACE FUNCTION current_preschool_id()
RETURNS uuid AS $$
BEGIN
  RETURN COALESCE(
    (auth.jwt() ->> 'preschool_id')::uuid,
    (auth.jwt() ->> 'organization_id')::uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create RLS policies using DO blocks to handle existing policies
DO $$
BEGIN
  -- Drop existing policies if they exist, then create new ones
  
  -- Billing plans policy
  BEGIN
    DROP POLICY IF EXISTS billing_plans_public_read ON billing_plans;
  EXCEPTION WHEN undefined_object THEN
    -- Policy doesn't exist, that's fine
  END;
  CREATE POLICY billing_plans_public_read 
    ON billing_plans FOR SELECT USING (active = true);

  -- Homework assignments policy
  BEGIN
    DROP POLICY IF EXISTS homework_assignments_tenant_isolation ON homework_assignments;
  EXCEPTION WHEN undefined_object THEN
    -- Policy doesn't exist, that's fine
  END;
  CREATE POLICY homework_assignments_tenant_isolation 
    ON homework_assignments USING (preschool_id = current_preschool_id());

  -- Lessons policy
  BEGIN
    DROP POLICY IF EXISTS lessons_tenant_isolation ON lessons;
  EXCEPTION WHEN undefined_object THEN
    -- Policy doesn't exist, that's fine
  END;
  CREATE POLICY lessons_tenant_isolation 
    ON lessons USING (preschool_id = current_preschool_id());

  -- AI generations policy
  BEGIN
    DROP POLICY IF EXISTS ai_generations_tenant_isolation ON ai_generations;
  EXCEPTION WHEN undefined_object THEN
    -- Policy doesn't exist, that's fine
  END;
  CREATE POLICY ai_generations_tenant_isolation 
    ON ai_generations USING (preschool_id = current_preschool_id());

  -- Config KV policies
  BEGIN
    DROP POLICY IF EXISTS config_kv_public_read ON config_kv;
  EXCEPTION WHEN undefined_object THEN
    -- Policy doesn't exist, that's fine
  END;
  CREATE POLICY config_kv_public_read 
    ON config_kv FOR SELECT USING (is_public = true AND preschool_id IS NULL);

  BEGIN
    DROP POLICY IF EXISTS config_kv_tenant_isolation ON config_kv;
  EXCEPTION WHEN undefined_object THEN
    -- Policy doesn't exist, that's fine
  END;
  CREATE POLICY config_kv_tenant_isolation 
    ON config_kv USING (preschool_id = current_preschool_id() OR preschool_id IS NULL);

  RAISE NOTICE 'RLS policies created successfully';
END $$;

-- Insert default billing plans
INSERT INTO billing_plans (name, display_name, description, price_cents, ai_monthly_credits, max_teachers, max_parents, max_students, ads_enabled, features, sort_order)
VALUES 
  ('free', 'Free', 'Get started with basics', 0, 10, 1, 5, 10, true, '{"basic_dashboard": true, "limited_ai": true}', 1),
  ('parent_starter', 'Parent Starter', 'Affordable AI help for families', 4900, 50, 1, 10, 20, true, '{"parent_portal": true, "homework_help": true, "progress_reports": true}', 2),
  ('teacher_pro', 'Teacher Pro', 'Professional tools for educators', 9900, 200, 3, 30, 50, false, '{"advanced_analytics": true, "lesson_planning": true, "assessment_tools": true}', 3),
  ('school_premium', 'School Premium', 'Complete solution for institutions', 19900, 500, 10, 100, 200, false, '{"multi_class": true, "admin_dashboard": true, "custom_reports": true, "priority_support": true}', 4)
ON CONFLICT (name) DO NOTHING;

-- Log completion
INSERT INTO config_kv (key, value, description, is_public)
VALUES (
  'migration_minimal_core_business_tables_fixed',
  '{"version": "1.1.0", "completed_at": "' || now()::text || '", "tables_added": 5}',
  'Minimal core business tables migration completion log (fixed policies)',
  false
) ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  updated_at = now();

-- Final check - show what we created
SELECT 
  'SUCCESS: Created core business tables' as status,
  count(*) as table_count
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('billing_plans', 'homework_assignments', 'lessons', 'ai_generations', 'config_kv');