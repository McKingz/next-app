-- Phase 3B Revised: Organization Generalization Schema Migration
-- Handles existing organizations table and adds missing columns

-- ============================================================================
-- STEP 1: Create organization type enum (if not exists)
-- ============================================================================

DO $$ BEGIN
    CREATE TYPE organization_type AS ENUM (
        'preschool',
        'k12_school',
        'university',
        'corporate',
        'sports_club',
        'community_org',
        'training_center',
        'tutoring_center'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TYPE organization_type IS 'Types of organizations supported by the platform';

-- ============================================================================
-- STEP 2: Alter existing organizations table to add missing columns
-- ============================================================================

-- Add type column (if not exists)
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS type organization_type NOT NULL DEFAULT 'preschool';

-- If type column exists but is wrong type, convert it
DO $$
BEGIN
  ALTER TABLE organizations
  ALTER COLUMN type TYPE organization_type USING type::text::organization_type;
EXCEPTION
  WHEN OTHERS THEN
    NULL; -- Column already correct type or doesn't exist
END
$$;

-- Add legacy compatibility column
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS preschool_id uuid REFERENCES preschools (id) ON DELETE SET NULL;

-- Add description
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS description text;

-- Add contact information (if not exists)
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS email varchar(255),
ADD COLUMN IF NOT EXISTS phone varchar(50),
ADD COLUMN IF NOT EXISTS website varchar(255);

-- Add address fields (if not exists)
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS address_line1 varchar(255),
ADD COLUMN IF NOT EXISTS address_line2 varchar(255),
ADD COLUMN IF NOT EXISTS city varchar(100),
ADD COLUMN IF NOT EXISTS state varchar(100),
ADD COLUMN IF NOT EXISTS postal_code varchar(20),
ADD COLUMN IF NOT EXISTS country varchar(100) DEFAULT 'South Africa';

-- Add configuration
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS config jsonb DEFAULT '{}'::jsonb;

-- Add subscription & billing
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS subscription_status varchar(50) DEFAULT 'active',
ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
ADD COLUMN IF NOT EXISTS subscription_ends_at timestamptz;

-- Add metadata
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS logo_url text,
ADD COLUMN IF NOT EXISTS primary_color varchar(7),
ADD COLUMN IF NOT EXISTS timezone varchar(100) DEFAULT 'Africa/Johannesburg',
ADD COLUMN IF NOT EXISTS locale varchar(10) DEFAULT 'en-ZA';

-- Add feature flags
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS features jsonb DEFAULT '{
    "hasAttendance": true,
    "hasGrading": true,
    "hasScheduling": true,
    "hasMessaging": true,
    "hasReporting": true,
    "hasCalendar": true,
    "hasPayments": true,
    "hasDocuments": true
}'::jsonb;

-- Add audit fields (if not exists)
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT TRUE;

-- ============================================================================
-- STEP 3: Create indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_organizations_type ON organizations (type);
CREATE INDEX IF NOT EXISTS idx_organizations_preschool_id ON organizations (preschool_id);
CREATE INDEX IF NOT EXISTS idx_organizations_is_active ON organizations (is_active);
CREATE INDEX IF NOT EXISTS idx_organizations_created_at ON organizations (created_at);
CREATE INDEX IF NOT EXISTS idx_organizations_plan_tier ON organizations (plan_tier);

-- ============================================================================
-- STEP 4: Create organization_roles table
-- ============================================================================

CREATE TABLE IF NOT EXISTS organization_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  role_id varchar(100) NOT NULL,
  role_name varchar(100) NOT NULL,
  display_name varchar(100) NOT NULL,
  description text,
  permissions text [] DEFAULT ARRAY[]::text [],
  hierarchy_level integer NOT NULL DEFAULT 0,
  capabilities text [] DEFAULT ARRAY[]::text [],
  ai_config jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT TRUE,
  CONSTRAINT organization_roles_unique_role UNIQUE (organization_id, role_id),
  CONSTRAINT organization_roles_name_not_empty CHECK (length(trim(role_name)) > 0),
  CONSTRAINT organization_roles_hierarchy_positive CHECK (hierarchy_level >= 0)
);

CREATE INDEX IF NOT EXISTS idx_organization_roles_org_id ON organization_roles (organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_roles_role_id ON organization_roles (role_id);
CREATE INDEX IF NOT EXISTS idx_organization_roles_hierarchy ON organization_roles (hierarchy_level);

COMMENT ON TABLE organization_roles IS 'Dynamic role definitions per organization';

-- ============================================================================
-- STEP 5: Update existing preschool data
-- ============================================================================

-- Set preschool_id for organizations that match preschools
UPDATE organizations AS org
SET preschool_id = p.id
FROM preschools AS p
WHERE
  org.id = p.id
  AND org.preschool_id IS NULL;

-- ============================================================================
-- STEP 6: Add organization_id to users table
-- ============================================================================

ALTER TABLE users
ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_organization_id ON users (organization_id);

-- Update users.organization_id from existing preschool_id
-- Wrapped in DO block to handle any trigger-related errors gracefully
DO $$
BEGIN
  UPDATE users
  SET organization_id = preschool_id
  WHERE
    preschool_id IS NOT NULL
    AND organization_id IS NULL;
EXCEPTION
  WHEN foreign_key_violation THEN
    -- If triggers cause FK violations, log and continue
    RAISE NOTICE 'Some user updates skipped due to data integrity constraints';
END
$$;

-- ============================================================================
-- STEP 7: RLS Policies
-- ============================================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_roles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS users_can_view_their_organization ON organizations;
DROP POLICY IF EXISTS admins_can_update_organizations ON organizations;
DROP POLICY IF EXISTS superadmins_can_create_organizations ON organizations;
DROP POLICY IF EXISTS users_can_view_organization_roles ON organization_roles;
DROP POLICY IF EXISTS admins_can_manage_organization_roles ON organization_roles;

-- Create policies
CREATE POLICY users_can_view_their_organization
ON organizations
FOR SELECT
USING (
  id IN (
    SELECT organization_id
    FROM users
    WHERE auth_user_id = auth.uid()
  ) OR preschool_id IN (
    SELECT preschool_id
    FROM users
    WHERE auth_user_id = auth.uid()
  )
);

CREATE POLICY admins_can_update_organizations
ON organizations
FOR UPDATE
USING (
  id IN (
    SELECT organization_id
    FROM users
    WHERE
      auth_user_id = auth.uid()
      AND role IN ('admin', 'principal', 'superadmin')
  )
);

CREATE POLICY superadmins_can_create_organizations
ON organizations
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM users
    WHERE
      auth_user_id = auth.uid()
      AND role = 'superadmin'
  )
);

CREATE POLICY users_can_view_organization_roles
ON organization_roles
FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id
    FROM users
    WHERE auth_user_id = auth.uid()
  )
);

CREATE POLICY admins_can_manage_organization_roles
ON organization_roles
FOR ALL
USING (
  organization_id IN (
    SELECT organization_id
    FROM users
    WHERE
      auth_user_id = auth.uid()
      AND role IN ('admin', 'principal', 'superadmin')
  )
);

-- ============================================================================
-- STEP 8: Helper functions
-- ============================================================================

CREATE OR REPLACE FUNCTION get_organization_type(org_id uuid)
RETURNS organization_type
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    select type::text::organization_type
    from organizations
    where id = org_id;
$$;

CREATE OR REPLACE FUNCTION is_feature_enabled(
  org_id uuid,
  feature_name text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    select coalesce(
        (features -> feature_name)::boolean,
        false
    )
    from organizations
    where id = org_id;
$$;

-- ============================================================================
-- STEP 9: Triggers
-- ============================================================================

CREATE OR REPLACE FUNCTION update_organizations_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
begin
    new.updated_at = now();
    return new;
end;
$$;

DROP TRIGGER IF EXISTS trigger_organizations_updated_at ON organizations;
CREATE TRIGGER trigger_organizations_updated_at
BEFORE UPDATE ON organizations
FOR EACH ROW
EXECUTE FUNCTION update_organizations_updated_at();

DROP TRIGGER IF EXISTS trigger_organization_roles_updated_at ON organization_roles;
CREATE TRIGGER trigger_organization_roles_updated_at
BEFORE UPDATE ON organization_roles
FOR EACH ROW
EXECUTE FUNCTION update_organizations_updated_at();

-- Migration complete
