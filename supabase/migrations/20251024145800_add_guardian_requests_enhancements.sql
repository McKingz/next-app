-- Add Guardian Requests Enhancements for Parent-Child Linking
-- Date: 2025-10-24 14:58:00
-- Purpose: Add relationship field and performance indexes for parent claim child feature

BEGIN;

-- ============================================================================
-- PART 1: Add relationship column
-- ============================================================================

-- Add relationship column to track parent/guardian type
ALTER TABLE guardian_requests 
ADD COLUMN IF NOT EXISTS relationship text 
CHECK (relationship IN ('mother', 'father', 'guardian', 'other'));

-- ============================================================================
-- PART 2: Add performance indexes
-- ============================================================================

-- Index for parent viewing their own requests
CREATE INDEX IF NOT EXISTS idx_guardian_requests_parent_status 
ON guardian_requests (parent_auth_id, status);

-- Index for school staff viewing requests
CREATE INDEX IF NOT EXISTS idx_guardian_requests_school_status 
ON guardian_requests (school_id, status, created_at DESC);

-- Index for linking to students
CREATE INDEX IF NOT EXISTS idx_guardian_requests_student 
ON guardian_requests (student_id);

-- Index for finding duplicates
CREATE INDEX IF NOT EXISTS idx_guardian_requests_duplicate_check
ON guardian_requests (parent_auth_id, student_id, status)
WHERE status IN ('pending', 'approved');

-- ============================================================================
-- PART 3: Add documentation comments
-- ============================================================================

COMMENT ON COLUMN guardian_requests.relationship IS 
'Parent/guardian relationship to the child: mother, father, guardian, other';

COMMENT ON TABLE guardian_requests IS 
'Requests from parents to link their account to an existing student in the system. Used when child already exists but parent registers later.';

COMMENT ON COLUMN guardian_requests.parent_auth_id IS 
'The auth.users.id of the parent making the claim request';

COMMENT ON COLUMN guardian_requests.student_id IS 
'The student (child) being claimed by the parent';

COMMENT ON COLUMN guardian_requests.school_id IS 
'The preschool/school where the child is enrolled';

COMMENT ON COLUMN guardian_requests.status IS 
'Request status: pending (awaiting approval), approved (link created), rejected (denied), cancelled (withdrawn by parent)';

-- ============================================================================
-- PART 4: Add partial unique index to prevent duplicate pending requests
-- ============================================================================

-- Use a partial unique index instead of constraint with WHERE clause
-- This prevents multiple pending requests for the same parent-child pair
CREATE UNIQUE INDEX IF NOT EXISTS idx_guardian_requests_no_duplicate_pending
ON guardian_requests (parent_auth_id, student_id)
WHERE status = 'pending';

COMMENT ON INDEX idx_guardian_requests_no_duplicate_pending IS
'Prevents parents from submitting multiple pending requests for the same child';

COMMIT;
