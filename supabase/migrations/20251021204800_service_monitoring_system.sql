-- SERVICE MONITORING SYSTEM
-- Purpose: Track health, usage, cost, and status of all external services
-- Security: Superadmin-only read access; service_role writes only
-- Compliance: WARP.md Non-negotiable #3 (Authentication Sanctity)
-- 
-- Documentation Sources:
-- - Supabase migrations: https://supabase.com/docs/guides/cli/local-development#database-migrations
-- - PostgreSQL functions: https://www.postgresql.org/docs/current/sql-createfunction.html
-- - RLS: https://supabase.com/docs/guides/auth/row-level-security
-- - pg_cron: https://supabase.com/docs/guides/database/extensions/pg_cron

BEGIN;

-- ============================================================================
-- SECTION 1: EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- ============================================================================
-- SECTION 2: TABLES
-- ============================================================================

-- Service health status tracking (real-time health monitoring)
CREATE TABLE IF NOT EXISTS public.service_health_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name TEXT NOT NULL UNIQUE,
  service_category TEXT NOT NULL CHECK (service_category IN ('infrastructure', 'ai', 'voice', 'payment', 'communication', 'monitoring', 'development')),
  status TEXT NOT NULL CHECK (status IN ('healthy', 'degraded', 'down', 'maintenance', 'unknown')) DEFAULT 'unknown',
  response_time_ms INT,
  error_rate_percent DECIMAL(5,2) DEFAULT 0 CHECK (error_rate_percent >= 0 AND error_rate_percent <= 100),
  circuit_state TEXT DEFAULT 'closed' CHECK (circuit_state IN ('closed', 'open', 'half_open')),
  last_checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_success_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  consecutive_failures INT DEFAULT 0 CHECK (consecutive_failures >= 0),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.service_health_status IS 'Real-time health monitoring for external services';
COMMENT ON COLUMN public.service_health_status.circuit_state IS 'Circuit breaker state: closed=normal, open=failing, half_open=testing recovery';
COMMENT ON COLUMN public.service_health_status.metadata IS 'Additional service-specific health metrics (JSON)';

-- Cost tracking per preschool per service
CREATE TABLE IF NOT EXISTS public.service_cost_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preschool_id UUID REFERENCES public.preschools(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL,
  period_month DATE NOT NULL,
  cost_usd DECIMAL(10,4) NOT NULL DEFAULT 0 CHECK (cost_usd >= 0),
  cost_zar DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (cost_zar >= 0),
  usage_units JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(preschool_id, service_name, period_month)
);

COMMENT ON TABLE public.service_cost_tracking IS 'Monthly cost tracking per preschool per service';
COMMENT ON COLUMN public.service_cost_tracking.period_month IS 'First day of month for cost aggregation';
COMMENT ON COLUMN public.service_cost_tracking.usage_units IS 'Service-specific usage: {tokens: 1000, messages: 50, minutes: 30}';

-- API key management (superadmin only)
CREATE TABLE IF NOT EXISTS public.service_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name TEXT NOT NULL UNIQUE,
  key_alias TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  last_verified_at TIMESTAMPTZ,
  scopes TEXT[] DEFAULT ARRAY[]::TEXT[],
  status TEXT NOT NULL CHECK (status IN ('active', 'expiring', 'expired', 'invalid', 'unknown')) DEFAULT 'unknown',
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.service_api_keys IS 'API key metadata tracking (never stores actual keys)';
COMMENT ON COLUMN public.service_api_keys.key_alias IS 'Environment variable name, e.g. ANTHROPIC_API_KEY';
COMMENT ON COLUMN public.service_api_keys.scopes IS 'API key permissions/scopes array';

-- Service usage limits per tier
CREATE TABLE IF NOT EXISTS public.service_usage_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preschool_id UUID REFERENCES public.preschools(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL,
  tier TEXT NOT NULL,
  soft_limit BIGINT NOT NULL CHECK (soft_limit >= 0),
  hard_limit BIGINT NOT NULL CHECK (hard_limit >= soft_limit),
  usage_this_period BIGINT DEFAULT 0 CHECK (usage_this_period >= 0),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(preschool_id, service_name, period_start),
  CHECK (period_end > period_start)
);

COMMENT ON TABLE public.service_usage_limits IS 'Subscription tier-based usage quotas';
COMMENT ON COLUMN public.service_usage_limits.soft_limit IS 'Warning threshold';
COMMENT ON COLUMN public.service_usage_limits.hard_limit IS 'Hard cutoff threshold';

-- Incident tracking (PII-scrubbed)
CREATE TABLE IF NOT EXISTS public.service_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('ongoing', 'resolved', 'investigating')) DEFAULT 'ongoing',
  summary TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  error_code TEXT,
  pii_scrubbed_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.service_incidents IS 'Service downtime/incident tracking (90-day retention)';
COMMENT ON COLUMN public.service_incidents.pii_scrubbed_message IS 'Error message with PII redacted as [REDACTED]';

-- Alert tracking
CREATE TABLE IF NOT EXISTS public.service_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name TEXT NOT NULL,
  alert_type TEXT NOT NULL,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'in_app')),
  payload JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed', 'resolved')) DEFAULT 'pending',
  dedupe_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(dedupe_key, triggered_at)
);

COMMENT ON TABLE public.service_alerts IS 'Alert delivery tracking with deduplication';
COMMENT ON COLUMN public.service_alerts.alert_type IS 'downtime, slow_response, key_expiring, cost_exceeded, error_spike';
COMMENT ON COLUMN public.service_alerts.dedupe_key IS 'Deduplication key: {service_name}:{alert_type}:{window}';

-- Alert configuration per service
CREATE TABLE IF NOT EXISTS public.service_alert_config (
  service_name TEXT PRIMARY KEY,
  alert_enabled BOOLEAN DEFAULT TRUE,
  alert_channels TEXT[] DEFAULT ARRAY['email', 'in_app']::TEXT[],
  downtime_threshold_minutes INT DEFAULT 5 CHECK (downtime_threshold_minutes > 0),
  response_time_threshold_ms INT DEFAULT 5000 CHECK (response_time_threshold_ms > 0),
  error_rate_threshold_percent DECIMAL(5,2) DEFAULT 5.0 CHECK (error_rate_threshold_percent >= 0 AND error_rate_threshold_percent <= 100),
  budget_usd DECIMAL(10,2) CHECK (budget_usd >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.service_alert_config IS 'Alert threshold configuration per service';
COMMENT ON COLUMN public.service_alert_config.budget_usd IS 'Optional monthly budget threshold';

-- ============================================================================
-- SECTION 3: INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_service_health_name ON public.service_health_status(service_name);
CREATE INDEX IF NOT EXISTS idx_service_health_checked ON public.service_health_status(last_checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_health_status ON public.service_health_status(status) WHERE status != 'healthy';
CREATE INDEX IF NOT EXISTS idx_cost_tracking_preschool ON public.service_cost_tracking(preschool_id, period_month);
CREATE INDEX IF NOT EXISTS idx_cost_tracking_service ON public.service_cost_tracking(service_name, period_month DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_service ON public.service_incidents(service_name, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_ongoing ON public.service_incidents(status) WHERE status = 'ongoing';
CREATE INDEX IF NOT EXISTS idx_alerts_dedupe ON public.service_alerts(dedupe_key, triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_pending ON public.service_alerts(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_api_keys_expiring ON public.service_api_keys(expires_at) WHERE expires_at IS NOT NULL AND status != 'expired';

-- ============================================================================
-- SECTION 4: ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE public.service_health_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_cost_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_usage_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_alert_config ENABLE ROW LEVEL SECURITY;

-- Superadmin read policies (following existing pattern from 20250919125833)
DROP POLICY IF EXISTS superadmin_service_role_access ON public.service_health_status;
CREATE POLICY superadmin_service_role_access ON public.service_health_status
FOR SELECT
TO authenticated
USING (app_auth.is_service_role_superadmin());

DROP POLICY IF EXISTS superadmin_service_role_access ON public.service_cost_tracking;
CREATE POLICY superadmin_service_role_access ON public.service_cost_tracking
FOR SELECT
TO authenticated
USING (app_auth.is_service_role_superadmin());

DROP POLICY IF EXISTS superadmin_service_role_access ON public.service_api_keys;
CREATE POLICY superadmin_service_role_access ON public.service_api_keys
FOR SELECT
TO authenticated
USING (app_auth.is_service_role_superadmin());

DROP POLICY IF EXISTS superadmin_service_role_access ON public.service_usage_limits;
CREATE POLICY superadmin_service_role_access ON public.service_usage_limits
FOR SELECT
TO authenticated
USING (app_auth.is_service_role_superadmin());

DROP POLICY IF EXISTS superadmin_service_role_access ON public.service_incidents;
CREATE POLICY superadmin_service_role_access ON public.service_incidents
FOR SELECT
TO authenticated
USING (app_auth.is_service_role_superadmin());

DROP POLICY IF EXISTS superadmin_service_role_access ON public.service_alerts;
CREATE POLICY superadmin_service_role_access ON public.service_alerts
FOR SELECT
TO authenticated
USING (app_auth.is_service_role_superadmin());

DROP POLICY IF EXISTS superadmin_service_role_access ON public.service_alert_config;
CREATE POLICY superadmin_service_role_access ON public.service_alert_config
FOR SELECT
TO authenticated
USING (app_auth.is_service_role_superadmin());

-- ============================================================================
-- SECTION 5: RPC FUNCTIONS
-- ============================================================================

-- Get service health summary grouped by category
-- Documentation: https://www.postgresql.org/docs/current/sql-createfunction.html
CREATE OR REPLACE FUNCTION public.get_service_health_summary()
RETURNS TABLE (
  category TEXT,
  total_services BIGINT,
  healthy_services BIGINT,
  degraded_services BIGINT,
  down_services BIGINT,
  avg_response_time_ms NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    service_category,
    COUNT(*)::BIGINT,
    COUNT(*) FILTER (WHERE status = 'healthy')::BIGINT,
    COUNT(*) FILTER (WHERE status = 'degraded')::BIGINT,
    COUNT(*) FILTER (WHERE status = 'down')::BIGINT,
    ROUND(AVG(response_time_ms)::NUMERIC, 2)
  FROM public.service_health_status
  WHERE last_checked_at > NOW() - INTERVAL '1 hour'
  GROUP BY service_category
  ORDER BY service_category;
END;
$$;

COMMENT ON FUNCTION public.get_service_health_summary() IS 'Returns health metrics grouped by service category (last hour)';

-- Get monthly service costs
CREATE OR REPLACE FUNCTION public.get_monthly_service_costs(
  p_year INT,
  p_month INT
)
RETURNS TABLE (
  service_name TEXT,
  total_cost_usd NUMERIC,
  total_cost_zar NUMERIC,
  total_usage_units JSONB,
  preschool_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sct.service_name,
    ROUND(SUM(sct.cost_usd)::NUMERIC, 2),
    ROUND(SUM(sct.cost_zar)::NUMERIC, 2),
    jsonb_object_agg(sct.preschool_id, sct.usage_units) FILTER (WHERE sct.preschool_id IS NOT NULL),
    COUNT(DISTINCT sct.preschool_id)::BIGINT
  FROM public.service_cost_tracking sct
  WHERE EXTRACT(YEAR FROM sct.period_month) = p_year
    AND EXTRACT(MONTH FROM sct.period_month) = p_month
  GROUP BY sct.service_name
  ORDER BY SUM(sct.cost_usd) DESC;
END;
$$;

COMMENT ON FUNCTION public.get_monthly_service_costs(INT, INT) IS 'Returns aggregated service costs for specified year and month';

-- Get service usage by preschool
CREATE OR REPLACE FUNCTION public.get_service_usage_by_preschool(
  p_service_name TEXT,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  preschool_id UUID,
  preschool_name TEXT,
  total_cost_usd NUMERIC,
  total_usage_units JSONB,
  months_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sct.preschool_id,
    p.name AS preschool_name,
    ROUND(SUM(sct.cost_usd)::NUMERIC, 2),
    jsonb_object_agg(sct.period_month, sct.usage_units),
    COUNT(DISTINCT sct.period_month)::BIGINT
  FROM public.service_cost_tracking sct
  JOIN public.preschools p ON p.id = sct.preschool_id
  WHERE sct.service_name = p_service_name
    AND sct.period_month BETWEEN p_start_date AND p_end_date
  GROUP BY sct.preschool_id, p.name
  ORDER BY SUM(sct.cost_usd) DESC;
END;
$$;

COMMENT ON FUNCTION public.get_service_usage_by_preschool(TEXT, DATE, DATE) IS 'Returns service usage breakdown per preschool for date range';

-- Get API key expiration alerts
CREATE OR REPLACE FUNCTION public.get_api_key_expiration_alerts()
RETURNS TABLE (
  service_name TEXT,
  key_alias TEXT,
  expires_at TIMESTAMPTZ,
  days_until_expiry INT,
  status TEXT,
  owner_email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sak.service_name,
    sak.key_alias,
    sak.expires_at,
    EXTRACT(DAY FROM (sak.expires_at - NOW()))::INT,
    sak.status,
    sak.owner_email
  FROM public.service_api_keys sak
  WHERE sak.expires_at IS NOT NULL
    AND sak.expires_at > NOW()
    AND sak.expires_at < NOW() + INTERVAL '30 days'
  ORDER BY sak.expires_at ASC;
END;
$$;

COMMENT ON FUNCTION public.get_api_key_expiration_alerts() IS 'Returns API keys expiring within 30 days';

-- Record service health check (called by Edge Functions)
CREATE OR REPLACE FUNCTION public.record_service_health_check(
  p_service_name TEXT,
  p_status TEXT,
  p_response_time_ms INT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_health_id UUID;
  v_consecutive_failures INT := 0;
  v_circuit_state TEXT := 'closed';
BEGIN
  -- Get current consecutive failures
  SELECT consecutive_failures, circuit_state INTO v_consecutive_failures, v_circuit_state
  FROM public.service_health_status
  WHERE service_name = p_service_name;
  
  -- Update failure counter and circuit state
  IF p_status = 'down' THEN
    v_consecutive_failures := COALESCE(v_consecutive_failures, 0) + 1;
    IF v_consecutive_failures >= 5 THEN
      v_circuit_state := 'open';
    END IF;
  ELSE
    v_consecutive_failures := 0;
    IF v_circuit_state = 'open' THEN
      v_circuit_state := 'half_open';
    ELSIF v_circuit_state = 'half_open' THEN
      v_circuit_state := 'closed';
    END IF;
  END IF;
  
  -- Upsert health status
  INSERT INTO public.service_health_status (
    service_name,
    service_category,
    status,
    response_time_ms,
    circuit_state,
    last_checked_at,
    last_success_at,
    last_failure_at,
    consecutive_failures,
    metadata,
    updated_at
  )
  VALUES (
    p_service_name,
    COALESCE((p_metadata->>'category')::TEXT, 'unknown'),
    p_status,
    p_response_time_ms,
    v_circuit_state,
    NOW(),
    CASE WHEN p_status != 'down' THEN NOW() ELSE NULL END,
    CASE WHEN p_status = 'down' THEN NOW() ELSE NULL END,
    v_consecutive_failures,
    p_metadata,
    NOW()
  )
  ON CONFLICT (service_name) 
  DO UPDATE SET
    status = EXCLUDED.status,
    response_time_ms = EXCLUDED.response_time_ms,
    circuit_state = EXCLUDED.circuit_state,
    last_checked_at = EXCLUDED.last_checked_at,
    last_success_at = COALESCE(EXCLUDED.last_success_at, service_health_status.last_success_at),
    last_failure_at = COALESCE(EXCLUDED.last_failure_at, service_health_status.last_failure_at),
    consecutive_failures = EXCLUDED.consecutive_failures,
    metadata = EXCLUDED.metadata,
    updated_at = EXCLUDED.updated_at
  RETURNING id INTO v_health_id;
  
  RETURN v_health_id;
END;
$$;

COMMENT ON FUNCTION public.record_service_health_check(TEXT, TEXT, INT, JSONB) IS 'Records health check with circuit breaker logic (opens after 5 consecutive failures)';

-- ============================================================================
-- SECTION 6: AUTOMATION (pg_cron)
-- ============================================================================
-- Documentation: https://supabase.com/docs/guides/database/extensions/pg_cron

-- Clean old incidents (90-day retention policy)
SELECT cron.schedule(
  'clean_old_service_incidents',
  '0 3 * * *',
  $$DELETE FROM public.service_incidents WHERE started_at < NOW() - INTERVAL '90 days'$$
);

COMMENT ON EXTENSION pg_cron IS 'Automated cleanup jobs for service monitoring system';

-- ============================================================================
-- SECTION 7: INITIAL DATA (Service Definitions)
-- ============================================================================

-- Insert initial service health records for known services
INSERT INTO public.service_health_status (service_name, service_category, status) VALUES
  ('supabase', 'infrastructure', 'unknown'),
  ('anthropic', 'ai', 'unknown'),
  ('azure_speech', 'voice', 'unknown'),
  ('revenuecat', 'payment', 'unknown'),
  ('admob', 'payment', 'unknown'),
  ('twilio', 'communication', 'unknown'),
  ('whatsapp', 'communication', 'unknown'),
  ('payfast', 'payment', 'unknown'),
  ('paypal', 'payment', 'unknown'),
  ('google_calendar', 'communication', 'unknown'),
  ('sentry', 'monitoring', 'unknown'),
  ('posthog', 'monitoring', 'unknown'),
  ('openai', 'ai', 'unknown'),
  ('deepgram', 'voice', 'unknown'),
  ('google_tts', 'voice', 'unknown'),
  ('expo', 'development', 'unknown'),
  ('picovoice', 'voice', 'unknown')
ON CONFLICT (service_name) DO NOTHING;

-- Insert default alert configurations
INSERT INTO public.service_alert_config (service_name, alert_enabled, alert_channels, downtime_threshold_minutes, budget_usd) VALUES
  ('supabase', true, ARRAY['email', 'sms', 'in_app'], 2, 500.00),
  ('anthropic', true, ARRAY['email', 'sms', 'in_app'], 5, 1000.00),
  ('azure_speech', true, ARRAY['email', 'sms', 'in_app'], 5, 500.00),
  ('revenuecat', true, ARRAY['email', 'in_app'], 10, 100.00),
  ('admob', true, ARRAY['in_app'], 30, NULL),
  ('twilio', true, ARRAY['email', 'in_app'], 10, 200.00),
  ('whatsapp', true, ARRAY['email', 'in_app'], 10, 200.00),
  ('payfast', true, ARRAY['email', 'in_app'], 15, NULL),
  ('paypal', true, ARRAY['email', 'in_app'], 15, NULL),
  ('google_calendar', true, ARRAY['in_app'], 30, NULL),
  ('sentry', false, ARRAY['in_app'], 60, NULL),
  ('posthog', false, ARRAY['in_app'], 60, NULL),
  ('openai', true, ARRAY['email', 'in_app'], 10, 200.00),
  ('deepgram', true, ARRAY['in_app'], 30, 100.00),
  ('google_tts', true, ARRAY['in_app'], 30, 100.00),
  ('expo', true, ARRAY['email', 'in_app'], 15, NULL),
  ('picovoice', true, ARRAY['in_app'], 60, NULL)
ON CONFLICT (service_name) DO NOTHING;

COMMIT;
