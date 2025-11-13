-- Fix Superadmin Schema Indexes Migration
-- Date: 2025-09-19
-- Purpose: Correct schema mismatches and fix index creation errors  
-- WARP.md Compliance: Supabase migration, production-safe, forward-only
-- Authority: Corrective migration for superadmin dashboard fixes

BEGIN;

-- ============================================================================
-- PART 1: ANALYZE EXISTING SCHEMA
-- ============================================================================

-- Check what columns actually exist in superadmin tables
-- This helps us understand the current schema vs expected schema

DO $$
BEGIN
  -- Log current table structures for debugging
  RAISE NOTICE 'Checking superadmin table schemas...';
END $$;

-- ============================================================================
-- PART 2: CONDITIONALLY CREATE MISSING COLUMNS
-- ============================================================================

-- Add target_user_id to superladmin_user_deletion_requests if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'superadmin_user_deletion_requests' 
    AND column_name = 'target_user_id'
  ) THEN
    -- If target_user_id doesn't exist, add it
    ALTER TABLE superadmin_user_deletion_requests 
    ADD COLUMN target_user_id UUID;
    
    RAISE NOTICE 'Added target_user_id column to superadmin_user_deletion_requests';
  END IF;
END $$;

-- Add admin_user_id to superadmin_user_actions if missing  
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'superadmin_user_actions' 
    AND column_name = 'admin_user_id'
  ) THEN
    ALTER TABLE superadmin_user_actions 
    ADD COLUMN admin_user_id UUID;
    
    RAISE NOTICE 'Added admin_user_id column to superadmin_user_actions';
  END IF;
END $$;

-- Add user_id to superadmin_user_risk_assessments if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'superadmin_user_risk_assessments' 
    AND column_name = 'user_id'
  ) THEN
    ALTER TABLE superadmin_user_risk_assessments 
    ADD COLUMN user_id UUID;
    
    RAISE NOTICE 'Added user_id column to superadmin_user_risk_assessments';
  END IF;
END $$;

-- ============================================================================
-- PART 3: CONDITIONALLY CREATE INDEXES BASED ON COLUMN EXISTENCE
-- ============================================================================

-- Create indexes only if the columns exist
DO $$
BEGIN
  -- User deletion requests indexes
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'superadmin_user_deletion_requests' 
    AND column_name = 'target_user_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_superadmin_deletion_requests_target_user 
    ON superadmin_user_deletion_requests(target_user_id);
    RAISE NOTICE 'Created index on target_user_id';
  END IF;

  -- Create status index if status column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'superadmin_user_deletion_requests' 
    AND column_name = 'status'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_superadmin_deletion_requests_status 
    ON superadmin_user_deletion_requests(status);
  END IF;

  -- Create created_at index if column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'superadmin_user_deletion_requests' 
    AND column_name = 'created_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_superadmin_deletion_requests_created_at 
    ON superadmin_user_deletion_requests(created_at);
  END IF;
END $$;

-- User actions indexes
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'superadmin_user_actions' 
    AND column_name = 'admin_user_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_superadmin_user_actions_admin_user 
    ON superadmin_user_actions(admin_user_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'superadmin_user_actions' 
    AND column_name = 'target_user_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_superadmin_user_actions_target_user 
    ON superadmin_user_actions(target_user_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'superadmin_user_actions' 
    AND column_name = 'action'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_superadmin_user_actions_action 
    ON superadmin_user_actions(action);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'superadmin_user_actions' 
    AND column_name = 'created_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_superadmin_user_actions_created_at 
    ON superadmin_user_actions(created_at);
  END IF;
END $$;

-- Risk assessments indexes
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'superadmin_user_risk_assessments' 
    AND column_name = 'user_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_superadmin_risk_assessments_user_id 
    ON superadmin_user_risk_assessments(user_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'superadmin_user_risk_assessments' 
    AND column_name = 'risk_level'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_superadmin_risk_assessments_risk_level 
    ON superadmin_user_risk_assessments(risk_level);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'superadmin_user_risk_assessments' 
    AND column_name = 'expires_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_superadmin_risk_assessments_expires_at 
    ON superadmin_user_risk_assessments(expires_at);
  END IF;
END $$;

-- Notifications indexes
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'superadmin_notifications') THEN
    -- Basic notification indexes
    CREATE INDEX IF NOT EXISTS idx_superadmin_notifications_type 
    ON superadmin_notifications(type);
    
    CREATE INDEX IF NOT EXISTS idx_superadmin_notifications_severity 
    ON superadmin_notifications(severity);
    
    CREATE INDEX IF NOT EXISTS idx_superadmin_notifications_status 
    ON superadmin_notifications(status);
    
    CREATE INDEX IF NOT EXISTS idx_superadmin_notifications_created_at 
    ON superadmin_notifications(created_at);
    
    -- GIN index for target_admins array if column exists
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'superadmin_notifications' 
      AND column_name = 'target_admins'
    ) THEN
      CREATE INDEX IF NOT EXISTS idx_superadmin_notifications_target_admins 
      ON superadmin_notifications USING GIN(target_admins);
    END IF;
  END IF;
END $$;

-- ============================================================================
-- PART 4: ENSURE REQUIRED ENUMS EXIST
-- ============================================================================

-- Create missing enums if they don't exist
DO $$
BEGIN
  -- Check and create deletion_type_enum if missing
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'deletion_type_enum') THEN
    CREATE TYPE deletion_type_enum AS ENUM ('soft', 'hard', 'gdpr_compliance');
    RAISE NOTICE 'Created deletion_type_enum';
  END IF;

  -- Check and create deletion_status_enum if missing  
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'deletion_status_enum') THEN
    CREATE TYPE deletion_status_enum AS ENUM ('pending', 'in_progress', 'completed', 'failed', 'cancelled');
    RAISE NOTICE 'Created deletion_status_enum';
  END IF;

  -- Check and create escalation_level_enum if missing
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'escalation_level_enum') THEN
    CREATE TYPE escalation_level_enum AS ENUM ('warning', 'suspension', 'termination');
    RAISE NOTICE 'Created escalation_level_enum';
  END IF;
END $$;

-- ============================================================================
-- PART 5: ADD MISSING COLUMN CONSTRAINTS  
-- ============================================================================

-- Add foreign key constraints if columns were just created
DO $$
BEGIN
  -- Add foreign key for target_user_id if it was just added
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'superadmin_user_deletion_requests' 
    AND column_name = 'target_user_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'superadmin_user_deletion_requests'
    AND kcu.column_name = 'target_user_id'
    AND tc.constraint_type = 'FOREIGN KEY'
  ) THEN
    -- Note: We can't add FK constraint without knowing the target table
    -- This will need to be done manually based on your users table structure
    RAISE NOTICE 'target_user_id column exists but FK constraint needs manual setup';
  END IF;
END $$;

-- ============================================================================
-- PART 6: VALIDATE SCHEMA REPAIR
-- ============================================================================

-- Report on what was fixed
DO $$
DECLARE
  table_count INTEGER;
  index_count INTEGER;
BEGIN
  -- Count superadmin tables
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables 
  WHERE table_name LIKE 'superadmin_%' 
  AND table_schema = 'public';

  -- Count superadmin indexes
  SELECT COUNT(*) INTO index_count
  FROM pg_indexes 
  WHERE indexname LIKE 'idx_superadmin_%';

  RAISE NOTICE 'Schema repair completed:';
  RAISE NOTICE '  - Superadmin tables: %', table_count;
  RAISE NOTICE '  - Superadmin indexes: %', index_count;
END $$;

-- ============================================================================
-- PART 7: COMPLETION LOGGING
-- ============================================================================

-- Log completion
INSERT INTO public.config_kv (key, value, description, is_public)
VALUES (
  'superadmin_schema_fix_20250919195100',
  json_build_object(
    'version', '1.0.0',
    'completed_at', now()::text,
    'migration_file', '20250919195100_fix_superadmin_schema_indexes.sql',
    'purpose', 'Fix schema mismatches and index creation errors'
  ),
  'Superadmin schema fix migration completion log',
  FALSE
) ON CONFLICT (key) DO UPDATE SET
  value = excluded.value,
  updated_at = now();

SELECT 'SUPERADMIN SCHEMA FIX COMPLETED' AS status;

COMMIT;
