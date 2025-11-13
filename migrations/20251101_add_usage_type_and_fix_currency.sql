-- Migration: Add usage_type support and ensure ZAR currency
-- Date: 2025-11-01
-- Purpose: Support flexible parent signup flow with usage types
-- Currency: South African Rand (ZAR)

-- ============================================
-- PART 1: Add usage_type to profiles
-- ============================================

-- Add usage_type column with valid options
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS usage_type TEXT 
CHECK (usage_type IN (
  'preschool',      -- Child attends preschool
  'k12_school',     -- Child attends K-12 school
  'homeschool',     -- Homeschooling
  'aftercare',      -- Aftercare/extracurricular
  'supplemental',   -- Supplemental learning
  'exploring',      -- Just exploring
  'independent'     -- Default for legacy/unspecified
));

-- Add comment for documentation
COMMENT ON COLUMN profiles.usage_type IS 
  'How the parent intends to use EduDash Pro. Values: preschool, k12_school, homeschool, aftercare, supplemental, exploring, independent';

-- Make preschool_id nullable (should already be, but ensure it)
ALTER TABLE profiles 
ALTER COLUMN preschool_id DROP NOT NULL;

-- Add index for querying by usage type
CREATE INDEX IF NOT EXISTS idx_profiles_usage_type 
ON profiles(usage_type) 
WHERE usage_type IS NOT NULL;

-- ============================================
-- PART 2: Migrate existing users
-- ============================================

-- Classify existing users based on their current data
UPDATE profiles 
SET usage_type = CASE 
  -- If linked to preschool, assume preschool usage
  WHEN preschool_id IS NOT NULL AND role = 'parent' THEN 'preschool'
  -- Teachers and principals get appropriate types
  WHEN role = 'teacher' THEN 'preschool'
  WHEN role = 'principal' THEN 'preschool'
  -- Parents without preschool are independent
  WHEN role = 'parent' AND preschool_id IS NULL THEN 'independent'
  -- Default to independent
  ELSE 'independent'
END
WHERE usage_type IS NULL;

-- ============================================
-- PART 3: Ensure students support independent learning
-- ============================================

-- Make preschool_id optional for students (for homeschool/independent)
ALTER TABLE students 
ALTER COLUMN preschool_id DROP NOT NULL;

-- Add date_of_birth if not exists (for age-based content)
ALTER TABLE students 
ADD COLUMN IF NOT EXISTS date_of_birth DATE;

-- Add grade_level if not exists (for curriculum alignment)
ALTER TABLE students 
ADD COLUMN IF NOT EXISTS grade_level TEXT;

-- Add comment
COMMENT ON COLUMN students.date_of_birth IS 
  'Student date of birth for age-appropriate content recommendations';
COMMENT ON COLUMN students.grade_level IS 
  'Current grade level (e.g., "Grade R", "Grade 1", "Grade 12")';

-- ============================================
-- PART 4: Fix currency to South African Rand (ZAR) - Only if tables exist
-- ============================================

-- Note: Currency handling is application-level (display R symbol for Rand)
-- If you have fees/payments tables in the future, add currency columns like:
-- ALTER TABLE fees ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'ZAR';
-- ALTER TABLE payments ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'ZAR';

-- For now, we'll handle ZAR in the application layer
-- All amounts should be displayed with R prefix (e.g., R99.99)

-- ============================================
-- PART 5: Update preschools table for approval
-- ============================================

-- Ensure preschools have approval status
ALTER TABLE preschools 
ADD COLUMN IF NOT EXISTS approved BOOLEAN DEFAULT FALSE;

ALTER TABLE preschools 
ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT FALSE;

ALTER TABLE preschools
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES profiles(id);

ALTER TABLE preschools
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;

-- Ensure subscription_tier column exists (for TierBadge compatibility)
ALTER TABLE preschools
ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free'
CHECK (subscription_tier IN ('free', 'starter', 'premium', 'professional', 'enterprise', 'parent-starter', 'parent-plus'));

-- Sync subscription_plan to subscription_tier if tier is null
UPDATE preschools
SET subscription_tier = COALESCE(subscription_tier, subscription_plan, 'free')
WHERE subscription_tier IS NULL;

-- Add indexes for approved/verified queries
CREATE INDEX IF NOT EXISTS idx_preschools_approved 
ON preschools(approved) 
WHERE approved = TRUE;

CREATE INDEX IF NOT EXISTS idx_preschools_verified 
ON preschools(verified) 
WHERE verified = TRUE;

-- Add comments
COMMENT ON COLUMN preschools.approved IS 
  'Whether the organization has been approved to appear in parent searches (set via superadmin dashboard)';
COMMENT ON COLUMN preschools.verified IS 
  'Whether the organization has been verified by admin (set via superadmin dashboard)';
COMMENT ON COLUMN preschools.approved_by IS
  'Superadmin user who approved this organization';
COMMENT ON COLUMN preschools.approved_at IS
  'When the organization was approved';

-- ============================================
-- PART 6: Create helper functions
-- ============================================

-- Function to check if user has school-dependent features
CREATE OR REPLACE FUNCTION has_school_features(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = user_id 
    AND preschool_id IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION has_school_features IS 
  'Check if a user has access to school-dependent features (requires preschool_id)';

-- Function to get approved organizations for search
CREATE OR REPLACE FUNCTION get_approved_organizations()
RETURNS TABLE (
  id UUID,
  name TEXT,
  type TEXT,
  city TEXT,
  province TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.type,
    p.city,
    p.province
  FROM preschools p
  WHERE p.approved = TRUE 
    AND p.verified = TRUE
    AND p.is_active = TRUE
  ORDER BY p.name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_approved_organizations IS 
  'Get list of approved organizations for parent signup search';

-- ============================================
-- PART 7: Update RLS policies (if needed)
-- ============================================

-- Ensure parents can read approved preschools
DROP POLICY IF EXISTS "Parents can view approved preschools" ON preschools;
CREATE POLICY "Parents can view approved preschools" 
ON preschools FOR SELECT
TO authenticated
USING (
  approved = TRUE 
  AND verified = TRUE 
  AND is_active = TRUE
);

-- ============================================
-- PART 8: Create audit log (optional)
-- ============================================

-- Create migration_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS migration_logs (
  id SERIAL PRIMARY KEY,
  version TEXT UNIQUE NOT NULL,
  description TEXT,
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Log this migration
INSERT INTO migration_logs (
  version,
  description,
  applied_at
) VALUES (
  '20251101_add_usage_type_and_fix_currency',
  'Add usage_type to profiles, ensure ZAR currency, support independent learning',
  NOW()
) ON CONFLICT (version) DO NOTHING;

-- ============================================
-- VERIFICATION QUERIES (Run after migration)
-- ============================================

-- Check usage_type distribution
-- SELECT usage_type, COUNT(*) as count 
-- FROM profiles 
-- WHERE role = 'parent' 
-- GROUP BY usage_type 
-- ORDER BY count DESC;

-- Note: Currency is handled in application layer (display R symbol)

-- Check approved organizations
-- SELECT COUNT(*) as total, 
--        SUM(CASE WHEN approved THEN 1 ELSE 0 END) as approved,
--        SUM(CASE WHEN verified THEN 1 ELSE 0 END) as verified
-- FROM preschools;

-- Check nullable fields
-- SELECT 
--   COUNT(*) as total_profiles,
--   SUM(CASE WHEN preschool_id IS NULL THEN 1 ELSE 0 END) as without_preschool,
--   SUM(CASE WHEN usage_type IS NOT NULL THEN 1 ELSE 0 END) as with_usage_type
-- FROM profiles 
-- WHERE role = 'parent';

-- ============================================
-- ROLLBACK (if needed - DO NOT RUN unless necessary)
-- ============================================

/*
-- WARNING: This will remove the usage_type column
-- Only use if you need to rollback the migration

-- DROP COLUMN usage_type
ALTER TABLE profiles DROP COLUMN IF EXISTS usage_type;

-- DROP indexes
DROP INDEX IF EXISTS idx_profiles_usage_type;
DROP INDEX IF EXISTS idx_preschools_approved;
DROP INDEX IF EXISTS idx_preschools_verified;

-- DROP functions
DROP FUNCTION IF EXISTS has_school_features(UUID);
DROP FUNCTION IF EXISTS get_approved_organizations();

-- DROP policy
DROP POLICY IF EXISTS "Parents can view approved preschools" ON preschools;

-- Remove currency columns (careful - may have data)
-- ALTER TABLE fees DROP COLUMN IF EXISTS currency;
-- ALTER TABLE payments DROP COLUMN IF EXISTS currency;
-- ALTER TABLE subscription_plans DROP COLUMN IF EXISTS currency;
*/

-- ============================================
-- DONE!
-- ============================================
