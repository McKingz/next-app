-- Add Parent Subscription Tiers
-- These tiers are specifically for parent users (not schools)
-- NOTE: Enum values added in prior migration 20251022201401_add_parent_tier_enum_values.sql

-- Parent Starter: R49/month - Basic AI homework help
INSERT INTO subscription_plans (
  name,
  tier,
  price_monthly,
  price_annual,
  max_teachers,
  max_students,
  features,
  is_active,
  school_types
) VALUES (
  'Parent Starter',
  'parent-starter',
  49,
  470, -- 49 * 12 * 0.8 = 20% annual discount
  0, -- Not applicable for parent plans
  1, -- One child account
  jsonb_build_array(
    'Homework Helper (30/month)',
    'AI Lesson Support',
    'Child-safe explanations',
    'Progress tracking',
    'Email support'
  ),
  true,
  ARRAY['individual']
)
ON CONFLICT (tier) DO UPDATE SET
  name = EXCLUDED.name,
  price_monthly = EXCLUDED.price_monthly,
  price_annual = EXCLUDED.price_annual,
  features = EXCLUDED.features,
  is_active = EXCLUDED.is_active;

-- Parent Plus: R149/month - Expanded AI support for families
INSERT INTO subscription_plans (
  name,
  tier,
  price_monthly,
  price_annual,
  max_teachers,
  max_students,
  features,
  is_active,
  school_types
) VALUES (
  'Parent Plus',
  'parent-plus',
  149,
  1430, -- 149 * 12 * 0.8 = 20% annual discount
  0, -- Not applicable for parent plans
  3, -- Up to 3 children
  jsonb_build_array(
    'Homework Helper (100/month)',
    'Priority processing',
    'Basic analytics',
    'Advanced learning insights',
    'Priority support',
    'WhatsApp Connect',
    'Learning Resources',
    'Progress Analytics'
  ),
  true,
  ARRAY['individual']
)
ON CONFLICT (tier) DO UPDATE SET
  name = EXCLUDED.name,
  price_monthly = EXCLUDED.price_monthly,
  price_annual = EXCLUDED.price_annual,
  features = EXCLUDED.features,
  is_active = EXCLUDED.is_active;