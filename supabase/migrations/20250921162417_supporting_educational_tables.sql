-- Supporting Educational Tables Migration
-- Date: 2025-09-21
-- Purpose: Add supporting tables for educational workflows
-- Includes: course_grades, student_progress, course_join_requests, assignment_access, 
-- gradebook_entries, scheduled_tasks, and groups

BEGIN;

-- ====================================================================
-- PART 1: STUDENT GROUPS FOR ASSIGNMENT DISTRIBUTION
-- ====================================================================

-- Groups Table (for organizing students)
CREATE TABLE IF NOT EXISTS public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Basic information
  name TEXT NOT NULL CHECK (length(name) >= 1 AND length(name) <= 100),
  description TEXT,

  -- Relationships
  course_id UUID NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES profiles (id) ON DELETE RESTRICT,

  -- Group settings
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  max_members INTEGER CHECK (max_members > 0),

  -- Metadata
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  UNIQUE (course_id, name)
);

-- Student Groups (Many-to-Many relationship)
CREATE TABLE IF NOT EXISTS public.student_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  student_id UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups (id) ON DELETE CASCADE,

  -- Membership details
  added_by UUID NOT NULL REFERENCES profiles (id) ON DELETE RESTRICT,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  -- Role in group (for projects, etc.)
  group_role TEXT DEFAULT 'member' CHECK (group_role IN ('member', 'leader', 'coordinator')),

  -- Metadata
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,

  -- Constraints
  UNIQUE (student_id, group_id)
);

-- ====================================================================
-- PART 2: COURSE JOIN REQUESTS
-- ====================================================================

-- Course Join Requests (for approval-based enrollment)
CREATE TABLE IF NOT EXISTS public.course_join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  student_id UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses (id) ON DELETE CASCADE,

  -- Request details
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  message TEXT, -- Optional message from student

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'approved', 'rejected', 'cancelled')
  ),
  processed_by UUID REFERENCES profiles (id) ON DELETE SET NULL,
  processed_at TIMESTAMPTZ,
  notes TEXT, -- Notes from instructor/admin

  -- Metadata
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,

  -- Constraints
  UNIQUE (student_id, course_id), -- One active request per student per course
  CONSTRAINT join_request_process_check CHECK (
    (status = 'pending' AND processed_by IS NULL AND processed_at IS NULL)
    OR (status != 'pending' AND processed_by IS NOT NULL AND processed_at IS NOT NULL)
  )
);

-- ====================================================================
-- PART 3: ASSIGNMENT ACCESS CONTROL
-- ====================================================================

-- Assignment Access (for group-based assignment distribution)
CREATE TABLE IF NOT EXISTS public.assignment_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  assignment_id UUID NOT NULL REFERENCES assignments (id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  group_id UUID REFERENCES groups (id) ON DELETE SET NULL,

  -- Access control
  distributed_by UUID NOT NULL REFERENCES profiles (id) ON DELETE RESTRICT,
  distributed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  -- Scheduling
  release_date TIMESTAMPTZ DEFAULT now(),

  -- Customization per student/group
  custom_due_date TIMESTAMPTZ,
  custom_instructions TEXT,
  custom_points DECIMAL(8, 2) CHECK (custom_points >= 0),

  -- Metadata
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,

  -- Constraints
  UNIQUE (assignment_id, student_id)
);

-- ====================================================================
-- PART 4: GRADEBOOK AND PROGRESS TRACKING
-- ====================================================================

-- Gradebook Entries (for organizing grades in gradebook)
CREATE TABLE IF NOT EXISTS public.gradebook_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  course_id UUID NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,

  -- Grade summary
  total_points_earned DECIMAL(10, 2) DEFAULT 0 CHECK (total_points_earned >= 0),
  total_points_possible DECIMAL(10, 2) DEFAULT 0 CHECK (total_points_possible >= 0),
  current_percentage DECIMAL(5, 2) GENERATED ALWAYS AS (
    CASE
      WHEN total_points_possible > 0 THEN (total_points_earned / total_points_possible) * 100
      ELSE 0
    END
  ) STORED,

  -- Letter grade
  current_letter_grade TEXT,

  -- Status
  is_passing BOOLEAN DEFAULT FALSE,

  -- Metadata
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  UNIQUE (course_id, student_id)
);

-- Course Grades (final/aggregated grades per course)
CREATE TABLE IF NOT EXISTS public.course_grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  course_id UUID NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,

  -- Final grade information
  final_grade DECIMAL(5, 2) NOT NULL CHECK (final_grade >= 0 AND final_grade <= 100),
  letter_grade TEXT NOT NULL,
  gpa_points DECIMAL(3, 2) CHECK (gpa_points >= 0 AND gpa_points <= 4),

  -- Category breakdown (if weighted grading is used)
  category_grades JSONB DEFAULT '{}'::JSONB,

  -- Calculation details
  calculation_method TEXT NOT NULL DEFAULT 'points' CHECK (
    calculation_method IN ('points', 'weighted', 'category_weighted')
  ),
  total_points_earned DECIMAL(10, 2),
  total_points_possible DECIMAL(10, 2),

  -- Status
  is_final BOOLEAN NOT NULL DEFAULT FALSE,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,

  -- Audit information
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  calculated_by UUID NOT NULL REFERENCES profiles (id) ON DELETE RESTRICT,

  -- Metadata
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,

  -- Constraints
  UNIQUE (course_id, student_id)
);

-- Student Progress (tracking and analytics)
CREATE TABLE IF NOT EXISTS public.student_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  course_id UUID NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,

  -- Progress data
  progress_data JSONB NOT NULL DEFAULT '{}'::JSONB,

  -- Alerts and notifications
  alerts JSONB DEFAULT '[]'::JSONB,
  alert_level TEXT DEFAULT 'none' CHECK (alert_level IN ('none', 'low', 'medium', 'high')),

  -- Tracking metrics
  assignments_completed INTEGER DEFAULT 0 CHECK (assignments_completed >= 0),
  assignments_total INTEGER DEFAULT 0 CHECK (assignments_total >= 0),
  assignments_late INTEGER DEFAULT 0 CHECK (assignments_late >= 0),
  assignments_missing INTEGER DEFAULT 0 CHECK (assignments_missing >= 0),

  -- Performance metrics
  average_grade DECIMAL(5, 2) CHECK (average_grade >= 0 AND average_grade <= 100),
  trend_direction TEXT DEFAULT 'stable' CHECK (trend_direction IN ('improving', 'declining', 'stable')),

  -- Engagement metrics
  last_activity_at TIMESTAMPTZ,
  engagement_score INTEGER DEFAULT 0 CHECK (engagement_score >= 0 AND engagement_score <= 100),

  -- Calculation details
  last_calculated TIMESTAMPTZ NOT NULL DEFAULT now(),
  calculated_by UUID NOT NULL REFERENCES profiles (id) ON DELETE RESTRICT,

  -- Metadata
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,

  -- Constraints
  UNIQUE (course_id, student_id)
);

-- ====================================================================
-- PART 5: SCHEDULED TASKS
-- ====================================================================

-- Scheduled Tasks (for workflow automation)
CREATE TABLE IF NOT EXISTS public.scheduled_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Task details
  type TEXT NOT NULL CHECK (type IN (
    'assignment_release', 'grade_reminder', 'due_date_reminder',
    'progress_report', 'bulk_enrollment', 'grade_aggregation'
  )),
  title TEXT NOT NULL,
  description TEXT,

  -- Scheduling
  scheduled_for TIMESTAMPTZ NOT NULL,
  repeat_interval INTERVAL, -- For recurring tasks

  -- Task data
  data JSONB NOT NULL DEFAULT '{}'::JSONB,

  -- Execution details
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'running', 'completed', 'failed', 'cancelled')
  ),
  executed_at TIMESTAMPTZ,
  execution_result JSONB,
  error_message TEXT,

  -- Relationships
  created_by UUID NOT NULL REFERENCES profiles (id) ON DELETE RESTRICT,
  organization_id UUID NOT NULL REFERENCES preschools (id) ON DELETE CASCADE,

  -- Metadata
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ====================================================================
-- PART 6: CREATE INDEXES
-- ====================================================================

-- Groups indexes
CREATE INDEX IF NOT EXISTS idx_groups_course_id ON groups (course_id);
CREATE INDEX IF NOT EXISTS idx_groups_created_by ON groups (created_by);
CREATE INDEX IF NOT EXISTS idx_groups_active ON groups (is_active);

-- Student Groups indexes
CREATE INDEX IF NOT EXISTS idx_student_groups_student_id ON student_groups (student_id);
CREATE INDEX IF NOT EXISTS idx_student_groups_group_id ON student_groups (group_id);
CREATE INDEX IF NOT EXISTS idx_student_groups_active ON student_groups (is_active);

-- Course Join Requests indexes
CREATE INDEX IF NOT EXISTS idx_course_join_requests_student_id ON course_join_requests (student_id);
CREATE INDEX IF NOT EXISTS idx_course_join_requests_course_id ON course_join_requests (course_id);
CREATE INDEX IF NOT EXISTS idx_course_join_requests_status ON course_join_requests (status);
CREATE INDEX IF NOT EXISTS idx_course_join_requests_requested_at ON course_join_requests (requested_at);

-- Assignment Access indexes
CREATE INDEX IF NOT EXISTS idx_assignment_access_assignment_id ON assignment_access (assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_access_student_id ON assignment_access (student_id);
CREATE INDEX IF NOT EXISTS idx_assignment_access_group_id ON assignment_access (group_id);
CREATE INDEX IF NOT EXISTS idx_assignment_access_active ON assignment_access (is_active);
CREATE INDEX IF NOT EXISTS idx_assignment_access_release_date ON assignment_access (release_date);

-- Gradebook Entries indexes
CREATE INDEX IF NOT EXISTS idx_gradebook_entries_course_id ON gradebook_entries (course_id);
CREATE INDEX IF NOT EXISTS idx_gradebook_entries_student_id ON gradebook_entries (student_id);
CREATE INDEX IF NOT EXISTS idx_gradebook_entries_percentage ON gradebook_entries (current_percentage);

-- Course Grades indexes
CREATE INDEX IF NOT EXISTS idx_course_grades_course_id ON course_grades (course_id);
CREATE INDEX IF NOT EXISTS idx_course_grades_student_id ON course_grades (student_id);
CREATE INDEX IF NOT EXISTS idx_course_grades_final_grade ON course_grades (final_grade);
CREATE INDEX IF NOT EXISTS idx_course_grades_published ON course_grades (is_published);

-- Student Progress indexes
CREATE INDEX IF NOT EXISTS idx_student_progress_course_id ON student_progress (course_id);
CREATE INDEX IF NOT EXISTS idx_student_progress_student_id ON student_progress (student_id);
CREATE INDEX IF NOT EXISTS idx_student_progress_alert_level ON student_progress (alert_level);
CREATE INDEX IF NOT EXISTS idx_student_progress_calculated ON student_progress (last_calculated);

-- Scheduled Tasks indexes
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_type ON scheduled_tasks (type);
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_scheduled_for ON scheduled_tasks (scheduled_for);
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_status ON scheduled_tasks (status);
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_organization_id ON scheduled_tasks (organization_id);

-- ====================================================================
-- PART 7: ADD TRIGGERS
-- ====================================================================

-- Create triggers for updated_at columns
CREATE TRIGGER groups_updated_at BEFORE UPDATE ON groups
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER gradebook_entries_updated_at BEFORE UPDATE ON gradebook_entries
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER scheduled_tasks_updated_at BEFORE UPDATE ON scheduled_tasks
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;
