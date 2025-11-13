-- Update subscription plans with modern tier structure
-- This script will clear old test plans and insert proper subscription tiers

-- First, deactivate all existing plans to avoid conflicts
UPDATE subscription_plans
SET is_active = FALSE
WHERE is_active = TRUE;

-- Insert Free Tier
INSERT INTO subscription_plans (
  id,
  name,
  tier,
  price_monthly,
  price_annual,
  max_teachers,
  max_students,
  features,
  is_active,
  school_types,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'Free Plan',
  'free',
  0,
  0,
  1,
  25,
  ARRAY[
    'Basic student management',
    'Simple attendance tracking',
    'Parent communication',
    'Basic reporting',
    'Mobile app access'
  ],
  TRUE,
  ARRAY['preschool', 'k12_school', 'hybrid'],
  now(),
  now()
) ON CONFLICT (tier) DO UPDATE SET
  name = excluded.name,
  price_monthly = excluded.price_monthly,
  price_annual = excluded.price_annual,
  max_teachers = excluded.max_teachers,
  max_students = excluded.max_students,
  features = excluded.features,
  is_active = excluded.is_active,
  school_types = excluded.school_types,
  updated_at = now();

-- Insert Starter Tier  
INSERT INTO subscription_plans (
  id,
  name,
  tier,
  price_monthly,
  price_annual,
  max_teachers,
  max_students,
  features,
  is_active,
  school_types,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'Starter Plan',
  'starter',
  299,
  2990, -- 10 months price for 12 months (17% discount)
  5,
  100,
  ARRAY[
    'Advanced student management',
    'Comprehensive attendance tracking',
    'Parent & teacher messaging',
    'Financial management',
    'Invoice generation',
    'Basic analytics',
    'WhatsApp integration',
    'Payment tracking',
    'Petty cash management'
  ],
  TRUE,
  ARRAY['preschool', 'k12_school', 'hybrid'],
  now(),
  now()
) ON CONFLICT (tier) DO UPDATE SET
  name = excluded.name,
  price_monthly = excluded.price_monthly,
  price_annual = excluded.price_annual,
  max_teachers = excluded.max_teachers,
  max_students = excluded.max_students,
  features = excluded.features,
  is_active = excluded.is_active,
  school_types = excluded.school_types,
  updated_at = now();

-- Insert Premium Tier
INSERT INTO subscription_plans (
  id,
  name,
  tier,
  price_monthly,
  price_annual,
  max_teachers,
  max_students,
  features,
  is_active,
  school_types,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'Premium Plan',
  'premium',
  699,
  6990, -- 10 months price for 12 months (17% discount)
  15,
  300,
  ARRAY[
    'All Starter features',
    'Advanced analytics & reporting',
    'AI-powered insights',
    'Custom branding',
    'Advanced financial reports',
    'Bulk operations',
    'Data export capabilities',
    'Priority support',
    'Advanced WhatsApp features',
    'Multiple school support',
    'Advanced user roles'
  ],
  TRUE,
  ARRAY['preschool', 'k12_school', 'hybrid'],
  now(),
  now()
) ON CONFLICT (tier) DO UPDATE SET
  name = excluded.name,
  price_monthly = excluded.price_monthly,
  price_annual = excluded.price_annual,
  max_teachers = excluded.max_teachers,
  max_students = excluded.max_students,
  features = excluded.features,
  is_active = excluded.is_active,
  school_types = excluded.school_types,
  updated_at = now();

-- Insert Enterprise Tier
INSERT INTO subscription_plans (
  id,
  name,
  tier,
  price_monthly,
  price_annual,
  max_teachers,
  max_students,
  features,
  is_active,
  school_types,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'Enterprise Plan',
  'enterprise',
  0, -- Custom pricing
  0, -- Custom pricing
  999,
  9999,
  ARRAY[
    'All Premium features',
    'Unlimited users',
    'Custom integrations',
    'White-label solution',
    'Dedicated account manager',
    'Custom training',
    'SLA guarantees',
    'Advanced security',
    'Custom reporting',
    'Multi-tenant architecture',
    'API access',
    'Custom development'
  ],
  TRUE,
  ARRAY['preschool', 'k12_school', 'hybrid'],
  now(),
  now()
) ON CONFLICT (tier) DO UPDATE SET
  name = excluded.name,
  price_monthly = excluded.price_monthly,
  price_annual = excluded.price_annual,
  max_teachers = excluded.max_teachers,
  max_students = excluded.max_students,
  features = excluded.features,
  is_active = excluded.is_active,
  school_types = excluded.school_types,
  updated_at = now();

-- Verify the plans were inserted/updated
SELECT
  tier,
  name,
  price_monthly,
  price_annual,
  max_teachers,
  max_students,
  is_active,
  array_length(features, 1) AS feature_count
FROM subscription_plans
WHERE is_active = TRUE
ORDER BY
  CASE tier
    WHEN 'free' THEN 1
    WHEN 'starter' THEN 2
    WHEN 'premium' THEN 3
    WHEN 'enterprise' THEN 4
    ELSE 5
  END;

-- Show summary
SELECT
  'Subscription plans updated successfully!' AS status,
  count(*) AS active_plans
FROM subscription_plans
WHERE is_active = TRUE;
