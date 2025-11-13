-- Fix service_type CHECK constraint to include Dash chat usage
-- Resolves 400 errors when ai-proxy attempts to log Dash conversation usage
-- Adds 'dash_conversation' and 'conversation' to permitted service_type values

BEGIN;

-- Drop existing constraint
ALTER TABLE public.ai_usage_logs
  DROP CONSTRAINT IF EXISTS ai_usage_logs_service_type_check;

-- Add updated constraint with Dash conversation types
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

-- Normalize any recent invalid entries (last 7 days)
-- Sets them to 'dash_conversation' to preserve data
UPDATE public.ai_usage_logs
SET service_type = 'dash_conversation'
WHERE service_type NOT IN (
  'lesson_generation',
  'homework_help',
  'grading_assistance',
  'general',
  'dash_conversation',
  'conversation'
)
AND created_at > NOW() - INTERVAL '7 days';

COMMIT;