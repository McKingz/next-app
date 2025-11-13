-- Phase 1: AI Model Tiers and Audit Logging Migration
-- Date: 2025-09-21
-- Purpose: Add AI model tiers, usage tracking, and audit logging
-- Compatible with existing EduDash Pro schema

BEGIN;

-- ====================================================================
-- PART 1: AI MODEL TIERS AND USAGE TRACKING
-- ====================================================================

-- AI Model Tiers Enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ai_model_tier') THEN
        CREATE TYPE ai_model_tier AS ENUM ('free', 'starter', 'premium', 'enterprise');
    END IF;
END $$;

-- AI Model Tiers Table (Configuration)
CREATE TABLE IF NOT EXISTS public.ai_model_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Tier information
  tier AI_MODEL_TIER NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,

  -- Available models
  allowed_models JSONB NOT NULL DEFAULT '[]'::JSONB,

  -- Usage limits
  max_requests_per_minute INTEGER NOT NULL DEFAULT 0,
  max_requests_per_day INTEGER NOT NULL DEFAULT 0,
  max_requests_per_month INTEGER NOT NULL DEFAULT 0,
  max_tokens_per_request INTEGER DEFAULT NULL, -- NULL means no limit

  -- Features
  features JSONB NOT NULL DEFAULT '{}'::JSONB,
  restrictions JSONB NOT NULL DEFAULT '{}'::JSONB,

  -- Metadata
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User AI Model Tier Assignments
CREATE TABLE IF NOT EXISTS public.user_ai_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  user_id UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  tier AI_MODEL_TIER NOT NULL DEFAULT 'free',

  -- Assignment details
  assigned_by UUID REFERENCES profiles (id) ON DELETE SET NULL,
  assigned_reason TEXT,

  -- Override limits (NULL means use tier defaults)
  override_daily_limit INTEGER,
  override_monthly_limit INTEGER,
  override_rpm_limit INTEGER,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at TIMESTAMPTZ,

  -- Metadata
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  UNIQUE (user_id) -- One active tier per user
);

-- AI Usage Tracking
CREATE TABLE IF NOT EXISTS public.ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  user_id UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  organization_id UUID REFERENCES preschools (id) ON DELETE CASCADE,

  -- Request details
  model_used TEXT NOT NULL,
  feature_used TEXT NOT NULL, -- 'lesson_generation', 'homework_help', 'grading', etc.
  request_type TEXT NOT NULL DEFAULT 'completion', -- 'completion', 'chat', 'embedding'

  -- Usage metrics
  tokens_used INTEGER,
  request_tokens INTEGER,
  response_tokens INTEGER,
  processing_time_ms INTEGER,

  -- Request metadata (no sensitive content)
  request_id TEXT, -- For tracing/debugging
  model_parameters JSONB DEFAULT '{}'::JSONB,
  success BOOLEAN NOT NULL DEFAULT TRUE,
  error_message TEXT,

  -- Time aggregation helpers
  usage_date DATE NOT NULL DEFAULT current_date,
  usage_hour INTEGER NOT NULL DEFAULT extract(HOUR FROM now()),

  -- Metadata
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ====================================================================
-- PART 2: AUDIT LOGGING SYSTEM
-- ====================================================================

-- Audit Event Types Enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'audit_event_type') THEN
        CREATE TYPE audit_event_type AS ENUM (
            'auth_login_success',
            'auth_login_failure', 
            'auth_logout',
            'auth_password_change',
            'user_role_change',
            'course_created',
            'course_updated',
            'course_deleted',
            'enrollment_created',
            'enrollment_deleted',
            'assignment_created',
            'assignment_updated',
            'assignment_deleted',
            'submission_created',
            'submission_updated',
            'grade_created',
            'grade_updated',
            'permission_denied',
            'ai_request',
            'ai_quota_exceeded',
            'data_export',
            'admin_action'
        );
    END IF;
END $$;

-- Add columns to existing audit_logs table to support educational audit features
DO $$
BEGIN
    -- Add event_type column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'event_type') THEN
        ALTER TABLE audit_logs ADD COLUMN event_type audit_event_type;
    END IF;
    
    -- Add event_name column  
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'event_name') THEN
        ALTER TABLE audit_logs ADD COLUMN event_name TEXT;
    END IF;
    
    -- Add event_description column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'event_description') THEN
        ALTER TABLE audit_logs ADD COLUMN event_description TEXT;
    END IF;
    
    -- Add actor_id column (map from existing user_id)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'actor_id') THEN
        ALTER TABLE audit_logs ADD COLUMN actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
        -- Copy existing user_id to actor_id
        UPDATE audit_logs SET actor_id = user_id WHERE user_id IS NOT NULL;
    END IF;
    
    -- Add actor_role column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'actor_role') THEN
        ALTER TABLE audit_logs ADD COLUMN actor_role TEXT;
    END IF;
    
    -- Add actor_organization_id column  
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'actor_organization_id') THEN
        ALTER TABLE audit_logs ADD COLUMN actor_organization_id UUID REFERENCES preschools(id) ON DELETE SET NULL;
    END IF;
    
    -- Add target_id column (map from existing resource_id)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'target_id') THEN
        ALTER TABLE audit_logs ADD COLUMN target_id UUID;
        -- Copy existing resource_id to target_id
        UPDATE audit_logs SET target_id = resource_id 
        WHERE resource_id IS NOT NULL;
    END IF;
    
    -- Add target_type column (map from existing resource_type)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'target_type') THEN
        ALTER TABLE audit_logs ADD COLUMN target_type TEXT;
        -- Copy existing resource_type to target_type
        UPDATE audit_logs SET target_type = resource_type WHERE resource_type IS NOT NULL;
    END IF;
    
    -- Add target_name column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'target_name') THEN
        ALTER TABLE audit_logs ADD COLUMN target_name TEXT;
    END IF;
    
    -- Add request_path column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'request_path') THEN
        ALTER TABLE audit_logs ADD COLUMN request_path TEXT;
    END IF;
    
    -- Add request_method column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'request_method') THEN
        ALTER TABLE audit_logs ADD COLUMN request_method TEXT;
    END IF;
    
    -- Add metadata column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'metadata') THEN
        ALTER TABLE audit_logs ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;
    
    -- Add changes_made column (map from old_values/new_values)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'changes_made') THEN
        ALTER TABLE audit_logs ADD COLUMN changes_made JSONB DEFAULT '{}'::jsonb;
        -- Combine old_values and new_values into changes_made
        UPDATE audit_logs SET changes_made = jsonb_build_object(
            'old_values', COALESCE(old_values, '{}'::jsonb),
            'new_values', COALESCE(new_values, '{}'::jsonb)
        ) WHERE old_values IS NOT NULL OR new_values IS NOT NULL;
    END IF;
    
    -- Add session_id column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'session_id') THEN
        ALTER TABLE audit_logs ADD COLUMN session_id TEXT;
    END IF;
    
    -- Add correlation_id column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'correlation_id') THEN
        ALTER TABLE audit_logs ADD COLUMN correlation_id TEXT;
    END IF;
    
    -- Add success column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'success') THEN
        ALTER TABLE audit_logs ADD COLUMN success BOOLEAN DEFAULT true;
    END IF;
    
    -- Add error_message column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'error_message') THEN
        ALTER TABLE audit_logs ADD COLUMN error_message TEXT;
    END IF;
    
    -- Add occurred_at column (map from existing created_at)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'occurred_at') THEN
        ALTER TABLE audit_logs ADD COLUMN occurred_at TIMESTAMPTZ;
        -- Copy created_at to occurred_at
        UPDATE audit_logs SET occurred_at = created_at WHERE created_at IS NOT NULL;
    END IF;
    
    -- Map existing action to event_type and event_name where possible
    UPDATE audit_logs SET 
        event_name = COALESCE(action, 'unknown_action'),
        event_type = CASE 
            WHEN action LIKE '%login%' THEN 'auth_login_success'::audit_event_type
            WHEN action LIKE '%logout%' THEN 'auth_logout'::audit_event_type
            WHEN action LIKE '%password%' THEN 'auth_password_change'::audit_event_type
            WHEN action LIKE '%role%' THEN 'user_role_change'::audit_event_type
            ELSE 'admin_action'::audit_event_type
        END
    WHERE event_type IS NULL AND action IS NOT NULL;
END $$;

-- ====================================================================
-- PART 3: CREATE INDEXES FOR PERFORMANCE
-- ====================================================================

-- AI Model Tiers indexes
CREATE INDEX IF NOT EXISTS idx_ai_model_tiers_tier ON ai_model_tiers (tier);
CREATE INDEX IF NOT EXISTS idx_ai_model_tiers_active ON ai_model_tiers (is_active, sort_order);

-- User AI Tiers indexes
CREATE INDEX IF NOT EXISTS idx_user_ai_tiers_user_id ON user_ai_tiers (user_id);
CREATE INDEX IF NOT EXISTS idx_user_ai_tiers_tier ON user_ai_tiers (tier);
CREATE INDEX IF NOT EXISTS idx_user_ai_tiers_active ON user_ai_tiers (is_active);
CREATE INDEX IF NOT EXISTS idx_user_ai_tiers_expires ON user_ai_tiers (expires_at) WHERE expires_at IS NOT NULL;

-- AI Usage indexes
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_id ON ai_usage (user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_organization_id ON ai_usage (organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_date ON ai_usage (usage_date);
CREATE INDEX IF NOT EXISTS idx_ai_usage_model ON ai_usage (model_used);
CREATE INDEX IF NOT EXISTS idx_ai_usage_feature ON ai_usage (feature_used);
CREATE INDEX IF NOT EXISTS idx_ai_usage_success ON ai_usage (success);
CREATE INDEX IF NOT EXISTS idx_ai_usage_created_at ON ai_usage (created_at);

-- Composite index for usage aggregation
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_date_feature ON ai_usage (user_id, usage_date, feature_used);

-- Audit Logs indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs (actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs (target_id, target_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs (event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_occurred_at ON audit_logs (occurred_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_org ON audit_logs (actor_organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_ip_address ON audit_logs (ip_address);
CREATE INDEX IF NOT EXISTS idx_audit_logs_session_id ON audit_logs (session_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_correlation_id ON audit_logs (correlation_id);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_time ON audit_logs (actor_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target_time ON audit_logs (target_id, target_type, occurred_at DESC);

-- ====================================================================
-- PART 4: UTILITY FUNCTIONS
-- ====================================================================

-- Function to get user's current AI tier
CREATE OR REPLACE FUNCTION public.get_user_ai_tier(p_user_id UUID)
RETURNS AI_MODEL_TIER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
    user_tier ai_model_tier;
BEGIN
    SELECT tier INTO user_tier
    FROM user_ai_tiers 
    WHERE user_id = p_user_id 
    AND is_active = true 
    AND (expires_at IS NULL OR expires_at > now())
    LIMIT 1;
    
    -- Default to free tier if no assignment found
    RETURN COALESCE(user_tier, 'free'::ai_model_tier);
END;
$$;

-- Function to record AI usage
CREATE OR REPLACE FUNCTION public.record_ai_usage(
  p_user_id UUID,
  p_model_used TEXT,
  p_feature_used TEXT,
  p_tokens_used INTEGER DEFAULT NULL,
  p_request_tokens INTEGER DEFAULT NULL,
  p_response_tokens INTEGER DEFAULT NULL,
  p_processing_time_ms INTEGER DEFAULT NULL,
  p_success BOOLEAN DEFAULT TRUE,
  p_error_message TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    usage_id UUID;
    org_id UUID;
BEGIN
    -- Get user's organization
    SELECT preschool_id INTO org_id FROM profiles WHERE id = p_user_id;
    
    -- Insert usage record
    INSERT INTO ai_usage (
        user_id, organization_id, model_used, feature_used,
        tokens_used, request_tokens, response_tokens, processing_time_ms,
        success, error_message, metadata
    ) VALUES (
        p_user_id, org_id, p_model_used, p_feature_used,
        p_tokens_used, p_request_tokens, p_response_tokens, p_processing_time_ms,
        p_success, p_error_message, COALESCE(p_metadata, '{}'::jsonb)
    ) RETURNING id INTO usage_id;
    
    RETURN usage_id;
END;
$$;

-- Function to create audit log entry
CREATE OR REPLACE FUNCTION public.create_audit_log(
  p_event_type AUDIT_EVENT_TYPE,
  p_event_name TEXT,
  p_actor_id UUID DEFAULT NULL,
  p_target_id UUID DEFAULT NULL,
  p_target_type TEXT DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::JSONB,
  p_success BOOLEAN DEFAULT TRUE,
  p_error_message TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    log_id UUID;
    actor_role TEXT;
    actor_org_id UUID;
BEGIN
    -- Get actor details if provided
    IF p_actor_id IS NOT NULL THEN
        SELECT role, preschool_id INTO actor_role, actor_org_id 
        FROM profiles WHERE id = p_actor_id;
    END IF;
    
    -- Insert audit log
    INSERT INTO audit_logs (
        event_type, event_name, actor_id, actor_role, actor_organization_id,
        target_id, target_type, ip_address, metadata, success, error_message
    ) VALUES (
        p_event_type, p_event_name, p_actor_id, actor_role, actor_org_id,
        p_target_id, p_target_type, p_ip_address, 
        COALESCE(p_metadata, '{}'::jsonb), p_success, p_error_message
    ) RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$;

-- ====================================================================
-- PART 5: CREATE TRIGGERS FOR UPDATED_AT
-- ====================================================================

CREATE TRIGGER ai_model_tiers_updated_at BEFORE UPDATE ON ai_model_tiers
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER user_ai_tiers_updated_at BEFORE UPDATE ON user_ai_tiers
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ====================================================================
-- PART 6: INSERT DEFAULT AI MODEL TIERS
-- ====================================================================

-- Insert default AI model tiers based on Phase 1 requirements
INSERT INTO ai_model_tiers (
  tier,
  name,
  description,
  allowed_models,
  max_requests_per_minute,
  max_requests_per_day,
  max_requests_per_month,
  features
) VALUES
(
  'free',
  'Free Tier',
  'Basic AI features for trial users',
  '["claude-3-haiku"]'::JSONB,
  5,
  50,
  150,
  '{"ai_homework_helper": true, "ai_lesson_generation": false, "ai_grading_assistance": false}'::JSONB
),
(
  'starter',
  'Starter Tier',
  'Enhanced AI capabilities for small schools',
  '["claude-3-haiku", "claude-3-sonnet"]'::JSONB,
  15,
  500,
  1500,
  '{"ai_homework_helper": true, "ai_lesson_generation": true, "ai_grading_assistance": true, "ai_stem_activities": false}'::JSONB
),
(
  'premium',
  'Premium Tier',
  'Full AI suite for comprehensive educational use',
  '["claude-3-haiku", "claude-3-sonnet", "claude-3-opus"]'::JSONB,
  30,
  1000,
  2500,
  '{"ai_homework_helper": true, "ai_lesson_generation": true, "ai_grading_assistance": true, "ai_stem_activities": true, "ai_progress_analysis": true}'::JSONB
),
(
  'enterprise',
  'Enterprise Tier',
  'Unlimited AI access with priority support',
  '["claude-3-haiku", "claude-3-sonnet", "claude-3-opus"]'::JSONB,
  60,
  -1, -- Unlimited
  -1, -- Unlimited
  '{"ai_homework_helper": true, "ai_lesson_generation": true, "ai_grading_assistance": true, "ai_stem_activities": true, "ai_progress_analysis": true, "ai_quota_management": true}'::JSONB
)
ON CONFLICT (tier) DO NOTHING; -- Don't overwrite existing tiers

COMMIT;
