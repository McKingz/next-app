-- Fix parent subscription plan prices by tier
-- All prices stored in cents

-- Parent Starter: R49.99/month (4999 cents), R479.90/year (47990 cents)
UPDATE public.subscription_plans
SET 
  price_monthly = 4999,
  price_annual = 47990,
  updated_at = NOW()
WHERE tier = 'parent-starter';

-- Parent Plus: R149.99/month (14999 cents), R1439.90/year (143990 cents)
UPDATE public.subscription_plans
SET 
  price_monthly = 14999,
  price_annual = 143990,
  updated_at = NOW()
WHERE tier = 'parent-plus';

-- Verify the updates
DO $$
DECLARE
  v_starter_count INTEGER;
  v_plus_count INTEGER;
  v_starter_monthly INTEGER;
  v_starter_annual INTEGER;
  v_plus_monthly INTEGER;
  v_plus_annual INTEGER;
BEGIN
  -- Count updated rows
  SELECT COUNT(*) INTO v_starter_count FROM public.subscription_plans WHERE tier = 'parent-starter';
  SELECT COUNT(*) INTO v_plus_count FROM public.subscription_plans WHERE tier = 'parent-plus';
  
  -- Get prices
  SELECT price_monthly, price_annual INTO v_starter_monthly, v_starter_annual
  FROM public.subscription_plans
  WHERE tier = 'parent-starter'
  LIMIT 1;
  
  SELECT price_monthly, price_annual INTO v_plus_monthly, v_plus_annual
  FROM public.subscription_plans
  WHERE tier = 'parent-plus'
  LIMIT 1;
  
  -- Report results
  RAISE NOTICE 'Updated % parent-starter plans', v_starter_count;
  RAISE NOTICE 'Parent Starter: Monthly=% (should be 4999), Annual=% (should be 47990)', v_starter_monthly, v_starter_annual;
  
  RAISE NOTICE 'Updated % parent-plus plans', v_plus_count;
  RAISE NOTICE 'Parent Plus: Monthly=% (should be 14999), Annual=% (should be 143990)', v_plus_monthly, v_plus_annual;
  
  -- Verify correctness
  IF v_starter_monthly != 4999 OR v_starter_annual != 47990 OR
     v_plus_monthly != 14999 OR v_plus_annual != 143990 THEN
    RAISE EXCEPTION 'Parent plan prices are still incorrect!';
  END IF;
  
  RAISE NOTICE '✅ All parent plan prices corrected successfully';
END $$;