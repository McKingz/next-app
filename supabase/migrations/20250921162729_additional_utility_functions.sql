-- Additional Utility Functions Migration
-- Date: 2025-09-21
-- Purpose: Add utility functions referenced in educational services
-- Includes: organization helpers, user helpers, and additional workflow functions

BEGIN;

-- ====================================================================
-- PART 1: ORGANIZATION AND USER HELPER FUNCTIONS
-- ====================================================================

-- Function to get user's organization ID
CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT 
        COALESCE(
            p.organization_id,
            p.preschool_id
        ) as organization_id
    FROM profiles p
    WHERE p.id = auth.uid();
$$;

-- Function to get user's role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT p.role
    FROM profiles p
    WHERE p.id = auth.uid();
$$;

-- Function to check if user has role
CREATE OR REPLACE FUNCTION public.user_has_role(required_role TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid()
        AND p.role = required_role
    );
$$;

-- Function to check if user has any of the specified roles
CREATE OR REPLACE FUNCTION public.user_has_any_role(roles TEXT [])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid()
        AND p.role = ANY(roles)
    );
$$;

-- Function to check if user is in same organization as target user
CREATE OR REPLACE FUNCTION public.same_organization_as_user(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM profiles p1, profiles p2
        WHERE p1.id = auth.uid()
        AND p2.id = target_user_id
        AND COALESCE(p1.organization_id, p1.preschool_id) = COALESCE(p2.organization_id, p2.preschool_id)
    );
$$;

-- ====================================================================
-- PART 2: EDUCATIONAL WORKFLOW HELPER FUNCTIONS
-- ====================================================================

-- Function to check if user can access course
CREATE OR REPLACE FUNCTION public.can_access_course(course_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
    user_id UUID := auth.uid();
    user_role TEXT;
    user_org_id UUID;
    course_org_id UUID;
    course_instructor_id UUID;
    is_enrolled BOOLEAN := false;
BEGIN
    -- Get user information
    SELECT role, COALESCE(organization_id, preschool_id)
    INTO user_role, user_org_id
    FROM profiles
    WHERE id = user_id;
    
    IF user_role IS NULL THEN
        RETURN false;
    END IF;
    
    -- Get course information
    SELECT instructor_id, organization_id
    INTO course_instructor_id, course_org_id
    FROM courses
    WHERE id = course_id
    AND deleted_at IS NULL;
    
    IF course_org_id IS NULL THEN
        RETURN false;
    END IF;
    
    -- Super admins can access all courses
    IF user_role = 'super_admin' THEN
        RETURN true;
    END IF;
    
    -- Must be in same organization
    IF user_org_id != course_org_id THEN
        RETURN false;
    END IF;
    
    -- Admins can access all courses in their organization
    IF user_role = 'admin' THEN
        RETURN true;
    END IF;
    
    -- Instructors can access their own courses
    IF user_role = 'instructor' AND course_instructor_id = user_id THEN
        RETURN true;
    END IF;
    
    -- Students can access courses they are enrolled in
    IF user_role = 'student' THEN
        SELECT EXISTS (
            SELECT 1 FROM enrollments
            WHERE student_id = user_id
            AND course_id = course_id
            AND is_active = true
        ) INTO is_enrolled;
        
        RETURN is_enrolled;
    END IF;
    
    -- Default deny
    RETURN false;
END;
$$;

-- Function to check if user can access assignment
CREATE OR REPLACE FUNCTION public.can_access_assignment(assignment_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
    user_id UUID := auth.uid();
    assignment_course_id UUID;
    has_access BOOLEAN := false;
    is_available BOOLEAN := false;
BEGIN
    -- Get assignment's course ID
    SELECT course_id INTO assignment_course_id
    FROM assignments
    WHERE id = assignment_id
    AND deleted_at IS NULL;
    
    IF assignment_course_id IS NULL THEN
        RETURN false;
    END IF;
    
    -- Check if user can access the course
    SELECT can_access_course(assignment_course_id) INTO has_access;
    
    IF NOT has_access THEN
        RETURN false;
    END IF;
    
    -- For students, check if assignment is available
    IF get_user_role() = 'student' THEN
        SELECT (
            (available_from IS NULL OR available_from <= now()) AND
            (available_until IS NULL OR available_until > now())
        ) INTO is_available
        FROM assignments
        WHERE id = assignment_id;
        
        -- Also check assignment access table for group-based distribution
        IF NOT is_available THEN
            SELECT EXISTS (
                SELECT 1 FROM assignment_access
                WHERE assignment_id = assignment_id
                AND student_id = user_id
                AND is_active = true
                AND (release_date IS NULL OR release_date <= now())
            ) INTO is_available;
        END IF;
        
        RETURN is_available;
    END IF;
    
    -- Instructors and admins have full access
    RETURN true;
END;
$$;

-- Function to check if user can access submission
CREATE OR REPLACE FUNCTION public.can_access_submission(submission_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
    user_id UUID := auth.uid();
    user_role TEXT := get_user_role();
    submission_student_id UUID;
    submission_assignment_id UUID;
BEGIN
    -- Get submission details
    SELECT student_id, assignment_id
    INTO submission_student_id, submission_assignment_id
    FROM submissions
    WHERE id = submission_id;
    
    IF submission_assignment_id IS NULL THEN
        RETURN false;
    END IF;
    
    -- Students can only access their own submissions
    IF user_role = 'student' THEN
        RETURN submission_student_id = user_id;
    END IF;
    
    -- Others need assignment access
    RETURN can_access_assignment(submission_assignment_id);
END;
$$;

-- Function to check if user can access grade
CREATE OR REPLACE FUNCTION public.can_access_grade(grade_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
    user_id UUID := auth.uid();
    user_role TEXT := get_user_role();
    grade_submission_id UUID;
    grade_is_published BOOLEAN;
    submission_student_id UUID;
BEGIN
    -- Get grade details
    SELECT g.submission_id, g.is_published, s.student_id
    INTO grade_submission_id, grade_is_published, submission_student_id
    FROM grades g
    JOIN submissions s ON s.id = g.submission_id
    WHERE g.id = grade_id;
    
    IF grade_submission_id IS NULL THEN
        RETURN false;
    END IF;
    
    -- Students can only see their own published grades
    IF user_role = 'student' THEN
        RETURN submission_student_id = user_id AND grade_is_published;
    END IF;
    
    -- Others need submission access
    RETURN can_access_submission(grade_submission_id);
END;
$$;

-- ====================================================================
-- PART 3: EDUCATIONAL STATISTICS FUNCTIONS
-- ====================================================================

-- Function to get enrollment count for a course
CREATE OR REPLACE FUNCTION public.get_course_enrollment_count(course_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT COUNT(*)::INTEGER
    FROM enrollments e
    WHERE e.course_id = get_course_enrollment_count.course_id
    AND e.is_active = true;
$$;

-- Function to get assignment count for a course
CREATE OR REPLACE FUNCTION public.get_course_assignment_count(course_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT COUNT(*)::INTEGER
    FROM assignments a
    WHERE a.course_id = get_course_assignment_count.course_id
    AND a.deleted_at IS NULL;
$$;

-- Function to get submission count for an assignment
CREATE OR REPLACE FUNCTION public.get_assignment_submission_count(assignment_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT COUNT(*)::INTEGER
    FROM submissions s
    WHERE s.assignment_id = get_assignment_submission_count.assignment_id
    AND s.is_draft = false;
$$;

-- Function to get grade count for an assignment
CREATE OR REPLACE FUNCTION public.get_assignment_grade_count(assignment_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT COUNT(*)::INTEGER
    FROM grades g
    JOIN submissions s ON s.id = g.submission_id
    WHERE s.assignment_id = get_assignment_grade_count.assignment_id;
$$;

-- ====================================================================
-- PART 4: VALIDATION FUNCTIONS
-- ====================================================================

-- Function to validate join code
CREATE OR REPLACE FUNCTION public.is_valid_join_code(code TEXT, course_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM courses c
        WHERE c.id = course_id
        AND c.join_code = code
        AND c.is_active = true
        AND c.deleted_at IS NULL
        AND (c.join_code_expires_at IS NULL OR c.join_code_expires_at > now())
    );
$$;

-- Function to check if student can enroll in course
CREATE OR REPLACE FUNCTION public.can_student_enroll_in_course(student_id UUID, course_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
    course_max_students INTEGER;
    current_enrollment_count INTEGER;
    is_already_enrolled BOOLEAN;
    course_is_active BOOLEAN;
BEGIN
    -- Check if course exists and is active
    SELECT is_active, max_students
    INTO course_is_active, course_max_students
    FROM courses
    WHERE id = course_id
    AND deleted_at IS NULL;
    
    IF NOT FOUND OR NOT course_is_active THEN
        RETURN false;
    END IF;
    
    -- Check if student is already enrolled
    SELECT EXISTS (
        SELECT 1 FROM enrollments
        WHERE student_id = can_student_enroll_in_course.student_id
        AND course_id = can_student_enroll_in_course.course_id
        AND is_active = true
    ) INTO is_already_enrolled;
    
    IF is_already_enrolled THEN
        RETURN false;
    END IF;
    
    -- Check enrollment capacity
    IF course_max_students IS NOT NULL THEN
        SELECT get_course_enrollment_count(course_id) INTO current_enrollment_count;
        
        IF current_enrollment_count >= course_max_students THEN
            RETURN false;
        END IF;
    END IF;
    
    RETURN true;
END;
$$;

-- ====================================================================
-- PART 5: GRADE BOOK UPDATE FUNCTIONS
-- ====================================================================

-- Function to update gradebook entry for a student
CREATE OR REPLACE FUNCTION public.update_gradebook_entry(course_id UUID, student_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    total_earned DECIMAL(10,2) := 0;
    total_possible DECIMAL(10,2) := 0;
    current_letter_grade TEXT;
BEGIN
    -- Calculate totals from published grades
    SELECT 
        COALESCE(SUM(g.points_earned), 0),
        COALESCE(SUM(g.points_possible), 0)
    INTO total_earned, total_possible
    FROM grades g
    JOIN submissions s ON s.id = g.submission_id
    JOIN assignments a ON a.id = s.assignment_id
    WHERE a.course_id = update_gradebook_entry.course_id
    AND s.student_id = update_gradebook_entry.student_id
    AND g.is_published = true
    AND a.deleted_at IS NULL;
    
    -- Calculate letter grade
    IF total_possible > 0 THEN
        current_letter_grade := public.percentage_to_letter_grade((total_earned / total_possible) * 100);
    ELSE
        current_letter_grade := NULL;
    END IF;
    
    -- Update or insert gradebook entry
    INSERT INTO gradebook_entries (
        course_id, 
        student_id, 
        total_points_earned, 
        total_points_possible, 
        current_letter_grade
    )
    VALUES (
        update_gradebook_entry.course_id, 
        update_gradebook_entry.student_id, 
        total_earned, 
        total_possible, 
        current_letter_grade
    )
    ON CONFLICT (course_id, student_id)
    DO UPDATE SET
        total_points_earned = EXCLUDED.total_points_earned,
        total_points_possible = EXCLUDED.total_points_possible,
        current_letter_grade = EXCLUDED.current_letter_grade,
        updated_at = now();
END;
$$;

-- ====================================================================
-- PART 6: AUTOMATED TRIGGERS FOR GRADEBOOK UPDATES
-- ====================================================================

-- Function to trigger gradebook update when grades change
CREATE OR REPLACE FUNCTION public.trigger_gradebook_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    affected_course_id UUID;
    affected_student_id UUID;
BEGIN
    -- Get course and student IDs from the grade change
    SELECT a.course_id, s.student_id
    INTO affected_course_id, affected_student_id
    FROM submissions s
    JOIN assignments a ON a.id = s.assignment_id
    WHERE s.id = COALESCE(NEW.submission_id, OLD.submission_id);
    
    -- Update gradebook entry
    IF affected_course_id IS NOT NULL AND affected_student_id IS NOT NULL THEN
        PERFORM update_gradebook_entry(affected_course_id, affected_student_id);
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger for grade changes
DROP TRIGGER IF EXISTS update_gradebook_on_grade_change ON grades;
CREATE TRIGGER update_gradebook_on_grade_change
AFTER INSERT OR UPDATE OR DELETE ON grades
FOR EACH ROW
EXECUTE FUNCTION trigger_gradebook_update();

-- ====================================================================
-- PART 7: GRANT PERMISSIONS
-- ====================================================================

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_organization_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_role(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_any_role(TEXT []) TO authenticated;
GRANT EXECUTE ON FUNCTION public.same_organization_as_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_course(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_assignment(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_submission(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_grade(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_course_enrollment_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_course_assignment_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_assignment_submission_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_assignment_grade_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_valid_join_code(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_student_enroll_in_course(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_gradebook_entry(UUID, UUID) TO authenticated;

COMMIT;
