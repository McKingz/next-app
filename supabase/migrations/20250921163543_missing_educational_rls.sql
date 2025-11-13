-- Missing Educational RLS Policies
-- Date: 2025-09-21
-- Purpose: Enable RLS and create security policies for supporting educational tables
-- Missing tables: assignment_access, course_grades, course_join_requests, gradebook_entries, scheduled_tasks, student_progress

BEGIN;

-- ====================================================================
-- PART 1: ENABLE ROW LEVEL SECURITY
-- ====================================================================

-- Enable RLS on all supporting educational tables
ALTER TABLE assignment_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE gradebook_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_progress ENABLE ROW LEVEL SECURITY;

-- ====================================================================
-- PART 2: ASSIGNMENT ACCESS POLICIES
-- ====================================================================

-- Allow students to view assignment access records for assignments distributed to them
CREATE POLICY "Students can view their assignment access"
ON assignment_access
FOR SELECT
TO authenticated
USING (
  student_id = auth.uid()
  OR student_id IN (
    SELECT id FROM profiles
    WHERE
      id = auth.uid()
      AND role = 'student'
      AND organization_id IN (
        SELECT organization_id FROM profiles
        WHERE id = (
          SELECT student_id FROM assignment_access
          WHERE id = assignment_access.id
        )
      )
  )
);

-- Allow instructors to manage assignment access for their courses
CREATE POLICY "Instructors can manage assignment access for their courses"
ON assignment_access
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM assignments AS a
    INNER JOIN courses AS c ON a.course_id = c.id
    INNER JOIN profiles AS p ON p.id = auth.uid()
    WHERE
      a.id = assignment_access.assignment_id
      AND (c.instructor_id = auth.uid() OR p.role = 'admin')
      AND p.organization_id = c.organization_id
  )
);

-- ====================================================================
-- PART 3: COURSE GRADES POLICIES  
-- ====================================================================

-- Allow students to view their own course grades
CREATE POLICY "Students can view their own course grades"
ON course_grades
FOR SELECT
TO authenticated
USING (
  student_id = auth.uid()
  AND is_published = TRUE
);

-- Allow instructors to manage course grades for their courses
CREATE POLICY "Instructors can manage course grades for their courses"
ON course_grades
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM courses AS c
    INNER JOIN profiles AS p ON p.id = auth.uid()
    WHERE
      c.id = course_grades.course_id
      AND (c.instructor_id = auth.uid() OR p.role = 'admin')
      AND p.organization_id = c.organization_id
  )
);

-- Allow parents to view their children's course grades
CREATE POLICY "Parents can view their children's course grades"
ON course_grades
FOR SELECT
TO authenticated
USING (
  is_published = TRUE
  AND EXISTS (
    SELECT 1 FROM student_parent_relationships AS spr
    INNER JOIN profiles AS parent ON parent.id = auth.uid()
    WHERE
      spr.student_id = course_grades.student_id
      AND spr.parent_id = auth.uid()
      AND parent.role = 'parent'
  )
);

-- ====================================================================
-- PART 4: COURSE JOIN REQUESTS POLICIES
-- ====================================================================

-- Allow students to manage their own join requests
CREATE POLICY "Students can manage their own join requests"
ON course_join_requests
FOR ALL
TO authenticated
USING (
  student_id = auth.uid()
);

-- Allow instructors to view and process join requests for their courses
CREATE POLICY "Instructors can process join requests for their courses"
ON course_join_requests
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM courses AS c
    INNER JOIN profiles AS p ON p.id = auth.uid()
    WHERE
      c.id = course_join_requests.course_id
      AND (c.instructor_id = auth.uid() OR p.role = 'admin')
      AND p.organization_id = c.organization_id
  )
);

-- ====================================================================
-- PART 5: GRADEBOOK ENTRIES POLICIES
-- ====================================================================

-- Allow students to view their own gradebook entries
CREATE POLICY "Students can view their own gradebook entries"
ON gradebook_entries
FOR SELECT
TO authenticated
USING (
  student_id = auth.uid()
);

-- Allow instructors to manage gradebook entries for their courses
CREATE POLICY "Instructors can manage gradebook entries for their courses"
ON gradebook_entries
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM courses AS c
    INNER JOIN profiles AS p ON p.id = auth.uid()
    WHERE
      c.id = gradebook_entries.course_id
      AND (c.instructor_id = auth.uid() OR p.role = 'admin')
      AND p.organization_id = c.organization_id
  )
);

-- Allow parents to view their children's gradebook entries
CREATE POLICY "Parents can view their children's gradebook entries"
ON gradebook_entries
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM student_parent_relationships AS spr
    INNER JOIN profiles AS parent ON parent.id = auth.uid()
    WHERE
      spr.student_id = gradebook_entries.student_id
      AND spr.parent_id = auth.uid()
      AND parent.role = 'parent'
  )
);

-- ====================================================================
-- PART 6: SCHEDULED TASKS POLICIES
-- ====================================================================

-- Allow admins to manage all scheduled tasks in their organization
CREATE POLICY "Admins can manage scheduled tasks in their organization"
ON scheduled_tasks
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles AS p
    WHERE
      p.id = auth.uid()
      AND p.role IN ('admin', 'principal')
      AND (
        p.organization_id = p.organization_id
        OR p.organization_id IS NULL -- System-wide tasks
      )
  )
);

-- Allow instructors to view scheduled tasks in their organization
CREATE POLICY "Instructors can view scheduled tasks in their organization"
ON scheduled_tasks
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles AS p
    WHERE
      p.id = auth.uid()
      AND p.role IN ('instructor', 'admin', 'principal')
      AND p.organization_id = scheduled_tasks.organization_id
  )
);

-- ====================================================================
-- PART 7: STUDENT PROGRESS POLICIES
-- ====================================================================

-- Allow students to view their own progress
CREATE POLICY "Students can view their own progress"
ON student_progress
FOR SELECT
TO authenticated
USING (
  student_id = auth.uid()
);

-- Allow instructors to manage student progress for their courses
CREATE POLICY "Instructors can manage student progress for their courses"
ON student_progress
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM courses AS c
    INNER JOIN profiles AS p ON p.id = auth.uid()
    WHERE
      c.id = student_progress.course_id
      AND (c.instructor_id = auth.uid() OR p.role = 'admin')
      AND p.organization_id = c.organization_id
  )
);

-- Allow parents to view their children's progress
CREATE POLICY "Parents can view their children's progress"
ON student_progress
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM student_parent_relationships AS spr
    INNER JOIN profiles AS parent ON parent.id = auth.uid()
    WHERE
      spr.student_id = student_progress.student_id
      AND spr.parent_id = auth.uid()
      AND parent.role = 'parent'
  )
);

-- Allow admins to view all student progress in their organization
CREATE POLICY "Admins can view all student progress in their organization"
ON student_progress
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles AS p
    INNER JOIN courses AS c ON c.id = student_progress.course_id
    WHERE
      p.id = auth.uid()
      AND p.role IN ('admin', 'principal')
      AND p.organization_id = c.organization_id
  )
);

-- ====================================================================
-- PART 8: GRANT NECESSARY PERMISSIONS
-- ====================================================================

-- Grant permissions to authenticated users for the educational tables
GRANT SELECT, INSERT, UPDATE, DELETE ON assignment_access TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON course_grades TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON course_join_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON gradebook_entries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON scheduled_tasks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON student_progress TO authenticated;

-- Grant usage on sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

COMMIT;
