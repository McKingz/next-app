-- Fix AI Usage Logs Table Constraints
-- Adds missing service_types to allow dash_conversation and conversation

BEGIN;

-- Update service_type constraint to include all valid types
ALTER TABLE public.ai_usage_logs 
DROP CONSTRAINT IF EXISTS ai_usage_logs_service_type_check;

ALTER TABLE public.ai_usage_logs
ADD CONSTRAINT ai_usage_logs_service_type_check 
CHECK (service_type IN (
  'lesson_generation', 
  'homework_help', 
  'grading_assistance', 
  'general',
  'dash_conversation',
  'conversation'
));

COMMIT;

-- Add comment
COMMENT ON CONSTRAINT ai_usage_logs_service_type_check ON public.ai_usage_logs 
IS 'Allows all service types including dash_conversation and conversation';
