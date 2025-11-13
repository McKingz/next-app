-- Test Dashboard API Compatibility
-- Verify all required tables and columns exist for dashboard functionality

-- Test 1: Check all required tables exist
SELECT 'REQUIRED_TABLES_TEST' as test_name,
  COUNT(*) as table_count,
  CASE 
    WHEN COUNT(*) = 8 THEN 'PASS - All required tables exist'
    ELSE 'FAIL - Missing tables: ' || (8 - COUNT(*)::text)
  END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'whatsapp_contacts', 'preschools', 'students', 'teachers', 
  'attendance_records', 'applications', 'classes', 'users'
);

-- Test 2: Check preschools table has required columns
SELECT 'PRESCHOOLS_COLUMNS_TEST' as test_name,
  COUNT(*) as column_count,
  CASE 
    WHEN COUNT(*) >= 4 THEN 'PASS - Required preschools columns exist'
    ELSE 'FAIL - Missing preschools columns'
  END as status
FROM information_schema.columns 
WHERE table_name = 'preschools' AND table_schema = 'public'
AND column_name IN ('phone', 'settings', 'max_students', 'capacity');

-- Test 3: Check if sample preschool exists and has correct data
SELECT 'SAMPLE_PRESCHOOL_TEST' as test_name,
  id,
  name,
  phone,
  max_students,
  capacity,
  CASE 
    WHEN phone IS NOT NULL AND max_students IS NOT NULL AND capacity IS NOT NULL
    THEN 'PASS - Sample preschool has required data'
    ELSE 'INCOMPLETE - Missing some preschool data'
  END as status
FROM public.preschools 
WHERE id = 'ba79097c-1b93-4b48-bcbe-df73878ab4d1'::uuid;

-- Test 4: Check WhatsApp contacts table structure
SELECT 'WHATSAPP_CONTACTS_TEST' as test_name,
  COUNT(*) as column_count,
  CASE 
    WHEN COUNT(*) >= 8 THEN 'PASS - WhatsApp contacts table complete'
    ELSE 'FAIL - Missing WhatsApp contacts columns'
  END as status
FROM information_schema.columns 
WHERE table_name = 'whatsapp_contacts' AND table_schema = 'public'
AND column_name IN ('id', 'preschool_id', 'contact_name', 'phone_number', 'is_active', 'user_id', 'created_at', 'updated_at');

-- Test 5: Check RLS policies exist for all tables
SELECT 'RLS_POLICIES_TEST' as test_name,
  COUNT(*) as policy_count,
  CASE 
    WHEN COUNT(*) >= 6 THEN 'PASS - RLS policies exist for dashboard tables'
    ELSE 'FAIL - Missing RLS policies'
  END as status
FROM pg_policies 
WHERE schemaname = 'public'
AND tablename IN ('whatsapp_contacts', 'preschools', 'students', 'teachers', 'attendance_records', 'applications');

-- Test 6: Check dashboard function exists
SELECT 'DASHBOARD_FUNCTION_TEST' as test_name,
  COUNT(*) as function_count,
  CASE 
    WHEN COUNT(*) >= 1 THEN 'PASS - Dashboard function exists'
    ELSE 'FAIL - Dashboard function missing'
  END as status
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'get_principal_dashboard_data';

-- Test 7: Verify table counts (should return 0 for new tables but structure should exist)
SELECT 'TABLE_STRUCTURE_TEST' as test_name,
  'whatsapp_contacts: ' || (SELECT COUNT(*) FROM public.whatsapp_contacts)::text ||
  ', students: ' || (SELECT COUNT(*) FROM public.students)::text ||
  ', teachers: ' || (SELECT COUNT(*) FROM public.teachers)::text ||
  ', attendance: ' || (SELECT COUNT(*) FROM public.attendance_records)::text ||
  ', applications: ' || (SELECT COUNT(*) FROM public.applications)::text as counts,
  'INFO - Table counts (0 is expected for new installation)' as status;