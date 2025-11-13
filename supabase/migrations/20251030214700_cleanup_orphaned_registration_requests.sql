-- Cleanup Orphaned Child Registration Requests
-- Date: 2025-10-30 21:47:00
-- Purpose: Mark registration requests as 'approved' if a student already exists
-- Issue: Sometimes requests remain 'pending' even though the student was created

BEGIN;

-- Update orphaned pending requests where student already exists
UPDATE child_registration_requests
SET 
  status = 'approved',
  updated_at = NOW()
WHERE id IN (
  SELECT crr.id
  FROM child_registration_requests crr
  INNER JOIN students s ON 
    s.parent_id = crr.parent_id 
    AND s.preschool_id = crr.preschool_id
    AND LOWER(TRIM(s.first_name)) = LOWER(TRIM(crr.child_first_name))
    AND LOWER(TRIM(s.last_name)) = LOWER(TRIM(crr.child_last_name))
    AND s.is_active = true
  WHERE crr.status = 'pending'
);

-- Log the cleanup
DO $$
DECLARE
  updated_count INT;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Cleaned up % orphaned pending registration requests', updated_count;
END $$;

COMMIT;
