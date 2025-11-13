-- STORE SERVICE ROLE KEY FOR CRON JOBS
-- Purpose: Use Supabase Vault to securely store service role key for cron jobs
-- Documentation: https://supabase.com/docs/guides/database/vault

BEGIN;

-- Enable vault extension if not already enabled
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

-- Insert service role key into vault
-- Note: The actual key value will be inserted manually via Supabase SQL Editor
-- This migration just sets up the structure

-- Create a helper function to get the service role key from vault
CREATE OR REPLACE FUNCTION public.get_service_role_key()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  decrypted_secret TEXT;
BEGIN
  -- Attempt to retrieve the service role key from vault
  SELECT decrypted_secret INTO decrypted_secret
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_key'
  LIMIT 1;
  
  RETURN decrypted_secret;
EXCEPTION
  WHEN OTHERS THEN
    -- If vault doesn't have the key, return empty string
    -- The cron job will fail but won't crash
    RETURN '';
END;
$$;

COMMENT ON FUNCTION public.get_service_role_key IS 'Retrieves service role key from Supabase Vault for cron job authentication';

-- Grant execute permission to postgres role (for cron jobs)
GRANT EXECUTE ON FUNCTION public.get_service_role_key() TO postgres;

-- ============================================================================
-- MANUAL STEP REQUIRED:
-- After this migration, you must manually insert the service role key into vault:
-- 
-- Via Supabase SQL Editor, run:
-- 
-- INSERT INTO vault.secrets (name, secret)
-- VALUES ('service_role_key', 'your-actual-service-role-key-here')
-- ON CONFLICT (name) DO UPDATE SET secret = EXCLUDED.secret;
-- 
-- ============================================================================

COMMIT;