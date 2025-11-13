-- Diagnostic queries for duplicate pending child registration issue
-- Run this via: PGPASSWORD="$SUPABASE_DB_PASSWORD" psql -h aws-0-ap-southeast-1.pooler.supabase.com -p 6543 -U postgres.lvvvjywrmpcqrpvuptdi -d postgres

-- 1. Check parent's profile and preschool_id
SELECT 
  id,
  email,
  first_name,
  last_name,
  role,
  preschool_id,
  organization_id
FROM profiles
WHERE role = 'parent'
ORDER BY created_at DESC
LIMIT 5;

-- 2. Check all child_registration_requests for parent
SELECT 
  crr.id,
  crr.parent_id,
  crr.preschool_id,
  crr.child_first_name,
  crr.child_last_name,
  crr.status,
  crr.created_at,
  p.email as parent_email,
  ps.name as school_name
FROM child_registration_requests crr
LEFT JOIN profiles p ON crr.parent_id = p.id
LEFT JOIN preschools ps ON crr.preschool_id = ps.id
WHERE crr.status = 'pending'
ORDER BY crr.created_at DESC
LIMIT 10;

-- 3. Check if students already exist for these requests
SELECT 
  s.id,
  s.first_name,
  s.last_name,
  s.parent_id,
  s.preschool_id,
  s.is_active,
  s.status,
  p.email as parent_email
FROM students s
LEFT JOIN profiles p ON s.parent_id = p.id
WHERE p.role = 'parent'
  AND s.is_active = true
ORDER BY s.created_at DESC
LIMIT 10;

-- 4. Check principal's profile
SELECT 
  id,
  email,
  first_name,
  last_name,
  role,
  preschool_id,
  organization_id
FROM profiles
WHERE role = 'principal'
ORDER BY created_at DESC
LIMIT 5;

-- 5. Find orphaned pending requests (where student already exists)
SELECT 
  crr.id as request_id,
  crr.parent_id,
  crr.child_first_name,
  crr.child_last_name,
  crr.status as request_status,
  s.id as student_id,
  s.is_active as student_active,
  'SHOULD_BE_HIDDEN' as action
FROM child_registration_requests crr
INNER JOIN students s ON 
  s.parent_id = crr.parent_id 
  AND s.preschool_id = crr.preschool_id
  AND LOWER(s.first_name) = LOWER(crr.child_first_name)
  AND LOWER(s.last_name) = LOWER(crr.child_last_name)
  AND s.is_active = true
WHERE crr.status = 'pending';

-- 6. Suggest cleanup: Mark these orphaned requests as approved
-- UNCOMMENT TO RUN:
-- UPDATE child_registration_requests
-- SET status = 'approved'
-- WHERE id IN (
--   SELECT crr.id
--   FROM child_registration_requests crr
--   INNER JOIN students s ON 
--     s.parent_id = crr.parent_id 
--     AND s.preschool_id = crr.preschool_id
--     AND LOWER(s.first_name) = LOWER(crr.child_first_name)
--     AND LOWER(s.last_name) = LOWER(crr.child_last_name)
--     AND s.is_active = true
--   WHERE crr.status = 'pending'
-- );
