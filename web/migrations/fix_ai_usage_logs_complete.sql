-- Complete fix for ai_usage_logs table issues
-- This addresses all the constraint problems

-- Step 1: Make ai_service_id nullable (not using ai_services table)
ALTER TABLE ai_usage_logs 
ALTER COLUMN ai_service_id DROP NOT NULL;

-- Step 2: Drop the foreign key constraint on organization_id
-- (You're using preschool_id instead, not organization_id)
ALTER TABLE ai_usage_logs 
DROP CONSTRAINT IF EXISTS ai_usage_logs_organization_id_fkey;

-- Step 3: Make organization_id nullable (or remove it entirely if not needed)
ALTER TABLE ai_usage_logs 
ALTER COLUMN organization_id DROP NOT NULL;

-- Step 4: Add missing columns if they don't exist
ALTER TABLE ai_usage_logs 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

ALTER TABLE ai_usage_logs 
ADD COLUMN IF NOT EXISTS processing_time_ms INTEGER;

-- Step 5: Verify all changes
SELECT 
    column_name, 
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'ai_usage_logs'
  AND column_name IN ('ai_service_id', 'organization_id', 'preschool_id', 'metadata', 'processing_time_ms')
ORDER BY column_name;

-- Step 6: Check remaining constraints
SELECT
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
WHERE t.relname = 'ai_usage_logs'
  AND contype = 'f'  -- Foreign key constraints only
ORDER BY conname;
