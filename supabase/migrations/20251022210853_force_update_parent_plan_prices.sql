-- Force Update Parent Plan Prices
-- Ensuring prices are set to R49.99 and R149.99 (not R39.99 and R119.99)

-- Parent Starter: R49.99/month
UPDATE subscription_plans
SET 
  price_monthly = 4999,  -- R49.99 in cents
  price_annual = 47990   -- R49.99 * 12 * 0.8 (20% discount) = R479.90/year
WHERE tier = 'parent-starter';

-- Parent Plus: R149.99/month
UPDATE subscription_plans
SET 
  price_monthly = 14999,  -- R149.99 in cents
  price_annual = 143990   -- R149.99 * 12 * 0.8 (20% discount) = R1439.90/year
WHERE tier = 'parent-plus';

-- Verify the updates
DO $$
DECLARE
  starter_monthly INTEGER;
  starter_annual INTEGER;
  plus_monthly INTEGER;
  plus_annual INTEGER;
BEGIN
  SELECT price_monthly, price_annual INTO starter_monthly, starter_annual
  FROM subscription_plans WHERE tier = 'parent-starter';
  
  SELECT price_monthly, price_annual INTO plus_monthly, plus_annual
  FROM subscription_plans WHERE tier = 'parent-plus';
  
  RAISE NOTICE 'Parent Starter: R%.2f/month, R%.2f/year', starter_monthly/100.0, starter_annual/100.0;
  RAISE NOTICE 'Parent Plus: R%.2f/month, R%.2f/year', plus_monthly/100.0, plus_annual/100.0;
  
  IF starter_monthly != 4999 OR starter_annual != 47990 THEN
    RAISE EXCEPTION 'Parent Starter prices not updated correctly!';
  END IF;
  
  IF plus_monthly != 14999 OR plus_annual != 143990 THEN
    RAISE EXCEPTION 'Parent Plus prices not updated correctly!';
  END IF;
  
  RAISE NOTICE '✅ All parent plan prices updated successfully';
END $$;