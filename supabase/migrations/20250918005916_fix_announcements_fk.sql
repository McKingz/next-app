-- ============================================================================
-- Fix Announcements Foreign Key Constraint Issue
-- ============================================================================
-- This fixes the foreign key constraint error for announcements.author_id

-- ============================================================================
-- 1. CHECK CURRENT FOREIGN KEY CONSTRAINTS
-- ============================================================================

-- First, let's see what constraints exist
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  tc.constraint_name
FROM
  information_schema.table_constraints AS tc
INNER JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
INNER JOIN information_schema.constraint_column_usage AS ccu ON tc.constraint_name = ccu.constraint_name
WHERE
  tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'announcements'
  AND kcu.column_name = 'author_id';

-- ============================================================================
-- 2. DROP AND RECREATE FOREIGN KEY CONSTRAINT
-- ============================================================================

-- Drop the problematic foreign key constraint if it exists
DO $$
DECLARE
    constraint_name_var TEXT;
BEGIN
    -- Find the constraint name
    SELECT tc.constraint_name INTO constraint_name_var
    FROM information_schema.table_constraints tc 
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' 
      AND tc.table_name = 'announcements'
      AND kcu.column_name = 'author_id'
    LIMIT 1;
    
    -- Drop the constraint if it exists
    IF constraint_name_var IS NOT NULL THEN
        EXECUTE 'ALTER TABLE announcements DROP CONSTRAINT ' || constraint_name_var;
        RAISE NOTICE 'Dropped constraint: %', constraint_name_var;
    END IF;
END $$;

-- ============================================================================
-- 3. ENSURE ANNOUNCEMENTS TABLE EXISTS WITH CORRECT STRUCTURE
-- ============================================================================

-- Create announcements table if it doesn't exist
CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preschool_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  author_id UUID NOT NULL,
  target_audience TEXT NOT NULL CHECK (target_audience IN ('all', 'teachers', 'parents', 'students')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  published_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 4. ADD CORRECT FOREIGN KEY CONSTRAINTS
-- ============================================================================

-- Add foreign key to preschools table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'announcements_preschool_id_fkey'
        AND table_name = 'announcements'
    ) THEN
        ALTER TABLE announcements 
        ADD CONSTRAINT announcements_preschool_id_fkey 
        FOREIGN KEY (preschool_id) REFERENCES preschools(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Add foreign key to auth.users (the correct auth table)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'announcements_author_id_fkey'
        AND table_name = 'announcements'
    ) THEN
        ALTER TABLE announcements 
        ADD CONSTRAINT announcements_author_id_fkey 
        FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- ============================================================================
-- 5. CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

-- Index on preschool_id for faster queries
CREATE INDEX IF NOT EXISTS idx_announcements_preschool_id
ON announcements (preschool_id);

-- Index on author_id for faster queries
CREATE INDEX IF NOT EXISTS idx_announcements_author_id
ON announcements (author_id);

-- Index on published_at for sorting
CREATE INDEX IF NOT EXISTS idx_announcements_published_at
ON announcements (published_at DESC);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_announcements_preschool_published
ON announcements (preschool_id, is_published, published_at DESC);

-- ============================================================================
-- 6. ENABLE RLS ON ANNOUNCEMENTS TABLE
-- ============================================================================

-- Enable RLS
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view announcements from their preschool
DROP POLICY IF EXISTS announcements_select_policy ON announcements;
CREATE POLICY announcements_select_policy ON announcements
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users AS u
    WHERE
      u.auth_user_id = auth.uid()
      AND u.preschool_id = announcements.preschool_id
  )
);

-- Policy: Principals and admins can create announcements
DROP POLICY IF EXISTS announcements_insert_policy ON announcements;
CREATE POLICY announcements_insert_policy ON announcements
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users AS u
    WHERE
      u.auth_user_id = auth.uid()
      AND u.preschool_id = announcements.preschool_id
      AND u.role IN ('principal_admin', 'super_admin')
  )
  AND author_id = auth.uid()
);

-- Policy: Authors can update their own announcements
DROP POLICY IF EXISTS announcements_update_policy ON announcements;
CREATE POLICY announcements_update_policy ON announcements
FOR UPDATE
USING (
  author_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM users AS u
    WHERE
      u.auth_user_id = auth.uid()
      AND u.preschool_id = announcements.preschool_id
  )
);

-- Policy: Authors and super admins can delete announcements
DROP POLICY IF EXISTS announcements_delete_policy ON announcements;
CREATE POLICY announcements_delete_policy ON announcements
FOR DELETE
USING (
  author_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM users AS u
    WHERE
      u.auth_user_id = auth.uid()
      AND u.role = 'super_admin'
  )
);

-- ============================================================================
-- 7. CREATE UPDATED_AT TRIGGER
-- ============================================================================

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION update_announcements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS announcements_updated_at_trigger ON announcements;
CREATE TRIGGER announcements_updated_at_trigger
BEFORE UPDATE ON announcements
FOR EACH ROW
EXECUTE FUNCTION update_announcements_updated_at();

-- ============================================================================
-- 8. GRANT PERMISSIONS
-- ============================================================================

-- Grant necessary permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON announcements TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- ============================================================================
-- 9. COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE announcements IS 'School announcements sent to teachers, parents, and students';
COMMENT ON COLUMN announcements.author_id IS 'References auth.users.id - the user who created the announcement';
COMMENT ON COLUMN announcements.preschool_id IS 'References preschools.id - the school this announcement belongs to';
COMMENT ON COLUMN announcements.target_audience IS 'Who this announcement is intended for';
COMMENT ON COLUMN announcements.priority IS 'Priority level of the announcement';

-- Success message
SELECT 'Announcements table and constraints fixed successfully!' AS result;
