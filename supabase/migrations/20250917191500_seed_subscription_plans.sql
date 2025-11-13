-- Seed basic subscription plans if they don't exist
-- This ensures the pricing page has data to display
-- Updated to match production tiers: Free, Starter, Premium, Enterprise

-- First, check and insert plans that don't exist
INSERT INTO public.subscription_plans (
  name, tier, price_monthly, price_annual, max_teachers, max_students, features, is_active
)
SELECT * FROM (
  VALUES
  (
    'Free Plan',
    'free',
    0,
    0,
    2,
    50,
    '["Basic dashboard", "Student management", "Parent communication", "Email support"]'::jsonb,
    TRUE
  ),
  (
    'Starter Plan',
    'starter',
    299,
    2990,
    5,
    150,
    '["Up to 5 teachers", "150 students", "AI-powered insights", "Parent portal", "WhatsApp notifications", "Email support"]'::jsonb,
    TRUE
  ),
  (
    'Premium Plan',
    'premium',
    599,
    5990,
    15,
    500,
    '["Up to 15 teachers", "500 students", "Advanced reporting", "Priority support", "Custom branding", "API access", "Advanced analytics"]'::jsonb,
    TRUE
  ),
  (
    'Enterprise Plan',
    'enterprise',
    1299,
    12990,
    100,
    -1,
    '["Up to 100 teachers", "Unlimited students", "Dedicated success manager", "SLA guarantee", "White-label solution", "Custom integrations", "24/7 priority support"]'::jsonb,
    TRUE
  )
) AS new_plans (name, tier, price_monthly, price_annual, max_teachers, max_students, features, is_active)
WHERE NOT EXISTS (
  SELECT 1 FROM public.subscription_plans
  WHERE subscription_plans.tier = new_plans.tier
);
