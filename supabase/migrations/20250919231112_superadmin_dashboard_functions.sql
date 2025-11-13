-- =============================================
-- EduDash Pro: SuperAdmin Dashboard Functions
-- Version: 1.0.0
-- Date: 2025-09-19
-- Purpose: Create comprehensive RPC functions for superadmin dashboard data
-- WARP.md Compliance: Migration-only, production-safe, forward-only
-- =============================================

BEGIN;

-- Drop existing functions that may have conflicting return types
DROP FUNCTION IF EXISTS public.get_all_users_for_superadmin();
DROP FUNCTION IF EXISTS public.get_platform_stats_for_superadmin();
DROP FUNCTION IF EXISTS public.get_superadmin_ai_quotas();
DROP FUNCTION IF EXISTS public.get_subscription_analytics(DATE, DATE);

-- ============================================================================
-- FUNCTION 1: GET_ALL_USERS_FOR_SUPERADMIN
-- Purpose: Get all users with their associated school information
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_all_users_for_superadmin()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_user_id UUID := auth.uid();
  v_users JSONB;
BEGIN
  -- Check if current user is superadmin
  IF NOT EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = v_current_user_id 
    AND role = 'superadmin'
  ) THEN
    RETURN json_build_object('error', 'Unauthorized: Superadmin access required');
  END IF;
  
  -- Get all users with their school information
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', u.id,
      'email', au.email,
      'name', COALESCE(u.first_name || ' ' || u.last_name, u.first_name, u.last_name),
      'full_name', COALESCE(u.first_name || ' ' || u.last_name, u.first_name, u.last_name),
      'role', u.role,
      'school_id', u.preschool_id,
      'school_name', COALESCE(p.name, 'No School'),
      'created_at', u.created_at,
      'last_sign_in_at', au.last_sign_in_at,
      'is_active', u.is_active,
      'avatar_url', u.avatar_url
    )
  ) INTO v_users
  FROM public.users u
  LEFT JOIN auth.users au ON u.id = au.id
  LEFT JOIN public.preschools p ON u.preschool_id = p.id
  ORDER BY u.created_at DESC;
  
  RETURN v_users;
END;
$$;

-- ============================================================================
-- FUNCTION 2: GET_PLATFORM_STATS_FOR_SUPERADMIN
-- Purpose: Get comprehensive platform statistics
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_platform_stats_for_superadmin()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_user_id UUID := auth.uid();
  v_stats JSONB;
  v_total_schools INTEGER := 0;
  v_total_users INTEGER := 0;
  v_total_students INTEGER := 0;
  v_total_teachers INTEGER := 0;
  v_total_parents INTEGER := 0;
  v_active_subscriptions INTEGER := 0;
  v_total_revenue DECIMAL := 0;
  v_monthly_revenue DECIMAL := 0;
  v_ai_usage_month DECIMAL := 0;
  v_avg_school_size DECIMAL := 0;
BEGIN
  -- Check if current user is superadmin
  IF NOT EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = v_current_user_id 
    AND role = 'superadmin'
  ) THEN
    RETURN json_build_object('error', 'Unauthorized: Superadmin access required');
  END IF;
  
  -- Get school count (active preschools)
  SELECT COUNT(*) INTO v_total_schools
  FROM public.preschools
  WHERE is_active = TRUE;
  
  -- Get user counts by role
  SELECT COUNT(*) INTO v_total_users FROM public.users WHERE is_active = TRUE;
  SELECT COUNT(*) INTO v_total_teachers FROM public.users WHERE role = 'teacher' AND is_active = TRUE;
  SELECT COUNT(*) INTO v_total_parents FROM public.users WHERE role = 'parent' AND is_active = TRUE;
  
  -- Get student count from enrollments
  SELECT COUNT(DISTINCT student_id) INTO v_total_students 
  FROM public.enrollments 
  WHERE status = 'active';
  
  -- Get subscription stats
  SELECT COUNT(*) INTO v_active_subscriptions
  FROM public.subscriptions
  WHERE status = 'active';
  
  -- Calculate revenue from subscription plans
  SELECT 
    COALESCE(SUM(
      CASE 
        WHEN s.billing_frequency = 'annual' THEN sp.price_annual
        ELSE sp.price_monthly * 12
      END
    ), 0),
    COALESCE(SUM(
      CASE 
        WHEN s.billing_frequency = 'annual' THEN sp.price_annual / 12
        ELSE sp.price_monthly
      END
    ), 0)
  INTO v_total_revenue, v_monthly_revenue
  FROM public.subscriptions s
  JOIN public.subscription_plans sp ON s.plan_id = sp.id
  WHERE s.status = 'active';
  
  -- Get AI usage cost for current month
  SELECT COALESCE(SUM(total_cost), 0) INTO v_ai_usage_month
  FROM public.ai_usage_logs
  WHERE created_at >= date_trunc('month', CURRENT_DATE)
  AND created_at < date_trunc('month', CURRENT_DATE) + interval '1 month';
  
  -- Calculate average school size (users per school)
  SELECT 
    CASE 
      WHEN v_total_schools > 0 THEN v_total_users::DECIMAL / v_total_schools
      ELSE 0
    END INTO v_avg_school_size;
  
  -- Build response
  v_stats := jsonb_build_object(
    'total_schools', v_total_schools,
    'total_users', v_total_users,
    'total_students', v_total_students,
    'total_teachers', v_total_teachers,
    'total_parents', v_total_parents,
    'active_subscriptions', v_active_subscriptions,
    'total_revenue', v_total_revenue,
    'monthly_revenue', v_monthly_revenue,
    'ai_usage_month', v_ai_usage_month,
    'avg_school_size', v_avg_school_size,
    'churn_rate', 0, -- Placeholder for future implementation
    'growth_rate', 0 -- Placeholder for future implementation
  );
  
  RETURN v_stats;
END;
$$;

-- ============================================================================
-- FUNCTION 3: GET_SUPERADMIN_AI_QUOTAS
-- Purpose: Get AI quota information for all schools
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_superadmin_ai_quotas()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_user_id UUID := auth.uid();
  v_result JSONB;
  v_school_quotas JSONB;
  v_usage_stats JSONB;
  v_global_config JSONB;
BEGIN
  -- Check if current user is superadmin
  IF NOT EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = v_current_user_id 
    AND role = 'superadmin'
  ) THEN
    RETURN json_build_object('error', 'Unauthorized: Superadmin access required');
  END IF;
  
  -- Get school quotas with their current AI usage
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'school_id', p.id,
      'school_name', p.name,
      'plan_type', COALESCE(sp.tier, 'free'),
      'monthly_limit', COALESCE(
        CASE sp.tier
          WHEN 'basic' THEN 5000
          WHEN 'pro' THEN 25000
          WHEN 'enterprise' THEN 100000
          ELSE 1000
        END, 1000
      ),
      'current_usage', COALESCE(usage.monthly_tokens, 0),
      'reset_date', (date_trunc('month', CURRENT_DATE) + interval '1 month')::TEXT,
      'overage_allowed', COALESCE(sp.tier != 'free', false),
      'overage_limit', CASE WHEN sp.tier != 'free' THEN 10000 ELSE NULL END,
      'cost_per_overage', 0.002,
      'warnings_enabled', true,
      'warning_thresholds', ARRAY[75, 90, 95],
      'is_suspended', COALESCE(usage.monthly_tokens > 120000, false),
      'last_updated', COALESCE(usage.last_usage, p.updated_at)::TEXT
    )
  ) INTO v_school_quotas
  FROM public.preschools p
  LEFT JOIN public.subscriptions s ON p.id = s.school_id AND s.status = 'active'
  LEFT JOIN public.subscription_plans sp ON s.plan_id = sp.id
  LEFT JOIN (
    SELECT 
      school_id,
      SUM(input_tokens + output_tokens) as monthly_tokens,
      MAX(created_at) as last_usage
    FROM public.ai_usage_logs
    WHERE created_at >= date_trunc('month', CURRENT_DATE)
    GROUP BY school_id
  ) usage ON p.id = usage.school_id
  WHERE p.is_active = TRUE;
  
  -- Calculate usage statistics
  WITH usage_data AS (
    SELECT 
      COUNT(DISTINCT school_id) as active_schools,
      SUM(input_tokens + output_tokens) as total_tokens,
      SUM(total_cost) as total_cost
    FROM public.ai_usage_logs
    WHERE created_at >= date_trunc('month', CURRENT_DATE)
  ),
  school_counts AS (
    SELECT 
      COUNT(*) as total_schools,
      COUNT(CASE WHEN usage.monthly_tokens > 100000 THEN 1 END) as over_limit,
      COUNT(CASE WHEN usage.monthly_tokens > 120000 THEN 1 END) as suspended
    FROM public.preschools p
    LEFT JOIN (
      SELECT 
        school_id,
        SUM(input_tokens + output_tokens) as monthly_tokens
      FROM public.ai_usage_logs
      WHERE created_at >= date_trunc('month', CURRENT_DATE)
      GROUP BY school_id
    ) usage ON p.id = usage.school_id
    WHERE p.is_active = TRUE
  )
  SELECT jsonb_build_object(
    'total_tokens_used', COALESCE(ud.total_tokens, 0),
    'total_cost', COALESCE(ud.total_cost, 0),
    'average_cost_per_school', 
      CASE WHEN sc.total_schools > 0 
        THEN COALESCE(ud.total_cost, 0) / sc.total_schools 
        ELSE 0 
      END,
    'schools_over_limit', COALESCE(sc.over_limit, 0),
    'schools_suspended', COALESCE(sc.suspended, 0),
    'projected_monthly_cost', COALESCE(ud.total_cost * 30 / EXTRACT(day from CURRENT_DATE), 0),
    'top_consuming_schools', ARRAY[]::JSON[]
  ) INTO v_usage_stats
  FROM usage_data ud, school_counts sc;
  
  -- Set global configuration
  v_global_config := jsonb_build_object(
    'free_tier_limit', 1000,
    'basic_tier_limit', 5000,
    'pro_tier_limit', 25000,
    'enterprise_tier_limit', 100000,
    'overage_rate', 0.002,
    'warning_thresholds', ARRAY[75, 90, 95],
    'suspension_threshold', 120,
    'auto_reset_enabled', true,
    'cost_alerts_enabled', true
  );
  
  -- Build final response
  v_result := jsonb_build_object(
    'success', true,
    'data', jsonb_build_object(
      'school_quotas', COALESCE(v_school_quotas, '[]'::jsonb),
      'usage_stats', v_usage_stats,
      'global_config', v_global_config
    )
  );
  
  RETURN v_result;
END;
$$;

-- ============================================================================
-- FUNCTION 4: GET_SUBSCRIPTION_ANALYTICS
-- Purpose: Get subscription analytics for platform overview
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_subscription_analytics(
  p_start_date DATE,
  p_end_date DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_user_id UUID := auth.uid();
  v_analytics JSONB;
  v_total_revenue DECIMAL := 0;
  v_monthly_revenue DECIMAL := 0;
  v_active_subs INTEGER := 0;
  v_churned_subs INTEGER := 0;
  v_new_subs INTEGER := 0;
  v_churn_rate DECIMAL := 0;
BEGIN
  -- Check if current user is superadmin
  IF NOT EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = v_current_user_id 
    AND role = 'superadmin'
  ) THEN
    RETURN json_build_object('error', 'Unauthorized: Superadmin access required');
  END IF;
  
  -- Get active subscriptions
  SELECT COUNT(*) INTO v_active_subs
  FROM public.subscriptions
  WHERE status = 'active';
  
  -- Get new subscriptions in date range
  SELECT COUNT(*) INTO v_new_subs
  FROM public.subscriptions
  WHERE created_at::date BETWEEN p_start_date AND p_end_date;
  
  -- Get churned subscriptions in date range
  SELECT COUNT(*) INTO v_churned_subs
  FROM public.subscriptions
  WHERE status = 'cancelled'
  AND updated_at::date BETWEEN p_start_date AND p_end_date;
  
  -- Calculate churn rate
  IF (v_active_subs + v_churned_subs) > 0 THEN
    v_churn_rate := (v_churned_subs::DECIMAL / (v_active_subs + v_churned_subs)) * 100;
  END IF;
  
  -- Calculate revenue
  SELECT 
    COALESCE(SUM(
      CASE 
        WHEN s.billing_frequency = 'annual' THEN sp.price_annual
        ELSE sp.price_monthly * 12
      END
    ), 0),
    COALESCE(SUM(
      CASE 
        WHEN s.billing_frequency = 'annual' THEN sp.price_annual / 12
        ELSE sp.price_monthly
      END
    ), 0)
  INTO v_total_revenue, v_monthly_revenue
  FROM public.subscriptions s
  JOIN public.subscription_plans sp ON s.plan_id = sp.id
  WHERE s.status = 'active';
  
  -- Build response
  v_analytics := jsonb_build_object(
    'total_revenue', v_total_revenue,
    'monthly_revenue', v_monthly_revenue,
    'active_subscriptions', v_active_subs,
    'new_subscriptions', v_new_subs,
    'churned_subscriptions', v_churned_subs,
    'churn_rate', v_churn_rate
  );
  
  RETURN jsonb_build_array(v_analytics);
END;
$$;

-- ============================================================================
-- GRANT NECESSARY PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.get_all_users_for_superadmin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_platform_stats_for_superadmin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_superadmin_ai_quotas() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_subscription_analytics(DATE, DATE) TO authenticated;

-- ============================================================================
-- LOG MIGRATION COMPLETION
-- ============================================================================

INSERT INTO public.config_kv (key, value, description, is_public)
VALUES (
  'superadmin_dashboard_functions_20250919231112',
  json_build_object(
    'version', '1.0.0',
    'completed_at', now()::TEXT,
    'functions_created', json_build_array(
      'get_all_users_for_superadmin',
      'get_platform_stats_for_superadmin',
      'get_superadmin_ai_quotas',
      'get_subscription_analytics'
    ),
    'migration_file', '20250919231112_superadmin_dashboard_functions.sql'
  ),
  'SuperAdmin dashboard functions completion log',
  FALSE
) ON CONFLICT (key) DO UPDATE SET
  value = excluded.value,
  updated_at = now();

SELECT 'SUPERADMIN DASHBOARD FUNCTIONS COMPLETED' AS status;

COMMIT;
