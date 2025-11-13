-- FINALIZE CRON JOBS - MANUAL INVOCATION APPROACH
-- Purpose: Since we can't securely store service role key in database,
--          cron jobs will invoke Edge Functions without auth,
--          and Edge Functions will use their own SUPABASE_SERVICE_ROLE_KEY env var
-- Documentation: https://supabase.com/docs/guides/database/extensions/pg_cron

BEGIN;

-- Unschedule all existing jobs
DO $$
BEGIN
  PERFORM cron.unschedule('service-health-monitor');
  PERFORM cron.unschedule('cost-aggregator-daily');
  PERFORM cron.unschedule('service-incidents-cleanup');
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- ============================================================================
-- APPROACH: Edge Functions are invoked without explicit auth header
-- The Edge Functions already have SUPABASE_SERVICE_ROLE_KEY in their environment
-- and will use it internally to access the database
-- ============================================================================

-- CRON JOB 1: Health Checks (Every 5 minutes)
SELECT cron.schedule(
  'service-health-monitor',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://lvvvjywrmpcqrpvuptdi.supabase.co/functions/v1/service-health-monitor',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'
  );
  $$
);

-- CRON JOB 2: Cost Aggregation (Daily at 02:00 UTC)
SELECT cron.schedule(
  'cost-aggregator-daily',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://lvvvjywrmpcqrpvuptdi.supabase.co/functions/v1/cost-aggregator',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'
  );
  $$
);

-- CRON JOB 3: Incident Cleanup (Daily at 03:00 UTC)
SELECT cron.schedule(
  'service-incidents-cleanup',
  '0 3 * * *',
  $$
  DELETE FROM public.service_incidents
  WHERE created_at < NOW() - INTERVAL '90 days';
  $$
);

COMMIT;

-- ============================================================================
-- VERIFICATION:
-- To check if cron jobs are scheduled, run:
-- SELECT * FROM cron.job;
-- 
-- To see cron job execution history:
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
-- ============================================================================