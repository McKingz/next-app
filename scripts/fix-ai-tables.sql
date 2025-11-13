-- Fix AI tables that were partially created
-- This script checks and fixes the ai_usage_logs table structure

-- Check if ai_usage_logs exists and what columns it has
\d ai_usage_logs;

-- Check if organization_id column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'ai_usage_logs' 
AND table_schema = 'public' 
AND column_name = 'organization_id';

-- If the table exists but has wrong structure, drop and recreate it
DROP TABLE IF EXISTS public.ai_usage_logs CASCADE;

-- Recreate the ai_usage_logs table with correct structure
CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Request context
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ai_service_id UUID NOT NULL REFERENCES public.ai_services(id),
  
  -- Service type and context
  service_type TEXT NOT NULL CHECK (
    service_type IN ('homework_help', 'lesson_generation', 'grading_assistance', 'stem_activities', 'other')
  ),
  request_context TEXT, -- assignment_id, student_id, etc.
  session_id UUID, -- For grouping related requests
  
  -- Request details
  input_text TEXT,
  input_tokens INTEGER,
  system_prompt TEXT,
  
  -- Response details
  output_text TEXT,
  output_tokens INTEGER,
  
  -- Performance metrics
  response_time_ms INTEGER,
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'rate_limited', 'quota_exceeded')),
  error_message TEXT,
  
  -- Cost calculation
  input_cost DECIMAL(8,6),
  output_cost DECIMAL(8,6),
  total_cost DECIMAL(8,6),
  
  -- Quality metrics
  user_rating INTEGER CHECK (user_rating BETWEEN 1 AND 5),
  user_feedback TEXT,
  
  -- AI response metadata
  ai_model_used TEXT,
  ai_temperature DECIMAL(3,2),
  ai_confidence_score DECIMAL(3,2)
);

-- Enable RLS
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT ALL ON public.ai_usage_logs TO authenticated;
