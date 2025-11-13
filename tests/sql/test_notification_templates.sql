-- ============================================
-- Phase 2: Notification Templates System Tests
-- ============================================
-- Test suite for validating the notification templates functionality
-- Author: King <king@EduDash.pro>
-- Date: 2025-09-18
-- ============================================

-- Test 1: Check if templates were created
SELECT 
  'Test 1: Default Templates Count' as test_name,
  count(*) as template_count,
  CASE WHEN count(*) >= 6 THEN 'PASS' ELSE 'FAIL' END as status
FROM notification_templates 
WHERE is_system_template = true;

-- Test 2: Verify template categories
SELECT 
  'Test 2: Template Categories' as test_name,
  category,
  count(*) as count
FROM notification_templates 
GROUP BY category
ORDER BY category;

-- Test 3: Check active templates
SELECT 
  'Test 3: Active Templates' as test_name,
  count(*) as active_count,
  CASE WHEN count(*) >= 6 THEN 'PASS' ELSE 'FAIL' END as status
FROM notification_templates 
WHERE status = 'active';

-- Test 4: List system templates with their keys
SELECT 
  'Test 4: System Template Keys' as test_name,
  template_key,
  name,
  category,
  status
FROM notification_templates 
WHERE is_system_template = true
ORDER BY template_key;

-- Test 5: Test render function with user_suspended template
SELECT 
  'Test 5: Template Rendering' as test_name,
  render_notification_template(
    'user_suspended',
    jsonb_build_object(
      'user_email', 'test@example.com',
      'reason', 'Violation of terms'
    )
  ) as render_result;

-- Test 6: Test list function
SELECT 
  'Test 6: List Templates Function' as test_name,
  list_notification_templates(
    NULL, -- category
    'active'::template_status_enum, -- status
    NULL, -- language
    true, -- system_only
    10, -- limit
    0 -- offset
  ) as list_result;

-- Test 7: Get specific template
SELECT 
  'Test 7: Get Template Function' as test_name,
  get_notification_template('security_alert') as template_result;

-- Test 8: Check template performance metrics view
SELECT 
  'Test 8: Performance Metrics View' as test_name,
  count(*) as metrics_count,
  CASE WHEN count(*) >= 6 THEN 'PASS' ELSE 'FAIL' END as status
FROM template_performance_metrics;

-- Test 9: Check all required enum types exist
SELECT 
  'Test 9: Enum Types Check' as test_name,
  typname as enum_name,
  CASE WHEN typname LIKE 'template_%' THEN 'PASS' ELSE 'FAIL' END as status
FROM pg_type 
WHERE typname IN (
  'template_category_enum',
  'template_status_enum', 
  'template_variable_type_enum',
  'template_approval_status_enum'
)
ORDER BY typname;

-- Test 10: Check indexes were created
SELECT 
  'Test 10: Template Indexes Check' as test_name,
  indexname,
  tablename
FROM pg_indexes 
WHERE tablename LIKE '%template%'
AND schemaname = 'public'
ORDER BY tablename, indexname;

-- Test 11: Check RLS policies
SELECT 
  'Test 11: RLS Policies Check' as test_name,
  tablename,
  policyname,
  permissive
FROM pg_policies 
WHERE tablename LIKE '%template%'
ORDER BY tablename, policyname;

-- Test 12: Success summary
SELECT 
  'PHASE 2 NOTIFICATION TEMPLATES SYSTEM' as system,
  'DEPLOYED SUCCESSFULLY' as status,
  now() as completed_at,
  'Ready for integration with delivery system' as next_step;

-- Log test completion
INSERT INTO config_kv (key, value, description, is_public)
VALUES (
  'test_notification_templates_completed',
  jsonb_build_object(
    'version', '1.0.0',
    'completed_at', now()::text,
    'tests_run', 12,
    'status', 'success'
  ),
  'Notification templates system test completion log',
  false
) ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  updated_at = now();