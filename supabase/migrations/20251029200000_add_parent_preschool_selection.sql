-- Add organization selection and parent join request functionality
-- Date: 2025-10-29
-- Purpose: Allow parents to browse and request to join organizations (preschools, schools, aftercare, etc.)

-- Step 1: Add columns to organizations table for public visibility
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS accepting_registrations BOOLEAN DEFAULT TRUE;

-- Also update preschools table for backward compatibility
ALTER TABLE preschools
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS accepting_registrations BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS website_url TEXT;

-- Add comment for documentation  
COMMENT ON COLUMN organizations.is_public IS 'Whether this organization appears in public search results for parent registration';
COMMENT ON COLUMN organizations.accepting_registrations IS 'Whether this organization is currently accepting new parent registrations';
COMMENT ON COLUMN preschools.is_public IS 'Whether this preschool appears in public search results for parent registration';
COMMENT ON COLUMN preschools.accepting_registrations IS 'Whether this preschool is currently accepting new parent registrations';
COMMENT ON COLUMN preschools.description IS 'Public description shown to parents during registration';

-- Step 2: Create parent_join_requests table
CREATE TABLE IF NOT EXISTS parent_join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  preschool_id UUID REFERENCES preschools(id) ON DELETE CASCADE, -- Legacy support
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  message TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure parent can only have one active request per organization
  UNIQUE(parent_id, organization_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_parent_join_requests_parent_id ON parent_join_requests(parent_id);
CREATE INDEX IF NOT EXISTS idx_parent_join_requests_organization_id ON parent_join_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_parent_join_requests_preschool_id ON parent_join_requests(preschool_id);
CREATE INDEX IF NOT EXISTS idx_parent_join_requests_status ON parent_join_requests(status);

-- Add comments
COMMENT ON TABLE parent_join_requests IS 'Tracks parent requests to join organizations (preschools, schools, aftercare, etc.)';
COMMENT ON COLUMN parent_join_requests.organization_id IS 'The organization the parent wants to join';
COMMENT ON COLUMN parent_join_requests.status IS 'Request status: pending, approved, or rejected';
COMMENT ON COLUMN parent_join_requests.reviewed_by IS 'Principal or admin who approved/rejected the request';

-- Step 3: Enable RLS on parent_join_requests
ALTER TABLE parent_join_requests ENABLE ROW LEVEL SECURITY;

-- Parents can view their own requests
CREATE POLICY "Parents can view own join requests"
ON parent_join_requests
FOR SELECT
TO authenticated
USING (auth.uid() = parent_id);

-- Parents can create their own join requests
CREATE POLICY "Parents can create join requests"
ON parent_join_requests
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = parent_id);

-- Parents can update their own pending requests (e.g., add message)
CREATE POLICY "Parents can update own pending requests"
ON parent_join_requests
FOR UPDATE
TO authenticated
USING (auth.uid() = parent_id AND status = 'pending')
WITH CHECK (auth.uid() = parent_id AND status = 'pending');

-- Principals/admins can view requests for their organization
CREATE POLICY "Principals can view requests for their organization"
ON parent_join_requests
FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id 
    FROM profiles 
    WHERE id = auth.uid() 
      AND role IN ('principal', 'admin')
  )
);

-- Principals/admins can update (approve/reject) requests for their organization
CREATE POLICY "Principals can update requests for their organization"
ON parent_join_requests
FOR UPDATE
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id 
    FROM profiles 
    WHERE id = auth.uid() 
      AND role IN ('principal', 'admin')
  )
)
WITH CHECK (
  organization_id IN (
    SELECT organization_id 
    FROM profiles 
    WHERE id = auth.uid() 
      AND role IN ('principal', 'admin')
  )
);

-- Service role has full access
CREATE POLICY "Service role has full access to join requests"
ON parent_join_requests
FOR ALL
TO service_role
USING (TRUE)
WITH CHECK (TRUE);

-- Step 4: Create function to auto-link parent when request is approved
CREATE OR REPLACE FUNCTION handle_parent_join_request_approval()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- If request was just approved, link parent to organization
  IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
    -- Update parent's profile with organization_id
    UPDATE profiles
    SET 
      organization_id = NEW.organization_id,
      preschool_id = COALESCE(NEW.preschool_id, NEW.organization_id), -- Legacy support
      updated_at = NOW()
    WHERE id = NEW.parent_id;
    
    -- Set reviewed timestamp if not set
    NEW.reviewed_at := COALESCE(NEW.reviewed_at, NOW());
    NEW.reviewed_by := COALESCE(NEW.reviewed_by, auth.uid());
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for auto-linking
DROP TRIGGER IF EXISTS on_parent_join_request_approved ON parent_join_requests;
CREATE TRIGGER on_parent_join_request_approved
BEFORE UPDATE ON parent_join_requests
FOR EACH ROW
WHEN (NEW.status = 'approved' AND OLD.status = 'pending')
EXECUTE FUNCTION handle_parent_join_request_approval();

-- Step 5: Grant permissions
GRANT SELECT ON parent_join_requests TO authenticated;
GRANT INSERT ON parent_join_requests TO authenticated;
GRANT UPDATE ON parent_join_requests TO authenticated;
GRANT SELECT ON organizations TO authenticated;
GRANT SELECT ON organizations TO anon; -- Allow anonymous users to browse public organizations
GRANT SELECT ON preschools TO authenticated;
GRANT SELECT ON preschools TO anon; -- Allow anonymous users to browse public preschools (legacy)

-- Step 6: Create helper function to get public organizations
CREATE OR REPLACE FUNCTION get_public_organizations()
RETURNS TABLE (
  id UUID,
  name TEXT,
  type TEXT,
  description TEXT,
  address TEXT,
  logo_url TEXT,
  website TEXT,
  phone TEXT,
  email TEXT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id,
    o.name,
    o.type::TEXT,
    o.description,
    COALESCE(o.address_line1 || ', ' || o.city, o.address_line1, '') as address,
    o.logo_url,
    o.website,
    o.phone,
    o.email
  FROM organizations o
  WHERE o.is_public = TRUE
    AND o.accepting_registrations = TRUE
    AND o.is_active = TRUE
  ORDER BY o.name;
END;
$$;

-- Legacy function for backward compatibility
CREATE OR REPLACE FUNCTION get_public_preschools()
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  address TEXT,
  logo_url TEXT,
  website_url TEXT,
  phone TEXT,
  email TEXT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.description,
    p.address,
    p.logo_url,
    p.website_url,
    p.phone,
    p.email
  FROM preschools p
  WHERE p.is_public = TRUE
    AND p.accepting_registrations = TRUE
    AND p.is_active = TRUE
  ORDER BY p.name;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_public_organizations() TO authenticated;
GRANT EXECUTE ON FUNCTION get_public_organizations() TO anon;
GRANT EXECUTE ON FUNCTION get_public_preschools() TO authenticated;
GRANT EXECUTE ON FUNCTION get_public_preschools() TO anon;

-- Step 7: Update existing organizations to be public by default (can be changed by admins)
UPDATE organizations 
SET 
  is_public = TRUE,
  accepting_registrations = TRUE
WHERE is_public IS NULL;

UPDATE preschools 
SET 
  is_public = TRUE,
  accepting_registrations = TRUE,
  description = COALESCE(description, 'Welcome to ' || name)
WHERE is_public IS NULL;

-- Log success
SELECT 'Parent organization selection migration completed successfully' AS status;
