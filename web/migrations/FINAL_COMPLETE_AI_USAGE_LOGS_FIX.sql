-- ============================================
-- COMPLETE FIX FOR AI_USAGE_LOGS TABLE
-- Run this entire script in Supabase SQL Editor
-- ============================================

-- Step 1: Make ai_service_id nullable
ALTER TABLE ai_usage_logs 
ALTER COLUMN ai_service_id DROP NOT NULL;

-- Step 2: Drop the foreign key constraint on organization_id
-- This is causing the 503 error!
ALTER TABLE ai_usage_logs 
DROP CONSTRAINT IF EXISTS ai_usage_logs_organization_id_fkey;

-- Step 3: Make organization_id nullable
ALTER TABLE ai_usage_logs 
ALTER COLUMN organization_id DROP NOT NULL;

-- Step 4: Add missing columns (if they don't exist)
ALTER TABLE ai_usage_logs 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

ALTER TABLE ai_usage_logs 
ADD COLUMN IF NOT EXISTS processing_time_ms INTEGER;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check that all columns are now correct
SELECT 
    column_name, 
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'ai_usage_logs'
  AND column_name IN ('ai_service_id', 'organization_id', 'preschool_id', 'metadata', 'processing_time_ms')
ORDER BY column_name;

-- Check that the problematic foreign key constraint is gone
SELECT
    conname AS constraint_name,
    contype AS constraint_type
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
WHERE t.relname = 'ai_usage_logs'
  AND conname = 'ai_usage_logs_organization_id_fkey';

-- If the above returns NO ROWS, the constraint was successfully dropped! ✅
