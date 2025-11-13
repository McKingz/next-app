-- Diagnostic script to check user capabilities, seat status, and organization membership
-- Run this in Supabase SQL Editor to diagnose why a user has 0 capabilities
--
-- Replace 'USER_EMAIL_HERE' with the actual user's email address

-- 1. Check user's profile and role
SELECT 
  id,
  email,
  role,
  first_name,
  last_name,
  created_at,
  last_login_at
FROM profiles
WHERE email = 'USER_EMAIL_HERE';

-- 2. Check organization membership (if teacher/principal)
SELECT 
  om.user_id,
  om.organization_id,
  om.seat_status,
  om.invited_by,
  om.created_at as joined_at,
  o.name as org_name,
  o.plan_tier,
  p.email
FROM organization_members om
JOIN organizations o ON o.id = om.organization_id
JOIN profiles p ON p.id = om.user_id
WHERE p.email = 'USER_EMAIL_HERE';

-- 3. Check subscription_seats table (if teacher)
SELECT 
  ss.id,
  ss.user_id,
  ss.preschool_id,
  ss.status as seat_status,
  ss.assigned_at,
  ss.revoked_at,
  ps.name as preschool_name,
  ps.subscription_tier,
  p.email
FROM subscription_seats ss
JOIN profiles p ON p.id = ss.user_id
JOIN preschools ps ON ps.id = ss.preschool_id
WHERE p.email = 'USER_EMAIL_HERE';

-- 4. Check preschools table (legacy, if using preschool_id)
SELECT 
  p.id,
  p.email,
  p.role,
  p.preschool_id,
  ps.name as preschool_name,
  ps.subscription_tier
FROM profiles p
LEFT JOIN preschools ps ON ps.id = p.preschool_id::uuid
WHERE p.email = 'USER_EMAIL_HERE';

-- 5. Summary: Expected capabilities based on role
-- 
-- For TEACHER with active seat:
--   - access_mobile_app
--   - manage_classes
--   - create_assignments
--   - grade_assignments
--   - view_class_analytics
--   - communicate_with_parents
--   + AI capabilities based on plan tier (premium/pro/enterprise)
--
-- For TEACHER without active seat:
--   - access_mobile_app only
--   - All other capabilities REMOVED
--
-- For PRINCIPAL_ADMIN:
--   - All teacher capabilities +
--   - manage_organization
--   - manage_billing
--   - access_admin_tools
--
-- For PARENT:
--   - access_mobile_app
--   - view_child_progress
--   - communicate_with_teachers
--
-- Expected behavior:
-- - If seat_status != 'active' and role = 'teacher', capabilities will be minimal
-- - Environment variables (EXPO_PUBLIC_AI_ENABLED=true) don't add capabilities
-- - Capabilities come from database role + seat status + plan tier ONLY
