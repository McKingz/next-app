-- Fix subscription plan prices
-- Parent Starter: R49.99/month
-- Parent Plus: R149.99/month  
-- Enterprise: Custom pricing (NULL to indicate custom)
-- Update descriptions for Premium and Starter plans

-- Update Parent Starter pricing
UPDATE public.subscription_plans
SET 
  price_monthly = 49.99,
  price_annual = 479.90
WHERE tier = 'parent-starter';

-- Update Parent Plus pricing
UPDATE public.subscription_plans
SET 
  price_monthly = 149.99,
  price_annual = 1439.90
WHERE tier = 'parent-plus';

-- Update Enterprise to custom pricing (0 indicates custom/contact sales)
UPDATE public.subscription_plans
SET 
  price_monthly = 0,
  price_annual = 0,
  description = 'Custom pricing for large organizations and multi-school networks'
WHERE tier = 'enterprise';

-- Update Premium description
UPDATE public.subscription_plans
SET 
  description = 'Best for schools and organizations seeking advanced features'
WHERE tier = 'premium';

-- Update Starter description
UPDATE public.subscription_plans
SET 
  description = 'Most popular choice for growing preschools'
WHERE tier = 'starter';