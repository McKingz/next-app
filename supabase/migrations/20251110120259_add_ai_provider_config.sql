-- AI Provider Configuration Table
-- Allows superadmin to control which AI provider and models to use per scenario

CREATE TABLE IF NOT EXISTS ai_provider_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Per-scenario configuration
  service_type TEXT NOT NULL CHECK (service_type IN (
    'homework_help', 
    'lesson_generation', 
    'grading_assistance', 
    'dash_conversation',
    'general'
  )),
  
  -- Provider override for this scenario (null = use global default)
  provider_override TEXT CHECK (provider_override IN ('claude', 'openai') OR provider_override IS NULL),
  
  -- Model selection by tier
  model_free TEXT,      -- Model for free tier users
  model_basic TEXT,     -- Model for basic tier users
  model_premium TEXT,   -- Model for premium/trial tier users
  model_pro TEXT,       -- Model for pro tier users
  model_enterprise TEXT, -- Model for enterprise tier users
  
  -- Additional settings
  max_tokens INTEGER DEFAULT 4096,
  temperature DECIMAL(3,2) DEFAULT 0.7,
  
  -- Metadata
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  
  -- Ensure one config per service_type
  UNIQUE(service_type)
);

-- Create index for faster lookups
CREATE INDEX idx_ai_provider_config_service_type ON ai_provider_config(service_type);
CREATE INDEX idx_ai_provider_config_active ON ai_provider_config(is_active);

-- Global AI settings (singleton table)
CREATE TABLE IF NOT EXISTS ai_global_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Global provider preference
  default_provider TEXT NOT NULL DEFAULT 'claude' CHECK (default_provider IN ('claude', 'openai')),
  
  -- Fallback behavior
  enable_automatic_fallback BOOLEAN NOT NULL DEFAULT true,
  fallback_provider TEXT NOT NULL DEFAULT 'openai' CHECK (fallback_provider IN ('claude', 'openai')),
  
  -- Rate limit handling
  max_retries INTEGER DEFAULT 3,
  retry_delay_seconds INTEGER DEFAULT 5,
  
  -- Metadata
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES profiles(id),
  
  -- Ensure only one row exists
  CHECK (id = '00000000-0000-0000-0000-000000000001'::uuid)
);

-- Insert default global settings
INSERT INTO ai_global_settings (
  id,
  default_provider,
  enable_automatic_fallback,
  fallback_provider,
  max_retries,
  retry_delay_seconds
) VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'claude',
  true,
  'openai',
  3,
  5
) ON CONFLICT (id) DO NOTHING;

-- Insert default configurations for each service type
INSERT INTO ai_provider_config (service_type, provider_override, model_free, model_basic, model_premium, model_pro, model_enterprise, description, is_active) VALUES
  ('homework_help', 'openai', 'gpt-3.5-turbo', 'gpt-4', 'gpt-4', 'gpt-4-turbo', 'gpt-4-turbo', 'Student homework assistance and exam generation', true),
  ('lesson_generation', 'claude', 'claude-3-haiku-20240307', 'claude-3-sonnet-20240229', 'claude-3-5-sonnet-20241022', 'claude-3-5-sonnet-20241022', 'claude-3-5-sonnet-20241022', 'Teacher lesson plan and content generation', true),
  ('grading_assistance', 'claude', 'claude-3-haiku-20240307', 'claude-3-sonnet-20240229', 'claude-3-5-sonnet-20241022', 'claude-3-5-sonnet-20241022', 'claude-3-5-sonnet-20241022', 'Automated grading and feedback', true),
  ('dash_conversation', 'openai', 'gpt-3.5-turbo', 'gpt-4', 'gpt-4', 'gpt-4-turbo', 'gpt-4-turbo', 'Dash AI conversational assistant', true),
  ('general', NULL, 'claude-3-haiku-20240307', 'claude-3-sonnet-20240229', 'claude-3-5-sonnet-20241022', 'claude-3-5-sonnet-20241022', 'claude-3-5-sonnet-20241022', 'General AI requests (uses global default)', true)
ON CONFLICT (service_type) DO NOTHING;

-- RLS policies for ai_provider_config (superadmin only)
ALTER TABLE ai_provider_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmins can view AI provider config"
  ON ai_provider_config FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'superadmin'
    )
  );

CREATE POLICY "Superadmins can update AI provider config"
  ON ai_provider_config FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'superadmin'
    )
  );

CREATE POLICY "Superadmins can insert AI provider config"
  ON ai_provider_config FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'superadmin'
    )
  );

-- RLS policies for ai_global_settings (superadmin only)
ALTER TABLE ai_global_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmins can view AI global settings"
  ON ai_global_settings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'superadmin'
    )
  );

CREATE POLICY "Superadmins can update AI global settings"
  ON ai_global_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'superadmin'
    )
  );

-- Function to get AI config for a service type and tier
CREATE OR REPLACE FUNCTION get_ai_config(
  p_service_type TEXT,
  p_tier TEXT DEFAULT 'free'
)
RETURNS TABLE (
  provider TEXT,
  model TEXT,
  max_tokens INTEGER,
  temperature DECIMAL,
  fallback_enabled BOOLEAN
) AS $$
DECLARE
  v_config RECORD;
  v_global RECORD;
  v_model TEXT;
BEGIN
  -- Get global settings
  SELECT * INTO v_global FROM ai_global_settings WHERE id = '00000000-0000-0000-0000-000000000001'::uuid;
  
  -- Get service-specific config
  SELECT * INTO v_config FROM ai_provider_config WHERE service_type = p_service_type AND is_active = true;
  
  -- If no config found, return defaults
  IF v_config IS NULL THEN
    RETURN QUERY SELECT 
      v_global.default_provider,
      CASE p_tier
        WHEN 'free' THEN 'claude-3-haiku-20240307'
        WHEN 'basic' THEN 'claude-3-sonnet-20240229'
        WHEN 'premium' THEN 'claude-3-5-sonnet-20241022'
        WHEN 'pro' THEN 'claude-3-5-sonnet-20241022'
        WHEN 'enterprise' THEN 'claude-3-5-sonnet-20241022'
        ELSE 'claude-3-haiku-20240307'
      END,
      4096,
      0.7::DECIMAL,
      v_global.enable_automatic_fallback;
    RETURN;
  END IF;
  
  -- Determine provider (service override > global default)
  DECLARE
    v_provider TEXT := COALESCE(v_config.provider_override, v_global.default_provider);
  BEGIN
    -- Select model based on tier
    v_model := CASE p_tier
      WHEN 'free' THEN v_config.model_free
      WHEN 'basic' THEN v_config.model_basic
      WHEN 'premium' THEN v_config.model_premium
      WHEN 'pro' THEN v_config.model_pro
      WHEN 'enterprise' THEN v_config.model_enterprise
      ELSE v_config.model_free
    END;
    
    -- Return configuration
    RETURN QUERY SELECT 
      v_provider,
      v_model,
      v_config.max_tokens,
      v_config.temperature,
      v_global.enable_automatic_fallback;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users (Edge Function will use this)
GRANT EXECUTE ON FUNCTION get_ai_config(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_ai_config(TEXT, TEXT) TO service_role;

COMMENT ON TABLE ai_provider_config IS 'Configuration for AI providers per service type and tier';
COMMENT ON TABLE ai_global_settings IS 'Global AI provider settings (singleton)';
COMMENT ON FUNCTION get_ai_config IS 'Get AI provider and model configuration for a service type and tier';