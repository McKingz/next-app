-- Voice Usage Limits and Rate Limiting System
-- Implements subscription-based quotas for STT and TTS services

-- Voice usage quotas per subscription tier
CREATE TABLE IF NOT EXISTS public.voice_usage_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_tier TEXT NOT NULL CHECK (subscription_tier IN ('free', 'starter', 'professional', 'enterprise')),
  
  -- Daily limits (resets at midnight UTC)
  stt_daily_minutes INTEGER NOT NULL DEFAULT 10,        -- STT minutes per day
  tts_daily_characters INTEGER NOT NULL DEFAULT 5000,   -- TTS characters per day
  
  -- Monthly limits (resets on 1st of month)
  stt_monthly_minutes INTEGER NOT NULL DEFAULT 100,     -- STT minutes per month
  tts_monthly_characters INTEGER NOT NULL DEFAULT 50000, -- TTS characters per month
  
  -- Rate limits (per minute)
  stt_requests_per_minute INTEGER NOT NULL DEFAULT 10,
  tts_requests_per_minute INTEGER NOT NULL DEFAULT 20,
  
  -- Cost caps (USD)
  daily_cost_cap_usd NUMERIC DEFAULT 1.00,
  monthly_cost_cap_usd NUMERIC DEFAULT 10.00,
  
  -- Feature flags
  can_use_premium_voices BOOLEAN DEFAULT false,
  can_use_whisper_stt BOOLEAN DEFAULT true,
  can_use_azure_stt BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE (subscription_tier)
);

-- Default quota configurations per tier
INSERT INTO public.voice_usage_quotas (
  subscription_tier, 
  stt_daily_minutes, tts_daily_characters,
  stt_monthly_minutes, tts_monthly_characters,
  stt_requests_per_minute, tts_requests_per_minute,
  daily_cost_cap_usd, monthly_cost_cap_usd,
  can_use_premium_voices, can_use_whisper_stt, can_use_azure_stt
) VALUES 
  -- Free tier: Very limited for testing
  ('free', 5, 2000, 30, 20000, 5, 10, 0.50, 3.00, false, true, false),
  
  -- Starter tier: Small schools/individual teachers
  ('starter', 15, 10000, 200, 100000, 10, 20, 2.00, 15.00, false, true, false),
  
  -- Professional tier: Medium schools with multiple teachers
  ('professional', 60, 50000, 1000, 500000, 30, 50, 5.00, 50.00, true, true, true),
  
  -- Enterprise tier: Large schools with unlimited usage
  ('enterprise', 500, 500000, 10000, 5000000, 100, 200, 50.00, 500.00, true, true, true)
ON CONFLICT (subscription_tier) DO NOTHING;

-- User voice usage tracking (aggregated daily/monthly)
CREATE TABLE IF NOT EXISTS public.user_voice_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  preschool_id UUID NOT NULL REFERENCES public.preschools(id) ON DELETE CASCADE,
  
  -- Current period tracking
  period_type TEXT NOT NULL CHECK (period_type IN ('daily', 'monthly')),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  
  -- STT usage
  stt_total_minutes NUMERIC DEFAULT 0,
  stt_request_count INTEGER DEFAULT 0,
  stt_total_cost_usd NUMERIC DEFAULT 0,
  
  -- TTS usage
  tts_total_characters INTEGER DEFAULT 0,
  tts_request_count INTEGER DEFAULT 0,
  tts_total_cost_usd NUMERIC DEFAULT 0,
  
  -- Combined totals
  total_cost_usd NUMERIC DEFAULT 0,
  
  -- Rate limiting (rolling window)
  last_reset_at TIMESTAMPTZ DEFAULT now(),
  requests_in_current_minute INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE (user_id, period_type, period_start)
);

CREATE INDEX idx_user_voice_usage_user_period ON public.user_voice_usage(user_id, period_type, period_start);
CREATE INDEX idx_user_voice_usage_preschool ON public.user_voice_usage(preschool_id, period_type);

-- Preschool-level voice usage aggregation
CREATE TABLE IF NOT EXISTS public.preschool_voice_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preschool_id UUID NOT NULL REFERENCES public.preschools(id) ON DELETE CASCADE,
  subscription_tier TEXT NOT NULL CHECK (subscription_tier IN ('free', 'starter', 'professional', 'enterprise')),
  
  period_type TEXT NOT NULL CHECK (period_type IN ('daily', 'monthly')),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  
  -- Aggregated usage across all users
  total_stt_minutes NUMERIC DEFAULT 0,
  total_tts_characters INTEGER DEFAULT 0,
  total_stt_requests INTEGER DEFAULT 0,
  total_tts_requests INTEGER DEFAULT 0,
  total_cost_usd NUMERIC DEFAULT 0,
  
  -- Quota enforcement
  quota_exceeded BOOLEAN DEFAULT false,
  quota_exceeded_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE (preschool_id, period_type, period_start)
);

CREATE INDEX idx_preschool_voice_usage_period ON public.preschool_voice_usage(preschool_id, period_type, period_start);

-- Function to check if user can use voice service
CREATE OR REPLACE FUNCTION public.check_voice_usage_limit(
  p_user_id UUID,
  p_preschool_id UUID,
  p_service TEXT, -- 'stt' or 'tts'
  p_estimated_units NUMERIC -- minutes for STT, characters for TTS
) RETURNS JSONB AS $$
DECLARE
  v_tier TEXT;
  v_quota RECORD;
  v_daily_usage RECORD;
  v_monthly_usage RECORD;
  v_can_proceed BOOLEAN := false;
  v_reason TEXT := '';
  v_quota_remaining JSONB;
BEGIN
  -- Get preschool subscription tier
  SELECT subscription_tier INTO v_tier
  FROM public.preschools
  WHERE id = p_preschool_id;
  
  IF v_tier IS NULL THEN
    v_tier := 'free'; -- Default to free tier
  END IF;
  
  -- Get quota limits
  SELECT * INTO v_quota
  FROM public.voice_usage_quotas
  WHERE subscription_tier = v_tier;
  
  -- Get current daily usage
  SELECT * INTO v_daily_usage
  FROM public.user_voice_usage
  WHERE user_id = p_user_id
    AND period_type = 'daily'
    AND period_start::date = CURRENT_DATE
  ORDER BY period_start DESC
  LIMIT 1;
  
  -- Get current monthly usage
  SELECT * INTO v_monthly_usage
  FROM public.user_voice_usage
  WHERE user_id = p_user_id
    AND period_type = 'monthly'
    AND period_start >= date_trunc('month', CURRENT_DATE)
  ORDER BY period_start DESC
  LIMIT 1;
  
  -- Initialize if no records exist
  IF v_daily_usage IS NULL THEN
    v_daily_usage := ROW(
      gen_random_uuid(), p_user_id, p_preschool_id, 'daily',
      CURRENT_DATE, CURRENT_DATE + INTERVAL '1 day',
      0, 0, 0, 0, 0, 0, 0, now(), 0, now(), now()
    )::public.user_voice_usage;
  END IF;
  
  IF v_monthly_usage IS NULL THEN
    v_monthly_usage := ROW(
      gen_random_uuid(), p_user_id, p_preschool_id, 'monthly',
      date_trunc('month', CURRENT_DATE), 
      date_trunc('month', CURRENT_DATE) + INTERVAL '1 month',
      0, 0, 0, 0, 0, 0, 0, now(), 0, now(), now()
    )::public.user_voice_usage;
  END IF;
  
  -- Check limits based on service type
  IF p_service = 'stt' THEN
    -- Check daily STT limit
    IF (COALESCE(v_daily_usage.stt_total_minutes, 0) + p_estimated_units) > v_quota.stt_daily_minutes THEN
      v_reason := format('Daily STT limit exceeded: %s/%s minutes used', 
                        COALESCE(v_daily_usage.stt_total_minutes, 0), 
                        v_quota.stt_daily_minutes);
    -- Check monthly STT limit
    ELSIF (COALESCE(v_monthly_usage.stt_total_minutes, 0) + p_estimated_units) > v_quota.stt_monthly_minutes THEN
      v_reason := format('Monthly STT limit exceeded: %s/%s minutes used', 
                        COALESCE(v_monthly_usage.stt_total_minutes, 0), 
                        v_quota.stt_monthly_minutes);
    -- Check daily cost cap
    ELSIF (COALESCE(v_daily_usage.total_cost_usd, 0) + (p_estimated_units * 0.006 / 60)) > v_quota.daily_cost_cap_usd THEN
      v_reason := format('Daily cost cap exceeded: $%s/$%s', 
                        COALESCE(v_daily_usage.total_cost_usd, 0), 
                        v_quota.daily_cost_cap_usd);
    ELSE
      v_can_proceed := true;
    END IF;
    
  ELSIF p_service = 'tts' THEN
    -- Check daily TTS limit
    IF (COALESCE(v_daily_usage.tts_total_characters, 0) + p_estimated_units) > v_quota.tts_daily_characters THEN
      v_reason := format('Daily TTS limit exceeded: %s/%s characters used', 
                        COALESCE(v_daily_usage.tts_total_characters, 0), 
                        v_quota.tts_daily_characters);
    -- Check monthly TTS limit
    ELSIF (COALESCE(v_monthly_usage.tts_total_characters, 0) + p_estimated_units) > v_quota.tts_monthly_characters THEN
      v_reason := format('Monthly TTS limit exceeded: %s/%s characters used', 
                        COALESCE(v_monthly_usage.tts_total_characters, 0), 
                        v_quota.tts_monthly_characters);
    -- Check daily cost cap
    ELSIF (COALESCE(v_daily_usage.total_cost_usd, 0) + (p_estimated_units * 0.000016)) > v_quota.daily_cost_cap_usd THEN
      v_reason := format('Daily cost cap exceeded: $%s/$%s', 
                        COALESCE(v_daily_usage.total_cost_usd, 0), 
                        v_quota.daily_cost_cap_usd);
    ELSE
      v_can_proceed := true;
    END IF;
  END IF;
  
  -- Build quota remaining response
  v_quota_remaining := jsonb_build_object(
    'tier', v_tier,
    'daily', jsonb_build_object(
      'stt_minutes_remaining', v_quota.stt_daily_minutes - COALESCE(v_daily_usage.stt_total_minutes, 0),
      'tts_characters_remaining', v_quota.tts_daily_characters - COALESCE(v_daily_usage.tts_total_characters, 0),
      'cost_remaining_usd', v_quota.daily_cost_cap_usd - COALESCE(v_daily_usage.total_cost_usd, 0)
    ),
    'monthly', jsonb_build_object(
      'stt_minutes_remaining', v_quota.stt_monthly_minutes - COALESCE(v_monthly_usage.stt_total_minutes, 0),
      'tts_characters_remaining', v_quota.tts_monthly_characters - COALESCE(v_monthly_usage.tts_total_characters, 0),
      'cost_remaining_usd', v_quota.monthly_cost_cap_usd - COALESCE(v_monthly_usage.total_cost_usd, 0)
    )
  );
  
  RETURN jsonb_build_object(
    'allowed', v_can_proceed,
    'reason', v_reason,
    'tier', v_tier,
    'quota_remaining', v_quota_remaining
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record voice usage
CREATE OR REPLACE FUNCTION public.record_voice_usage(
  p_user_id UUID,
  p_preschool_id UUID,
  p_service TEXT,
  p_units NUMERIC,
  p_cost_usd NUMERIC,
  p_provider TEXT,
  p_language TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_daily_id UUID;
  v_monthly_id UUID;
BEGIN
  -- Update or insert daily usage
  INSERT INTO public.user_voice_usage (
    user_id, preschool_id, period_type, period_start, period_end,
    stt_total_minutes, stt_request_count, stt_total_cost_usd,
    tts_total_characters, tts_request_count, tts_total_cost_usd,
    total_cost_usd
  ) VALUES (
    p_user_id, p_preschool_id, 'daily',
    CURRENT_DATE, CURRENT_DATE + INTERVAL '1 day',
    CASE WHEN p_service = 'stt' THEN p_units ELSE 0 END,
    CASE WHEN p_service = 'stt' THEN 1 ELSE 0 END,
    CASE WHEN p_service = 'stt' THEN p_cost_usd ELSE 0 END,
    CASE WHEN p_service = 'tts' THEN p_units::INTEGER ELSE 0 END,
    CASE WHEN p_service = 'tts' THEN 1 ELSE 0 END,
    CASE WHEN p_service = 'tts' THEN p_cost_usd ELSE 0 END,
    p_cost_usd
  )
  ON CONFLICT (user_id, period_type, period_start) DO UPDATE SET
    stt_total_minutes = public.user_voice_usage.stt_total_minutes + 
      CASE WHEN p_service = 'stt' THEN p_units ELSE 0 END,
    stt_request_count = public.user_voice_usage.stt_request_count + 
      CASE WHEN p_service = 'stt' THEN 1 ELSE 0 END,
    stt_total_cost_usd = public.user_voice_usage.stt_total_cost_usd + 
      CASE WHEN p_service = 'stt' THEN p_cost_usd ELSE 0 END,
    tts_total_characters = public.user_voice_usage.tts_total_characters + 
      CASE WHEN p_service = 'tts' THEN p_units::INTEGER ELSE 0 END,
    tts_request_count = public.user_voice_usage.tts_request_count + 
      CASE WHEN p_service = 'tts' THEN 1 ELSE 0 END,
    tts_total_cost_usd = public.user_voice_usage.tts_total_cost_usd + 
      CASE WHEN p_service = 'tts' THEN p_cost_usd ELSE 0 END,
    total_cost_usd = public.user_voice_usage.total_cost_usd + p_cost_usd,
    updated_at = now();
  
  -- Update or insert monthly usage
  INSERT INTO public.user_voice_usage (
    user_id, preschool_id, period_type, period_start, period_end,
    stt_total_minutes, stt_request_count, stt_total_cost_usd,
    tts_total_characters, tts_request_count, tts_total_cost_usd,
    total_cost_usd
  ) VALUES (
    p_user_id, p_preschool_id, 'monthly',
    date_trunc('month', CURRENT_DATE),
    date_trunc('month', CURRENT_DATE) + INTERVAL '1 month',
    CASE WHEN p_service = 'stt' THEN p_units ELSE 0 END,
    CASE WHEN p_service = 'stt' THEN 1 ELSE 0 END,
    CASE WHEN p_service = 'stt' THEN p_cost_usd ELSE 0 END,
    CASE WHEN p_service = 'tts' THEN p_units::INTEGER ELSE 0 END,
    CASE WHEN p_service = 'tts' THEN 1 ELSE 0 END,
    CASE WHEN p_service = 'tts' THEN p_cost_usd ELSE 0 END,
    p_cost_usd
  )
  ON CONFLICT (user_id, period_type, period_start) DO UPDATE SET
    stt_total_minutes = public.user_voice_usage.stt_total_minutes + 
      CASE WHEN p_service = 'stt' THEN p_units ELSE 0 END,
    stt_request_count = public.user_voice_usage.stt_request_count + 
      CASE WHEN p_service = 'stt' THEN 1 ELSE 0 END,
    stt_total_cost_usd = public.user_voice_usage.stt_total_cost_usd + 
      CASE WHEN p_service = 'stt' THEN p_cost_usd ELSE 0 END,
    tts_total_characters = public.user_voice_usage.tts_total_characters + 
      CASE WHEN p_service = 'tts' THEN p_units::INTEGER ELSE 0 END,
    tts_request_count = public.user_voice_usage.tts_request_count + 
      CASE WHEN p_service = 'tts' THEN 1 ELSE 0 END,
    tts_total_cost_usd = public.user_voice_usage.tts_total_cost_usd + 
      CASE WHEN p_service = 'tts' THEN p_cost_usd ELSE 0 END,
    total_cost_usd = public.user_voice_usage.total_cost_usd + p_cost_usd,
    updated_at = now();
  
  -- Log to voice_usage_logs
  INSERT INTO public.voice_usage_logs (
    preschool_id, user_id, service, provider, language_code,
    units, cost_estimate_usd, success
  ) VALUES (
    p_preschool_id, p_user_id, p_service, p_provider, p_language,
    p_units, p_cost_usd, true
  );
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS
ALTER TABLE public.voice_usage_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_voice_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preschool_voice_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view quotas" ON public.voice_usage_quotas FOR SELECT USING (true);

CREATE POLICY "Users can view own usage" ON public.user_voice_usage FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage usage" ON public.user_voice_usage FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Preschool admins can view preschool usage" ON public.preschool_voice_usage FOR SELECT
  USING (preschool_id = (auth.jwt()->>'preschool_id')::uuid);

-- Auto-update triggers
CREATE TRIGGER update_voice_quotas_updated_at
  BEFORE UPDATE ON public.voice_usage_quotas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_voice_usage_updated_at
  BEFORE UPDATE ON public.user_voice_usage
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_preschool_voice_usage_updated_at
  BEFORE UPDATE ON public.preschool_voice_usage
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
