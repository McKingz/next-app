-- =============================================
-- EduDash Pro: Debug Dashboard Functions
-- Version: 1.0.0
-- Date: 2025-09-19
-- Purpose: Debug and fix dashboard data issues
-- WARP.md Compliance: Migration-only, production-safe, forward-only
-- =============================================

BEGIN;

-- Drop existing functions with conflicting return types
DROP FUNCTION IF EXISTS public.get_all_users_for_superadmin();
DROP FUNCTION IF EXISTS public.get_platform_stats_for_superadmin();

-- ============================================================================
-- DEBUG FUNCTION: GET_DASHBOARD_DEBUG_INFO
-- Purpose: Get comprehensive debug information for dashboard
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_dashboard_debug_info()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_user_id UUID := auth.uid();
  v_debug_info JSONB;
  v_user_count INTEGER;
  v_school_count INTEGER;
  v_subscription_count INTEGER;
  v_auth_user_count INTEGER;
BEGIN
  -- Check basic counts
  SELECT COUNT(*) INTO v_user_count FROM public.users;
  SELECT COUNT(*) INTO v_school_count FROM public.preschools;
  SELECT COUNT(*) INTO v_subscription_count FROM public.subscriptions;
  SELECT COUNT(*) INTO v_auth_user_count FROM auth.users;
  
  -- Build debug response
  v_debug_info := json_build_object(
    'current_user_id', v_current_user_id,
    'user_count_public', v_user_count,
    'auth_user_count', v_auth_user_count,
    'school_count', v_school_count,
    'subscription_count', v_subscription_count,
    'tables_exist', json_build_object(
      'users', (SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users')),
      'preschools', (SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'preschools')),
      'subscriptions', (SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'subscriptions')),
      'auth_users', (SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users'))
    ),
    'functions_exist', json_build_object(
      'get_all_users_for_superadmin', (SELECT EXISTS (SELECT FROM information_schema.routines WHERE routine_name = 'get_all_users_for_superadmin')),
      'get_platform_stats_for_superadmin', (SELECT EXISTS (SELECT FROM information_schema.routines WHERE routine_name = 'get_platform_stats_for_superadmin')),
      'get_superadmin_ai_quotas', (SELECT EXISTS (SELECT FROM information_schema.routines WHERE routine_name = 'get_superadmin_ai_quotas'))
    )
  );
  
  RETURN v_debug_info;
END;
$$;

-- ============================================================================
-- IMPROVED USER FUNCTION
-- Purpose: Fixed version that returns array directly
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_all_users_for_superadmin()
RETURNS JSONB
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
    RETURN json_build_array(json_build_object('error', 'Unauthorized: Superadmin access required'));
  END IF;
  
  -- Get all users with their school information
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', u.id,
      'email', au.email,
      'name', COALESCE(u.first_name || ' ' || u.last_name, u.first_name, u.last_name, 'Unnamed User'),
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
  
  RETURN COALESCE(v_users, '[]'::jsonb);
END;
$$;

-- ============================================================================
-- IMPROVED PLATFORM STATS FUNCTION
-- Purpose: More robust version with fallbacks
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_platform_stats_for_superadmin()
RETURNS JSONB
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
  
  -- Get school count (active preschools) - handle table not existing
  BEGIN
    SELECT COUNT(*) INTO v_total_schools
    FROM public.preschools
    WHERE is_active = TRUE;
  EXCEPTION WHEN OTHERS THEN
    v_total_schools := 0;
  END;
  
  -- Get user counts by role - handle table not existing
  BEGIN
    SELECT COUNT(*) INTO v_total_users FROM public.users WHERE is_active = TRUE;
    SELECT COUNT(*) INTO v_total_teachers FROM public.users WHERE role = 'teacher' AND is_active = TRUE;
    SELECT COUNT(*) INTO v_total_parents FROM public.users WHERE role = 'parent' AND is_active = TRUE;
  EXCEPTION WHEN OTHERS THEN
    v_total_users := 0;
    v_total_teachers := 0;
    v_total_parents := 0;
  END;
  
  -- Get student count from enrollments - handle table not existing
  BEGIN
    SELECT COUNT(DISTINCT student_id) INTO v_total_students 
    FROM public.enrollments 
    WHERE status = 'active';
  EXCEPTION WHEN OTHERS THEN
    v_total_students := 0;
  END;
  
  -- Get subscription stats - handle table not existing
  BEGIN
    SELECT COUNT(*) INTO v_active_subscriptions
    FROM public.subscriptions
    WHERE status = 'active';
  EXCEPTION WHEN OTHERS THEN
    v_active_subscriptions := 0;
  END;
  
  -- Calculate revenue from subscription plans - handle tables not existing
  BEGIN
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
  EXCEPTION WHEN OTHERS THEN
    v_total_revenue := 0;
    v_monthly_revenue := 0;
  END;
  
  -- Get AI usage cost for current month - handle table not existing
  BEGIN
    SELECT COALESCE(SUM(total_cost), 0) INTO v_ai_usage_month
    FROM public.ai_usage_logs
    WHERE created_at >= date_trunc('month', CURRENT_DATE)
    AND created_at < date_trunc('month', CURRENT_DATE) + interval '1 month';
  EXCEPTION WHEN OTHERS THEN
    v_ai_usage_month := 0;
  END;
  
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
    'churn_rate', 0,
    'growth_rate', 0
  );
  
  RETURN v_stats;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_dashboard_debug_info TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_users_for_superadmin TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_platform_stats_for_superadmin TO authenticated;

SELECT 'DEBUG DASHBOARD FUNCTIONS COMPLETED' AS status;

COMMIT;
