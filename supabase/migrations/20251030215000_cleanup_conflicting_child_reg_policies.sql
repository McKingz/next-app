-- Cleanup Conflicting RLS Policies for child_registration_requests
-- Date: 2025-10-30 21:50:00
-- Issue: Multiple overlapping policies using deprecated users table and organization_id
-- Solution: Keep only the correct preschool_id-based policies

BEGIN;

-- Drop old policies that use deprecated users table or organization_id
DROP POLICY IF EXISTS child_registration_requests_staff_select ON child_registration_requests;
DROP POLICY IF EXISTS child_registration_requests_staff_update ON child_registration_requests;
DROP POLICY IF EXISTS child_registration_requests_tenant_select ON child_registration_requests;
DROP POLICY IF EXISTS child_registration_requests_tenant_modify ON child_registration_requests;

-- Drop duplicate parent view policy
DROP POLICY IF EXISTS child_registration_requests_parent_view ON child_registration_requests;

-- Verify we still have the correct policies:
-- - child_registration_requests_admin_view (SELECT, uses preschool_id)
-- - child_registration_requests_admin_manage (UPDATE, uses preschool_id)
-- - child_registration_requests_parent_select (SELECT, parent_id = auth.uid())
-- - child_registration_requests_parent_insert (INSERT, parent_id check)
-- - child_registration_requests_parent_update (UPDATE, parent_id check)

-- Add comment
COMMENT ON TABLE child_registration_requests IS
'Child registration requests from parents. Uses preschool_id for tenant isolation (NOT organization_id or deprecated users table).';

COMMIT;
