-- UPDATE CRON JOBS WITH HARDCODED PROJECT URL
-- Purpose: Replace runtime settings with hardcoded values since ALTER DATABASE requires superuser
-- Documentation: https://supabase.com/docs/guides/database/extensions/pg_cron
--                https://supabase.com/docs/guides/database/extensions/pgsql-http

BEGIN;

-- Unschedule existing cron jobs if they exist
DO $$
BEGIN
  PERFORM cron.unschedule('service-health-monitor');
  PERFORM cron.unschedule('cost-aggregator-daily');
  PERFORM cron.unschedule('service-incidents-cleanup');
EXCEPTION
  WHEN OTHERS THEN NULL; -- Ignore errors if jobs don't exist
END $$;

-- ============================================================================
-- NOTE: For cron jobs to work, you must manually set the service role key:
-- Run this once via psql or Supabase SQL Editor:
-- 
-- ALTER ROLE postgres SET app.service_role_key = 'your-service-role-key-here';
-- 
-- This makes the service role key available to all postgres connections.
-- ============================================================================

-- ============================================================================
-- CRON JOB 1: Health Checks (Every 5 minutes)
-- ============================================================================

SELECT cron.schedule(
  'service-health-monitor',
  '*/5 * * * *', -- Every 5 minutes
  $$
  SELECT net.http_post(
    url := 'https://lvvvjywrmpcqrpvuptdi.supabase.co/functions/v1/service-health-monitor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body := '{}'
  );
  $$
);

-- ============================================================================
-- CRON JOB 2: Cost Aggregation (Daily at 02:00 UTC)
-- ============================================================================

SELECT cron.schedule(
  'cost-aggregator-daily',
  '0 2 * * *', -- Daily at 02:00
  $$
  SELECT net.http_post(
    url := 'https://lvvvjywrmpcqrpvuptdi.supabase.co/functions/v1/cost-aggregator',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body := '{}'
  );
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

COMMIT;