-- Setup Claude AI Service in ai_services table
-- This ensures the ai_usage_logs can reference the correct ai_service_id

-- Insert Claude AI service if it doesn't exist
INSERT INTO public.ai_services (
    name,
    provider,
    model_version,
    input_cost_per_1k_tokens,
    output_cost_per_1k_tokens,
    is_active,
    is_available,
    supports_homework_help,
    supports_lesson_generation,
    supports_grading,
    supports_stem_activities,
    rate_limit_per_minute,
    rate_limit_per_hour,
    rate_limit_per_day
) VALUES (
    'Claude',
    'anthropic',
    'claude-3-sonnet-20240229',
    3.0,   -- $0.003 per 1K input tokens (stored as 3.0 for precision)
    15.0,  -- $0.015 per 1K output tokens (stored as 15.0 for precision)
    true,
    true,
    true,  -- supports homework help
    true,  -- supports lesson generation
    true,  -- supports grading
    true,  -- supports STEM activities
    10,    -- 10 requests per minute
    200,   -- 200 requests per hour
    1000   -- 1000 requests per day
) ON CONFLICT (name, provider) DO UPDATE SET
    model_version = EXCLUDED.model_version,
    input_cost_per_1k_tokens = EXCLUDED.input_cost_per_1k_tokens,
    output_cost_per_1k_tokens = EXCLUDED.output_cost_per_1k_tokens,
    updated_at = NOW();

-- Verify the service was created
SELECT id, name, provider, model_version, is_active, is_available 
FROM public.ai_services 
WHERE name = 'Claude' AND provider = 'anthropic';