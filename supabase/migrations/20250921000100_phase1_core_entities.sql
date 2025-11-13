-- Phase 1: Core Educational Entities Migration
-- Date: 2025-09-21
-- Purpose: Add Course, Enrollment, Assignment, Submission, and Grade tables
-- Compatible with existing EduDash Pro schema

BEGIN;

-- ====================================================================
-- PART 1: CREATE CORE EDUCATIONAL ENTITIES
-- ====================================================================

-- Courses Table
CREATE TABLE IF NOT EXISTS public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Basic course information
  title TEXT NOT NULL CHECK (length(title) >= 1 AND length(title) <= 255),
  description TEXT,
  course_code TEXT CHECK (length(course_code) <= 20),

  -- Relationships
  instructor_id UUID NOT NULL REFERENCES profiles (id) ON DELETE RESTRICT,
  organization_id UUID NOT NULL REFERENCES preschools (id) ON DELETE CASCADE,

  -- Course settings
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  max_students INTEGER CHECK (max_students > 0),
  join_code TEXT UNIQUE, -- Generated join code for student enrollment
  join_code_expires_at TIMESTAMPTZ,

  -- Academic periods
  start_date DATE,
  end_date DATE CHECK (end_date IS NULL OR end_date > start_date),

  -- Metadata
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,

  -- Soft delete support
  deleted_at TIMESTAMPTZ,

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT courses_dates_check CHECK (start_date IS NULL OR end_date IS NULL OR end_date > start_date),
  CONSTRAINT courses_join_code_check CHECK (join_code IS NULL OR length(join_code) >= 6)
);

-- Enrollments Table (Many-to-Many relationship between students and courses)
CREATE TABLE IF NOT EXISTS public.enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  student_id UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses (id) ON DELETE CASCADE,

  -- Enrollment details
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  enrollment_method TEXT NOT NULL DEFAULT 'manual' CHECK (
    enrollment_method IN ('manual', 'join_code', 'admin_assigned', 'imported')
  ),

  -- Status tracking
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  dropped_at TIMESTAMPTZ,
  drop_reason TEXT,

  -- Metadata
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  UNIQUE (student_id, course_id), -- One enrollment per student per course
  CONSTRAINT enrollments_drop_check CHECK (
    (is_active = TRUE AND dropped_at IS NULL)
    OR (is_active = FALSE AND dropped_at IS NOT NULL)
  )
);

-- Add missing columns to existing assignments table
-- The assignments table already exists, so we add only the columns we need for our educational system
DO $$
BEGIN
    -- Add course_id column to link assignments to courses
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assignments' AND column_name = 'course_id') THEN
        ALTER TABLE assignments ADD COLUMN course_id UUID REFERENCES courses(id) ON DELETE CASCADE;
    END IF;
    
    -- Add assignment_type for categorization 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assignments' AND column_name = 'assignment_type') THEN
        ALTER TABLE assignments ADD COLUMN assignment_type TEXT DEFAULT 'homework' 
        CHECK (assignment_type IN ('homework', 'quiz', 'exam', 'project', 'lab', 'discussion'));
    END IF;
    
    -- Add assigned_at (map from existing assigned_date)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assignments' AND column_name = 'assigned_at') THEN
        ALTER TABLE assignments ADD COLUMN assigned_at TIMESTAMPTZ;
        -- Copy from assigned_date if it exists
        UPDATE assignments SET assigned_at = assigned_date WHERE assigned_date IS NOT NULL;
        -- Set default for null values
        UPDATE assignments SET assigned_at = created_at WHERE assigned_at IS NULL;
    END IF;
    
    -- Add due_at (map from existing due_date) 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assignments' AND column_name = 'due_at') THEN
        ALTER TABLE assignments ADD COLUMN due_at TIMESTAMPTZ;
        -- Copy from due_date if it exists
        UPDATE assignments SET due_at = due_date WHERE due_date IS NOT NULL;
    END IF;
    
    -- Add availability window columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assignments' AND column_name = 'available_from') THEN
        ALTER TABLE assignments ADD COLUMN available_from TIMESTAMPTZ;
        UPDATE assignments SET available_from = assigned_at WHERE assigned_at IS NOT NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assignments' AND column_name = 'available_until') THEN
        ALTER TABLE assignments ADD COLUMN available_until TIMESTAMPTZ;
    END IF;
    
    -- Add submission control columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assignments' AND column_name = 'allow_late_submissions') THEN
        ALTER TABLE assignments ADD COLUMN allow_late_submissions BOOLEAN DEFAULT true;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assignments' AND column_name = 'late_penalty_percent') THEN
        ALTER TABLE assignments ADD COLUMN late_penalty_percent DECIMAL(5,2) DEFAULT 0 
        CHECK (late_penalty_percent >= 0 AND late_penalty_percent <= 100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assignments' AND column_name = 'max_attempts') THEN
        ALTER TABLE assignments ADD COLUMN max_attempts INTEGER DEFAULT 1 CHECK (max_attempts > 0);
    END IF;
    
    -- Add file attachments support
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assignments' AND column_name = 'attachments') THEN
        ALTER TABLE assignments ADD COLUMN attachments JSONB DEFAULT '[]'::jsonb;
    END IF;
    
    -- Add metadata column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assignments' AND column_name = 'metadata') THEN
        ALTER TABLE assignments ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;
    
    -- Add soft delete support
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assignments' AND column_name = 'deleted_at') THEN
        ALTER TABLE assignments ADD COLUMN deleted_at TIMESTAMPTZ;
    END IF;
    
    -- Update max_points to decimal if it's currently integer
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assignments' AND column_name = 'max_points' AND data_type = 'integer') THEN
        ALTER TABLE assignments ALTER COLUMN max_points TYPE DECIMAL(8,2);
    END IF;
END $$;

-- Submissions Table
CREATE TABLE IF NOT EXISTS public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  assignment_id UUID NOT NULL REFERENCES assignments (id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,

  -- Submission content
  content TEXT, -- Text submission
  attachments JSONB DEFAULT '[]'::JSONB, -- File attachments (URLs)
  submission_type TEXT NOT NULL DEFAULT 'text' CHECK (
    submission_type IN ('text', 'file', 'url', 'multiple')
  ),

  -- Submission tracking
  attempt_number INTEGER NOT NULL DEFAULT 1 CHECK (attempt_number > 0),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_late BOOLEAN NOT NULL DEFAULT FALSE,
  is_draft BOOLEAN NOT NULL DEFAULT FALSE,

  -- AI assistance tracking (for academic integrity)
  ai_assistance_used BOOLEAN NOT NULL DEFAULT FALSE,
  ai_assistance_details JSONB DEFAULT '{}'::JSONB,

  -- Metadata
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  UNIQUE (assignment_id, student_id, attempt_number), -- One submission per attempt
  CONSTRAINT submissions_content_check CHECK (
    (submission_type = 'text' AND content IS NOT NULL)
    OR (submission_type IN ('file', 'url', 'multiple') AND attachments != '[]'::JSONB)
    OR is_draft = TRUE
  )
);

-- Grades Table
CREATE TABLE IF NOT EXISTS public.grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  submission_id UUID NOT NULL REFERENCES submissions (id) ON DELETE CASCADE,
  graded_by UUID NOT NULL REFERENCES profiles (id) ON DELETE RESTRICT,

  -- Grade information
  points_earned DECIMAL(8, 2) NOT NULL CHECK (points_earned >= 0),
  points_possible DECIMAL(8, 2) NOT NULL CHECK (points_possible > 0),
  percentage DECIMAL(5, 2) GENERATED ALWAYS AS ((points_earned / points_possible) * 100) STORED,

  -- Letter grade (optional)
  letter_grade TEXT CHECK (letter_grade ~ '^[A-F][+-]?$|^Pass$|^Fail$|^Incomplete$'),

  -- Feedback
  feedback TEXT,
  rubric_scores JSONB DEFAULT '{}'::JSONB, -- Structured rubric scoring

  -- AI assistance in grading
  ai_assistance_used BOOLEAN NOT NULL DEFAULT FALSE,
  ai_suggestions JSONB DEFAULT '{}'::JSONB,

  -- Status
  is_final BOOLEAN NOT NULL DEFAULT TRUE,
  is_published BOOLEAN NOT NULL DEFAULT FALSE, -- Students can see published grades

  -- Metadata
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  UNIQUE (submission_id), -- One grade per submission
  CONSTRAINT grades_points_check CHECK (points_earned <= points_possible)
);

-- ====================================================================
-- PART 2: CREATE INDEXES FOR PERFORMANCE
-- ====================================================================

-- Courses indexes
CREATE INDEX IF NOT EXISTS idx_courses_instructor_id ON courses (instructor_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_courses_organization_id ON courses (organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_courses_active ON courses (is_active) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_courses_join_code ON courses (join_code) WHERE join_code IS NOT NULL
AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_courses_dates ON courses (start_date, end_date) WHERE deleted_at IS NULL;

-- Enrollments indexes
CREATE INDEX IF NOT EXISTS idx_enrollments_student_id ON enrollments (student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course_id ON enrollments (course_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_active ON enrollments (is_active);
CREATE INDEX IF NOT EXISTS idx_enrollments_enrolled_at ON enrollments (enrolled_at);

-- Assignments indexes
CREATE INDEX IF NOT EXISTS idx_assignments_course_id ON assignments (course_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_assignments_due_at ON assignments (due_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_assignments_assigned_at ON assignments (assigned_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_assignments_type ON assignments (assignment_type) WHERE deleted_at IS NULL;

-- Submissions indexes
CREATE INDEX IF NOT EXISTS idx_submissions_assignment_id ON submissions (assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student_id ON submissions (student_id);
CREATE INDEX IF NOT EXISTS idx_submissions_submitted_at ON submissions (submitted_at);
CREATE INDEX IF NOT EXISTS idx_submissions_is_draft ON submissions (is_draft);
CREATE INDEX IF NOT EXISTS idx_submissions_is_late ON submissions (is_late);

-- Grades indexes
CREATE INDEX IF NOT EXISTS idx_grades_submission_id ON grades (submission_id);
CREATE INDEX IF NOT EXISTS idx_grades_graded_by ON grades (graded_by);
CREATE INDEX IF NOT EXISTS idx_grades_is_published ON grades (is_published);
CREATE INDEX IF NOT EXISTS idx_grades_created_at ON grades (created_at);

-- ====================================================================
-- PART 3: UTILITY FUNCTIONS
-- ====================================================================

-- Function to generate unique join codes
CREATE OR REPLACE FUNCTION public.generate_course_join_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    join_code TEXT;
    code_exists BOOLEAN;
BEGIN
    LOOP
        -- Generate 6-character alphanumeric code (excluding ambiguous chars)
        join_code := upper(
            substring(
                replace(
                    replace(
                        replace(encode(gen_random_bytes(8), 'base64'), '/', ''),
                        '+', ''
                    ), 
                    '=', ''
                ), 1, 6
            )
        );
        
        -- Replace ambiguous characters
        join_code := replace(replace(replace(replace(join_code, '0', '2'), '1', '3'), 'O', 'P'), 'I', 'J');
        
        -- Check if this code already exists
        SELECT EXISTS(
            SELECT 1 FROM courses 
            WHERE join_code = join_code 
            AND deleted_at IS NULL 
            AND (join_code_expires_at IS NULL OR join_code_expires_at > now())
        ) INTO code_exists;
        
        EXIT WHEN NOT code_exists;
    END LOOP;
    
    RETURN join_code;
END;
$$;

-- Function to update updated_at timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- ====================================================================
-- PART 4: CREATE TRIGGERS
-- ====================================================================

-- Create triggers for updated_at columns (idempotent)
DO $$
BEGIN
    -- Courses trigger
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'courses_updated_at') THEN
        CREATE TRIGGER courses_updated_at BEFORE UPDATE ON courses
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    -- Enrollments trigger
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'enrollments_updated_at') THEN
        CREATE TRIGGER enrollments_updated_at BEFORE UPDATE ON enrollments
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    -- Assignments trigger
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'assignments_updated_at') THEN
        CREATE TRIGGER assignments_updated_at BEFORE UPDATE ON assignments
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    -- Submissions trigger
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'submissions_updated_at') THEN
        CREATE TRIGGER submissions_updated_at BEFORE UPDATE ON submissions
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    -- Grades trigger
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'grades_updated_at') THEN
        CREATE TRIGGER grades_updated_at BEFORE UPDATE ON grades
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

COMMIT;
