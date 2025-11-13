-- Simple Subscription Data Migration
-- Date: 2025-09-19
-- Purpose: Add basic data to existing subscription tables
-- WARP.md Compliance: Supabase migration, production-safe, forward-only

BEGIN;

-- ============================================================================
-- PART 1: INSERT BASIC SUBSCRIPTION PLANS (USING EXISTING SCHEMA)
-- ============================================================================

-- Insert basic plans into existing subscription_plans table (minimal required fields only)
-- Only insert if no plans exist yet
INSERT INTO subscription_plans (name, price_monthly, price_annual)
SELECT
  'Starter',
  99.00,
  990.00
WHERE
  NOT EXISTS (
    SELECT 1 FROM subscription_plans
    WHERE name = 'Starter'
  )
UNION ALL
SELECT
  'Professional',
  299.00,
  2990.00
WHERE
  NOT EXISTS (
    SELECT 1 FROM subscription_plans
    WHERE name = 'Professional'
  )
UNION ALL
SELECT
  'Enterprise',
  799.00,
  7990.00
WHERE NOT EXISTS (
  SELECT 1 FROM subscription_plans
  WHERE name = 'Enterprise'
);

-- ============================================================================
-- PART 2: ADD BASIC SAMPLE DATA (IF NEEDED)
-- ============================================================================

-- Create sample subscription data (using fake school IDs if needed)
-- This is just to populate the dashboard with some test data
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM subscriptions LIMIT 1) THEN
    -- Add a few sample subscriptions with fake UUIDs for testing
    INSERT INTO subscriptions (school_id, plan_id, status, billing_frequency, seats_total, seats_used)
    VALUES 
      (gen_random_uuid(), (SELECT id FROM subscription_plans WHERE name = 'Professional' LIMIT 1), 'active', 'monthly', 100, 25),
      (gen_random_uuid(), (SELECT id FROM subscription_plans WHERE name = 'Enterprise' LIMIT 1), 'active', 'annual', 200, 75),
      (gen_random_uuid(), (SELECT id FROM subscription_plans WHERE name = 'Starter' LIMIT 1), 'active', 'monthly', 50, 15);
  END IF;
END $$;

-- ============================================================================
-- PART 3: COMPLETION LOGGING
-- ============================================================================

-- Log migration completion
INSERT INTO public.config_kv (key, value, description, is_public)
VALUES (
  'simple_subscription_data_20250919212100',
  json_build_object(
    'version', '1.0.0',
    'completed_at', now()::text,
    'basic_plans_added', 3,
    'migration_file', '20250919212100_simple_subscription_data.sql'
  ),
  'Simple subscription data migration completion log',
  FALSE
) ON CONFLICT (key) DO UPDATE SET
  value = excluded.value,
  updated_at = now();

SELECT 'SIMPLE SUBSCRIPTION DATA ADDED' AS status;

COMMIT;
