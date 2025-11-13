-- AI Usage Hardening Migration
-- Adds missing indexes, metadata column, daily rollup view, and tightens RLS
-- Complies with WARP.md Non-negotiables for production database integrity

BEGIN;

-- Add metadata JSONB column if not exists for context tracking
DO $$ 
BEGIN
    -- Check if metadata column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ai_usage_logs' 
        AND column_name = 'metadata' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.ai_usage_logs 
        ADD COLUMN metadata JSONB;
        
        -- Add comment explaining the metadata usage
        COMMENT ON COLUMN public.ai_usage_logs.metadata IS 'Context metadata: student_id, class_id, subject, scope, model_settings, etc. Used for analytics and filtering.';
    END IF;
END $$;

-- Add indexes for performance (if not exists)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_usage_logs_user_created 
ON public.ai_usage_logs(user_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_usage_logs_preschool_created 
ON public.ai_usage_logs(preschool_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_usage_logs_service_created 
ON public.ai_usage_logs(service_type, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_usage_logs_status
ON public.ai_usage_logs(status);

-- GIN index on metadata JSONB for efficient filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_usage_logs_metadata_gin
ON public.ai_usage_logs USING GIN (metadata);

-- Composite index for monthly usage aggregation
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_usage_logs_monthly_agg
ON public.ai_usage_logs(user_id, service_type, DATE_TRUNC('month', created_at));

-- Composite index for organizational reporting
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_usage_logs_org_reporting
ON public.ai_usage_logs(preschool_id, service_type, status, created_at DESC);

-- Create daily rollup materialized view for fast org/school summaries
CREATE MATERIALIZED VIEW IF NOT EXISTS public.ai_usage_daily AS
SELECT 
    DATE(created_at) as usage_date,
    preschool_id,
    user_id,
    service_type,
    status,
    COUNT(*) as request_count,
    SUM(COALESCE(input_tokens, 0)) as total_input_tokens,
    SUM(COALESCE(output_tokens, 0)) as total_output_tokens,
    SUM(COALESCE(total_cost, 0)) as total_cost,
    AVG(COALESCE(response_time_ms, 0)) as avg_response_time_ms,
    COUNT(CASE WHEN status = 'success' THEN 1 END) as success_count,
    COUNT(CASE WHEN status = 'error' THEN 1 END) as error_count,
    COUNT(CASE WHEN status = 'rate_limited' THEN 1 END) as rate_limited_count,
    COUNT(CASE WHEN status = 'quota_exceeded' THEN 1 END) as quota_exceeded_count,
    -- Metadata aggregations (extract common fields)
    COUNT(CASE WHEN metadata->>'student_id' IS NOT NULL THEN 1 END) as student_context_count,
    COUNT(DISTINCT metadata->>'class_id') as unique_classes_count,
    COUNT(DISTINCT metadata->>'subject') as unique_subjects_count
FROM public.ai_usage_logs
GROUP BY 
    DATE(created_at),
    preschool_id,
    user_id,
    service_type,
    status;

-- Add indexes to the materialized view
CREATE INDEX IF NOT EXISTS idx_ai_usage_daily_date_preschool 
ON public.ai_usage_daily(usage_date DESC, preschool_id);

CREATE INDEX IF NOT EXISTS idx_ai_usage_daily_preschool_service 
ON public.ai_usage_daily(preschool_id, service_type, usage_date DESC);

CREATE INDEX IF NOT EXISTS idx_ai_usage_daily_user_service 
ON public.ai_usage_daily(user_id, service_type, usage_date DESC);

-- Function to refresh the materialized view
CREATE OR REPLACE FUNCTION public.refresh_ai_usage_daily()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.ai_usage_daily;
    
    -- Log the refresh for monitoring
    INSERT INTO public.audit_logs (
        event_type,
        table_name,
        details,
        created_at
    ) VALUES (
        'materialized_view_refresh',
        'ai_usage_daily',
        jsonb_build_object('refresh_time', NOW(), 'refresh_type', 'scheduled'),
        NOW()
    );
END;
$$;

-- Grant permissions on materialized view
GRANT SELECT ON public.ai_usage_daily TO authenticated;

-- Drop existing overly permissive RLS policies
DROP POLICY IF EXISTS "Users can view their own AI usage" ON public.ai_usage_logs;
DROP POLICY IF EXISTS "Principals can view school AI usage" ON public.ai_usage_logs;
DROP POLICY IF EXISTS "Super admins can view all AI usage" ON public.ai_usage_logs;

-- Create tightened RLS policies per WARP.md requirements
-- Teachers/Parents: can only select rows where user_id = auth.uid()
CREATE POLICY "ai_usage_logs_user_select" ON public.ai_usage_logs
    FOR SELECT USING (
        auth.uid() = user_id::uuid
        AND auth.role() = 'authenticated'
    );

-- Principal/Admin: can select rows where preschool_id matches their preschool
CREATE POLICY "ai_usage_logs_principal_select" ON public.ai_usage_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.auth_user_id = auth.uid()
            AND u.role IN ('principal', 'principal_admin')
            AND u.preschool_id = ai_usage_logs.preschool_id
        )
    );

-- Superadmin: NO direct table access - must use service functions
-- This policy explicitly denies direct access for superadmins
CREATE POLICY "ai_usage_logs_superadmin_deny" ON public.ai_usage_logs
    FOR ALL USING (
        NOT EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.auth_user_id = auth.uid()
            AND u.role = 'super_admin'
        )
    );

-- NO INSERT/UPDATE/DELETE policies - only edge functions can write
-- This enforces server-side-only logging per WARP.md

-- Create helper function for current user's preschool_id (used in policies)
CREATE OR REPLACE FUNCTION public.current_user_preschool_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT u.preschool_id 
    FROM public.users u 
    WHERE u.auth_user_id = auth.uid()
    LIMIT 1;
$$;

-- Grant execute permission on helper function
GRANT EXECUTE ON FUNCTION public.current_user_preschool_id() TO authenticated;

-- Apply RLS to materialized view (same policies)
ALTER MATERIALIZED VIEW public.ai_usage_daily ENABLE ROW LEVEL SECURITY;

-- RLS policies for daily rollup view
CREATE POLICY "ai_usage_daily_user_select" ON public.ai_usage_daily
    FOR SELECT USING (
        auth.uid() = user_id::uuid
        AND auth.role() = 'authenticated'
    );

CREATE POLICY "ai_usage_daily_principal_select" ON public.ai_usage_daily
    FOR SELECT USING (
        preschool_id = current_user_preschool_id()
        AND EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.auth_user_id = auth.uid()
            AND u.role IN ('principal', 'principal_admin')
        )
    );

-- Function to test RLS policies (for validation)
CREATE OR REPLACE FUNCTION public.test_ai_usage_rls()
RETURNS TABLE (
    test_name TEXT,
    user_role TEXT,
    can_access_own BOOLEAN,
    can_access_other_user BOOLEAN,
    can_access_other_school BOOLEAN,
    policy_working BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    test_user_id UUID;
    test_preschool_id UUID;
    other_user_id UUID;
    other_preschool_id UUID;
BEGIN
    -- This function would be used in testing to validate RLS policies
    -- Implementation would create test data and verify access patterns
    RETURN QUERY SELECT 
        'ai_usage_rls_test'::TEXT,
        'pending'::TEXT,
        FALSE,
        FALSE,
        FALSE,
        FALSE;
END;
$$;

-- Add constraints to ensure data integrity
-- Service type constraint (extend to include new AI features)
ALTER TABLE public.ai_usage_logs 
DROP CONSTRAINT IF EXISTS ai_usage_logs_service_type_check;

ALTER TABLE public.ai_usage_logs 
ADD CONSTRAINT ai_usage_logs_service_type_check 
CHECK (service_type IN (
    'lesson_generation',
    'grading_assistance', 
    'homework_help',
    'progress_analysis',
    'insights',
    'stem_activities'
));

-- Status constraint
ALTER TABLE public.ai_usage_logs 
DROP CONSTRAINT IF EXISTS ai_usage_logs_status_check;

ALTER TABLE public.ai_usage_logs 
ADD CONSTRAINT ai_usage_logs_status_check 
CHECK (status IN ('success', 'error', 'rate_limited', 'quota_exceeded', 'pending', 'cancelled'));

-- Token counts must be non-negative
ALTER TABLE public.ai_usage_logs 
ADD CONSTRAINT ai_usage_logs_input_tokens_non_negative 
CHECK (input_tokens >= 0);

ALTER TABLE public.ai_usage_logs 
ADD CONSTRAINT ai_usage_logs_output_tokens_non_negative 
CHECK (output_tokens >= 0);

-- Response time must be positive
ALTER TABLE public.ai_usage_logs 
ADD CONSTRAINT ai_usage_logs_response_time_positive 
CHECK (response_time_ms > 0);

-- Costs must be non-negative
ALTER TABLE public.ai_usage_logs 
ADD CONSTRAINT ai_usage_logs_costs_non_negative 
CHECK (
    (input_cost IS NULL OR input_cost >= 0) AND
    (output_cost IS NULL OR output_cost >= 0) AND
    (total_cost IS NULL OR total_cost >= 0)
);

-- Create audit trigger to track policy changes
CREATE OR REPLACE FUNCTION public.audit_ai_usage_policy_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.audit_logs (
        event_type,
        table_name,
        details,
        created_at
    ) VALUES (
        'ai_usage_policy_change',
        'ai_usage_logs',
        jsonb_build_object(
            'operation', TG_OP,
            'policy_name', TG_ARGV[0],
            'timestamp', NOW()
        ),
        NOW()
    );
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

-- Create a scheduled job to refresh the materialized view daily (if pg_cron is available)
-- This will fail silently if pg_cron extension is not available
DO $$
BEGIN
    -- Try to create a cron job to refresh daily at 2 AM
    BEGIN
        PERFORM cron.schedule(
            'refresh-ai-usage-daily',
            '0 2 * * *',  -- Daily at 2 AM
            'SELECT public.refresh_ai_usage_daily();'
        );
    EXCEPTION WHEN OTHERS THEN
        -- Log that automated refresh is not available
        INSERT INTO public.audit_logs (
            event_type,
            table_name,
            details,
            created_at
        ) VALUES (
            'cron_schedule_failed',
            'ai_usage_daily',
            jsonb_build_object(
                'error', SQLERRM,
                'note', 'Manual refresh required or enable pg_cron extension'
            ),
            NOW()
        );
    END;
END $$;

-- Final verification: ensure RLS is enabled
DO $$
BEGIN
    -- Verify RLS is enabled on main table
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' 
        AND c.relname = 'ai_usage_logs'
        AND c.relrowsecurity = true
    ) THEN
        RAISE EXCEPTION 'RLS not enabled on ai_usage_logs table';
    END IF;
    
    -- Log successful migration
    INSERT INTO public.audit_logs (
        event_type,
        table_name,
        details,
        created_at
    ) VALUES (
        'migration_completed',
        'ai_usage_logs',
        jsonb_build_object(
            'migration', '20250118_ai_usage_hardening',
            'features_added', ARRAY[
                'metadata_jsonb_column',
                'performance_indexes',
                'daily_rollup_materialized_view',
                'hardened_rls_policies',
                'data_integrity_constraints',
                'automated_refresh_function'
            ],
            'compliance', 'WARP.md Non-negotiables enforced'
        ),
        NOW()
    );
END $$;

COMMIT;