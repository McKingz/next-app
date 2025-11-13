-- Fix parent subscription plan prices in subscription_plans table
-- Parent Starter: R49.99/month, R479.90/year (stored in cents)
-- Parent Plus: R149.99/month, R1439.90/year (stored in cents)

-- Update Parent Starter monthly price (4999 cents = R49.99)
UPDATE public.subscription_plans
SET 
  price_monthly = 4999,
  updated_at = NOW()
WHERE tier = 'parent-starter'
  AND name ILIKE '%monthly%';

-- Update Parent Starter annual price (47990 cents = R479.90)
UPDATE public.subscription_plans
SET 
  price_annual = 47990,
  updated_at = NOW()
WHERE tier = 'parent-starter'
  AND name ILIKE '%annual%';

-- Update Parent Plus monthly price (14999 cents = R149.99)
UPDATE public.subscription_plans
SET 
  price_monthly = 14999,
  updated_at = NOW()
WHERE tier = 'parent-plus'
  AND name ILIKE '%monthly%';

-- Update Parent Plus annual price (143990 cents = R1439.90)
UPDATE public.subscription_plans
SET 
  price_annual = 143990,
  updated_at = NOW()
WHERE tier = 'parent-plus'
  AND name ILIKE '%annual%';

-- Verify the updates
DO $$
DECLARE
  v_parent_starter_monthly INTEGER;
  v_parent_starter_annual INTEGER;
  v_parent_plus_monthly INTEGER;
  v_parent_plus_annual INTEGER;
BEGIN
  -- Get parent-starter prices
  SELECT price_monthly INTO v_parent_starter_monthly
  FROM public.subscription_plans
  WHERE tier = 'parent-starter' AND name ILIKE '%monthly%';
  
  SELECT price_annual INTO v_parent_starter_annual
  FROM public.subscription_plans
  WHERE tier = 'parent-starter' AND name ILIKE '%annual%';
  
  -- Get parent-plus prices
  SELECT price_monthly INTO v_parent_plus_monthly
  FROM public.subscription_plans
  WHERE tier = 'parent-plus' AND name ILIKE '%monthly%';
  
  SELECT price_annual INTO v_parent_plus_annual
  FROM public.subscription_plans
  WHERE tier = 'parent-plus' AND name ILIKE '%annual%';
  
  -- Raise notice with results
  RAISE NOTICE 'Parent Starter Monthly: % cents (should be 4999)', v_parent_starter_monthly;
  RAISE NOTICE 'Parent Starter Annual: % cents (should be 47990)', v_parent_starter_annual;
  RAISE NOTICE 'Parent Plus Monthly: % cents (should be 14999)', v_parent_plus_monthly;
  RAISE NOTICE 'Parent Plus Annual: % cents (should be 143990)', v_parent_plus_annual;
  
  -- Verify correctness
  IF v_parent_starter_monthly != 4999 OR v_parent_starter_annual != 47990 OR
     v_parent_plus_monthly != 14999 OR v_parent_plus_annual != 143990 THEN
    RAISE EXCEPTION 'Parent plan prices are still incorrect after update!';
  END IF;
  
  RAISE NOTICE '✅ All parent plan prices updated correctly';
END $$;