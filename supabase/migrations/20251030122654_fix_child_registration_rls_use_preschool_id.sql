-- Fix Child Registration RLS to use preschool_id instead of organization_id
-- Date: 2025-10-30 12:26:54
-- Issue: RLS policies were checking profiles.organization_id but should check profiles.preschool_id
-- Context: Principals have preschool_id set, not organization_id in most cases

BEGIN;

-- Drop existing admin policies
DROP POLICY IF EXISTS child_registration_requests_admin_view ON child_registration_requests;
DROP POLICY IF EXISTS child_registration_requests_admin_manage ON child_registration_requests;

-- Recreate admin view policy with preschool_id check
CREATE POLICY child_registration_requests_admin_view
ON child_registration_requests FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE
      profiles.id = auth.uid()
      AND profiles.preschool_id = child_registration_requests.preschool_id
      AND profiles.role IN ('admin', 'principal', 'teacher')
  )
);

-- Recreate admin manage policy with preschool_id check
CREATE POLICY child_registration_requests_admin_manage
ON child_registration_requests FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE
      profiles.id = auth.uid()
      AND profiles.preschool_id = child_registration_requests.preschool_id
      AND profiles.role IN ('admin', 'principal')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE
      profiles.id = auth.uid()
      AND profiles.preschool_id = child_registration_requests.preschool_id
      AND profiles.role IN ('admin', 'principal')
  )
);

-- Add comments
COMMENT ON POLICY child_registration_requests_admin_view ON child_registration_requests IS
'Allow school admins/principals to view registration requests for their school (using preschool_id)';

COMMENT ON POLICY child_registration_requests_admin_manage ON child_registration_requests IS
'Allow school admins/principals to approve/reject registration requests for their school (using preschool_id)';

COMMIT;
