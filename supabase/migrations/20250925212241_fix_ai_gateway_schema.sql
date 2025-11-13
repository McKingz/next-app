-- Fix AI Gateway Schema Issues
-- Creates missing ai_services table and ai_usage_logs table for the AI Gateway function
-- Addresses 400 errors in AI Lesson Generator

BEGIN;

-- ====================================================================
-- 1. ENSURE AI_SERVICES TABLE HAS CORRECT SCHEMA
-- ====================================================================
-- Add missing columns if they don't exist (tables already exist from previous migrations)

DO $$
BEGIN
    -- Add missing columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_services' AND column_name = 'max_tokens') THEN
        ALTER TABLE public.ai_services ADD COLUMN max_tokens INTEGER;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_services' AND column_name = 'context_window') THEN
        ALTER TABLE public.ai_services ADD COLUMN context_window INTEGER;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_services' AND column_name = 'description') THEN
        ALTER TABLE public.ai_services ADD COLUMN description TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_services' AND column_name = 'capabilities') THEN
        ALTER TABLE public.ai_services ADD COLUMN capabilities JSONB DEFAULT '[]'::jsonb;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_services' AND column_name = 'restrictions') THEN
        ALTER TABLE public.ai_services ADD COLUMN restrictions JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS ai_services_provider_idx ON public.ai_services (provider);
CREATE INDEX IF NOT EXISTS ai_services_active_idx ON public.ai_services (is_active, is_available);

-- ====================================================================
-- 2. CREATE AI_USAGE_LOGS TABLE  
-- ====================================================================
-- This table has different schema than ai_usage table, matching AI Gateway expectations

CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Service and model information
  ai_service_id TEXT REFERENCES public.ai_services (id),
  ai_model_used TEXT NOT NULL,

  -- Request details
  system_prompt TEXT,
  input_text TEXT,
  output_text TEXT,
  service_type TEXT NOT NULL, -- 'lesson_generation', 'homework_help', 'grading_assistance'

  -- Usage metrics
  input_tokens INTEGER,
  output_tokens INTEGER,
  total_cost DECIMAL(10, 6),
  processing_time_ms INTEGER,

  -- User and organization
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.preschools (id) ON DELETE CASCADE,
  preschool_id UUID REFERENCES public.preschools (id) ON DELETE CASCADE,

  -- Status and error handling
  status TEXT NOT NULL DEFAULT 'success', -- 'success', 'error', 'timeout'
  error_message TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}'::JSONB,
  request_id TEXT, -- For tracing
  user_agent TEXT,
  ip_address INET,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CHECK (status IN ('success', 'error', 'timeout', 'cancelled')),
  CHECK (service_type IN ('lesson_generation', 'homework_help', 'grading_assistance', 'general'))
);

-- Add indexes for performance and queries
CREATE INDEX IF NOT EXISTS ai_usage_logs_user_id_idx ON public.ai_usage_logs (user_id);
CREATE INDEX IF NOT EXISTS ai_usage_logs_org_id_idx ON public.ai_usage_logs (organization_id);
CREATE INDEX IF NOT EXISTS ai_usage_logs_service_type_idx ON public.ai_usage_logs (service_type);
CREATE INDEX IF NOT EXISTS ai_usage_logs_status_idx ON public.ai_usage_logs (status);
CREATE INDEX IF NOT EXISTS ai_usage_logs_created_at_idx ON public.ai_usage_logs (created_at);
CREATE INDEX IF NOT EXISTS ai_usage_logs_user_created_idx ON public.ai_usage_logs (user_id, created_at);

-- ====================================================================
-- 3. ENABLE RLS ON BOTH TABLES
-- ====================================================================

ALTER TABLE public.ai_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- ====================================================================
-- 4. CREATE RLS POLICIES
-- ====================================================================

-- AI Services - Public read access for service info, admin write access
DROP POLICY IF EXISTS ai_services_read_policy ON public.ai_services;
CREATE POLICY ai_services_read_policy ON public.ai_services
FOR SELECT TO authenticated
USING (is_active = TRUE AND is_available = TRUE);

DROP POLICY IF EXISTS ai_services_write_policy ON public.ai_services;
CREATE POLICY ai_services_write_policy ON public.ai_services
FOR INSERT TO authenticated
WITH CHECK (TRUE); -- Allow upserts from Edge Functions

-- AI Usage Logs - Users can only see their own logs
DROP POLICY IF EXISTS ai_usage_logs_read_policy ON public.ai_usage_logs;
CREATE POLICY ai_usage_logs_read_policy ON public.ai_usage_logs
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR
  organization_id IN (
    SELECT organization_id
    FROM public.profiles
    WHERE
      id = auth.uid()
      AND role IN ('principal', 'admin')
  )
);

DROP POLICY IF EXISTS ai_usage_logs_write_policy ON public.ai_usage_logs;
CREATE POLICY ai_usage_logs_write_policy ON public.ai_usage_logs
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- ====================================================================
-- 5. GRANT PERMISSIONS
-- ====================================================================

GRANT SELECT, INSERT, UPDATE ON public.ai_services TO authenticated;
GRANT SELECT, INSERT ON public.ai_usage_logs TO authenticated;

-- ====================================================================
-- 6. SEED AI_SERVICES WITH CLAUDE MODELS
-- ====================================================================

-- Update or insert Claude models data safely
DO $$
DECLARE
    haiku_id UUID := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    sonnet_id UUID := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22'; 
    opus_id UUID := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33';
BEGIN
    -- Claude 3 Haiku
    INSERT INTO public.ai_services (id, name, provider, model_version, input_cost_per_1k_tokens, output_cost_per_1k_tokens, is_active, is_available, max_tokens, context_window, description)
    VALUES (haiku_id, 'Claude 3 Haiku (2024-03-07)', 'anthropic', 'claude-3-haiku-20240307', 0.00025, 0.00125, true, true, 4096, 200000, 'Fast and efficient model for everyday tasks')
    ON CONFLICT (id) DO UPDATE SET
        model_version = EXCLUDED.model_version,
        input_cost_per_1k_tokens = EXCLUDED.input_cost_per_1k_tokens,
        output_cost_per_1k_tokens = EXCLUDED.output_cost_per_1k_tokens,
        is_active = EXCLUDED.is_active,
        is_available = EXCLUDED.is_available,
        max_tokens = EXCLUDED.max_tokens,
        context_window = EXCLUDED.context_window,
        description = EXCLUDED.description;
        
    -- If name conflict, try to update by name
    IF NOT FOUND THEN
        UPDATE public.ai_services SET 
            provider = 'anthropic',
            model_version = 'claude-3-haiku-20240307',
            input_cost_per_1k_tokens = 0.00025,
            output_cost_per_1k_tokens = 0.00125,
            is_active = true,
            is_available = true,
            max_tokens = 4096,
            context_window = 200000,
            description = 'Fast and efficient model for everyday tasks'
        WHERE name ILIKE '%haiku%' AND provider = 'anthropic';
    END IF;

    -- Claude 3.5 Sonnet  
    INSERT INTO public.ai_services (id, name, provider, model_version, input_cost_per_1k_tokens, output_cost_per_1k_tokens, is_active, is_available, max_tokens, context_window, description)
    VALUES (sonnet_id, 'Claude 3.5 Sonnet (2024-10-22)', 'anthropic', 'claude-3-5-sonnet-20241022', 0.003, 0.015, true, true, 8192, 200000, 'Balanced model for complex reasoning')
    ON CONFLICT (id) DO UPDATE SET
        model_version = EXCLUDED.model_version,
        input_cost_per_1k_tokens = EXCLUDED.input_cost_per_1k_tokens,
        output_cost_per_1k_tokens = EXCLUDED.output_cost_per_1k_tokens,
        is_active = EXCLUDED.is_active,
        is_available = EXCLUDED.is_available,
        max_tokens = EXCLUDED.max_tokens,
        context_window = EXCLUDED.context_window,
        description = EXCLUDED.description;
        
    -- If name conflict, try to update by name
    IF NOT FOUND THEN
        UPDATE public.ai_services SET 
            provider = 'anthropic',
            model_version = 'claude-3-5-sonnet-20241022',
            input_cost_per_1k_tokens = 0.003,
            output_cost_per_1k_tokens = 0.015,
            is_active = true,
            is_available = true,
            max_tokens = 8192,
            context_window = 200000,
            description = 'Balanced model for complex reasoning'
        WHERE name ILIKE '%sonnet%' AND provider = 'anthropic';
    END IF;
    
    -- Claude 3 Opus
    INSERT INTO public.ai_services (id, name, provider, model_version, input_cost_per_1k_tokens, output_cost_per_1k_tokens, is_active, is_available, max_tokens, context_window, description)  
    VALUES (opus_id, 'Claude 3 Opus (2024-02-29)', 'anthropic', 'claude-3-opus-20240229', 0.015, 0.075, true, true, 4096, 200000, 'Most capable model for complex tasks')
    ON CONFLICT (id) DO UPDATE SET
        model_version = EXCLUDED.model_version,
        input_cost_per_1k_tokens = EXCLUDED.input_cost_per_1k_tokens,
        output_cost_per_1k_tokens = EXCLUDED.output_cost_per_1k_tokens,
        is_active = EXCLUDED.is_active,
        is_available = EXCLUDED.is_available,
        max_tokens = EXCLUDED.max_tokens,
        context_window = EXCLUDED.context_window,
        description = EXCLUDED.description;
        
    -- If name conflict, try to update by name  
    IF NOT FOUND THEN
        UPDATE public.ai_services SET 
            provider = 'anthropic',
            model_version = 'claude-3-opus-20240229',
            input_cost_per_1k_tokens = 0.015,
            output_cost_per_1k_tokens = 0.075,
            is_active = true,
            is_available = true,
            max_tokens = 4096,
            context_window = 200000,
            description = 'Most capable model for complex tasks'
        WHERE name ILIKE '%opus%' AND provider = 'anthropic';
    END IF;
END $$;

-- ====================================================================
-- 7. CREATE HELPFUL FUNCTIONS
-- ====================================================================

-- Function to get AI usage statistics
CREATE OR REPLACE FUNCTION public.get_user_ai_usage_stats(
  p_user_id UUID DEFAULT auth.uid(),
  p_period_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  service_type TEXT,
  total_requests BIGINT,
  total_tokens BIGINT,
  total_cost DECIMAL,
  avg_tokens_per_request DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        logs.service_type,
        COUNT(*) as total_requests,
        COALESCE(SUM(logs.input_tokens + logs.output_tokens), 0) as total_tokens,
        COALESCE(SUM(logs.total_cost), 0) as total_cost,
        CASE 
            WHEN COUNT(*) > 0 THEN COALESCE(SUM(logs.input_tokens + logs.output_tokens), 0)::DECIMAL / COUNT(*)
            ELSE 0
        END as avg_tokens_per_request
    FROM public.ai_usage_logs logs
    WHERE logs.user_id = p_user_id
        AND logs.created_at >= (now() - (p_period_days || ' days')::interval)
        AND logs.status = 'success'
    GROUP BY logs.service_type
    ORDER BY total_requests DESC;
END;
$$;

-- Function to check if user has exceeded quota
CREATE OR REPLACE FUNCTION public.check_ai_quota(
  p_user_id UUID DEFAULT auth.uid(),
  p_service_type TEXT DEFAULT 'lesson_generation',
  p_period_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  requests_used BIGINT,
  quota_limit INTEGER,
  quota_remaining INTEGER,
  is_over_quota BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_requests_used BIGINT;
    v_quota_limit INTEGER := 50; -- Default limit
    v_user_tier TEXT;
BEGIN
    -- Get user's tier from profiles or preschool
    SELECT COALESCE(p.subscription_tier, ps.subscription_tier, 'free') 
    INTO v_user_tier
    FROM public.profiles p
    LEFT JOIN public.preschools ps ON p.organization_id = ps.id
    WHERE p.id = p_user_id;
    
    -- Set quota based on tier and service type
    IF v_user_tier IN ('premium', 'enterprise') THEN
        v_quota_limit := CASE p_service_type 
            WHEN 'lesson_generation' THEN 500
            WHEN 'homework_help' THEN 1000  
            WHEN 'grading_assistance' THEN 300
            ELSE 100
        END;
    ELSIF v_user_tier = 'starter' THEN
        v_quota_limit := CASE p_service_type
            WHEN 'lesson_generation' THEN 100
            WHEN 'homework_help' THEN 200
            WHEN 'grading_assistance' THEN 50
            ELSE 25
        END;
    ELSE -- free tier
        v_quota_limit := CASE p_service_type
            WHEN 'lesson_generation' THEN 10
            WHEN 'homework_help' THEN 25
            WHEN 'grading_assistance' THEN 5
            ELSE 5
        END;
    END IF;
    
    -- Count recent usage
    SELECT COUNT(*)
    INTO v_requests_used
    FROM public.ai_usage_logs
    WHERE user_id = p_user_id
        AND service_type = p_service_type
        AND created_at >= (now() - (p_period_days || ' days')::interval)
        AND status = 'success';
    
    -- Return results
    RETURN QUERY
    SELECT 
        v_requests_used,
        v_quota_limit,
        GREATEST(0, v_quota_limit - v_requests_used::INTEGER) as quota_remaining,
        v_requests_used >= v_quota_limit as is_over_quota;
END;
$$;

-- Add helpful comments
COMMENT ON TABLE public.ai_services IS 'AI service providers and models configuration';
COMMENT ON TABLE public.ai_usage_logs IS 'Comprehensive AI usage logging for quota management and analytics';
COMMENT ON FUNCTION public.get_user_ai_usage_stats IS 'Get AI usage statistics for a user over specified period';
COMMENT ON FUNCTION public.check_ai_quota IS 'Check if user has exceeded their AI usage quota for a service type';

COMMIT;
