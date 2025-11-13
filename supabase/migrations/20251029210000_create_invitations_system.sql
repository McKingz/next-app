-- Create invitations system for parent/teacher registration
-- Date: 2025-10-29
-- Purpose: Allow organizations to invite parents/teachers via unique codes/links

-- Create invitations table
CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('parent', 'teacher')),
  email TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  created_by UUID REFERENCES auth.users(id),
  accepted_by UUID REFERENCES auth.users(id),
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  max_uses INTEGER DEFAULT 1,
  uses_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_invitations_code ON invitations(code);
CREATE INDEX IF NOT EXISTS idx_invitations_organization_id ON invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON invitations(status);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email);

-- Add comments
COMMENT ON TABLE invitations IS 'Invitation codes for parents and teachers to join organizations';
COMMENT ON COLUMN invitations.code IS 'Unique invitation code (e.g., ABC123XYZ)';
COMMENT ON COLUMN invitations.role IS 'Role this invitation is for: parent or teacher';
COMMENT ON COLUMN invitations.email IS 'Optional: specific email this invitation is for';
COMMENT ON COLUMN invitations.max_uses IS 'Maximum number of times this code can be used (1 for personal, unlimited for general)';
COMMENT ON COLUMN invitations.uses_count IS 'Number of times this code has been used';

-- Enable RLS
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Principals/admins can view invitations for their organization
CREATE POLICY "Principals can view organization invitations"
ON invitations
FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id 
    FROM profiles 
    WHERE id = auth.uid() 
      AND role IN ('principal', 'admin', 'teacher')
  )
);

-- Principals/admins can create invitations
CREATE POLICY "Principals can create invitations"
ON invitations
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (
    SELECT organization_id 
    FROM profiles 
    WHERE id = auth.uid() 
      AND role IN ('principal', 'admin')
  )
);

-- Principals/admins can update their organization's invitations
CREATE POLICY "Principals can update organization invitations"
ON invitations
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
CREATE POLICY "Service role has full access to invitations"
ON invitations
FOR ALL
TO service_role
USING (TRUE)
WITH CHECK (TRUE);

-- Function to generate random invitation code
CREATE OR REPLACE FUNCTION generate_invitation_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..9 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- Function to validate invitation code
CREATE OR REPLACE FUNCTION validate_invitation_code(
  invite_code TEXT,
  invite_role TEXT DEFAULT NULL
)
RETURNS TABLE (
  valid BOOLEAN,
  organization_id UUID,
  organization_name TEXT,
  role TEXT,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invitation RECORD;
BEGIN
  -- Find invitation
  SELECT * INTO invitation
  FROM invitations i
  WHERE i.code = invite_code
    AND i.status = 'pending'
    AND (i.expires_at IS NULL OR i.expires_at > NOW())
    AND (i.max_uses = -1 OR i.uses_count < i.max_uses)
    AND (invite_role IS NULL OR i.role = invite_role);

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, NULL::TEXT, 'Invalid or expired invitation code'::TEXT;
    RETURN;
  END IF;

  -- Get organization name
  RETURN QUERY
  SELECT 
    TRUE,
    invitation.organization_id,
    o.name,
    invitation.role,
    NULL::TEXT
  FROM organizations o
  WHERE o.id = invitation.organization_id;
END;
$$;

-- Function to accept invitation (mark as used)
CREATE OR REPLACE FUNCTION accept_invitation_code(
  invite_code TEXT,
  user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invitation RECORD;
BEGIN
  -- Get invitation
  SELECT * INTO invitation
  FROM invitations i
  WHERE i.code = invite_code
    AND i.status = 'pending'
    AND (i.expires_at IS NULL OR i.expires_at > NOW())
    AND (i.max_uses = -1 OR i.uses_count < i.max_uses)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Update invitation
  UPDATE invitations
  SET 
    uses_count = uses_count + 1,
    accepted_by = user_id,
    accepted_at = NOW(),
    status = CASE 
      WHEN max_uses = -1 THEN 'pending'  -- Unlimited use
      WHEN uses_count + 1 >= max_uses THEN 'accepted'  -- Max uses reached
      ELSE 'pending'
    END,
    updated_at = NOW()
  WHERE code = invite_code;

  -- Link user to organization
  UPDATE profiles
  SET 
    organization_id = invitation.organization_id,
    preschool_id = invitation.organization_id,
    updated_at = NOW()
  WHERE id = user_id;

  RETURN TRUE;
END;
$$;

-- Grant permissions
GRANT SELECT ON invitations TO authenticated;
GRANT INSERT ON invitations TO authenticated;
GRANT UPDATE ON invitations TO authenticated;

GRANT EXECUTE ON FUNCTION generate_invitation_code() TO authenticated;
GRANT EXECUTE ON FUNCTION validate_invitation_code(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_invitation_code(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION accept_invitation_code(TEXT, UUID) TO authenticated;

-- Create some sample invitations for testing
INSERT INTO invitations (organization_id, code, role, max_uses, created_at)
SELECT 
  id,
  'DEMO' || UPPER(substring(name from 1 for 3)) || '123',
  'parent',
  -1,  -- Unlimited uses
  NOW()
FROM organizations
WHERE is_public = TRUE
ON CONFLICT (code) DO NOTHING;

-- Log success
SELECT 'Invitations system created successfully' AS status;
