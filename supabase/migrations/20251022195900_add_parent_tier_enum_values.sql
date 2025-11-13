-- Add Parent Tier Enum Values
-- Purpose: Add parent-starter and parent-plus to subscription_tier enum
-- NOTE: Must be in separate migration from usage due to PostgreSQL enum safety rules

DO $$
BEGIN
  -- Check if subscription_tier is an enum and add parent values
  IF EXISTS (
    SELECT 1 FROM pg_type t 
    JOIN pg_namespace n ON t.typnamespace = n.oid 
    WHERE t.typname = 'subscription_tier' AND n.nspname = 'public'
  ) THEN
    -- Add parent-starter if not exists
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum 
      WHERE enumtypid = 'public.subscription_tier'::regtype 
        AND enumlabel = 'parent-starter'
    ) THEN
      ALTER TYPE public.subscription_tier ADD VALUE 'parent-starter';
      RAISE NOTICE 'Added parent-starter to subscription_tier enum';
    END IF;
    
    -- Add parent-plus if not exists
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum 
      WHERE enumtypid = 'public.subscription_tier'::regtype 
        AND enumlabel = 'parent-plus'
    ) THEN
      ALTER TYPE public.subscription_tier ADD VALUE 'parent-plus';
      RAISE NOTICE 'Added parent-plus to subscription_tier enum';
    END IF;
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    RAISE NOTICE 'subscription_tier enum does not exist, skipping';
END;
$$;