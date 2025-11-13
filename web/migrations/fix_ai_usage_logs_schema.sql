-- Fix ai_usage_logs table schema
-- Add missing columns that the ai-proxy function expects

-- Add metadata column (JSONB for storing additional data)
ALTER TABLE ai_usage_logs 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add processing_time_ms column (for tracking AI response time)
ALTER TABLE ai_usage_logs 
ADD COLUMN IF NOT EXISTS processing_time_ms INTEGER;

-- Add comment for documentation
COMMENT ON COLUMN ai_usage_logs.metadata IS 'Additional metadata about the AI request/response (model details, tool usage, etc.)';
COMMENT ON COLUMN ai_usage_logs.processing_time_ms IS 'Time taken to process the AI request in milliseconds';

-- Verify the columns exist
SELECT 
    column_name, 
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'ai_usage_logs'
ORDER BY ordinal_position;
