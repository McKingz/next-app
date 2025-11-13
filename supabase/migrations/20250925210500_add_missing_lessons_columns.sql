-- Add missing columns to lessons table for LessonsService compatibility
-- This migration adds the columns expected by the LessonsService

-- ============================================================================
-- PART 1: ADD MISSING COLUMNS
-- ============================================================================

-- Add status column with check constraint
ALTER TABLE lessons
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft'
CHECK (status IN ('draft', 'active', 'archived', 'published'));

-- Add subject column with check constraint  
ALTER TABLE lessons
ADD COLUMN IF NOT EXISTS subject text NOT NULL DEFAULT 'general'
CHECK (subject IN ('mathematics', 'literacy', 'science', 'art', 'music', 'physical', 'general'));

-- Add age_group column with check constraint
ALTER TABLE lessons
ADD COLUMN IF NOT EXISTS age_group text NOT NULL DEFAULT '3-6'
CHECK (age_group IN ('3-4', '4-5', '5-6', '3-6'));

-- Add additional useful columns for lesson management
ALTER TABLE lessons
ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT FALSE;

ALTER TABLE lessons
ADD COLUMN IF NOT EXISTS is_premium boolean NOT NULL DEFAULT FALSE;

ALTER TABLE lessons
ADD COLUMN IF NOT EXISTS rating numeric(2, 1) DEFAULT 0.0
CHECK (rating >= 0 AND rating <= 5);

ALTER TABLE lessons
ADD COLUMN IF NOT EXISTS completion_count integer DEFAULT 0
CHECK (completion_count >= 0);

ALTER TABLE lessons
ADD COLUMN IF NOT EXISTS language text DEFAULT 'en';

-- Add short_description for better UI display
ALTER TABLE lessons
ADD COLUMN IF NOT EXISTS short_description text;

-- ============================================================================
-- PART 2: UPDATE EXISTING DATA
-- ============================================================================

-- Update existing lessons with default values
UPDATE lessons SET
  status = CASE
    WHEN is_public = TRUE THEN 'published'
    ELSE 'draft'
  END,
  subject = 'general',  -- Default subject
  age_group = CASE
    WHEN age_group_min IS NOT NULL AND age_group_max IS NOT NULL
      THEN
        CASE
          WHEN age_group_min >= 3 AND age_group_max <= 4 THEN '3-4'
          WHEN age_group_min >= 4 AND age_group_max <= 5 THEN '4-5'
          WHEN age_group_min >= 5 AND age_group_max <= 6 THEN '5-6'
          ELSE '3-6'
        END
    ELSE '3-6'
  END,
  is_featured = is_public,  -- Make public lessons featured by default
  is_premium = FALSE,
  rating = 4.5,  -- Default good rating
  completion_count = 0,
  language = 'en',
  short_description = CASE
    WHEN description IS NOT NULL
      THEN
        LEFT(description, 150) || CASE WHEN LENGTH(description) > 150 THEN '...' ELSE '' END
    ELSE 'Preschool lesson'
  END
WHERE status IS NULL OR subject IS NULL OR age_group IS NULL;

-- ============================================================================
-- PART 3: CREATE INDEXES FOR PERFORMANCE  
-- ============================================================================

-- Index on status for filtering
CREATE INDEX IF NOT EXISTS idx_lessons_status ON lessons (status);

-- Index on subject for filtering
CREATE INDEX IF NOT EXISTS idx_lessons_subject ON lessons (subject);

-- Index on age_group for filtering  
CREATE INDEX IF NOT EXISTS idx_lessons_age_group ON lessons (age_group);

-- Index on is_featured for featured lessons
CREATE INDEX IF NOT EXISTS idx_lessons_is_featured ON lessons (is_featured);

-- Index on rating for sorting
CREATE INDEX IF NOT EXISTS idx_lessons_rating ON lessons (rating);

-- Index on completion_count for popular lessons
CREATE INDEX IF NOT EXISTS idx_lessons_completion_count ON lessons (completion_count);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_lessons_status_public_created
ON lessons (status, is_public, created_at DESC);

-- ============================================================================
-- PART 4: UPDATE TRIGGERS
-- ============================================================================

-- Ensure updated_at is updated when lessons are modified
CREATE OR REPLACE FUNCTION UPDATE_LESSONS_UPDATED_AT()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'lessons_updated_at_trigger'
  ) THEN
    CREATE TRIGGER lessons_updated_at_trigger
      BEFORE UPDATE ON lessons
      FOR EACH ROW
      EXECUTE FUNCTION update_lessons_updated_at();
  END IF;
END $$;

-- ============================================================================
-- PART 5: SMART SUBJECT INFERENCE
-- ============================================================================

-- Try to infer subjects from lesson titles and descriptions
UPDATE lessons SET
  subject = CASE
    WHEN
      LOWER(title) ~ '.*(math|number|count|add|subtract).*'
      OR LOWER(description) ~ '.*(math|number|count|add|subtract).*' THEN 'mathematics'
    WHEN
      LOWER(title) ~ '.*(read|letter|word|book|story|alphabet).*'
      OR LOWER(description) ~ '.*(read|letter|word|book|story|alphabet).*' THEN 'literacy'
    WHEN
      LOWER(title) ~ '.*(science|nature|plant|animal|experiment).*'
      OR LOWER(description) ~ '.*(science|nature|plant|animal|experiment).*' THEN 'science'
    WHEN
      LOWER(title) ~ '.*(art|draw|paint|color|creative).*'
      OR LOWER(description) ~ '.*(art|draw|paint|color|creative).*' THEN 'art'
    WHEN
      LOWER(title) ~ '.*(music|song|rhythm|dance|instrument).*'
      OR LOWER(description) ~ '.*(music|song|rhythm|dance|instrument).*' THEN 'music'
    WHEN
      LOWER(title) ~ '.*(physical|exercise|movement|motor|run|jump).*'
      OR LOWER(description) ~ '.*(physical|exercise|movement|motor|run|jump).*' THEN 'physical'
    ELSE 'general'
  END
WHERE subject = 'general';

-- ============================================================================
-- PART 6: VERIFICATION QUERY
-- ============================================================================

-- Function to verify the migration
CREATE OR REPLACE FUNCTION VERIFY_LESSONS_MIGRATION()
RETURNS TABLE (
  total_lessons bigint,
  status_breakdown json,
  subject_breakdown json,
  age_group_breakdown json
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM lessons) as total_lessons,
    (SELECT json_object_agg(status, count) 
     FROM (SELECT status, COUNT(*) as count FROM lessons GROUP BY status) s
    ) as status_breakdown,
    (SELECT json_object_agg(subject, count)
     FROM (SELECT subject, COUNT(*) as count FROM lessons GROUP BY subject) s
    ) as subject_breakdown,
    (SELECT json_object_agg(age_group, count)
     FROM (SELECT age_group, COUNT(*) as count FROM lessons GROUP BY age_group) s
    ) as age_group_breakdown;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION verify_lessons_migration TO authenticated;
GRANT EXECUTE ON FUNCTION verify_lessons_migration TO service_role;

-- ============================================================================
-- PART 7: COMMENTS
-- ============================================================================

COMMENT ON COLUMN lessons.status IS 'Lesson publication status: draft, active, archived, published';
COMMENT ON COLUMN lessons.subject IS 'Subject area: mathematics, literacy, science, art, music, physical, general';
COMMENT ON COLUMN lessons.age_group IS 'Target age group: 3-4, 4-5, 5-6, 3-6';
COMMENT ON COLUMN lessons.is_featured IS 'Whether this lesson is featured in the hub';
COMMENT ON COLUMN lessons.is_premium IS 'Whether this lesson requires premium access';
COMMENT ON COLUMN lessons.rating IS 'Average rating from 0.0 to 5.0';
COMMENT ON COLUMN lessons.completion_count IS 'Number of times this lesson has been completed';
COMMENT ON COLUMN lessons.short_description IS 'Short description for UI display';

COMMENT ON FUNCTION VERIFY_LESSONS_MIGRATION IS 'Verify the lessons table migration was successful';
