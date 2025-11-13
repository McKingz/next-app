-- Fix Child Registration RLS and Sync Organizations
-- Date: 2025-10-22 22:39:00
-- Purpose: 
--   1. Allow parents to insert child registration requests
--   2. Sync preschools data to organizations table

BEGIN;

-- ============================================================================
-- PART 1: Fix child_registration_requests RLS policies
-- ============================================================================

-- Enable RLS if not already enabled
ALTER TABLE child_registration_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS child_registration_requests_parent_insert ON child_registration_requests;
DROP POLICY IF EXISTS child_registration_requests_parent_view ON child_registration_requests;
DROP POLICY IF EXISTS child_registration_requests_parent_update ON child_registration_requests;
DROP POLICY IF EXISTS child_registration_requests_admin_view ON child_registration_requests;
DROP POLICY IF EXISTS child_registration_requests_admin_manage ON child_registration_requests;
DROP POLICY IF EXISTS child_registration_requests_service_role ON child_registration_requests;

-- Allow parents to insert their own registration requests
CREATE POLICY child_registration_requests_parent_insert
ON child_registration_requests FOR INSERT TO authenticated
WITH CHECK (
  parent_id = auth.uid()
);

-- Allow parents to view their own registration requests
CREATE POLICY child_registration_requests_parent_view
ON child_registration_requests FOR SELECT TO authenticated
USING (
  parent_id = auth.uid()
);

-- Allow parents to update their own pending requests (e.g., to withdraw)
CREATE POLICY child_registration_requests_parent_update
ON child_registration_requests FOR UPDATE TO authenticated
USING (
  parent_id = auth.uid() AND status = 'pending'
)
WITH CHECK (
  parent_id = auth.uid()
);

-- Allow preschool admins/principals to view requests for their preschool
CREATE POLICY child_registration_requests_admin_view
ON child_registration_requests FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE
      profiles.id = auth.uid()
      AND profiles.organization_id = child_registration_requests.preschool_id
      AND profiles.role IN ('admin', 'principal', 'teacher')
  )
);

-- Allow preschool admins/principals to manage requests for their preschool
CREATE POLICY child_registration_requests_admin_manage
ON child_registration_requests FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE
      profiles.id = auth.uid()
      AND profiles.organization_id = child_registration_requests.preschool_id
      AND profiles.role IN ('admin', 'principal')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE
      profiles.id = auth.uid()
      AND profiles.organization_id = child_registration_requests.preschool_id
      AND profiles.role IN ('admin', 'principal')
  )
);

-- Service role full access
CREATE POLICY child_registration_requests_service_role
ON child_registration_requests FOR ALL TO service_role
USING (TRUE);

-- ============================================================================
-- PART 2: Sync preschools data to organizations table
-- ============================================================================

-- Insert preschools into organizations table if not already there
INSERT INTO organizations (
  id,
  name,
  type,
  address,
  phone,
  email,
  city,
  postal_code,
  timezone,
  plan_tier,
  subscription_status,
  is_active,
  preschool_id,
  created_at,
  updated_at
)
SELECT
  p.id,
  p.name,
  'preschool'::text as type,
  COALESCE(p.physical_address, p.address) as address,
  COALESCE(p.contact_phone, p.phone) as phone,
  COALESCE(p.contact_email, p.email, p.billing_email) as email,
  -- Extract city from address if possible
  CASE
    WHEN p.physical_address IS NOT NULL AND position(',' in p.physical_address) > 0 THEN
      TRIM(split_part(p.physical_address, ',', 2))
    WHEN p.address IS NOT NULL AND position(',' in p.address) > 0 THEN
      TRIM(split_part(p.address, ',', 2))
    ELSE NULL
  END as city,
  NULL as postal_code,
  COALESCE(p.timezone, 'Africa/Johannesburg') as timezone,
  COALESCE(p.subscription_tier, 'free') as plan_tier,
  CASE
    WHEN p.subscription_status IN ('active', 'pending') THEN p.subscription_status
    ELSE 'pending'
  END as subscription_status,
  COALESCE(p.is_active, true) as is_active,
  p.id as preschool_id,
  COALESCE(p.created_at, now()) as created_at,
  COALESCE(p.updated_at, now()) as updated_at
FROM preschools p
WHERE NOT EXISTS (
  SELECT 1 FROM organizations o WHERE o.id = p.id
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  address = EXCLUDED.address,
  phone = EXCLUDED.phone,
  email = EXCLUDED.email,
  city = EXCLUDED.city,
  timezone = EXCLUDED.timezone,
  plan_tier = EXCLUDED.plan_tier,
  subscription_status = EXCLUDED.subscription_status,
  is_active = EXCLUDED.is_active,
  preschool_id = EXCLUDED.preschool_id,
  updated_at = now();

-- ============================================================================
-- PART 3: Add comments for documentation
-- ============================================================================

COMMENT ON POLICY child_registration_requests_parent_insert ON child_registration_requests IS
  'Allow parents to submit child registration requests';

COMMENT ON POLICY child_registration_requests_parent_view ON child_registration_requests IS
  'Allow parents to view their own registration requests';

COMMENT ON POLICY child_registration_requests_admin_view ON child_registration_requests IS
  'Allow school admins/principals to view registration requests for their school';

COMMENT ON POLICY child_registration_requests_admin_manage ON child_registration_requests IS
  'Allow school admins/principals to approve/reject registration requests for their school';

COMMIT;
