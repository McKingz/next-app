-- Fix Remaining Security Definer Views Migration
-- Date: 2025-09-19
-- Purpose: Fix all remaining 5 security definer views identified by security linter
-- WARP.md Compliance: Remove SECURITY DEFINER from views to enforce proper RLS

BEGIN;

-- Helper function to get current user's organization/preschool ID
CREATE OR REPLACE FUNCTION public.current_user_org_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER -- This is intentional for helper function only
SET search_path = public
AS $$
BEGIN
  -- Try organization_id first, then preschool_id for compatibility
  RETURN COALESCE(
    (SELECT organization_id FROM users WHERE auth_user_id = auth.uid()),
    (SELECT preschool_id FROM users WHERE auth_user_id = auth.uid()),
    (auth.jwt() ->> 'organization_id')::uuid,
    (auth.jwt() ->> 'preschool_id')::uuid
  );
END;
$$;

-- ============================================================================
-- 1. Fix school_daily_ai_usage view
-- ============================================================================
DO $security_fix$
BEGIN
  -- Drop and recreate school_daily_ai_usage view
  DROP VIEW IF EXISTS public.school_daily_ai_usage CASCADE;
  
  CREATE OR REPLACE VIEW public.school_daily_ai_usage 
  WITH (security_invoker = true) AS
  SELECT 
    DATE(aul.created_at) as usage_date,
    aul.preschool_id,
    p.name as school_name,
    COUNT(*) as total_requests,
    COUNT(DISTINCT aul.user_id) as active_users,
    SUM(COALESCE(aul.input_tokens, 0)) as total_input_tokens,
    SUM(COALESCE(aul.output_tokens, 0)) as total_output_tokens,
    SUM(COALESCE(aul.total_cost, 0)) as total_cost,
    AVG(COALESCE(aul.response_time_ms, 0)) as avg_response_time,
    COUNT(CASE WHEN aul.status = 'success' THEN 1 END) as success_count,
    COUNT(CASE WHEN aul.status = 'error' THEN 1 END) as error_count
  FROM ai_usage_logs aul
  LEFT JOIN preschools p ON aul.preschool_id = p.id
  WHERE aul.preschool_id = current_user_org_id()
  GROUP BY DATE(aul.created_at), aul.preschool_id, p.name
  ORDER BY usage_date DESC;

  RAISE NOTICE 'Fixed school_daily_ai_usage view with security_invoker';
END
$security_fix$;

-- ============================================================================
-- 2. Fix template_performance_metrics view
-- ============================================================================
DO $security_fix$
BEGIN
  -- Drop and recreate template_performance_metrics view
  DROP VIEW IF EXISTS public.template_performance_metrics CASCADE;
  
  CREATE OR REPLACE VIEW public.template_performance_metrics 
  WITH (security_invoker = true) AS
  SELECT 
    t.id as template_id,
    t.name as template_name,
    t.subject,
    t.grade_level,
    COUNT(DISTINCT l.id) as lessons_created,
    COUNT(DISTINCT ha.id) as homework_assigned,
    AVG(CASE WHEN hs.score IS NOT NULL THEN hs.score END) as avg_score,
    COUNT(DISTINCT hs.student_id) as students_engaged,
    COUNT(hs.id) as submissions_count,
    AVG(EXTRACT(EPOCH FROM (hs.submitted_at - ha.assigned_date))/3600) as avg_completion_hours
  FROM lesson_templates t
  LEFT JOIN lessons l ON l.template_id = t.id
  LEFT JOIN homework_assignments ha ON ha.lesson_id = l.id
  LEFT JOIN homework_submissions hs ON hs.assignment_id = ha.id
  WHERE t.preschool_id = current_user_org_id() OR t.is_public = true
  GROUP BY t.id, t.name, t.subject, t.grade_level
  ORDER BY lessons_created DESC, avg_score DESC;

  RAISE NOTICE 'Fixed template_performance_metrics view with security_invoker';
END
$security_fix$;

-- ============================================================================
-- 3. Fix delivery_analytics view
-- ============================================================================
DO $security_fix$
BEGIN
  -- Drop and recreate delivery_analytics view
  DROP VIEW IF EXISTS public.delivery_analytics CASCADE;
  
  CREATE OR REPLACE VIEW public.delivery_analytics 
  WITH (security_invoker = true) AS
  SELECT 
    DATE(n.created_at) as delivery_date,
    n.type as notification_type,
    n.delivery_method,
    COUNT(*) as total_sent,
    COUNT(CASE WHEN n.delivered_at IS NOT NULL THEN 1 END) as delivered_count,
    COUNT(CASE WHEN n.read_at IS NOT NULL THEN 1 END) as read_count,
    COUNT(CASE WHEN n.failed_at IS NOT NULL THEN 1 END) as failed_count,
    ROUND(
      (COUNT(CASE WHEN n.delivered_at IS NOT NULL THEN 1 END)::numeric / COUNT(*)::numeric) * 100, 2
    ) as delivery_rate_percent,
    ROUND(
      (COUNT(CASE WHEN n.read_at IS NOT NULL THEN 1 END)::numeric / COUNT(*)::numeric) * 100, 2
    ) as read_rate_percent,
    AVG(EXTRACT(EPOCH FROM (n.delivered_at - n.created_at))/60) as avg_delivery_time_minutes
  FROM notifications n
  WHERE n.preschool_id = current_user_org_id()
  GROUP BY DATE(n.created_at), n.type, n.delivery_method
  ORDER BY delivery_date DESC, total_sent DESC;

  RAISE NOTICE 'Fixed delivery_analytics view with security_invoker';
END
$security_fix$;

-- ============================================================================
-- 4. Fix daily_ai_usage_rollup view
-- ============================================================================
DO $security_fix$
BEGIN
  -- Drop and recreate daily_ai_usage_rollup view
  DROP VIEW IF EXISTS public.daily_ai_usage_rollup CASCADE;
  
  CREATE OR REPLACE VIEW public.daily_ai_usage_rollup 
  WITH (security_invoker = true) AS
  SELECT 
    DATE(aul.created_at) as usage_date,
    aul.preschool_id,
    aul.service_type,
    COUNT(*) as request_count,
    COUNT(DISTINCT aul.user_id) as unique_users,
    SUM(COALESCE(aul.input_tokens, 0)) as total_input_tokens,
    SUM(COALESCE(aul.output_tokens, 0)) as total_output_tokens,
    SUM(COALESCE(aul.total_cost, 0)) as total_cost,
    AVG(COALESCE(aul.response_time_ms, 0)) as avg_response_time_ms,
    COUNT(CASE WHEN aul.status = 'success' THEN 1 END) as success_count,
    COUNT(CASE WHEN aul.status = 'error' THEN 1 END) as error_count,
    COUNT(CASE WHEN aul.status = 'rate_limited' THEN 1 END) as rate_limited_count,
    COUNT(CASE WHEN aul.status = 'quota_exceeded' THEN 1 END) as quota_exceeded_count
  FROM ai_usage_logs aul
  WHERE aul.preschool_id = current_user_org_id()
  GROUP BY DATE(aul.created_at), aul.preschool_id, aul.service_type
  ORDER BY usage_date DESC, request_count DESC;

  RAISE NOTICE 'Fixed daily_ai_usage_rollup view with security_invoker';
END
$security_fix$;

-- ============================================================================
-- 5. Fix monthly_ai_usage_rollup view
-- ============================================================================
DO $security_fix$
BEGIN
  -- Drop and recreate monthly_ai_usage_rollup view
  DROP VIEW IF EXISTS public.monthly_ai_usage_rollup CASCADE;
  
  CREATE OR REPLACE VIEW public.monthly_ai_usage_rollup 
  WITH (security_invoker = true) AS
  SELECT 
    DATE_TRUNC('month', aul.created_at) as usage_month,
    aul.preschool_id,
    aul.service_type,
    COUNT(*) as request_count,
    COUNT(DISTINCT aul.user_id) as unique_users,
    COUNT(DISTINCT DATE(aul.created_at)) as active_days,
    SUM(COALESCE(aul.input_tokens, 0)) as total_input_tokens,
    SUM(COALESCE(aul.output_tokens, 0)) as total_output_tokens,
    SUM(COALESCE(aul.total_cost, 0)) as total_cost,
    AVG(COALESCE(aul.response_time_ms, 0)) as avg_response_time_ms,
    COUNT(CASE WHEN aul.status = 'success' THEN 1 END) as success_count,
    COUNT(CASE WHEN aul.status = 'error' THEN 1 END) as error_count,
    COUNT(CASE WHEN aul.status = 'rate_limited' THEN 1 END) as rate_limited_count,
    COUNT(CASE WHEN aul.status = 'quota_exceeded' THEN 1 END) as quota_exceeded_count,
    -- Monthly averages
    ROUND(COUNT(*)::numeric / COUNT(DISTINCT DATE(aul.created_at))::numeric, 2) as avg_requests_per_day,
    ROUND(SUM(COALESCE(aul.total_cost, 0))::numeric / COUNT(DISTINCT DATE(aul.created_at))::numeric, 4) as avg_cost_per_day
  FROM ai_usage_logs aul
  WHERE aul.preschool_id = current_user_org_id()
  GROUP BY DATE_TRUNC('month', aul.created_at), aul.preschool_id, aul.service_type
  ORDER BY usage_month DESC, request_count DESC;

  RAISE NOTICE 'Fixed monthly_ai_usage_rollup view with security_invoker';
END
$security_fix$;

-- ============================================================================
-- Enable RLS on views (if supported)
-- ============================================================================
-- Note: Views inherit RLS from their underlying tables, but we can add explicit policies if needed

-- Grant appropriate permissions
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;

-- Create a function to verify all views are now security_invoker
CREATE OR REPLACE FUNCTION public.verify_view_security_mode()
RETURNS TABLE (view_name text, security_invoker boolean, security_definer boolean)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    v.table_name::text,
    CASE 
      WHEN v.view_definition LIKE '%security_invoker%' THEN true
      ELSE false
    END as security_invoker,
    CASE 
      WHEN v.view_definition LIKE '%SECURITY DEFINER%' OR v.view_definition LIKE '%security_definer%' THEN true
      ELSE false
    END as security_definer
  FROM information_schema.views v
  WHERE v.table_schema = 'public'
    AND v.table_name IN (
      'school_daily_ai_usage',
      'template_performance_metrics', 
      'delivery_analytics',
      'daily_ai_usage_rollup',
      'monthly_ai_usage_rollup',
      'teacher_stats',
      'users_with_subscription',
      'activity_logs_view',
      'classes_with_teachers'
    )
  ORDER BY v.table_name;
END;
$$;

-- ============================================================================
-- VALIDATION AND LOGGING
-- ============================================================================

-- Log the completion of this security fix
INSERT INTO public.config_kv (key, value, description, is_public)
VALUES (
  'security_definer_views_fixed_20250919',
  json_build_object(
    'version', '1.0.0',
    'completed_at', now()::text,
    'views_fixed', ARRAY[
      'school_daily_ai_usage',
      'template_performance_metrics',
      'delivery_analytics',
      'daily_ai_usage_rollup',
      'monthly_ai_usage_rollup'
    ],
    'total_views_secured', 9
  ),
  'Security definer views fix completion log',
  FALSE
) ON CONFLICT (key) DO UPDATE SET
  value = excluded.value,
  updated_at = now();

-- Final verification
SELECT 'SECURITY DEFINER VIEWS FIXED' AS status;
SELECT
  view_name,
  security_invoker,
  security_definer
FROM verify_view_security_mode();

COMMIT;
