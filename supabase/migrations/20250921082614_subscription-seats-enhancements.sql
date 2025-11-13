-- Migration: Enhance subscription_seats table for robust seat management
-- Created: 2025-09-21
-- Purpose: Add audit columns, constraints, and indexes to existing subscription_seats table
-- WARP.md compliance: production-safe schema enhancement, RLS ready

-- ====================================================================
-- PART 1: ADD AUDIT COLUMNS TO EXISTING subscription_seats TABLE
-- ====================================================================

-- Add audit columns only if they don't exist
DO $$
BEGIN
  -- Add assigned_by column if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'subscription_seats'
                 AND column_name = 'assigned_by') THEN
    ALTER TABLE public.subscription_seats 
    ADD COLUMN assigned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
    
    -- Backfill with null for existing records
    -- UPDATE public.subscription_seats SET assigned_by = NULL WHERE assigned_by IS NULL;
    RAISE NOTICE 'Added assigned_by column to subscription_seats';
  ELSE
    RAISE NOTICE 'assigned_by column already exists in subscription_seats';
  END IF;

  -- Add revoked_at column if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'subscription_seats'
                 AND column_name = 'revoked_at') THEN
    ALTER TABLE public.subscription_seats 
    ADD COLUMN revoked_at timestamptz NULL;
    RAISE NOTICE 'Added revoked_at column to subscription_seats';
  ELSE
    RAISE NOTICE 'revoked_at column already exists in subscription_seats';
  END IF;

  -- Add revoked_by column if missing  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'subscription_seats'
                 AND column_name = 'revoked_by') THEN
    ALTER TABLE public.subscription_seats 
    ADD COLUMN revoked_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
    RAISE NOTICE 'Added revoked_by column to subscription_seats';
  ELSE
    RAISE NOTICE 'revoked_by column already exists in subscription_seats';
  END IF;

  -- Add is_active computed column helper if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'subscription_seats'
                 AND column_name = 'is_active') THEN
    ALTER TABLE public.subscription_seats 
    ADD COLUMN is_active boolean GENERATED ALWAYS AS (revoked_at IS NULL) STORED;
    RAISE NOTICE 'Added is_active computed column to subscription_seats';
  ELSE
    RAISE NOTICE 'is_active column already exists in subscription_seats';
  END IF;
END $$;

-- ====================================================================
-- PART 2: ADD INDEXES FOR PERFORMANCE
-- ====================================================================

-- Index for active seats per subscription
CREATE INDEX IF NOT EXISTS idx_subscription_seats_active
ON public.subscription_seats (subscription_id) WHERE revoked_at IS NULL;

-- Index for finding user's seats  
CREATE INDEX IF NOT EXISTS idx_subscription_seats_user
ON public.subscription_seats (user_id);

-- Index for audit queries by assigned_by
CREATE INDEX IF NOT EXISTS idx_subscription_seats_assigned_by
ON public.subscription_seats (assigned_by) WHERE assigned_by IS NOT NULL;

-- ====================================================================
-- PART 3: ADD CONSTRAINTS FOR DATA INTEGRITY
-- ====================================================================

-- Ensure no duplicate active seats per user per subscription
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscription_seats_unique_active_user') THEN
    ALTER TABLE public.subscription_seats 
    ADD CONSTRAINT subscription_seats_unique_active_user 
    UNIQUE (subscription_id, user_id, revoked_at) 
    DEFERRABLE INITIALLY IMMEDIATE;
    RAISE NOTICE 'Added unique constraint for active seats';
  ELSE
    RAISE NOTICE 'Unique constraint already exists';
  END IF;
END $$;

-- Add check constraint to ensure revoked_by is set when revoked_at is set
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscription_seats_revoked_consistency') THEN
    ALTER TABLE public.subscription_seats 
    ADD CONSTRAINT subscription_seats_revoked_consistency 
    CHECK (revoked_at IS NULL OR revoked_by IS NOT NULL);
    RAISE NOTICE 'Added revocation consistency constraint';
  ELSE
    RAISE NOTICE 'Revocation consistency constraint already exists';
  END IF;
END $$;

-- ====================================================================
-- PART 4: ADD TABLE COMMENT
-- ====================================================================

COMMENT ON TABLE public.subscription_seats IS 'Enhanced teacher seat assignments with audit trail. revoked_at=NULL means active seat.';
COMMENT ON COLUMN public.subscription_seats.assigned_by IS 'User ID who assigned this seat (principal or system)';
COMMENT ON COLUMN public.subscription_seats.revoked_at IS 'When the seat was revoked. NULL = active seat';
COMMENT ON COLUMN public.subscription_seats.revoked_by IS 'User ID who revoked this seat';
COMMENT ON COLUMN public.subscription_seats.is_active IS 'Computed column: TRUE when revoked_at IS NULL';

-- ====================================================================
-- PART 5: ENABLE RLS (if not already enabled)
-- ====================================================================

-- Enable RLS on subscription_seats if not already enabled
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'subscription_seats' AND rowsecurity = TRUE) THEN
    ALTER TABLE public.subscription_seats ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'Enabled RLS on subscription_seats';
  ELSE
    RAISE NOTICE 'RLS already enabled on subscription_seats';
  END IF;
END $$;

-- ====================================================================
-- PART 6: VERIFICATION AND LOGGING
-- ====================================================================

-- Log migration completion
INSERT INTO public.config_kv (key, value, description, is_public)
VALUES (
  'subscription_seats_enhancement_20250921',
  jsonb_build_object(
    'completed_at', now(),
    'added_columns', ARRAY['assigned_by', 'revoked_at', 'revoked_by', 'is_active'],
    'added_indexes',
    ARRAY['idx_subscription_seats_active', 'idx_subscription_seats_user', 'idx_subscription_seats_assigned_by'],
    'added_constraints', ARRAY['subscription_seats_unique_active_user', 'subscription_seats_revoked_consistency'],
    'rls_enabled', TRUE
  ),
  'Subscription seats table enhancement completion log',
  FALSE
) ON CONFLICT (key) DO UPDATE SET
  value = excluded.value,
  updated_at = now();

SELECT 'SUBSCRIPTION SEATS TABLE ENHANCED' AS status;
