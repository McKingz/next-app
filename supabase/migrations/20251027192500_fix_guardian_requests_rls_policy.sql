-- Fix guardian_requests RLS policies to check both organization_id AND preschool_id
-- Issue: Principal has organization_id != preschool_id, causing guardian requests to not appear
-- Solution: Check both fields in RLS policies

-- Drop existing policies
DROP POLICY IF EXISTS "guardian_requests_school_select" ON guardian_requests;
DROP POLICY IF EXISTS "guardian_requests_school_modify" ON guardian_requests;

-- Recreate SELECT policy checking EITHER organization_id OR preschool_id
CREATE POLICY "guardian_requests_school_select"
  ON guardian_requests
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE id = auth.uid()
        AND role IN ('teacher', 'principal', 'superadmin')
        AND (organization_id = guardian_requests.school_id OR preschool_id = guardian_requests.school_id)
    )
  );

-- Recreate ALL (UPDATE/DELETE) policy checking EITHER organization_id OR preschool_id
CREATE POLICY "guardian_requests_school_modify"
  ON guardian_requests
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE id = auth.uid()
        AND role IN ('teacher', 'principal', 'superadmin')
        AND (organization_id = guardian_requests.school_id OR preschool_id = guardian_requests.school_id)
    )
  );

-- Add comment explaining the fix
COMMENT ON POLICY "guardian_requests_school_select" ON guardian_requests IS
  'Allows teachers, principals, and superadmins to view guardian requests for their school. Checks EITHER organization_id OR preschool_id to handle data inconsistencies.';

COMMENT ON POLICY "guardian_requests_school_modify" ON guardian_requests IS
  'Allows teachers, principals, and superadmins to modify guardian requests for their school. Checks EITHER organization_id OR preschool_id to handle data inconsistencies.';
