-- Fix public_list_plans to return the exact table structure
-- Use SETOF to return records directly from the table

DROP FUNCTION IF EXISTS public.public_list_plans();

CREATE OR REPLACE FUNCTION public.public_list_plans()
RETURNS SETOF public.subscription_plans
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
AS $$
  SELECT * FROM public.subscription_plans
  WHERE is_active = true
  ORDER BY 
    CASE tier
      WHEN 'free' THEN 0
      WHEN 'starter' THEN 1
      WHEN 'basic' THEN 2
      WHEN 'premium' THEN 3
      WHEN 'pro' THEN 4
      WHEN 'enterprise' THEN 5
      ELSE 999
    END,
    price_monthly ASC;
$$;

-- Grant execute permission to anonymous users for pricing page
GRANT EXECUTE ON FUNCTION public.public_list_plans() TO anon;
GRANT EXECUTE ON FUNCTION public.public_list_plans() TO authenticated;
