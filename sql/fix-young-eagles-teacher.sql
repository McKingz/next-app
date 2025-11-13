-- Fix Young Eagles Organization and Teacher AI Access
-- Date: 2025-10-22
-- Issue: Teacher cannot access AI because org is on "free" plan and missing membership

-- 1. Upgrade Young Eagles to Pro plan
UPDATE organizations 
SET 
  subscription_plan = 'pro',
  updated_at = NOW()
WHERE id = 'bd5fe69c-8bee-445d-811d-a6db37f0e49b'
  AND name = 'Young Eagles';

-- 2. Ensure teacher has active organization membership
INSERT INTO organization_members (
  id,
  organization_id,
  user_id,
  role,
  seat_status,
  invited_by,
  created_at,
  updated_at
) 
SELECT 
  gen_random_uuid(),
  'bd5fe69c-8bee-445d-811d-a6db37f0e49b',
  'd699bb7d-7b9e-4a2f-9bf3-72e2d1fe7e64',
  'teacher',
  'active',
  (SELECT id FROM profiles WHERE organization_id = 'bd5fe69c-8bee-445d-811d-a6db37f0e49b' AND role = 'principal' LIMIT 1),
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM organization_members 
  WHERE organization_id = 'bd5fe69c-8bee-445d-811d-a6db37f0e49b' 
    AND user_id = 'd699bb7d-7b9e-4a2f-9bf3-72e2d1fe7e64'
)
ON CONFLICT (organization_id, user_id) 
DO UPDATE SET 
  seat_status = 'active',
  updated_at = NOW();

-- 3. Verify the changes
SELECT 
  o.id as org_id,
  o.name as org_name,
  o.subscription_plan,
  p.id as teacher_id,
  p.email as teacher_email,
  p.role,
  om.seat_status,
  om.created_at as membership_created
FROM organizations o
LEFT JOIN profiles p ON p.organization_id = o.id AND p.id = 'd699bb7d-7b9e-4a2f-9bf3-72e2d1fe7e64'
LEFT JOIN organization_members om ON om.organization_id = o.id AND om.user_id = p.id
WHERE o.id = 'bd5fe69c-8bee-445d-811d-a6db37f0e49b';
