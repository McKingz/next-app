-- URGENT: Fix AI Usage Logs Constraint
-- This MUST be run in Supabase Dashboard → SQL Editor NOW

-- Current error: 400 when trying to insert into ai_usage_logs
-- Cause: service_type constraint doesn't allow 'homework_help'

BEGIN;

-- Drop the old constraint
ALTER TABLE public.ai_usage_logs 
DROP CONSTRAINT IF EXISTS ai_usage_logs_service_type_check;

-- Add new constraint with ALL service types
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

-- Verify it worked
SELECT constraint_name, check_clause 
FROM information_schema.check_constraints 
WHERE constraint_name = 'ai_usage_logs_service_type_check';
