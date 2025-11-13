-- Phase 3B: Organization Generalization Schema Migration
-- Part of AI Architecture Refactoring - Phase 3
--
-- This migration generalizes the system from preschool-only to support:
-- - Universities
-- - Corporate training
-- - K-12 schools
-- - Sports clubs
-- - Community organizations
-- - Training centers
-- - Tutoring centers
--
-- Strategy: Additive migration with backward compatibility
-- - Creates new organization_type enum
-- - Adds organization_id column alongside existing preschool_id
-- - Migrates existing preschool data to organizations table
-- - Maintains RLS policies for multi-tenant isolation

-- ============================================================================
-- STEP 1: Create organization type enum
-- ============================================================================

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

COMMENT ON TYPE organization_type IS 'Types of organizations supported by the platform';

-- ============================================================================
-- STEP 2: Create organizations table (extends preschools functionality)
-- ============================================================================

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Organization identity
  name VARCHAR(255) NOT NULL,
  type ORGANIZATION_TYPE NOT NULL DEFAULT 'preschool',
  description TEXT,

  -- Legacy compatibility
  preschool_id UUID REFERENCES preschools (id) ON DELETE SET NULL,

  -- Contact information
  email VARCHAR(255),
  phone VARCHAR(50),
  website VARCHAR(255),

  -- Address
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(100),
  postal_code VARCHAR(20),
  country VARCHAR(100) DEFAULT 'South Africa',

  -- Configuration
  config JSONB DEFAULT '{}'::JSONB,

  -- Subscription & billing
  plan_tier VARCHAR(50) DEFAULT 'free',
  subscription_status VARCHAR(50) DEFAULT 'active',
  trial_ends_at TIMESTAMPTZ,
  subscription_ends_at TIMESTAMPTZ,

  -- Metadata
  logo_url TEXT,
  primary_color VARCHAR(7),
  timezone VARCHAR(100) DEFAULT 'Africa/Johannesburg',
  locale VARCHAR(10) DEFAULT 'en-ZA',

  -- Feature flags
  features JSONB DEFAULT '{
    "hasAttendance": true,
    "hasGrading": true,
    "hasScheduling": true,
    "hasMessaging": true,
    "hasReporting": true,
    "hasCalendar": true,
    "hasPayments": true,
    "hasDocuments": true
  }'::JSONB,

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  -- Constraints
  CONSTRAINT organizations_name_not_empty CHECK (length(trim(name)) > 0),
  CONSTRAINT organizations_email_format CHECK (
    email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' OR email IS NULL
  )
);

-- Indexes for performance
CREATE INDEX idx_organizations_type ON organizations (type);
CREATE INDEX idx_organizations_preschool_id ON organizations (preschool_id);
CREATE INDEX idx_organizations_is_active ON organizations (is_active);
CREATE INDEX idx_organizations_created_at ON organizations (created_at);
CREATE INDEX idx_organizations_plan_tier ON organizations (plan_tier);

-- Comments
COMMENT ON TABLE organizations IS 'Generalized organizations table supporting multiple org types';
COMMENT ON COLUMN organizations.type IS 'Organization type (preschool, university, corporate, etc.)';
COMMENT ON COLUMN organizations.preschool_id IS 'Legacy reference to preschools table for backward compatibility';
COMMENT ON COLUMN organizations.config IS 'Organization-specific configuration as JSON';
COMMENT ON COLUMN organizations.features IS 'Feature flags for this organization';

-- ============================================================================
-- STEP 3: Create organization_roles table for dynamic role definitions
-- ============================================================================

CREATE TABLE IF NOT EXISTS organization_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Role identity
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  role_id VARCHAR(100) NOT NULL,
  role_name VARCHAR(100) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,

  -- Role configuration
  permissions TEXT [] DEFAULT ARRAY[]::TEXT [],
  hierarchy_level INTEGER NOT NULL DEFAULT 0,
  capabilities TEXT [] DEFAULT ARRAY[]::TEXT [],

  -- AI personality configuration
  ai_config JSONB DEFAULT '{}'::JSONB,

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  -- Constraints
  CONSTRAINT organization_roles_unique_role UNIQUE (organization_id, role_id),
  CONSTRAINT organization_roles_name_not_empty CHECK (length(trim(role_name)) > 0),
  CONSTRAINT organization_roles_hierarchy_positive CHECK (hierarchy_level >= 0)
);

-- Indexes
CREATE INDEX idx_organization_roles_org_id ON organization_roles (organization_id);
CREATE INDEX idx_organization_roles_role_id ON organization_roles (role_id);
CREATE INDEX idx_organization_roles_hierarchy ON organization_roles (hierarchy_level);

-- Comments
COMMENT ON TABLE organization_roles IS 'Dynamic role definitions per organization';
COMMENT ON COLUMN organization_roles.role_id IS 'Role identifier (e.g., teacher, professor, coach)';
COMMENT ON COLUMN organization_roles.hierarchy_level IS '0 = lowest (member), higher = more authority';
COMMENT ON COLUMN organization_roles.ai_config IS 'AI personality config for this role (greeting, tone, etc.)';

-- ============================================================================
-- STEP 4: Migrate existing preschool data to organizations
-- ============================================================================

-- Insert existing preschools as organizations
INSERT INTO organizations (
  id,
  name,
  type,
  description,
  preschool_id,
  email,
  phone,
  address_line1,
  address_line2,
  city,
  state,
  postal_code,
  country,
  plan_tier,
  subscription_status,
  logo_url,
  timezone,
  locale,
  created_at,
  updated_at,
  is_active
)
SELECT
  id,  -- Use same UUID as preschool
  name,
  'preschool'::ORGANIZATION_TYPE,
  NULL,  -- description
  id,  -- preschool_id references itself
  contact_email,
  contact_phone,
  address,
  NULL,  -- address_line2
  city,
  province,
  postal_code,
  'South Africa',
  coalesce(subscription_tier, 'free'),
  'active',
  logo_url,
  coalesce(timezone, 'Africa/Johannesburg'),
  'en-ZA',
  created_at,
  updated_at,
  coalesce(is_active, TRUE)
FROM preschools
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STEP 5: Add organization_id to existing tables (additive, non-breaking)
-- ============================================================================

-- users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_organization_id ON users (organization_id);

-- Update users.organization_id from existing preschool_id
UPDATE users
SET organization_id = preschool_id
WHERE preschool_id IS NOT NULL AND organization_id IS NULL;

-- Add similar columns to other key tables
-- Note: We keep both preschool_id and organization_id for backward compatibility

-- Example for other tables (add as needed):
-- ALTER TABLE students ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
-- ALTER TABLE classes ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
-- ALTER TABLE lessons ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- ============================================================================
-- STEP 6: RLS Policies for organizations table
-- ============================================================================

-- Enable RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_roles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own organization
CREATE POLICY "Users can view their organization"
ON organizations
FOR SELECT
USING (
  id IN (
    SELECT organization_id
    FROM users
    WHERE auth_user_id = auth.uid()
  )
  OR
  preschool_id IN (
    SELECT preschool_id
    FROM users
    WHERE auth_user_id = auth.uid()
  )
);

-- Policy: Only admins can update organizations
CREATE POLICY "Admins can update organizations"
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

-- Policy: Superadmins can insert organizations
CREATE POLICY "Superadmins can create organizations"
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

-- Policy: Users can view roles in their organization
CREATE POLICY "Users can view organization roles"
ON organization_roles
FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id
    FROM users
    WHERE auth_user_id = auth.uid()
  )
);

-- Policy: Admins can manage roles in their organization
CREATE POLICY "Admins can manage organization roles"
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
-- STEP 7: Helper functions for organization management
-- ============================================================================

-- Function to get organization type
CREATE OR REPLACE FUNCTION get_organization_type(org_id UUID)
RETURNS ORGANIZATION_TYPE
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT type FROM organizations WHERE id = org_id;
$$;

COMMENT ON FUNCTION get_organization_type(UUID) IS 'Get organization type by ID';

-- Function to check if feature is enabled for organization
CREATE OR REPLACE FUNCTION is_feature_enabled(
  org_id UUID,
  feature_name TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (features->feature_name)::boolean,
    false
  )
  FROM organizations
  WHERE id = org_id;
$$;

COMMENT ON FUNCTION is_feature_enabled(UUID, TEXT) IS 'Check if a feature is enabled for an organization';

-- ============================================================================
-- STEP 8: Updated_at trigger for organizations
-- ============================================================================

CREATE OR REPLACE FUNCTION update_organizations_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_organizations_updated_at
BEFORE UPDATE ON organizations
FOR EACH ROW
EXECUTE FUNCTION update_organizations_updated_at();

CREATE TRIGGER trigger_organization_roles_updated_at
BEFORE UPDATE ON organization_roles
FOR EACH ROW
EXECUTE FUNCTION update_organizations_updated_at();

-- ============================================================================
-- ROLLBACK INSTRUCTIONS (for reference, not executed)
-- ============================================================================

-- To rollback this migration:
-- DROP TRIGGER IF EXISTS trigger_organization_roles_updated_at ON organization_roles;
-- DROP TRIGGER IF EXISTS trigger_organizations_updated_at ON organizations;
-- DROP FUNCTION IF EXISTS update_organizations_updated_at();
-- DROP FUNCTION IF EXISTS is_feature_enabled(UUID, TEXT);
-- DROP FUNCTION IF EXISTS get_organization_type(UUID);
-- DROP POLICY IF EXISTS "Admins can manage organization roles" ON organization_roles;
-- DROP POLICY IF EXISTS "Users can view organization roles" ON organization_roles;
-- DROP POLICY IF EXISTS "Superadmins can create organizations" ON organizations;
-- DROP POLICY IF EXISTS "Admins can update organizations" ON organizations;
-- DROP POLICY IF EXISTS "Users can view their organization" ON organizations;
-- ALTER TABLE users DROP COLUMN IF EXISTS organization_id;
-- DROP INDEX IF EXISTS idx_organization_roles_hierarchy;
-- DROP INDEX IF EXISTS idx_organization_roles_role_id;
-- DROP INDEX IF EXISTS idx_organization_roles_org_id;
-- DROP TABLE IF EXISTS organization_roles;
-- DROP INDEX IF EXISTS idx_organizations_plan_tier;
-- DROP INDEX IF EXISTS idx_organizations_created_at;
-- DROP INDEX IF EXISTS idx_organizations_is_active;
-- DROP INDEX IF EXISTS idx_organizations_preschool_id;
-- DROP INDEX IF EXISTS idx_organizations_type;
-- DROP TABLE IF EXISTS organizations;
-- DROP TYPE IF EXISTS organization_type;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Summary:
-- ✅ Created organization_type enum (8 types)
-- ✅ Created organizations table with config/features
-- ✅ Created organization_roles table for dynamic roles
-- ✅ Migrated existing preschool data
-- ✅ Added organization_id to users table
-- ✅ Implemented RLS policies for multi-tenant isolation
-- ✅ Added helper functions
-- ✅ Added updated_at triggers
--
-- Next Steps:
-- 1. Run: supabase db push
-- 2. Verify: supabase db diff (should show no changes)
-- 3. Update application code to use organization_id
-- 4. Gradually migrate other tables
