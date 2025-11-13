-- Add public RPC to list active subscription plans
-- This allows anonymous users to see pricing on the marketing page

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.public_list_plans();

-- Create the function with proper return type
CREATE FUNCTION public.public_list_plans()
RETURNS TABLE (
  id uuid,
  name text,
  tier text,
  price_monthly integer,
  price_annual integer,
  max_teachers integer,
  max_students integer,
  features jsonb,
  is_active boolean,
  description text,
  created_at timestamptz,
  updated_at timestamptz
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sp.id,
    sp.name,
    sp.tier,
    sp.price_monthly,
    sp.price_annual,
    sp.max_teachers,
    sp.max_students,
    sp.features,
    sp.is_active,
    sp.description,
    sp.created_at,
    sp.updated_at
  FROM public.subscription_plans sp
  WHERE sp.is_active = true
  ORDER BY 
    CASE sp.tier
      WHEN 'free' THEN 0
      WHEN 'starter' THEN 1
      WHEN 'basic' THEN 2
      WHEN 'premium' THEN 3
      WHEN 'pro' THEN 4
      WHEN 'enterprise' THEN 5
      ELSE 999
    END,
    sp.price_monthly ASC;
END;
$$;

-- Grant execute permission to anonymous users for pricing page
GRANT EXECUTE ON FUNCTION public.public_list_plans() TO anon;
GRANT EXECUTE ON FUNCTION public.public_list_plans() TO authenticated;

-- Ensure subscription_plans table has proper RLS for anonymous reads
-- Anonymous users should be able to read active plans for pricing display
CREATE POLICY "Anonymous users can view active subscription plans"
ON public.subscription_plans
FOR SELECT
TO anon
USING (is_active = TRUE);
