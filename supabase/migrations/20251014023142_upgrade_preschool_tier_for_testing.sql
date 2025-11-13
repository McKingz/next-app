-- Upgrade Young Eagles Preschool to Premium Tier for Testing
-- This increases AI quota limits:
-- - Monthly AI requests: 50 → 2500
-- - Requests per minute: 5 → 30

-- Update the preschool tier
UPDATE preschools
SET subscription_tier = 'premium'
WHERE id = 'ba79097c-1b93-4b48-bcbe-df73878ab4d1'
  AND name = 'Young Eagles Preschool';

-- Verify the update
DO $$
DECLARE
  v_tier text;
BEGIN
  SELECT subscription_tier INTO v_tier
  FROM preschools
  WHERE id = 'ba79097c-1b93-4b48-bcbe-df73878ab4d1';
  
  IF v_tier = 'premium' THEN
    RAISE NOTICE 'Young Eagles Preschool upgraded to premium tier successfully';
  ELSE
    RAISE WARNING 'Failed to upgrade tier. Current tier: %', v_tier;
  END IF;
END $$;