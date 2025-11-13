-- SUPABASE DASHBOARD MIGRATION SCRIPT (FIXED)
-- Execute this directly in Supabase Dashboard > SQL Editor  
-- Date: 2025-09-17
-- Purpose: Add core business tables for EduDash Pro (with proper dependencies)
-- WARP.md Compliance: Forward-only migration, production-safe

-- ============================================================================
-- PART 0: ENSURE BASE TABLES EXIST
-- ============================================================================

-- Create preschools table if it doesn't exist (some installations might be missing this)
CREATE TABLE IF NOT EXISTS preschools (
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

-- Create users table if it doesn't exist (should already exist but let's be safe)
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  email text UNIQUE,
  first_name text,
  last_name text,
  role text,
  organization_id uuid REFERENCES preschools(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create classes table if it doesn't exist (needed for some foreign keys)
CREATE TABLE IF NOT EXISTS classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  preschool_id uuid NOT NULL REFERENCES preschools(id) ON DELETE CASCADE,
  teacher_id uuid REFERENCES users(id) ON DELETE SET NULL,
  grade_level text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create subscriptions table if it doesn't exist (needed for billing)
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  preschool_id uuid NOT NULL REFERENCES preschools(id) ON DELETE CASCADE,
  plan_name text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- PART 1: CORE BUSINESS TABLES  
-- ============================================================================

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
  status text NOT NULL DEFAULT 'active' 
    CHECK (status IN ('active', 'archived', 'draft')),
  max_score integer DEFAULT 100,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Homework submissions table
CREATE TABLE IF NOT EXISTS homework_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES homework_assignments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  preschool_id uuid NOT NULL REFERENCES preschools(id) ON DELETE CASCADE,
  content text,
  attachments jsonb DEFAULT '[]',
  score integer,
  feedback text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'graded', 'returned')),
  submitted_at timestamptz,
  graded_at timestamptz,
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
  age_group text NOT NULL DEFAULT '3-6'
    CHECK (age_group IN ('3-4', '4-5', '5-6', '3-6')),
  subject text NOT NULL DEFAULT 'general'
    CHECK (subject IN ('mathematics', 'literacy', 'science', 'art', 'music', 'physical', 'general')),
  duration_minutes integer DEFAULT 30,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'archived')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Lesson activities table
CREATE TABLE IF NOT EXISTS lesson_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  preschool_id uuid NOT NULL REFERENCES preschools(id) ON DELETE CASCADE,
  title text NOT NULL,
  activity_type text NOT NULL DEFAULT 'interactive'
    CHECK (activity_type IN ('interactive', 'video', 'quiz', 'drawing', 'reading', 'game')),
  content jsonb NOT NULL DEFAULT '{}',
  order_index integer NOT NULL DEFAULT 0,
  is_required boolean DEFAULT true,
  estimated_minutes integer DEFAULT 10,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Activity attempts/progress table
CREATE TABLE IF NOT EXISTS activity_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES lesson_activities(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  preschool_id uuid NOT NULL REFERENCES preschools(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'started'
    CHECK (status IN ('started', 'completed', 'skipped')),
  progress_data jsonb DEFAULT '{}',
  score integer,
  time_spent_seconds integer DEFAULT 0,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Billing plans table (subscription tiers)
CREATE TABLE IF NOT EXISTS billing_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  price_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'ZAR'
    CHECK (currency IN ('ZAR', 'USD', 'EUR')),
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

-- Subscription invoices (PayFast integration)
CREATE TABLE IF NOT EXISTS subscription_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  preschool_id uuid NOT NULL REFERENCES preschools(id) ON DELETE CASCADE,
  amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'ZAR',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'failed', 'cancelled', 'refunded')),
  payfast_reference text,
  payfast_payment_id text,
  invoice_number text UNIQUE,
  due_date timestamptz,
  paid_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- PayFast ITN (Instant Transaction Notification) logs
CREATE TABLE IF NOT EXISTS payfast_itn_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES subscription_invoices(id),
  raw_data jsonb NOT NULL,
  payment_status text,
  amount_gross text,
  signature_valid boolean,
  processed boolean DEFAULT false,
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- Seats tracking table
CREATE TABLE IF NOT EXISTS seats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  preschool_id uuid NOT NULL REFERENCES preschools(id) ON DELETE CASCADE,
  subscription_id uuid NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  user_role text NOT NULL CHECK (user_role IN ('teacher', 'parent', 'student')),
  allocated integer NOT NULL DEFAULT 0,
  used integer NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  
  UNIQUE(preschool_id, subscription_id, user_role)
);

-- Organization invites table
CREATE TABLE IF NOT EXISTS org_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  preschool_id uuid NOT NULL REFERENCES preschools(id) ON DELETE CASCADE,
  invited_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('teacher', 'parent')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  invite_token text UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL,
  accepted_by uuid REFERENCES users(id),
  accepted_at timestamptz,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Parent-child links table
CREATE TABLE IF NOT EXISTS parent_child_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  child_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  preschool_id uuid NOT NULL REFERENCES preschools(id) ON DELETE CASCADE,
  relationship_type text NOT NULL DEFAULT 'parent'
    CHECK (relationship_type IN ('parent', 'guardian', 'caregiver')),
  is_primary_contact boolean DEFAULT false,
  permissions jsonb DEFAULT '{"view_progress": true, "receive_notifications": true}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(parent_id, child_id, preschool_id)
);

-- AI generations table (enhanced tracking)
CREATE TABLE IF NOT EXISTS ai_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  preschool_id uuid NOT NULL REFERENCES preschools(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feature_type text NOT NULL
    CHECK (feature_type IN ('lesson_plan', 'homework_feedback', 'progress_report', 'activity_suggestion', 'assessment')),
  prompt_tokens integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  total_tokens integer NOT NULL DEFAULT 0,
  cost_cents integer NOT NULL DEFAULT 0,
  model text NOT NULL DEFAULT 'claude-3-sonnet',
  status text NOT NULL DEFAULT 'success'
    CHECK (status IN ('success', 'error', 'quota_exceeded', 'cancelled')),
  error_message text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Key-value configuration store
CREATE TABLE IF NOT EXISTS config_kv (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  description text,
  is_public boolean DEFAULT false, -- Can be read by client
  preschool_id uuid REFERENCES preschools(id), -- NULL = global config
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Ad impressions tracking
CREATE TABLE IF NOT EXISTS ad_impressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  preschool_id uuid REFERENCES preschools(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  ad_unit_id text NOT NULL,
  ad_network text NOT NULL DEFAULT 'admob'
    CHECK (ad_network IN ('admob', 'facebook', 'unity')),
  impression_type text NOT NULL DEFAULT 'banner'
    CHECK (impression_type IN ('banner', 'interstitial', 'rewarded', 'native')),
  revenue_cents integer DEFAULT 0,
  clicked boolean DEFAULT false,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- PART 2: ROW LEVEL SECURITY
-- ============================================================================

-- Helper function for getting current preschool_id (handles both preschool_id and organization_id)
CREATE OR REPLACE FUNCTION current_preschool_id()
RETURNS uuid AS $$
BEGIN
  -- Try preschool_id first, then fall back to organization_id for compatibility
  RETURN COALESCE(
    (auth.jwt() ->> 'preschool_id')::uuid,
    (auth.jwt() ->> 'organization_id')::uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS on base tables if not already enabled
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'preschools' LIMIT 1) THEN
    ALTER TABLE preschools ENABLE ROW LEVEL SECURITY;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users' LIMIT 1) THEN
    ALTER TABLE users ENABLE ROW LEVEL SECURITY;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'classes' LIMIT 1) THEN
    ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'subscriptions' LIMIT 1) THEN
    ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Enable RLS on all new tables
ALTER TABLE homework_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE homework_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payfast_itn_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_child_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE config_kv ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_impressions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for tenant isolation (drop existing if they exist to avoid conflicts)
DO $$
BEGIN
  -- Homework system policies
  DROP POLICY IF EXISTS homework_assignments_tenant_isolation ON homework_assignments;
  CREATE POLICY homework_assignments_tenant_isolation 
    ON homework_assignments USING (preschool_id = current_preschool_id());

  DROP POLICY IF EXISTS homework_submissions_tenant_isolation ON homework_submissions;
  CREATE POLICY homework_submissions_tenant_isolation 
    ON homework_submissions USING (preschool_id = current_preschool_id());

  -- Lessons system policies
  DROP POLICY IF EXISTS lessons_tenant_isolation ON lessons;
  CREATE POLICY lessons_tenant_isolation 
    ON lessons USING (preschool_id = current_preschool_id());

  DROP POLICY IF EXISTS lesson_activities_tenant_isolation ON lesson_activities;
  CREATE POLICY lesson_activities_tenant_isolation 
    ON lesson_activities USING (preschool_id = current_preschool_id());

  DROP POLICY IF EXISTS activity_attempts_tenant_isolation ON activity_attempts;
  CREATE POLICY activity_attempts_tenant_isolation 
    ON activity_attempts USING (preschool_id = current_preschool_id());

  -- Billing system policies (public read for active plans)
  DROP POLICY IF EXISTS billing_plans_public_read ON billing_plans;
  CREATE POLICY billing_plans_public_read 
    ON billing_plans FOR SELECT USING (active = true);

  DROP POLICY IF EXISTS subscription_invoices_tenant_isolation ON subscription_invoices;
  CREATE POLICY subscription_invoices_tenant_isolation 
    ON subscription_invoices USING (preschool_id = current_preschool_id());

  DROP POLICY IF EXISTS payfast_itn_logs_superadmin_only ON payfast_itn_logs;
  CREATE POLICY payfast_itn_logs_superadmin_only 
    ON payfast_itn_logs USING (auth.jwt() ->> 'role' = 'superadmin');

  -- Seat management policies
  DROP POLICY IF EXISTS seats_tenant_isolation ON seats;
  CREATE POLICY seats_tenant_isolation 
    ON seats USING (preschool_id = current_preschool_id());

  DROP POLICY IF EXISTS org_invites_tenant_isolation ON org_invites;
  CREATE POLICY org_invites_tenant_isolation 
    ON org_invites USING (preschool_id = current_preschool_id());

  -- Parent-child relationships
  DROP POLICY IF EXISTS parent_child_links_tenant_isolation ON parent_child_links;
  CREATE POLICY parent_child_links_tenant_isolation 
    ON parent_child_links USING (preschool_id = current_preschool_id());

  -- AI usage policies
  DROP POLICY IF EXISTS ai_generations_tenant_isolation ON ai_generations;
  CREATE POLICY ai_generations_tenant_isolation 
    ON ai_generations USING (preschool_id = current_preschool_id());

  -- Config policies
  DROP POLICY IF EXISTS config_kv_public_read ON config_kv;
  CREATE POLICY config_kv_public_read 
    ON config_kv FOR SELECT USING (is_public = true AND preschool_id IS NULL);

  DROP POLICY IF EXISTS config_kv_tenant_isolation ON config_kv;
  CREATE POLICY config_kv_tenant_isolation 
    ON config_kv USING (preschool_id = current_preschool_id() OR preschool_id IS NULL);

  -- Ad impressions policies
  DROP POLICY IF EXISTS ad_impressions_tenant_isolation ON ad_impressions;
  CREATE POLICY ad_impressions_tenant_isolation 
    ON ad_impressions USING (preschool_id = current_preschool_id());
END $$;

-- ============================================================================
-- PART 3: PERFORMANCE INDEXES
-- ============================================================================

-- Base table indexes
CREATE INDEX IF NOT EXISTS idx_preschools_domain ON preschools(domain);
CREATE INDEX IF NOT EXISTS idx_users_organization_id ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_classes_preschool_id ON classes(preschool_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_preschool_id ON subscriptions(preschool_id);

-- Homework system indexes
CREATE INDEX IF NOT EXISTS idx_homework_assignments_preschool_id ON homework_assignments(preschool_id);
CREATE INDEX IF NOT EXISTS idx_homework_assignments_teacher_id ON homework_assignments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_homework_assignments_class_id ON homework_assignments(class_id);
CREATE INDEX IF NOT EXISTS idx_homework_assignments_due_date ON homework_assignments(due_date);

CREATE INDEX IF NOT EXISTS idx_homework_submissions_assignment_id ON homework_submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_homework_submissions_student_id ON homework_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_homework_submissions_status ON homework_submissions(status);

-- Lessons system indexes
CREATE INDEX IF NOT EXISTS idx_lessons_preschool_id ON lessons(preschool_id);
CREATE INDEX IF NOT EXISTS idx_lessons_teacher_id ON lessons(teacher_id);
CREATE INDEX IF NOT EXISTS idx_lessons_subject ON lessons(subject);
CREATE INDEX IF NOT EXISTS idx_lessons_age_group ON lessons(age_group);

CREATE INDEX IF NOT EXISTS idx_lesson_activities_lesson_id ON lesson_activities(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_activities_order_index ON lesson_activities(order_index);

CREATE INDEX IF NOT EXISTS idx_activity_attempts_activity_id ON activity_attempts(activity_id);
CREATE INDEX IF NOT EXISTS idx_activity_attempts_student_id ON activity_attempts(student_id);

-- Billing system indexes
CREATE INDEX IF NOT EXISTS idx_subscription_invoices_preschool_id ON subscription_invoices(preschool_id);
CREATE INDEX IF NOT EXISTS idx_subscription_invoices_status ON subscription_invoices(status);
CREATE INDEX IF NOT EXISTS idx_subscription_invoices_due_date ON subscription_invoices(due_date);

CREATE INDEX IF NOT EXISTS idx_payfast_itn_logs_processed ON payfast_itn_logs(processed);
CREATE INDEX IF NOT EXISTS idx_payfast_itn_logs_created_at ON payfast_itn_logs(created_at);

-- AI usage indexes
CREATE INDEX IF NOT EXISTS idx_ai_generations_preschool_id ON ai_generations(preschool_id);
CREATE INDEX IF NOT EXISTS idx_ai_generations_user_id ON ai_generations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_generations_created_at ON ai_generations(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_generations_feature_type ON ai_generations(feature_type);

-- Parent-child relationships indexes
CREATE INDEX IF NOT EXISTS idx_parent_child_links_parent_id ON parent_child_links(parent_id);
CREATE INDEX IF NOT EXISTS idx_parent_child_links_child_id ON parent_child_links(child_id);

-- ============================================================================
-- PART 4: DEFAULT DATA
-- ============================================================================

-- Insert default billing plans (only if they don't exist)
INSERT INTO billing_plans (name, display_name, description, price_cents, ai_monthly_credits, max_teachers, max_parents, max_students, ads_enabled, features, sort_order)
VALUES 
  ('free', 'Free', 'Get started with basics', 0, 10, 1, 5, 10, true, '{"basic_dashboard": true, "limited_ai": true}', 1),
  ('parent_starter', 'Parent Starter', 'Affordable AI help for families', 4900, 50, 1, 10, 20, true, '{"parent_portal": true, "homework_help": true, "progress_reports": true}', 2),
  ('teacher_pro', 'Teacher Pro', 'Professional tools for educators', 9900, 200, 3, 30, 50, false, '{"advanced_analytics": true, "lesson_planning": true, "assessment_tools": true}', 3),
  ('school_premium', 'School Premium', 'Complete solution for institutions', 19900, 500, 10, 100, 200, false, '{"multi_class": true, "admin_dashboard": true, "custom_reports": true, "priority_support": true}', 4)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- PART 5: TRIGGERS AND FUNCTIONS (updated_at automation)
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns (drop existing first to avoid conflicts)
DO $$
DECLARE
  table_name text;
  table_names text[] := ARRAY[
    'preschools', 'users', 'classes', 'subscriptions',
    'homework_assignments', 'homework_submissions', 'lessons', 'lesson_activities', 
    'activity_attempts', 'billing_plans', 'subscription_invoices', 'seats', 
    'org_invites', 'parent_child_links', 'config_kv'
  ];
BEGIN
  FOREACH table_name IN ARRAY table_names LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS update_%I_updated_at ON %I', table_name, table_name);
    EXECUTE format('
      CREATE TRIGGER update_%I_updated_at 
      BEFORE UPDATE ON %I 
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
    ', table_name, table_name);
  END LOOP;
END $$;

-- ============================================================================
-- PART 6: PERMISSIONS
-- ============================================================================

-- Grant appropriate permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Restrict certain tables to service role only
REVOKE ALL ON payfast_itn_logs FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON payfast_itn_logs TO service_role;

REVOKE ALL ON config_kv FROM authenticated;
GRANT SELECT ON config_kv TO authenticated; -- Only SELECT for config
GRANT ALL ON config_kv TO service_role;

-- ============================================================================
-- PART 7: COMPLETION LOG
-- ============================================================================

-- Log migration completion
INSERT INTO config_kv (key, value, description, is_public)
VALUES (
  'migration_20250917_core_business_tables_fixed',
  '{"version": "1.1.0", "completed_at": "' || now()::text || '", "tables_added": 14, "base_tables_ensured": 4}',
  'Core business tables migration completion log (fixed version)',
  false
) ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  updated_at = now();

-- Migration completed successfully!
-- This version handles missing base tables and existing policy conflicts