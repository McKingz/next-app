-- Add Unique Constraint for Child Registration Requests
-- Date: 2025-10-22 23:00:00
-- Purpose: Prevent duplicate pending registration requests for the same child at the same preschool

-- Drop existing constraint if it exists
ALTER TABLE child_registration_requests
DROP CONSTRAINT IF EXISTS child_registration_unique_pending;

-- Add unique constraint: one pending request per parent-preschool-child combination
-- This prevents parents from submitting multiple requests for the same child at the same school
CREATE UNIQUE INDEX child_registration_unique_pending
ON child_registration_requests (parent_id, preschool_id, child_first_name, child_last_name, child_birth_date)
WHERE status = 'pending';

COMMENT ON INDEX child_registration_unique_pending IS 
  'Prevent duplicate pending registration requests for the same child at the same preschool. 
   Allows resubmission after previous request is approved/rejected/withdrawn.';
