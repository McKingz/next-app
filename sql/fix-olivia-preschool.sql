-- Fix olivia's preschool linkage
-- Run this with: psql -h aws-0-ap-southeast-1.pooler.supabase.com -p 6543 -U postgres.lvvvjywrmpcqrpvuptdi -d postgres -f fix-olivia-preschool.sql

-- First, verify current state
SELECT 
  'BEFORE UPDATE:' as status,
  u.email,
  u.name,
  u.preschool_id as current_preschool_id,
  u.auth_user_id
FROM users u
WHERE u.email = 'oliviamakunyane@gmail.com';

-- Update the preschool_id
UPDATE users
SET 
  preschool_id = 'ba79097c-1b93-4b48-bcbe-df73878ab4d1',
  updated_at = NOW()
WHERE email = 'oliviamakunyane@gmail.com'
RETURNING email, name, preschool_id, role;

-- Verify the update worked with join
SELECT 
  'AFTER UPDATE:' as status,
  u.email,
  u.name,
  u.preschool_id,
  p.name as preschool_name
FROM users u
JOIN preschools p ON p.id = u.preschool_id
WHERE u.email = 'oliviamakunyane@gmail.com';
