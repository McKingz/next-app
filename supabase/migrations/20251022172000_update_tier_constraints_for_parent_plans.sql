-- Update Tier Constraints for Parent Plans
-- Purpose: Drop existing tier constraints and recreate with parent-specific tiers
-- Date: 2025-10-22
-- NOTE: Safe for test data - will drop constraints without data validation

-- 1. Drop preschools.subscription_tier constraint
ALTER TABLE IF EXISTS preschools DROP CONSTRAINT IF EXISTS preschools_subscription_tier_check;

-- 2. Drop organizations.plan_tier constraint  
ALTER TABLE IF EXISTS organizations DROP CONSTRAINT IF EXISTS organizations_plan_tier_check;

-- 3. Drop voice_usage_quotas.subscription_tier constraint
ALTER TABLE IF EXISTS voice_usage_quotas DROP CONSTRAINT IF EXISTS voice_usage_quotas_subscription_tier_check;

-- 4. Drop preschool_voice_usage.subscription_tier constraint
ALTER TABLE IF EXISTS preschool_voice_usage DROP CONSTRAINT IF EXISTS preschool_voice_usage_subscription_tier_check;

-- 5. Drop school_ai_subscriptions.subscription_tier constraint
ALTER TABLE IF EXISTS school_ai_subscriptions DROP CONSTRAINT IF EXISTS school_ai_subscriptions_subscription_tier_check;

-- Normalize existing data before adding constraints back

-- 1. Update any non-conforming preschools.subscription_tier values
UPDATE preschools 
SET subscription_tier = 'free'
WHERE subscription_tier IS NOT NULL 
  AND subscription_tier NOT IN ('free', 'starter', 'professional', 'enterprise', 'parent-starter', 'parent-plus');

-- 2. Update any non-conforming organizations.plan_tier values
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organizations') THEN
    UPDATE organizations 
    SET plan_tier = 'free'
    WHERE plan_tier IS NOT NULL 
      AND plan_tier NOT IN ('free', 'starter', 'professional', 'enterprise', 'parent-starter', 'parent-plus');
  END IF;
END;
$$;

-- Now add back constraints with parent tiers included

-- 1. preschools table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'preschools' AND column_name = 'subscription_tier') THEN
    ALTER TABLE preschools ADD CONSTRAINT preschools_subscription_tier_check 
      CHECK (subscription_tier IN ('free', 'starter', 'professional', 'enterprise', 'parent-starter', 'parent-plus'));
    RAISE NOTICE 'Added preschools.subscription_tier constraint with parent tiers';
  END IF;
END;
$$;

-- 2. organizations table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'plan_tier') THEN
    ALTER TABLE organizations ADD CONSTRAINT organizations_plan_tier_check 
      CHECK (plan_tier IN ('free', 'starter', 'professional', 'enterprise', 'parent-starter', 'parent-plus'));
    RAISE NOTICE 'Added organizations.plan_tier constraint with parent tiers';
  END IF;
END;
$$;

-- 3. voice_usage_quotas table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'voice_usage_quotas') THEN
    ALTER TABLE voice_usage_quotas ADD CONSTRAINT voice_usage_quotas_subscription_tier_check 
      CHECK (subscription_tier IN ('free', 'starter', 'professional', 'enterprise', 'parent-starter', 'parent-plus'));
    RAISE NOTICE 'Added voice_usage_quotas.subscription_tier constraint with parent tiers';
  END IF;
END;
$$;

-- 4. preschool_voice_usage table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'preschool_voice_usage') THEN
    ALTER TABLE preschool_voice_usage ADD CONSTRAINT preschool_voice_usage_subscription_tier_check 
      CHECK (subscription_tier IN ('free', 'starter', 'professional', 'enterprise', 'parent-starter', 'parent-plus'));
    RAISE NOTICE 'Added preschool_voice_usage.subscription_tier constraint with parent tiers';
  END IF;
END;
$$;

-- 5. school_ai_subscriptions table (includes original values)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'school_ai_subscriptions') THEN
    ALTER TABLE school_ai_subscriptions ADD CONSTRAINT school_ai_subscriptions_subscription_tier_check 
      CHECK (subscription_tier IN ('free', 'basic', 'pro', 'premium', 'enterprise', 'parent-starter', 'parent-plus'));
    RAISE NOTICE 'Added school_ai_subscriptions.subscription_tier constraint with parent tiers';
  END IF;
END;
$$;
