-- Migration: Normalize teacher seat limits on subscription plans
-- Created: 2025-09-21
-- Purpose: Update subscription_plans.max_teachers to consistent product-approved limits
-- WARP.md compliance: production-safe data migration, no schema changes

-- ====================================================================
-- PART 1: BACKUP CURRENT STATE (for rollback reference)
-- ====================================================================

-- Log current state before changes
INSERT INTO public.config_kv (key, value, description, is_public)
VALUES (
  'teacher_seat_limits_backup_20250921',
  (
    SELECT
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'name', name,
          'tier', tier,
          'max_teachers_before', max_teachers
        )
      )
    FROM public.subscription_plans
    WHERE is_active = TRUE
  ),
  'Backup of teacher seat limits before normalization',
  FALSE
) ON CONFLICT (key) DO UPDATE SET
  value = excluded.value,
  updated_at = now();

-- ====================================================================
-- PART 2: NORMALIZE TEACHER SEAT LIMITS PER PRODUCT REQUIREMENTS
-- ====================================================================

-- Update Free plan: 2 teacher seats
UPDATE public.subscription_plans
SET
  max_teachers = 2,
  updated_at = now()
WHERE tier = 'free' AND is_active = TRUE;

-- Update Starter plan: 5 teacher seats
UPDATE public.subscription_plans
SET
  max_teachers = 5,
  updated_at = now()
WHERE tier = 'starter' AND is_active = TRUE;

-- Premium plan already has 15 teacher seats (no update needed)
-- Update Premium plan: 15 teacher seats (keeping current value)
-- UPDATE public.subscription_plans
-- SET
--   max_teachers = 15,
--   updated_at = NOW()
-- WHERE tier = 'premium' AND is_active = TRUE;
-- (Skipped: already correct)

-- Update Enterprise plan: 100 teacher seats (from -1 unlimited)
UPDATE public.subscription_plans
SET
  max_teachers = 100,
  updated_at = now()
WHERE tier = 'enterprise' AND is_active = TRUE;

-- ====================================================================
-- PART 3: UPDATE EXISTING SUBSCRIPTIONS' SEAT TOTALS (OPTIONAL)
-- ====================================================================

-- Update existing subscriptions to match new plan limits
-- This ensures consistency between plan limits and subscription seat totals
UPDATE public.subscriptions
SET
  seats_total = subscription_plans.max_teachers,
  updated_at = now()
FROM
  public.subscription_plans
WHERE
  subscriptions.plan_id = subscription_plans.id
  AND subscription_plans.is_active = TRUE
  AND subscriptions.status IN ('active', 'trialing')
  -- Only update if current seats_total differs from plan limit
  AND subscriptions.seats_total != subscription_plans.max_teachers;

-- ====================================================================
-- PART 4: VERIFICATION AND LOGGING
-- ====================================================================

-- Verify updates and log results
INSERT INTO public.config_kv (key, value, description, is_public)
VALUES (
  'teacher_seat_limits_update_20250921',
  (
    SELECT
      jsonb_build_object(
        'completed_at',
        now(),
        'updated_plans',
        (
          SELECT
            jsonb_agg(
              jsonb_build_object(
                'tier', tier,
                'name', name,
                'max_teachers_after', max_teachers
              )
            )
          FROM public.subscription_plans
          WHERE is_active = TRUE
        ),
        'affected_subscriptions',
        (
          SELECT count(*)
          FROM public.subscriptions AS subscriptions
          INNER JOIN public.subscription_plans AS subscription_plans
            ON subscriptions.plan_id = subscription_plans.id
          WHERE subscription_plans.is_active = TRUE
        )
      )
  ),
  'Teacher seat limits normalization completion log',
  FALSE
) ON CONFLICT (key) DO UPDATE SET
  value = excluded.value,
  updated_at = now();

SELECT 'TEACHER SEAT LIMITS NORMALIZED' AS status;

-- Show final state for verification
SELECT
  tier,
  name,
  max_teachers,
  is_active
FROM public.subscription_plans
WHERE is_active = TRUE
ORDER BY
  CASE tier
    WHEN 'free' THEN 1
    WHEN 'starter' THEN 2
    WHEN 'premium' THEN 3
    WHEN 'enterprise' THEN 4
    ELSE 99
  END;
