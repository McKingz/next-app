-- Add Performance Indexes for Duplicate Request Prevention
-- Date: 2025-10-30 21:35:51
-- Purpose: Optimize queries for proactive duplicate checking in parent registration flows
-- Context: Parents can register new children or claim existing children; we check for duplicates before insert

BEGIN;

-- ============================================================================
-- PART 1: Child Registration Requests - Case-insensitive name search index
-- ============================================================================

-- Create index for fast case-insensitive duplicate checking by parent, school, status, and child names
-- This supports the query pattern: WHERE parent_id = X AND preschool_id = Y AND status = 'pending' 
-- AND LOWER(child_first_name) = LOWER('name') AND LOWER(child_last_name) = LOWER('name')
CREATE INDEX IF NOT EXISTS idx_child_registration_duplicate_check_ilike
ON child_registration_requests (
  parent_id, 
  preschool_id, 
  status, 
  LOWER(child_first_name), 
  LOWER(child_last_name)
);

COMMENT ON INDEX idx_child_registration_duplicate_check_ilike IS
'Optimizes case-insensitive duplicate checking for child registration requests. Used in parent registration flow to prevent duplicate pending requests.';

-- ============================================================================
-- PART 2: Guardian Requests - Already has idx_guardian_requests_duplicate_check
-- ============================================================================

-- Verify existing index covers our use case (added in 20251024145800_add_guardian_requests_enhancements.sql)
-- Index: idx_guardian_requests_duplicate_check ON (parent_auth_id, student_id, status) WHERE status IN ('pending', 'approved')
-- This already supports: WHERE parent_auth_id = X AND student_id = Y AND status = 'pending'

-- Add comment for clarity
COMMENT ON INDEX idx_guardian_requests_duplicate_check IS
'Optimizes duplicate checking for guardian/claim requests. Used in parent claim-child flow to prevent duplicate pending requests.';

-- ============================================================================
-- PART 3: RLS Policy Updates - Ensure parents can SELECT their own requests
-- ============================================================================

-- Child registration requests: verify parent SELECT policy exists and uses profiles correctly
-- Already exists from 20251030110200_change_child_registration_parent_id_to_profiles.sql
-- Policy: child_registration_requests_parent_insert allows INSERT where parent_id = auth.uid()

-- Need to ensure parent SELECT policy exists
DROP POLICY IF EXISTS child_registration_requests_parent_select ON child_registration_requests;

CREATE POLICY child_registration_requests_parent_select
ON child_registration_requests FOR SELECT TO authenticated
USING (
  parent_id = auth.uid()
);

COMMENT ON POLICY child_registration_requests_parent_select ON child_registration_requests IS
'Allow parents to SELECT their own registration requests (needed for duplicate checking)';

-- Guardian requests: SELECT policy already exists from 20251026180500_guardian_requests_parent_policies.sql
-- Policy: guardian_requests_parent_select_own allows SELECT where parent_auth_id = auth.uid()
-- No changes needed

COMMIT;