-- Final cleanup to exactly 3 users
-- Remove admin@youngeagles.org.za and king@youngeagles.org.za

-- Direct cleanup
DELETE FROM profiles
WHERE email = 'admin@youngeagles.org.za';
DELETE FROM profiles
WHERE email = 'king@youngeagles.org.za';

-- Clean up orphaned auth users
DELETE FROM auth.users
WHERE id NOT IN (
  SELECT auth_user_id FROM profiles
  WHERE auth_user_id IS NOT NULL
);

-- Update subscription seat count
UPDATE subscriptions
SET seats_used = 2, updated_at = NOW()
WHERE school_id = (
  SELECT id FROM preschools
  WHERE name ILIKE '%young eagles%' LIMIT 1
);

-- Verification
SELECT
  'Users:' AS type,
  COUNT(*) AS count
FROM profiles
UNION ALL
SELECT
  'Auth Users:',
  COUNT(*)
FROM auth.users
UNION ALL
SELECT
  'Schools:',
  COUNT(*)
FROM preschools
UNION ALL
SELECT
  'Subscriptions:',
  COUNT(*)
FROM subscriptions;
