-- Fix Parent Plan Prices
-- Parent Starter: R49.99/month (not R49)
-- Parent Plus: R149.99/month (not R149)

UPDATE subscription_plans
SET 
  price_monthly = 4999,  -- R49.99 in cents
  price_annual = 47990   -- R49.99 * 12 * 0.8 = 20% annual discount
WHERE tier = 'parent-starter';

UPDATE subscription_plans
SET 
  price_monthly = 14999,  -- R149.99 in cents
  price_annual = 143990   -- R149.99 * 12 * 0.8 = 20% annual discount
WHERE tier = 'parent-plus';