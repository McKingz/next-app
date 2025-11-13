-- SETUP SERVICE MONITORING CRON JOBS
-- Purpose: Automate health checks, cost aggregation, and maintenance tasks
-- Documentation: https://supabase.com/docs/guides/database/extensions/pg_cron
--                https://supabase.com/docs/guides/database/extensions/http

BEGIN;

-- Ensure required extensions are enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS http;

-- ============================================================================
-- CRON JOB 1: Health Checks (Every 5 minutes)
-- ============================================================================

SELECT cron.schedule(
  'service-health-monitor',
  '*/5 * * * *', -- Every 5 minutes
  $$
  SELECT
    http((
      'POST',
      current_setting('app.settings.supabase_url') || '/functions/v1/service-health-monitor',
      ARRAY[http_header('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'))],
      'application/json',
      '{}'
    )::http_request);
  $$
);

-- ============================================================================
-- CRON JOB 2: Cost Aggregation (Daily at 02:00 UTC)
-- ============================================================================

SELECT cron.schedule(
  'cost-aggregator-daily',
  '0 2 * * *', -- Daily at 02:00
  $$
  SELECT
    http((
      'POST',
      current_setting('app.settings.supabase_url') || '/functions/v1/cost-aggregator',
      ARRAY[http_header('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'))],
      'application/json',
      '{}'
    )::http_request);
  $$
);

-- ============================================================================
-- CRON JOB 3: Incident Cleanup (Daily at 03:00 UTC)
-- ============================================================================

SELECT cron.schedule(
  'service-incidents-cleanup',
  '0 3 * * *', -- Daily at 03:00
  $$
  DELETE FROM public.service_incidents
  WHERE created_at < NOW() - INTERVAL '90 days';
  $$
);

-- ============================================================================
-- HELPER: Runtime Settings (to be set via Supabase dashboard or CLI)
-- ============================================================================

-- Note: These settings must be configured in your Supabase project:
-- 1. Navigate to Database > Settings > Custom Postgres Configuration
-- 2. Add the following:
--    app.settings.supabase_url = 'https://lvvvjywrmpcqrpvuptdi.supabase.co'
--    app.settings.service_role_key = 'your-service-role-key-here'
--
-- Alternatively, use ALTER DATABASE:
-- ALTER DATABASE postgres SET app.settings.supabase_url = 'https://your-project.supabase.co';
-- ALTER DATABASE postgres SET app.settings.service_role_key = 'your-service-role-key';

COMMENT ON EXTENSION pg_cron IS 'Job scheduler for PostgreSQL - used for automated service monitoring';
COMMENT ON EXTENSION http IS 'HTTP client for PostgreSQL - used to invoke Edge Functions from cron jobs';

COMMIT;