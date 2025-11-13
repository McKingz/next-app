-- 20250920_add_plan_audience_scope.sql
-- Purpose: Extend subscription_plans to support different audiences/scopes (school vs user)
-- and visibility flags for web/native catalogs. Forward-only, idempotent.

BEGIN;

-- Add scope (who owns the subscription record)
ALTER TABLE public.subscription_plans
ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'school'
CHECK (scope IN ('school', 'user'));

-- Add audience (who the plan is intended for)
ALTER TABLE public.subscription_plans
ADD COLUMN IF NOT EXISTS audience text [] NOT NULL DEFAULT ARRAY['school']::text [];

-- Add visibility flag for web catalogs
ALTER TABLE public.subscription_plans
ADD COLUMN IF NOT EXISTS visible_on_web boolean NOT NULL DEFAULT TRUE;

-- Helpful indexes (safe if they already exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_subscription_plans_active_tier'
  ) THEN
    CREATE INDEX idx_subscription_plans_active_tier
    ON public.subscription_plans (is_active, tier);
  END IF;
END$$;

COMMIT;
