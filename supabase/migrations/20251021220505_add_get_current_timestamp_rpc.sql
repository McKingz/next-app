-- Add get_current_timestamp RPC for Supabase health checks
-- Purpose: Simple RPC to test Supabase database connectivity
-- Documentation: https://www.postgresql.org/docs/current/sql-createfunction.html

BEGIN;

CREATE OR REPLACE FUNCTION public.get_current_timestamp()
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
AS $$
  SELECT NOW();
$$;

COMMENT ON FUNCTION public.get_current_timestamp IS 'Returns current timestamp for health check purposes';

COMMIT;