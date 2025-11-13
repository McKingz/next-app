-- Fix Tier Verification and Profile Fetching
-- Purpose: Ensure tier is properly read from organizations table and synced
-- Date: 2025-10-22

-- Function to sync tier between preschools and organizations
CREATE OR REPLACE FUNCTION public.sync_organization_tier(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tier text;
  v_result jsonb;
BEGIN
  -- Get tier from active subscription
  SELECT 
    sp.tier INTO v_tier
  FROM subscriptions s
  JOIN subscription_plans sp ON s.plan_id = sp.id
  WHERE s.school_id = p_org_id
    AND s.status = 'active'
  ORDER BY s.end_date DESC
  LIMIT 1;
  
  -- If no active subscription, default to 'free'
  IF v_tier IS NULL THEN
    v_tier := 'free';
  END IF;
  
  -- Map unsupported tier values to valid ones
  -- Allowed: free, starter, professional, enterprise, parent-starter, parent-plus
  v_tier := CASE
    WHEN v_tier IN ('free', 'starter', 'professional', 'enterprise', 'parent-starter', 'parent-plus') THEN v_tier
    WHEN v_tier IN ('premium', 'pro') THEN 'professional'
    WHEN v_tier IN ('basic') THEN 'starter'
    ELSE 'free'
  END;
  
  -- Update both preschools and organizations
  UPDATE preschools
  SET subscription_tier = v_tier
  WHERE id = p_org_id;
  
  UPDATE organizations
  SET plan_tier = v_tier
  WHERE id = p_org_id;
  
  -- Return result
  v_result := jsonb_build_object(
    'organization_id', p_org_id,
    'tier', v_tier,
    'synced', true,
    'timestamp', now()
  );
  
  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.sync_organization_tier IS 'Syncs subscription tier between preschools and organizations tables based on active subscription';

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.sync_organization_tier TO authenticated;

-- Function to get user's subscription tier (with fallback logic)
CREATE OR REPLACE FUNCTION public.get_user_tier(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_tier text;
  v_org_id uuid;
BEGIN
  -- Get user's organization
  SELECT preschool_id INTO v_org_id
  FROM users
  WHERE id = p_user_id OR auth_user_id = p_user_id
  LIMIT 1;
  
  IF v_org_id IS NULL THEN
    RETURN 'free';
  END IF;
  
  -- Try organizations table first (new RBAC system)
  SELECT plan_tier INTO v_tier
  FROM organizations
  WHERE id = v_org_id;
  
  -- Fallback to preschools table (legacy)
  IF v_tier IS NULL THEN
    SELECT subscription_tier INTO v_tier
    FROM preschools
    WHERE id = v_org_id;
  END IF;
  
  -- Fallback to active subscription
  IF v_tier IS NULL THEN
    SELECT sp.tier INTO v_tier
    FROM subscriptions s
    JOIN subscription_plans sp ON s.plan_id = sp.id
    WHERE s.school_id = v_org_id
      AND s.status = 'active'
    ORDER BY s.end_date DESC
    LIMIT 1;
  END IF;
  
  -- Default to free
  RETURN COALESCE(v_tier, 'free');
END;
$$;

COMMENT ON FUNCTION public.get_user_tier IS 'Gets user subscription tier with fallback logic: organizations.plan_tier -> preschools.subscription_tier -> active subscription -> free';

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_tier TO authenticated;

-- Create view for user profile with proper tier
CREATE OR REPLACE VIEW public.user_profiles_with_tier AS
SELECT 
  u.id,
  u.auth_user_id,
  u.preschool_id,
  u.role,
  COALESCE(u.first_name || ' ' || u.last_name, u.email) as name,
  u.email,
  u.phone,
  u.avatar_url,
  u.is_active,
  u.created_at,
  u.updated_at,
  p.id as preschool_id_nested,
  p.name as preschool_name,
  COALESCE(o.plan_tier, p.subscription_tier, 'free') as subscription_tier
FROM users u
LEFT JOIN preschools p ON u.preschool_id = p.id
LEFT JOIN organizations o ON u.preschool_id = o.id;

COMMENT ON VIEW public.user_profiles_with_tier IS 'User profiles with proper tier resolution from organizations or preschools';

-- Grant select to authenticated users
GRANT SELECT ON public.user_profiles_with_tier TO authenticated;

-- Trigger to auto-sync tier when subscription changes
CREATE OR REPLACE FUNCTION public.trigger_sync_tier_on_subscription_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Sync tier when subscription status or plan changes
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.status = 'active' THEN
    PERFORM public.sync_organization_tier(NEW.school_id);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on subscriptions table
DROP TRIGGER IF EXISTS sync_tier_on_subscription_change ON subscriptions;
CREATE TRIGGER sync_tier_on_subscription_change
  AFTER INSERT OR UPDATE OF status, plan_id
  ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION trigger_sync_tier_on_subscription_change();

COMMENT ON TRIGGER sync_tier_on_subscription_change ON subscriptions IS 'Auto-syncs organization tier when subscription changes';

-- Sync all existing organizations on migration
DO $$
DECLARE
  v_org record;
BEGIN
  FOR v_org IN 
    SELECT DISTINCT school_id 
    FROM subscriptions 
    WHERE status = 'active' AND school_id IS NOT NULL
  LOOP
    PERFORM public.sync_organization_tier(v_org.school_id);
  END LOOP;
END $$;
