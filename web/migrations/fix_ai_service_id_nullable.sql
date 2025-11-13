-- Fix ai_service_id NOT NULL constraint issue
-- The column should be nullable since we're not using ai_services table

-- Make ai_service_id nullable
ALTER TABLE ai_usage_logs 
ALTER COLUMN ai_service_id DROP NOT NULL;

-- Verify the change
SELECT 
    column_name, 
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'ai_usage_logs'
  AND column_name = 'ai_service_id';
