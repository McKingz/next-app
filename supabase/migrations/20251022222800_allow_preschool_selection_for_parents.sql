-- Allow Preschool Selection for Parent Child Registration
-- Date: 2025-10-22 22:28:00
-- Purpose: Allow authenticated users (parents) to view active preschools for child registration

-- Drop the restrictive preschools_own_access policy
DROP POLICY IF EXISTS preschools_own_access ON preschools;

-- Create a new policy that allows authenticated users to view active preschools
-- This is needed for the child registration form where parents select a preschool
CREATE POLICY preschools_view_active
ON preschools FOR SELECT TO authenticated
USING (is_active = true);

-- Keep the existing policy for users to view their own preschool
CREATE POLICY preschools_own_organization
ON preschools FOR SELECT TO authenticated
USING (
  id IN (
    SELECT organization_id FROM profiles
    WHERE id = auth.uid()
  )
);

-- Add similar policy for organizations table
DROP POLICY IF EXISTS users_can_view_their_organization ON organizations;

-- Allow authenticated users to view active organizations for registration
CREATE POLICY organizations_view_active
ON organizations FOR SELECT TO authenticated
USING (is_active = true);

-- Allow users to view their own organization
CREATE POLICY organizations_own_access
ON organizations FOR SELECT TO authenticated
USING (
  id IN (
    SELECT organization_id FROM users
    WHERE auth_user_id = auth.uid()
  )
);

COMMENT ON POLICY preschools_view_active ON preschools IS 
  'Allow authenticated users to view active preschools for child registration selection';

COMMENT ON POLICY organizations_view_active ON organizations IS 
  'Allow authenticated users to view active organizations for child registration selection';
